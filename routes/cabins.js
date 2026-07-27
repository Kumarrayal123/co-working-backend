const express = require("express");
const router = express.Router();
const Cabin = require("../model/cabin");
const multer = require("multer");
const path = require("path");
const auth = require("../middleware/auth");
const CabinOrder = require('../model/CabinOrder');
const Query = require('../model/Query');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_BxtRNvflG06PTV',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'RecEtdcenmR7Lm4AIEwo4KFr',
});

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ============================================
// 🔥 SPECIFIC ROUTES - SABSE PEHLE (TOP PAR)
// ============================================

// ======================
// 1. GET ALL CABIN PAYMENTS (Admin) - FIXED
// ======================
router.get('/all-cabinpayments', async (req, res) => {
  try {
    const orders = await CabinOrder.find()
      .populate({
        path: 'cabin',
        populate: {
          path: 'owner',
          model: 'User',
          select: 'name email mobile organizationName gstNumber address'
        }
      })
      .sort({ createdAt: -1 });

    const now = new Date();
    for (let order of orders) {
      if (order.status === 'active' && order.expiryDate < now) {
        order.status = 'expired';
        await order.save();
        
        if (order.cabin) {
          await Cabin.findByIdAndUpdate(order.cabin._id, {
            isActive: false,
            hasActiveOrder: false,
            currentOrder: null
          });
        }
      }
    }

    const stats = {
      total: orders.length,
      active: orders.filter(o => o.status === 'active').length,
      expired: orders.filter(o => o.status === 'expired').length,
      totalAmount: orders.reduce((sum, o) => sum + o.amount, 0),
      totalPayments: orders.reduce((sum, o) => sum + (o.paymentCount || 1), 0)
    };

    // ✅ LOG to check if data is coming
    console.log("First order owner:", orders[0]?.cabin?.owner);

    res.status(200).json({
      success: true,
      orders: orders,
      stats: stats
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cabin payments'
    });
  }
});



// ─── 2. GET ALL QUERIES ───
router.get('/allqueries', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const queries = await Query.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Query.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: queries,
      pagination: {
        total,
        page: parseInt(page),
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get all queries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch queries',
      error: error.message
    });
  }
});


