const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  seq: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'STATUS_UPDATE', 'EVIDENCE_DECRYPTED', 'NOTE_ADDED',
      'TICKET_CREATED', 'TICKET_TRANSFERRED', 'TRANSFER_ACCEPTED',
      'TRANSFER_REJECTED', 'OFFICER_APPROVED', 'OFFICER_REVOKED',
      'PRIORITY_OVERRIDE', 'KEY_UPLOADED', 'DEMO_LOGIN'
    ]
  },
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: false  // Some actions (like officer approval) don't have a ticketId
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
    required: true
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
