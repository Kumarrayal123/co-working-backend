const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true },
  password: { type: String },
  mobile: { type: String },
  address: { type: String },
  organizationName: { type: String, default: '' },
  role: { type: String, enum: ["user", "doctor", "cabinowner", "cabinOwner"], default: "user" },
  isDoctor: { type: Boolean, default: false },

  // PAN Number field - ADD THIS
  panNumber: { type: String, default: '' },

  // GST Number
  gstNumber: { type: String, default: '' },
  
  // DMHO Number (keep for doctors)
  dmhoNumber: { type: String, default: '' },

  // Doctor Verification Documents
  adharCard: { type: String },
  panCard: { type: String },
  mbbsCertificate: { type: String },
  pmcRegistration: { type: String },
  nmrId: { type: String },

  // Document Verification Status
  adharCardStatus: { type: String, default: "pending" },
  panCardStatus: { type: String, default: "pending" },
  mbbsCertificateStatus: { type: String, default: "pending" },
  pmcRegistrationStatus: { type: String, default: "pending" },
  nmrIdStatus: { type: String, default: "pending" },

  // Overall User Verification Status
  status: { type: String, default: "pending" },

  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cabin' }],


  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);