// ======================
// 2. GET MY CABIN PAYMENTS - SPECIFIC ROUTE
// ======================
router.get('/my-cabinpayments', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await CabinOrder.find({ owner: userId })
      .populate('cabin')
      .sort({ createdAt: -1 });

    const now = new Date();
    for (let order of orders) {
      if (order.status === 'active' && order.expiryDate < now) {
        order.status = 'expired';
        await order.save();
        
        if (order.cabin) {
          await Cabin.findByIdAndUpdate(order.cabin._id, {
            isActive: false,
            hasActiveOrder: false,
            currentOrder: null
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      orders: orders,
      stats: {
        total: orders.length,
        active: orders.filter(o => o.status === 'active').length,
        expired: orders.filter(o => o.status === 'expired').length,
        totalAmount: orders.reduce((sum, o) => sum + o.amount, 0)
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    });
  }
});

// ======================
// 3. GET USER CABINS - SPECIFIC ROUTE
// ======================
router.get("/user", auth, async (req, res) => {
  try {
    console.log("Fetching cabins for user:", req.user.id);

    const cabins = await Cabin.find({ owner: req.user.id })
      .sort({ createdAt: -1 }); // Latest first

    console.log("Found cabins count:", cabins.length);

    res.json(cabins);
  } catch (err) {
    console.error("Error fetching user cabins:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================
// 4. GET ALL CABINS - SPECIFIC ROUTE
// ======================
router.get("/", async (req, res) => {
  try {
    const cabins = await Cabin.find().sort({ createdAt: -1 });
    res.json(cabins);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ======================
// 5. CREATE CABIN - POST (With auth middleware)
// ======================
router.post("/", auth, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 }
]), async (req, res) => {
  try {
    console.log("═══════════════════════════════════════");
    console.log("📦 ADD CABIN REQUEST STARTED");
    console.log("═══════════════════════════════════════");

    // ✅ Get user from req.user (set by auth middleware)
    const userId = req.user?.id;
    const userRole = req.user?.role || 'user';
    
    console.log("👤 Authenticated User:");
    console.log("  - ID:", userId);
    console.log("  - Role:", userRole);

    if (!userId) {
      console.log("❌ No user ID found in request");
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please login."
      });
    }

    console.log("✅ Using authenticated user ID:", userId);

    // ─── REST OF THE CODE ───
    const { 
      name, description, capacity, address, price, cabinType,
      openTime, closeTime, is24x7,
      isChamber
    } = req.body;

    // Parse JSON fields
    let amenities = req.body.amenities ? JSON.parse(req.body.amenities) : {};
    let pricingPlans = req.body.pricingPlans ? JSON.parse(req.body.pricingPlans) : [];
    let seats = req.body.seats ? JSON.parse(req.body.seats) : [];

    const images = req.files?.images?.map((file) => file.path) || [];
    const videos = req.files?.videos?.map((file) => file.path) || [];

    // ─── VALIDATE REQUIRED FIELDS ───
    if (!name || !capacity || !price || !address) {
      console.log("❌ Missing required fields:", { name, capacity, price, address });
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields" 
      });
    }

    // ─── VALIDATE SEATS ───
    if (!seats || seats.length === 0) {
      console.log("❌ No seats provided");
      return res.status(400).json({
        success: false,
        error: "At least one seat is required for the cabin"
      });
    }

    // ─── VALIDATE SEAT COUNT MATCHES CAPACITY ───
    const capacityNum = Number(capacity);
    if (seats.length !== capacityNum) {
      console.log(`❌ Seat count mismatch: ${seats.length} seats vs ${capacityNum} capacity`);
      return res.status(400).json({
        success: false,
        error: `Number of seats (${seats.length}) does not match capacity (${capacityNum})`
      });
    }

    console.log("📋 Cabin Data:");
    console.log("   ├─ Name:", name);
    console.log("   ├─ Address:", address);
    console.log("   ├─ Price:", price);
    console.log("   ├─ Capacity:", capacity);
    console.log("   ├─ Seats:", seats.length);
    console.log("   ├─ Type:", cabinType || 'normal');
    console.log("   └─ Images:", images.length);

    // ─── CREATE CABIN ───
    const newCabin = new Cabin({
      owner: userId,
      name,
      description: description || '',
      capacity: capacityNum,
      address,
      price: Number(price),
      cabinType: cabinType || 'normal',
      amenities,
      pricingPlans,
      seats: seats || [],
      images,
      videos,
      openTime: is24x7 === 'true' ? '00:00' : (openTime || '09:00'),
      closeTime: is24x7 === 'true' ? '23:59' : (closeTime || '21:00'),
      is24x7: is24x7 === 'true' || false,
      isChamber: isChamber === 'true' || false,
      isActive: true,
      hasActiveOrder: false,
    });

    await newCabin.save();
    console.log("✅ Cabin saved successfully!");
    console.log("   ├─ Cabin ID:", newCabin._id);
    console.log("   ├─ Owner ID:", newCabin.owner);
    console.log("   └─ Name:", newCabin.name);
    console.log("═════════════════════════════════════════════");

    res.status(201).json({
      success: true,
      message: "Cabin added successfully",
      cabin: newCabin,
      ownerInfo: {
        ownerId: userId,
        source: "🔵 AUTHENTICATED USER",
        role: userRole
      }
    });

  } catch (error) {
    console.error("❌ ADD CABIN ERROR:");
    console.error("   ├─ Message:", error.message);
    console.error("   └─ Stack:", error.stack);
    console.log("═════════════════════════════════════════════");
    
    res.status(500).json({ 
      success: false,
      error: "Failed to create cabin",
      details: error.message 
    });
  }
});

// ======================
// 6. CREATE CABIN ORDER (With auth middleware)
// ======================
router.post('/createcabinorder', auth, async (req, res) => {
  try {
    const { cabinId } = req.body;

    console.log("═══════════════════════════════════════");
    console.log("📦 CREATE CABIN ORDER REQUEST STARTED");
    console.log("═══════════════════════════════════════");

    // ✅ Get user from req.user (set by auth middleware)
    const userId = req.user?.id;
    const userRole = req.user?.role || 'user';
    
    console.log("👤 Authenticated User:");
    console.log("  - ID:", userId);
    console.log("  - Role:", userRole);

    if (!userId) {
      console.log("❌ No user ID found in request");
      return res.status(401).json({
        success: false,
        error: "Authentication required. Please login."
      });
    }

    // ─── FIND CABIN ───
    const cabin = await Cabin.findById(cabinId);
    if (!cabin) {
      console.log("❌ Cabin not found:", cabinId);
      return res.status(404).json({ 
        success: false,
        error: 'Cabin not found'
      });
    }

    console.log('✅ Cabin found:', { 
      cabinId: cabin._id, 
      name: cabin.name,
      cabinOwner: cabin.owner
    });

    // ─── DETERMINE OWNER ───
    let ownerId;
    let ownerSource;

    // First check if cabin has an owner
    if (!cabin.owner) {
      console.log("❌ Cabin has no owner!");
      return res.status(400).json({
        success: false,
        error: 'Cabin has no owner assigned. Please contact admin.'
      });
    }

    // Check if user owns this cabin
    if (cabin.owner.toString() === userId.toString()) {
      ownerId = userId;
      ownerSource = `🔵 LOGGED IN USER (${userRole}) - Owns cabin`;
      console.log("✅ User owns this cabin:", ownerId);
    } else {
      // User doesn't own this cabin - use cabin's owner
      ownerId = cabin.owner;
      ownerSource = "🟡 USING CABIN'S OWNER (User doesn't own cabin)";
      console.log("⚠️ User doesn't own cabin, using cabin's owner:", ownerId);
      console.log("⚠️ User ID:", userId);
      console.log("⚠️ Cabin Owner:", cabin.owner);
    }

    console.log("🏷️ FINAL OWNER ID:", ownerId);
    console.log("📌 SOURCE:", ownerSource);

    // ─── CHECK EXISTING ORDERS ───
    const existingOrder = await CabinOrder.findOne({
      cabin: cabinId,
      status: 'active',
      paymentStatus: 'completed'
    });

    if (existingOrder) {
      console.log("⚠️ Active order already exists");
      return res.status(400).json({ 
        success: false,
        error: 'Cabin already has an active order'
      });
    }

    const pendingOrder = await CabinOrder.findOne({
      cabin: cabinId,
      paymentStatus: 'pending'
    });

    if (pendingOrder) {
      console.log("⚠️ Pending order exists:", pendingOrder.razorpayOrderId);
      return res.status(400).json({ 
        success: false,
        error: 'Payment already initiated. Please complete the payment.',
        orderId: pendingOrder.razorpayOrderId
      });
    }

    // ─── CALCULATE AMOUNT ───
    const GST_RATE = 0.18;
    const userCabins = await Cabin.find({ owner: ownerId });
    const isFirstCabin = userCabins.length === 0;
    const baseAmount = isFirstCabin ? 2000 : 1000;
    const gstAmount = baseAmount * GST_RATE;
    const totalAmount = baseAmount + gstAmount;

    console.log('💰 Amount:', { baseAmount, gstAmount, totalAmount, isFirstCabin });

    // ─── CREATE RAZORPAY ORDER ───
    const options = {
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `cabin_${Date.now().toString().slice(-8)}`,
      notes: {
        cabinId: cabinId.toString(),
        userId: ownerId.toString(),
        isFirstCabin: isFirstCabin.toString()
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);
    console.log("✅ Razorpay order created:", razorpayOrder.id);

    // ─── SET EXPIRY ───
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    // ─── SAVE ORDER ───
    const order = new CabinOrder({
      cabin: cabinId,
      owner: ownerId,
      baseAmount: baseAmount,
      gstAmount: gstAmount,
      amount: totalAmount,
      gstRate: GST_RATE,
      paymentStatus: 'pending',
      razorpayOrderId: razorpayOrder.id,
      startDate: new Date(),
      expiryDate: expiryDate,
      status: 'active',
      isFirstCabin: isFirstCabin
    });

    await order.save();
    console.log("✅ Order saved to database:", order._id);

    // ─── UPDATE CABIN ───
    await Cabin.findByIdAndUpdate(cabinId, {
      $set: { expiryDate: expiryDate }
    });
    console.log("✅ Cabin expiry updated:", expiryDate);

    console.log("─────────────────────────────────────────────");
    console.log("📤 ORDER CREATED SUCCESSFULLY");
    console.log("─────────────────────────────────────────────");
    console.log("   🆔 Order ID:", order._id);
    console.log("   👤 Owner ID:", ownerId);
    console.log("   💰 Amount: ₹", totalAmount);
    console.log("   📅 Expiry:", expiryDate);
    console.log("─────────────────────────────────────────────");
    console.log("═════════════════════════════════════════════");

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        id: order._id,
        razorpayOrderId: razorpayOrder.id,
        baseAmount: baseAmount,
        gstAmount: gstAmount,
        amount: totalAmount,
        currency: 'INR',
        expiryDate: order.expiryDate,
        isFirstCabin: isFirstCabin
      },
      razorpayKey: process.env.RAZORPAY_KEY_ID || 'rzp_test_BxtRNvflG06PTV'
    });

  } catch (error) {
    console.error('❌ Create order error:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create cabin order: ' + error.message
    });
  }
});

