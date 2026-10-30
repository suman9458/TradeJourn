const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'model', 'system'],
      required: true
    },
    text: {
      type: String,
      required: true
    },
    intent: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    title: {
      type: String,
      default: 'New Conversation',
      trim: true
    },
    messages: [messageSchema],
    contextState: {
      activeSymbol: { type: String, default: null },
      activeTimeframe: { type: String, default: null },
      activeFilters: {
        instrument: { type: String, default: null },
        session: { type: String, default: null },
        setupRating: { type: String, default: null },
        startDate: { type: String, default: null },
        endDate: { type: String, default: null },
        dateRangeLabel: { type: String, default: null }
      },
      rootTask: { type: String, default: null },
      lastIntent: { type: String, default: null },
      summary: { type: String, default: '' },
      lastUpdated: { type: Date, default: Date.now }
    },
    summary: {
      type: String,
      default: ''
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30-day retention
    }
  },
  {
    timestamps: true
  }
);

// Compound index for secure multi-tenant isolation and fast lookup
conversationSchema.index({ userId: 1, conversationId: 1, isDeleted: 1 });
conversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Conversation', conversationSchema);
