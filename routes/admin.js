const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../model/User");
const Admin = require("../model/Admin");  // NEW MODEL

// ADMIN LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch)
      return res.status(400).json({ message: "Incorrect password" });

    res.json({
      message: "Admin Login Successful",
      admin: {
        name: admin.name,
        email: admin.email,
      }
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
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

module.exports = router;
