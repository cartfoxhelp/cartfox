const express = require("express");
const router = express.Router();
const { pool } = require("../database");
const crypto = require("crypto");
const authMiddleware = require("../auth");

// ===============================
// GET ALL ORDERS
// ===============================
router.get("/", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM orders
            ORDER BY created_at DESC
        `);

        res.json(result.rows);

    } catch (err) {
        console.error("Get Orders Error:", err);

        res.status(500).json({
            success: false,
            message: "Unable to fetch orders"
        });
    }
});

// ===============================
// CREATE ORDER
// ===============================
router.post("/", async (req, res) => {

    try {

        const {
            customerName,
            customerEmail,
            customerPhone,
            shippingAddress,
            items,
            totalAmount,
            paymentId
        } = req.body;

        // Generate a unique, human-readable Order ID
        const orderId = `CF-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        const result = await pool.query(

            `INSERT INTO orders
            (
                orderid,
                customername,
                customeremail,
                customerphone,
                shippingaddress,
                items,
                totalamount,
                paymentid,
                orderstatus
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,

            [
                orderId,
                customerName,
                customerEmail,
                customerPhone,
                shippingAddress,
                JSON.stringify(items),
                totalAmount,
                paymentId,
                req.body.status || "Pending" // Use status from body for orderstatus
            ]

        );

        res.status(201).json({
            success: true,
            order: result.rows[0]
        });

    } catch (err) {

        console.error("Create Order Error:", err);

        res.status(500).json({
            success: false,
            message: "Unable to create order"
        });

    }

});

module.exports = router;