const mongoose = require('mongoose');

const mt5AuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MT5Account',
      default: null,
      index: true
    },
    event: {
      type: String,
      required: true,
      enum: [
        'pairing_code_generated',
        'paired',
        'key_rotated',
        'heartbeat',
        'sync_positions',
        'sync_deals',
        'reconciliation',
        'account_disconnected',
        'data_deleted',
        'error'
      ],
      index: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

mt5AuditLogSchema.index({ userId: 1, createdAt: -1 });
mt5AuditLogSchema.index({ accountId: 1, createdAt: -1 });

module.exports = mongoose.model('MT5AuditLog', mt5AuditLogSchema);
