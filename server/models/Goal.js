const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    // Prop Firm Challenge Fields
    isChallengeActive: { type: Boolean, default: false },
    accountSize: { type: Number, default: 50000 },
    profitTarget: { type: Number, default: 5000 },
    maxLoss: { type: Number, default: 5000 },
    maxDailyLoss: { type: Number, default: 2500 },
    hasConsistencyRule: { type: Boolean, default: true },
    consistencyPct: { type: Number, default: 50 },
    minTradingDays: { type: Number, default: 5 },

    // Legacy fields retained for backward compatibility
    monthlyRTarget: { type: Number, default: 10 },
    weeklyRTarget: { type: Number, default: 3 },
    monthlyPipsTarget: { type: Number, default: 200 },
    weeklyPipsTarget: { type: Number, default: 60 },
    maxDailyTrades: { type: Number, default: 5 },
    maxDailyLossR: { type: Number, default: 2 },
    targetWinRate: { type: Number, default: 55 },
    targetAverageRR: { type: Number, default: 1.5 },
    maxEarlyExitPct: { type: Number, default: 15 },
    targetAPlusSetupPct: { type: Number, default: 40 },
    targetDisciplineScore: { type: Number, default: 80 }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Goal', goalSchema);
