const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    identifier: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    channel: {
      type: String,
      enum: ['sms', 'email', 'dev'],
      default: 'email'
    },
    destination: {
      type: String,
      required: true
    },
    otpHash: {
      type: String,
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    verified: {
      type: Boolean,
      default: false
    },
    resetToken: {
      type: String,
      default: null,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // MongoDB TTL index: automatically deletes document on expiry
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('OtpToken', otpTokenSchema);
