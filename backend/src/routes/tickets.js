const express = require('express');
const { ingestTicket, getTickets } = require('../services/ticketService');
const { logAction } = require('../middleware/auditMiddleware');
const Ticket = require('../models/Ticket');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// GET /api/tickets/audit-log - Retrieve audit trail for dashboard
router.get('/audit-log', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(200).lean();
    res.json({ logs });
  } catch (error) {
    console.error('[Audit Log Error]:', error.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /api/tickets/hotspots - Aggregation for Heatmap
router.get('/hotspots', async (req, res) => {
  try {
    const tickets = await Ticket.find({}).select('location priority status');
    
    const grid = {};
    for (const t of tickets) {
      if (!t.location || !t.location.coordinates) continue;
      const lat = Math.round(t.location.coordinates[1] * 1000) / 1000;
      const lng = Math.round(t.location.coordinates[0] * 1000) / 1000;
      const key = `${lat},${lng}`;
      
      let weight = 0.5;
      if (t.priority === 'Critical') weight = 1.0;
      else if (t.priority === 'High') weight = 0.8;
      
      if (!grid[key]) {
        grid[key] = { lat, lng, weight: 0 };
      }
      grid[key].weight += weight;
    }
    
    const points = Object.values(grid).map(g => [g.lat, g.lng, g.weight]);

    res.json({ hotspots: points });
  } catch (error) {
    console.error('[Hotspots Error]:', error.message);
    res.status(500).json({ error: 'Failed to fetch hotspots' });
  }
});

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
    const ticket = await Ticket.findOne({ trackingId }).select('trackingId status createdAt district_id isEmergency assigned_team -_id');
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found. Please check your Tracking ID.' });
    }
    
    res.json({ ticket });
  } catch (error) {
    console.error('[Track Ticket Error]:', error.message);
    res.status(500).json({ error: 'Failed to retrieve ticket status' });
  }
});

// PATCH /api/tickets/:id/status - Kanban Board Status Update
router.patch('/:id/status', logAction('STATUS_UPDATE'), async (req, res) => {
  try {
    const { status, assigned_team, priority } = req.body;
    const updateFields = {};
    if (status) updateFields.status = status;
    if (priority) updateFields.priority = priority;

    // Only persist team assignment when dispatching; clear it otherwise
    if (status === 'Field Team Dispatched' && assigned_team) {
      updateFields.assigned_team = assigned_team;
    } else if (status && status !== 'Field Team Dispatched') {
      updateFields.assigned_team = null;
    }

    const ticket = await Ticket.findByIdAndUpdate(req.params.id, updateFields, { new: true });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket });
  } catch (error) {
    console.error('[Update Status Error]:', error.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /api/tickets/:id/notes - Add Internal Case Note
router.post('/:id/notes', logAction('NOTE_ADDED'), async (req, res) => {
  try {
    const { text, author } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Note text is required' });

    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: { text: text.trim(), author: author || 'Nodal_Officer_DL_01' } } },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ notes: ticket.notes });
  } catch (error) {
    console.error('[Add Note Error]:', error.message);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// POST /api/tickets/:id/audit-decrypt - Log Evidence Decryption
router.post('/:id/audit-decrypt', logAction('EVIDENCE_DECRYPTED'), async (req, res) => {
  res.json({ success: true, message: 'Decryption logged securely.' });
});

// POST /api/verify-khoya-paya - Mock Facial Recognition Bridge
router.post('/verify-khoya-paya', logAction('KHOYA_PAYA_CHECK'), async (req, res) => {
  try {
    // Simulate API delay for national database check
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Return a random mock match
    const matchScore = Math.floor(Math.random() * (99 - 40 + 1)) + 40; // 40 to 99%
    const isMatch = matchScore > 80;

    res.json({
      matchFound: isMatch,
      confidence: matchScore,
      database: 'KhoyaPaya-National',
      matchedProfileId: isMatch ? `KP-${Math.floor(Math.random() * 100000)}` : null,
      message: isMatch ? 'HIGH CONFIDENCE MATCH FOUND' : 'No significant matches found in national database.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to connect to Khoya Paya database.' });
  }
});

module.exports = router;
