const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const { pool } = require("../database");
const authMiddleware = require("../auth");

const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

// =====================================================
// CONSTANTS
// =====================================================

const FALLBACK_IMAGE_URL =
    "https://placehold.co/600x400?text=CartFox";

const BASE_URL =
    process.env.BASE_URL ||
    "https://cartfox-backend.onrender.com";

// =====================================================
// CLOUDINARY STORAGE
// =====================================================
//
// IMPORTANT:
// Do NOT include .jpg/.png extension inside public_id.
// Otherwise Cloudinary can create:
// image.jpg.jpg
//
// Cloudinary automatically adds the correct extension.
// =====================================================

const storage = new CloudinaryStorage({
    cloudinary,

    params: async (req, file) => {
        const originalName = path.parse(file.originalname).name;

        const safeName = originalName
            .replace(/\s+/g, "-")
            .replace(/[^a-zA-Z0-9_-]/g, "")
            .substring(0, 80);

        const uniqueId = crypto.randomBytes(6).toString("hex");

        return {
            folder: "cartfox/products",

            allowed_formats: [
                "jpg",
                "jpeg",
                "png",
                "webp"
            ],

            resource_type: "image",

            public_id:
                `${Date.now()}-${safeName || "product"}-${uniqueId}`
        };
    }
});

// =====================================================
// MULTER
// =====================================================

const upload = multer({
    storage,

    limits: {
        files: 3,
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        const allowedMimeTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(
                new Error(
                    "Only JPG, JPEG, PNG and WEBP images are allowed."
                )
            );
        }

        cb(null, true);
    }
});

// =====================================================
// CLEAN IMAGE URL
// =====================================================
//
// Supports:
// - Cloudinary URL
// - normal HTTPS URL
// - old /uploads/ URL
// - old malformed Markdown-style URLs
// - JSON array handling is done separately
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
    // Remove surrounding quotes
    // -------------------------------------------------

    url = url
        .replace(/^["']+|["']+$/g, "")
        .trim();

    // -------------------------------------------------
    // Markdown URL:
    // [text](https://example.com/image.jpg)
    //
    // Also handles malformed nested Markdown
    // -------------------------------------------------

    const markdownMatches = [
        ...url.matchAll(/\]\((https?:\/\/[^)\s]+)\)/gi)
    ];

    if (markdownMatches.length > 0) {
        url = markdownMatches[markdownMatches.length - 1][1];
    }

    // -------------------------------------------------
    // Extract clean HTTP/HTTPS URL
    // -------------------------------------------------

    const httpMatch = url.match(
        /https?:\/\/[^\s"'<>()[\]]+/i
    );

    if (httpMatch) {

        url = httpMatch[0];

        // Remove Markdown leftovers
        url = url
            .replace(/[)\]}>,.*]+$/g, "")
            .trim();

        return url;
    }

    // -------------------------------------------------
    // Old local upload compatibility
    // -------------------------------------------------

    if (url.startsWith("/uploads/")) {
        return `${BASE_URL}${url}`;
    }

    if (url.startsWith("uploads/")) {
        return `${BASE_URL}/${url}`;
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

    // -------------------------------------------------
    // Already an array
    // -------------------------------------------------

    if (Array.isArray(imageValue)) {

        images = imageValue;
    }

    // -------------------------------------------------
    // String
    // -------------------------------------------------

    else if (typeof imageValue === "string") {

        const value = imageValue.trim();

        if (!value) {
            return [];
        }

        // -------------------------------------------------
        // Try JSON
        // -------------------------------------------------

        try {

            const parsed = JSON.parse(value);

            if (Array.isArray(parsed)) {

                images = parsed;

            } else if (
                typeof parsed === "string"
            ) {

                images = [parsed];
            }

        } catch {

            // -------------------------------------------------
            // Legacy single image
            // -------------------------------------------------

            images = [value];
        }
    }

    // -------------------------------------------------
    // Clean every image
    // -------------------------------------------------

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

    const images = parseImages(
        product.imageurl
    );

    return {
        ...product,

        images,

        imageUrl:
            images.length > 0
                ? images[0]
                : FALLBACK_IMAGE_URL
    };
}

