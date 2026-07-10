const express = require("express");
const router = express.Router();
const axios = require("axios");
const bcrypt = require("bcryptjs");
const User = require("../model/User");
const Admin = require("../model/Admin");  // NEW MODEL
const jwt = require("jsonwebtoken");
const Cabin = require("../model/cabin");
const Booking = require("../model/Booking");
const CabinOrder = require('../model/CabinOrder');

// ADMIN LOGIN (PROXY TO EXTERNAL API)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("🔄 Proxying Admin Login to: https://api.timelyhealth.in/api/admin/login");

    try {
      // Use axios for reliable HTTP request
      const response = await axios.post("https://api.timelyhealth.in/api/admin/login", {
        email,
        password
      }, {
        headers: { "Content-Type": "application/json" }
      });

      console.log("✅ External Login Successful");
      const data = response.data;

      // Ensure ID is present for frontend
      if (data.admin && !data.admin.id) {
        data.admin.id = data.admin._id || "external-admin-id";
      }

      res.json(data);

    } catch (apiError) {
      console.warn("External Login Failed:", apiError.response?.data || apiError.message);

      const status = apiError.response?.status || 500;
      const errorData = apiError.response?.data || { message: "External Login Failed" };

      return res.status(status).json(errorData);
    }

  } catch (err) {
    console.error("❌ Proxy Error:", err);
    res.status(500).json({ message: "Internal Proxy Error", error: err.message });
  }
});

router.get("/pending-doctors", async (req, res) => {
  const users = await User.find({ status: "pending" });
  res.json(users);
});

router.put("/approve/:id", async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { status: "approved" });
  res.json({ message: "Doctor approved successfully" });
});

router.put("/reject/:id", async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { status: "rejected" });
  res.json({ message: "Doctor rejected" });
});



// FETCH ALL USERS (ADMIN ACCESS)
router.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

const auth = require("../middleware/auth");
router.get("/debug-token", auth, (req, res) => {
  res.json({
    resolvedUser: req.user,
    token: req.header("Authorization")?.split(" ")[1]
  });
});


// ======================
// ADMIN DASHBOARD DATA (NO AUTH - DIRECT DATA)
// ======================
router.get('/dashboard', async (req, res) => {
  try {
    // 1. Get all cabins
    const cabins = await Cabin.find({});
    const totalCabins = cabins.length;

    // 2. Get all bookings
    const bookings = await Booking.find({}).populate('cabinId', 'name');
    const totalBookings = bookings.length;

    // 3. Get all users
    const users = await User.find({});
    const totalUsers = users.length;

    // 4. Get all cabin payments (CabinOrder)
    const orders = await CabinOrder.find({});
    const totalPayments = orders.length;
    const totalCabinRevenue = orders.reduce((sum, order) => sum + (order.amount || 0), 0);

    // 5. Get booking revenue (ONLY from confirmed + paid bookings)
    const confirmedPaidBookings = bookings.filter(b => 
      b.status === 'completed' && b.paymentStatus === 'paid'
    );
    
    const bookingRevenue = confirmedPaidBookings.reduce((sum, booking) => {
      return sum + (booking.totalPrice || booking.amount || booking.totalAmount || 0);
    }, 0);

    // 6. Recent bookings (last 5)
    const recentBookings = bookings
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(b => ({
        _id: b._id,
        name: b.name || 'User',
        email: b.email || 'N/A',
        cabinName: b.cabinId?.name || 'Workspace',
        amount: b.totalPrice || b.amount || b.totalAmount || 0,
        status: b.status,
        paymentStatus: b.paymentStatus,
        createdAt: b.createdAt
      }));

    // 7. Monthly booking chart data (ALL bookings)
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyMap = {};
    bookings.forEach(b => {
      if (b.createdAt) {
        const date = new Date(b.createdAt);
        const month = months[date.getMonth()];
        monthlyMap[month] = (monthlyMap[month] || 0) + 1;
      }
    });
    const bookingChartData = months.map(m => ({
      month: m,
      bookings: monthlyMap[m] || 0
    }));

    res.json({
      success: true,
      data: {
        totalCabins,
        totalBookings,
        totalUsers,
        totalPayments,
        totalCabinRevenue,
        bookingRevenue,
        confirmedPaidCount: confirmedPaidBookings.length,
        recentBookings,
        bookingChartData
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});


module.exports = router;
