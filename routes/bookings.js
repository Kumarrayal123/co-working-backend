const express = require("express");
const router = express.Router();
const Booking = require("../model/Booking");
const User = require("../model/User");
const Cabin = require("../model/cabin");
const auth = require("../middleware/auth");
const Wallet = require('../model/Wallet');
const Razorpay = require('razorpay');
const crypto = require('crypto');  // ✅ ADD THIS LINE

const multer = require('multer');
const path = require('path');
const fs = require('fs');

console.log("Bookings route file loaded successfully");



// ✅ Razorpay initialized with keys
const razorpay = new Razorpay({
  key_id: 'rzp_test_BxtRNvflG06PTV',
  key_secret: 'RecEtdcenmR7Lm4AIEwo4KFr',
});




// Configure multer for screenshot upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads/payments';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'payment-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, JPG, GIF, WEBP)'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});


// ======================
// 🧪 DEBUG TEST ROUTE
// ======================
router.get("/test-route", (req, res) => {
  res.status(200).json({ message: "Bookings route is REACHABLE" });
});

// ======================
// ⭐ 1. GET OWNER BOOKINGS (FOR DOCTORS/OWNERS)
// ======================
router.get("/owner-bookings", auth, async (req, res) => {
  try {
    const ownerId = req.user.id;
    console.log("Fetching owner bookings for ID:", ownerId);

    // Find all cabins owned by this user
    const userCabins = await Cabin.find({ owner: ownerId }).select("_id name address price images seats");
    const cabinIds = userCabins.map(cabin => cabin._id);
    console.log("Found cabin IDs for owner:", cabinIds);

    // Find all bookings for these cabins
    const bookings = await Booking.find({ cabinId: { $in: cabinIds } })
      .populate("cabinId", "name address price images seats")
      .populate("userId", "name mobile email")
      .sort({ createdAt: -1 });

    console.log(`Found ${bookings.length} bookings for owner`);

    // ✅ Format bookings with populated seat details
    const formattedBookings = bookings.map(booking => {
      const bookingObj = booking.toObject();
      
      // ✅ POPULATE SELECTED SEATS WITH FULL DETAILS
      let populatedSelectedSeats = [];
      
      // Check if selectedSeats exist and is an array
      if (bookingObj.selectedSeats && Array.isArray(bookingObj.selectedSeats) && bookingObj.selectedSeats.length > 0) {
        // Check if cabin exists and has seats
        if (bookingObj.cabinId && bookingObj.cabinId.seats && Array.isArray(bookingObj.cabinId.seats)) {
          
          // Convert selected seat IDs to strings for comparison
          const selectedIds = bookingObj.selectedSeats.map(id => id.toString());
          
          // Filter cabin seats that match selected IDs
          populatedSelectedSeats = bookingObj.cabinId.seats
            .filter(seat => {
              const seatId = seat._id ? seat._id.toString() : seat.toString();
              return selectedIds.includes(seatId);
            })
            .map(seat => ({
              _id: seat._id || seat,
              name: seat.name || 'Unknown Seat',
              number: seat.number || 0
            }));
        }
      }

      // ✅ Return clean data with populated seats
      return {
        _id: bookingObj._id,
        cabin: bookingObj.cabinId ? {
          _id: bookingObj.cabinId._id,
          name: bookingObj.cabinId.name || 'N/A',
          address: bookingObj.cabinId.address || 'N/A',
          price: bookingObj.cabinId.price || 0,
          images: bookingObj.cabinId.images || [],
          seats: bookingObj.cabinId.seats || []
        } : null,
        user: bookingObj.userId ? {
          _id: bookingObj.userId._id,
          name: bookingObj.userId.name || 'N/A',
          email: bookingObj.userId.email || 'N/A',
          mobile: bookingObj.userId.mobile || 'N/A'
        } : null,
        startDate: bookingObj.startDate,
        startTime: bookingObj.startTime,
        endDate: bookingObj.endDate,
        endTime: bookingObj.endTime,
        totalHours: bookingObj.totalHours || 0,
        remainingHours: bookingObj.remainingHours || 0,
        hoursUsed: bookingObj.hoursUsed || 0,
        subtotal: bookingObj.subtotal || 0,
        gstAmount: bookingObj.gstAmount || 0,
        gstRate: bookingObj.gstRate || 0.18,
        totalPrice: bookingObj.totalPrice || 0,
        // ✅ SEAT DETAILS - POPULATED
        selectedSeats: populatedSelectedSeats,
        selectedSeatIds: bookingObj.selectedSeats || [],
        seatCount: bookingObj.seatCount || 0,
        extraCharge: bookingObj.extraCharge || 0,
        seatExtraChargePerSeat: bookingObj.seatExtraChargePerSeat || 100,
        bookingBasis: bookingObj.bookingBasis || 'hourly',
        selectedPlan: bookingObj.selectedPlan || null,
        status: bookingObj.status || 'pending',
        paymentMethod: bookingObj.paymentMethod || 'cash',
        paymentStatus: bookingObj.paymentStatus || 'pending',
        isPaidToOwner: bookingObj.isPaidToOwner || false,
        termsAccepted: bookingObj.termsAccepted || false,
        name: bookingObj.name,
        mobile: bookingObj.mobile,
        email: bookingObj.email,
        createdAt: bookingObj.createdAt,
        transactionId: bookingObj.transactionId || null,
        amountPaid: bookingObj.amountPaid || 0,
        paymentDetails: bookingObj.paymentDetails ? {
          mode: bookingObj.paymentDetails.mode || null,
          transactionId: bookingObj.paymentDetails.transactionId || null,
          paymentDate: bookingObj.paymentDetails.paymentDate || null,
          upiId: bookingObj.paymentDetails.upiId || null,
          upiApp: bookingObj.paymentDetails.upiApp || null,
          screenshot: bookingObj.paymentDetails.screenshot || null
        } : null
      };
    });

    console.log(`✅ Formatted ${formattedBookings.length} bookings with seat details`);
    res.status(200).json({ 
      success: true,
      bookings: formattedBookings,
      total: formattedBookings.length
    });
  } catch (err) {
    console.error("Error fetching owner bookings:", err);
    res.status(500).json({ error: "Failed to fetch bookings for your cabins" });
  }
});