// =====================================================
// GET ALL PRODUCTS
// =====================================================

router.get("/", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT *
            FROM products
            ORDER BY id DESC
        `);

        const products =
            result.rows.map(processProduct);

        res.json(products);

    } catch (err) {

        console.error(
            "❌ GET PRODUCTS ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Failed to load products."
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
            processProduct(
                result.rows[0]
            )
        );

    } catch (err) {

        console.error(
            "❌ GET SINGLE PRODUCT ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Failed to load product."
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

            // -------------------------------------------------
            // Basic validation
            // -------------------------------------------------

            if (!name || !String(name).trim()) {

                return res.status(400).json({
                    success: false,
                    message: "Product name is required."
                });
            }

            if (
                price === undefined ||
                price === null ||
                price === ""
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Product price is required."
                });
            }

            // -------------------------------------------------
            // Cloudinary URLs
            // -------------------------------------------------

            const images =
                req.files && req.files.length > 0
                    ? req.files
                        .map(file => file.path)
                        .filter(Boolean)
                    : [];

            const imageUrl =
                JSON.stringify(images);

            // -------------------------------------------------
            // Insert
            // -------------------------------------------------

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

                RETURNING *
                `,
                [
                    String(name).trim(),

                    Number(price),

                    imageUrl,

                    producttype || "own",

                    category || "General",

                    affiliatelink || "",

                    description || "",

                    rating !== undefined &&
                    rating !== ""
                        ? Number(rating)
                        : 0,

                    stock !== undefined &&
                    stock !== ""
                        ? Number(stock)
                        : 0
                ]
            );

            const product =
                processProduct(
                    result.rows[0]
                );

            res.status(201).json({

                success: true,

                message:
                    "Product Added Successfully",

                product
            });

        } catch (err) {

            console.error(
                "❌ ADD PRODUCT ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to add product."
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

            // -------------------------------------------------
            // Get existing product
            // -------------------------------------------------

            const oldProductResult =
                await pool.query(
                    `
                    SELECT *
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

            const oldProduct =
                oldProductResult.rows[0];

            // -------------------------------------------------
            // Keep old images by default
            // -------------------------------------------------

            let imageUrlToStore =
                oldProduct.imageurl;

            // -------------------------------------------------
            // If new images uploaded:
            // replace old images
            // -------------------------------------------------

            if (
                req.files &&
                req.files.length > 0
            ) {

                const newImages =
                    req.files
                        .map(file => file.path)
                        .filter(Boolean);

                imageUrlToStore =
                    JSON.stringify(
                        newImages
                    );
            }

            // -------------------------------------------------
            // Update
            // -------------------------------------------------

            const result =
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

                    RETURNING *
                    `,
                    [
                        name !== undefined
                            ? String(name).trim()
                            : oldProduct.name,

                        price !== undefined &&
                        price !== ""
                            ? Number(price)
                            : oldProduct.price,

                        imageUrlToStore,

                        producttype ||
                            oldProduct.producttype ||
                            "own",

                        category ||
                            oldProduct.category ||
                            "General",

                        affiliatelink !== undefined
                            ? affiliatelink
                            : oldProduct.affiliatelink,

                        description !== undefined
                            ? description
                            : oldProduct.description,

                        rating !== undefined &&
                        rating !== ""
                            ? Number(rating)
                            : oldProduct.rating,

                        stock !== undefined &&
                        stock !== ""
                            ? Number(stock)
                            : oldProduct.stock,

                        req.params.id
                    ]
                );

            const product =
                processProduct(
                    result.rows[0]
                );

            res.json({

                success: true,

                message:
                    "Product Updated Successfully",

                product
            });

        } catch (err) {

            console.error(
                "❌ UPDATE PRODUCT ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to update product."
            });
        }
    }
);

