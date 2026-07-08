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
      name,
      mobile,
      email,
      startDate,
      startTime,
      endDate,
      endTime,
      bookingBasis = "hourly",
      selectedPlan
    } = req.body;

    const cabin = await Cabin.findById(cabinId);
    if (!cabin) {
      return res.status(404).json({ error: "Cabin not found" });
    }

    let calculatedTotalHours = 0;
    let calculatedTotalPrice = 0;
    let computedEndDate = endDate;
    let computedEndTime = endTime;

    if (bookingBasis === "plan") {
      if (!selectedPlan || !selectedPlan.cost) {
        return res.status(400).json({ error: "Selected plan details are required" });
      }
      calculatedTotalHours = Number(selectedPlan.hours) || 0;
      calculatedTotalPrice = Number(selectedPlan.cost) || 0;

      // Compute end date based on plan validity (days)
      const startDateTime = new Date(`${startDate}T${startTime}`);
      const validityDays = Number(selectedPlan.validity) || 30;
      const endDateTime = new Date(startDateTime.getTime() + validityDays * 24 * 60 * 60 * 1000);
      
      computedEndDate = endDateTime.toISOString().split("T")[0];
      computedEndTime = startTime;
    } else {
      const newStart = new Date(`${startDate}T${startTime}`);
      const newEnd = new Date(`${endDate}T${endTime}`);

      if (newEnd <= newStart) {
        return res.status(400).json({ error: "Invalid date/time" });
      }

      // Overlap check (only checks against other hourly/legacy bookings)
      const existingBookings = await Booking.find({ 
        cabinId,
        bookingBasis: { $ne: "plan" }
      });

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
      calculatedTotalHours = Math.ceil(diffMs / (1000 * 60 * 60));
      calculatedTotalPrice = calculatedTotalHours * (cabin.price || 0);
    }

    const booking = new Booking({
      cabinId,
      userId,
      name,
      mobile,
      email,
      startDate,
      startTime,
      endDate: computedEndDate,
      endTime: computedEndTime,
      totalHours: calculatedTotalHours,
      totalPrice: calculatedTotalPrice,
      bookingBasis,
      selectedPlan
    });

    await booking.save();

    res.status(201).json({
      message: "Booking confirmed",
      booking
    });

  } catch (err) {
    console.error("Booking creation error:", err);
    res.status(500).json({ error: "Booking failed", details: err.message });
  }
});

// ======================
// ⭐ 5. CREATE A SITE VISIT
// ======================
router.post("/createvisit/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      cabinId,
      name,
      mobile,
      email,
      startDate,
      startTime
    } = req.body;

    if (!cabinId || !name || !mobile || !startDate || !startTime) {
      return res.status(400).json({ error: "Missing required fields for site visit" });
    }

    const booking = new Booking({
      cabinId,
      userId,
      name,
      mobile,
      email,
      startDate,
      startTime,
      bookingType: "visit",
      totalHours: 0,
      totalPrice: 0
    });

    await booking.save();

    res.status(201).json({
      message: "Site visit scheduled successfully",
      booking
    });

  } catch (err) {
    console.error("Error creating site visit:", err);
    res.status(500).json({ error: "Site visit scheduling failed" });
  }
});


// ======================
// 3. GET ALL BOOKINGS (ADMIN)
// ======================
router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("cabinId", "name address capacity price images owner")
      .populate("userId", "name mobile email")
      .sort({ createdAt: -1 });

    res.status(200).json({ bookings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ======================
// ⭐ GET BOOKED SLOTS FOR A CABIN (PUBLIC - for showing unavailable times)
// ======================
router.get("/cabin/:cabinId", async (req, res) => {
  try {
    const { cabinId } = req.params;

    // Fetch all bookings that are NOT site visits (includes ones where bookingType is unset)
    const bookings = await Booking.find({
      cabinId,
      bookingType: { $ne: "visit" }
    })
      .select("startDate startTime endDate endTime name email")
      .sort({ startDate: 1, startTime: 1 });

    res.status(200).json({ bookedSlots: bookings });
  } catch (err) {
    console.error("Error fetching cabin booked slots:", err);
    res.status(500).json({ error: "Failed to fetch booked slots" });
  }
});

// ======================
// 4. GET BOOKINGS BY USER ID (CUSTOMER) - UPDATED FOR AUTH TOKEN
// ======================
router.get("/user", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("-----------------------------------------");
    console.log(`📡 API REQUEST: GET /api/bookings/user`);
    console.log(`👤 Current Session userId: ${userId}`);
    console.log("-----------------------------------------");

    const bookings = await Booking.find({ userId })
      .populate("cabinId", "name address capacity price images")
      .sort({ createdAt: -1 });

    console.log(`✅ Bookings: Found ${bookings.length} bookings for user ${userId}`);
    res.status(200).json({ bookings });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Using the old route as fallback or for specific user fetch if needed (optional)
router.get("/userbookings/:userId", async (req, res) => {
  // ... existing logic ...
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
