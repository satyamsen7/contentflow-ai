/**
 * services/cloudinary.js
 * Handles image (base64) and video (buffer) uploads to Cloudinary.
 */

const cloudinaryPkg = require('cloudinary');
const { Readable }  = require('stream');
const { getCredential } = require('../database');

const cloudinary = cloudinaryPkg.v2;

async function configureCloudinary() {
  const cloudName  = await getCredential('cloudinary_cloud_name');
  const apiKey     = await getCredential('cloudinary_api_key');
  const apiSecret  = await getCredential('cloudinary_api_secret');

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured. Go to Credentials → Cloudinary.');
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

// ─── Upload image from base64 ─────────────────────────────────────────────────
async function uploadImage(base64, mimeType = 'image/jpeg') {
  await configureCloudinary();

  let result;
  try {
    result = await cloudinary.uploader.upload(`data:${mimeType};base64,${base64}`, {
      folder:        'contentflow-ai/images',
      resource_type: 'image'
    });
  } catch (err) {
    const msg = err?.message || err?.error?.message ||
      (err?.http_code ? `Cloudinary HTTP ${err.http_code}` : null) ||
      JSON.stringify(err).slice(0, 200);
    throw new Error(`Cloudinary image upload failed: ${msg}`);
  }

  if (!result?.secure_url) throw new Error('Cloudinary returned no image URL.');
  console.log(`✅ Image on Cloudinary: ${result.secure_url}`);
  return result.secure_url;
}

// ─── Upload video from Buffer (stream-based) ──────────────────────────────────
async function uploadVideoBuffer(videoBuffer) {
  await configureCloudinary();

  console.log(`☁️  Uploading video buffer to Cloudinary (${Math.round(videoBuffer.length / 1024 / 1024 * 10) / 10}MB)…`);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:        'contentflow-ai/videos',
        resource_type: 'video'
      },
      (error, result) => {
        if (error) {
          const msg = error?.message || JSON.stringify(error).slice(0, 200);
          return reject(new Error(`Cloudinary video upload failed: ${msg}`));
        }
        if (!result?.secure_url) return reject(new Error('Cloudinary returned no video URL.'));
        console.log(`✅ Video on Cloudinary: ${result.secure_url}`);
        resolve(result.secure_url);
      }
    );

    // Pipe buffer as stream
    const readable = new Readable();
    readable.push(videoBuffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

// ─── Upload video from remote URL ─────────────────────────────────────────────
async function uploadVideoFromUrl(videoUrl) {
  await configureCloudinary();

  let result;
  try {
    result = await cloudinary.uploader.upload(videoUrl, {
      folder:        'contentflow-ai/videos',
      resource_type: 'video'
    });
  } catch (err) {
    const msg = err?.message || err?.error?.message ||
      (err?.http_code ? `Cloudinary HTTP ${err.http_code}` : null) ||
      JSON.stringify(err).slice(0, 200);
    throw new Error(`Cloudinary video upload failed: ${msg}`);
  }

  if (!result?.secure_url) throw new Error('Cloudinary returned no video URL.');
  console.log(`✅ Video on Cloudinary: ${result.secure_url}`);
  return result.secure_url;
}

module.exports = { uploadImage, uploadVideoBuffer, uploadVideoFromUrl };
