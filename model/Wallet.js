// models/Wallet.js
const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true
  },
  balance: {
    type: Number,
    default: 0
  },
  totalEarned: {
    type: Number,
    default: 0
  },
  transactions: [{
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    cabinId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cabin'
    },
    cabinName: String,
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },
    description: String,
    customerName: String,
    customerMobile: String,
    startDate: String,
    endDate: String,
    transactionId: String,
    paymentMode: {
      type: String,
      enum: ['cash', 'upi', 'card'],
      default: 'cash'
    },
    paymentDetails: {
      upiId: String,
      upiApp: String,
      cardNumber: String,
      cardHolderName: String,
      transactionId: String,
      screenshot: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Withdraw array (Debit - alag)
  withdrawals: [{
    amount: {
      type: Number,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    bankName: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    description: {
      type: String,
      default: ''
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Wallet', walletSchema);