// ======================
// CREATE BOOKING
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
      selectedPlan,
      selectedSeats = [],      // ✅ Array of seat IDs (optional)
      extraCharge = 0,          // ✅ Total extra charge (optional)
      seatCount = 0,            // ✅ Number of seats selected (optional)
      paymentMethod = "online",
      subtotal,
      gstAmount,
      totalAmount,
      termsAccepted
    } = req.body;

    // Validate terms accepted
    if (!termsAccepted) {
      return res.status(400).json({ 
        error: "Terms & Conditions must be accepted to proceed with booking" 
      });
    }

    const cabin = await Cabin.findById(cabinId);
    if (!cabin) {
      return res.status(404).json({ error: "Cabin not found" });
    }

    const ownerId = cabin.owner;

    // ✅ SEATS ARE OPTIONAL - Only validate if seats are selected
    if (selectedSeats && selectedSeats.length > 0) {
      // Check if selected seats exist in cabin
      const cabinSeatIds = cabin.seats.map(s => s._id.toString());
      const invalidSeats = selectedSeats.filter(id => !cabinSeatIds.includes(id));
      if (invalidSeats.length > 0) {
        return res.status(400).json({ 
          error: `Invalid seats selected: ${invalidSeats.join(', ')}` 
        });
      }

      // Check if selected seats exceed cabin capacity
      if (selectedSeats.length > cabin.seats.length) {
        return res.status(400).json({ 
          error: `Cannot select more than ${cabin.seats.length} seats` 
        });
      }
    }

    let calculatedTotalHours = 0;
    let calculatedSubtotal = 0;
    let calculatedGstAmount = 0;
    let calculatedTotalPrice = 0;
    let computedEndDate = endDate;
    let computedEndTime = endTime;

    const GST_RATE = 0.18;

    if (bookingBasis === "plan") {
      if (!selectedPlan || !selectedPlan.cost) {
        return res.status(400).json({ error: "Selected plan details are required" });
      }
      calculatedTotalHours = Number(selectedPlan.hours) || 0;
      calculatedSubtotal = Number(selectedPlan.cost) || 0;
      calculatedGstAmount = calculatedSubtotal * GST_RATE;
      calculatedTotalPrice = calculatedSubtotal + calculatedGstAmount;

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

      // Check for existing bookings (exclude plan bookings and cancelled/completed)
      const existingBookings = await Booking.find({ 
        cabinId,
        bookingBasis: { $ne: "plan" },
        status: { $nin: ['cancelled', 'completed'] }
      });

      // Check for overlapping time slots
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
      calculatedSubtotal = calculatedTotalHours * (cabin.price || 0);
      
      // ✅ ADD EXTRA CHARGE FOR SEATS (if any)
      const totalWithSeats = calculatedSubtotal + extraCharge;
      calculatedGstAmount = totalWithSeats * GST_RATE;
      calculatedTotalPrice = totalWithSeats + calculatedGstAmount;
    }

    let finalTotalPrice = 0;
    let finalSubtotal = 0;
    let finalGstAmount = 0;

    if (totalAmount && totalAmount > 0) {
      finalTotalPrice = Number(totalAmount);
      finalSubtotal = Number(subtotal) || calculatedSubtotal;
      finalGstAmount = Number(gstAmount) || calculatedGstAmount;
    } else {
      finalSubtotal = calculatedSubtotal;
      finalGstAmount = calculatedGstAmount;
      finalTotalPrice = calculatedTotalPrice;
    }

    console.log("===== BOOKING DEBUG =====");
    console.log("Terms Accepted:", termsAccepted);
    console.log("Selected Seats:", selectedSeats);
    console.log("Seat Count:", seatCount);
    console.log("Extra Charge:", extraCharge);
    console.log("Subtotal:", finalSubtotal);
    console.log("GST:", finalGstAmount);
    console.log("Total Price:", finalTotalPrice);
    console.log("=========================");

    let razorpayOrder = null;
    if (paymentMethod === 'online') {
      const amountInPaise = Math.round(parseFloat(finalTotalPrice) * 100);
      
      if (amountInPaise <= 0) {
        return res.status(400).json({ error: "Invalid amount for payment" });
      }

      razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `booking_${Date.now()}`,
        notes: {
          cabinId: cabinId,
          userId: userId,
          subtotal: String(finalSubtotal),
          gstAmount: String(finalGstAmount),
          totalAmount: String(finalTotalPrice),
          extraCharge: String(extraCharge),
          seatCount: String(seatCount),
          termsAccepted: String(termsAccepted)
        }
      });

      console.log("Razorpay Order Created:", {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        amountInRupees: razorpayOrder.amount / 100
      });
    }

    // ✅ Get seat details for response (if any seats selected)
    let selectedSeatDetails = [];
    if (selectedSeats && selectedSeats.length > 0) {
      selectedSeatDetails = cabin.seats.filter(s => 
        selectedSeats.includes(s._id.toString())
      );
    }

    const bookingData = {
      cabinId,
      userId,
      ownerId: ownerId,
      name,
      mobile,
      email,
      startDate,
      startTime,
      endDate: computedEndDate,
      endTime: computedEndTime,
      totalHours: calculatedTotalHours,
      subtotal: finalSubtotal,
      gstAmount: finalGstAmount,
      totalPrice: finalTotalPrice,
      gstRate: GST_RATE,
      bookingBasis,
      selectedPlan,
      
      // ✅ SEAT FIELDS (optional)
      selectedSeats: selectedSeats || [],
      extraCharge: extraCharge || 0,
      seatCount: seatCount || 0,
      seatExtraChargePerSeat: 100,
      
      paymentMethod: paymentMethod,
      remainingHours: calculatedTotalHours,
      hoursUsed: 0,
      isPaidToOwner: false,
      termsAccepted: termsAccepted
    };

    if (paymentMethod === 'cash') {
      bookingData.status = 'confirmed';
      bookingData.paymentStatus = 'pending';
      bookingData.transactionId = `CASH_${Date.now()}`;
    } else {
      bookingData.status = 'pending';
      bookingData.paymentStatus = 'pending';
      bookingData.razorpayOrderId = razorpayOrder.id;
      bookingData.transactionId = razorpayOrder.id;
    }

    const booking = new Booking(bookingData);
    await booking.save();

    if (paymentMethod === 'cash') {
      res.status(201).json({
        success: true,
        message: `Booking confirmed! Total: ₹${finalTotalPrice.toFixed(2)} (incl. GST ₹${finalGstAmount.toFixed(2)})`,
        booking: {
          id: booking._id,
          cabinName: cabin.name,
          subtotal: booking.subtotal,
          gstAmount: booking.gstAmount,
          totalPrice: booking.totalPrice,
          totalHours: booking.totalHours,
          remainingHours: booking.remainingHours,
          status: booking.status,
          paymentMethod: booking.paymentMethod,
          paymentStatus: booking.paymentStatus,
          gstRate: booking.gstRate,
          termsAccepted: booking.termsAccepted,
          // ✅ SEAT INFO
          selectedSeats: selectedSeatDetails,
          seatCount: booking.seatCount,
          extraCharge: booking.extraCharge
        }
      });
    } else {
      res.status(201).json({
        success: true,
        message: "Booking created. Please complete payment.",
        booking: {
          id: booking._id,
          cabinName: cabin.name,
          subtotal: booking.subtotal,
          gstAmount: booking.gstAmount,
          totalPrice: booking.totalPrice,
          totalHours: booking.totalHours,
          remainingHours: booking.remainingHours,
          status: booking.status,
          paymentMethod: booking.paymentMethod,
          paymentStatus: booking.paymentStatus,
          gstRate: booking.gstRate,
          termsAccepted: booking.termsAccepted,
          // ✅ SEAT INFO
          selectedSeats: selectedSeatDetails,
          seatCount: booking.seatCount,
          extraCharge: booking.extraCharge
        },
        razorpay: {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          amountInRupees: (razorpayOrder.amount / 100).toFixed(2),
          currency: razorpayOrder.currency,
          key: 'rzp_test_BxtRNvflG06PTV'
        }
      });
    }

  } catch (err) {
    console.error("Booking creation error:", err);
    res.status(500).json({ error: "Booking failed", details: err.message });
  }
});
// ======================
// VERIFY PAYMENT - WITH WALLET UPDATE
// ======================
router.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId
    } = req.body;

    console.log("===== VERIFY PAYMENT REQUEST =====");
    console.log("Order ID:", razorpay_order_id);
    console.log("Payment ID:", razorpay_payment_id);
    console.log("Booking ID:", bookingId);
    console.log("==================================");

    if (!bookingId) {
      console.error("Booking ID is missing!");
      return res.status(400).json({
        success: false,
        error: "Booking ID is required"
      });
    }

    // ✅ VERIFY SIGNATURE
    const secret = 'RecEtdcenmR7Lm4AIEwo4KFr';
    const hmac = crypto.createHmac('sha256', secret);
    const data = `${razorpay_order_id}|${razorpay_payment_id}`;
    hmac.update(data);
    const generatedSignature = hmac.digest('hex');

    console.log("Generated Signature:", generatedSignature);
    console.log("Received Signature:", razorpay_signature);
    console.log("Match?", generatedSignature === razorpay_signature);

    if (generatedSignature !== razorpay_signature) {
      console.error("❌ Signature mismatch!");
      return res.status(400).json({
        success: false,
        error: "Invalid payment signature"
      });
    }

    console.log("✅ Signature verified!");

    // ✅ Find and update booking
    const booking = await Booking.findById(bookingId).populate('cabinId', 'name owner');
    if (!booking) {
      console.error("Booking not found:", bookingId);
      return res.status(404).json({
        success: false,
        error: "Booking not found"
      });
    }

    // ✅ Update booking
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpayOrderId = razorpay_order_id;
    booking.transactionId = razorpay_payment_id;
    booking.updatedAt = new Date();

    if (booking.bookingBasis === 'plan' && booking.selectedPlan) {
      booking.remainingHours = Number(booking.selectedPlan.hours) || booking.totalHours;
    } else {
      booking.remainingHours = booking.totalHours;
    }

    await booking.save();

    console.log("✅ Booking updated successfully:", {
      id: booking._id,
      status: booking.status,
      paymentStatus: booking.paymentStatus
    });

    // ======================
    // ✅ ADD AMOUNT TO OWNER WALLET
    // ======================
    if (!booking.isPaidToOwner) {
      try {
        const ownerId = booking.ownerId || booking.cabinId?.owner;
        const amountToAdd = booking.totalPrice || 0;

        console.log("💰 Adding to owner wallet:", {
          ownerId: ownerId,
          amount: amountToAdd,
          bookingId: booking._id
        });

        if (ownerId && amountToAdd > 0) {
          let wallet = await Wallet.findOne({ ownerId: ownerId });
          if (!wallet) {
            wallet = new Wallet({
              ownerId: ownerId,
              balance: 0,
              totalEarned: 0,
              transactions: [],
              withdrawals: []
            });
            console.log("✅ New wallet created for owner:", ownerId);
          }

          wallet.transactions.push({
            bookingId: booking._id,
            cabinId: booking.cabinId?._id,
            cabinName: booking.cabinId?.name || 'Unknown Cabin',
            amount: amountToAdd,
            type: 'credit',
            description: `Booking payment for ${booking.cabinId?.name || 'Cabin'}`,
            customerName: booking.name || 'Customer',
            customerMobile: booking.mobile || 'N/A',
            startDate: booking.startDate,
            endDate: booking.endDate
          });

          wallet.balance = (wallet.balance || 0) + amountToAdd;
          wallet.totalEarned = (wallet.totalEarned || 0) + amountToAdd;
          wallet.updatedAt = new Date();

          await wallet.save();
          console.log("✅ Wallet updated successfully:", {
            ownerId: ownerId,
            newBalance: wallet.balance,
            totalEarned: wallet.totalEarned
          });

          booking.isPaidToOwner = true;
          await booking.save();

          console.log("✅ Amount added to owner wallet successfully!");
        } else {
          console.warn("⚠️ Owner ID or amount missing:", { ownerId, amountToAdd });
        }
      } catch (walletError) {
        console.error("❌ Wallet update error:", walletError);
        // Don't fail the response
      }
    } else {
      console.log("ℹ️ Amount already added to owner wallet");
    }

    res.json({
      success: true,
      message: "Payment verified and booking confirmed!",
      booking: {
        id: booking._id,
        cabinId: booking.cabinId,
        startDate: booking.startDate,
        startTime: booking.startTime,
        endDate: booking.endDate,
        endTime: booking.endTime,
        totalHours: booking.totalHours,
        subtotal: booking.subtotal,
        gstAmount: booking.gstAmount,
        totalPrice: booking.totalPrice,
        remainingHours: booking.remainingHours,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        razorpayPaymentId: booking.razorpayPaymentId,
        transactionId: booking.transactionId,
        isPaidToOwner: booking.isPaidToOwner
      }
    });

  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({
      success: false,
      error: "Payment verification failed",
      details: err.message
    });
  }
});




