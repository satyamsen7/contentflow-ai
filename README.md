# ContentFlow AI 🚀

ContentFlow AI is an automated, end-to-end content generation and publishing pipeline. It takes simple text topics (either scheduled from an Excel sheet or entered manually) and transforms them into professional, voice-narrated YouTube videos with stunning dynamic visuals.

## How It Works (The 6-Step Pipeline)

1. **Content Generation:** Uses OpenRouter LLM (e.g., Llama/GPT-4) to generate a high-converting Title, Description, Hashtags, and a 5-point script from a single topic.
2. **Voiceover Synthesis:** Uses Edge-TTS (Microsoft Azure TTS engine) to generate a high-quality, natural-sounding voiceover (`en-US-ChristopherNeural`) reading the generated script.
3. **Image Generation:** Uses OpenRouter FLUX to generate a gorgeous, high-resolution background image and composites a frosted-glass text card displaying the 5 points over it.
4. **Cloud Storage (Image):** Uploads the raw generated image to Cloudinary for safekeeping and dashboard display.
5. **Video Synthesis:** Uses FFmpeg to merge the static image with the TTS voiceover, matching the exact video length to the audio duration and applying a dynamic Ken Burns (slow zoom) effect and fade-out.
6. **YouTube Publishing:** Automatically uploads the final video to YouTube via the official YouTube Data API and updates the local Supabase database with the resulting YouTube link.

## Tech Stack

- **Backend:** Node.js, Express, `fluent-ffmpeg`, `node-edge-tts`
- **Frontend:** React, Vite, Lucide Icons, Glassmorphism UI
- **Database:** Supabase (PostgreSQL)
- **APIs Used:** OpenRouter, Cloudinary, YouTube Data API v3

## Prerequisites

- **Node.js:** v18+ 
- **FFmpeg:** Installed locally or bundled via `ffmpeg-static`
- **Supabase:** A free Supabase project with the included schema installed
- **API Keys:** You will need OpenRouter, Cloudinary, and YouTube OAuth credentials

## Installation

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   cd client && npm install
   cd ..
   ```

2. **Database Setup:**
   - Create a `.env` file at the root based on `.env.example`.
   - Run the migration script to set up the Supabase tables:
     ```bash
     node migrate.js
     ```

3. **Configure API Credentials:**
   - Open the web UI, go to the **Credentials** tab, and enter your:
     - OpenRouter API Key
     - Cloudinary Details (Cloud Name, API Key, Secret)
     - YouTube Credentials (Client ID, Client Secret, Refresh Token)

## Running the App

To run both the backend server and the Vite React frontend simultaneously:

```bash
npm run dev:all
```

- **Frontend UI:** http://localhost:5173
- **Backend API:** http://localhost:3000

## Project Structure

- `/client` - React frontend source code and UI components
- `/routes` - Express API endpoints (API keys, topics, dashboard, pipeline triggers)
- `/services` - Integrations for external APIs (Cloudinary, OpenRouter, YouTube, FFmpeg)
- `pipeline.js` - The core engine that orchestrates the 6-step creation process
- `scheduler.js` - Background cron job engine for automated daily posts
- `database.js` - Supabase interaction layer

## Troubleshooting

- **ENOTFOUND openrouter.ai:** If your ISP blocks OpenRouter or Bing TTS, the backend includes a built-in global DNS override (`8.8.8.8`) to bypass the block automatically.
- **YouTube Refresh Token Expired:** Re-authorize your Google account in the Google Cloud Console or via the provided OAuth script and update your Credentials in the dashboard.
- **FFmpeg Errors:** Ensure `ffprobe-static` and `ffmpeg-static` are correctly installed.


