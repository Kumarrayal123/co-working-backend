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
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
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

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'active'],
    default: 'pending'
  },


  paymentMethod: {
    type: String,
    enum: ['online', 'counter'],
    default: 'online'
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'paid'
  },
  paymentId: {
    type: String,
    default: ''
  },

  // ======================
  // TRANSACTION ID (Razorpay Payment ID)
  // ======================
  transactionId: {
    type: String,
    default: ''
  },
  razorpayOrderId: {
    type: String,
    default: ''
  },
  razorpayPaymentId: {
    type: String,
    default: ''
  },
  razorpaySignature: {
    type: String,
    default: ''
  },


  // ======================
  // CHECK-IN/CHECK-OUT HISTORY
  // ======================
  checkHistory: [{
    type: {
      type: String,
      enum: ['in', 'out'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    lat: {
      type: Number,
      default: null
    },
    lng: {
      type: Number,
      default: null
    },
    address: {
      type: String,
      default: ''
    },
    hoursUsed: {
      type: Number,
      default: 0
    },
    remainingHours: {
      type: Number,
      default: 0
    }
  }],

  // ======================
  // CURRENT CHECK-IN STATUS
  // ======================
  isCheckedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: {
    type: Date,
    default: null
  },
  checkedInLat: {
    type: Number,
    default: null
  },
  checkedInLng: {
    type: Number,
    default: null
  },
  checkedInAddress: {
    type: String,
    default: ''
  },

  // ======================
  // HOURS TRACKING
  // ======================
  hoursUsed: {
    type: Number,
    default: 0
  },
  remainingHours: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);
