const express = require('express');
const Razorpay = require('razorpay');

const router = express.Router();

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});


router.post('/order', async (req, res) => {
    try {

        const { amount, currency = 'INR', receipt } = req.body;

        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({
                error: 'Invalid amount'
            });
        }

        const options = {
            amount: Number(amount),
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
            payment_capture: 1,
        };


        const order = await razorpayInstance.orders.create(options);

        return res.json({
            key_id: process.env.RAZORPAY_KEY_ID,
            order
        });


    } catch (error) {

        console.error('Razorpay order creation error:', error);

        return res.status(500).json({
            error: 'Unable to create Razorpay order'
        });
    }
});


module.exports = router;