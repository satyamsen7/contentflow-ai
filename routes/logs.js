const express    = require('express');
const router     = express.Router();
const { getLogs }   = require('../database');
const { addClient } = require('../sse');

// ── GET /api/logs/stream — Server-Sent Events (live) ─────────────────────────
router.get('/stream', (req, res) => {
  const cleanup = addClient(res);
  req.on('close',   cleanup);
  req.on('aborted', cleanup);
});

// ── GET /api/logs ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filters = {
      level:   req.query.level   || null,
      post_id: req.query.post_id ? Number(req.query.post_id) : null,
      limit:   req.query.limit   ? Number(req.query.limit)  : 300
    };
    const logs = await getLogs(filters);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
