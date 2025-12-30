const mongoose = require("mongoose");

const cabinSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: { type: String, required: true },
  description: { type: String },
  capacity: { type: String, required: true },
  price: { type: Number, required: true },
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
