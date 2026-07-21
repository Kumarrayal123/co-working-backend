// models/Query.js
const mongoose = require('mongoose');

const querySchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  phone: {
    type: String,
  },
  address: {
  },
  message: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'read', 'replied', 'closed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Query', querySchema);