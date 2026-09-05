// model/Space.js
const mongoose = require('mongoose');

const SpaceSchema = new mongoose.Schema(
  {
    name: { type: String,  }, // Name of space or cafe
    mobileNumber: { type: String, },
    address: { type: String, }, // Plain text or URL
    spaceType: {
      type: String,
      enum: ['co-working', 'medical space', 'cafe'],
    },
        noOfTables: { type: Number }, // Added this field
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Space', SpaceSchema);