// ======================
// REPLACE BOOKING
// ======================
router.put("/replace-booking/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { newCabinId } = req.body;

    if (!newCabinId) {
      return res.status(400).json({ error: "New cabin ID is required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status !== 'confirmed' && booking.status !== 'active') {
      return res.status(400).json({ error: "Only confirmed or active bookings can be replaced" });
    }

    const newCabin = await Cabin.findById(newCabinId);
    if (!newCabin || !newCabin.isActive) {
      return res.status(400).json({ error: "Selected cabin is not available" });
    }

    // Check availability
    const start = new Date(`${booking.startDate}T${booking.startTime}`);
    const end = new Date(`${booking.endDate}T${booking.endTime}`);

    const conflicting = await Booking.find({
      cabinId: newCabinId,
      status: { $nin: ['cancelled', 'completed'] },
      $or: [
        { startDate: booking.startDate, startTime: { $lt: booking.endTime } },
        { endDate: booking.endDate, endTime: { $gt: booking.startTime } }
      ]
    });

    if (conflicting.length > 0) {
      return res.status(400).json({ error: "New cabin is not available for this time slot" });
    }

    // Calculate difference
    const oldTotal = booking.totalPrice || 0;
    const newTotal = (newCabin.price * booking.totalHours) * 1.18;
    const priceDiff = Math.round(newTotal - oldTotal);

    // Update booking
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        cabinId: newCabinId,
        subtotal: newCabin.price * booking.totalHours,
        gstAmount: (newCabin.price * booking.totalHours) * 0.18,
        totalPrice: newTotal,
        isReplaced: true,
        replacedFrom: booking.cabinId,
        replacedTo: newCabinId,
        priceDifference: priceDiff
      },
      { new: true }
    ).populate('cabinId');

    let message = "Booking replaced successfully!";
    if (priceDiff > 0) message = `₹${priceDiff} extra to pay.`;
    else if (priceDiff < 0) message = `₹${Math.abs(priceDiff)} will be refunded.`;

    res.json({
      success: true,
      message: message,
      booking: updatedBooking,
      priceDifference: priceDiff
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to replace booking", details: err.message });
  }
});




// ======================
// CANCEL BOOKING
// ======================
router.put("/cancel-booking/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: "Booking already cancelled" });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ error: "Cannot cancel completed booking" });
    }

    // Refund calculation
    const now = new Date();
    const startTime = new Date(`${booking.startDate}T${booking.startTime}`);
    const hoursLeft = (startTime - now) / (1000 * 60 * 60);

    let refundAmount = 0;
    if (hoursLeft >= 24) refundAmount = booking.totalPrice;
    else if (hoursLeft >= 1) refundAmount = booking.totalPrice * 0.5;
    else refundAmount = 0;

    // Update booking
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        refundAmount: refundAmount
      },
      { new: true }
    );

    let message = "Booking cancelled!";
    if (refundAmount === booking.totalPrice) message = "Full refund will be processed.";
    else if (refundAmount > 0) message = "50% refund will be processed.";
    else message = "No refund applicable.";

    res.json({
      success: true,
      message: message,
      booking: updatedBooking,
      refundAmount: refundAmount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to cancel booking", details: err.message });
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

    // Validate required fields
    if (!cabinId || !name || !mobile || !startDate || !startTime) {
      return res.status(400).json({ 
        error: "Missing required fields for site visit",
        required: ["cabinId", "name", "mobile", "startDate", "startTime"]
      });
    }

    // Create new booking with status "confirmed"
    const booking = new Booking({
      cabinId,
      userId,
      name,
      mobile,
      email: email || "",
      startDate,
      startTime,
      bookingType: "visit",
      totalHours: 0,
      totalPrice: 0,
      status: "confirmed" // ✅ Status set to confirmed
    });

    await booking.save();

    res.status(201).json({
      success: true,
      message: "Site visit scheduled successfully",
      booking: {
        id: booking._id,
        cabinId: booking.cabinId,
        name: booking.name,
        mobile: booking.mobile,
        email: booking.email,
        startDate: booking.startDate,
        startTime: booking.startTime,
        bookingType: booking.bookingType,
        status: booking.status,
        createdAt: booking.createdAt
      }
    });

  } catch (err) {
    console.error("Error creating site visit:", err);
    res.status(500).json({ 
      success: false,
      error: "Site visit scheduling failed",
      details: err.message 
    });
  }
});


// ======================
// 3. GET ALL BOOKINGS (ADMIN)
// ======================
// routes/bookings.js

