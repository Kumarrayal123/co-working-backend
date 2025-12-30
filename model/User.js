// const mongoose = require("mongoose");

// const userSchema = new mongoose.Schema({
//     name: { type: String, required: true },
//     email: { type: String, required: true, unique: true },
//     password: { type: String, required: true },
//     mobile: { type: String, required: true },
//     address: { type: String, required: true },
// });

// module.exports = mongoose.model("User", userSchema);


const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, },
  email: { type: String, },
  password: { type: String, },
  mobile: { type: String, },
  address: { type: String, },
  role: { type: String, enum: ["user", "doctor"], default: "user" },

  // Doctor Verification Documents
  adharCard: { type: String, },          // file/url
  panCard: { type: String, },            // file/url
  mbbsCertificate: { type: String, },    // file/url
  pmcRegistration: { type: String, },    // Permanent Medical Registration
  nmrId: { type: String, },              // National Medical Register ID

  // Document Verification Status
  adharCardStatus: { type: String, default: "pending" },
  panCardStatus: { type: String, default: "pending" },
  mbbsCertificateStatus: { type: String, default: "pending" },
  pmcRegistrationStatus: { type: String, default: "pending" },
  nmrIdStatus: { type: String, default: "pending" },

  // Overall User Verification Status
  status: { type: String, default: "pending" },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
