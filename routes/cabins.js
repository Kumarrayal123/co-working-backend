// const express = require("express");
// const router = express.Router();
// const Cabin = require("../model/cabin");
// const multer = require("multer");
// const path = require("path");
// const auth = require("../middleware/auth");

// // Multer setup
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads/"); // folder to save images
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + path.extname(file.originalname));
//   },
// });

// const upload = multer({ storage });



// router.post("/", auth, upload.array("images", 5), async (req, res) => {
//   try {
//     const { name, description, capacity, address, price } = req.body;

//     const images = req.files.map((file) => file.path);

//     const newCabin = new Cabin({
//       owner: req.user.id,     // ⭐ correct field
//       name,
//       description,
//       capacity,
//       address,
//       price,
//       images,
//     });

//     await newCabin.save();
//     res.status(201).json({ message: "Cabin added successfully", cabin: newCabin });

//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // Get Cabin by Id
// router.get("/:id", async (req, res) => {
//   try {
//     const cabin = await Cabin.findById(req.params.id);
//     res.json(cabin);
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });


// router.get("/user", auth, async (req, res) => {
//   try {
//     console.log("Fetching cabins for user:", req.user.id);
//     const cabins = await Cabin.find({ owner: req.user.id });
//     console.log("Found cabins count:", cabins.length);
//     if (cabins.length > 0) {
//       console.log("Sample cabin owner:", cabins[0].owner);
//     }

//     // Check if the owner field is ObjectId or String in DB
//     // This debug will help verify schema alignment

//     res.json(cabins);
//   } catch (err) {
//     console.error("Error fetching user cabins:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });







// // GET ALL CABINS
// router.get("/", async (req, res) => {
//   try {
//     const cabins = await Cabin.find().sort({ createdAt: -1 });
//     res.json(cabins);
//   } catch (err) {
//     res.status(500).json({ message: "Server error" });
//   }
// });

// module.exports = router;


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
router.post("/", auth, upload.array("images", 5), async (req, res) => {
  try {
    console.log("Add Cabin Request Body:", req.body);
    console.log("Add Cabin User:", req.user);
    console.log("Add Cabin Files:", req.files);

    const { name, description, capacity, address, price } = req.body;

    const images = req.files.map((file) => file.path);

    const newCabin = new Cabin({
      owner: req.user.id, // ✅ correct
      name,
      description,
      capacity,
      address,
      price,
      images,
    });

    await newCabin.save();

    res.status(201).json({
      message: "Cabin added successfully",
      cabin: newCabin,
    });
  } catch (err) {
    console.log("ADD CABIN ERROR:", err); // Explicitly log the error
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
    const { name, description, capacity, address, price } = req.body;

    const cabin = await Cabin.findById(req.params.id);

    if (!cabin) {
      return res.status(404).json({ message: "Cabin not found" });
    }

    // ✅ Owner check
    if (cabin.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Update fields
    cabin.name = name || cabin.name;
    cabin.description = description || cabin.description;
    cabin.capacity = capacity || cabin.capacity;
    cabin.address = address || cabin.address;
    cabin.price = price || cabin.price;

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
router.delete("/:id", auth, async (req, res) => {
  try {
    const cabin = await Cabin.findById(req.params.id);

    if (!cabin) {
      return res.status(404).json({ message: "Cabin not found" });
    }

    // ✅ Owner check
    if (cabin.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await cabin.deleteOne();

    res.json({ message: "Cabin deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;



