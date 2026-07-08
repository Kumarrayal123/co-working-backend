// const mongoose = require("mongoose");

// const bookingSchema = new mongoose.Schema({
//   cabinId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Cabin",
//   },
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User", // Reference to the User model
//   },

//   // New fields
//   startDate: {
//     type: String,
//   },
//   startTime: {
//     type: String,
//   },
//   endDate: {
//     type: String,
//   },
//   endTime: {
//     type: String,
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
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  startDate: String,
  startTime: String,
  endDate: String,
  endTime: String,
  
  name: String,
  mobile: String,
  email: String,

  // ⭐ ADD THESE
  totalHours: {
    type: Number,
    default: 0,
  },
  totalPrice: {
    type: Number,
    default: 0,
  },
  bookingType: {
    type: String,
    enum: ["booking", "visit"],
    default: "booking",
  },
  bookingBasis: {
    type: String,
    enum: ["hourly", "plan"],
    default: "hourly",
  },
  selectedPlan: {
    label: String,
    hours: Number,
    cost: Number,
    validity: Number,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);
