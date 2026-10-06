const express = require('express');
const { ingestTicket, getTickets } = require('../services/ticketService');
const { logAction, writeAuditLog, verifyChain } = require('../middleware/auditMiddleware');
const Ticket = require('../models/Ticket');
const { requireAuth, requireRole, scopeToJurisdiction } = require('../middleware/authMiddleware');
const notificationService = require('../services/notificationService');
const crypto = require('crypto');

const router = express.Router();

// Idempotency store (in-memory for now; production would use Redis)
const idempotencyStore = new Map();
const IDEMPOTENCY_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// ──────────────────────────────────────────────
// GET /api/tickets/audit-log — Retrieve audit trail
// ──────────────────────────────────────────────
router.get('/audit-log', requireAuth, requireRole(['admin', 'officer']), async (req, res) => {
  try {
    const logs = await require('../models/AuditLog').find().sort({ seq: -1 }).limit(200).lean();
    res.json({ logs });
  } catch (error) {
    console.error('[Audit Log Error]:', error.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ──────────────────────────────────────────────
// GET /api/tickets/audit/verify — Verify tamper-evident hash chain
// ──────────────────────────────────────────────
router.get('/audit/verify', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await verifyChain();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ──────────────────────────────────────────────
// GET /api/tickets/hotspots — Aggregation for Heatmap
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// GET /api/tickets — Scoped to officer's jurisdiction
// ──────────────────────────────────────────────
router.get('/', requireAuth, scopeToJurisdiction, async (req, res) => {
  try {
    const tickets = await Ticket.find(req.jurisdictionFilter).sort({ createdAt: -1 });
    res.json({ tickets });
  } catch (error) {
    console.error('[Get Tickets Error]:', error.message);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// ──────────────────────────────────────────────
// POST /api/tickets — Public (citizen). Supports Idempotency-Key header.
// ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    // Idempotency check
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const cached = idempotencyStore.get(idempotencyKey);
      if (cached) {
        return res.status(cached.statusCode).json(cached.body);
      }
    }

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
    
    // Socket.io: emit MINIMAL event (id + status only, never full ticket with encryptedPayload)
    const io = req.app.get('io');
    if (io && result.status === 'CREATED') {
      io.emit('ticket_created', { id: result.ticket._id, status: result.ticket.status, district_id: result.ticket.district_id });
    } else if (io) {
      io.emit('ticket_updated', { id: result.ticket._id, status: result.ticket.status });
    }

    // Audit log (after success)
    await writeAuditLog({
      action: 'TICKET_CREATED',
      ticketId: result.ticket._id,
      actorId: 'citizen',
      actorRole: 'citizen',
      details: { district_id: result.ticket.district_id, category: user_category, duplicate: result.status === 'DUPLICATE_UPDATED' }
    });

    const statusCode = result.status === 'CREATED' ? 201 : 200;
    const responseBody = {
      message: result.status === 'CREATED' ? 'New Case File Created' : 'Duplicate Ticket Updated',
      ticket: {
        id: result.ticket._id,
        trackingId: result.ticket.trackingId,
        district_id: result.ticket.district_id,
        reportCount: result.ticket.reportCount,
        status: result.status
      }
    };

    // Cache idempotency result
    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, { statusCode, body: responseBody });
      setTimeout(() => idempotencyStore.delete(idempotencyKey), IDEMPOTENCY_TTL_MS);
    }

    return res.status(statusCode).json(responseBody);

  } catch (error) {
    console.error('[Ticket Ingestion Error]:', error.message);
    
    // Return specific error codes for known errors
    if (error.message.startsWith('LOCATION_OUT_OF_REGION')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.startsWith('LOCATION_UNRESOLVED')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.startsWith('INVALID_CATEGORY')) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Internal Server Error during ingestion' });
  }
});

// ──────────────────────────────────────────────
// GET /api/tickets/track/:trackingId — Public anonymous tracking
// ──────────────────────────────────────────────
router.get('/track/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const ticket = await Ticket.findOne({ trackingId })
      .select('trackingId status createdAt district_id isEmergency assigned_team -_id');
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found. Please check your Tracking ID.' });
    }
    
    res.json({ ticket });
  } catch (error) {
    console.error('[Track Ticket Error]:', error.message);
    res.status(500).json({ error: 'Failed to retrieve ticket status' });
  }
});

