# LoveLens Documentation 💕

LoveLens is a high-performance, real-time virtual photobooth designed for long-distance couples. This document provides a technical deep-dive into its architecture, WebRTC implementation, connection recovery, and operational workflows.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v20 or higher)
- **npm** or **yarn**
- A modern browser with camera access (Chrome/Edge/Safari recommended)

### Installation
1. **Clone the repository**
2. **Install Frontend Dependencies:**
   ```bash
   npm install
   ```
3. **Install Signaling Server Dependencies:**
   ```bash
   cd server && npm install && cd ..
   ```

### Running Locally
You can run both the Next.js frontend and the signaling server concurrently:
```bash
npm run dev
```
- **Frontend:** `http://localhost:3000`
- **Signaling Server:** `http://localhost:3001`

### Running Automated Tests
Run the automated end-to-end signaling and connection test suite:
```bash
npm test
```

---

## 🏗️ Architecture Overview

LoveLens follows a hybrid architecture combining a modern React frontend with a lightweight Node.js signaling backend.

### 1. Frontend (Next.js 16 + React 19)
- **App Router:** Utilizes Next.js App Router for optimized routing (`/booth`, `/booth/[roomId]`).
- **State Management:** Powered by **Zustand** (`src/stores/booth-store.ts`) for managing the booth lifecycle, camera streams, device statuses, and capture synchronization.
- **Styling:** **Tailwind CSS 4** with CSS variables for dynamic theming (Dark, Pink, Light).
- **Animations:** **Framer Motion** for smooth transitions, countdowns, toasts, and "flash" effects.

### 2. Signaling Server (Node.js + Socket.IO)
- **Role:** Facilitates the WebRTC handshake (SDP exchange), synchronizes photo-taking events, and broadcasts real-time device health.
- **Room Management & 5-Minute Grace Period:** Tracks participants by stable `clientId` and active connection state. Rooms persist with a 5-minute grace period when both users disconnect before automated pruning, preventing premature room destruction.
- **HTTP API:** Provides endpoints for room creation and active status checks (`/api/rooms`).

---

## 📡 How WebRTC Works in LoveLens

WebRTC (Web Real-Time Communication) allows the two partners to stream video directly to each other (Peer-to-Peer) without routing heavy video data through a server.

### The Handshake Process (Signaling)
1. **Connection:** Both users connect to the signaling server via WebSockets (Socket.IO) with persistent client identifiers.
2. **Offer:** The first user in the room (Host) creates an **SDP Offer** and sends it to the partner through the signaling server.
3. **Answer:** The partner receives the Offer, sets it as their "Remote Description," creates an **SDP Answer**, and sends it back.
4. **ICE Candidates:** Both peers exchange "ICE Candidates" (network path options) to find the best way to connect through firewalls or NATs.
5. **Direct Stream:** Once the handshake is complete, the `RTCPeerConnection` is established, and video tracks are exchanged directly.

### 🔄 Connection Recovery & Stream Refresh
- **One-Click Refresh:** When users click "Refresh", the client re-verifies local media tracks, issues a `request-reconnect` signal, and prompts the host to perform an ICE restart (`createOffer({ iceRestart: true })`).
- **Mobile Tab Recovery:** A `visibilitychange` listener detects when users switch back to the browser tab, automatically repairing frozen media streams.

### 📱 Mobile Camera Switching
- **Front & Back Cameras:** Supports flipping between selfie (`facingMode: "user"`) and environment cameras (`facingMode: "environment"`).
- **Dynamic Mirroring:** Front camera feeds are horizontally mirrored for natural posing, while rear camera feeds remain un-mirrored.
- **Track Replacement:** Media tracks are seamlessly swapped via `RTCRtpSender.replaceTrack` without dropping the peer connection.

### ⚠️ Cross-Peer Status Syncing
- If a partner blocks camera permissions, experiences device conflicts, or is reconnecting, a real-time `device-status` socket event is broadcast to display contextual advisory banners on the other peer's screen.

---

## 📸 Photo Synchronization Logic

Synchronizing high-quality photo captures between two browsers requires precise timing.

1. **Trigger:** One user clicks "Take Photos."
2. **Sync Event:** A `START_CAPTURE` event is broadcast via Socket.IO.
3. **Countdown:** Both browsers start an identical 3-second countdown locally.
4. **Capture:** At `T-0`, each browser captures its *own* local high-quality camera frame as a Data URL.
5. **Exchange:** Each peer sends its captured frame string to the partner via a `PHOTO_TAKEN` socket event.
6. **Composition:** Once both local and remote frames for a slot are received, the `canvas.ts` utility renders them into a single photostrip.

---

## 🎨 Image Processing & Compositing

The photostrip generation happens entirely on the client side using the HTML5 Canvas API.

- **Filters:** CSS-like filters (Sepia, Grayscale, etc.) are applied directly to the Canvas context before drawing frames.
- **Scaling:** The `drawImageCenter` utility ensures that camera feeds (which may vary in aspect ratio) are perfectly cropped and centered within the photostrip frames.
- **Exporting:** Users can download the final strip as **PNG**, **JPG**, or **PDF** (using `jspdf`).

---

## 🛠️ Deployment

### Frontend (Vercel)
Set the environment variable:
`NEXT_PUBLIC_SIGNALING_URL = https://your-signaling-server.url`

### Signaling Server (Render/Railway)
- **Runtime:** Node
- **Start Command:** `npx tsx index.ts`
- **Port:** 3001 (or as assigned by the environment)

---

## 🔒 Security & Privacy
- **No Storage:** LoveLens does not store images on any server. All photo processing and photostrip generation happen in the user's browser.
- **P2P Video:** Video streams are encrypted and sent directly between peers via WebRTC.
- **5-Minute Grace Period & Safe Pruning:** Booths are preserved for 5 minutes after both users disconnect to allow effortless re-entry and reload recovery, after which rooms are cleanly purged from memory.
