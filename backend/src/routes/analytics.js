const express = require('express');
const Ticket = require('../models/Ticket');
const OutcomeLabel = require('../models/OutcomeLabel');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// ──────────────────────────────────────────────
// GET /api/analytics/summary — Dashboard analytics from real DB data
// ──────────────────────────────────────────────
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { district_id: req.user.jurisdiction };
    const tickets = await Ticket.find(filter).lean();

    const total = tickets.length;
    const critical = tickets.filter(t => t.priority === 'Critical').length;
    const high = tickets.filter(t => t.priority === 'High').length;
    const rescued = tickets.filter(t => ['RESCUED', 'CWC_PRODUCED', 'REHAB_FOLLOWUP', 'CLOSED'].includes(t.status)).length;
    const dispatched = tickets.filter(t => t.status === 'DISPATCHED').length;
    const breached = tickets.filter(t => t.escalated).length;
    const duplicatesMerged = tickets.reduce((sum, t) => sum + Math.max(0, (t.reportCount || 1) - 1), 0);
    const hasSynthetic = tickets.some(t => t.isSynthetic);

    // Per-jurisdiction counts
    const byJurisdiction = {};
    for (const t of tickets) {
      byJurisdiction[t.district_id] = (byJurisdiction[t.district_id] || 0) + 1;
    }

    // Per-category counts
    const byCategory = {};
    for (const t of tickets) {
      byCategory[t.user_category] = (byCategory[t.user_category] || 0) + 1;
    }

    // Per-day counts (last 14 days)
    const dailyCounts = {};
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    for (const t of tickets) {
      if (t.createdAt >= fourteenDaysAgo) {
        const day = t.createdAt.toISOString().split('T')[0];
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      }
    }

    // SLA compliance
    const slaCompliance = total > 0 ? Math.round(((total - breached) / total) * 100) : 0;

    // Rescue funnel
    const funnel = {
      REPORTED: tickets.filter(t => t.status === 'REPORTED').length,
      DISPATCHED: dispatched,
      RESCUED: tickets.filter(t => t.status === 'RESCUED').length,
      CLOSED: tickets.filter(t => t.status === 'CLOSED').length,
      REJECTED: tickets.filter(t => t.status === 'REJECTED').length
    };

    // Hourly distribution of critical reports
    const hourlyDistribution = Array(24).fill(0);
    for (const t of tickets) {
      if (t.priority === 'Critical' && t.createdAt) {
        hourlyDistribution[new Date(t.createdAt).getHours()] += 1;
      }
    }

    res.json({
      total, critical, high, rescued, dispatched, breached,
      duplicatesMerged, slaCompliance, hasSynthetic,
      rescueRate: total > 0 ? Math.round((rescued / total) * 100) : 0,
      byJurisdiction, byCategory, dailyCounts, funnel, hourlyDistribution
    });
  } catch (error) {
    console.error('[Analytics Summary Error]:', error.message);
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

// ──────────────────────────────────────────────
// GET /api/analytics/ml-readiness — ML activation status
// ──────────────────────────────────────────────
router.get('/ml-readiness', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const totalLabels = await OutcomeLabel.countDocuments();
    const ACTIVATION_THRESHOLD = 500;

    // Count by jurisdiction
    const labelsByJurisdiction = await OutcomeLabel.aggregate([
      { $group: { _id: '$jurisdiction', count: { $sum: 1 } } }
    ]);

    res.json({
      mode: 'Rule-based',
      totalLabels,
      activationThreshold: ACTIVATION_THRESHOLD,
      readyForML: totalLabels >= ACTIVATION_THRESHOLD,
      labelsByJurisdiction,
      message: totalLabels >= ACTIVATION_THRESHOLD
        ? 'Sufficient labels for ML training. Run ml/retrain_from_db.py to train.'
        : `Need ${ACTIVATION_THRESHOLD - totalLabels} more officer overrides before ML can activate.`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ML readiness' });
  }
});

// ──────────────────────────────────────────────
// GET /api/analytics/outcome-labels/export — CSV export of labels
// ──────────────────────────────────────────────
router.get('/outcome-labels/export', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const labels = await OutcomeLabel.find().lean();
    
    const csvHeader = 'ticketId,suggestedPriority,finalPriority,jurisdiction,category,hour,dayOfWeek,confidenceScore,reportCount,nearRailway,timestamp\n';
    const csvRows = labels.map(l => 
      `${l.ticketId},${l.suggestedPriority},${l.finalPriority},${l.jurisdiction},${l.category},${l.hour || ''},${l.dayOfWeek || ''},${l.confidenceScore || ''},${l.reportCount || ''},${l.nearRailway || false},${l.timestamp.toISOString()}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=outcome_labels_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvHeader + csvRows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export labels' });
  }
});

// ──────────────────────────────────────────────
// GET /api/analytics/zone-risk — Proxy to ML service (if available)
// ──────────────────────────────────────────────
router.get('/zone-risk', requireAuth, async (req, res) => {
  try {
    const mlUrl = process.env.ML_URL || 'http://localhost:8000';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${mlUrl}/zones/risk?horizon=24h`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`ML service returned ${response.status}`);
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    // ML unavailable — return honestly, NEVER fall back to made-up numbers
    res.json({
      available: false,
      message: 'Risk model unavailable. ML service may not be running.',
      zones: []
    });
  }
});

module.exports = router;
