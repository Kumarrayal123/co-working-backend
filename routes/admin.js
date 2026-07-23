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



// ======================
// FETCH ALL USERS WITH CABIN DETAILS (ADMIN ACCESS)
// ======================
router.get("/users", async (req, res) => {
  try {
    // Get all users
    const users = await User.find();
    
    // For each user, get their cabin details
    const usersWithCabins = await Promise.all(
      users.map(async (user) => {
        // Get all cabins owned by this user
        const cabins = await Cabin.find({ owner: user._id })
          .select('name address price capacity images cabinType isActive createdAt pricingPlans');
        
        // Get active cabin orders for this user
        const orders = await CabinOrder.find({ 
          owner: user._id,
          status: 'active'
        }).select('amount status expiryDate startDate');
        
        // Calculate stats
        const totalCabins = cabins.length;
        const activeCabins = cabins.filter(c => c.isActive === true).length;
        const inactiveCabins = cabins.filter(c => c.isActive !== true).length;
        const totalEarnings = orders.reduce((sum, order) => sum + order.amount, 0);
        const activeOrders = orders.length;
        
        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          address: user.address,
          organizationName: user.organizationName || '',
          gstNumber: user.gstNumber || '',
          dmhoNumber: user.dmhoNumber || '',
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          // Cabin Stats
          cabinStats: {
            total: totalCabins,
            active: activeCabins,
            inactive: inactiveCabins,
            totalEarnings: totalEarnings,
            activeOrders: activeOrders
          },
          // Cabin Details
          cabins: cabins.map(cabin => ({
            _id: cabin._id,
            name: cabin.name,
            address: cabin.address,
            price: cabin.price,
            capacity: cabin.capacity,
            images: cabin.images || [],
            cabinType: cabin.cabinType || 'normal',
            isActive: cabin.isActive,
            createdAt: cabin.createdAt,
            pricingPlans: cabin.pricingPlans || [],
            // Get latest order for this cabin
            latestOrder: orders.find(o => o.cabin?.toString() === cabin._id.toString()) || null
          })),
          // Orders
          orders: orders.map(order => ({
            _id: order._id,
            amount: order.amount,
            status: order.status,
            expiryDate: order.expiryDate,
            startDate: order.startDate
          }))
        };
      })
    );

    // Calculate overall stats
    const overallStats = {
      totalUsers: usersWithCabins.length,
      totalCabins: usersWithCabins.reduce((sum, u) => sum + u.cabinStats.total, 0),
      totalActiveCabins: usersWithCabins.reduce((sum, u) => sum + u.cabinStats.active, 0),
      totalInactiveCabins: usersWithCabins.reduce((sum, u) => sum + u.cabinStats.inactive, 0),
      totalEarnings: usersWithCabins.reduce((sum, u) => sum + u.cabinStats.totalEarnings, 0),
      usersWithCabins: usersWithCabins.filter(u => u.cabinStats.total > 0).length,
      usersWithoutCabins: usersWithCabins.filter(u => u.cabinStats.total === 0).length
    };

    res.json({
      success: true,
      users: usersWithCabins,
      stats: overallStats
    });

  } catch (err) {
    console.error('Error fetching users with cabins:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: err.message 
    });
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

    // 7. Monthly booking chart data with bookings, cabins, hours, and cabin names
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Initialize monthly data with all months
    const monthlyData = {};
    months.forEach(m => {
      monthlyData[m] = {
        bookings: 0,
        cabins: 0,
        hours: 0,
        cabinNames: [] // Array to store unique cabin names per month
      };
    });

    // Process each booking to populate monthly data
    bookings.forEach(b => {
      if (b.createdAt) {
        const date = new Date(b.createdAt);
        const month = months[date.getMonth()];
        
        // Count bookings
        monthlyData[month].bookings = (monthlyData[month].bookings || 0) + 1;
        
        // Count cabins and collect cabin names
        if (b.cabinId) {
          monthlyData[month].cabins = (monthlyData[month].cabins || 0) + 1;
          
          // Add cabin name if not already in the list
          const cabinName = b.cabinId.name || 'Unknown Cabin';
          if (!monthlyData[month].cabinNames.includes(cabinName)) {
            monthlyData[month].cabinNames.push(cabinName);
          }
        }
        
        // Calculate hours (if totalHours exists, otherwise default to 1)
        const hours = b.totalHours || 1;
        monthlyData[month].hours = (monthlyData[month].hours || 0) + hours;
      }
    });

    // Build the final chart data array
    const bookingChartData = months.map(m => ({
      month: m,
      bookings: monthlyData[m].bookings || 0,
      cabins: monthlyData[m].cabins || 0,
      hours: monthlyData[m].hours || 0,
      cabinNames: monthlyData[m].cabinNames || [] // Array of cabin names for that month
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
