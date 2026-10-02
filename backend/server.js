require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const ticketRoutes = require('./src/routes/tickets');

const app = express();
app.use(helmet());

const allowedDomains = process.env.ALLOWED_DOMAINS ? process.env.ALLOWED_DOMAINS.split(',') : [];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedDomains.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

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
const teamRoutes = require('./src/routes/teams');
const analyticsRoutes = require('./src/routes/analytics');
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/analytics', analyticsRoutes);

// Centralized error handler without stack leaks
app.use((err, req, res, next) => {
  console.error('[Global Error]:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
// Connects to MongoDB Atlas Cloud Database in production
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/raksha_mumbai';

// Connect to MongoDB and start server
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('✅ Connected to Secure MongoDB');
      
      const http = require('http');
      const { Server } = require('socket.io');
      const jwt = require('jsonwebtoken');

      const server = http.createServer(app);
      const io = new Server(server, {
        cors: {
          origin: process.env.NODE_ENV === 'production' ? allowedDomains : '*',
          methods: ['GET', 'POST']
        }
      });

      // Export io to be used in routes
      app.set('io', io);

      io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: Missing token'));
        }
        try {
          // In development without secret, just pass
          if (process.env.NODE_ENV !== 'production' && (!process.env.JWT_SECRET || token === 'dev-bypass-token')) {
            return next();
          }
          jwt.verify(token, process.env.JWT_SECRET);
          next();
        } catch (err) {
          next(new Error('Authentication error: Invalid token'));
        }
      });

      io.on('connection', (socket) => {
        console.log('🔗 Secure Socket connected:', socket.id);
        socket.on('disconnect', () => {
          console.log('🔗 Secure Socket disconnected:', socket.id);
        });
      });

      // SLA Escalation Background Job
      setInterval(async () => {
        try {
          const Ticket = require('./src/models/Ticket');
          const result = await Ticket.updateMany(
            { 
              status: { $nin: ['CLOSED', 'REJECTED', 'DUPLICATE'] },
              slaBreachAt: { $lte: new Date() },
              escalated: false 
            },
            { $set: { escalated: true } }
          );
          if (result.modifiedCount > 0) {
            console.log(`[SLA ESCALATION] ${result.modifiedCount} tickets breached SLA and escalated to Admin.`);
            // Emit real-time alert
            io.emit('sla_escalation', { count: result.modifiedCount });
            
            // Send external notification
            const notificationService = require('./src/services/notificationService');
            await notificationService.alertAdmin(result.modifiedCount);
          }
        } catch(e) {
          console.error('[SLA Escalation Error]:', e.message);
        }
      }, 60 * 1000); // Check every minute

      server.listen(PORT, () => {
        console.log(`✅ Secure Backend & Socket running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('❌ MongoDB Connection Error:', err.message);
      process.exit(1);
    });
}

module.exports = app;
