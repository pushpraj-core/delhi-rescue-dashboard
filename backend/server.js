require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const ticketRoutes = require('./src/routes/tickets');

const app = express();
app.use(express.json({ limit: '8mb' }));

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET is required in production');
    process.exit(1);
  }
  if (!process.env.ALLOWED_DOMAINS) {
    console.error('❌ FATAL: ALLOWED_DOMAINS is required in production');
    process.exit(1);
  }
}

// Routes
const authRoutes = require('./src/routes/auth');
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);

const PORT = process.env.PORT || 5000;
// Connects to MongoDB Atlas Cloud Database in production
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/raksha_mumbai';

// Connect to MongoDB and start server
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('✅ Connected to Secure MongoDB');
      app.listen(PORT, () => {
        console.log(`✅ Secure Backend running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('❌ MongoDB Connection Error:', err.message);
      process.exit(1);
    });
}

module.exports = app;
