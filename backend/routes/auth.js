const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { pool } = require('../database');
const authMiddleware = require('../auth');

const router = express.Router();

// ==============================
// Helper to generate recovery codes
async function logAuditEvent(userId, action, req) {
    try {
        // Use req.ip for direct connections or x-forwarded-for for proxies like Heroku/Render
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        await pool.query(
            'INSERT INTO audit_logs (user_id, action, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
            [userId, action, ip, userAgent]
        );
    } catch (logError) {
        console.error('Failed to write to audit log:', logError);
    }
}

function generateRecoveryCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        // Generate a 9-character code: "xxxx-xxxx"
        const code = crypto.randomBytes(5).toString('hex').slice(0, 9);
        codes.push(`${code.slice(0,4)}-${code.slice(4)}`);
    }
    return codes;
}
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
            // Log failed login attempt
            await logAuditEvent(user.id, 'LOGIN_FAILURE', req);
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // 3. Check if 2FA is enabled
        if (user.two_factor_enabled) {
            // Issue a short-lived temporary token that signals 2FA is required
            const tempPayload = { id: user.id, twoFactor: 'pending' };
            const tempToken = jwt.sign(tempPayload, process.env.JWT_SECRET, { expiresIn: '5m' });

            return res.json({
                success: true,
                twoFactorRequired: true,
                tempToken: tempToken
            });
        }

        // 4. Create and sign final JWT if 2FA is not enabled
        const payload = {
            id: user.id,
            role: user.role, // The role must be in the database
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '1d', // Token expires in 1 day
        });

        // Log successful login
        await logAuditEvent(user.id, 'LOGIN_SUCCESS', req);

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
// POST /api/auth/2fa/verify (For Login Step 2)
// ==============================
router.post('/2fa/verify', async (req, res) => {
    try {
        const { tempToken, twoFactorCode } = req.body;
        if (!tempToken || !twoFactorCode) {
            return res.status(400).json({ success: false, message: 'Temporary token and 2FA code are required.' });
        }

        // 1. Verify the temporary token
        const decodedTemp = jwt.verify(tempToken, process.env.JWT_SECRET);
        if (decodedTemp.twoFactor !== 'pending') {
            return res.status(401).json({ success: false, message: 'Invalid temporary token.' });
        }

        // 2. Get user's 2FA secret from DB
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [decodedTemp.id]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'User not found.' });
        }
        const user = userResult.rows[0];

        // 3. Verify the 2FA code against the user's secret
        const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: twoFactorCode,
            window: 1 // Allow for a 30-second window on either side for clock drift
        });

        if (!verified) {
            return res.status(401).json({ success: false, message: 'Invalid 2FA code.' });
        }

        // 4. Verification successful, issue the final long-lived JWT
        const payload = { id: user.id, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        // Log successful 2FA verification
        await logAuditEvent(user.id, '2FA_VERIFY_SUCCESS', req);

        res.json({
            success: true,
            token: token
        });

    } catch (err) {
        console.error('2FA verification error:', err);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
        }
        res.status(500).json({ success: false, message: 'Server error during 2FA verification.' });
    }
});

// ==============================
// POST /api/auth/2fa/recover (For Login with Recovery Code)
// ==============================
router.post('/2fa/recover', async (req, res) => {
    try {
        const { tempToken, recoveryCode } = req.body;
        if (!tempToken || !recoveryCode) {
            return res.status(400).json({ success: false, message: 'Temporary token and recovery code are required.' });
        }

        const decodedTemp = jwt.verify(tempToken, process.env.JWT_SECRET);
        if (decodedTemp.twoFactor !== 'pending') {
            return res.status(401).json({ success: false, message: 'Invalid temporary token.' });
        }

        const userResult = await pool.query('SELECT id, role, recovery_codes FROM users WHERE id = $1', [decodedTemp.id]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'User not found.' });
        }
        const user = userResult.rows[0];
        const hashedCodes = JSON.parse(user.recovery_codes || '[]');

        let codeIsValid = false;
        let usedCodeHash = null;

        for (const hash of hashedCodes) {
            const match = await bcrypt.compare(recoveryCode, hash);
            if (match) {
                codeIsValid = true;
                usedCodeHash = hash;
                break;
            }
        }

        if (!codeIsValid) {
            return res.status(401).json({ success: false, message: 'Invalid recovery code.' });
        }

        // Invalidate the used code
        const newHashedCodes = hashedCodes.filter(h => h !== usedCodeHash);
        await pool.query('UPDATE users SET recovery_codes = $1 WHERE id = $2', [JSON.stringify(newHashedCodes), user.id]);

        // Issue final JWT
        const payload = { id: user.id, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        // Log the recovery event
        await logAuditEvent(user.id, 'RECOVERY_CODE_USED', req);

        res.json({ success: true, token: token });

    } catch (err) {
        console.error('Recovery code login error:', err);
        res.status(500).json({ success: false, message: 'Server error during recovery.' });
    }
});

