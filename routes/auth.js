
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
// // router.get("/users", async (req, res) => {
// //   try {
// //     const users = await User.find({}, "-password"); // hide password
// //     res.json(users);
// //   } catch (err) {
// //     console.log("GET USERS ERROR:", err);
// //     res.status(500).json({ message: "Server error" });
// //   }
// // });


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
      const { 
        name, 
        email, 
        password, 
        mobile, 
        address, 
        role,
        organizationName,
        gstNumber,
        panNumber
      } = req.body;

      const hashedPassword = await bcrypt.hash(password, 10);

      const isDoctor = role === "doctor";
      const isCafe = role === "cafe";
      const isCabinOwner = role === "cabinOwner";

      const userData = {
        name,
        email,
        password: hashedPassword,
        mobile,
        address,
        role: role || "user",
        status: (isDoctor || isCafe || isCabinOwner) ? "pending" : "active",
        organizationName: organizationName || "",
        gstNumber: gstNumber || "",
        panNumber: panNumber || "",
        isDoctor: isDoctor || false,
        isCafe: isCafe || false,
        isCabinOwner: isCabinOwner || false
      };

      // Handle document uploads
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
      else if (isCafe || isCabinOwner) {
        // Cafe and Cabin Owner - allow PAN card upload
        if (req.files?.panCard?.[0]) {
          userData.panCard = req.files.panCard[0].path.replace(/\\/g, "/");
          userData.panCardStatus = "pending";
        }
      } 
      else {
        // Regular user - allow PAN card upload if provided
        if (req.files?.panCard?.[0]) {
          userData.panCard = req.files.panCard[0].path.replace(/\\/g, "/");
          userData.panCardStatus = "pending";
        }
      }

      const user = new User(userData);
      await user.save();

      let successMessage = "Registration successful. You can login now.";
      if (isDoctor) {
        successMessage = "Doctor registered successfully. Wait for admin approval.";
      } else if (isCafe) {
        successMessage = "Cafe registered successfully. Wait for admin approval.";
      } else if (isCabinOwner) {
        successMessage = "Cabin Owner registered successfully. Wait for admin approval.";
      }

      res.json({
        message: successMessage,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        }
      });

    } catch (err) {
      console.error("Registration Error:", err);
      res.status(500).json({ 
        message: err.message || "Registration failed. Please try again." 
      });
    }
  }
);


// ============================================
// 1. FORGOT PASSWORD - VERIFY EMAIL
// ============================================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address"
      });
    }

    res.json({
      success: true,
      message: "Email verified successfully",
      email: user.email
    });

  } catch (err) {
    console.error("❌ Forgot Password Error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to verify email"
    });
  }
});

// ============================================
// 2. RESET PASSWORD - UPDATE PASSWORD
// ============================================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully! You can now login with your new password."
    });

  } catch (err) {
    console.error("❌ Reset Password Error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to reset password"
    });
  }
});



// ============================================
// UPDATE DOCTOR PROFILE API - WITH ALL DOCUMENTS
// ============================================
router.put(
  "/profile/:userId",
  upload.fields([
    { name: "adharCard", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "mbbsCertificate", maxCount: 1 },
    { name: "pmcRegistration", maxCount: 1 },
    { name: "nmrId", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const {
        name,
        email,
        mobile,
        address,
        organizationName,
        gstNumber,
        dmhoNumber,
        panNumber,
        specialization,
        qualification,
        experience,
        licenseNumber,
        hospitalAffiliation,
        consultationFee,
        availableDays,
        availableTimeStart,
        availableTimeEnd
      } = req.body;

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // ============================================
      // UPDATE TEXT FIELDS
      // ============================================
      const updateData = {};

      // Personal Information
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (mobile) updateData.mobile = mobile;
      if (address) updateData.address = address;

      // Organization Details
      if (organizationName !== undefined) updateData.organizationName = organizationName;
      if (gstNumber !== undefined) updateData.gstNumber = gstNumber;
      if (dmhoNumber !== undefined) updateData.dmhoNumber = dmhoNumber;
      if (panNumber !== undefined) updateData.panNumber = panNumber;

      // Doctor Specific Fields
      if (specialization !== undefined) updateData.specialization = specialization;
      if (qualification !== undefined) updateData.qualification = qualification;
      if (experience !== undefined) updateData.experience = experience;
      if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber;
      if (hospitalAffiliation !== undefined) updateData.hospitalAffiliation = hospitalAffiliation;
      if (consultationFee !== undefined) updateData.consultationFee = consultationFee;
      if (availableDays !== undefined) updateData.availableDays = availableDays;
      if (availableTimeStart !== undefined) updateData.availableTimeStart = availableTimeStart;
      if (availableTimeEnd !== undefined) updateData.availableTimeEnd = availableTimeEnd;

      // ============================================
      // UPDATE DOCUMENT FILES
      // ============================================
      const fields = [
        { key: "adharCard", statusKey: "adharCardStatus" },
        { key: "panCard", statusKey: "panCardStatus" },
        { key: "mbbsCertificate", statusKey: "mbbsCertificateStatus" },
        { key: "pmcRegistration", statusKey: "pmcRegistrationStatus" },
        { key: "nmrId", statusKey: "nmrIdStatus" }
      ];

      // Helper function to delete old file
      const deleteOldFile = (filePath) => {
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`Deleted old file: ${filePath}`);
          } catch (err) {
            console.error(`Error deleting file: ${filePath}`, err);
          }
        }
      };

      // Check each field for new file upload
      fields.forEach(({ key, statusKey }) => {
        if (req.files && req.files[key] && req.files[key].length > 0) {
          const newFilePath = req.files[key][0].path.replace(/\\/g, "/");
          
          // Delete old file if exists
          if (user[key]) {
            deleteOldFile(user[key]);
          }
          
          // Update with new file path
          updateData[key] = newFilePath;
          
          // Set status to 'pending' for admin verification
          updateData[statusKey] = "pending";
          console.log(`📄 ${key} uploaded, status set to pending`);
        }
      });

      // ============================================
      // UPDATE USER
      // ============================================
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      // ============================================
      // RESPONSE
      // ============================================
      res.json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser
      });

    } catch (err) {
      console.error("❌ Update Profile Error:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Failed to update profile"
      });
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
    const { email, password, isDoctor } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // ❌ PASSWORD VERIFICATION REMOVED - Sirf email check
    // const isMatch = await bcrypt.compare(password, user.password);
    // if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // If isDoctor is sent from frontend and user is a doctor, update the database
    if (isDoctor === true) {
      await User.findByIdAndUpdate(user._id, { isDoctor: true });
      user.isDoctor = true;
    }

    // Return user data including _id and isDoctor
    res.json({
      message: "Login Successful",
      token: jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      ),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        address: user.address,
        isDoctor: user.isDoctor || false,
        role: user.role || "user"
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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



// Get User Profile by ID
router.get("/profile/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({
      success: true,
      user: user
    });
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
