
// const express = require("express");
// const router = express.Router();
// const Booking = require("../model/Booking");
// const User = require("../model/User");

// // Create booking
// // Create booking
// // router.post("/createbooking/:userId", async (req, res) => {
// //   try {
// //     const { userId } = req.params; // Get userId from params
// //     const { cabinId, startDate, startTime, endDate, endTime } = req.body; // Get other booking details from request body

// //     // Fetch user details from User model using the userId
// //     const user = await User.findById(userId);
// //     if (!user) {
// //       return res.status(404).json({ error: "User not found" });
// //     }

// //     // Create the booking
// //     const booking = new Booking({
// //       cabinId,
// //       userId,
// //       startDate,
// //       startTime,
// //       endDate,
// //       endTime,
// //     });

// //     await booking.save();
// //     res.status(201).json({ message: "Booking saved successfully", booking });

// //   } catch (error) {
// //     console.log(error);
// //     res.status(500).json({ error: "Failed to save booking" });
// //   }
// // });

// router.post("/createbooking/:userId", async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { cabinId, startDate, startTime, endDate, endTime } = req.body;

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const booking = new Booking({
//       cabinId,
//       userId,
//       startDate,
//       startTime,
//       endDate,
//       endTime,
//     });

//     await booking.save();
//     res.status(201).json({ message: "Booking saved successfully", booking });

//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ error: "Failed to save booking" });
//   }
// });




// // Get all bookings
// router.get("/", async (req, res) => {
//   try {
//     // Populate cabin details if needed
//     const bookings = await Booking.find().populate("cabinId", "name address capacity price");
//     res.status(200).json(bookings);
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ error: "Failed to fetch bookings" });
//   }
// });

// router.get("/userbookings/:userId", async (req, res) => {
//   try {
//     const { userId } = req.params;

//     const bookings = await Booking.find({ userId })
//       .populate("cabinId") // populate cabin details
//       .sort({ createdAt: -1 });

//     res.json({ bookings });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ error: "Failed to fetch bookings" });
//   }
// });



// // Get all bookings for a specific user
// // router.get("/userbookings/:userId", async (req, res) => {
// //   try {
// //     const { userId } = req.params; // Get userId from URL parameter
// //     console.log("Fetching bookings for userId:", userId);

// //     // Validate userId format
// //     if (!mongoose.Types.ObjectId.isValid(userId)) {
// //       console.log("Invalid User ID format");
// //       return res.status(400).json({ error: "Invalid User ID format" });
// //     }

// //     // Fetch all bookings associated with this user
// //     const bookings = await Booking.find({ userId: userId })
// //       .populate("cabinId", "name address capacity price images") // Optionally populate cabin details
// //       .exec();

// //     console.log("Found bookings count:", bookings.length);
// //     if (bookings.length > 0) {
// //       console.log("Sample booking cabin:", bookings[0].cabinId);
// //     }

// //     if (bookings.length === 0) {
// //       return res.status(200).json({ message: "No bookings found for this user", bookings: [] }); // Return 200 with empty array instead of 404 to avoid frontend error
// //     }

// //     res.status(200).json({ message: "Bookings fetched successfully", bookings });
// //   } catch (error) {
// //     console.log("Error fetching bookings:", error);
// //     res.status(500).json({ error: "Failed to fetch bookings" });
// //   }
// // });

// router.get("/userbookings/:userId", async (req, res) => {
//   try {
//     const { userId } = req.params;

//     const bookings = await Booking.find({ userId }).populate("cabinId");

//     res.json({ bookings });
//   } catch (err) {
//     console.log(err); // <-- this will show the real error in console
//     res.status(500).json({ error: "Failed to fetch bookings" });
//   }
// });


// module.exports = router;



const express = require("express");
const router = express.Router();
const Booking = require("../model/Booking");
const User = require("../model/User");

// Create a booking
// router.post("/createbooking/:userId", async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { cabinId, startDate, startTime, endDate, endTime } = req.body;

//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const booking = new Booking({
//       cabinId,
//       userId,
//       startDate,
//       startTime,
//       endDate,
//       endTime,
//     });

//     await booking.save();
//     res.status(201).json({ message: "Booking saved successfully", booking });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ error: "Failed to save booking" });
//   }
// });

router.post("/createbooking/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { cabinId, startDate, startTime, endDate, endTime } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // ⏱ Convert date + time to Date objects
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    if (end <= start) {
      return res.status(400).json({ error: "Invalid date/time selection" });
    }

    // 🧮 Calculate total hours
    const diffMs = end - start;
    const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));

    // 💰 Price logic
    const pricePerHour = 5000;
    const totalPrice = totalHours * pricePerHour;

    // ✅ Save booking
    const booking = new Booking({
      cabinId,
      userId,
      startDate,
      startTime,
      endDate,
      endTime,
      totalHours,
      totalPrice,
    });

    await booking.save();

    res.status(201).json({
      message: "Booking saved successfully",
      booking,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to save booking" });
  }
});




router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("cabinId", "name address capacity price images")
      .populate("userId", "name mobile email")   // 👈 ADD THIS LINE
      .sort({ createdAt: -1 });

    res.status(200).json({ bookings });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});


// Get bookings by userId
router.get("/userbookings/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const bookings = await Booking.find({ userId })
      .populate("cabinId", "name address capacity price images")
      .sort({ createdAt: -1 });

    res.status(200).json({ bookings }); // must send { bookings: [...] } for frontend
  } catch (err) {
    console.log(err); // real error will appear in console
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

module.exports = router;
