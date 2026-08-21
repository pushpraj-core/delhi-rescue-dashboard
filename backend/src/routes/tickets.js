const express = require('express');
const { ingestTicket } = require('../services/ticketService');

const router = express.Router();

// POST /api/tickets
router.post('/', async (req, res) => {
  try {
    const { longitude, latitude, imageReference } = req.body;

    // Basic Validation
    if (longitude == null || latitude == null || !imageReference) {
      return res.status(400).json({ error: 'Missing required fields: longitude, latitude, or imageReference' });
    }

    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      return res.status(400).json({ error: 'Longitude and latitude must be numbers' });
    }

    // Call secure ingestion service
    const result = await ingestTicket({ longitude, latitude, imageReference });

    return res.status(result.status === 'CREATED' ? 201 : 200).json({
      message: result.status === 'CREATED' ? 'New Case File Created' : 'Duplicate Ticket Updated',
      ticket: {
        id: result.ticket._id,
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

module.exports = router;
