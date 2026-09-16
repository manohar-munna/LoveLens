# LoveLens 💕 — Capturing Love Beyond Distance

<p align="center">
  <img src="public/favicon.ico" alt="LoveLens Logo" width="80" height="80" />
</p>

<p align="center">
  <strong>A real-time, synchronized virtual photobooth built for long-distance couples.</strong><br>
  Take simultaneous photos together, apply nostalgic vintage filters, customize photostrips, and download printable keepsakes.
</p>

<p align="center">
  <a href="https://github.com/manohar-munna/LoveLens/stargazers"><img src="https://img.shields.io/github/stars/manohar-munna/LoveLens?color=ff69b4&style=flat-square" alt="Stars"></a>
  <a href="https://github.com/manohar-munna/LoveLens/network/members"><img src="https://img.shields.io/github/forks/manohar-munna/LoveLens?color=ff69b4&style=flat-square" alt="Forks"></a>
  <a href="https://github.com/manohar-munna/LoveLens/issues"><img src="https://img.shields.io/github/issues/manohar-munna/LoveLens?color=ff69b4&style=flat-square" alt="Issues"></a>
  <a href="https://github.com/manohar-munna/LoveLens/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/Next.js-16.1.6-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19.2.3-61dafb?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/WebRTC-Peer--to--Peer-333333?style=flat-square&logo=webrtc" alt="WebRTC">
  <img src="https://img.shields.io/badge/Socket.IO-4.8.3-010101?style=flat-square&logo=socket.io" alt="Socket.IO">
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS">
</p>

---

## ✨ Features

### 🎥 Real-Time Peer-to-Peer Video & Robust Connectivity
- **Encrypted WebRTC Streaming:** Direct P2P video stream using Google STUN servers for ultra-low latency.
- **🔄 One-Click Stream Refresh & Reconnect:** Instantly re-negotiate WebRTC with ICE restart and verify media streams without leaving or reloading the booth.
- **📱 Front & Back Camera Flip for Mobiles:** Switch seamlessly between front (selfie) and back (environment) cameras on phones and tablets with dynamic mirroring adjustments.
- **⚠️ Cross-Peer Issue & Permission Alerts:** Real-time device status indicators that notify your partner if camera permissions are blocked, in use, or loading.
- **🛡️ 5-Minute Empty Booth Grace Period:** Rooms persist for 5 minutes after both users leave, preventing accidental room deletion and allowing seamless rejoining without false "Room is full" errors.
- **📲 Mobile Tab Auto-Recovery:** Listens to page visibility changes to revive frozen video tracks when returning from background tabs or locked screens.
- **Side-by-Side Viewfinder:** Intuitive twin-feed layout with position swapping and pinch/slider zoom (1x to 3x).

### 📸 Synchronized Photobooth Capture
- **Simultaneous Capture:** Host-initiated trigger starts a synchronized 3-second animated countdown on both screens.
- **Visual Flash Effect:** Immersive screen flash when the frame is captured.
- **Lossless Quality:** High-resolution local camera snapshots captured on each peer and exchanged via WebSocket data channels.
- **Configurable Shot Count:** Choose between 1 to 10 captures per session.

### 🎨 Retro & Modern Photo Filters
Real-time CSS and Canvas filter rendering:
- ✨ **No Filter** — Crystal-clear natural camera feed
- 🎞️ **Vintage Film** — Warm sepia tones with nostalgic contrast
- 📸 **Polaroid** — Vibrant saturation with boosted exposure
- 🖤 **B&W Film** — High-contrast classic monochrome
- 💕 **Romantic** — Soft pink hues with glowing brightness
- 📼 **VHS** — Desaturated retro videotape texture
- 🌸 **Dreamy** — Pastel hues with soft dreamy warmth
- 📷 **Disposable** — Authentic 90s disposable camera aesthetic
- 🤳 **Old Digital** — Early 2000s digicam vibes

### 🫶 Stickers & Heart Formation Templates
- **Interactive Stickers:** Hearts Crown (💖), Star Magic (✨), Royal Crown (👑).
- **Heart Formation Mode (🫶):** Seamless combined split-frame template allowing couples to pose together across screens (e.g. creating a continuous hand-heart).

### 🖼️ Photostrip Customization
- **Border Themes:** Classic White, Pastel Pink, Obsidian Black, and Textured Polaroid.
- **Typography & Captioning:** Custom captions with 5 Google Fonts (*Outfit, Dancing Script, Pacifico, Caveat, VT323 Retro*) and dynamic text scaling.
- **Date Stamp:** Toggleable timestamp stamp for memory preservation.
- **Session Controls:** Rearrange frames, retake shots, delete captures with undo support.

