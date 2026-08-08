const path = require("path");

// Load environment variables from backend/.env
require("dotenv").config({
    path: require("path").join(__dirname, ".env")
});

const express = require("express");
const rateLimit = require("express-rate-limit");
const cors = require("cors");

// Ensure JWT_SECRET is set for security
if (!process.env.JWT_SECRET) {
    console.error(
        "FATAL ERROR: JWT_SECRET is not defined. Please set it in backend/.env"
    );
    process.exit(1);
}

const { initializeDatabase, pool } = require("./database");

const productRoutes = require("./routes/products");
const ordersRoutes = require("./routes/orders");
const authRoutes = require("./routes/auth");

// Razorpay Keys मिलने तक इसे Comment रहने दो
// const razorpayRoutes = require("./routes/razorpay");

const app = express();

app.set("trust proxy", 1);

// ===============================
// CORS CONFIGURATION
// ===============================

const allowedOrigins = [
    "https://cartfox.pages.dev",
    "https://cartfoxhelp.github.io",
    "https://cartfox.onrender.com",
    "https://cartfox-backend.onrender.com",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests without an Origin header
            // such as direct API/server-to-server requests.
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            console.warn("❌ CORS blocked origin:", origin);
            return callback(null, false);
        },

        methods: [
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);

// ===============================
// BODY PARSING
// ===============================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

// ===============================
// STATIC UPLOADS
// ===============================

// Keep existing local upload compatibility.
// Cloudinary URLs are handled directly by the frontend.
app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

// ===============================
// HEALTH CHECK
// ===============================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "🦊 CartFox Backend API Running Successfully",
        version: "3.0"
    });
});

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Backend healthy"
    });
});

// ===============================
// RATE LIMITING
// ===============================

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many requests from this IP, please try again after 15 minutes."
    }
});

// Apply rate limiting only to API routes
app.use("/api", apiLimiter);

// ===============================
// API ROUTES
// ===============================

app.use("/api/products", productRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/auth", authRoutes);

// Razorpay Keys मिलने तक इसे Comment रहने दो
// app.use("/api/payments", razorpayRoutes);

// ===============================
// 404 HANDLER
// ===============================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API Not Found"
    });
});

// ===============================
// ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
    console.error("SERVER ERROR:", err);

    res.status(500).json({
        success: false,
        message: "Internal Server Error"
    });
});

// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 5000;

initializeDatabase()
    .then(async () => {
        try {
            const result = await pool.query(
                "SELECT id, email, role FROM users ORDER BY id"
            );

            console.log("=====================================");
            console.log("👤 USERS TABLE");
            console.table(result.rows);
            console.log("=====================================");
        } catch (err) {
            console.error("Users table debug failed:", err);
        }

        app.listen(PORT, () => {
            console.log("=====================================");
            console.log("🦊 CartFox Backend Started");
            console.log(`🚀 Port : ${PORT}`);
            console.log("=====================================");
        });
    })
    .catch((error) => {
        console.error("Database initialization failed:", error);
    });