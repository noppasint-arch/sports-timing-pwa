/**
 * Sports Timing PWA — Socket.io Server
 * Handles session management, time sync relay, and event broadcasting.
 * Runs on local WiFi LAN; devices connect via local IP.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 2000,
  pingTimeout: 5000,
});

// ── Session store ────────────────────────────────────────────────────────────
// Map<sessionCode, SessionData>
const sessions = new Map();

function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getSession(code) {
  return sessions.get(code);
}

function cleanStaleSessions() {
  const cutoff = Date.now() - 3 * 60 * 60 * 1000; // 3 hours
  for (const [code, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(code);
  }
}
setInterval(cleanStaleSessions, 30 * 60 * 1000);

// ── Socket.io events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  // ── Session: create ──────────────────────────────────────────────────────
  socket.on('session:create', ({ hostName, testTemplate }, cb) => {
    let code;
    do { code = generateCode(); } while (sessions.has(code));

    const session = {
      code,
      hostId: socket.id,
      hostName,
      testTemplate,
      nodes: [],           // { socketId, deviceId, role, label, name }
      state: 'lobby',      // lobby | sync | ready | running | result
      createdAt: Date.now(),
      results: [],
      currentTrial: null,
    };
    sessions.set(code, session);
    socket.join(code);

    socket.data.sessionCode = code;
    socket.data.deviceId = socket.id;

    console.log(`[session] Created ${code} by ${hostName}`);
    cb({ ok: true, code, sessionData: sanitize(session) });
  });

  // ── Session: join ────────────────────────────────────────────────────────
  socket.on('session:join', ({ code, deviceName, deviceId }, cb) => {
    const session = getSession(code);
    if (!session) return cb({ ok: false, error: 'Session not found' });
    if (session.state === 'running') return cb({ ok: false, error: 'Test in progress' });

    socket.join(code);
    socket.data.sessionCode = code;
    socket.data.deviceId = deviceId || socket.id;
    socket.data.deviceName = deviceName;

    // Remove stale entry for same deviceId if reconnecting
    session.nodes = session.nodes.filter(n => n.socketId !== socket.id && n.deviceId !== socket.data.deviceId);

    console.log(`[session] ${deviceName} joined ${code}`);
    cb({ ok: true, sessionData: sanitize(session), isHost: session.hostId === socket.id });
    socket.to(code).emit('session:peer_joined', { socketId: socket.id, deviceName });
  });

  // ── Role: assign ─────────────────────────────────────────────────────────
  socket.on('role:assign', ({ role, label, name }) => {
    const session = getSession(socket.data.sessionCode);
    if (!session) return;

    // Remove previous assignment for this socket
    session.nodes = session.nodes.filter(n => n.socketId !== socket.id);
    // Remove other socket claiming same role (host can reassign)
    session.nodes = session.nodes.filter(n => n.role !== role);

    session.nodes.push({
      socketId: socket.id,
      deviceId: socket.data.deviceId,
      role, label,
      name: name || socket.data.deviceName || 'Device',
      syncOffset: 0,
      syncQuality: 'unknown',
    });

    io.to(session.code).emit('session:updated', sanitize(session));
  });

  // ── NTP-style time sync ──────────────────────────────────────────────────
  // Server echoes ping with its own timestamp so clients can calculate offset
  socket.on('sync:ping', ({ t0, round }) => {
    socket.emit('sync:pong', { t0, t1: Date.now(), round });
  });

  // Client reports computed offset for bookkeeping
  socket.on('sync:report', ({ offset, quality }) => {
    const session = getSession(socket.data.sessionCode);
    if (!session) return;
    const node = session.nodes.find(n => n.socketId === socket.id);
    if (node) { node.syncOffset = offset; node.syncQuality = quality; }
    io.to(session.code).emit('session:updated', sanitize(session));
  });

  // ── Test control (host only) ─────────────────────────────────────────────
  socket.on('test:start_sync', () => {
    const session = getSession(socket.data.sessionCode);
    if (!session || session.hostId !== socket.id) return;
    session.state = 'sync';
    io.to(session.code).emit('test:start_sync');
    io.to(session.code).emit('session:updated', sanitize(session));
  });

  socket.on('test:ready', () => {
    const session = getSession(socket.data.sessionCode);
    if (!session || session.hostId !== socket.id) return;
    session.state = 'ready';
    io.to(session.code).emit('test:ready');
    io.to(session.code).emit('session:updated', sanitize(session));
  });

  socket.on('test:start_trial', ({ trialId, countdown }) => {
    const session = getSession(socket.data.sessionCode);
    if (!session || session.hostId !== socket.id) return;
    session.state = 'running';
    session.currentTrial = { trialId, startedAt: Date.now(), events: [] };
    io.to(session.code).emit('test:start_trial', { trialId, countdown, serverTime: Date.now() });
    io.to(session.code).emit('session:updated', sanitize(session));
  });

  socket.on('test:abort_trial', () => {
    const session = getSession(socket.data.sessionCode);
    if (!session || session.hostId !== socket.id) return;
    session.state = 'ready';
    session.currentTrial = null;
    io.to(session.code).emit('test:abort_trial');
    io.to(session.code).emit('session:updated', sanitize(session));
  });

  // ── Trigger event (any node) ─────────────────────────────────────────────
  socket.on('trigger:event', ({ trialId, role, correctedTime, rawTime, method, serverReceived }) => {
    const session = getSession(socket.data.sessionCode);
    if (!session || !session.currentTrial) return;

    const event = {
      role, correctedTime, rawTime,
      method: method || 'button',
      serverTime: Date.now(),
      socketId: socket.id,
    };

    session.currentTrial.events.push(event);
    // Broadcast to all peers so everyone sees live updates
    io.to(session.code).emit('trigger:event', event);
  });

  // ── Result: save ─────────────────────────────────────────────────────────
  socket.on('result:save', (result) => {
    const session = getSession(socket.data.sessionCode);
    if (!session) return;
    session.results.push({ ...result, savedAt: Date.now() });
    session.state = 'result';
    session.currentTrial = null;
    io.to(session.code).emit('result:new', result);
    io.to(session.code).emit('session:updated', sanitize(session));
  });

  socket.on('result:void', ({ resultId, reason }) => {
    const session = getSession(socket.data.sessionCode);
    if (!session) return;
    const r = session.results.find(r => r.id === resultId);
    if (r) { r.voided = true; r.voidReason = reason; }
    io.to(session.code).emit('session:updated', sanitize(session));
  });

  // ── Y-Test specific: direction command ───────────────────────────────────
  socket.on('ytest:direction', ({ direction, trialId }) => {
    const session = getSession(socket.data.sessionCode);
    if (!session) return;
    io.to(session.code).emit('ytest:direction', { direction, trialId, serverTime: Date.now() });
  });

  socket.on('test:next_trial', () => {
    const session = getSession(socket.data.sessionCode);
    if (!session || session.hostId !== socket.id) return;
    session.state = 'ready';
    io.to(session.code).emit('test:next_trial');
    io.to(session.code).emit('session:updated', sanitize(session));
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} disconnected`);
    const session = getSession(socket.data.sessionCode);
    if (!session) return;

    session.nodes = session.nodes.filter(n => n.socketId !== socket.id);

    if (session.hostId === socket.id && session.nodes.length > 0) {
      session.hostId = session.nodes[0].socketId;
    }

    io.to(session.code).emit('session:peer_left', { socketId: socket.id });
    io.to(session.code).emit('session:updated', sanitize(session));
  });
});

// ── Serve built frontend ──────────────────────────────────────────────────────
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏃 Sports Timing Server running on port ${PORT}`);
  console.log(`   LAN URL: http://<your-local-ip>:${PORT}`);
  console.log(`   Find your IP: ifconfig | grep "inet " (macOS/Linux)\n`);
});

// Strip socket IDs from client-facing session data
function sanitize(session) {
  return {
    code: session.code,
    testTemplate: session.testTemplate,
    state: session.state,
    nodes: session.nodes.map(n => ({
      deviceId: n.deviceId,
      role: n.role,
      label: n.label,
      name: n.name,
      syncOffset: n.syncOffset,
      syncQuality: n.syncQuality,
    })),
    results: session.results,
  };
}
