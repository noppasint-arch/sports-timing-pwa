/**
 * CameraMotionDetector — electronic light gate via phone camera.
 *
 * How it works (mimics an IR timing gate):
 *   1. Camera feed → Canvas (30fps)
 *   2. A narrow horizontal "detection zone" strip is sampled each frame
 *   3. Strip pixels converted to grayscale and compared with previous frame
 *   4. Mean Absolute Difference (MAD) of the zone is computed
 *   5. When MAD exceeds threshold → TRIGGER (athlete broke the beam)
 *   6. Hard debounce after trigger to prevent double-fires
 *
 * The detection zone is a configurable horizontal band across the frame,
 * mirroring the line marker concept — coach aligns the band with the
 * physical tape/cone on the ground via camera framing.
 *
 * Usage:
 *   const detector = new CameraMotionDetector({ onTrigger, onFrame });
 *   await detector.start();
 *   detector.setZone(0.45, 0.10);   // zone top 45%, height 10% of frame
 *   detector.setSensitivity(25);     // MAD threshold (0-255)
 *   detector.enable();               // arm the gate
 *   detector.stop();                 // release camera
 */
export class CameraMotionDetector {
  constructor({
    onTrigger,           // ({ method, correctedTime, rawTime, mad }) => void
    onFrame,             // ({ mad, armed, zoneTop, zoneHeight }) => void — live feed stats
    sensitivity = 25,    // MAD threshold (lower = more sensitive)
    debounce    = 1500,  // ms to ignore after trigger
    fps         = 30,
    facingMode  = 'environment',  // rear camera by default
  } = {}) {
    this.onTrigger   = onTrigger;
    this.onFrame     = onFrame;
    this.sensitivity = sensitivity;
    this.debounce    = debounce;
    this.fps         = fps;
    this.facingMode  = facingMode;

    // Detection zone: fraction of frame height (0–1)
    this.zoneTop    = 0.40;  // default: 40% from top
    this.zoneHeight = 0.12;  // default: 12% tall strip

    this._stream      = null;
    this._video       = null;
    this._canvas      = null;
    this._ctx         = null;
    this._prevGray    = null;
    this._armed       = false;
    this._lastFire    = 0;
    this._rafId       = null;
    this._getServerTime = () => Date.now();
    this._frameCount  = 0;
    this._warmupFrames = 10; // discard first N frames (auto-exposure settling)
  }

  /** Arm the gate — calls onTrigger when motion detected */
  enable()  { this._armed = true; }
  /** Disarm without releasing camera */
  disable() { this._armed = false; }

  setZone(top, height) {
    this.zoneTop    = Math.max(0, Math.min(0.9, top));
    this.zoneHeight = Math.max(0.02, Math.min(0.5, height));
  }

  setSensitivity(threshold) {
    this.sensitivity = Math.max(1, Math.min(255, threshold));
  }

  setServerTimeFn(fn) {
    this._getServerTime = fn;
  }

  /** Request camera and begin processing frames */
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

    // Use provided video element or create an offscreen one
    this._video = videoEl || document.createElement('video');
    this._video.srcObject = this._stream;
    this._video.playsInline = true;
    this._video.muted = true;
    await this._video.play();

    // Offscreen canvas for pixel analysis
    this._canvas = document.createElement('canvas');
    this._canvas.width  = 320;  // process at half res — fast enough, accurate enough
    this._canvas.height = 240;
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });

    this._frameCount = 0;
    this._prevGray   = null;
    this._loop();
  }

  stop() {
    this._armed = false;
    cancelAnimationFrame(this._rafId);
    this._stream?.getTracks().forEach(t => t.stop());
    this._stream = null;
    this._video  = null;
    this._prevGray = null;
  }

  // ── Frame processing loop ────────────────────────────────────────────────
  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());

    if (!this._video || this._video.readyState < 2) return;

    const W = this._canvas.width;
    const H = this._canvas.height;

    // Draw current frame at reduced resolution
    this._ctx.drawImage(this._video, 0, 0, W, H);

    // Extract detection zone pixel data
    const zY  = Math.floor(this.zoneTop * H);
    const zH  = Math.max(2, Math.floor(this.zoneHeight * H));
    const data = this._ctx.getImageData(0, zY, W, zH).data;

    // Convert to grayscale array
    const gray = new Float32Array(W * zH);
    for (let i = 0; i < W * zH; i++) {
      const p = i * 4;
      gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }

    this._frameCount++;

    let mad = 0;
    if (this._prevGray && this._frameCount > this._warmupFrames) {
      // Mean Absolute Difference between current and previous frame
      let sum = 0;
      for (let i = 0; i < gray.length; i++) {
        sum += Math.abs(gray[i] - this._prevGray[i]);
      }
      mad = sum / gray.length;

      // Notify UI with live stats
      this.onFrame?.({
        mad:        Math.round(mad * 10) / 10,
        armed:      this._armed,
        zoneTop:    this.zoneTop,
        zoneHeight: this.zoneHeight,
        threshold:  this.sensitivity,
      });

      // Trigger condition
      if (this._armed && mad >= this.sensitivity) {
        const now = Date.now();
        if (now - this._lastFire >= this.debounce) {
          this._lastFire = now;
          this._armed = false; // auto-disarm after trigger (re-armed by engine)
          this.onTrigger?.({
            method:        'camera',
            correctedTime: this._getServerTime(),
            rawTime:       now,
            mad:           Math.round(mad),
          });
        }
      }
    }

    this._prevGray = gray;
  }

  /** Returns the live video stream for displaying preview in UI */
  getStream() { return this._stream; }
}
