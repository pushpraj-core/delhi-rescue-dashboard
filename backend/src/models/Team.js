const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  ward: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'DISPATCHED', 'OFF_DUTY'],
    default: 'AVAILABLE'
  },
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
  isRailwayPolice: {
    type: Boolean,
    default: false
  }
});

teamSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Team', teamSchema);
