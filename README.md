# Sports Timing PWA

A multi-device synchronized sports performance testing platform. Replaces expensive timing gates (Brower, Smartspeed) using 2–4 smartphones connected over local WiFi — no app installation required.

---

## Quick Start (Local WiFi LAN Mode)

### Prerequisites
- Node.js 18+ on the host machine
- All devices on the **same WiFi network**

### 1. Install & Build

```bash
cd sports-timing-pwa
npm install
npm run build
```

### 2. Start the Server

```bash
npm start
```

The server starts on port `3001`. Find your machine's local IP:

```bash
# macOS / Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
```

Output example: `192.168.1.42`

### 3. Connect All Devices

On every device (phones, tablets), open a mobile browser and navigate to:

```
http://192.168.1.42:3001
```

> **No app installation needed.** Works in iOS Safari and Android Chrome.  
> For the best experience, tap **"Add to Home Screen"** to install as a PWA.

### 4. Run a Test Session

1. **Host device** → tap "Host New Session" → select test → tap "Create Session"
2. A **4-digit code** appears (e.g., `7432`)
3. **Other devices** → tap "Join Session" → enter the code
4. Each device selects its **role** (START, FINISH, CENTER, etc.)
5. Host taps **"Start Time Sync"** — all devices sync clocks automatically
6. Host taps **"Start Trial"** — countdown begins across all devices
7. Results appear on all screens simultaneously

---

## Development Mode (Hot Reload)

```bash
npm run dev
```

This starts both the Socket.io server (port 3001) and Vite dev server (port 5173) concurrently.

---

## Folder Structure

```
sports-timing-pwa/
├── server/
│   └── index.cjs          # Node.js + Socket.io backend
├── src/
│   ├── core/
│   │   ├── TimeSync.js        # NTP-style clock sync algorithm
│   │   ├── ConnectionManager.js  # Socket.io wrapper + auto-reconnect
│   │   ├── TriggerSystem.js   # Button + audio trigger pipeline
│   │   └── StorageManager.js  # localStorage + CSV/JSON export
│   ├── templates/
│   │   ├── TemplateEngine.js  # Template registry + metric calculator
│   │   ├── sprint30m.js       # 30m Sprint template
│   │   ├── yShapeAgility.js   # Y-Shape Agility template
│   │   └── illinoisAgility.js # Illinois Agility template
│   ├── components/
│   │   ├── screens/           # Full-screen views (Home, Ready, Running, Result…)
│   │   └── ui/                # Shared components (Timer, Countdown, SyncBadge…)
│   └── App.jsx                # Root app + state machine
├── .claude/launch.json        # Preview server config
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## Network Modes

| Mode | When | Latency |
|------|------|---------|
| **LAN (Socket.io)** | All devices on same WiFi | ~1–5 ms |
| **Internet (Socket.io via server)** | Devices on different networks | ~20–100 ms |

The app auto-connects to the origin server. For cross-network use, deploy to a VPS/Vercel and set the server URL in **Settings**.

---

## Deploying to Vercel / Netlify

The Socket.io server (`server/index.cjs`) must run as a persistent Node process — it **cannot** run on serverless. Options:

- **Render.com / Railway / Fly.io** — deploy the Node server, set `PORT` env var
- **Vercel** — frontend only; update `serverUrl` in Settings to point to your server

```bash
# Build frontend
npm run build
# Deploy dist/ folder to Vercel as static site
```
