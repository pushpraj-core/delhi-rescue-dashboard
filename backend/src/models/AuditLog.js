const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['STATUS_UPDATE', 'EVIDENCE_DECRYPTED', 'KHOYA_PAYA_CHECK']
  },
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  officerId: {
    type: String,
    required: true,
    default: 'Nodal_Officer_DL_01' // Hardcoded for demo/MVP
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
