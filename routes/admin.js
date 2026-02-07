const express = require("express");
const router = express.Router();
const axios = require("axios");
const bcrypt = require("bcryptjs");
const User = require("../model/User");
const Admin = require("../model/Admin");  // NEW MODEL
const jwt = require("jsonwebtoken");

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

module.exports = router;
