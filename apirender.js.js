const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;

function b64ToFile(b64, filePath) {
  const clean = b64.includes(',') ? b64.split(',').pop() : b64;
  fs.writeFileSync(filePath, Buffer.from(clean, 'base64'));
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(args.image)
      .loop(args.duration)
      .input(args.audio)
      .outputOptions([
        '-vf', "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0015,1.15)':d=1:s=1080x1920",
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-shortest'
      ])
      .duration(args.duration)
      .output(args.output)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

function concatClips(clipPaths, listPath, output) {
  fs.writeFileSync(listPath, clipPaths.map((p) => `file '${p}'`).join('\n'));
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(output)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

async function uploadToCloudinary(filePath) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET env vars');
  }
  const form = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  form.append('file', new Blob([fileBuffer], { type: 'video/mp4' }), 'reel.mp4');
  form.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, {
    method: 'POST',
    body: form
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error('Cloudinary upload failed: ' + JSON.stringify(data));
  return data.secure_url;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const tmp = os.tmpdir();
  const jobId = Date.now().toString();
  try {
    const { scenes } = req.body;
    if (!Array.isArray(scenes) || scenes.length === 0) {
      res.status(400).json({ error: 'scenes[] required' });
      return;
    }

    const clipPaths = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imagePath = path.join(tmp, `${jobId}_img_${i}.jpg`);
      const audioPath = path.join(tmp, `${jobId}_aud_${i}.mp3`);
      const clipPath = path.join(tmp, `${jobId}_clip_${i}.mp4`);
      b64ToFile(scene.image_base64, imagePath);
      b64ToFile(scene.audio_base64, audioPath);
      await runFfmpeg({
        image: imagePath,
        audio: audioPath,
        duration: scene.duration_seconds || 5,
        output: clipPath
      });
      clipPaths.push(clipPath);
    }

    const listPath = path.join(tmp, `${jobId}_list.txt`);
    const finalPath = path.join(tmp, `${jobId}_final.mp4`);
    await concatClips(clipPaths, listPath, finalPath);

    const videoUrl = await uploadToCloudinary(finalPath);

    res.status(200).json({ video_url: videoUrl });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
