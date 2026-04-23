const express = require('express');
const router  = express.Router();
const { getPosts, insertTopic, createPost } = require('../database');
const { runPipeline } = require('../pipeline');

// ── GET /api/posts ────────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const posts = await getPosts(100);
    res.json({ success: true, data: posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/posts/instant ───────────────────────────────────────────────────
// Immediately start the pipeline — does NOT add to the Topics list
router.post('/instant', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic?.trim()) {
      return res.status(400).json({ success: false, error: 'Topic is required' });
    }

    // Use a plain object — id: null means the pipeline won't touch the topics table
    const topicRecord = { id: null, topic: topic.trim() };

    // Respond immediately — pipeline runs in background
    res.json({
      success: true,
      message: 'Pipeline started! Check the Logs page for real-time progress.'
    });

    // Fire and forget
    runPipeline(topicRecord).catch(err =>
      console.error('Instant pipeline error:', err.message)
    );
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/posts/schedule-one ─────────────────────────────────────────────
// Schedule a one-time post for a specific future datetime
router.post('/schedule-one', async (req, res) => {
  try {
    const { topic, scheduledAt } = req.body;

    if (!topic?.trim()) {
      return res.status(400).json({ success: false, error: 'Topic is required' });
    }
    if (!scheduledAt) {
      return res.status(400).json({ success: false, error: 'scheduledAt datetime is required' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error:   'scheduledAt must be a valid future datetime'
      });
    }

    const topicRecord = await insertTopic(topic.trim(), 'manual');
    const post = await createPost({
      topic_id:     topicRecord.id,
      topic:        topicRecord.topic,
      status:       'pending',
      scheduled_at: scheduledDate.toISOString(),
      created_at:   new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Post scheduled for ${scheduledDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      data:    post
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
