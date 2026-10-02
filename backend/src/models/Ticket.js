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
    encryptedAesKey: { type: String, required: true },
    iv: { type: String, required: true },
    encryptedData: { type: String, required: true }
  },
  confidence_score: {
    type: Number,
    required: true
  },
  user_category: {
    type: String,
    enum: ['Traffic Intersection Begging', 'Hazardous Labor', 'Unattended Child'],
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
  status: {
    type: String,
    enum: ['New Reports', 'Under Review', 'Field Team Dispatched', 'Case Closed (CWC)'],
    default: 'New Reports'
  },
  assigned_team: {
    type: String,
    default: null
  },
  notes: [{
    text: { type: String, required: true },
    author: { type: String, default: 'Nodal_Officer_DL_01' },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// GeoJSON Index for spatial queries
ticketSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Ticket', ticketSchema);
