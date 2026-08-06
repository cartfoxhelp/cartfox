const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { pool } = require("../database");
const authMiddleware = require("../auth");
const router = express.Router();
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// ==============================
// Multer Storage
// ==============================

const { CloudinaryStorage } = require("multer-storage-cloudinary");

const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: "cartfox/products",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        public_id: `${Date.now()}-${file.originalname
            .replace(/\s+/g, "-")
            .replace(/[^a-zA-Z0-9._-]/g, "")}`
    })
});

const upload = multer({ storage })

// ==============================
// Helper
// ==============================

const FALLBACK_IMAGE_URL = "https://via.placeholder.com/600x400?text=CartFox";
const BASE_URL =
    process.env.BASE_URL ||
    "https://cartfox.onrender.com";

function resolveImageValue(imageValue) {
    if (!imageValue) return FALLBACK_IMAGE_URL;

    const value = String(imageValue).trim();

    if (!value) return FALLBACK_IMAGE_URL;

    // Already full URL
    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    // Upload image
    if (value.startsWith("/uploads/")) {
        return `${BASE_URL}${value}`;
    }

    if (value.startsWith("uploads/")) {
        return `${BASE_URL}/${value}`;
    }

    return FALLBACK_IMAGE_URL;
}
function processProduct(product) {

    if (!product) return product;

    let images = [];

    // Assume imageurl is always a JSON string array from now on.
    // Handle legacy single-string entries gracefully.
    if (product.imageurl) {
        try {
            const parsed = JSON.parse(product.imageurl);
            if (Array.isArray(parsed)) {
                images = parsed;
            } else if (typeof parsed === 'string') {
                images = [parsed]; // Handle case where JSON.parse returns a single string
            }
        } catch (e) {
            // Fallback for old/malformed entries: treat as a single image path
            images = [product.imageurl];
        }
    }

 product.images = images
    .filter(Boolean)
    .map(resolveImageValue);

product.imageUrl =
    product.images.length > 0
        ? product.images[0]
        : FALLBACK_IMAGE_URL;

return product;
}
// ==============================
// GET ALL PRODUCTS
// ==============================

router.get("/", async (req, res) => {

    try {

        const result = await pool.query(

            `SELECT * FROM products
             ORDER BY id DESC`

        );

        const products = result.rows.map(processProduct);

        res.json(products);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ==============================
// GET SINGLE PRODUCT
// ==============================

router.get("/:id", async (req, res) => {

    try {

        const result = await pool.query(

            `SELECT * FROM products
             WHERE id=$1`,

            [req.params.id]

        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });

        }

        res.json(processProduct(result.rows[0]));

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});
// ==============================
// ADD NEW PRODUCT
// ==============================

router.post("/", authMiddleware, upload.array("images", 3), async (req, res) => {

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

        let images = [];

        if (req.files && req.files.length > 0) {

            images = req.files.map(file => `/uploads/${file.filename}`);

        }

        const imageUrl = JSON.stringify(images);

        const result = await pool.query(

            `INSERT INTO products
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

            RETURNING id`,

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
            message: "Product Added Successfully",

            id: result.rows[0].id

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});
// ==============================
// UPDATE PRODUCT
// ==============================

router.put("/:id", authMiddleware, upload.array("images", 3), async (req, res) => {

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

        const oldProductResult = await pool.query(
            "SELECT imageurl FROM products WHERE id=$1",
            [req.params.id]
        );

        if (oldProductResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

      const oldImagesRaw = oldProductResult.rows[0].imageurl;
let imageUrlToStore = oldImagesRaw;

if (req.files && req.files.length > 0) {
    const newImagePaths = req.files.map(file => file.path);
    imageUrlToStore = JSON.stringify(newImagePaths);
}
        await pool.query(
            `UPDATE products SET
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
            WHERE id=$10`,
            [
                name,
                price,
                imageUrlToStore,
                producttype,
                category,
                affiliatelink,
                description,
                rating,
                stock,
                req.params.id
            ]
        );

        res.json({
            success: true,
            message: "Product Updated Successfully"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ==============================
// DELETE PRODUCT
// ==============================

router.delete("/:id", authMiddleware, async (req, res) => {

    try {
        // First, get the image URLs to delete the files
        const productResult = await pool.query(
            "SELECT imageurl FROM products WHERE id=$1",
            [req.params.id]
        );

        // Then, delete the product from the database
        const result = await pool.query(

            "DELETE FROM products WHERE id=$1 RETURNING id",

            [req.params.id]
        );

        // If deletion was successful, delete the image files from the server
        if (productResult.rows.length > 0 && productResult.rows[0].imageurl) {
            try {
                const images = JSON.parse(productResult.rows[0].imageurl);
                if (Array.isArray(images)) {
                    images.forEach(imagePath => {
                        const fullPath = path.join(__dirname, "..", imagePath);
                        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                    });
                }
            } catch (e) { console.error("Could not parse or delete image files:", e); }
        }

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Product not found"

            });

        }

        res.json({

            success: true,
            message: "Product Deleted Successfully"

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

// ==============================
// EXPORT
// ==============================

module.exports = router;