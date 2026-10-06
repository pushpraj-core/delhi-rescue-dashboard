const mongoose = require('mongoose');

/**
 * OutcomeLabel stores officer overrides of suggested priority.
 * Used to build ML training data when enough labels accumulate.
 * Contains only anonymised features — never images or free text.
 */
const outcomeLabelSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  suggestedPriority: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    required: true
  },
  finalPriority: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    required: true
  },
  suggestedReasons: {
    type: [String],
    default: []
  },
  overriddenBy: {
    type: String,  // officer email
    required: true
  },
  jurisdiction: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  // Anonymised features for ML
  hour: { type: Number },
  dayOfWeek: { type: Number },
  confidenceScore: { type: Number },
  reportCount: { type: Number },
  nearRailway: { type: Boolean },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('OutcomeLabel', outcomeLabelSchema);