// ======================
// 3. GET ALL BOOKINGS (ADMIN)
// ======================
router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate({
        path: "cabinId",
        populate: {
          path: "owner",
          model: "User",
          select: "name email mobile address organizationName gstNumber"
        }
      })
      .populate("userId", "name mobile email")
      .sort({ createdAt: -1 });

    // ✅ Format bookings with populated seat details
    const formattedBookings = bookings.map(booking => {
      const bookingObj = booking.toObject();
      
      // ✅ POPULATE SELECTED SEATS WITH FULL DETAILS
      let populatedSelectedSeats = [];
      
      // Check if selectedSeats exist and is an array
      if (bookingObj.selectedSeats && Array.isArray(bookingObj.selectedSeats) && bookingObj.selectedSeats.length > 0) {
        // Check if cabin exists and has seats
        if (bookingObj.cabinId && bookingObj.cabinId.seats && Array.isArray(bookingObj.cabinId.seats)) {
          
          // Convert selected seat IDs to strings for comparison
          const selectedIds = bookingObj.selectedSeats.map(id => id.toString());
          
          // Filter cabin seats that match selected IDs
          populatedSelectedSeats = bookingObj.cabinId.seats
            .filter(seat => {
              const seatId = seat._id ? seat._id.toString() : seat.toString();
              return selectedIds.includes(seatId);
            })
            .map(seat => ({
              _id: seat._id || seat,
              name: seat.name || 'Unknown Seat',
              number: seat.number || 0
            }));
        }
      }

      // ✅ Return clean data with populated seats
      return {
        _id: bookingObj._id,
        cabin: bookingObj.cabinId ? {
          _id: bookingObj.cabinId._id,
          name: bookingObj.cabinId.name || 'N/A',
          address: bookingObj.cabinId.address || 'N/A',
          price: bookingObj.cabinId.price || 0,
          capacity: bookingObj.cabinId.capacity || 0,
          cabinType: bookingObj.cabinId.cabinType || 'normal',
          images: bookingObj.cabinId.images || [],
          isActive: bookingObj.cabinId.isActive || false,
          seats: bookingObj.cabinId.seats || [],
          owner: bookingObj.cabinId.owner ? {
            _id: bookingObj.cabinId.owner._id,
            name: bookingObj.cabinId.owner.name,
            email: bookingObj.cabinId.owner.email,
            mobile: bookingObj.cabinId.owner.mobile,
            address: bookingObj.cabinId.owner.address,
            organizationName: bookingObj.cabinId.owner.organizationName || '',
            gstNumber: bookingObj.cabinId.owner.gstNumber || ''
          } : null
        } : null,
        user: bookingObj.userId ? {
          _id: bookingObj.userId._id,
          name: bookingObj.userId.name || 'N/A',
          email: bookingObj.userId.email || 'N/A',
          mobile: bookingObj.userId.mobile || 'N/A'
        } : null,
        startDate: bookingObj.startDate,
        startTime: bookingObj.startTime,
        endDate: bookingObj.endDate,
        endTime: bookingObj.endTime,
        totalHours: bookingObj.totalHours || 0,
        remainingHours: bookingObj.remainingHours || 0,
        hoursUsed: bookingObj.hoursUsed || 0,
        subtotal: bookingObj.subtotal || 0,
        gstAmount: bookingObj.gstAmount || 0,
        gstRate: bookingObj.gstRate || 0.18,
        totalPrice: bookingObj.totalPrice || 0,
        // ✅ SEAT DETAILS - POPULATED
        selectedSeats: populatedSelectedSeats,
        selectedSeatIds: bookingObj.selectedSeats || [],
        seatCount: bookingObj.seatCount || 0,
        extraCharge: bookingObj.extraCharge || 0,
        seatExtraChargePerSeat: bookingObj.seatExtraChargePerSeat || 100,
        bookingBasis: bookingObj.bookingBasis || 'hourly',
        selectedPlan: bookingObj.selectedPlan || null,
        status: bookingObj.status || 'pending',
        paymentMethod: bookingObj.paymentMethod || 'cash',
        paymentStatus: bookingObj.paymentStatus || 'pending',
        isPaidToOwner: bookingObj.isPaidToOwner || false,
        termsAccepted: bookingObj.termsAccepted || false,
        name: bookingObj.name,
        mobile: bookingObj.mobile,
        email: bookingObj.email,
        createdAt: bookingObj.createdAt,
        transactionId: bookingObj.transactionId || null,
        amountPaid: bookingObj.amountPaid || 0,
        paymentDetails: bookingObj.paymentDetails ? {
          mode: bookingObj.paymentDetails.mode || null,
          transactionId: bookingObj.paymentDetails.transactionId || null,
          paymentDate: bookingObj.paymentDetails.paymentDate || null,
          upiId: bookingObj.paymentDetails.upiId || null,
          upiApp: bookingObj.paymentDetails.upiApp || null,
          screenshot: bookingObj.paymentDetails.screenshot || null,
          cardNumber: bookingObj.paymentDetails.cardNumber || null,
          cardHolderName: bookingObj.paymentDetails.cardHolderName || null
        } : null,
        visitingTimings: bookingObj.visitingTimings || [],
        isCheckedIn: bookingObj.isCheckedIn || false,
        checkedInAt: bookingObj.checkedInAt || null,
        checkedInLat: bookingObj.checkedInLat || null,
        checkedInLng: bookingObj.checkedInLng || null,
        checkedInAddress: bookingObj.checkedInAddress || '',
        checkHistory: bookingObj.checkHistory || [],
        isReplaced: bookingObj.isReplaced || false,
        replacedFrom: bookingObj.replacedFrom || null,
        replacedTo: bookingObj.replacedTo || null,
        priceDifference: bookingObj.priceDifference || 0,
        cancelledAt: bookingObj.cancelledAt || null,
        refundAmount: bookingObj.refundAmount || 0,
        razorpayOrderId: bookingObj.razorpayOrderId || '',
        razorpayPaymentId: bookingObj.razorpayPaymentId || '',
        razorpaySignature: bookingObj.razorpaySignature || '',
        paymentId: bookingObj.paymentId || '',
        bookingType: bookingObj.bookingType || 'booking'
      };
    });

    console.log(`✅ Admin: Found ${formattedBookings.length} bookings with seat details`);
    res.status(200).json({ 
      success: true,
      bookings: formattedBookings,
      total: formattedBookings.length
    });
  } catch (error) {
    console.error("❌ Error fetching admin bookings:", error);
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
// 4. GET BOOKINGS BY USER ID (CUSTOMER) - FIXED
// ======================
router.get("/user", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("-----------------------------------------");
    console.log(`📡 API REQUEST: GET /api/bookings/user`);
    console.log(`👤 Current Session userId: ${userId}`);
    console.log("-----------------------------------------");

    const bookings = await Booking.find({ userId })
      .populate({
        path: "cabinId",
        select: "name address price capacity cabinType images seats isActive",
        populate: {
          path: "owner",
          model: "User",
          select: "name email mobile address organizationName"
        }
      })
      .sort({ createdAt: -1 });

    console.log("📦 Raw bookings count:", bookings.length);
    console.log("📦 First booking selectedSeats:", bookings[0]?.selectedSeats);

    // ✅ Format bookings with populated seat details
    const formattedBookings = bookings.map(booking => {
      const bookingObj = booking.toObject();
      
      console.log(`🔍 Booking ${bookingObj._id} selectedSeats:`, bookingObj.selectedSeats);
      console.log(`🔍 Cabin seats:`, bookingObj.cabinId?.seats);
      
      // ✅ POPULATE SELECTED SEATS WITH FULL DETAILS
      let populatedSelectedSeats = [];
      
      // Check if selectedSeats exist and is an array
      if (bookingObj.selectedSeats && Array.isArray(bookingObj.selectedSeats) && bookingObj.selectedSeats.length > 0) {
        // Check if cabin exists and has seats
        if (bookingObj.cabinId && bookingObj.cabinId.seats && Array.isArray(bookingObj.cabinId.seats)) {
          
          // Convert selected seat IDs to strings for comparison
          const selectedIds = bookingObj.selectedSeats.map(id => id.toString());
          
          // Filter cabin seats that match selected IDs
          populatedSelectedSeats = bookingObj.cabinId.seats
            .filter(seat => {
              const seatId = seat._id ? seat._id.toString() : seat.toString();
              return selectedIds.includes(seatId);
            })
            .map(seat => ({
              _id: seat._id || seat,
              name: seat.name || 'Unknown Seat',
              number: seat.number || 0
            }));
        }
      }

      console.log(`✅ Populated seats for booking ${bookingObj._id}:`, populatedSelectedSeats);

      // ✅ Return clean data
      return {
        _id: bookingObj._id,
        // Cabin basic info
        cabin: bookingObj.cabinId ? {
          _id: bookingObj.cabinId._id,
          name: bookingObj.cabinId.name || 'N/A',
          address: bookingObj.cabinId.address || 'N/A',
          price: bookingObj.cabinId.price || 0,
          capacity: bookingObj.cabinId.capacity || 0,
          cabinType: bookingObj.cabinId.cabinType || 'normal',
          images: bookingObj.cabinId.images || [],
          isActive: bookingObj.cabinId.isActive || false,
          owner: bookingObj.cabinId.owner ? {
            _id: bookingObj.cabinId.owner._id,
            name: bookingObj.cabinId.owner.name,
            email: bookingObj.cabinId.owner.email,
            mobile: bookingObj.cabinId.owner.mobile,
            address: bookingObj.cabinId.owner.address,
            organizationName: bookingObj.cabinId.owner.organizationName || ''
          } : null
        } : null,
        // Booking details
        startDate: bookingObj.startDate,
        startTime: bookingObj.startTime,
        endDate: bookingObj.endDate,
        endTime: bookingObj.endTime,
        totalHours: bookingObj.totalHours || 0,
        remainingHours: bookingObj.remainingHours || 0,
        hoursUsed: bookingObj.hoursUsed || 0,
        // Pricing
        subtotal: bookingObj.subtotal || 0,
        gstAmount: bookingObj.gstAmount || 0,
        gstRate: bookingObj.gstRate || 0.18,
        totalPrice: bookingObj.totalPrice || 0,
        // ✅ SEAT DETAILS - POPULATED
        selectedSeats: populatedSelectedSeats,
        selectedSeatIds: bookingObj.selectedSeats || [], // Keep raw IDs too if needed
        seatCount: bookingObj.seatCount || 0,
        extraCharge: bookingObj.extraCharge || 0,
        seatExtraChargePerSeat: bookingObj.seatExtraChargePerSeat || 100,
        // Booking metadata
        bookingBasis: bookingObj.bookingBasis || 'hourly',
        selectedPlan: bookingObj.selectedPlan || null,
        status: bookingObj.status || 'pending',
        paymentMethod: bookingObj.paymentMethod || 'cash',
        paymentStatus: bookingObj.paymentStatus || 'pending',
        isPaidToOwner: bookingObj.isPaidToOwner || false,
        termsAccepted: bookingObj.termsAccepted || false,
        name: bookingObj.name,
        mobile: bookingObj.mobile,
        email: bookingObj.email,
        createdAt: bookingObj.createdAt,
        transactionId: bookingObj.transactionId || null,
        // Payment details
        paymentDetails: bookingObj.paymentDetails ? {
          mode: bookingObj.paymentDetails.mode || null,
          transactionId: bookingObj.paymentDetails.transactionId || null,
          paymentDate: bookingObj.paymentDetails.paymentDate || null,
          upiId: bookingObj.paymentDetails.upiId || null,
          upiApp: bookingObj.paymentDetails.upiApp || null,
          screenshot: bookingObj.paymentDetails.screenshot || null
        } : null
      };
    });

    console.log(`✅ Bookings: Found ${formattedBookings.length} bookings for user ${userId}`);
    
    res.status(200).json({ 
      success: true,
      bookings: formattedBookings,
      total: formattedBookings.length
    });
  } catch (err) {
    console.error("❌ Error fetching bookings:", err);
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



// routes/bookings.js - Add this route
// ======================
// UPDATE BOOKING STATUS
// ======================
router.put("/update-status/:bookingId", auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'active'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check if user owns this booking
    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to update this booking" });
    }

    booking.status = status;
    await booking.save();

    res.json({
      success: true,
      message: `Booking status updated to ${status}`,
      booking
    });

  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ error: "Failed to update booking status" });
  }
});



