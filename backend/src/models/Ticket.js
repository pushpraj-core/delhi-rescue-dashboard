const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  district_id: {
    type: String,
    required: false,
    default: 'UNASSIGNED'
  },
  trackingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  reportCount: {
    type: Number,
    default: 1
  },
  encryptedPayload: {
    wrappedKeys: [{
      officerEmail: { type: String, required: true },
      wrappedKey: { type: String, required: true }
    }],
    iv: { type: String, required: true },
    encryptedData: { type: String, required: true }
  },
  confidence_score: {
    type: Number,
    required: true
  },
  dHash: {
    type: String,
    required: false
  },
  user_category: {
    type: String,
    enum: [
      'Unattended Child',
      'Child Labour',
      'Trafficking Suspicion',
      'Begging (Organized)',
      'Begging (Independent)',
      'Street Child',
      'Abuse / Violence',
      'Missing Child Sighted',
      'Other'
    ],
    required: true
  },
  tags: {
    type: [String],
    default: []
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    default: 'Medium'
  },
  railwayJurisdiction: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['REPORTED', 'VERIFIED', 'DISPATCHED', 'RESCUED', 'CWC_PRODUCED', 'REHAB_FOLLOWUP', 'CLOSED', 'REJECTED', 'DUPLICATE'],
    default: 'REPORTED'
  },
  assigned_team: {
    type: String,
    default: null
  },
  notes: [{
    text: { type: String, required: true },
    author: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  slaBreachAt: {
    type: Date
  },
  escalated: {
    type: Boolean,
    default: false
  },
  triageScore: {
    type: Number,
    default: 0
  },
  triageReasons: {
    type: [String],
    default: []
  },
  isSynthetic: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// GeoJSON Index for spatial queries
ticketSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Ticket', ticketSchema);
