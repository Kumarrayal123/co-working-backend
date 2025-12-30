const express = require("express");
const router = express.Router();
const Booking = require("../model/Booking");
const User = require("../model/User");
const Cabin = require("../model/cabin");
const auth = require("../middleware/auth");

console.log("Bookings route file loaded successfully");

// ======================
// 🧪 DEBUG TEST ROUTE
// ======================
router.get("/test-route", (req, res) => {
  res.status(200).json({ message: "Bookings route is REACHABLE" });
});

// ======================
// ⭐ 1. GET OWNER BOOKINGS (FOR DOCTORS)
// ======================
router.get("/owner-bookings", auth, async (req, res) => {
  try {
    const ownerId = req.user.id;
    console.log("Fetching owner bookings for ID:", ownerId);

    // Find all cabins owned by this user
    const userCabins = await Cabin.find({ owner: ownerId }).select("_id");
    const cabinIds = userCabins.map(cabin => cabin._id);
    console.log("Found cabin IDs for owner:", cabinIds);

    // Find all bookings for these cabins
    const bookings = await Booking.find({ cabinId: { $in: cabinIds } })
      .populate("cabinId", "name address price images")
      .populate("userId", "name mobile email")
      .sort({ createdAt: -1 });

    console.log(`Found ${bookings.length} bookings for owner`);
    res.status(200).json({ bookings });
  } catch (err) {
    console.error("Error fetching owner bookings:", err);
    res.status(500).json({ error: "Failed to fetch bookings for your cabins" });
  }
});

// ======================
// 2. CREATE A BOOKING
// ======================
router.post("/createbooking/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      cabinId,
      startDate,
      startTime,
      endDate,
      endTime
    } = req.body;

    const newStart = new Date(`${startDate}T${startTime}`);
    const newEnd = new Date(`${endDate}T${endTime}`);

    if (newEnd <= newStart) {
      return res.status(400).json({ error: "Invalid date/time" });
    }

    // Overlap check
    const existingBookings = await Booking.find({ cabinId });

    for (let booking of existingBookings) {
      const bookedStart = new Date(`${booking.startDate}T${booking.startTime}`);
      const bookedEnd = new Date(`${booking.endDate}T${booking.endTime}`);

      if (newStart < bookedEnd && newEnd > bookedStart) {
        return res.status(400).json({
          error: "Cabin already booked for this time slot"
        });
      }
    }

    const diffMs = newEnd - newStart;
    const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const totalPrice = totalHours * 5000;

    const booking = new Booking({
      cabinId,
      userId,
      startDate,
      startTime,
      endDate,
      endTime,
      totalHours,
      totalPrice
    });

    await booking.save();

    res.status(201).json({
      message: "Booking confirmed",
      booking
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Booking failed" });
  }
});

// ======================
// 3. GET ALL BOOKINGS (ADMIN)
// ======================
router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("cabinId", "name address capacity price images")
      .populate("userId", "name mobile email")
      .sort({ createdAt: -1 });

    res.status(200).json({ bookings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ======================
// 4. GET BOOKINGS BY USER ID (CUSTOMER)
// ======================
router.get("/userbookings/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const bookings = await Booking.find({ userId })
      .populate("cabinId", "name address capacity price images")
      .sort({ createdAt: -1 });

    res.status(200).json({ bookings });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

module.exports = router;
