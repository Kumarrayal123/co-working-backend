


const express = require("express");
const router = express.Router();
const Cabin = require("../model/cabin");
const multer = require("multer");
const path = require("path");
const auth = require("../middleware/auth");

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


// ======================
// CREATE CABIN
// ======================
router.post("/", upload.array("images", 5), async (req, res) => {
  try {
    console.log("=== ADD CABIN REQUEST STARTED ===");

    const { name, description, capacity, address, price } = req.body;

    let amenities = {};
    try {
      amenities = req.body.amenities ? JSON.parse(req.body.amenities) : {};
    } catch (parseError) {
      return res.status(400).json({ message: "Invalid amenities format" });
    }

    // Parse pricing plans
    let pricingPlans = [];
    try {
      pricingPlans = req.body.pricingPlans ? JSON.parse(req.body.pricingPlans) : [];
    } catch (e) {
      return res.status(400).json({ message: "Invalid pricingPlans format" });
    }

    const images = req.files?.map((file) => file.path) || [];

    if (!name || !capacity || !address) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const derivedPrice = price !== undefined
      ? Number(price) || 0
      : (pricingPlans.length > 0 ? Math.min(...pricingPlans.map((p) => Number(p.cost) || 0)) : 0);

    // Use admin ID if no auth, otherwise use user ID from token
    const ownerId = req.user?.id || "68ebe9ee8f06d33ee022d665";

    const newCabin = new Cabin({
      owner: ownerId,
      name,
      description,
      capacity,
      address,
      price: derivedPrice,
      pricingPlans,
      amenities,
      images,
    });

    await newCabin.save();
    console.log("✅ Cabin saved successfully!");

    res.status(201).json({
      message: "Cabin added successfully",
      cabin: newCabin,
    });
  } catch (err) {
    console.error("❌ ADD CABIN ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



// ======================
// ⭐ GET USER CABINS (IMPORTANT – MUST BE ABOVE /:id)
// ======================
router.get("/user", auth, async (req, res) => {
  try {
    console.log("Fetching cabins for user:", req.user.id);

    const cabins = await Cabin.find({ owner: req.user.id });

    console.log("Found cabins count:", cabins.length);

    res.json(cabins);
  } catch (err) {
    console.error("Error fetching user cabins:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ======================
// GET CABIN BY ID
// ======================
router.get("/:id", async (req, res) => {
  try {
    const cabin = await Cabin.findById(req.params.id);
    res.json(cabin);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// ======================
// GET ALL CABINS
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
// UPDATE CABIN
// ======================
router.put("/:id", auth, upload.array("images", 5), async (req, res) => {
  try {
    const cabin = await Cabin.findById(req.params.id);

    if (!cabin) {
      return res.status(404).json({ message: "Cabin not found" });
    }

    if (cabin.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { name, description, capacity, address, price } = req.body;

    cabin.name = name || cabin.name;
    cabin.description = description || cabin.description;
    cabin.capacity = capacity || cabin.capacity;
    cabin.address = address || cabin.address;

    if (req.body.amenities) {
      cabin.amenities = JSON.parse(req.body.amenities);
    }

    // Update pricing plans if provided
    if (req.body.pricingPlans) {
      try {
        const plans = JSON.parse(req.body.pricingPlans);
        cabin.pricingPlans = plans;
      } catch (e) {
        return res.status(400).json({ message: "Invalid pricingPlans format" });
      }
    }

    if (price !== undefined) {
      cabin.price = Number(price) || 0;
    } else if (cabin.pricingPlans && cabin.pricingPlans.length > 0 && !cabin.price) {
      cabin.price = Math.min(...cabin.pricingPlans.map((p) => Number(p.cost) || 0));
    }

    if (req.files && req.files.length > 0) {
      cabin.images = req.files.map((file) => file.path);
    }

    await cabin.save();

    res.json({ message: "Cabin updated successfully", cabin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// ======================
// DELETE CABIN
// ======================
router.delete("/:id", async (req, res) => {
  try {
    const cabin = await Cabin.findById(req.params.id);

    if (!cabin) {
      return res.status(404).json({ message: "Cabin not found" });
    }

    // Skip owner check for admin (no auth)
    await cabin.deleteOne();

    res.json({ message: "Cabin deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;



