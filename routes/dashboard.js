const express = require('express');
const router  = express.Router();
const { getDashboardStats, getSchedule } = require('../database');

// ── GET /api/dashboard ────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const [stats, schedule] = await Promise.all([
      getDashboardStats(),
      getSchedule()
    ]);
    return res.json({ success: true, data: { ...stats, schedule } });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message.includes('SUPABASE')
        ? 'Supabase is not connected. Please update SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file and restart the server.'
        : err.message
    });
  }
});

module.exports = router;
