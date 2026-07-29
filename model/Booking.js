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

  // In Booking Model Schema
bookingSlots: [{
  date: String,
  startTime: String,
  endTime: String,
  hours: Number
}],
totalDays: {
  type: Number,
  default: 0
},
dailyHours: [Number],

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

   subtotal: { type: Number, default: 0 }, // ✅ New field
  gstAmount: { type: Number, default: 0 }, // ✅ New field
  gstRate: { type: Number, default: 0.18 }, // ✅ New field
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
    enum: ['online', 'counter', 'cash'],
    default: 'online'
  },


  // ✅ SEAT SELECTION FIELDS - NEW
  selectedSeats: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cabin.seats'
    }],
    default: []
  },
  extraCharge: {
    type: Number,
    default: 0
  },
  seatCount: {
    type: Number,
    default: 0
  },
  seatExtraChargePerSeat: {
    type: Number,
    default: 100
  },

  // models/Booking.js - Add amountPaid field
amountPaid: {
  type: Number,
  default: 0
},

  isPaidToOwner: {
    type: Boolean,
    default: false
  },


   visitingTimings: {
    type: [{
      date: { type: String, },
      checkIn: { type: String, },
      checkOut: { type: String, },
      addedAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],
    default: []
  },


   termsAccepted: {
    type: Boolean,
    default: false
  },

   // ─── REPLACEMENT FIELDS (Sirf 4) ───
  isReplaced: { type: Boolean, default: false },
  replacedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Cabin', default: null },
  replacedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Cabin', default: null },
  priceDifference: { type: Number, default: 0 },

  // ─── CANCELLATION FIELDS (Sirf 2) ───
  cancelledAt: { type: Date, default: null },
  refundAmount: { type: Number, default: 0 },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'cash'],
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

  // Payment Details
  paymentMethod: {
    type: String,
    enum: ['online', 'cash', 'counter', 'upi', 'card'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    default: null
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  isPaidToOwner: {
    type: Boolean,
    default: false
  },
  
  // New Payment Details Object
  paymentDetails: {
    mode: {
      type: String,
      enum: ['cash', 'upi', 'card'],
      default: 'cash'
    },
    // Card Details
    cardNumber: {
      type: String,
      trim: true,
      default: null
    },
    cardHolderName: {
      type: String,
      trim: true,
      default: null
    },
    cardExpiry: {
      type: String,
      trim: true,
      default: null
    },
    cardCVV: {
      type: String,
      trim: true,
      default: null,
      select: false // Don't return CVV in queries
    },
    // UPI Details
    upiId: {
      type: String,
      trim: true,
      default: null
    },
    upiApp: {
      type: String,
      trim: true,
      default: null
    },
    // Common Details
    paymentDate: {
      type: Date,
      default: null
    },
    transactionId: {
      type: String,
      trim: true,
      default: null
    },
    notes: {
      type: String,
      trim: true,
      default: null
    },
    screenshot: {
      type: String,
      default: null
    },
    // Metadata
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedAt: {
      type: Date,
      default: null
    }
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
