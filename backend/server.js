import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dns from "node:dns";
import { existsSync } from "node:fs";

// Load env
dotenv.config();

// Fix for MongoDB SRV DNS resolution issues
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (err) {
  console.warn("⚠️ DNS setServers failed, proceeding with system default:", err.message);
}

const app = express();
app.set("trust proxy", 1);


// ==============================
// ✅ MIDDLEWARES
// ==============================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

const normalizeOrigin = (value) => (value || "").trim().replace(/\/$/, "");
const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGINS,
  process.env.RENDER_EXTERNAL_URL,
  "https://end-5-rtag.onrender.com",
  "https://sheetalya.com",
  "http://sheetalya.com",
  "https://admin.sheetalya.com",
  "http://admin.sheetalya.com",
  "http://localhost",
  "https://localhost",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://www.sheetalya.com",
  "http://www.sheetalya.com",
  "https://www.admin.sheetalya.com",
  "http://www.admin.sheetalya.com"
]
  .flatMap((value) => (value || "").split(","))
  .map(normalizeOrigin)
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  return (
    configuredOrigins.includes(normalizedOrigin) ||
    /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(normalizedOrigin) ||
    /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(normalizedOrigin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizedOrigin) ||
    /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(normalizedOrigin)
  );
};

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },

    contentSecurityPolicy: {
      useDefaults: true,

      directives: {
        defaultSrc: ["'self'"],

        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://res.cloudinary.com",
          "https://*.cloudinary.com",
          "https:"
        ],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https:"
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https:"
        ],

        connectSrc: [
          "'self'",
          "https:",
          "wss:"
        ],

        fontSrc: [
          "'self'",
          "data:",
          "https:"
        ],
      },
    },
  })
);
app.use(process.env.NODE_ENV === "production" ? morgan("combined") : morgan("dev"));
app.use(compression());

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ==============================
// ✅ STATIC FILES
// ==============================
const uploadsDir = path.resolve(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));
console.log(`📁 Static uploads: ${uploadsDir}`);

// ==============================
// ✅ ROUTES
// ==============================
import adminRoutes from "./admin/routes/index.js";
import userRoutes from "./User/routes/index.js";

// Mount Routers
app.use("/api/admin", adminRoutes);
app.use("/api", userRoutes);
// ==============================
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV === "production") {
  const frontendDistPath = path.resolve(__dirname, "../frontend/dist");
  const indexHtmlPath = path.join(frontendDistPath, "index.html");

  if (existsSync(indexHtmlPath)) {
    console.log(`✅ Serving frontend from: ${frontendDistPath}`);
    app.use(express.static(frontendDistPath));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(indexHtmlPath);
    });
  } else {
    console.warn(`⚠️ Frontend build not found at: ${frontendDistPath}`);
    console.warn("   Run 'npm run build' in the frontend directory first.");
    app.get("/", (req, res) => {
      res.json({
        success: false,
        message: "Frontend build not found. API is running — access routes under /api",
      });
    });
  }
} else {
  app.get("/", (req, res) => {
    res.send("Unified API is running...");
  });
}

// ==============================
// ✅ ERROR HANDLING
// ==============================
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.url}: ${err.message}`);
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? (err.status && err.status < 500 ? err.message : "Internal Server Error")
        : err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});


// ==============================
// ✅ DATABASE CONNECTION
// ==============================
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error("CRITICAL: MONGODB_URI is not defined in environment variables!");
      return false;
    }

    // Mask password in logs
    const maskedUri = uri.replace(/\/\/.*:.*@/, "//<user>:<password>@");
    console.log(`Attempting to connect to MongoDB: ${maskedUri}`);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      family: 4,
    });

    console.log(`✅ MongoDB Connected Successfully! Host: ${mongoose.connection.host}`);

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected. Attempting to reconnect...");
    });
    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected.");
    });
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err.message);
    });

    return true;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    if (error.message.includes("ETIMEOUT")) {
      console.error("TIP: Check if your IP is whitelisted in MongoDB Atlas (add 0.0.0.0/0 for Render).");
    }
    return false;
  }
};

const PORT = process.env.PORT || 5001;



connectDB().then((isConnected) => {
  if (isConnected) {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } else {
    process.exit(1);
  }
});


process.on("SIGTERM", () => {
  mongoose.connection.close(false, () => {
    console.log("MongoDB connection closed");
    process.exit(0);
  });
});
