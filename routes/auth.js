
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
      const { name, email, password, mobile, address, role } = req.body;

      const hashedPassword = await bcrypt.hash(password, 10);

      const isDoctor = role === "doctor";

      const userData = {
        name,
        email,
        password: hashedPassword,
        mobile,
        address,
        role: role || "user",
        status: isDoctor ? "pending" : "active"
      };

      if (isDoctor) {
        userData.adharCard = req.files?.adharCard?.[0]?.path.replace(/\\/g, "/") || null;
        userData.panCard = req.files?.panCard?.[0]?.path.replace(/\\/g, "/") || null;
        userData.mbbsCertificate = req.files?.mbbsCertificate?.[0]?.path.replace(/\\/g, "/") || null;
        userData.pmcRegistration = req.files?.pmcRegistration?.[0]?.path.replace(/\\/g, "/") || null;
        userData.nmrId = req.files?.nmrId?.[0]?.path.replace(/\\/g, "/") || null;

        userData.adharCardStatus = "pending";
        userData.panCardStatus = "pending";
        userData.mbbsCertificateStatus = "pending";
        userData.pmcRegistrationStatus = "pending";
        userData.nmrIdStatus = "pending";
      }

      const user = new User(userData);
      await user.save();

      res.json({
        message: isDoctor
          ? "Doctor registered successfully. Wait for admin approval."
          : "Registration successful. You can login now.",
        user
      });

    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);


// Get all registered users
router.get("/all", async (req, res) => {
  try {
    const users = await User.find().select("-password"); // hide password
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});







// All Users


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



// Update Document and User Status
router.put("/update-status/:userId", async (req, res) => {
  try {
    const { userId } = req.params; // Get userId from params
    const {
      adharCardStatus,
      panCardStatus,
      mbbsCertificateStatus,
      pmcRegistrationStatus,
      nmrIdStatus,
      status // Overall user status
    } = req.body; // Get the status updates from the request body

    // Validate the input statuses
    const validStatuses = ["pending", "approved", "rejected"];
    const statusUpdates = {};

    // Validate and set the individual document statuses
    if (adharCardStatus && validStatuses.includes(adharCardStatus)) {
      statusUpdates.adharCardStatus = adharCardStatus;
    }
    if (panCardStatus && validStatuses.includes(panCardStatus)) {
      statusUpdates.panCardStatus = panCardStatus;
    }
    if (mbbsCertificateStatus && validStatuses.includes(mbbsCertificateStatus)) {
      statusUpdates.mbbsCertificateStatus = mbbsCertificateStatus;
    }
    if (pmcRegistrationStatus && validStatuses.includes(pmcRegistrationStatus)) {
      statusUpdates.pmcRegistrationStatus = pmcRegistrationStatus;
    }
    if (nmrIdStatus && validStatuses.includes(nmrIdStatus)) {
      statusUpdates.nmrIdStatus = nmrIdStatus;
    }

    // Validate and set the overall user status
    // Allow "active" as a valid status for the user
    const validUserStatuses = ["pending", "approved", "rejected", "active"];
    if (status && validUserStatuses.includes(status)) {
      statusUpdates.status = status; // Update user status if provided
    }

    // Check if any valid statuses are passed in the request
    if (Object.keys(statusUpdates).length === 0) {
      return res.status(400).json({ message: "No valid status provided for update." });
    }

    // Find user and update the status fields
    const user = await User.findByIdAndUpdate(userId, statusUpdates, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "User status updated successfully", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});




module.exports = router;
