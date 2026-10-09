const mongoose = require('mongoose');

const emotionalRiskSet = new Set([
  'Fear',
  'Greed',
  'Impatient',
  'Revenge',
  'FOMO',
  'Frustrated',
  'Anxious',
  'Overconfident'
]);

const tradeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tradeName: {
      type: String,
      required: [true, 'Please provide a trade name'],
      trim: true
    },
    date: {
      type: String,
      required: [true, 'Please provide a trade date (YYYY-MM-DD)'],
      index: true
    },
    time: {
      type: String,
      default: '00:00'
    },
    instrument: {
      type: String,
      required: true,
      trim: true,
      default: 'EURUSD',
      index: true
    },
    levelTraded: {
      type: String,
      trim: true,
      default: 'Support'
    },
    session: {
      type: String,
      enum: ['Asian', 'London', 'New York', 'London + New York', 'Other'],
      default: 'London',
      index: true
    },
    bias: {
      type: String,
      enum: ['Bullish', 'Bearish', 'Neutral'],
      default: 'Bullish'
    },
    result: {
      type: String,
      enum: ['WIN', 'LOSS', 'BE'],
      default: 'WIN',
      index: true
    },
    rr: {
      type: Number,
      default: 1.5
    },
    rResult: {
      type: Number,
      default: 1.5
    },
    pips: {
      type: Number,
      default: 0
    },
    takeProfit: {
      type: Number,
      default: 0
    },
    takeProfitUSD: {
      type: Number,
      default: 0
    },
    setupRating: {
      type: String,
      enum: ['A+', 'A', 'B+', 'B', 'C', 'D', 'No Setup'],
      default: 'A+',
      index: true
    },
    entryType: {
      type: String,
      enum: [
        'Confirmation',
        'Early Entry',
        'Retest',
        'Breakout',
        'Liquidity Sweep',
        'Other'
      ],
      default: 'Confirmation'
    },
    confirmation: {
      type: String,
      default: 'Yes'
    },
    emotion: {
      type: String,
      enum: [
        'Calm',
        'Confident',
        'Focused',
        'Fear',
        'Greed',
        'Impatient',
        'Revenge',
        'FOMO',
        'Overconfident',
        'Frustrated',
        'Anxious',
        'Hesitant',
        'Bored',
        'Other'
      ],
      default: 'Calm',
      index: true
    },
    reasonEarlyExit: {
      type: String,
      default: 'None'
    },
    marketCondition: {
      type: String,
      enum: ['Trending', 'Ranging', 'Choppy', 'Volatile', 'Low Volatility'],
      default: 'Trending'
    },
    isPropTrade: {
      type: Boolean,
      default: true,
      index: true
    },
    mistakes: {
      type: [String],
      default: ['None']
    },
    notes: {
      type: String,
      default: ''
    },
    screenshotUrl: {
      type: String,
      default: ''
    },
    // Derived Analytics & Scores
    disciplineScore: {
      type: Number,
      default: 100
    },
    tradeGrade: {
      type: String,
      enum: ['Elite', 'Good', 'Average', 'Needs Improvement'],
      default: 'Elite'
    },
    winFlag: { type: Number, default: 1 },
    lossFlag: { type: Number, default: 0 },
    earlyExitFlag: { type: Number, default: 0 },
    emotionalTradeFlag: { type: Number, default: 0 }
  },
  {
    timestamps: true,
    strict: false
  }
);

// High-performance compound indexes for large-scale filtering
tradeSchema.index({ userId: 1, date: -1 });
tradeSchema.index({ userId: 1, result: 1 });
tradeSchema.index({ userId: 1, setupRating: 1 });
tradeSchema.index({ userId: 1, session: 1 });
tradeSchema.index({ userId: 1, emotion: 1 });

// Automatically compute discipline score and normalized flags
tradeSchema.pre('save', function (next) {
  const result = this.result || 'BE';
  const rr = Number(this.rr || 0);
  const setupRating = this.setupRating || 'No Setup';
  const emotion = this.emotion || 'Calm';
  const confirmation = this.confirmation || 'No';
  const mistakes = Array.isArray(this.mistakes) ? this.mistakes : [];

  this.rResult = result === 'WIN' ? rr : result === 'LOSS' ? -1 : 0;
  this.winFlag = result === 'WIN' ? 1 : 0;
  this.lossFlag = result === 'LOSS' ? 1 : 0;
  this.earlyExitFlag = this.reasonEarlyExit && this.reasonEarlyExit !== 'None' ? 1 : 0;
  this.emotionalTradeFlag = emotionalRiskSet.has(emotion) ? 1 : 0;

  if (this.takeProfit !== undefined && this.takeProfit !== null) {
    this.takeProfit = Number(this.takeProfit) || 0;
  }
  if (this.takeProfitUSD !== undefined && this.takeProfitUSD !== null) {
    this.takeProfitUSD = Number(this.takeProfitUSD) || 0;
  }

  if (this.takeProfit && (!this.takeProfitUSD || this.takeProfitUSD === 0)) {
    this.takeProfitUSD = this.takeProfit;
  } else if (this.takeProfitUSD && (!this.takeProfit || this.takeProfit === 0)) {
    this.takeProfit = this.takeProfitUSD;
  }

  const setupScore = ['A+', 'A', 'B+', 'B'].includes(setupRating) ? 25 : 0;
  const confirmationScore = confirmation === 'Yes' ? 25 : confirmation === 'Partial' ? 12.5 : 0;
  const emotionalScore = this.emotionalTradeFlag === 0 ? 25 : 0;
  const mistakeScore = mistakes.length === 0 || mistakes.includes('None') ? 25 : 0;

  const score = Math.min(100, setupScore + confirmationScore + emotionalScore + mistakeScore);
  this.disciplineScore = score;

  if (score >= 90) this.tradeGrade = 'Elite';
  else if (score >= 75) this.tradeGrade = 'Good';
  else if (score >= 60) this.tradeGrade = 'Average';
  else this.tradeGrade = 'Needs Improvement';

  next();
});

module.exports = mongoose.model('Trade', tradeSchema);
