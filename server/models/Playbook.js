const mongoose = require('mongoose');

const playbookSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    entryRules: {
      type: [String],
      default: [
        'Only trade planned levels',
        'Wait for confirmation before execution',
        'Respect higher timeframe bias',
        'Require minimum 1:1.5 RR potential',
        'No FOMO entries'
      ]
    },
    riskRules: {
      type: [String],
      default: [
        'Follow fixed 1% risk per trade',
        'Never move stop loss emotionally',
        'Never revenge trade',
        'Hard stop after 2 consecutive daily losses'
      ]
    },
    exitRules: {
      type: [String],
      default: [
        'Follow predefined TP targets',
        'Do not exit early due to temporary fear',
        'Never move take-profit further away greedily',
        'Document and justify any manual exit'
      ]
    },
    psychologyRules: {
      type: [String],
      default: [
        'No revenge trading under any circumstances',
        'Accept losses as normal business expense',
        'No overtrading beyond 3 trades per session',
        'Take mandatory 15-minute break after emotional trades'
      ]
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Playbook', playbookSchema);
