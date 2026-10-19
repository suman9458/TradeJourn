const mongoose = require('mongoose');

const mt5AccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    serverName: {
      type: String,
      required: [true, 'Broker server name is required'],
      trim: true
    },
    login: {
      type: Number,
      required: [true, 'MT5 account login number is required']
    },
    accountName: {
      type: String,
      trim: true,
      default: ''
    },
    tradeMode: {
      type: String,
      enum: ['demo', 'live'],
      default: 'demo',
      index: true
    },
    accountType: {
      type: String,
      enum: ['hedging', 'netting'],
      default: 'hedging'
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true
    },
    leverage: {
      type: Number,
      default: 100
    },
    balance: {
      type: Number,
      default: 0
    },
    equity: {
      type: Number,
      default: 0
    },
    margin: {
      type: Number,
      default: 0
    },
    freeMargin: {
      type: Number,
      default: 0
    },
    marginLevel: {
      type: Number,
      default: 0
    },
    floatingProfit: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['connected', 'stale', 'disconnected', 'error', 'standby'],
      default: 'standby',
      index: true
    },
    lastHeartbeat: {
      type: Date,
      default: null
    },
    lastSyncTime: {
      type: Date,
      default: null
    },
    // Connector API authentication
    apiKeyId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    apiKeyHash: {
      type: String,
      select: false
    },
    // Cloud MT5 Direct Web Login Fields
    connectionMethod: {
      type: String,
      enum: ['cloud', 'vps'],
      default: 'cloud',
      index: true
    },
    metaApiAccountId: {
      type: String,
      default: ''
    },
    investorPassword: {
      type: String,
      select: false,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Account identity is strictly (userId + serverName + login)
mt5AccountSchema.index({ userId: 1, serverName: 1, login: 1 }, { unique: true });

module.exports = mongoose.model('MT5Account', mt5AccountSchema);
