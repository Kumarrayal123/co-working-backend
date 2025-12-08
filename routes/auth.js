
// const express = require("express");
// const router = express.Router();
// const bcrypt = require("bcryptjs");
// const User = require("../model/User");

// // REGISTER
// // router.post("/register", async (req, res) => {
// //   try {
// //     const { name, email, password, mobile, address } = req.body;

// //     const existing = await User.findOne({ email });
// //     if (existing)
// //       return res.status(400).json({ message: "User already exists" });

// //     const hashedPassword = await bcrypt.hash(password, 10);

// //     const user = new User({
// //       name,
// //       email,
// //       password: hashedPassword,
// //       mobile,
// //       address,
// //     });

// //     await user.save();

// //     res.json({ message: "Registration Successful" });
// //   } catch (err) {
// //     console.log("REGISTER ERROR:", err);
// //     res.status(500).json({ message: "Server error" });
// //   }
// // });

// router.post("/register", async (req, res) => {
//   try {
//     const {
//       name,
//       email,
//       password,
//       mobile,
//       address,
//       adharCard,
//       panCard,
//       mbbsCertificate,
//       pmcRegistration,
//       nmrId
//     } = req.body;

//     const existing = await User.findOne({ email });
//     if (existing) return res.status(400).json({ message: "User already exists" });

//     const hash = await bcrypt.hash(password, 10);

//     const newUser = new User({
//       name,
//       email,
//       password: hash,
//       mobile,
//       address,
//       adharCard,
//       panCard,
//       mbbsCertificate,
//       pmcRegistration,
//       nmrId,
//       status: "pending"
//     });

//     await newUser.save();
//     res.json({ message: "Registration successful. Wait for admin approval." });

//   } catch (err) {
//     res.status(500).json({ message: "Server error" });
//   }
// });




// // LOGIN
// // router.post("/login", async (req, res) => {
// //   try {
// //     const { email, password } = req.body;

// //     const user = await User.findOne({ email });
// //     if (!user) return res.status(400).json({ message: "User not found" });

// //     const isMatch = await bcrypt.compare(password, user.password);
// //     if (!isMatch) return res.status(400).json({ message: "Incorrect password" });

// //     res.json({
// //       message: "Login Successful",
// //       user: {
// //         name: user.name,
// //         email: user.email,
// //         mobile: user.mobile,
// //         address: user.address,
// //       },
// //     });
// //   } catch (err) {
// //     console.log("LOGIN ERROR:", err);
// //     res.status(500).json({ message: "Server error" });
// //   }
// // });
// router.post("/login", async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email });
//     if (!user) return res.status(400).json({ message: "User not found" });

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

//     // Return user data including _id
//     res.json({
//       message: "Login Successful",
//       user: {
//         _id: user._id,         // ✅ Include MongoDB _id
//         name: user.name,
//         email: user.email,
//         mobile: user.mobile,
//         address: user.address
//       }
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });



// // GET ALL USERS
// router.get("/users", async (req, res) => {
//   try {
//     const users = await User.find({}, "-password"); // hide password
//     res.json(users);
//   } catch (err) {
//     console.log("GET USERS ERROR:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });


// module.exports = router;



const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../model/User");

// REGISTER
// const multer = require("multer");
// const upload = multer({ dest: "uploads/" });

// router.post(
//   "/register",
//   upload.fields([
//     { name: "adharCard", maxCount: 1 },
//     { name: "panCard", maxCount: 1 },
//     { name: "mbbsCertificate", maxCount: 1 },
//     { name: "pmcRegistration", maxCount: 1 },
//     { name: "nmrId", maxCount: 1 }
//   ]),
//   async (req, res) => {
//     try {
//       const { name, email, password, mobile, address } = req.body;

//       const files = req.files;

//       const user = new User({
//         name,
//         email,
//         password,
//         mobile,
//         address,
//         adharCard: files.adharCard[0].path,
//         panCard: files.panCard[0].path,
//         mbbsCertificate: files.mbbsCertificate[0].path,
//         pmcRegistration: files.pmcRegistration[0].path,
//         nmrId: files.nmrId[0].path
//       });

//       await user.save();
//       res.json({ message: "User registered successfully", user });

//     } catch (err) {
//       res.status(500).json({ message: err.message });
//     }
//   }
// );

const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const jwt = require("jsonwebtoken");

router.post(
  "/register",
  upload.fields([
    { name: "adharCard", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "mbbsCertificate", maxCount: 1 },
    { name: "pmcRegistration", maxCount: 1 },
    { name: "nmrId", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { name, email, password, mobile, address } = req.body;

      // const user = new User({
      //   name,
      //   email,
      //   password,
      //   mobile,
      //   address,
      //   adharCard: req.files?.adharCard?.[0]?.path || null,
      //   panCard: req.files?.panCard?.[0]?.path || null,
      //   mbbsCertificate: req.files?.mbbsCertificate?.[0]?.path || null,
      //   pmcRegistration: req.files?.pmcRegistration?.[0]?.path || null,
      //   nmrId: req.files?.nmrId?.[0]?.path || null,
      // });
     const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
  name,
  email,
  password: hashedPassword,
  mobile,
  address,
  adharCard: req.files?.adharCard?.[0]?.path.replace(/\\/g, "/") || null,
  panCard: req.files?.panCard?.[0]?.path.replace(/\\/g, "/") || null,
  mbbsCertificate: req.files?.mbbsCertificate?.[0]?.path.replace(/\\/g, "/") || null,
  pmcRegistration: req.files?.pmcRegistration?.[0]?.path.replace(/\\/g, "/") || null,
  nmrId: req.files?.nmrId?.[0]?.path.replace(/\\/g, "/") || null,
});


      await user.save();
      res.json({ message: "User registered successfully", user });

    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);


// All Users
router.get("/all-users", async (req, res) => {
  try {
    const users = await User.find().select("-password").lean();

    const formattedUsers = users.map((u) => ({
      ...u,
      documents: [
        u.adharCard,
        u.panCard,
        u.mbbsCertificate,
        u.pmcRegistration,
        u.nmrId,
      ].filter(Boolean), // removes null or undefined
    }));

    res.json(formattedUsers);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Incorrect password" });

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




module.exports = router;
