require("dotenv").config();

const express = require("express");
const rateLimit = require("express-rate-limit");

// Ensure JWT_SECRET is set for security
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined. Please set it in your .env file.");
    process.exit(1); // Exit the process with an error code
}


const cors = require("cors");
const path = require("path");

const { initializeDatabase } = require("./database");

const productRoutes = require("./routes/products");
const ordersRoutes = require("./routes/orders");
const authRoutes = require("./routes/auth");

// Razorpay Keys मिलने तक इसे Comment रहने दो
// const razorpayRoutes = require("./routes/razorpay");

const app = express();


// ===============================
// CORS CONFIGURATION
// ===============================

const allowedOrigins = [
    "https://cartfox.pages.dev",
    "https://cartfoxhelp.github.io",
    "https://cartfox.onrender.com",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
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
}));


// ===============================
// MIDDLEWARE
// ===============================

app.use(express.json());
app.use(express.urlencoded({ 
    extended: true 
}));


// ===============================
// UPLOAD FOLDER PUBLIC
// ===============================

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
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per windowMs
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	message: {
		success: false,
		message: "Too many requests from this IP, please try again after 15 minutes.",
	},
});

// Apply the rate limiting middleware to API calls only
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
.then(() => {

    app.listen(PORT, () => {

        console.log("=====================================");
        console.log("🦊 CartFox Backend Started");
        console.log(`🚀 Port : ${PORT}`);
        console.log("=====================================");

    });

})
.catch((error)=>{

    console.error("Database initialization failed:", error);

});