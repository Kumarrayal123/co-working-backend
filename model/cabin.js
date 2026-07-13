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
 // ✅ Complete Amenities with all fields
  amenities: {
    // Normal Amenities (4)
    wifi: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
    lockers: { type: Boolean, default: false },
    comfortSeating: { type: Boolean, default: false },
    
    // Exclusive Amenities (Additional 8)
    privateWashroom: { type: Boolean, default: false },
    secureAccess: { type: Boolean, default: false },    
    coffee: { type: Boolean, default: false },
    gym: { type: Boolean, default: false },
    ac: { type: Boolean, default: false },
    tv: { type: Boolean, default: false },
    printer: { type: Boolean, default: false },
    phone: { type: Boolean, default: false },
  },
    cabinType: { type: String, enum: ['normal', 'exclusive'], default: 'normal' }, // ✅ New field
      // ✅ Status fields
  isActive: { 
    type: Boolean, 
    default: true           // ✅ Active by default
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Cabin", cabinSchema);
