const express = require("express");
const multer = require("multer");
const path = require("path");

const { pool } = require("../database");
const authMiddleware = require("../auth");

const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

// =====================================================
// CLOUDINARY STORAGE
// =====================================================

const storage = new CloudinaryStorage({
    cloudinary,

    params: async (req, file) => ({
        folder: "cartfox/products",

        allowed_formats: [
            "jpg",
            "jpeg",
            "png",
            "webp"
        ],

        public_id: `${Date.now()}-${file.originalname
            .replace(/\s+/g, "-")
            .replace(/[^a-zA-Z0-9._-]/g, "")}`
    })
});

const upload = multer({ storage });

// =====================================================
// FALLBACK
// =====================================================

const FALLBACK_IMAGE_URL =
    "https://via.placeholder.com/600x400?text=CartFox";

// =====================================================
// CLEAN IMAGE URL
// =====================================================

function cleanImageUrl(value) {

    if (!value) {
        return null;
    }

    let url = String(value).trim();

    if (!url) {
        return null;
    }

    // -------------------------------------------------
    // Handle Markdown image/link format
    // Example:
    // [https://example.com/image.jpg](https://example.com/image.jpg)
    // -------------------------------------------------

    const markdownMatch = url.match(
        /\]\((https?:\/\/[^)]+)\)/
    );

    if (markdownMatch) {
        return markdownMatch[1];
    }

    // -------------------------------------------------
    // Handle [URL] format
    // -------------------------------------------------

    const bracketMatch = url.match(
        /^\[(https?:\/\/[^\]]+)\]$/
    );

    if (bracketMatch) {
        return bracketMatch[1];
    }

    // -------------------------------------------------
    // Extract URL if extra text exists
    // -------------------------------------------------

    const httpMatch = url.match(
        /(https?:\/\/[^\s"'<>\])]+)/
    );

    if (httpMatch) {
        return httpMatch[1];
    }

    // -------------------------------------------------
    // Local upload compatibility
    // -------------------------------------------------

    if (url.startsWith("/uploads/")) {
        return `${process.env.BASE_URL || "https://cartfox.onrender.com"}${url}`;
    }

    if (url.startsWith("uploads/")) {
        return `${process.env.BASE_URL || "https://cartfox.onrender.com"}/${url}`;
    }

    return null;
}

// =====================================================
// PARSE IMAGE FIELD
// =====================================================

function parseImages(imageValue) {

    if (!imageValue) {
        return [];
    }

    let images = [];

    // Already array
    if (Array.isArray(imageValue)) {
        images = imageValue;
    }

    // String
    else if (typeof imageValue === "string") {

        const value = imageValue.trim();

        // Try JSON first
        try {

            const parsed = JSON.parse(value);

            if (Array.isArray(parsed)) {
                images = parsed;
            }

            else if (typeof parsed === "string") {
                images = [parsed];
            }

        } catch {

            // Legacy single URL
            images = [value];
        }
    }

    return images
        .map(cleanImageUrl)
        .filter(Boolean);
}

// =====================================================
// PROCESS PRODUCT
// =====================================================

function processProduct(product) {

    if (!product) {
        return product;
    }

    const images = parseImages(product.imageurl);

    product.images = images;

    product.imageUrl =
        images.length > 0
            ? images[0]
            : FALLBACK_IMAGE_URL;

    return product;
}

// =====================================================
// GET ALL PRODUCTS
// =====================================================

router.get("/", async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT *
            FROM products
            ORDER BY id DESC
            `
        );

        const products =
            result.rows.map(processProduct);

        res.json(products);

    } catch (err) {

        console.error(
            "GET PRODUCTS ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// =====================================================
// GET SINGLE PRODUCT
// =====================================================

router.get("/:id", async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT *
            FROM products
            WHERE id=$1
            `,
            [req.params.id]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json(
            processProduct(result.rows[0])
        );

    } catch (err) {

        console.error(
            "GET SINGLE PRODUCT ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// =====================================================
// ADD PRODUCT
// =====================================================

router.post(
    "/",
    authMiddleware,
    upload.array("images", 3),
    async (req, res) => {

        try {

            const {
                name,
                price,
                producttype,
                category,
                affiliatelink,
                description,
                rating,
                stock
            } = req.body;

            // -----------------------------------------
            // IMPORTANT:
            // Cloudinary URL = file.path
            // -----------------------------------------

            let images = [];

            if (
                req.files &&
                req.files.length > 0
            ) {

                images = req.files
                    .map(file => file.path)
                    .filter(Boolean);
            }

            const imageUrl =
                JSON.stringify(images);

            const result = await pool.query(
                `
                INSERT INTO products
                (
                    name,
                    price,
                    imageurl,
                    producttype,
                    category,
                    affiliatelink,
                    description,
                    rating,
                    stock
                )

                VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9)

                RETURNING id
                `,
                [
                    name,
                    price,
                    imageUrl,
                    producttype || "own",
                    category || "General",
                    affiliatelink || "",
                    description || "",
                    rating || 0,
                    stock || 0
                ]
            );

            res.status(201).json({

                success: true,

                message:
                    "Product Added Successfully",

                id: result.rows[0].id
            });

        } catch (err) {

            console.error(
                "ADD PRODUCT ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                message: err.message
            });
        }
    }
);

// =====================================================
// UPDATE PRODUCT
// =====================================================

router.put(
    "/:id",
    authMiddleware,
    upload.array("images", 3),
    async (req, res) => {

        try {

            const {
                name,
                price,
                producttype,
                category,
                affiliatelink,
                description,
                rating,
                stock
            } = req.body;

            const oldProductResult =
                await pool.query(
                    `
                    SELECT imageurl
                    FROM products
                    WHERE id=$1
                    `,
                    [req.params.id]
                );

            if (
                oldProductResult.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            let imageUrlToStore =
                oldProductResult.rows[0].imageurl;

            // -----------------------------------------
            // If new images uploaded
            // save Cloudinary URLs
            // -----------------------------------------

            if (
                req.files &&
                req.files.length > 0
            ) {

                const newImages =
                    req.files
                        .map(file => file.path)
                        .filter(Boolean);

                imageUrlToStore =
                    JSON.stringify(newImages);
            }

            await pool.query(
                `
                UPDATE products
                SET
                    name=$1,
                    price=$2,
                    imageurl=$3,
                    producttype=$4,
                    category=$5,
                    affiliatelink=$6,
                    description=$7,
                    rating=$8,
                    stock=$9,
                    updated_at=CURRENT_TIMESTAMP

                WHERE id=$10
                `,
                [
                    name,
                    price,
                    imageUrlToStore,
                    producttype || "own",
                    category || "General",
                    affiliatelink || "",
                    description || "",
                    rating || 0,
                    stock || 0,
                    req.params.id
                ]
            );

            res.json({

                success: true,

                message:
                    "Product Updated Successfully"
            });

        } catch (err) {

            console.error(
                "UPDATE PRODUCT ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                message: err.message
            });
        }
    }
);

// =====================================================
// DELETE PRODUCT
// =====================================================

router.delete(
    "/:id",
    authMiddleware,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    DELETE FROM products
                    WHERE id=$1
                    RETURNING id
                    `,
                    [req.params.id]
                );

            if (result.rows.length === 0) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Product not found"
                });
            }

            res.json({

                success: true,

                message:
                    "Product Deleted Successfully"
            });

        } catch (err) {

            console.error(
                "DELETE PRODUCT ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                message: err.message
            });
        }
    }
);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;