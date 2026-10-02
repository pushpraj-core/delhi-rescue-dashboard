const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['STATUS_UPDATE', 'EVIDENCE_DECRYPTED', 'KHOYA_PAYA_CHECK', 'NOTE_ADDED']
  },
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  actorId: {
    type: String,
    required: true
  },
  actorRole: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  previousHash: {
    type: String,
    required: true
  },
  hash: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
