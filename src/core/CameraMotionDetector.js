/**
 * CameraMotionDetector — electronic light gate via phone camera.
 *
 * Detection zone: VERTICAL strip (like a real light gate beam)
 *   - Camera mounted sideways, pointing across the track
 *   - Athlete runs left→right through the frame
 *   - A narrow vertical strip at center detects the exact crossing moment
 *   - Far more precise than horizontal band (athlete crosses in 1-2 frames)
 *
 * Algorithm: Background Subtraction
 *   1. Build a background model (EMA of frames while disarmed)
 *   2. Each frame: count pixels in vertical strip that differ from background
 *   3. When foreground% exceeds threshold → TRIGGER
 */
export class CameraMotionDetector {
  constructor({
    onTrigger,
    onFrame,
    sensitivity  = 20,   // gray-level diff to classify as foreground (0–255)
    minFgPercent = 0.20, // fraction of vertical strip that must be foreground
    debounce     = 2000,
    fps          = 30,
    facingMode   = 'environment',
  } = {}) {
    this.onTrigger    = onTrigger;
    this.onFrame      = onFrame;
    this.sensitivity  = sensitivity;
    this.minFgPercent = minFgPercent;
    this.debounce     = debounce;
    this.fps          = fps;
    this.facingMode   = facingMode;

    // Vertical gate: horizontal position and width (fractions of frame width)
    this.zoneCenter = 0.50;  // default: center of frame
    this.zoneWidth  = 0.08;  // 8% of frame width — narrow like a real beam

    this._stream        = null;
    this._video         = null;
    this._canvas        = null;
    this._ctx           = null;
    this._background    = null;
    this._armed         = false;
    this._lastFire      = 0;
    this._rafId         = null;
    this._getServerTime = () => Date.now();
    this._frameCount    = 0;
    this._warmupFrames  = 20;
  }

  enable()  { this._armed = true; }
  disable() { this._armed = false; }

  /** Set vertical gate position: center = 0–1 fraction of frame width */
  setZone(center, width) {
    this.zoneCenter = Math.max(0.05, Math.min(0.95, center));
    this.zoneWidth  = Math.max(0.03, Math.min(0.30, width));
  }

  setSensitivity(v) { this.sensitivity = Math.max(1, Math.min(255, v)); }
  setServerTimeFn(fn) { this._getServerTime = fn; }

  async start(videoEl = null) {
    if (this._stream) return;
    this._stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: this.facingMode },
        width:  { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: this.fps },
      },
      audio: false,
    });
    this._video = videoEl || document.createElement('video');
    this._video.srcObject = this._stream;
    this._video.playsInline = true;
    this._video.muted = true;
    await this._video.play();

    this._canvas = document.createElement('canvas');
    this._canvas.width  = 320;
    this._canvas.height = 240;
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });

    this._frameCount = 0;
    this._background = null;
    this._loop();
  }

  stop() {
    this._armed = false;
    cancelAnimationFrame(this._rafId);
    this._stream?.getTracks().forEach(t => t.stop());
    this._stream = null;
    this._video  = null;
    this._background = null;
  }

  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());
    if (!this._video || this._video.readyState < 2) return;

    const W = this._canvas.width;
    const H = this._canvas.height;
    this._ctx.drawImage(this._video, 0, 0, W, H);

    // Extract VERTICAL strip
    const zX  = Math.floor((this.zoneCenter - this.zoneWidth / 2) * W);
    const zW  = Math.max(2, Math.floor(this.zoneWidth * W));
    const data = this._ctx.getImageData(zX, 0, zW, H).data;
    const len  = zW * H;

    // Convert to grayscale
    const gray = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const p = i * 4;
      gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }

    this._frameCount++;

    // Update background model (slower when armed to preserve reference)
    const alpha = this._armed ? 0.01 : 0.05;
    if (!this._background) {
      this._background = Float32Array.from(gray);
    } else {
      for (let i = 0; i < len; i++) {
        this._background[i] = alpha * gray[i] + (1 - alpha) * this._background[i];
      }
    }

    if (this._frameCount < this._warmupFrames) return;

    // Count foreground pixels in vertical strip
    let fg = 0;
    for (let i = 0; i < len; i++) {
      if (Math.abs(gray[i] - this._background[i]) > this.sensitivity) fg++;
    }
    const fgPct = fg / len;

    this.onFrame?.({
      mad:        Math.round(fgPct * 100),       // reuse field: foreground %
      armed:      this._armed,
      zoneCenter: this.zoneCenter,
      zoneWidth:  this.zoneWidth,
      threshold:  Math.round(this.minFgPercent * 100),
    });

    if (this._armed && fgPct >= this.minFgPercent) {
      const now = Date.now();
      if (now - this._lastFire >= this.debounce) {
        this._lastFire = now;
        this._armed    = false;
        this.onTrigger?.({
          method:        'camera',
          correctedTime: this._getServerTime(),
          rawTime:       now,
          mad:           Math.round(fgPct * 100),
        });
      }
    }
  }

  getStream() { return this._stream; }
}
