require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const ticketRoutes = require('./src/routes/tickets');

const app = express();
app.use(express.json());

// Routes
const authRoutes = require('./src/routes/auth');
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);

const PORT = process.env.PORT || 3000;
// Connects to MongoDB Atlas Cloud Database in production
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/delhi_rescue';

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