// =====================================================
// CLOUDINARY PUBLIC ID HELPER
// =====================================================

function getCloudinaryPublicId(imageUrl) {

    if (!imageUrl) {
        return null;
    }

    try {

        const url = new URL(imageUrl);

        if (
            !url.hostname.includes(
                "cloudinary.com"
            )
        ) {
            return null;
        }

        const parts =
            url.pathname.split("/");

        const uploadIndex =
            parts.indexOf("upload");

        if (uploadIndex === -1) {
            return null;
        }

        let publicParts =
            parts.slice(
                uploadIndex + 1
            );

        // -------------------------------------------------
        // Remove transformation segments
        // -------------------------------------------------

        while (
            publicParts.length > 0 &&
            (
                publicParts[0].includes(",") ||
                publicParts[0].includes("_") ||
                publicParts[0].startsWith("c_") ||
                publicParts[0].startsWith("w_") ||
                publicParts[0].startsWith("h_") ||
                publicParts[0].startsWith("q_") ||
                publicParts[0].startsWith("f_")
            )
        ) {
            publicParts.shift();
        }

        // -------------------------------------------------
        // Remove version
        // Example:
        // v1786060643
        // -------------------------------------------------

        if (
            publicParts[0] &&
            /^v\d+$/.test(
                publicParts[0]
            )
        ) {
            publicParts.shift();
        }

        if (
            publicParts.length === 0
        ) {
            return null;
        }

        let publicId =
            publicParts.join("/");

        // -------------------------------------------------
        // Remove extension
        // -------------------------------------------------

        publicId =
            publicId.replace(
                /\.(jpg|jpeg|png|webp)$/i,
                ""
            );

        return publicId;

    } catch {

        return null;
    }
}

// =====================================================
// DELETE PRODUCT
// =====================================================

router.delete(
    "/:id",
    authMiddleware,
    async (req, res) => {

        try {

            // -------------------------------------------------
            // Get product first
            // -------------------------------------------------

            const productResult =
                await pool.query(
                    `
                    SELECT imageurl
                    FROM products
                    WHERE id=$1
                    `,
                    [req.params.id]
                );

            if (
                productResult.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            const imageUrls =
                parseImages(
                    productResult
                        .rows[0]
                        .imageurl
                );

            // -------------------------------------------------
            // Delete product from PostgreSQL
            // -------------------------------------------------

            await pool.query(
                `
                DELETE FROM products
                WHERE id=$1
                `,
                [req.params.id]
            );

            // -------------------------------------------------
            // Delete Cloudinary images
            // -------------------------------------------------

            for (const imageUrl of imageUrls) {

                const publicId =
                    getCloudinaryPublicId(
                        imageUrl
                    );

                if (!publicId) {
                    continue;
                }

                try {

                    await cloudinary.uploader.destroy(
                        publicId,
                        {
                            resource_type: "image"
                        }
                    );

                    console.log(
                        "☁️ Cloudinary image deleted:",
                        publicId
                    );

                } catch (cloudinaryError) {

                    console.error(
                        "⚠️ Cloudinary delete failed:",
                        cloudinaryError.message
                    );

                    // Do not fail the product deletion
                }
            }

            res.json({

                success: true,

                message:
                    "Product Deleted Successfully"
            });

        } catch (err) {

            console.error(
                "❌ DELETE PRODUCT ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to delete product."
            });
        }
    }
);

// =====================================================
// MULTER / UPLOAD ERROR HANDLER
// =====================================================

router.use(
    (err, req, res, next) => {

        if (
            err instanceof multer.MulterError
        ) {

            return res.status(400).json({
                success: false,
                message:
                    `Upload error: ${err.message}`
            });
        }

        if (err) {

            console.error(
                "❌ PRODUCT ROUTE ERROR:",
                err
            );

            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        next();
    }
);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;