/**
 * pipeline.js
 * ContentFlow AI — YouTube Video Automation Pipeline
 *
 *   Step 1. OpenRouter (text)   → 5 points + title + description + hashtags
 *   Step 2. OpenRouter (FLUX)   → background image + frosted overlay with 5 points
 *   Step 3. Cloudinary          → upload image (permanent image URL)
 *   Step 4. FFmpeg              → convert image to 30s Ken Burns MP4 video
 *   Step 5. Cloudinary + YouTube→ upload video to Cloudinary, then publish to YouTube
 */

const { createPost, updatePost, updateTopicStatus, createLog } = require('./database');
const openrouter = require('./services/openrouter');
const imageRouter = require('./services/imagegenrouter');
const imageConverter = require('./services/imageconverter');
const cloudinary = require('./services/cloudinary');
const youtube = require('./services/youtube');

async function log(postId, level, message) {
  const prefix = `[${level.toUpperCase()}][Post ${postId}]`;
  console.log(`${prefix} ${message}`);
  await createLog(postId, level, message);
}

async function runPipeline(topicRecord, existingPostId = null) {
  let postId = existingPostId;

  if (!postId) {
    const post = await createPost({
      topic_id: topicRecord.id || null,
      topic: topicRecord.topic,
      status: 'generating',
      created_at: new Date().toISOString()
    });
    postId = post.id;
  } else {
    await updatePost(postId, { status: 'generating' });
  }

  try {
    await log(postId, 'info', `🚀 Pipeline started → "${topicRecord.topic}"`);

    // ── Step 1: Generate content ──────────────────────────────────────────────
    await log(postId, 'info', '📝 [1/5] Generating content via OpenRouter…');
    const { points, title, description, hashtags } =
      await openrouter.generateAllContent(topicRecord.topic);

    await updatePost(postId, { title, description, hashtags, content_points: points });

    await log(postId, 'info', '✅ Content generated!');
    await log(postId, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await log(postId, 'info', `🎬 TITLE: ${title}`);
    await log(postId, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await log(postId, 'info', '📋 CONTENT POINTS:');
    for (let i = 0; i < points.length; i++) {
      await log(postId, 'info', `   ${i + 1}. ${points[i]}`);
    }
    await log(postId, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await log(postId, 'info', `📄 DESCRIPTION: ${description.slice(0, 200)}…`);
    await log(postId, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await log(postId, 'info', `#️⃣  HASHTAGS: ${hashtags}`);
    await log(postId, 'info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ── Step 2: Generate TTS Audio (EdgeTTS) ──────────────────────────────────
    await log(postId, 'info', '🔊 [2/6] Generating voiceover via Edge-TTS…');
    const { EdgeTTS } = require('node-edge-tts');
    const tts = new EdgeTTS({ voice: 'en-US-ChristopherNeural' });
    const os = require('os');
    const path = require('path');
    const fs = require('fs');

    const tempAudioPath = path.join(os.tmpdir(), `cf_audio_${Date.now()}.mp3`);
    // Create the TTS script by concatenating topic and points
    const ttsScript = `${title}. ` + points.map((p, i) => `Point ${i + 1}. ${p}.`).join(' ');

    await tts.ttsPromise(ttsScript, tempAudioPath);
    await log(postId, 'info', `✅ Voiceover generated!`);

    // ── Step 3: Generate image (FLUX background + overlay) ───────────────────
    await log(postId, 'info', '🎨 [3/6] Generating image via OpenRouter FLUX…');
    await log(postId, 'info', '   ⏳ This takes 30-90s…');
    const { base64: imageBase64, mimeType } =
      await imageRouter.generateImage(topicRecord.topic, points);
    await log(postId, 'info', `✅ Image generated with overlay`);

    // ── Step 4: Upload image to Cloudinary ────────────────────────────────────
    await log(postId, 'info', '☁️  [4/6] Uploading image to Cloudinary…');
    const imageUrl = await cloudinary.uploadImage(imageBase64, mimeType);
    await updatePost(postId, { image_url: imageUrl });
    await log(postId, 'info', `✅ Image stored: ${imageUrl}`);

    // ── Step 5: Convert image to video using FFmpeg + TTS Audio ───────────────
    await log(postId, 'info', '🎞️  [5/6] Converting to video with FFmpeg + voiceover…');
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const videoBuffer = await imageConverter.imageToVideo(imageBuffer, tempAudioPath);

    // Cleanup temp audio file
    try { fs.unlinkSync(tempAudioPath); } catch (_) { }

    await log(postId, 'info', `✅ Video created (${Math.round(videoBuffer.length / 1024 / 1024 * 10) / 10}MB)`);

    // ── Step 6a: Upload video to Cloudinary ───────────────────────────────────
    await log(postId, 'info', '☁️  [6/6] Uploading video to Cloudinary…');
    const cloudinaryVideoUrl = await cloudinary.uploadVideoBuffer(videoBuffer);
    await log(postId, 'info', `✅ Video on Cloudinary: ${cloudinaryVideoUrl}`);

    // ── Step 6b: Upload video to YouTube ──────────────────────────────────────

    await log(postId, 'info', '📺 [6/6] Publishing video to YouTube…');
    const { videoId, url: youtubeUrl } = await youtube.uploadVideo(
      cloudinaryVideoUrl, title, description, hashtags
    );


    // ── Done ──────────────────────────────────────────────────────────────────
    await updatePost(postId, {
      instagram_media_id: videoId,
      image_url: youtubeUrl,
      status: 'posted',
      posted_at: new Date().toISOString(),
      error_message: null
    });
    if (topicRecord.id) await updateTopicStatus(topicRecord.id, 'used');

    await log(postId, 'info', `🎉 SUCCESS! YouTube Video ID: ${videoId}`);
    await log(postId, 'info', `   ▶️  Watch: ${youtubeUrl}`);

    return { success: true, postId, imageUrl, videoUrl: youtubeUrl, videoId };

  } catch (err) {
    const msg = err?.message || JSON.stringify(err) || 'Unknown error';
    await updatePost(postId, { status: 'failed', error_message: msg });
    if (topicRecord.id) await updateTopicStatus(topicRecord.id, 'failed');
    await log(postId, 'error', `❌ Pipeline failed: ${msg}`);
    throw err;
  }
}

module.exports = { runPipeline };
