const express = require('express');
const Team = require('../models/Team');
const Ticket = require('../models/Ticket');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/teams - List all teams
router.get('/', requireAuth, async (req, res) => {
  try {
    const teams = await Team.find();
    res.json({ teams });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// GET /api/teams/suggest/:ticketId - Suggest nearest team
router.get('/suggest/:ticketId', requireAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    let query = { status: 'AVAILABLE' };
    
    // If ticket is in railway jurisdiction, prioritize GRP/RPF
    if (ticket.railwayJurisdiction) {
      query.isRailwayPolice = true;
    }

    const suggestedTeams = await Team.find({
      ...query,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: ticket.location.coordinates,
          }
        }
      }
    }).limit(3);

    // Fallback if no railway teams are available
    if (suggestedTeams.length === 0 && ticket.railwayJurisdiction) {
      const fallbackTeams = await Team.find({
        status: 'AVAILABLE',
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: ticket.location.coordinates,
            }
          }
        }
      }).limit(3);
      return res.json({ teams: fallbackTeams });
    }

    res.json({ teams: suggestedTeams });
  } catch (error) {
    console.error('[Team Suggest Error]:', error.message);
    res.status(500).json({ error: 'Failed to suggest team' });
  }
});

module.exports = router;