// ======================
// 7. VERIFY RAZORPAY PAYMENT (Public - No auth needed)
// ======================
router.post('/verify-cabin-payment', async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      cabinId 
    } = req.body;

    console.log('═══════════════════════════════════════');
    console.log('🔐 VERIFY PAYMENT REQUEST STARTED');
    console.log('═══════════════════════════════════════');
    console.log('📋 Payment Details:');
    console.log('   ├─ Order ID:', razorpay_order_id);
    console.log('   ├─ Payment ID:', razorpay_payment_id);
    console.log('   └─ Cabin ID:', cabinId || 'Not provided');

    // ✅ VERIFY SIGNATURE
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'RecEtdcenmR7Lm4AIEwo4KFr')
      .update(body.toString())
      .digest('hex');

    console.log('🔑 Signature Verification:');
    console.log('   ├─ Expected:', expectedSignature);
    console.log('   └─ Received:', razorpay_signature);

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      console.error('❌ Payment verification failed - Invalid signature');
      return res.status(400).json({ 
        success: false,
        error: 'Payment verification failed - Invalid signature' 
      });
    }

    console.log('✅ Signature verified successfully');

    // ✅ FIND ORDER
    const order = await CabinOrder.findOne({ 
      razorpayOrderId: razorpay_order_id
    });
    
    console.log('📦 Order found:', order ? order._id : '❌ NOT FOUND');

    if (!order) {
      console.error('❌ Order not found:', razorpay_order_id);
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    console.log('📋 Order Details:');
    console.log('   ├─ Cabin ID:', order.cabin);
    console.log('   ├─ Owner ID:', order.owner);
    console.log('   ├─ Amount:', order.amount);
    console.log('   └─ Status:', order.paymentStatus);

    // ✅ GENERATE TRANSACTION ID
    if (!order.transactionId) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      order.transactionId = `TXN${timestamp}${random}`;
      console.log('📝 Generated Transaction ID:', order.transactionId);
    }

    // ✅ UPDATE ORDER STATUS
    order.paymentStatus = 'completed';
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.paidAt = new Date();
    await order.save();
    console.log('✅ Order payment status updated to COMPLETED');

    // ✅ UPDATE CABIN
    const cabin = await Cabin.findById(order.cabin);
    if (cabin) {
      cabin.isActive = true;
      cabin.hasActiveOrder = true;
      cabin.currentOrder = order._id;
      cabin.expiryDate = order.expiryDate;
      await cabin.save();
      console.log('✅ Cabin updated:', cabin._id, cabin.name);
      console.log('   ├─ isActive:', cabin.isActive);
      console.log('   ├─ hasActiveOrder:', cabin.hasActiveOrder);
      console.log('   └─ Expiry Date:', cabin.expiryDate);
    } else {
      console.log('⚠️ Cabin not found for update:', order.cabin);
    }

    console.log('─────────────────────────────────────────────');
    console.log('📤 RESPONSE SUMMARY');
    console.log('─────────────────────────────────────────────');
    console.log('   ✅ Success: true');
    console.log('   🏷️ Transaction ID:', order.transactionId);
    console.log('   💰 Amount: ₹', order.amount);
    console.log('   📅 Expiry Date:', order.expiryDate);
    console.log('─────────────────────────────────────────────');
    console.log('═════════════════════════════════════════════');
    console.log('✅ PAYMENT VERIFICATION COMPLETED');
    console.log('═════════════════════════════════════════════');

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      transactionId: order.transactionId,
      order: {
        id: order._id,
        baseAmount: order.baseAmount,
        gstAmount: order.gstAmount,
        amount: order.amount,
        gstRate: order.gstRate,
        transactionId: order.transactionId,
        expiryDate: order.expiryDate
      }
    });

  } catch (error) {
    console.error('═════════════════════════════════════════');
    console.error('❌ VERIFY PAYMENT ERROR');
    console.error('═════════════════════════════════════════');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('═════════════════════════════════════════');
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify payment: ' + error.message 
    });
  }
});


