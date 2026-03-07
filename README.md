# LoveLens — Capturing Love Beyond Distance 💕

A virtual photobooth for long-distance couples. Take synchronized photos together in real-time, apply filters, and create beautiful photostrips.

## Features

- 🎥 **Real-time video** — WebRTC peer-to-peer connection
- 📸 **8 filters** — Vintage, Polaroid, B&W, Romantic, VHS, Dreamy, and more
- 🖼️ **Photostrip** — Generates printable photo strips with customization
- 🎨 **3 themes** — Dark, Pink (with animated hearts), and Light (premium pale)
- 📱 **Mobile responsive** — Works on phones and tablets
- 🔗 **Room system** — Room codes for partner pairing, max 2 per room

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐
│ Next.js Frontend│────▶│ Signaling Server     │
│ (Vercel)        │◀────│ (Render.com)         │
│ Port 3000       │     │ Port 3001            │
└─────────────────┘     │ • Socket.IO          │
                        │ • Room HTTP API      │
                        └──────────────────────┘
```

## Local Development

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Run both Next.js + signaling server
npm run dev
```

This starts:
- **Next.js** on `http://localhost:3000`
- **Signaling server** on `http://localhost:3001`

## Deployment

### 1. Frontend → Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import your repo
3. In **Settings → Environment Variables**, add:
   ```
   NEXT_PUBLIC_SIGNALING_URL = https://your-signaling-server.onrender.com
   ```
4. Deploy — Vercel handles the rest

### 2. Signaling Server → Render.com

Follow these steps to deploy the signaling server for free on Render:

#### Step 1: Create a Render Account
- Go to [render.com](https://render.com) and sign up (free)

#### Step 2: Create a New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repo
3. Configure the service:

   | Setting | Value |
   |---------|-------|
   | **Name** | `lovelens-signaling` |
   | **Root Directory** | `server` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npx tsx index.ts` |
   | **Instance Type** | `Free` |

4. Click **"Create Web Service"**

#### Step 3: Get Your Server URL
- Once deployed, Render gives you a URL like:
  `https://lovelens-signaling.onrender.com`
- Copy this URL

#### Step 4: Update Vercel Environment Variable
- Go to your Vercel project → **Settings → Environment Variables**
- Set `NEXT_PUBLIC_SIGNALING_URL` to your Render URL
- **Redeploy** your Vercel app

#### ⚠️ Free Tier Note
Render's free tier spins down after 15 minutes of inactivity. The first connection may take ~30 seconds to wake up. For always-on, upgrade to the paid tier ($7/mo).

## Tech Stack

- **Frontend:** Next.js 16, React 19, Framer Motion, Zustand, Tailwind CSS 4
- **Signaling:** Socket.IO, Node.js
- **Video:** WebRTC (peer-to-peer)
- **Fonts:** Outfit, Inter (Google Fonts)
