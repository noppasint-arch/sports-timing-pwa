/**
 * ConnectionManager — wraps Socket.io with auto-reconnect,
 * latency tracking, and a simple event bus.
 *
 * Primary: Socket.io over LAN (ws://localIP:3001)
 * Fallback: same server over internet if LAN fails (future: Firebase)
 */
import { io } from 'socket.io-client';

export class ConnectionManager {
  constructor() {
    this.socket    = null;
    this.latency   = null;  // ms, updated every ping
    this.connected = false;
    this._listeners = {};   // eventName → [handler]
    this._pingTimer = null;
  }

  connect(serverUrl) {
    if (this.socket) this.socket.disconnect();

    this.socket = io(serverUrl || window.location.origin, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this._emit('connect');
      this._startPing();
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this._emit('disconnect');
      clearInterval(this._pingTimer);
    });

    this.socket.on('connect_error', (err) => {
      this._emit('error', err.message);
    });

    // Latency measurement via round-trip on sync:pong
    this.socket.on('sync:pong', ({ t0 }) => {
      this.latency = Date.now() - t0;
      this._emit('latency', this.latency);
    });

    // Relay all server events to local listeners
    const relayed = [
      'session:updated', 'session:peer_joined', 'session:peer_left',
      'test:start_sync', 'test:ready', 'test:start_trial', 'test:abort_trial',
      'test:next_trial', 'trigger:event', 'result:new', 'ytest:direction',
    ];
    relayed.forEach(ev => {
      this.socket.on(ev, (data) => this._emit(ev, data));
    });

    return this;
  }

  disconnect() {
    clearInterval(this._pingTimer);
    if (this.socket) this.socket.disconnect();
    this.socket = null;
    this.connected = false;
  }

  emit(event, data, cb) {
    if (!this.socket) return;
    if (cb) this.socket.emit(event, data, cb);
    else    this.socket.emit(event, data);
  }

  on(event, handler) {
    (this._listeners[event] = this._listeners[event] || []).push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(h => h !== handler);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(h => h(data));
  }

  _startPing() {
    // Measure latency every 3 s using the sync:ping/pong loop
    this._pingTimer = setInterval(() => {
      this.socket.emit('sync:ping', { t0: Date.now(), round: -1 });
    }, 3000);
  }

  /** Promise-based emit with server ack */
  emitAsync(event, data) {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Not connected'));
      const timeout = setTimeout(() => reject(new Error('Timeout')), 8000);
      this.socket.emit(event, data, (res) => {
        clearTimeout(timeout);
        resolve(res);
      });
    });
  }
}

// Singleton shared across the app
export const connection = new ConnectionManager();