### 💾 Multi-Format Export & Sharing
- **High-Res Downloads:** Export photostrips in **PNG** and **JPG**.
- **Printable PDF:** Generate printable photo strips formatted with `jspdf`.
- **Native Mobile Sharing:** One-click integration with the Web Share API.

### 🌙 Dynamic Theming
- **Dark Mode:** Deep obsidian background with electric pink accents.
- **Pink Mode:** Romantic pastel aesthetic with floating animated hearts.
- **Light Mode:** Clean, minimal, high-contrast aesthetic.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 16 Client                      │
│        (React 19 • Tailwind CSS 4 • Framer Motion)          │
│                                                             │
│   ┌──────────────────┐               ┌──────────────────┐   │
│   │ Local Media      │               │ Canvas Strip     │   │
│   │ Stream & Zoom    │               │ Compositor       │   │
│   └─────────┬────────┘               └────────▲─────────┘   │
└─────────────┼─────────────────────────────────┼─────────────┘
              │                                 │
              │ WebRTC P2P Video Stream         │ High-Res Blobs
              │ (Zero Server Storage)           │ & State Sync
              ▼                                 │
┌──────────────────────────┐           ┌────────┴─────────────┐
│       Remote Peer        │           │   Signaling Server   │
│     (Partner Client)     │◀─────────▶│ (Node.js + Socket.IO)│
└──────────────────────────┘  WebRTC   │ Port: 3001           │
                              SDP/ICE └──────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** `v20.0.0` or higher
- **npm**, **pnpm**, or **yarn**
- Modern web browser with camera permissions

### 1. Clone Repository
```bash
git clone https://github.com/manohar-munna/LoveLens.git
cd LoveLens
```

### 2. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install signaling server dependencies
cd server && npm install && cd ..
```

### 3. Start Development Environment
```bash
npm run dev
```

This concurrently boots:
- 🌐 **Frontend:** [http://localhost:3000](http://localhost:3000)
- 🔌 **Signaling Server:** [http://localhost:3001](http://localhost:3001)

---

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory:

```env
# URL of your Socket.IO signaling server
# For local development:
NEXT_PUBLIC_SIGNALING_URL=http://localhost:3001

# For production (e.g. Render/Railway):
# NEXT_PUBLIC_SIGNALING_URL=https://your-signaling-server.onrender.com
```

---

## 📦 Deployment Guide

### Option A: Frontend on Vercel
1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. In **Settings → Environment Variables**, add:
   ```env
   NEXT_PUBLIC_SIGNALING_URL=https://your-signaling-server.onrender.com
   ```
4. Click **Deploy**.

---

### Option B: Signaling Server on Render (Free Tier)
1. Log in to [Render](https://render.com) and click **New + → Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Name:** `lovelens-signaling`
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npx tsx index.ts`
   - **Instance Type:** `Free`
4. Deploy the service and copy the generated URL (`https://lovelens-signaling.onrender.com`).
5. Update `NEXT_PUBLIC_SIGNALING_URL` in your Vercel project settings and redeploy the frontend.

> [!NOTE]
> Render's free tier spins down instances after 15 minutes of inactivity. First connections might take ~30 seconds to establish if the instance is sleeping.

---

## 🔒 Privacy & Security

- 🛡️ **Zero Server Image Storage:** All photo capture, filter processing, and photostrip rendering occur strictly client-side via the HTML5 Canvas API. No photos are ever uploaded or stored on any server.
- 🔐 **End-to-End P2P Video:** Live video feeds are streamed peer-to-peer using WebRTC encryption.
- ⏱️ **5-Minute Empty Booth Grace Period:** Rooms are preserved in memory for 5 minutes after both users leave to permit reloads and network recoveries, after which they are cleanly pruned.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/) |
| **UI Library** | [React 19](https://react.dev/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) |
| **PDF Generation** | [jsPDF](https://github.com/parallax/jsPDF) |
| **Real-time Signaling** | [Socket.IO](https://socket.io/) (Node.js + TypeScript) |
| **Media & Streaming** | WebRTC (`RTCPeerConnection`, `MediaDevices API`, STUN) |

---

## 🤝 Contributing

Contributions are warmly welcomed! To contribute:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing new feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

<p align="center">
  Made with 💖 for couples across every distance.
</p>