// ======================
// GET MY WALLET
// ======================
router.get('/my-wallet', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    let wallet = await Wallet.findOne({ ownerId: userId });
    if (!wallet) {
      wallet = new Wallet({
        ownerId: userId,
        balance: 0,
        totalEarned: 0,
        transactions: []
      });
      await wallet.save();
    }

    res.json({
      success: true,
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        totalTransactions: wallet.transactions.length
      },
      transactions: wallet.transactions.slice(0, 20).reverse()
    });

  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: 'Failed to get wallet' });
  }
});


// ======================
// GET ALL WALLETS (Admin) - WITH ORGANIZATION NAME
// ======================
router.get('/all-wallets', async (req, res) => {
  try {
    const wallets = await Wallet.find()
      .populate('ownerId', 'name email mobile address organizationName gstNumber')
      .sort({ createdAt: -1 });

    const stats = {
      totalWallets: wallets.length,
      totalBalance: wallets.reduce((sum, w) => sum + (w.balance || 0), 0),
      totalEarned: wallets.reduce((sum, w) => sum + (w.totalEarned || 0), 0),
      totalTransactions: wallets.reduce((sum, w) => sum + (w.transactions || []).length, 0),
      activeWallets: wallets.filter(w => (w.balance || 0) > 0).length,
      zeroBalanceWallets: wallets.filter(w => (w.balance || 0) === 0).length
    };

    res.json({
      success: true,
      wallets: wallets,
      stats: stats
    });

  } catch (error) {
    console.error('Get all wallets error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch wallets' 
    });
  }
});


// Delete wallet by ID
router.delete('/wallet/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;
    
    // Find and delete the wallet
    const deletedWallet = await Wallet.findByIdAndDelete(walletId);
    
    if (!deletedWallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Wallet deleted successfully',
      wallet: deletedWallet
    });
    
  } catch (error) {
    console.error('Delete wallet error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete wallet'
    });
  }
});



// ======================
// CREATE WITHDRAWAL
// ======================
router.post('/withdraw', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, accountNumber, bankName, ifscCode } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!accountNumber || !bankName || !ifscCode) {
      return res.status(400).json({ error: 'All account details are required' });
    }

    let wallet = await Wallet.findOne({ ownerId: userId });
    if (!wallet) {
      wallet = new Wallet({
        ownerId: userId,
        balance: 0,
        totalEarned: 0,
        transactions: [],
        withdrawals: []
      });
      await wallet.save();
    }

    if (amount > wallet.balance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // ✅ Deduct balance
    wallet.balance -= amount;

    // ✅ Add to transactions (debit)
    wallet.transactions.push({
      amount: amount,
      type: 'debit',
      description: `Withdrawal - ${bankName} (${accountNumber.slice(-4)})`,
      customerName: 'Self',
      customerMobile: 'N/A',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    });

    // ✅ Add to withdrawals array
    wallet.withdrawals.push({
      amount: amount,
      accountNumber: accountNumber,
      bankName: bankName,
      ifscCode: ifscCode,
      status: 'pending',
      description: `Withdrawal request for ₹${amount}`,
      createdAt: new Date()
    });

    await wallet.save();

    const newWithdrawal = wallet.withdrawals[wallet.withdrawals.length - 1];

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      balance: wallet.balance,
      withdrawal: newWithdrawal
    });

  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: 'Failed to withdraw' });
  }
});



// ======================
// GET ALL WITHDRAWALS
// ======================
router.get('/withdrawals', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const wallet = await Wallet.findOne({ ownerId: userId });
    if (!wallet) {
      return res.json({
        success: true,
        withdrawals: [],
        stats: {
          total: 0,
          pending: 0,
          completed: 0,
          failed: 0
        }
      });
    }

    const stats = {
      total: wallet.withdrawals.length,
      pending: wallet.withdrawals.filter(w => w.status === 'pending').length,
      completed: wallet.withdrawals.filter(w => w.status === 'completed').length,
      failed: wallet.withdrawals.filter(w => w.status === 'failed').length
    };

    res.json({
      success: true,
      withdrawals: wallet.withdrawals.slice(0, 20).reverse(),
      stats: stats
    });

  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({ error: 'Failed to get withdrawals' });
  }
});




