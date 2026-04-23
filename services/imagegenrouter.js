/**
 * services/imagegenrouter.js
 * Step 1: FLUX (OpenRouter) generates a beautiful background image
 * Step 2: sharp composites a frosted-glass card + 5 bullet points on top
 * Returns { base64, mimeType } for Cloudinary upload.
 */

const axios  = require('axios');
const sharp  = require('sharp');
const { getCredential } = require('../database');

const DEFAULT_MODEL = 'black-forest-labs/flux-1.1-pro';

// ─── Main export ─────────────────────────────────────────────────────────────
async function generateImage(topic, points) {
  const apiKey = (await getCredential('openrouter_image_api_key'))
              || (await getCredential('openrouter_api_key'));
  const model  = (await getCredential('openrouter_image_model')) || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error('OpenRouter image API key not configured. Go to Credentials → OpenRouter Image API Key.');
  }

  // ── 1. Generate background via FLUX ────────────────────────────────────────
  const bgPrompt =
    `A stunning, vibrant, professional background (exact square 1:1) about: "${topic}". ` +
    `Composition: outer edges and corners are richly detailed and colorful, but the CENTER ` +
    `of the image is slightly softer and darker so a text card placed there will be readable. ` +
    `Like a picture frame — vivid borders, calm center. ` +
    `Style: cinematic, rich bold colors, depth of field, professional photography. ` +
    `Absolutely no text, no words, no letters, no numbers anywhere in the image.`;

  console.log(`🎨 Generating background via ${model}…`);

  const response = await callFlux(apiKey, model, bgPrompt);
  const imageUrl = extractImageUrl(response);
  if (!imageUrl) {
    const raw = JSON.stringify(response.data).slice(0, 400);
    throw new Error(`OpenRouter returned no image URL. Raw: ${raw}`);
  }

  // ── 2. Download background to buffer ───────────────────────────────────────
  console.log(`📥 Downloading background image…`);
  const bgBuffer = await downloadImage(imageUrl);

  // ── 3. Resize to 1080×1080 square ──────────────────────────────────────────
  const bgResized = await sharp(bgBuffer)
    .resize(1080, 1080, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  // ── 4. Composite SVG overlay (frosted card + 5 points) ─────────────────────
  const overlay = buildOverlaySvg(1080, 1080, topic, points.slice(0, 5));

  // ── 5. Final composite ─────────────────────────────────────────────────────
  const final = await sharp(bgResized)
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();

  console.log(`✅ Image composited (${Math.round(final.length / 1024)}KB)`);
  return { base64: final.toString('base64'), mimeType: 'image/jpeg' };
}

// ─── SVG overlay — frosted glass card centred with 5 points ──────────────────
function buildOverlaySvg(W, H, topic, points) {
  const cardW = Math.round(W * 0.82);
  const cardH = Math.round(H * 0.52);
  const cardX = Math.round((W - cardW) / 2);
  const cardY = Math.round((H - cardH) / 2);  // true vertical centre

  const radius    = 28;
  const pad       = 30;
  const titleSize = 24;
  const pointSize = 20;
  const lineGap   = pointSize * 1.72;
  const startY    = cardY + pad + titleSize + 20;

  const textLines = points.map((pt, i) => {
    const maxChars = Math.floor((cardW - pad * 2 - 20) / (pointSize * 0.52));
    const label    = pt.length > maxChars ? pt.slice(0, maxChars - 1) + '…' : pt;
    const y        = startY + i * lineGap;
    return `
      <text x="${cardX + pad}" y="${y}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${pointSize}" font-weight="500"
            fill="white" opacity="0.95">
        <tspan fill="#FFD700" font-weight="bold">▶ </tspan>${escXml(label)}
      </text>`;
  }).join('\n');

  const topicLabel = topic.length > 38 ? topic.slice(0, 35) + '…' : topic;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="vignette" cx="50%" cy="50%" r="55%">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Centre vignette for readability -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#vignette)"/>

  <!-- Frosted glass card -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}"
        rx="${radius}" ry="${radius}"
        fill="rgba(0,0,0,0.52)"
        stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>

  <!-- Gold top accent line -->
  <line x1="${cardX + radius}" y1="${cardY}"
        x2="${cardX + cardW - radius}" y2="${cardY}"
        stroke="rgba(255,215,0,0.75)" stroke-width="2"/>

  <!-- Topic label -->
  <text x="${cardX + pad}" y="${cardY + pad + titleSize - 4}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${titleSize}" font-weight="bold"
        fill="white" opacity="0.7" letter-spacing="0.5">
    ${escXml(topicLabel.toUpperCase())}
  </text>

  <!-- Divider -->
  <line x1="${cardX + pad}" y1="${cardY + pad + titleSize + 4}"
        x2="${cardX + cardW - pad}" y2="${cardY + pad + titleSize + 4}"
        stroke="rgba(255,255,255,0.25)" stroke-width="1"/>

  <!-- 5 content points -->
  ${textLines}
</svg>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function callFlux(apiKey, model, prompt) {
  try {
    return await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      { model, messages: [{ role: 'user', content: prompt }] },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
          'HTTP-Referer':  'http://localhost:5000',
          'X-Title':       'ContentFlow AI'
        },
        timeout: 120000
      }
    );
  } catch (err) {
    if (err.code === 'ECONNABORTED') throw new Error('Image generation timed out (120s). Wait and retry.');
    if (err.response?.status === 401) throw new Error('OpenRouter image API key is invalid.');
    if (err.response?.status === 402) throw new Error('OpenRouter has no credits for image generation.');
    if (err.response?.status === 429) throw new Error('Image rate limit hit. Wait and retry.');
    const body = JSON.stringify(err.response?.data || err.message).slice(0, 200);
    throw new Error(`OpenRouter image HTTP ${err.response?.status}: ${body}`);
  }
}

function extractImageUrl(response) {
  const message = response.data?.choices?.[0]?.message;

  // FLUX format: message.images[]
  if (Array.isArray(message?.images)) {
    for (const img of message.images) {
      const url = img?.image_url?.url || img?.url;
      if (url) return url;
    }
  }
  // Content array
  if (Array.isArray(message?.content)) {
    for (const part of message.content) {
      if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url;
    }
  }
  // String URL
  if (typeof message?.content === 'string' && message.content.startsWith('http')) return message.content.trim();
  // data[] format
  return response.data?.data?.[0]?.url || null;
}

async function downloadImage(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  return Buffer.from(res.data);
}

function escXml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

module.exports = { generateImage };