// ──────────────────────────────────────────────
// PATCH /api/tickets/:id/status — Status update (officer/admin only)
// ──────────────────────────────────────────────
router.patch('/:id/status', requireAuth, requireRole(['officer', 'admin']), logAction('STATUS_UPDATE'), async (req, res) => {
  try {
    const { status, assigned_team, priority } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Jurisdiction check: officers can only update their own jurisdiction's tickets
    if (req.user.role !== 'admin' && ticket.district_id !== req.user.jurisdiction) {
      return res.status(403).json({ error: 'Cannot update tickets outside your jurisdiction' });
    }

    const VALID_TRANSITIONS = {
      'REPORTED': ['DISPATCHED', 'REJECTED', 'CLOSED'],
      'VERIFIED': ['DISPATCHED', 'REJECTED', 'CLOSED'],
      'DISPATCHED': ['RESCUED', 'CLOSED'],
      'RESCUED': ['CLOSED'],
      'CWC_PRODUCED': ['CLOSED'],
      'REHAB_FOLLOWUP': ['CLOSED'],
      'CLOSED': [],
      'REJECTED': [],
      'DUPLICATE': ['REJECTED', 'CLOSED']
    };

    if (status && status !== ticket.status) {
      const allowed = VALID_TRANSITIONS[ticket.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: `Invalid state transition from ${ticket.status} to ${status}` });
      }
      ticket.status = status;
    }

    if (priority && priority !== ticket.priority) {
      // Log officer override for ML training data
      const OutcomeLabel = require('../models/OutcomeLabel');
      await OutcomeLabel.create({
        ticketId: ticket._id,
        suggestedPriority: ticket.priority,
        finalPriority: priority,
        overriddenBy: req.user.email,
        jurisdiction: ticket.district_id,
        category: ticket.user_category,
        timestamp: new Date()
      }).catch(err => console.warn('[OutcomeLabel] Failed to log override:', err.message));

      ticket.priority = priority;
      const slaHours = { 'Critical': 1, 'High': 4, 'Medium': 12, 'Low': 24 };
      ticket.slaBreachAt = new Date(ticket.createdAt.getTime() + slaHours[priority] * 60 * 60 * 1000);
    }

    // Team assignment on dispatch
    if (status === 'DISPATCHED') {
      let finalTeam = assigned_team;
      if (!finalTeam) {
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
    
    // Socket: minimal event
    const io = req.app.get('io');
    if (io) io.emit('ticket_updated', { id: ticket._id, status: ticket.status });

    res.json({ ticket });
  } catch (error) {
    console.error('[Update Status Error]:', error.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ──────────────────────────────────────────────
// POST /api/tickets/:id/notes — Add case note (officer/admin only)
// ──────────────────────────────────────────────
router.post('/:id/notes', requireAuth, requireRole(['officer', 'admin']), logAction('NOTE_ADDED'), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Note text is required' });

    const noteAuthor = req.user.email;
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

// ──────────────────────────────────────────────
// POST /api/tickets/:id/audit-decrypt — Log evidence decryption
// ──────────────────────────────────────────────
router.post('/:id/audit-decrypt', requireAuth, requireRole(['officer', 'admin']), logAction('EVIDENCE_DECRYPTED'), async (req, res) => {
  res.json({ success: true, message: 'Decryption logged securely.' });
});

// ──────────────────────────────────────────────
// GET /api/tickets/stats — Impact statistics (computed from real data)
// ──────────────────────────────────────────────
router.get('/stats', requireAuth, requireRole(['admin', 'officer']), async (req, res) => {
  try {
    const tickets = await Ticket.find(req.user.role === 'admin' ? {} : { district_id: req.user.jurisdiction });
    
    const total = tickets.length;
    const critical = tickets.filter(t => t.priority === 'Critical').length;
    const rescued = tickets.filter(t => ['RESCUED', 'CWC_PRODUCED', 'REHAB_FOLLOWUP', 'CLOSED'].includes(t.status)).length;
    const dispatched = tickets.filter(t => t.status === 'DISPATCHED').length;
    const breached = tickets.filter(t => t.escalated).length;
    const duplicatesMerged = tickets.reduce((sum, t) => sum + Math.max(0, t.reportCount - 1), 0);
    const hasSynthetic = tickets.some(t => t.isSynthetic);

    // Compute median response times
    const reportToDispatch = [];
    const dispatchToRescue = [];
    
    for (const t of tickets) {
      if (!t.createdAt) continue;
      // For dispatch time, check notes/status transitions
      // Simplified: use slaBreachAt - createdAt as a proxy for now
      if (['DISPATCHED', 'RESCUED', 'CLOSED'].includes(t.status) && t.slaBreachAt) {
        const slaHours = { 'Critical': 1, 'High': 4, 'Medium': 12, 'Low': 24 };
        const expectedHours = slaHours[t.priority] || 12;
        // Compute actual dispatch time as a fraction of SLA
        const ageMs = Date.now() - t.createdAt.getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        if (ageHours < expectedHours * 2) {
          reportToDispatch.push(ageHours);
        }
      }
    }

    const median = (arr) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const slaCompliance = total > 0 ? Math.round(((total - breached) / total) * 100) : 0;

    // Jurisdiction breakdown
    const byJurisdiction = {};
    for (const t of tickets) {
      byJurisdiction[t.district_id] = (byJurisdiction[t.district_id] || 0) + 1;
    }

    // Category breakdown
    const byCategory = {};
    for (const t of tickets) {
      byCategory[t.user_category] = (byCategory[t.user_category] || 0) + 1;
    }

    res.json({
      total,
      critical,
      rescued,
      dispatched,
      breached,
      duplicatesMerged,
      slaCompliance,
      medianResponseHours: median(reportToDispatch),
      rescueRate: total > 0 ? Math.round((rescued / total) * 100) : 0,
      byJurisdiction,
      byCategory,
      hasSynthetic
    });
  } catch (error) {
    console.error('[Stats Error]:', error.message);
    res.status(500).json({ error: 'Failed to compute statistics' });
  }
});

module.exports = router;
