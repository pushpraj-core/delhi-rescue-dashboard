const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['officer', 'field_team', 'ngo', 'admin', 'pending'],
    required: true,
    default: 'pending'
  },
  jurisdiction: {
    type: String,
    default: null  // e.g. 'MCGM', 'THANE' — set by admin on approval
  },
  phone: {
    type: String,
    default: null  // For SMS alerts, admin-managed
  },
  publicKeyJwk: {
    type: Object,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
