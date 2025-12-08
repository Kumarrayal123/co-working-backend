// const mongoose = require("mongoose");

// const cabinSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   description: { type: String },
//   capacity: { type: Number, required: true },
//   images: { type: [String] }, // store image URLs
//   address: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("Cabin", cabinSchema);


const mongoose = require("mongoose");

const cabinSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  capacity: { type: Number, required: true },
  images: { type: [String] }, 
  address: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Cabin", cabinSchema);
