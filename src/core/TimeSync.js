/**
 * NTP-style clock synchronization.
 * Runs 10 ping-pong rounds with the server, computes the mean offset
 * and round-trip time, then classifies sync quality.
 *
 * Usage:
 *   const sync = new TimeSync(socket);
 *   const result = await sync.run();   // { offset, rtt, quality }
 *   const corrected = sync.now();      // server-adjusted timestamp
 */
export class TimeSync {
  constructor(socket, rounds = 10) {
    this.socket  = socket;
    this.rounds  = rounds;
    this.offset  = 0;   // ms: localTime + offset ≈ serverTime
    this.rtt     = 0;   // ms round-trip
    this.quality = 'unknown';
  }

  /** Returns server-corrected current time in ms */
  now() {
    return Date.now() + this.offset;
  }

  /** Runs sync rounds, resolves with { offset, rtt, quality } */
  run() {
    return new Promise((resolve) => {
      const samples = [];
      let round = 0;

      const onPong = ({ t0, t1 }) => {
        const t2 = Date.now();
        const rtt    = t2 - t0;
        const offset = t1 - t0 - rtt / 2;   // standard NTP formula
        samples.push({ rtt, offset });

        if (++round < this.rounds) {
          setTimeout(() => sendPing(), 50);
        } else {
          this.socket.off('sync:pong', onPong);
          this._compute(samples);
          resolve({ offset: this.offset, rtt: this.rtt, quality: this.quality });
        }
      };

      const sendPing = () => {
        this.socket.emit('sync:ping', { t0: Date.now(), round });
      };

      this.socket.on('sync:pong', onPong);
      sendPing();
    });
  }

  _compute(samples) {
    // Discard highest 20% RTT (noise rejection)
    const sorted = [...samples].sort((a, b) => a.rtt - b.rtt);
    const keep   = sorted.slice(0, Math.ceil(sorted.length * 0.8));

    this.rtt    = keep.reduce((s, x) => s + x.rtt, 0) / keep.length;
    this.offset = keep.reduce((s, x) => s + x.offset, 0) / keep.length;

    // Standard deviation of offsets
    const mean = this.offset;
    const std  = Math.sqrt(keep.reduce((s, x) => s + (x.offset - mean) ** 2, 0) / keep.length);

    if (std <= 20)      this.quality = 'good';
    else if (std <= 50) this.quality = 'fair';
    else                this.quality = 'poor';
  }
}
