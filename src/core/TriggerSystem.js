/**
 * TriggerSystem — unified pipeline for button and audio triggers.
 * Both paths produce a normalized TriggerEvent fed to the same handler.
 *
 * Audio detection: Web Audio API AnalyserNode peak detection.
 * A clap/beep above the configured threshold fires the trigger once,
 * then ignores audio for a debounce period to prevent double-fires.
 */
export class TriggerSystem {
  constructor({ onTrigger, audioThreshold = 0.85, audioDebounce = 800 }) {
    this.onTrigger     = onTrigger;       // (TriggerEvent) => void
    this.threshold     = audioThreshold;  // 0-1 relative to max possible
    this.debounce      = audioDebounce;   // ms to ignore after trigger
    this._lastFire     = 0;
    this._audioContext = null;
    this._analyser     = null;
    this._stream       = null;
    this._rafId        = null;
    this._audioActive  = false;
    this._enabled      = false;
  }

  /** Call once per trial to arm the system */
  enable() { this._enabled = true; }
  disable() { this._enabled = false; }

  /** Manual button press — call from the big UI button */
  buttonTrigger(getServerTime) {
    if (!this._enabled) return;
    const now = Date.now();
    if (now - this._lastFire < 200) return; // debounce rapid taps
    this._lastFire = now;
    this._fire('button', getServerTime());
  }

  /** Start microphone audio monitoring */
  async startAudio() {
    if (this._audioActive) return;
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this._audioContext.createMediaStreamSource(this._stream);
      this._analyser = this._audioContext.createAnalyser();
      this._analyser.fftSize = 256;
      source.connect(this._analyser);
      this._audioActive = true;
      this._pollAudio();
    } catch (err) {
      console.warn('[TriggerSystem] Audio unavailable:', err.message);
    }
  }

  stopAudio() {
    this._audioActive = false;
    cancelAnimationFrame(this._rafId);
    this._stream?.getTracks().forEach(t => t.stop());
    this._audioContext?.close();
    this._audioContext = null;
    this._analyser     = null;
    this._stream       = null;
  }

  _pollAudio() {
    if (!this._audioActive) return;
    this._rafId = requestAnimationFrame(() => this._pollAudio());

    if (!this._enabled) return;

    const buf = new Float32Array(this._analyser.fftSize);
    this._analyser.getFloatTimeDomainData(buf);
    const peak = buf.reduce((max, v) => Math.max(max, Math.abs(v)), 0);

    if (peak >= this.threshold) {
      const now = Date.now();
      if (now - this._lastFire >= this.debounce) {
        this._lastFire = now;
        this._fire('audio', now);
      }
    }
  }

  _fire(method, correctedTime) {
    this.onTrigger({ method, correctedTime, rawTime: Date.now() });
  }

  destroy() {
    this.disable();
    this.stopAudio();
  }
}
