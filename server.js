require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("dns");

const authRoutes = require("./routes/auth");
const cabinRoutes = require("./routes/cabins");
const adminRoutes = require("./routes/admin");
const bookingRoutes = require("./routes/bookings");

const app = express();

// DNS Fix for some Wi-Fi/ISP issues with mongodb+srv
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Middleware
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(
    `[DEBUG] ${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`
  );
  next();
});

app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/cabins", cabinRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((err) => {
    console.error("❌ CRITICAL: MongoDB Connection Failed");
    console.error(err);
  });

// Server Start
const PORT = process.env.PORT || 5003;

app
  .listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use.`);
    } else {
      console.error("❌ Server Start Error:", err);
    }
  });