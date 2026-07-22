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
// 5. CREATE CABIN - POST
// ======================
router.post("/", upload.array("images", 5), async (req, res) => {
  try {
    console.log("=== ADD CABIN REQUEST STARTED ===");
    console.log("User from Token:", req.user);
    console.log("Request Body:", req.body);
    console.log("Files:", req.files);

    const { name, description, capacity, address, price, cabinType } = req.body;

    // ✅ PARSE AMENITIES
    let amenities = {};
    try {
      amenities = req.body.amenities ? JSON.parse(req.body.amenities) : {};
    } catch (parseError) {
      console.error("❌ Error parsing amenities:", parseError);
      return res.status(400).json({ message: "Invalid amenities format" });
    }

    // ✅ PARSE PRICING PLANS
    let pricingPlans = [];
    try {
      pricingPlans = req.body.pricingPlans ? JSON.parse(req.body.pricingPlans) : [];
    } catch (parseError) {
      console.error("❌ Error parsing pricingPlans:", parseError);
      return res.status(400).json({ message: "Invalid pricingPlans format" });
    }

    // ✅ PARSE SEATS (Optional)
    let seats = [];
    try {
      seats = req.body.seats ? JSON.parse(req.body.seats) : [];
    } catch (parseError) {
      console.error("❌ Error parsing seats:", parseError);
      return res.status(400).json({ message: "Invalid seats format" });
    }

    // ✅ SEATS ARE OPTIONAL - Only validate if seats provided
    if (seats && seats.length > 0) {
      if (seats.length !== Number(capacity)) {
        console.error(`❌ Seat count (${seats.length}) doesn't match capacity (${capacity})`);
        return res.status(400).json({ 
          message: `Number of seats (${seats.length}) does not match capacity (${capacity})` 
        });
      }

      const seatNumbers = seats.map(s => s.number);
      const uniqueNumbers = new Set(seatNumbers);
      if (seatNumbers.length !== uniqueNumbers.size) {
        console.error("❌ Duplicate seat numbers found");
        return res.status(400).json({ message: "Seat numbers must be unique" });
      }

      for (let seat of seats) {
        if (!seat.name || !seat.number) {
          console.error("❌ Invalid seat data:", seat);
          return res.status(400).json({ message: "Each seat must have name and number" });
        }
        if (seat.number < 1) {
          console.error("❌ Invalid seat number:", seat.number);
          return res.status(400).json({ message: "Seat number must be greater than 0" });
        }
      }
    }

    const images = req.files?.map((file) => file.path) || [];

    if (!name || !capacity || !price || !address) {
      console.error("❌ Missing required fields:", { name, capacity, price, address });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // ✅ GET OWNER ID - DEFAULT ADMIN ID IF NOT AUTHENTICATED
    const DEFAULT_ADMIN_ID = "68ebe9ee8f06d33ee022d665";
    
    let ownerId;
    if (req.user && req.user.id) {
      ownerId = req.user.id;
      console.log("✅ Using authenticated user as owner:", ownerId);
    } else {
      // ✅ Use default admin ID if no user found
      ownerId = DEFAULT_ADMIN_ID;
      console.log("⚠️ No authenticated user found. Using default admin ID:", ownerId);
    }

    const newCabin = new Cabin({
      owner: ownerId,
      name,
      description,
      capacity: Number(capacity),
      address,
      price: Number(price),
      cabinType: cabinType || 'normal',
      amenities,
      pricingPlans,
      seats: seats || [],
      images,
      isActive: true,
      hasActiveOrder: true,
    });

    console.log("Saving new cabin to database...");
    console.log("Owner ID:", ownerId);
    console.log("Seats being saved:", seats);
    await newCabin.save();
    console.log("✅ Cabin saved successfully!");

    res.status(201).json({
      success: true,
      message: "Cabin added successfully",
      cabin: newCabin
    });

  } catch (error) {
    console.error("❌ ADD CABIN ERROR:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to create cabin",
      details: error.message 
    });
  }
});


