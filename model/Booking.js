// const mongoose = require("mongoose");

// const bookingSchema = new mongoose.Schema({
//   cabinId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Cabin",
//     required: true,
//   },
//   name: {
//     type: String,
//     required: true,
//   },
//   mobile: {
//     type: String,
//     required: true,
//   },
//   date: {
//     type: String,
//     required: true,
//   },
//   time: {
//     type: String,
//     required: true,
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// module.exports = mongoose.model("Booking", bookingSchema);



const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  cabinId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cabin",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },

  // New fields
  startDate: {
    type: String,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endDate: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);