// ==============================
// GET /api/auth/2fa/status (Check if 2FA is enabled for logged-in user)
// ==============================
router.get('/2fa/status', authMiddleware, async (req, res) => {
    try {
        const userResult = await pool.query('SELECT two_factor_enabled FROM users WHERE id = $1', [req.user.id]);
        res.json({
            success: true,
            enabled: userResult.rows[0].two_factor_enabled
        });
    } catch (err) {
        console.error('2FA status check error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ==============================
// POST /api/auth/2fa/generate (Generate secret and QR code for setup)
// ==============================
router.post('/2fa/generate', authMiddleware, async (req, res) => {
    try {
        const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
        const userEmail = userResult.rows[0].email;

        const secret = speakeasy.generateSecret({
            name: `CartFox Admin (${userEmail})`
        });

        // Temporarily store the unverified secret. It will be confirmed upon successful verification.
        await pool.query('UPDATE users SET two_factor_secret = $1, two_factor_enabled = FALSE WHERE id = $2', [secret.base32, req.user.id]);

        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) {
                console.error('QR Code generation error:', err);
                return res.status(500).json({ success: false, message: 'Could not generate QR code.' });
            }
            res.json({
                success: true,
                qrCodeUrl: data_url
            });
        });

    } catch (err) {
        console.error('2FA generation error:', err);
        res.status(500).json({ success: false, message: 'Server error during 2FA setup.' });
    }
});

// ==============================
// POST /api/auth/2fa/enable (Verify code and enable 2FA)
// ==============================
router.post('/2fa/enable', authMiddleware, async (req, res) => {
    try {
        const { twoFactorCode } = req.body;
        if (!twoFactorCode) {
            return res.status(400).json({ success: false, message: '2FA code is required.' });
        }

        const userResult = await pool.query('SELECT two_factor_secret FROM users WHERE id = $1', [req.user.id]);
        const user = userResult.rows[0];

        if (!user || !user.two_factor_secret) {
            return res.status(400).json({ success: false, message: '2FA setup not initiated. Please generate a QR code first.' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: twoFactorCode,
            window: 1
        });

        if (!verified) {
            return res.status(401).json({ success: false, message: 'Invalid 2FA code. Please try again.' });
        }

        // Generate and store recovery codes
        const recoveryCodes = generateRecoveryCodes();
        const saltRounds = 10;
        const hashedRecoveryCodes = await Promise.all(
            recoveryCodes.map(code => bcrypt.hash(code, saltRounds))
        );

        await pool.query(
            'UPDATE users SET two_factor_enabled = TRUE, recovery_codes = $1 WHERE id = $2',
            [JSON.stringify(hashedRecoveryCodes), req.user.id]
        );

        // Log the event
        await logAuditEvent(req.user.id, '2FA_ENABLED', req);

        // Return plaintext codes to user for one-time display
        res.json({ success: true, message: '2FA has been successfully enabled.', recoveryCodes: recoveryCodes });

    } catch (err) {
        console.error('2FA enable error:', err);
        res.status(500).json({ success: false, message: 'Server error while enabling 2FA.' });
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

// ==============================
// POST /api/auth/2fa/disable (Disable 2FA)
// ==============================
router.post('/2fa/disable', authMiddleware, async (req, res) => {
    try {
        const { twoFactorCode } = req.body;
        if (!twoFactorCode) {
            return res.status(400).json({ success: false, message: '2FA code is required to disable.' });
        }

        const userResult = await pool.query('SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1', [req.user.id]);
        const user = userResult.rows[0];

        if (!user.two_factor_enabled) {
            return res.status(400).json({ success: false, message: '2FA is not currently enabled.' });
        }

        const verified = speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: 'base32', token: twoFactorCode, window: 1 });

        if (!verified) {
            return res.status(401).json({ success: false, message: 'Invalid 2FA code.' });
        }

        await pool.query('UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, recovery_codes = NULL WHERE id = $1', [req.user.id]);

        // Log the event
        await logAuditEvent(req.user.id, '2FA_DISABLED', req);

        res.json({ success: true, message: '2FA has been disabled.' });

    } catch (err) {
        console.error('2FA disable error:', err);
        res.status(500).json({ success: false, message: 'Server error while disabling 2FA.' });
    }
});

// ==============================
// GET /api/auth/audit-logs
// ==============================
router.get('/audit-logs', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                al.id, 
                al.action, 
                al.ip_address, 
                al.created_at, 
                u.email as user_email
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 50; -- Limit to recent 50 logs for performance
        `);
        res.json({ success: true, logs: result.rows });
    } catch (err) {
        console.error('Audit log fetch error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;