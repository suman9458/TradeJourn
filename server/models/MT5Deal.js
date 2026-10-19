const mongoose = require('mongoose');

const mt5DealSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MT5Account',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    dealTicket: {
      type: Number,
      required: true
    },
    orderTicket: {
      type: Number,
      default: 0
    },
    positionId: {
      type: Number,
      required: true,
      index: true
    },
    symbol: {
      type: String,
      required: true,
      trim: true
    },
    normalizedSymbol: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    type: {
      type: String,
      enum: ['BUY', 'SELL'],
      required: true
    },
    entry: {
      type: String,
      enum: ['IN', 'OUT', 'INOUT', 'OUT_BY'],
      required: true,
      index: true
    },
    volume: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    timeBroker: {
      type: Date,
      default: null
    },
    timeUTC: {
      type: Date,
      required: true,
      index: true
    },
    profit: {
      type: Number,
      default: 0
    },
    commission: {
      type: Number,
      default: 0
    },
    swap: {
      type: Number,
      default: 0
    },
    fee: {
      type: Number,
      default: 0
    },
    magic: {
      type: Number,
      default: 0
    },
    comment: {
      type: String,
      default: ''
    },
    reason: {
      type: String,
      default: ''
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Unique constraint: (accountId, dealTicket) prevents duplicate deals
mt5DealSchema.index({ accountId: 1, dealTicket: 1 }, { unique: true });
mt5DealSchema.index({ accountId: 1, positionId: 1, timeUTC: 1 });

module.exports = mongoose.model('MT5Deal', mt5DealSchema);
