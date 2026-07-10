const express = require("express");
const router = express.Router();
const Booking = require("../model/Booking");
const User = require("../model/User");
const Cabin = require("../model/cabin");
const auth = require("../middleware/auth");
const Wallet = require('../model/Wallet');
const Razorpay = require('razorpay');
const crypto = require('crypto');  // ✅ ADD THIS LINE

console.log("Bookings route file loaded successfully");



// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_BxtRNvflG06PTV',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'RecEtdcenmR7Lm4AIEwo4KFr',
});


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

// routes/bookings.js - Create Booking (Updated)
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
      paymentMethod = "online" // ✅ Add this
    } = req.body;

    const cabin = await Cabin.findById(cabinId);
    if (!cabin) {
      return res.status(404).json({ error: "Cabin not found" });
    }

    const ownerId = cabin.owner;

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

      const existingBookings = await Booking.find({ 
        cabinId,
        bookingBasis: { $ne: "plan" },
        status: { $nin: ['cancelled', 'completed'] }
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

    // ======================
    // CREATE RAZORPAY ORDER (Only for online payment)
    // ======================
    let razorpayOrder = null;
    if (paymentMethod === 'online') {
      razorpayOrder = await razorpay.orders.create({
        amount: calculatedTotalPrice * 100,
        currency: 'INR',
        receipt: `booking_${Date.now()}`,
        notes: {
          cabinId: cabinId,
          userId: userId
        }
      });
    }

    // ======================
    // CREATE BOOKING
    // ======================
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
      totalPrice: calculatedTotalPrice,
      bookingBasis,
      selectedPlan,
      paymentMethod: paymentMethod, // ✅ Store payment method
      remainingHours: calculatedTotalHours,
      hoursUsed: 0
    };

    // If counter payment, set status to confirmed directly
    if (paymentMethod === 'counter') {
      bookingData.status = 'confirmed';
      bookingData.paymentStatus = 'pending';
      bookingData.transactionId = `COUNTER_${Date.now()}`;
    } else {
      bookingData.status = 'pending';
      bookingData.paymentStatus = 'pending';
      bookingData.razorpayOrderId = razorpayOrder.id;
      bookingData.transactionId = razorpayOrder.id;
    }

    const booking = new Booking(bookingData);
    await booking.save();

    // ======================
    // RESPONSE
    // ======================
    if (paymentMethod === 'counter') {
      // Counter booking response - no Razorpay
      res.status(201).json({
        success: true,
        message: "Booking confirmed! Please pay at the counter.",
        booking: {
          id: booking._id,
          cabinName: cabin.name,
          totalPrice: booking.totalPrice,
          totalHours: booking.totalHours,
          remainingHours: booking.remainingHours,
          status: booking.status,
          paymentMethod: booking.paymentMethod
        }
      });
    } else {
      // Online booking response - with Razorpay
      res.status(201).json({
        success: true,
        message: "Booking created. Please complete payment.",
        booking: {
          id: booking._id,
          cabinName: cabin.name,
          totalPrice: booking.totalPrice,
          totalHours: booking.totalHours,
          remainingHours: booking.remainingHours,
          status: booking.status,
          paymentMethod: booking.paymentMethod
        },
        razorpay: {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: process.env.RAZORPAY_KEY_ID || 'rzp_test_BxtRNvflG06PTV'
        }
      });
    }

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
          select: "name email mobile address"
        }
      })
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



// routes/bookings.js - Add this route
// ======================
// UPDATE BOOKING STATUS
// ======================
router.put("/update-status/:bookingId", auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
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
// GET ALL WALLETS (Admin)
// ======================
router.get('/all-wallets', async (req, res) => {
  try {
    const wallets = await Wallet.find()
      .populate('ownerId', 'name email mobile address')
      .sort({ createdAt: -1 });

    const stats = {
      totalWallets: wallets.length,
      totalBalance: wallets.reduce((sum, w) => sum + w.balance, 0),
      totalEarned: wallets.reduce((sum, w) => sum + w.totalEarned, 0),
      totalTransactions: wallets.reduce((sum, w) => sum + w.transactions.length, 0),
      activeWallets: wallets.filter(w => w.balance > 0).length,
      zeroBalanceWallets: wallets.filter(w => w.balance === 0).length
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
// GET ALL WITHDRAWALS (NO AUTH)
// ======================
router.get('/all-withdrawals', async (req, res) => {
  try {
    // Find all wallets and populate owner details
    const wallets = await Wallet.find({})
      .populate('ownerId', 'name email mobile address')
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
          walletBalance: wallet.balance
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
// UPDATE PAYMENT STATUS (Admin/Owner)
// ======================
router.put('/bookingpayment-status/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { paymentStatus } = req.body;

    // Validate payment status
    if (!['pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment status. Must be pending, paid, failed, or refunded'
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId).populate('cabinId', 'name owner');
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if booking is counter payment (only counter payments can be manually updated)
    if (booking.paymentMethod !== 'counter') {
      return res.status(400).json({
        success: false,
        error: 'Only counter payment bookings can be manually updated'
      });
    }

    // If already paid, don't allow update
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Payment already completed'
      });
    }

    // Update payment status
    const oldStatus = booking.paymentStatus;
    booking.paymentStatus = paymentStatus;

    // If marking as paid, add to owner's wallet
    if (paymentStatus === 'paid' && oldStatus !== 'paid') {
      // Add to owner's wallet
      const cabin = await Cabin.findById(booking.cabinId);
      if (cabin && booking.totalPrice > 0) {
        let wallet = await Wallet.findOne({ ownerId: booking.ownerId });
        if (!wallet) {
          wallet = new Wallet({
            ownerId: booking.ownerId,
            balance: 0,
            totalEarned: 0,
            transactions: []
          });
        }

        wallet.transactions.push({
          bookingId: booking._id,
          cabinId: booking.cabinId,
          cabinName: cabin.name,
          amount: booking.totalPrice,
          type: 'credit',
          description: `Booking #${booking._id.toString().slice(-6)} - ${cabin.name} (Counter Payment)`,
          customerName: booking.name,
          customerMobile: booking.mobile,
          startDate: booking.startDate,
          endDate: booking.endDate,
          transactionId: booking.transactionId || `COUNTER_${Date.now()}`
        });

        wallet.balance += booking.totalPrice;
        wallet.totalEarned += booking.totalPrice;
        await wallet.save();
      }

      // Update booking transaction ID if not present
      if (!booking.transactionId) {
        booking.transactionId = `COUNTER_PAID_${Date.now()}`;
      }
    }

    await booking.save();

    res.json({
      success: true,
      message: `Payment status updated to ${paymentStatus}`,
      booking: {
        id: booking._id,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        totalPrice: booking.totalPrice
      }
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status'
    });
  }
});


module.exports = router;
