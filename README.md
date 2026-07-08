# Reel Render Service

Ek chhota Vercel serverless endpoint jo scene images + audio (base64) leke ek vertical (1080x1920)
Instagram Reel MP4 banata hai (Ken Burns zoom + per-scene audio), phir Cloudinary pe upload karke
public video URL return karta hai.

## Deploy (one-time, ~2 min)

1. Free Cloudinary account banao: https://cloudinary.com/users/register/free
   - Dashboard se apna **Cloud Name** copy karo.
   - Settings → Upload → Upload presets → "Add upload preset" → **Signing Mode: Unsigned** → Save. Preset name copy karo.
2. Is folder ko GitHub repo me push karo (ya naya Vercel project banao aur ye folder import karo).
3. Vercel project settings → Environment Variables me add karo:
   - `CLOUDINARY_CLOUD_NAME` = tumhara cloud name
   - `CLOUDINARY_UPLOAD_PRESET` = tumhara unsigned preset name
4. Deploy. Tumhe ek URL milega jaise `https://reel-render-service.vercel.app`.

## Usage

```
POST https://<your-deployment>.vercel.app/api/render
Content-Type: application/json

{
  "scenes": [
    { "scene_number": 1, "duration_seconds": 5, "image_base64": "...", "audio_base64": "..." }
  ]
}
```

Response:
```json
{ "video_url": "https://res.cloudinary.com/.../reel.mp4" }
```

## Notes

- `maxDuration: 300` Vercel Pro plan pe zaroori ho sakta hai lambe reels ke liye; Hobby plan par
  agar timeout error aaye to scenes ki sankhya kam karo ya Pro plan le lo.
- Function cold-start + ffmpeg processing me 20-60 seconds lag sakte hain per request — normal hai.
