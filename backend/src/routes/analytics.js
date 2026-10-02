const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/hotspot-forecast', requireAuth, async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
    
    const response = await fetch('http://localhost:8000/hotspots/forecast', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      throw new Error(`ML API returned ${response.status}`);
    }
  } catch (error) {
    console.warn(`[ML Hotspot Forecast Error]`, error.message);
    res.status(503).json({ error: 'Forecast service unavailable', forecast: [] });
  }
});

module.exports = router;