// ======================
// 8. RENEW PAYMENT
// ======================
router.post('/renew-payment', auth, async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    const order = await CabinOrder.findOne({ _id: orderId, owner: userId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'active' && new Date(order.expiryDate) > new Date()) {
      return res.status(400).json({ error: 'Cabin is already active' });
    }

    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + 30);

    order.status = 'active';
    order.expiryDate = newExpiryDate;
    order.startDate = new Date();
    order.paymentStatus = 'completed';
    order.paymentCount = (order.paymentCount || 0) + 1;
    await order.save();

    if (order.cabin) {
      await Cabin.findByIdAndUpdate(order.cabin, {
        isActive: true,
        hasActiveOrder: true,
        currentOrder: order._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cabin renewed successfully',
      amount: order.amount,
      newExpiryDate: newExpiryDate,
      paymentCount: order.paymentCount
    });

  } catch (error) {
    console.error('Renew payment error:', error);
    res.status(500).json({ error: 'Failed to renew cabin' });
  }
});

// ============================================
// 🟢 GENERIC ROUTES (ID WALE) - SABSE NICHE
// ============================================

// ======================
// 9. GET CABIN BY ID (GENERIC - :id) - SABSE NICHE
// ======================
router.get("/:id", async (req, res) => {
  try {
    const cabin = await Cabin.findById(req.params.id);
    if (!cabin) {
      return res.status(404).json({ error: "Cabin not found" });
    }
    res.json(cabin);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ======================
// 10. UPDATE CABIN (GENERIC - :id)
// ======================
router.put("/:id", upload.array("images", 5), async (req, res) => {
  try {
    console.log("=== UPDATE CABIN REQUEST STARTED ===");
    console.log("Cabin ID:", req.params.id);
    console.log("User from Token:", req.user);
    console.log("Request Body:", req.body);

    const cabin = await Cabin.findById(req.params.id);

    if (!cabin) {
      return res.status(404).json({ message: "Cabin not found" });
    }

    // ✅ DEFAULT ADMIN ID
    const DEFAULT_ADMIN_ID = "68ebe9ee8f06d33ee022d665";
    
    // ✅ CHECK AUTHORIZATION - If user is authenticated and not admin, check ownership
    const isAdmin = req.user && req.user.id === DEFAULT_ADMIN_ID;
    const isOwner = req.user && cabin.owner && cabin.owner.toString() === req.user.id;
    
    // If user is authenticated but not admin and not owner, deny access
    if (req.user && req.user.id && !isAdmin && !isOwner) {
      console.log("❌ Unauthorized: User is not admin or owner");
      return res.status(403).json({ 
        message: "Not authorized to update this cabin" 
      });
    }

    // If no user is authenticated (admin via frontend without login), allow update
    // but only if the cabin owner is the default admin
    if (!req.user || !req.user.id) {
      console.log("⚠️ No authenticated user. Checking if cabin owner is default admin...");
      if (cabin.owner && cabin.owner.toString() !== DEFAULT_ADMIN_ID) {
        console.log("❌ Cabin owner is not default admin. Update denied.");
        return res.status(403).json({ 
          message: "Not authorized to update this cabin" 
        });
      }
      console.log("✅ Cabin owner is default admin. Allowing update.");
    }

    const { name, description, capacity, address, price, cabinType } = req.body;

    // ✅ UPDATE BASIC FIELDS
    cabin.name = name || cabin.name;
    cabin.description = description || cabin.description;
    cabin.capacity = capacity || cabin.capacity;
    cabin.address = address || cabin.address;
    cabin.cabinType = cabinType || cabin.cabinType || 'normal';

    // ✅ UPDATE AMENITIES
    if (req.body.amenities) {
      try {
        cabin.amenities = JSON.parse(req.body.amenities);
      } catch (e) {
        console.error("❌ Error parsing amenities:", e);
        return res.status(400).json({ message: "Invalid amenities format" });
      }
    }

    // ✅ UPDATE PRICING PLANS
    if (req.body.pricingPlans) {
      try {
        const plans = JSON.parse(req.body.pricingPlans);
        cabin.pricingPlans = plans;
      } catch (e) {
        console.error("❌ Error parsing pricingPlans:", e);
        return res.status(400).json({ message: "Invalid pricingPlans format" });
      }
    }

    // ✅ UPDATE SEATS
    if (req.body.seats) {
      try {
        const seats = JSON.parse(req.body.seats);
        if (seats && seats.length > 0) {
          // Validate seats
          const seatNumbers = seats.map(s => s.number);
          const uniqueNumbers = new Set(seatNumbers);
          if (seatNumbers.length !== uniqueNumbers.size) {
            return res.status(400).json({ message: "Seat numbers must be unique" });
          }
          
          for (let seat of seats) {
            if (!seat.name || !seat.number) {
              return res.status(400).json({ message: "Each seat must have name and number" });
            }
            if (seat.number < 1) {
              return res.status(400).json({ message: "Seat number must be greater than 0" });
            }
          }
          
          // Check if seat count matches capacity
          if (seats.length !== Number(cabin.capacity)) {
            return res.status(400).json({ 
              message: `Number of seats (${seats.length}) does not match capacity (${cabin.capacity})` 
            });
          }
          
          cabin.seats = seats;
        } else {
          cabin.seats = [];
        }
      } catch (e) {
        console.error("❌ Error parsing seats:", e);
        return res.status(400).json({ message: "Invalid seats format" });
      }
    }

    // ✅ UPDATE PRICE
    if (price !== undefined && price !== null && price !== "") {
      cabin.price = Number(price) || 0;
    } else if (cabin.pricingPlans && cabin.pricingPlans.length > 0 && !cabin.price) {
      cabin.price = Math.min(...cabin.pricingPlans.map((p) => Number(p.cost) || 0));
    }

    // ✅ UPDATE IMAGES
    if (req.files && req.files.length > 0) {
      cabin.images = req.files.map((file) => file.path);
    }

    // ✅ UPDATE ISACTIVE (if provided)
    if (req.body.isActive !== undefined && req.body.isActive !== null) {
      cabin.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    }

    console.log("Saving updated cabin...");
    await cabin.save();
    console.log("✅ Cabin updated successfully!");

    res.json({ 
      success: true,
      message: "Cabin updated successfully", 
      cabin 
    });
  } catch (err) {
    console.error("❌ UPDATE CABIN ERROR:", err);
    res.status(500).json({ 
      message: "Server error",
      error: err.message 
    });
  }
});
// ======================
// 11. DELETE CABIN (GENERIC - :id)
// ======================
router.delete("/:id", async (req, res) => {
  try {
    const cabin = await Cabin.findById(req.params.id);

    if (!cabin) {
      return res.status(404).json({ message: "Cabin not found" });
    }

    await cabin.deleteOne();

    res.json({ 
      success: true,
      message: "Cabin deleted successfully" 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



// routes/cabins.js - Complete routes

// ======================
// DELETE CABIN ORDER (Check order exists)
// ======================
router.delete('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Check if order exists
    const order = await CabinOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }
    
    await order.deleteOne();
    
    res.json({ 
      success: true, 
      message: 'Order deleted successfully' 
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete order' 
    });
  }
});

// ======================
// UPDATE CABIN ORDER STATUS (Check order exists)
// ======================
router.put('/order-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    // Check valid status
    const validStatuses = ['active', 'expired', 'pending', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Allowed: active, expired, pending, cancelled' 
      });
    }
    
    // Check if order exists
    const order = await CabinOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }
    
    // Update status
    order.status = status;
    await order.save();
    
    res.json({ 
      success: true, 
      message: `Status updated to ${status}`,
      order: {
        id: order._id,
        status: order.status,
        cabin: order.cabin,
        amount: order.amount
      }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update status' 
    });
  }
});



// ─── 1. SEND QUERY (CREATE) ───
router.post('/sendquery', async (req, res) => {
  try {
    const { name, email, phone, address, message } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone and message are required fields'
      });
    }

    const query = new Query({
      name,
      email,
      phone,
      address: address || '',
      message
    });

    await query.save();

    res.status(201).json({
      success: true,
      message: 'Query submitted successfully! We will contact you soon.',
      data: query
    });
  } catch (error) {
    console.error('Create query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit query',
      error: error.message
    });
  }
});


// ─── 3. UPDATE QUERY STATUS ───
router.patch('/updatequery/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['pending', 'read', 'replied', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed: pending, read, replied, closed'
      });
    }

    const query = await Query.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Query status updated to ${status}`,
      data: query
    });
  } catch (error) {
    console.error('Update query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update query',
      error: error.message
    });
  }
});

// ─── 4. DELETE QUERY ───
router.delete('/deletequery/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = await Query.findByIdAndDelete(id);

    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Query deleted successfully'
    });
  } catch (error) {
    console.error('Delete query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete query',
      error: error.message
    });
  }
});

module.exports = router;