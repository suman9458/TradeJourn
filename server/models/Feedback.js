const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    userName: {
      type: String,
      default: 'Anonymous Trader',
      trim: true
    },
    userHandle: {
      type: String,
      default: '@trader',
      trim: true
    },
    userEmail: {
      type: String,
      default: '',
      trim: true
    },
    type: {
      type: String,
      enum: ['Feedback', 'Bug'],
      default: 'Feedback',
      index: true
    },
    message: {
      type: String,
      required: [true, 'Please provide feedback or bug details'],
      trim: true,
      maxlength: [2000, 'Feedback message cannot exceed 2000 characters']
    },
    page: {
      type: String,
      default: 'Overview',
      trim: true
    },
    status: {
      type: String,
      enum: ['New', 'In Review', 'Resolved'],
      default: 'New',
      index: true
    },
    adminNotes: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Feedback', feedbackSchema);

