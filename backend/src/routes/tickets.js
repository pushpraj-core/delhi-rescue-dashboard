const express = require('express');
const { ingestTicket, getTickets } = require('../services/ticketService');
const { logAction } = require('../middleware/auditMiddleware');
const Ticket = require('../models/Ticket');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const notificationService = require('../services/notificationService');

const router = express.Router();

// GET /api/tickets/audit-log - Retrieve audit trail for dashboard
router.get('/audit-log', requireAuth, requireRole(['admin', 'officer']), async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(200).lean();
    res.json({ logs });
  } catch (error) {
    console.error('[Audit Log Error]:', error.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /api/tickets/audit/verify - Verify Tamper-evident Hash Chain
router.get('/audit/verify', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: 1 });
    let isIntact = true;
    let brokenAt = null;
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const log of logs) {
      if (log.previousHash !== previousHash) {
        isIntact = false;
        brokenAt = log._id;
        break;
      }
      previousHash = log.hash;
    }

    res.json({ isIntact, brokenAt, count: logs.length });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// GET /api/tickets/hotspots - Aggregation for Heatmap
router.get('/hotspots', requireAuth, async (req, res) => {
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
router.get('/', requireAuth, async (req, res) => {
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
    const { longitude, latitude, encryptedPayload, confidence_score, user_category, tags, isEmergency, dHash } = req.body;

    // Basic Validation
    if (longitude == null || latitude == null || !encryptedPayload || !encryptedPayload.wrappedKeys || confidence_score == null || !user_category) {
      return res.status(400).json({ error: 'Missing required fields or invalid encrypted payload' });
    }

    if (typeof longitude !== 'number' || typeof latitude !== 'number' || typeof confidence_score !== 'number') {
      return res.status(400).json({ error: 'Longitude, latitude, and confidence_score must be numbers' });
    }

    // Call secure ingestion service
    const result = await ingestTicket({ longitude, latitude, encryptedPayload, confidence_score, user_category, tags, isEmergency, dHash });
    
    // Emit real-time event
    const io = req.app.get('io');
    if (io && result.status === 'CREATED') {
      io.emit('ticket_created', result.ticket);
    } else if (io) {
      io.emit('ticket_updated', result.ticket);
    }

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
router.patch('/:id/status', requireAuth, logAction('STATUS_UPDATE'), async (req, res) => {
  try {
    const { status, assigned_team, priority } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const VALID_TRANSITIONS = {
      'REPORTED': ['DISPATCHED', 'REJECTED', 'CLOSED'],
      'VERIFIED': ['DISPATCHED', 'REJECTED', 'CLOSED'], // Legacy support
      'DISPATCHED': ['RESCUED', 'CLOSED'],
      'RESCUED': ['CLOSED'],
      'CWC_PRODUCED': ['CLOSED'], // Legacy support
      'REHAB_FOLLOWUP': ['CLOSED'], // Legacy support
      'CLOSED': [],
      'REJECTED': [],
      'DUPLICATE': ['REJECTED', 'CLOSED'] // Legacy support
    };

    if (status && status !== ticket.status) {
      const allowed = VALID_TRANSITIONS[ticket.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: `Invalid state transition from ${ticket.status} to ${status}` });
      }
      ticket.status = status;
    }

    if (priority && priority !== ticket.priority) {
      ticket.priority = priority;
      const slaHours = {
        'Critical': 1,
        'High': 4,
        'Medium': 12,
        'Low': 24
      };
      // Keep original start time, just update the breach horizon
      ticket.slaBreachAt = new Date(ticket.createdAt.getTime() + slaHours[priority] * 60 * 60 * 1000);
    }

    // Only persist team assignment when dispatching; clear it otherwise
    if (status === 'DISPATCHED') {
      let finalTeam = assigned_team;
      if (!finalTeam) {
        // Auto-assign the nearest available team
        const Team = require('../models/Team');
        let query = { status: 'AVAILABLE' };
        if (ticket.railwayJurisdiction) query.isRailwayPolice = true;

        const suggestedTeams = await Team.find({
          ...query,
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: ticket.location.coordinates }
            }
          }
        }).limit(1);

        if (suggestedTeams.length > 0) {
          finalTeam = suggestedTeams[0].name;
        } else if (ticket.railwayJurisdiction) {
          // Fallback if no railway teams
          const fallbackTeams = await Team.find({
            status: 'AVAILABLE',
            location: {
              $near: { $geometry: { type: 'Point', coordinates: ticket.location.coordinates } }
            }
          }).limit(1);
          if (fallbackTeams.length > 0) finalTeam = fallbackTeams[0].name;
        }
      }

      if (finalTeam) {
        ticket.assigned_team = finalTeam;
        notificationService.alertTeam(finalTeam, ticket).catch(e => console.error(e));
      }
    } else if (status && status !== 'DISPATCHED' && status !== ticket.status) {
      ticket.assigned_team = null;
    }



    await ticket.save();
    
    const io = req.app.get('io');
    if (io) io.emit('ticket_updated', ticket);

    res.json({ ticket });
  } catch (error) {
    console.error('[Update Status Error]:', error.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /api/tickets/:id/notes - Add Internal Case Note
router.post('/:id/notes', requireAuth, logAction('NOTE_ADDED'), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Note text is required' });

    const noteAuthor = req.user?.email || 'unknown_officer';
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: { text: text.trim(), author: noteAuthor } } },
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
router.post('/:id/audit-decrypt', requireAuth, logAction('EVIDENCE_DECRYPTED'), async (req, res) => {
  res.json({ success: true, message: 'Decryption logged securely.' });
});



module.exports = router;
