// models/CabinOrder.js
const mongoose = require('mongoose');

const cabinOrderSchema = new mongoose.Schema({
  cabin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cabin',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  
  // Razorpay fields
  razorpayOrderId: {
    type: String
  },
  razorpayPaymentId: {
    type: String
  },
  razorpaySignature: {
    type: String
  },

   // ✅ Transaction ID - ye field hona chahiye
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },

   baseAmount: { type: Number, required: true },      // ✅ Base amount without GST
  gstAmount: { type: Number, default: 0 },           // ✅ GST amount
  amount: { type: Number, required: true },          // ✅ Total with GST
  gstRate: { type: Number, default: 0.18 },          // ✅ GST rate
  
  startDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: true
  },
  paymentCount: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('CabinOrder', cabinOrderSchema);