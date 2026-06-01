/**
 * NTP-style clock synchronization — high-accuracy edition.
 *
 * Improvements over basic NTP:
 *   - 30 rounds (was 10) for better statistical accuracy
 *   - Trim top+bottom 20% RTT (removes both outliers AND lucky fast samples)
 *   - Weighted average: low-RTT samples count more
 *   - Reports accuracy estimate in ms (±Xms)
 *   - Continuous background re-sync every 60s to track clock drift
 */
export class TimeSync {
  constructor(socket, rounds = 30) {
    this.socket   = socket;
    this.rounds   = rounds;
    this.offset   = 0;
    this.rtt      = 0;
    this.accuracy = 999;  // ±ms estimate
    this.quality  = 'unknown';
    this._driftTimer = null;
  }

  now() {
    return Date.now() + this.offset;
  }

  run() {
    return new Promise((resolve) => {
      const samples = [];
      let round = 0;

      const onPong = ({ t0, t1 }) => {
        const t2  = Date.now();
        const rtt = t2 - t0;
        // Only record if RTT is plausible (< 2s — rejects stale pongs)
        if (rtt < 2000) {
          const offset = t1 - t0 - rtt / 2;
          samples.push({ rtt, offset });
        }

        if (++round < this.rounds) {
          setTimeout(() => sendPing(), 80);
        } else {
          this.socket.off('sync:pong', onPong);
          this._compute(samples);
          resolve({ offset: this.offset, rtt: this.rtt, accuracy: this.accuracy, quality: this.quality });
        }
      };

      const sendPing = () => {
        this.socket.emit('sync:ping', { t0: Date.now(), round });
      };

      this.socket.on('sync:pong', onPong);
      sendPing();
    });
  }

  /** Start background re-sync every 60s to compensate for clock drift */
  startDriftCorrection() {
    this.stopDriftCorrection();
    this._driftTimer = setInterval(() => {
      this._miniSync();
    }, 60_000);
  }

  stopDriftCorrection() {
    if (this._driftTimer) clearInterval(this._driftTimer);
    this._driftTimer = null;
  }

  /** Quick 10-round re-sync to update offset without full ceremony */
  _miniSync() {
    const samples = [];
    let round = 0;
    const MINI_ROUNDS = 10;

    const onPong = ({ t0, t1 }) => {
      const t2 = Date.now();
      const rtt = t2 - t0;
      if (rtt < 1000) samples.push({ rtt, offset: t1 - t0 - rtt / 2 });
      if (++round < MINI_ROUNDS) {
        setTimeout(() => this.socket.emit('sync:ping', { t0: Date.now(), round: -1 }), 80);
      } else {
        this.socket.off('sync:pong', onPong);
        if (samples.length >= 4) {
          const prev = this.offset;
          this._compute(samples);
          // Smooth drift correction — blend old and new offset
          this.offset = prev * 0.3 + this.offset * 0.7;
        }
      }
    };

    this.socket.on('sync:pong', onPong);
    this.socket.emit('sync:ping', { t0: Date.now(), round: -1 });
  }

  _compute(samples) {
    if (samples.length < 4) {
      this.quality = 'poor';
      this.accuracy = 999;
      return;
    }

    // Trim top+bottom 20% by RTT
    const sorted = [...samples].sort((a, b) => a.rtt - b.rtt);
    const trim   = Math.floor(sorted.length * 0.2);
    const keep   = sorted.slice(trim, sorted.length - trim);

    // Weighted average: weight = 1/rtt (lower RTT = more reliable)
    const totalW  = keep.reduce((s, x) => s + 1 / x.rtt, 0);
    this.offset   = keep.reduce((s, x) => s + (x.offset / x.rtt), 0) / totalW;
    this.rtt      = keep.reduce((s, x) => s + x.rtt, 0) / keep.length;

    // Accuracy = std deviation of offsets after weighting
    const mean = this.offset;
    const variance = keep.reduce((s, x) => s + (x.offset - mean) ** 2, 0) / keep.length;
    this.accuracy = Math.round(Math.sqrt(variance));

    if (this.accuracy <= 5)       this.quality = 'excellent';
    else if (this.accuracy <= 15) this.quality = 'good';
    else if (this.accuracy <= 40) this.quality = 'fair';
    else                          this.quality = 'poor';
  }
}
