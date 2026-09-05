const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: { type: String },
  type: { type: String, enum: ['multiple-choice', 'text', 'rating'], default: 'text' }
});

const SurveySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  questions: { type: [QuestionSchema], default: [] },
  noOfTables: { type: Number, default: null },
  // Additional fields for survey form
  spaceName: { type: String },
  spaceType: { type: String },
  mobileNumber: { type: String },
  address: { type: String },
  submittedBy: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Survey', SurveySchema);