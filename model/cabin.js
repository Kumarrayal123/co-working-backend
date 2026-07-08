const mongoose = require("mongoose");

const pricingPlanSchema = new mongoose.Schema({
  label: { type: String },        // e.g. "Monthly", "Weekly"
  hours: { type: Number },        // total hours included
  cost: { type: Number },         // price in ₹
  validity: { type: Number },     // validity in days
}, { _id: true });

const cabinSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: { type: String, required: true },
  description: { type: String },
  capacity: { type: String, required: true },
  price: { type: Number, default: 0 },          // kept for backward compat
  pricingPlans: { type: [pricingPlanSchema], default: [] },
  images: { type: [String] },
  address: { type: String, required: true },
  amenities: {
    wifi: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
    lockers: { type: Boolean, default: false },
    privateWashroom: { type: Boolean, default: false },
    secureAccess: { type: Boolean, default: false },
    comfortSeating: { type: Boolean, default: false },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Cabin", cabinSchema);
