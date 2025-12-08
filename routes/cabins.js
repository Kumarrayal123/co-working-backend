const express = require("express");
const router = express.Router();
const Cabin = require("../model/cabin");
const multer = require("multer");
const path = require("path");

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

// CREATE CABIN
// router.post("/", upload.array("images", 5), async (req, res) => {
//   try {
//     const { name, description, capacity, address } = req.body;
//     const images = req.files.map((file) => file.path); // save paths in DB

//     const newCabin = new Cabin({
//       name,
//       description,
//       capacity,
//       address,
//       images,
//     });

//     await newCabin.save();
//     res.status(201).json({ message: "Cabin added successfully", cabin: newCabin });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });


// router.post("/", upload.array("images", 5), async (req, res) => {
//   try {
//     const { name, description, capacity, address, userId } = req.body;
//     const images = req.files.map((file) => file.path);

//     const newCabin = new Cabin({
//       name,
//       description,
//       capacity,
//       address,
//       images,
//       userId,   // ⭐ save user id
//     });

//     await newCabin.save();
//     res.status(201).json({ message: "Cabin added successfully", cabin: newCabin });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

router.post("/", upload.array("images", 5), async (req, res) => {
  try {
    const { name, description, capacity, address, userId } = req.body;

    const images = req.files.map((file) => file.path);

    const newCabin = new Cabin({
      name,
      description,
      capacity,
      address,
      images,
      userId
    });

    await newCabin.save();
    res.status(201).json({ message: "Cabin added successfully", cabin: newCabin });
  } catch (err) {
    console.log(err);
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

// router.get("/user/:Id", async (req, res) => {
//   try {
//     const cabins = await Cabin.find({ userId: req.params.userId }).sort({ createdAt: -1 });
//     res.json(cabins);
//   } catch (err) {
//     res.status(500).json({ message: "Server error" });
//   }
// });

router.get("/", async (req, res) => {
  try {
    const cabins = await Cabin.find().sort({ createdAt: -1 });
    res.json(cabins);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;



