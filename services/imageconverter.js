/**
 * services/imageconverter.js
 * Converts a JPEG/PNG image buffer into an MP4 video using FFmpeg.
 * If an audio file is provided, the video duration will match the audio duration,
 * and the audio will be merged into the video.
 */

const ffmpeg     = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath= require('ffprobe-static').path;
const fs         = require('fs');
const path       = require('path');
const os         = require('os');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Gets the duration of an audio file in seconds.
 * @param {string} filePath 
 * @returns {Promise<number>}
 */
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`Failed to read audio duration: ${err.message}`));
      const duration = metadata.format.duration;
      if (!duration) return reject(new Error('Audio has no duration data'));
      resolve(duration);
    });
  });
}

/**
 * Convert an image buffer to an MP4 video buffer.
 * @param {Buffer} imageBuffer  - JPEG or PNG image
 * @param {string} [audioPath]  - Path to TTS audio file (optional)
 * @returns {Promise<Buffer>}   - MP4 video buffer
 */
async function imageToVideo(imageBuffer, audioPath = null) {
  const tmpImg = path.join(os.tmpdir(), `cf_img_${Date.now()}.jpg`);
  const tmpVid = path.join(os.tmpdir(), `cf_vid_${Date.now()}.mp4`);

  // Write image to temp file
  fs.writeFileSync(tmpImg, imageBuffer);

  let duration = 30; // default duration

  if (audioPath && fs.existsSync(audioPath)) {
    try {
      duration = await getAudioDuration(audioPath);
      // Add a small buffer (0.5s) to ensure the audio doesn't cut off abruptly
      duration = Math.ceil(duration) + 0.5;
    } catch (err) {
      console.warn(`⚠️ Could not determine audio length, falling back to 30s. (${err.message})`);
    }
  }

  console.log(`🎞️  Converting image to ${duration}s video with FFmpeg…`);

  try {
    await new Promise((resolve, reject) => {
      const totalFrames = Math.ceil(duration * 30);

      let command = ffmpeg()
        .input(tmpImg)
        .inputOptions([
          '-loop 1',
          '-framerate 30'
        ]);

      if (audioPath && fs.existsSync(audioPath)) {
        command = command.input(audioPath);
      }

      command
        .videoFilter(
          // Ken Burns: slow zoom from 1.0x to 1.3x centred on the image
          `zoompan=` +
          `z='min(zoom+0.0010,1.3)':` +
          `d=${totalFrames}:` +
          `x='iw/2-(iw/zoom/2)':` +
          `y='ih/2-(ih/zoom/2)':` +
          `s=1080x1080,` +
          // Fade in (first 60 frames = 2s) and fade out (last 60 frames = 2s)
          `fade=t=in:st=0:d=2,` +
          `fade=t=out:st=${duration - 2}:d=2`
        )
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 22',
          '-pix_fmt yuv420p',
          `-t ${duration}`,
          '-movflags +faststart'    // optimise for streaming
        ]);

      if (audioPath && fs.existsSync(audioPath)) {
        // Map both video from input 0 and audio from input 1
        command = command.outputOptions([
          '-c:a aac',
          '-b:a 192k',
          '-map 0:v:0',
          '-map 1:a:0'
        ]);
      }

      command
        .on('progress', (p) => {
          if (p.percent) process.stdout.write(`\r   FFmpeg: ${Math.round(p.percent)}%`);
        })
        .on('end', () => {
          process.stdout.write('\n');
          resolve();
        })
        .on('error', (err) => {
          process.stdout.write('\n');
          reject(new Error(`FFmpeg conversion failed: ${err.message}`));
        })
        .save(tmpVid);
    });

    const videoBuffer = fs.readFileSync(tmpVid);
    console.log(`✅ Video created (${Math.round(videoBuffer.length / 1024 / 1024 * 10) / 10}MB, ${duration}s)`);
    return videoBuffer;

  } finally {
    // Always clean up temp files
    try { fs.unlinkSync(tmpImg); } catch (_) {}
    try { fs.unlinkSync(tmpVid); } catch (_) {}
  }
}

module.exports = { imageToVideo };