// ======================
// GET ALL WITHDRAWALS (WITH ORGANIZATION & GST)
// ======================
router.get('/all-withdrawals', async (req, res) => {
  try {
    // Find all wallets and populate owner details with organization and GST
    const wallets = await Wallet.find({})
      .populate('ownerId', 'name email mobile address organizationName gstNumber')
      .sort({ createdAt: -1 });

    // Collect all withdrawals with wallet info
    let allWithdrawals = [];
    
    wallets.forEach(wallet => {
      wallet.withdrawals.forEach(withdrawal => {
        allWithdrawals.push({
          _id: withdrawal._id,
          amount: withdrawal.amount,
          accountNumber: withdrawal.accountNumber,
          bankName: withdrawal.bankName,
          ifscCode: withdrawal.ifscCode,
          status: withdrawal.status,
          description: withdrawal.description,
          createdAt: withdrawal.createdAt,
          walletId: wallet._id,
          owner: wallet.ownerId,
          walletBalance: wallet.balance,
          ownerOrganization: wallet.ownerId?.organizationName || 'N/A',
          ownerGst: wallet.ownerId?.gstNumber || 'N/A'
        });
      });
    });

    // Sort by createdAt descending (newest first)
    allWithdrawals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate stats
    const stats = {
      total: allWithdrawals.length,
      pending: allWithdrawals.filter(w => w.status === 'pending').length,
      completed: allWithdrawals.filter(w => w.status === 'completed').length,
      failed: allWithdrawals.filter(w => w.status === 'failed').length,
      rejected: allWithdrawals.filter(w => w.status === 'rejected').length,
      totalAmount: allWithdrawals.reduce((sum, w) => sum + w.amount, 0),
      uniqueUsers: new Set(allWithdrawals.map(w => w.walletId.toString())).size
    };

    res.json({
      success: true,
      withdrawals: allWithdrawals,
      stats: stats
    });

  } catch (error) {
    console.error('Get all withdrawals error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get all withdrawals'
    });
  }
});

// ======================
// UPDATE WITHDRAWAL STATUS (NO AUTH)
// ======================
router.put('/withdrawalstatus/:withdrawalId', async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { status } = req.body;

    if (!['pending', 'completed', 'failed', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be pending, completed, failed, or rejected'
      });
    }

    // Find wallet containing this withdrawal
    const wallet = await Wallet.findOne({ 'withdrawals._id': withdrawalId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal not found'
      });
    }

    // Find the withdrawal
    const withdrawal = wallet.withdrawals.id(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal not found'
      });
    }

    // If changing from pending to rejected/failed, refund the amount
    if (withdrawal.status === 'pending' && (status === 'rejected' || status === 'failed')) {
      wallet.balance += withdrawal.amount;
    }

    // Update status
    withdrawal.status = status;
    await wallet.save();

    res.json({
      success: true,
      message: `Withdrawal status updated to ${status}`,
      withdrawal: withdrawal
    });

  } catch (error) {
    console.error('Update withdrawal status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update withdrawal status'
    });
  }
});


// ======================
// DELETE WITHDRAWAL (NO AUTH)
// ======================
router.delete('/deletewithdrawal/:withdrawalId', async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    // Find wallet containing this withdrawal
    const wallet = await Wallet.findOne({ 'withdrawals._id': withdrawalId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal not found'
      });
    }

    // Find the withdrawal
    const withdrawal = wallet.withdrawals.id(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal not found'
      });
    }

    // Only allow deletion if status is pending or failed
    if (withdrawal.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a completed withdrawal'
      });
    }

    // If pending, refund the amount back to wallet
    if (withdrawal.status === 'pending') {
      wallet.balance += withdrawal.amount;
    }

    // Remove withdrawal
    wallet.withdrawals.id(withdrawalId).remove();
    await wallet.save();

    res.json({
      success: true,
      message: 'Withdrawal deleted successfully',
      refunded: withdrawal.status === 'pending'
    });

  } catch (error) {
    console.error('Delete withdrawal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete withdrawal'
    });
  }
});


// ======================
// GET LOCATION FROM COORDINATES (Reverse Geocoding)
// ======================
const getAddressFromCoords = async (lat, lng) => {
  try {
    // Using OpenStreetMap Nominatim API (Free)
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`
    );
    
    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }
    return `${lat}, ${lng}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return `${lat}, ${lng}`;
  }
};

// routes/bookings.js - Check-in
router.post('/check-in/:bookingId', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { lat, lng } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // ✅ Only confirmed bookings can check-in
    if (booking.status !== 'confirmed' && booking.status !== 'active') {
      return res.status(400).json({ error: 'Booking is not confirmed' });
    }
    
    // ✅ Check if already checked in
    if (booking.isCheckedIn) {
      return res.status(400).json({ error: 'Already checked in' });
    }
    
    // ✅ Check if remaining hours > 0
    if (booking.remainingHours <= 0) {
      return res.status(400).json({ error: 'No remaining hours left. Please renew.' });
    }

    // Get address from coordinates
    let address = '';
    if (lat && lng) {
      const axios = require('axios');
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`
        );
        if (response.data && response.data.display_name) {
          address = response.data.display_name;
        }
      } catch (e) {
        address = `${lat}, ${lng}`;
      }
    }

    // ✅ Mark as checked in
    booking.isCheckedIn = true;
    booking.checkedInAt = new Date();
    booking.checkedInLat = lat || null;
    booking.checkedInLng = lng || null;
    booking.checkedInAddress = address || 'Location not available';
    
    // ✅ Update status to ACTIVE
    booking.status = 'active';
    
    // ✅ Add to check history
    booking.checkHistory.push({
      type: 'in',
      timestamp: new Date(),
      lat: lat || null,
      lng: lng || null,
      address: address || '',
      hoursUsed: booking.hoursUsed,
      remainingHours: booking.remainingHours
    });

    await booking.save();

    res.json({
      success: true,
      message: 'Checked in successfully',
      status: booking.status,
      isCheckedIn: booking.isCheckedIn,
      remainingHours: booking.remainingHours,
      location: {
        lat: booking.checkedInLat,
        lng: booking.checkedInLng,
        address: booking.checkedInAddress
      }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});
// routes/bookings.js - Check-out
router.post('/check-out/:bookingId', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { lat, lng } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // ✅ Must be checked in
    if (!booking.isCheckedIn) {
      return res.status(400).json({ error: 'Booking is not checked in' });
    }
    
    // ✅ Calculate hours used (since check-in)
    const checkInTime = booking.checkedInAt;
    const currentTime = new Date();
    const hoursUsedThisSession = Math.ceil((currentTime - checkInTime) / (1000 * 60 * 60));
    
    // ✅ Update total hours used
    booking.hoursUsed += hoursUsedThisSession;
    booking.remainingHours -= hoursUsedThisSession;
    
    // ✅ Get address
    let address = '';
    if (lat && lng) {
      const axios = require('axios');
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`
        );
        if (response.data && response.data.display_name) {
          address = response.data.display_name;
        }
      } catch (e) {
        address = `${lat}, ${lng}`;
      }
    }

    // ✅ Mark as checked out
    booking.isCheckedIn = false;
    booking.checkedOutAt = new Date();
    booking.checkedOutLat = lat || null;
    booking.checkedOutLng = lng || null;
    booking.checkedOutAddress = address || 'Location not available';
    
    // ✅ Add to check history
    booking.checkHistory.push({
      type: 'out',
      timestamp: new Date(),
      lat: lat || null,
      lng: lng || null,
      address: address || '',
      hoursUsed: booking.hoursUsed,
      remainingHours: booking.remainingHours
    });
    
    // ✅ Check if all hours used
    if (booking.remainingHours <= 0) {
      booking.status = 'completed'; // ✅ Completed if no hours left
    } else {
      booking.status = 'confirmed'; // ✅ Back to confirmed if still has hours
    }

    await booking.save();

    res.json({
      success: true,
      message: 'Checked out successfully',
      status: booking.status,
      isCheckedIn: booking.isCheckedIn,
      hoursUsed: booking.hoursUsed,
      remainingHours: booking.remainingHours,
      location: {
        lat: booking.checkedOutLat,
        lng: booking.checkedOutLng,
        address: booking.checkedOutAddress
      }
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
});



