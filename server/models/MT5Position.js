const mongoose = require('mongoose');

const mt5PositionSchema = new mongoose.Schema(
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
    positionId: {
      type: Number,
      required: true
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
    direction: {
      type: String,
      enum: ['Buy', 'Sell'],
      required: true
    },
    volume: {
      type: Number,
      required: true
    },
    closedVolume: {
      type: Number,
      default: 0
    },
    remainingVolume: {
      type: Number,
      default: 0
    },
    openPrice: {
      type: Number,
      required: true
    },
    closePrice: {
      type: Number,
      default: 0
    },
    openTimeBroker: {
      type: Date,
      default: null
    },
    openTimeUTC: {
      type: Date,
      required: true,
      index: true
    },
    closeTimeBroker: {
      type: Date,
      default: null
    },
    closeTimeUTC: {
      type: Date,
      default: null,
      index: true
    },
    initialSL: {
      type: Number,
      default: 0
    },
    initialTP: {
      type: Number,
      default: 0
    },
    grossProfit: {
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
    netProfit: {
      type: Number,
      default: 0
    },
    dealTickets: {
      type: [Number],
      default: []
    },
    isFullyClosed: {
      type: Boolean,
      default: false,
      index: true
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true
    },
    // Trade journal link
    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trade',
      default: null,
      index: true
    },
    journalStatus: {
      type: String,
      enum: ['pending', 'draft', 'completed'],
      default: 'pending',
      index: true
    },
    mt5DataChanged: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Unique position identifier per account
mt5PositionSchema.index({ accountId: 1, positionId: 1 }, { unique: true });
mt5PositionSchema.index({ userId: 1, journalStatus: 1 });
mt5PositionSchema.index({ accountId: 1, status: 1 });

module.exports = mongoose.model('MT5Position', mt5PositionSchema);
