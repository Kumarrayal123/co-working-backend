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

// DNS Fix
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

// ============================================
// 📌 FUNCTION - COMPLETE EXPIRED BOOKINGS
// ============================================

const completeExpiredBookings = async () => {
  try {
    console.log('🔄 Checking for expired bookings...');
    console.log(`⏰ Time: ${new Date().toISOString()}`);

    const Booking = mongoose.model('Booking');

    // Find all active bookings
    const activeBookings = await Booking.find({ status: 'active' });

    console.log(`📊 Found ${activeBookings.length} active bookings`);

    let completedCount = 0;
    let errorCount = 0;

    for (const booking of activeBookings) {
      try {
        const bookingEndDate = booking.endDate || booking.startDate;
        const bookingEndTime = booking.endTime;

        if (!bookingEndDate || !bookingEndTime) {
          continue;
        }

        const bookingEndDateTime = new Date(`${bookingEndDate}T${bookingEndTime}:00`);
        const nowDateTime = new Date();

        // Check if booking has expired
        if (nowDateTime >= bookingEndDateTime) {
          console.log(`⏳ Booking ${booking._id} expired`);

          // Update booking
          booking.status = 'completed';
          
          if (booking.paymentStatus === 'pending') {
            booking.paymentStatus = 'completed';
          }

          await booking.save();

          completedCount++;
          console.log(`✅ Booking ${booking._id} marked as COMPLETED`);
        }
      } catch (err) {
        console.error(`❌ Error processing booking ${booking._id}:`, err.message);
        errorCount++;
      }
    }

    console.log(`✅ Completed: ${completedCount} bookings`);
    console.log(`❌ Errors: ${errorCount}`);

    return { completedCount, errorCount };

  } catch (error) {
    console.error('❌ [FUNCTION] Error:', error);
    return { completedCount: 0, errorCount: 1, error: error.message };
  }
};

// ============================================
// 📌 DATABASE CONNECTION
// ============================================

mongoose
  .connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(async () => {
    console.log("✅ MongoDB Connected Successfully");
    
    // ✅ Run once on startup
    console.log('🚀 [STARTUP] Running initial booking completion check...');
    await completeExpiredBookings();

    // ✅ Call every 5 minutes
    setInterval(async () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔄 [INTERVAL] Running booking completion check...');
      await completeExpiredBookings();
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }, 5 * 60 * 1000); // 5 minutes

    console.log('✅ Booking completion check scheduled every 5 minutes');
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Failed");
    console.error(err);
  });

// ============================================
// 📌 SERVER START
// ============================================

const PORT = process.env.PORT || 5003;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`);
  } else {
    console.error("❌ Server Start Error:", err);
  }
});