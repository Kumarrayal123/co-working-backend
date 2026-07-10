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
  // Transaction array (Credit)
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
    amount: Number,
    type: {
      type: String,
      enum: ['credit', 'debit'],
      default: 'credit'
    },
    description: String,
    customerName: String,
    customerMobile: String,
    startDate: String,
    endDate: String,
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