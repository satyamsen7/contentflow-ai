const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const router  = express.Router();
const {
  getTopics, insertTopics, insertTopic,
  deleteTopic, resetTopicStatus
} = require('../database');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 } // 20 MB
});

// ── GET /api/topics ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const topics = await getTopics(req.query.status || null);
    res.json({ success: true, data: topics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/topics/upload — Excel import ────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet     = workbook.Sheets[sheetName];
    const rows      = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const topics = [];
    for (const row of rows) {
      const cell = row[0];
      if (cell != null && String(cell).trim()) {
        topics.push(String(cell).trim());
      }
    }

    if (topics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No topics found. Make sure topics are listed in column A of your Excel file.'
      });
    }

    const inserted = await insertTopics(topics, 'excel');
    res.json({
      success: true,
      message: `Successfully imported ${inserted.length} topic(s)`,
      data:    inserted
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/topics — add single topic ──────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic?.trim()) {
      return res.status(400).json({ success: false, error: 'Topic text is required' });
    }
    const row = await insertTopic(topic.trim(), 'manual');
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/topics/:id ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await deleteTopic(req.params.id);
    res.json({ success: true, message: 'Topic deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/topics/:id/reset — set status back to pending ──────────────────
router.post('/:id/reset', async (req, res) => {
  try {
    await resetTopicStatus(req.params.id);
    res.json({ success: true, message: 'Topic reset to pending' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
