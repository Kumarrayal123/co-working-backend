require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const cabinRoutes = require("./routes/cabins");
const adminRoutes = require("./routes/admin");
const bookingRoutes = require("./routes/bookings");
const Cabin = require("./model/cabin");
const User = require("./model/User");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[DEBUG] ${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
  next();
});
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/cabins", cabinRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);

// DB Connection
mongoose.connect(process.env.MONGO_URL)
  .then(async () => {
    console.log("MongoDB Connected Successfully");
    try {
      const SAIDULU_ID = "68ebe9ee8f06d33ee022d665";
      const OTHER_ID = "694e55480e3e176ff1829a32";
      const SAIDULU_CABIN_IDS = ["69773957ebac327b9422bbd4", "6953a32f98d91a36a2d497ba"];
      const OTHER_CABIN_IDS = [
        "6953624fc363980c4b21d96f",
        "6942823535e191f4fa5df372",
        "693fb96df55040dda42e6c3a",
        "693faa40f123da421b9db859",
        "693a6982b44b1b10fa801be7",
        "693978887f73849ec16efcce"
      ];
      const ALL_SEEDED_CABIN_IDS = [...SAIDULU_CABIN_IDS, ...OTHER_CABIN_IDS];

      // Rectify ownership: 2 to Saidulu, 6 to Placeholder
      await Cabin.updateMany({ _id: { $in: SAIDULU_CABIN_IDS } }, { $set: { owner: SAIDULU_ID } });
      await Cabin.updateMany({ _id: { $in: OTHER_CABIN_IDS } }, { $set: { owner: OTHER_ID } });
      console.log("✅ Cabin ownership rectified: 2 assigned to Saidulu, 6 to System.");

      // Restore custom cabins ownership to Kumar
      const kumarUser = await User.findOne({ email: "kumar@gmail.com" });
      if (kumarUser) {
        const result = await Cabin.updateMany(
          { _id: { $nin: ALL_SEEDED_CABIN_IDS } },
          { $set: { owner: kumarUser._id } }
        );
        console.log(`✅ Restored ${result.modifiedCount} custom cabins to Kumar (${kumarUser._id})`);
      } else {
        console.log("⚠️ Kumar user not found, cannot restore cabins");
      }
    } catch (e) {
      console.error("Migration/Rectification failed:", e);
    }
  })
  .catch((err) => console.error("CRITICAL: MongoDB Connection Failed:", err));

// Start Server
const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server fully started on http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ ERROR: Port ${PORT} is already in use. Please kill the process on this port or change it in .env`);
  } else {
    console.error("❌ ERROR starting server:", err);
  }
});