// ======================
// USER DASHBOARD DATA
// ======================
router.get('/user-dashboard', async (req, res) => {
  try {
    // Get user from headers
    const userString = req.headers.user ? JSON.parse(req.headers.user) : null;
    const userId = userString?._id || userString?.id || null;
    const userEmail = userString?.email || '';
    const userName = userString?.name || '';

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found. Please login again.'
      });
    }

    // 1. Get user's bookings
    const userBookings = await Booking.find({
      $or: [
        { userId: userId },
        { email: userEmail },
        { name: userName }
      ]
    }).populate('cabinId', 'name address pricePerHour');

    const totalBookings = userBookings.length;
    const totalSpent = userBookings.reduce((sum, b) => sum + (b.totalPrice || b.amount || 0), 0);

    // 2. Get user's cabins
    const userCabins = await Cabin.find({ owner: userId });
    const myCabinsCount = userCabins.length;

    // 3. Get cabin bookings (bookings on user's cabins)
    const cabinIds = userCabins.map(c => c._id.toString());
    const cabinBookings = await Booking.find({
      cabinId: { $in: cabinIds }
    }).populate('cabinId', 'name address');
    
    const cabinBookingsCount = cabinBookings.length;
    const cabinRevenue = cabinBookings.reduce((sum, b) => sum + (b.totalPrice || b.amount || 0), 0);

    // 4. Get all cabins (total available)
    const allCabins = await Cabin.find({});
    const totalCabins = allCabins.length;

    // 5. Get user's wallet
    const wallet = await Wallet.findOne({ ownerId: userId });
    const walletData = wallet ? {
      balance: wallet.balance || 0,
      totalEarned: wallet.totalEarned || 0,
      transactions: wallet.transactions?.length || 0,
      withdrawals: wallet.withdrawals?.length || 0
    } : {
      balance: 0,
      totalEarned: 0,
      transactions: 0,
      withdrawals: 0
    };

    // 6. Recent bookings (last 5)
    const recentBookings = userBookings
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(b => ({
        _id: b._id,
        name: b.name || 'User',
        email: b.email || 'N/A',
        cabinName: b.cabinId?.name || 'Workspace',
        amount: b.totalPrice || b.amount || 0,
        status: b.status,
        paymentStatus: b.paymentStatus,
        startDate: b.startDate,
        endDate: b.endDate,
        createdAt: b.createdAt
      }));

    // 7. Recent cabin bookings (bookings on user's cabins)
    const recentCabinBookings = cabinBookings
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(b => ({
        _id: b._id,
        name: b.name || 'User',
        email: b.email || 'N/A',
        cabinName: b.cabinId?.name || 'Workspace',
        amount: b.totalPrice || b.amount || 0,
        status: b.status,
        paymentStatus: b.paymentStatus,
        startDate: b.startDate,
        endDate: b.endDate,
        createdAt: b.createdAt
      }));

    // 8. Monthly booking chart data (user's bookings)
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyMap = {};
    userBookings.forEach(b => {
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
        // Stats
        totalBookings,
        totalSpent,
        myCabinsCount,
        cabinBookingsCount,
        cabinRevenue,
        totalCabins,
        // Wallet
        wallet: walletData,
        // Recent data
        recentBookings,
        recentCabinBookings,
        // Chart
        bookingChartData
      }
    });

  } catch (error) {
    console.error('User Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user dashboard data'
    });
  }
});


// ======================
// UPDATE PAYMENT STATUS (Admin/Owner) - WITH WALLET UPDATE & DETAILS
// ======================
router.put('/bookingpayment-status/:bookingId', upload.single('screenshot'), async (req, res) => {
  try {
    const { bookingId } = req.params;
    const {
      paymentStatus,
      amountPaid,
      paymentMode,
      transactionId,
      paymentDate,
      notes,
      // Card fields
      cardNumber,
      cardHolderName,
      cardExpiry,
      cardCVV,
      // UPI fields
      upiId,
      upiApp
    } = req.body;

    console.log("===== UPDATE PAYMENT STATUS =====");
    console.log("Booking ID:", bookingId);
    console.log("Payment Status:", paymentStatus);
    console.log("Amount Paid:", amountPaid);
    console.log("Payment Mode:", paymentMode);
    console.log("Transaction ID:", transactionId);
    console.log("Screenshot uploaded:", req.file ? 'Yes' : 'No');

    // Validate payment status
    if (!['pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment status. Must be pending, paid, failed, or refunded'
      });
    }

    // ✅ Find booking with populated cabin
    const booking = await Booking.findById(bookingId).populate('cabinId');
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    console.log("Booking found:", {
      id: booking._id,
      cabinId: booking.cabinId?._id,
      cabinOwner: booking.cabinId?.owner,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus
    });

    // Check if booking is cash/counter payment
    if (booking.paymentMethod !== 'cash' && booking.paymentMethod !== 'counter') {
      return res.status(400).json({
        success: false,
        error: 'Only cash/counter payment bookings can be manually updated'
      });
    }

    // If already paid, don't allow update
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Payment already completed'
      });
    }

    // Get the user making the update
    const userId = req.user?._id || req.user?.id;
    const user = await User.findById(userId);

    // Update payment status
    const oldStatus = booking.paymentStatus;
    booking.paymentStatus = paymentStatus;

    // Initialize payment details if not exists
    if (!booking.paymentDetails) {
      booking.paymentDetails = {};
    }

    // ✅ Update payment details
    if (paymentStatus === 'paid') {
      const amountToAdd = parseFloat(amountPaid) || booking.totalPrice || 0;

      // Update booking with payment details
      booking.amountPaid = amountToAdd;
      booking.transactionId = transactionId || booking.transactionId || `CASH_${Date.now()}`;
      booking.isPaidToOwner = true;

      // Update payment details object
      booking.paymentDetails.mode = paymentMode || 'cash';
      booking.paymentDetails.transactionId = transactionId || booking.transactionId;
      booking.paymentDetails.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
      booking.paymentDetails.notes = notes || null;
      booking.paymentDetails.updatedBy = userId;
      booking.paymentDetails.updatedAt = new Date();

      // Handle screenshot upload
      if (req.file) {
        const screenshotUrl = `/uploads/payments/${req.file.filename}`;
        booking.paymentDetails.screenshot = screenshotUrl;
      }

      // Card details
      if (paymentMode === 'card') {
        booking.paymentDetails.cardNumber = cardNumber ? `****${cardNumber.slice(-4)}` : null; // Store only last 4 digits for security
        booking.paymentDetails.cardHolderName = cardHolderName || null;
        booking.paymentDetails.cardExpiry = cardExpiry || null;
        booking.paymentDetails.cardCVV = cardCVV || null; // Store encrypted in production
        
        // Validate card details
        if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
          return res.status(400).json({
            success: false,
            error: 'Please enter a valid card number'
          });
        }
        if (!cardHolderName) {
          return res.status(400).json({
            success: false,
            error: 'Please enter card holder name'
          });
        }
        if (!cardExpiry) {
          return res.status(400).json({
            success: false,
            error: 'Please enter card expiry date'
          });
        }
      }

      // UPI details
      if (paymentMode === 'upi') {
        booking.paymentDetails.upiId = upiId || null;
        booking.paymentDetails.upiApp = upiApp || null;
        
        // Validate UPI details
        if (!upiId) {
          return res.status(400).json({
            success: false,
            error: 'Please enter UPI ID'
          });
        }
        if (!upiApp) {
          return res.status(400).json({
            success: false,
            error: 'Please select UPI app'
          });
        }
      }

      // ✅ Add to owner's wallet
      const cabin = booking.cabinId;
      if (!cabin) {
        console.error("❌ Cabin not found!");
        return res.status(404).json({
          success: false,
          error: 'Cabin not found for this booking'
        });
      }

      const ownerId = cabin.owner;
      console.log("Owner ID from cabin:", ownerId);
      console.log("Amount to add:", amountToAdd);

      if (!ownerId) {
        console.error("❌ Owner ID not found in cabin!");
        return res.status(400).json({
          success: false,
          error: 'Owner not found for this cabin'
        });
      }

      if (amountToAdd <= 0) {
        console.error("❌ Invalid amount:", amountToAdd);
        return res.status(400).json({
          success: false,
          error: 'Invalid amount to add'
        });
      }

      // ✅ Find or create wallet
      let wallet = await Wallet.findOne({ ownerId: ownerId });
      if (!wallet) {
        console.log("Creating new wallet for owner:", ownerId);
        wallet = new Wallet({
          ownerId: ownerId,
          balance: 0,
          totalEarned: 0,
          transactions: [],
          withdrawals: []
        });
      }

      // Prepare payment details for wallet transaction
      const walletPaymentDetails = {
        transactionId: transactionId || booking.transactionId,
        screenshot: booking.paymentDetails.screenshot || null
      };

      if (paymentMode === 'upi') {
        walletPaymentDetails.upiId = upiId;
        walletPaymentDetails.upiApp = upiApp;
      }
      if (paymentMode === 'card') {
        walletPaymentDetails.cardNumber = cardNumber ? `****${cardNumber.slice(-4)}` : null;
        walletPaymentDetails.cardHolderName = cardHolderName;
      }

      // ✅ Add transaction to wallet
      wallet.transactions.push({
        bookingId: booking._id,
        cabinId: booking.cabinId?._id,
        cabinName: cabin.name || 'Unknown Cabin',
        amount: amountToAdd,
        type: 'credit',
        description: `Booking #${booking._id.toString().slice(-6)} - ${cabin.name || 'Cabin'} (${paymentMode.toUpperCase()} Payment)`,
        customerName: booking.name || 'Customer',
        customerMobile: booking.mobile || 'N/A',
        startDate: booking.startDate,
        endDate: booking.endDate,
        transactionId: transactionId || booking.transactionId,
        paymentMode: paymentMode || 'cash',
        paymentDetails: walletPaymentDetails
      });

      // ✅ Update wallet balance
      wallet.balance = (wallet.balance || 0) + amountToAdd;
      wallet.totalEarned = (wallet.totalEarned || 0) + amountToAdd;
      wallet.updatedAt = new Date();

      await wallet.save();
      console.log("✅ Wallet updated successfully:", {
        ownerId: ownerId,
        amountAdded: amountToAdd,
        newBalance: wallet.balance,
        totalEarned: wallet.totalEarned
      });

    } else if (paymentStatus === 'refunded') {
      // Handle refund logic if needed
      booking.amountPaid = 0;
      booking.isPaidToOwner = false;
      booking.paymentDetails.notes = notes || 'Refunded';
      booking.paymentDetails.updatedBy = userId;
      booking.paymentDetails.updatedAt = new Date();
    }

    // Save booking
    await booking.save();
    console.log("✅ Booking updated with payment details");

    // Return the updated booking with masked sensitive data
    const responseBooking = booking.toObject();
    if (responseBooking.paymentDetails) {
      // Mask sensitive data in response
      if (responseBooking.paymentDetails.cardNumber) {
        responseBooking.paymentDetails.cardNumber = '****' + responseBooking.paymentDetails.cardNumber.slice(-4);
      }
      delete responseBooking.paymentDetails.cardCVV; // Never return CVV
    }

    res.json({
      success: true,
      message: `Payment status updated to ${paymentStatus}`,
      booking: {
        id: booking._id,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        totalPrice: booking.totalPrice,
        amountPaid: booking.amountPaid || booking.totalPrice,
        isPaidToOwner: booking.isPaidToOwner || false,
        paymentDetails: responseBooking.paymentDetails,
        transactionId: booking.transactionId
      }
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status: ' + error.message
    });
  }
});

