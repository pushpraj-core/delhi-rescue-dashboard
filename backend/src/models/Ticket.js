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
  reportCount: {
    type: Number,
    default: 1
  },
  imageReference: {
    type: String,
    required: true
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
  status: {
    type: String,
    enum: ['Pending Verification', 'High Priority', 'Rejected', 'Low-Confidence / Manual Review Required'],
    default: 'Pending Verification'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 * 30 // TTL 30 days for cleanup (assuming compliance rules)
  }
});

// GeoJSON Index for spatial queries
ticketSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Ticket', ticketSchema);
