/**
 * services/youtube.js
 * Upload and publish videos to YouTube using OAuth2 (Client ID + Secret + Refresh Token).
 */

const { google }  = require('googleapis');
const { Readable } = require('stream');
const axios        = require('axios');
const { getCredential } = require('../database');

// ─── Build authenticated YouTube client ───────────────────────────────────────
async function getYouTubeClient() {
  const clientId     = await getCredential('youtube_client_id');
  const clientSecret = await getCredential('youtube_client_secret');
  const refreshToken = await getCredential('youtube_refresh_token');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'YouTube credentials not configured. ' +
      'Go to Credentials → YouTube and add Client ID, Client Secret, and Refresh Token.'
    );
  }

  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground'
  );
  oauth2.setCredentials({ refresh_token: refreshToken });

  return google.youtube({ version: 'v3', auth: oauth2 });
}

// ─── Upload a video to YouTube ────────────────────────────────────────────────
/**
 * @param {string} videoUrl   - URL of the generated video to download and upload
 * @param {string} title      - YouTube video title
 * @param {string} description - YouTube video description
 * @param {string} hashtags   - Space-separated hashtag string (#tag1 #tag2 …)
 * @returns {{ videoId: string, url: string }}
 */
async function uploadVideo(videoUrl, title, description, hashtags) {
  const youtube = await getYouTubeClient();

  // Parse hashtags into tags array (strip the # prefix)
  const tags = (hashtags.match(/#[a-zA-Z0-9_]+/g) || [])
    .map(t => t.slice(1))
    .slice(0, 30);

  // Full description = description + hashtags footer
  const fullDescription = `${description}\n\n${hashtags}`.trim().slice(0, 5000);
  const videoTitle      = title.trim().slice(0, 100);

  console.log(`📺 Downloading video for YouTube upload…`);
  let videoBuffer;
  try {
    const res  = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 180000 });
    videoBuffer = Buffer.from(res.data);
    console.log(`✅ Video downloaded (${Math.round(videoBuffer.length / 1024 / 1024)}MB)`);
  } catch (err) {
    throw new Error(`Failed to download video for upload: ${err.message}`);
  }

  const videoStream = Readable.from(videoBuffer);

  console.log(`📤 Uploading to YouTube: "${videoTitle}"`);

  let result;
  try {
    result = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title:           videoTitle,
          description:     fullDescription,
          tags:            tags,
          categoryId:      '22',   // People & Blogs
          defaultLanguage: 'en'
        },
        status: {
          privacyStatus:            'public',
          selfDeclaredMadeForKids:  false
        }
      },
      media: {
        mimeType: 'video/mp4',
        body:     videoStream
      }
    });
  } catch (err) {
    const msg = err?.message || err?.errors?.[0]?.message || JSON.stringify(err).slice(0, 200);
    throw new Error(`YouTube upload failed: ${msg}`);
  }

  const videoId  = result.data.id;
  const videoUrl_ = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`✅ YouTube upload complete: ${videoUrl_}`);
  return { videoId, url: videoUrl_ };
}

// ─── Test connection ──────────────────────────────────────────────────────────
async function testConnection() {
  const youtube = await getYouTubeClient();
  const res     = await youtube.channels.list({ part: ['snippet'], mine: true });
  const channel = res.data.items?.[0]?.snippet?.title;
  if (!channel) throw new Error('Connected to YouTube but no channel found on this account.');
  return channel;
}

module.exports = { uploadVideo, testConnection };
