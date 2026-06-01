# Calibration & Sync Procedure Guide

## Before Every Session

### Step 1 — Connect All Devices to the Same WiFi
All phones must be on the same network as the host machine running the server. Confirm by checking the WiFi name in each phone's settings.

### Step 2 — Open the App on All Devices
Navigate to `http://<host-ip>:3001` on every phone. The status bar at the top shows **● Online** when connected.

### Step 3 — Host Creates a Session
- Tap **"Host New Session"**
- Enter coach name and select test
- Tap **"Create Session"** — a 4-digit code appears

### Step 4 — Other Devices Join
- Tap **"Join Session"**
- Enter device name (e.g. "Finish Gate")
- Enter the 4-digit code from the host device

### Step 5 — Assign Roles
Each device selects its role on the Role Selection screen. The host can see all connected devices and their chosen roles. Do not proceed until all required roles are filled.

### Step 6 — Place Devices Physically
Before tapping "Start Time Sync":
1. Place each phone in its final position on the field
2. On each device's Ready screen, **align the green line** on screen with the physical tape or cone on the ground
3. Tap **"✓ Marker Aligned — Ready"** on each device

### Step 7 — Time Synchronisation
The host taps **"Start Time Sync"**. All devices run 10 NTP-style ping-pong rounds with the server automatically.

**Sync quality ratings:**

| Badge   | Offset   | Meaning                              |
|---------|----------|--------------------------------------|
| ✅ GOOD | < ±20 ms | Excellent — suitable for all tests   |
| ⚠️ FAIR | ±20–50ms | Acceptable — <50 ms timing error     |
| ❌ POOR | > ±50 ms | Re-sync strongly recommended         |

If any device shows POOR, tap **"Re-sync"** before proceeding. POOR sync usually means:
- High WiFi congestion — move closer to the router
- Background apps using bandwidth — close other apps
- The server machine is under heavy load — close unnecessary programs

---

## During a Session

### Between Trials
- Devices stay in place — no need to re-sync between trials
- If a device is accidentally moved or the session is paused >10 min, use **"Re-sync"** in the Ready screen menu

### Aborting a Trial
The host can tap **"✕ Abort"** during a running trial. The trial is discarded and all devices return to Ready state. Aborted trials are not saved.

### Voiding a Result
On the Result screen, tap **"⚠️ Void this result"** (host only). Voided results are kept in history but marked clearly and excluded from bests/averages.

---

## Interpreting Raw vs Corrected Timestamps

On the Result screen, tap **"Show raw timestamps"** to see:

| Field            | Meaning                                                      |
|------------------|--------------------------------------------------------------|
| `correctedTime`  | Device's local time + NTP offset — this is the value used for all calculations |
| `rawTime`        | Device's local clock at the moment of the trigger — before correction |

The difference between raw and corrected is your device's clock offset from the server. A difference of <20 ms is excellent.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Device shows ○ Offline | Check WiFi connection; refresh the page |
| Sync quality stays POOR | Move device closer to router; disable mobile data |
| Button press not registering | Ensure the trial is in "active" state (after countdown) |
| All devices show same time | Clocks may already be well-synced — this is fine |
| Audio trigger fires randomly | Raise the sensitivity threshold in Settings |
| Results differ from stopwatch | Normal <30 ms variance; button press has ~100–150 ms human lag vs electronic gates |
