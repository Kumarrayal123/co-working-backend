const express = require("express");
const router = express.Router();
const Cabin = require("../model/cabin");
const multer = require("multer");
const path = require("path");
const auth = require("../middleware/auth");

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // folder to save images
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });



router.post("/", auth, upload.array("images", 5), async (req, res) => {
  try {
    const { name, description, capacity, address, price } = req.body;

    const images = req.files.map((file) => file.path);

    const newCabin = new Cabin({
      owner: req.user.id,     // ⭐ correct field
      name,
      description,
      capacity,
      address,
      price,
      images,
    });

    await newCabin.save();
    res.status(201).json({ message: "Cabin added successfully", cabin: newCabin });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get Cabin by Id
router.get("/:id", async (req, res) => {
  try {
    const cabin = await Cabin.findById(req.params.id);
    res.json(cabin);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.get("/user", auth, async (req, res) => {
  try {
    console.log("Fetching cabins for user:", req.user.id);
    const cabins = await Cabin.find({ owner: req.user.id });
    console.log("Found cabins count:", cabins.length);
    if (cabins.length > 0) {
      console.log("Sample cabin owner:", cabins[0].owner);
    }

    // Check if the owner field is ObjectId or String in DB
    // This debug will help verify schema alignment

    res.json(cabins);
  } catch (err) {
    console.error("Error fetching user cabins:", err);
    res.status(500).json({ message: "Server error" });
  }
});







// GET ALL CABINS
router.get("/", async (req, res) => {
  try {
    const cabins = await Cabin.find().sort({ createdAt: -1 });
    res.json(cabins);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;



