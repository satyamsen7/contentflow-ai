const express = require('express');
const router  = express.Router();
const { getSchedule, upsertSchedule } = require('../database');
const { restartScheduler } = require('../scheduler');

// ── GET /api/schedule ─────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const schedule = await getSchedule();
    res.json({
      success: true,
      data:    schedule || { days: [], time: '09:00', active: false }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/schedule ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { days, time, active } = req.body;

    if (!Array.isArray(days)) {
      return res.status(400).json({ success: false, error: 'days must be an array' });
    }
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ success: false, error: 'time must be in HH:MM format' });
    }

    await upsertSchedule(days, time, active !== false);
    await restartScheduler();

    res.json({ success: true, message: 'Schedule saved and activated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