// ======================
// UPDATE VISITING TIMINGS
// ======================
router.put('/update-timings/:bookingId', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { date, checkIn, checkOut } = req.body;

    console.log("===== UPDATE VISITING TIMINGS =====");
    console.log("Booking ID:", bookingId);
    console.log("Date:", date);
    console.log("Check In:", checkIn);
    console.log("Check Out:", checkOut);

    // Validate
    if (!date || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Date, check-in and check-out are required'
      });
    }

    // Find booking with populated cabin
    const booking = await Booking.findById(bookingId).populate('cabinId', 'owner');
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Get user ID from auth middleware
    const userId = req.user.id;

    // Check if user is the owner of the cabin
    if (!booking.cabinId || booking.cabinId.owner.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to update this booking'
      });
    }

    // Initialize visitingTimings if not exists
    if (!booking.visitingTimings) {
      booking.visitingTimings = [];
    }

    // ✅ Calculate hours difference for this timing
    const checkInTime = new Date(`${date}T${checkIn}`);
    const checkOutTime = new Date(`${date}T${checkOut}`);
    
    if (checkOutTime <= checkInTime) {
      return res.status(400).json({
        success: false,
        error: 'Check-out time must be after check-in time'
      });
    }

    const hoursDiff = (checkOutTime - checkInTime) / (1000 * 60 * 60);
    console.log("Hours for this visit:", hoursDiff);

    // ✅ Add new timing
    booking.visitingTimings.push({
      date: date,
      checkIn: checkIn,
      checkOut: checkOut,
      addedAt: new Date()
    });

    // ✅ Update hoursUsed and remainingHours
    booking.hoursUsed = (booking.hoursUsed || 0) + hoursDiff;
    booking.remainingHours = Math.max(0, (booking.totalHours || 0) - booking.hoursUsed);

    // ✅ If remainingHours is 0, update status to completed
    if (booking.remainingHours <= 0) {
      booking.status = 'completed';
      booking.remainingHours = 0;
      console.log("✅ Booking completed - all hours used");
    }

    booking.updatedAt = new Date();
    await booking.save();

    console.log("✅ Timing added successfully:", {
      bookingId: booking._id,
      totalTimings: booking.visitingTimings.length,
      hoursUsed: booking.hoursUsed,
      remainingHours: booking.remainingHours,
      status: booking.status
    });

    res.json({
      success: true,
      message: 'Timing added successfully',
      booking: {
        id: booking._id,
        visitingTimings: booking.visitingTimings,
        hoursUsed: booking.hoursUsed,
        remainingHours: booking.remainingHours,
        totalHours: booking.totalHours,
        status: booking.status
      }
    });

  } catch (error) {
    console.error('Update timings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update timings: ' + error.message
    });
  }
});

// ======================
// DELETE VISITING TIMING
// ======================
router.put('/delete-timing/:bookingId', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { timingIndex } = req.body;

    console.log("Booking ID:", bookingId);
    console.log("Timing Index:", timingIndex);

    if (timingIndex === undefined || timingIndex === null) {
      return res.status(400).json({
        success: false,
        error: 'Timing index is required'
      });
    }

    // Find booking with populated cabin
    const booking = await Booking.findById(bookingId).populate('cabinId', 'owner');
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // ✅ Get user ID from auth middleware
    const userId = req.user.id;

    // Check if user is the owner of the cabin
    if (!booking.cabinId || booking.cabinId.owner.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to update this booking'
      });
    }

    // Check if timing exists
    if (!booking.visitingTimings || booking.visitingTimings.length <= timingIndex) {
      return res.status(400).json({
        success: false,
        error: 'Timing entry not found'
      });
    }

    // ✅ Get the timing being deleted to subtract hours
    const deletedTiming = booking.visitingTimings[timingIndex];
    const checkInTime = new Date(`${deletedTiming.date}T${deletedTiming.checkIn}`);
    const checkOutTime = new Date(`${deletedTiming.date}T${deletedTiming.checkOut}`);
    const hoursToSubtract = (checkOutTime - checkInTime) / (1000 * 60 * 60);

    // Remove timing
    booking.visitingTimings.splice(timingIndex, 1);

    // ✅ Update hoursUsed and remainingHours
    booking.hoursUsed = Math.max(0, (booking.hoursUsed || 0) - hoursToSubtract);
    booking.remainingHours = (booking.totalHours || 0) - booking.hoursUsed;

    // ✅ If remainingHours > 0 and status was completed, revert to confirmed
    if (booking.remainingHours > 0 && booking.status === 'completed') {
      booking.status = 'confirmed';
    }

    booking.updatedAt = new Date();
    await booking.save();

    console.log("✅ Timing deleted successfully:", {
      bookingId: booking._id,
      remainingTimings: booking.visitingTimings.length,
      hoursUsed: booking.hoursUsed,
      remainingHours: booking.remainingHours,
      status: booking.status
    });

    res.json({
      success: true,
      message: 'Timing deleted successfully',
      booking: {
        id: booking._id,
        visitingTimings: booking.visitingTimings,
        hoursUsed: booking.hoursUsed,
        remainingHours: booking.remainingHours,
        totalHours: booking.totalHours,
        status: booking.status
      }
    });

  } catch (error) {
    console.error('Delete timing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete timing: ' + error.message
    });
  }
});


module.exports = router;
