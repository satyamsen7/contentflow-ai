/**
 * services/openrouter.js
 * Text LLM: generates 5 content points + title + description + hashtags in one call.
 */

const axios = require('axios');
const { getCredential } = require('../database');

const BASE_URL      = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it:free';

async function callLLM(messages, opts = {}) {
  const apiKey = await getCredential('openrouter_api_key');
  const model  = (await getCredential('openrouter_model')) || DEFAULT_MODEL;

  if (!apiKey) throw new Error('OpenRouter API key not configured. Go to Credentials → OpenRouter API Key.');

  let response;
  try {
    response = await axios.post(
      `${BASE_URL}/chat/completions`,
      { model, messages, max_tokens: opts.maxTokens || 1500, temperature: 0.7 },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
          'HTTP-Referer':  'http://localhost:5000',
          'X-Title':       'ContentFlow AI'
        },
        timeout: 90000
      }
    );
  } catch (err) {
    if (err.code === 'ECONNABORTED') throw new Error('OpenRouter timed out after 90s. Try a different model in Credentials.');
    if (err.response?.status === 401) throw new Error('OpenRouter API key is invalid or expired.');
    if (err.response?.status === 402) throw new Error('OpenRouter account has no credits. Add credits at openrouter.ai/account');
    if (err.response?.status === 429) throw new Error('OpenRouter rate limit hit. Wait 30s and try again.');
    const body = JSON.stringify(err.response?.data || err.message).slice(0, 200);
    throw new Error(`OpenRouter HTTP ${err.response?.status}: ${body}`);
  }

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`OpenRouter returned empty content. Raw: ${JSON.stringify(response.data).slice(0, 300)}`);
  return content.trim();
}

// ─── Single call → title + description + hashtags + 5 points ─────────────────
async function generateAllContent(topic) {
  const prompt = `You are a professional YouTube content creator. Generate complete content for the topic: "${topic}"

Return your response in EXACTLY this format with these exact labels:

TITLE:
[Catchy YouTube video title, max 80 chars, no hashtags]

DESCRIPTION:
[2 short engaging sentences about the topic, no hashtags]

HASHTAGS:
[15 relevant hashtags starting with #, space-separated on one line]

POINTS:
[point 1 — max 10 words]
[point 2 — max 10 words]
[point 3 — max 10 words]
[point 4 — max 10 words]
[point 5 — max 10 words]`;

  const raw = await callLLM([{ role: 'user', content: prompt }], { maxTokens: 2000 });

  // Log raw output to server console for debugging
  console.log('\n──── RAW LLM OUTPUT ────');
  console.log(raw);
  console.log('────────────────────────\n');

  // ── Robust line-by-line section parser ────────────────────────────────────
  const HEADERS = ['TITLE', 'DESCRIPTION', 'HASHTAGS', 'POINTS'];
  const sections = {};
  let currentSection = null;
  let buffer = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    const headerMatch = HEADERS.find(h =>
      new RegExp(`^\\*{0,2}#{0,2}\\s*${h}\\s*\\*{0,2}\\s*:`, 'i').test(trimmed)
    );

    if (headerMatch) {
      if (currentSection) sections[currentSection] = buffer.join('\n').trim();
      currentSection = headerMatch;
      buffer = [];
      const afterColon = trimmed.replace(new RegExp(`^\\*{0,2}#{0,2}\\s*${headerMatch}\\s*\\*{0,2}\\s*:`, 'i'), '').trim();
      if (afterColon) buffer.push(afterColon);
    } else if (currentSection) {
      buffer.push(line);
    }
  }
  if (currentSection) sections[currentSection] = buffer.join('\n').trim();

  console.log('📦 Sections found:', Object.keys(sections));
  console.log('   TITLE:', (sections['TITLE'] || '').slice(0, 60));
  console.log('   DESCRIPTION:', (sections['DESCRIPTION'] || '').slice(0, 80));
  console.log('   HASHTAGS:', (sections['HASHTAGS'] || '').slice(0, 60));
  console.log('   POINTS:', (sections['POINTS'] || '').split('\n').length, 'lines');

  // ── Extract fields ─────────────────────────────────────────────────────────
  const title = (sections['TITLE'] || '')
    .split('\n')[0]
    .replace(/^\*+|\*+$/g, '').replace(/^#+\s*/, '')
    .replace(/#\w+/g, '').replace(/^\[|\]$/g, '').trim() || topic;

  const description = (sections['DESCRIPTION'] || '').replace(/#\w+/g, '').trim();

  const hashRaw  = sections['HASHTAGS'] || '';
  const hashtags = [...new Set(hashRaw.match(/#[a-zA-Z0-9_]+/g) || [])].slice(0, 20).join(' ');

  const pointsRaw = sections['POINTS'] || '';
  const points = pointsRaw
    .split('\n')
    .map(l => l.replace(/^[-•*\[\]\d.)]+\s*/, '').replace(/^\[|\]$/g, '').trim())
    .filter(l => l.length > 3)
    .slice(0, 5);
  while (points.length < 5) points.push(points[points.length - 1] || topic);

  console.log(`📊 Final → title="${title}" | points=${points.length} | desc=${description.length}chars | tags=${hashtags.split(' ').filter(Boolean).length}`);

  if (!title && points.length === 0) {
    throw new Error(`OpenRouter returned unparseable content. Raw: "${raw.slice(0, 200)}"`);
  }

  return { points, title, description, hashtags };
}
async function testConnection() {
  const content = await callLLM([{ role: 'user', content: 'Reply with just: OK' }]);
  return content.length > 0;
}

module.exports = { generateAllContent, testConnection };
