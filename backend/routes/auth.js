const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database');
const authMiddleware = require('../auth');

const router = express.Router();

// ==============================
// POST /api/auth/login
// ==============================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        // 1. Find user by email
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const user = userResult.rows[0];

        // 2. Compare password with stored hash
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // 3. Create and sign final JWT
        const payload = {
            id: user.id,
            role: user.role, // The role must be in the database
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '1d', // Token expires in 1 day
        });

        res.json({
            success: true,
            token: token
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// ==============================
// GET /api/auth/me (Get current user details)
// ==============================
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const userResult = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, user: userResult.rows[0] });
    } catch (err) {
        console.error('Get Me error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;