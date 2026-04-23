const express = require('express');
const router  = express.Router();
const { getCredentials, upsertCredential } = require('../database');
const { testConnection: testOpenRouter } = require('../services/openrouter');
const { testConnection: testYouTube }    = require('../services/youtube');

const ALL_KEYS = [
  // Text LLM
  'openrouter_api_key',
  'openrouter_model',
  // Image gen (FLUX)
  'openrouter_image_api_key',
  'openrouter_image_model',
  // Cloudinary
  'cloudinary_cloud_name',
  'cloudinary_api_key',
  'cloudinary_api_secret',
  // YouTube
  'youtube_client_id',
  'youtube_client_secret',
  'youtube_refresh_token'
];

const MASKED_KEYS = new Set([
  'openrouter_api_key',
  'openrouter_image_api_key',
  'cloudinary_api_secret',
  'youtube_client_secret',
  'youtube_refresh_token'
]);

// ── GET /api/credentials ──────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const rows   = await getCredentials();
    const lookup = Object.fromEntries(rows.map(r => [r.key_name, r.key_value]));
    const data   = {};
    for (const key of ALL_KEYS) {
      const val = lookup[key] || '';
      data[key] = MASKED_KEYS.has(key) && val ? '••••••••' : val;
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/credentials ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (ALL_KEYS.includes(key) && value && value !== '••••••••') {
        await upsertCredential(key, value);
      }
    }
    res.json({ success: true, message: 'Credentials saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/credentials/test-openrouter ────────────────────────────────────
router.post('/test-openrouter', async (req, res) => {
  try {
    const { api_key, model } = req.body;
    if (!api_key) return res.status(400).json({ success: false, error: 'API key is required' });
    await upsertCredential('openrouter_api_key', api_key);
    if (model) await upsertCredential('openrouter_model', model);
    await testOpenRouter();
    res.json({ success: true, message: '✅ OpenRouter connection successful!' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /api/credentials/test-youtube ───────────────────────────────────────
router.post('/test-youtube', async (req, res) => {
  try {
    const { client_id, client_secret, refresh_token } = req.body;
    if (!client_id || !client_secret || !refresh_token) {
      return res.status(400).json({ success: false, error: 'All three YouTube fields are required' });
    }
    await upsertCredential('youtube_client_id',     client_id);
    await upsertCredential('youtube_client_secret', client_secret);
    await upsertCredential('youtube_refresh_token', refresh_token);
    const channel = await testYouTube();
    res.json({ success: true, message: `✅ Connected to YouTube channel: "${channel}"` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
