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
    enum: ['officer', 'field_team', 'ngo', 'admin'],
    required: true
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
