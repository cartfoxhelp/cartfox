const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initializeDatabase() {
    try {

        // ===============================
        // PRODUCTS TABLE
        // ===============================

        await pool.query(`

        CREATE TABLE IF NOT EXISTS products (

            id SERIAL PRIMARY KEY,

            name TEXT NOT NULL,

            price NUMERIC(10,2) NOT NULL,

            imageurl TEXT,

            producttype TEXT DEFAULT 'own',

            category TEXT DEFAULT 'General',

            affiliatelink TEXT,

            description TEXT,

            rating NUMERIC DEFAULT 0,

            stock INTEGER DEFAULT 0,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

        );

        `);

        console.log("✅ Products Table Ready");


        // ===============================
        // ORDERS TABLE
        // ===============================

        await pool.query(`

        CREATE TABLE IF NOT EXISTS orders (

            id SERIAL PRIMARY KEY,

            orderid VARCHAR(50) UNIQUE NOT NULL,

            customername TEXT NOT NULL,

            customeremail TEXT,

            customerphone TEXT,

            shippingaddress TEXT,

            items JSONB NOT NULL,

            totalamount NUMERIC(10,2) NOT NULL,

            paymentid TEXT,

            paymentstatus VARCHAR(30) DEFAULT 'Paid',

            orderstatus VARCHAR(30) DEFAULT 'Pending',

            courier VARCHAR(100),

            trackingnumber VARCHAR(100),

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

        );

        `);

        console.log("✅ Orders Table Ready");

        // ===============================
        // USERS TABLE (FOR ADMIN AUTH)
        // ===============================
        await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'admin',
            two_factor_enabled BOOLEAN DEFAULT FALSE,
            two_factor_secret VARCHAR(255),
            recovery_codes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `);
        console.log("✅ Users Table Ready");

        // ===============================
        // AUDIT LOGS TABLE
        // ===============================
        await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(255) NOT NULL,
            ip_address VARCHAR(50),
            user_agent TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        `);
        console.log("✅ Audit Logs Table Ready");

       // ======================================
// CREATE / UPDATE DEFAULT ADMIN
// Email: admin@cartfox.com
// Password: admin123
// ======================================

const adminPasswordHash = await bcrypt.hash("admin123", 10);

await pool.query(
    `
    INSERT INTO users (email, password_hash, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (email)
    DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role;
    `,
    [
        "admin@cartfox.com",
        adminPasswordHash,
        "admin"
    ]
);

console.log("✅ Default admin account ready.");

        console.log("=====================================");
        console.log("✅ PostgreSQL Connected");
        console.log("🚀 Database Initialized Successfully");
        console.log("=====================================");

    } catch (err) {

        console.error("❌ Database Initialization Error:");
        console.error(err);

    }
}

module.exports = {

    pool,

    initializeDatabase

};