// ======================
// 6. CREATE CABIN ORDER WITH RAZORPAY (With GST)
// ======================
router.post('/createcabinorder', auth, async (req, res) => {
  try {
    const { cabinId } = req.body;
    const userId = req.user.id;

    const cabin = await Cabin.findOne({ _id: cabinId, owner: userId });
    if (!cabin) {
      return res.status(404).json({ error: 'Cabin not found' });
    }

    const existingOrder = await CabinOrder.findOne({
      cabin: cabinId,
      status: 'active',
      paymentStatus: 'completed'
    });

    if (existingOrder) {
      return res.status(400).json({ error: 'Cabin already has an active order' });
    }

    const pendingOrder = await CabinOrder.findOne({
      cabin: cabinId,
      paymentStatus: 'pending'
    });

    if (pendingOrder) {
      return res.status(400).json({ 
        error: 'Payment already initiated. Please complete the payment.',
        orderId: pendingOrder.razorpayOrderId
      });
    }

    // ✅ Calculate amount with GST
    const GST_RATE = 0.18; // 18% GST
    const userCabins = await Cabin.find({ owner: userId });
    const isFirstCabin = userCabins.length === 0;
    const baseAmount = isFirstCabin ? 2000 : 1000;
    const gstAmount = baseAmount * GST_RATE;
    const totalAmount = baseAmount + gstAmount;

    console.log('💰 Amount Breakdown:', {
      baseAmount,
      gstAmount,
      totalAmount,
      isFirstCabin
    });

    const shortReceipt = `cabin_${Date.now().toString().slice(-8)}`;
    
    const options = {
      amount: Math.round(totalAmount * 100), // Convert to paise and round
      currency: 'INR',
      receipt: shortReceipt,
      notes: {
        cabinId: cabinId.toString(),
        userId: userId.toString(),
        isFirstCabin: isFirstCabin.toString(),
        baseAmount: baseAmount.toString(),
        gstAmount: gstAmount.toString(),
        totalAmount: totalAmount.toString(),
        gstRate: '18%'
      }
    };

    console.log('Razorpay Options:', options);

    const razorpayOrder = await razorpay.orders.create(options);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    // ✅ Store all amounts with GST
    const order = new CabinOrder({
      cabin: cabinId,
      owner: userId,
      baseAmount: baseAmount,      // ✅ Store base amount
      gstAmount: gstAmount,        // ✅ Store GST amount
      amount: totalAmount,         // ✅ Total amount with GST
      gstRate: GST_RATE,           // ✅ Store GST rate
      paymentStatus: 'pending',
      razorpayOrderId: razorpayOrder.id,
      startDate: new Date(),
      expiryDate: expiryDate,
      status: 'active',
      isFirstCabin: isFirstCabin
    });

    await order.save();


    // ✅ Save expiry date in Cabin collection also
await Cabin.findByIdAndUpdate(cabinId, {
  $set: {
    expiryDate: expiryDate
  }
});

    res.status(201).json({
      success: true,
      message: 'Order created. Please complete payment.',
      order: {
        id: order._id,
        razorpayOrderId: razorpayOrder.id,
        baseAmount: baseAmount,
        gstAmount: gstAmount,
        amount: totalAmount,
        currency: 'INR',
        expiryDate: order.expiryDate,
        isFirstCabin: isFirstCabin,
        gstRate: '18%'
      },
      razorpayKey: process.env.RAZORPAY_KEY_ID || 'rzp_test_BxtRNvflG06PTV'
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create cabin order: ' + error.message });
  }
});

// ======================
// 7. VERIFY RAZORPAY PAYMENT
// ======================
router.post('/verify-cabin-payment', auth, async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      cabinId 
    } = req.body;

    console.log('Verifying payment:', {
      razorpay_order_id,
      razorpay_payment_id,
      cabinId
    });

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'RecEtdcenmR7Lm4AIEwo4KFr')
      .update(body.toString())
      .digest('hex');

    console.log('Expected signature:', expectedSignature);
    console.log('Received signature:', razorpay_signature);

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({ 
        success: false,
        error: 'Payment verification failed - Invalid signature' 
      });
    }

    const order = await CabinOrder.findOne({ 
      razorpayOrderId: razorpay_order_id
    });
    
    console.log('Found order:', order);

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    if (!order.transactionId) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      order.transactionId = `TXN${timestamp}${random}`;
    }

    order.paymentStatus = 'completed';
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.paidAt = new Date();
    await order.save();

const cabin = await Cabin.findById(order.cabin);

if (cabin) {
  cabin.isActive = true;
  cabin.hasActiveOrder = true;
  cabin.currentOrder = order._id;
  cabin.expiryDate = order.expiryDate; // ✅ Save expiry date
  await cabin.save();
}

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
    console.error('Verify payment error:', error);
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