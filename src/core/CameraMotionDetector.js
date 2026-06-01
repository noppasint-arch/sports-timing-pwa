/**
 * CameraMotionDetector — electronic light gate via phone camera.
 *
 * Algorithm: Background Subtraction (not frame-diff)
 *   1. Maintain a running background model (exponential moving average of frames)
 *   2. Each frame: compare pixels to background, count "foreground" pixels
 *   3. When foreground% in detection zone exceeds threshold → TRIGGER
 *
 * This is far more robust than MAD frame-diff:
 *   - Works for slow walking OR fast sprinting
 *   - Works close-up OR at distance
 *   - Not sensitive to camera shake or lighting flicker
 *   - Sensitivity = how many gray levels a pixel must differ from background
 */
export class CameraMotionDetector {
  constructor({
    onTrigger,
    onFrame,
    sensitivity  = 20,   // gray-level diff to classify as foreground (0–255)
    minFgPercent = 0.15, // fraction of zone pixels that must be foreground to trigger
    debounce     = 2000, // ms to ignore after trigger
    fps          = 30,
    facingMode   = 'environment',
  } = {}) {
    this.onTrigger     = onTrigger;
    this.onFrame       = onFrame;
    this.sensitivity   = sensitivity;
    this.minFgPercent  = minFgPercent;
    this.debounce      = debounce;
    this.fps           = fps;
    this.facingMode    = facingMode;

    this.zoneTop    = 0.40;
    this.zoneHeight = 0.15;  // slightly taller zone for better coverage

    this._stream       = null;
    this._video        = null;
    this._canvas       = null;
    this._ctx          = null;
    this._background   = null;  // running background model
    this._armed        = false;
    this._lastFire     = 0;
    this._rafId        = null;
    this._getServerTime = () => Date.now();
    this._frameCount   = 0;
    this._warmupFrames = 20;  // more warmup for background to settle
    this._bgAlpha      = 0.05; // background learning rate (slow = stable bg)
  }

  enable()  { this._armed = true; }
  disable() { this._armed = false; }

  setZone(top, height) {
    this.zoneTop    = Math.max(0, Math.min(0.85, top));
    this.zoneHeight = Math.max(0.05, Math.min(0.5, height));
  }

  setSensitivity(threshold) {
    this.sensitivity = Math.max(1, Math.min(255, threshold));
  }

  setServerTimeFn(fn) {
    this._getServerTime = fn;
  }

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

  _toGray(data, length) {
    const gray = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const p = i * 4;
      gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }
    return gray;
  }

  _updateBackground(gray) {
    if (!this._background) {
      this._background = Float32Array.from(gray);
      return;
    }
    const a = this._bgAlpha;
    for (let i = 0; i < gray.length; i++) {
      this._background[i] = a * gray[i] + (1 - a) * this._background[i];
    }
  }

  _foregroundPercent(gray) {
    if (!this._background) return 0;
    let fg = 0;
    for (let i = 0; i < gray.length; i++) {
      if (Math.abs(gray[i] - this._background[i]) > this.sensitivity) fg++;
    }
    return fg / gray.length;
  }

  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());
    if (!this._video || this._video.readyState < 2) return;

    const W = this._canvas.width;
    const H = this._canvas.height;

    this._ctx.drawImage(this._video, 0, 0, W, H);

    const zY   = Math.floor(this.zoneTop * H);
    const zH   = Math.max(4, Math.floor(this.zoneHeight * H));
    const data  = this._ctx.getImageData(0, zY, W, zH).data;
    const gray  = this._toGray(data, W * zH);

    this._frameCount++;

    // Always update background (slower learning when armed to preserve reference)
    const alpha = this._armed ? 0.01 : this._bgAlpha;
    if (!this._background) {
      this._background = Float32Array.from(gray);
    } else {
      for (let i = 0; i < gray.length; i++) {
        this._background[i] = alpha * gray[i] + (1 - alpha) * this._background[i];
      }
    }

    if (this._frameCount < this._warmupFrames) return;

    const fgPct = this._foregroundPercent(gray);

    this.onFrame?.({
      mad:        Math.round(fgPct * 100),  // repurpose as foreground% 0-100
      armed:      this._armed,
      zoneTop:    this.zoneTop,
      zoneHeight: this.zoneHeight,
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
