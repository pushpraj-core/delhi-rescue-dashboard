const express = require('express');
const { ingestTicket, getTickets } = require('../services/ticketService');

const router = express.Router();

// GET /api/tickets - For Authority Dashboard
router.get('/', async (req, res) => {
  try {
    const tickets = await getTickets();
    res.json({ tickets });
  } catch (error) {
    console.error('[Get Tickets Error]:', error.message);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// POST /api/tickets
router.post('/', async (req, res) => {
  try {
    const { longitude, latitude, encryptedPayload, confidence_score, user_category, tags, isEmergency } = req.body;

    // Basic Validation
    if (longitude == null || latitude == null || !encryptedPayload || !encryptedPayload.encryptedAesKey || confidence_score == null || !user_category) {
      return res.status(400).json({ error: 'Missing required fields or invalid encrypted payload' });
    }

    if (typeof longitude !== 'number' || typeof latitude !== 'number' || typeof confidence_score !== 'number') {
      return res.status(400).json({ error: 'Longitude, latitude, and confidence_score must be numbers' });
    }

    // Call secure ingestion service
    const result = await ingestTicket({ longitude, latitude, encryptedPayload, confidence_score, user_category, tags, isEmergency });

    return res.status(result.status === 'CREATED' ? 201 : 200).json({
      message: result.status === 'CREATED' ? 'New Case File Created' : 'Duplicate Ticket Updated',
      ticket: {
        id: result.ticket._id,
        trackingId: result.ticket.trackingId,
        district_id: result.ticket.district_id,
        reportCount: result.ticket.reportCount,
        status: result.status
      }
    });

  } catch (error) {
    console.error('[Ticket Ingestion Error]:', error.message);
    // Secure error handling - don't leak stack traces
    return res.status(500).json({ error: 'Internal Server Error during ingestion' });
  }
});

// GET /api/tickets/track/:trackingId - Public Anonymous Tracking
router.get('/track/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    // We do NOT use getTickets() from service because that returns all sensitive data
    // We query directly and only return safe fields
    const Ticket = require('../models/Ticket');
    const ticket = await Ticket.findOne({ trackingId }).select('trackingId status createdAt district_id isEmergency -_id');
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found. Please check your Tracking ID.' });
    }
    
    res.json({ ticket });
  } catch (error) {
    console.error('[Track Ticket Error]:', error.message);
    res.status(500).json({ error: 'Failed to retrieve ticket status' });
  }
});

module.exports = router;
