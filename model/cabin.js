


// const mongoose = require("mongoose");

// const cabinSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   description: { type: String },
//   capacity: { type: Number, required: true },
//   images: { type: [String] }, 
//   address: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("Cabin", cabinSchema);




// const mongoose = require("mongoose");

// const cabinSchema = new mongoose.Schema({
//   owner: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true,            // ⭐ important
//   },
//   name: { type: String, required: true },
//   description: { type: String },
//   capacity: { type: Number, required: true },
//   images: { type: [String] },
//   address: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("Cabin", cabinSchema);

const mongoose = require("mongoose");

const cabinSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  name: { type: String, required: true },
  description: { type: String },
  capacity: { type: Number, required: true },
=======
  capacity: { type: String, required: true },
  price: { type: Number, required: true }, // Added price
  images: { type: [String] },
>>>>>>> 1082581f89b862dbbe59cad15c5cf1b3648be10d
  address: { type: String, required: true },
  price: { type: Number },

  images: { type: [String] },

  // ⭐ NEW: Amenities
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
