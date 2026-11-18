# ATM Movie - Subtitle & Edge TTS Voice Studio

Cloud Subtitle Extraction (AssemblyAI client-side), Burmese Script Cleanup, and Microsoft Edge Multilingual Neural TTS Voiceover & 2-Line SRT Studio.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## GitHub + Railway Deployment Guide

### 1. Upload to GitHub
1. Create a new repository on [GitHub](https://github.com/new) (e.g. `atm-movie-studio`).
2. Download/extract this project folder and run in terminal:

```bash
git init
git add .
git commit -m "Initial commit: ATM Movie Studio"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/atm-movie-studio.git
git push -u origin main
```

### 2. Deploy on Railway
1. Go to [Railway](https://railway.app/) and log in with your GitHub account.
2. Click **New Project → Deploy from GitHub repo** and select your `atm-movie-studio` repository.
3. Railway automatically reads `railway.json` and `package.json`:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Healthcheck**: `/api/health`
   - **Port**: Automatically bound via `process.env.PORT` on `0.0.0.0`.
4. No extra API keys are required on the server! (AssemblyAI keys are saved locally in the user's browser `localStorage` in the Subtitle Studio tab.)
5. Once deployment finishes, go to **Settings → Networking → Generate Domain** to get your public `.up.railway.app` URL.
