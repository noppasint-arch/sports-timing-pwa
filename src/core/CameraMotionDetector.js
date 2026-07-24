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
 *
 * Timing precision (for research-grade validation against reference gates):
 *   - Frame sampling is driven by `video.requestVideoFrameCallback` (rVFC) when
 *     available, which fires once per actually-decoded camera frame with a real
 *     capture-linked timestamp — instead of `requestAnimationFrame`, which runs at
 *     display refresh rate and is decoupled from the camera's own frame rate.
 *     Falls back to rAF on browsers without rVFC support.
 *   - The trigger instant is linearly interpolated between the last sub-threshold
 *     frame and the triggering frame, based on where the foreground% crossed the
 *     threshold — this collapses the error bound from "one whole frame interval"
 *     down to a small fraction of one.
 *   - An optional diagnostic trace (raw foreground% timeseries) can be attached
 *     to each trigger event for offline comparison against a reference timing
 *     system.
 *
 * Dual-zone false-trigger filter (optional, off by default):
 *   Mirrors a real double-photocell gate (two beams stacked vertically, both
 *   must break together) — the vertical strip is split into a top and bottom
 *   band, each with its own foreground%, and the trigger condition becomes
 *   min(topFg, bottomFg) >= threshold instead of a single combined fg%. This
 *   rejects a lone limb/object passing through only one band (e.g. a leading
 *   arm, a bird, insects) without the athlete's whole body being in the zone.
 */
export class CameraMotionDetector {
  constructor({
    onTrigger,
    onFrame,
    sensitivity  = 20,   // gray-level diff to classify as foreground (0–255)
    minFgPercent = 0.20, // fraction of vertical strip that must be foreground
    debounce     = 2000,
    fps          = 60,   // ideal capture fps — browser clamps to device max
    facingMode   = 'environment',
    diagnostics  = false,
    dualZone     = false,
  } = {}) {
    this.onTrigger    = onTrigger;
    this.onFrame      = onFrame;
    this.sensitivity  = sensitivity;
    this.minFgPercent = minFgPercent;
    this.debounce     = debounce;
    this.fps          = fps;
    this.facingMode   = facingMode;
    this.diagnostics  = diagnostics;
    this.dualZone     = dualZone;

    // Vertical gate: horizontal position and width (fractions of frame width)
    this.zoneCenter    = 0.50;  // default: center of frame
    this.zoneWidth     = 0.08;  // 8% of frame width — narrow like a real beam
    this.zoneSplitFrac = 0.50;  // dual-zone: fraction of strip height where top/bottom bands split

    this._stream        = null;
    this._video         = null;
    this._canvas        = null;
    this._ctx           = null;
    this._background    = null;
    this._armed         = false;
    this._lastFire      = 0;
    this._rafId         = null;
    this._vfcId         = null;
    this._getServerTime = () => Date.now();
    this._frameCount    = 0;
    this._warmupFrames  = 20;
    this._prevSample    = null; // { t, fg } of the previous processed frame
    this._trace         = [];   // ring buffer of { t, fg } when diagnostics enabled
    this._traceMax      = 300;
    this._useRVFC        = typeof HTMLVideoElement !== 'undefined'
      && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
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
  setDiagnostics(v) { this.diagnostics = !!v; if (!this.diagnostics) this._trace = []; }
  setDualZone(v) { this.dualZone = !!v; }

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
    this._prevSample = null;
    this._trace      = [];

    if (this._useRVFC) {
      this._vfcId = this._video.requestVideoFrameCallback((now, metadata) => this._onVideoFrame(now, metadata));
    } else {
      this._loop();
    }
  }

  stop() {
    this._armed = false;
    if (this._rafId != null) cancelAnimationFrame(this._rafId);
    if (this._vfcId != null && this._video?.cancelVideoFrameCallback) {
      this._video.cancelVideoFrameCallback(this._vfcId);
    }
    this._rafId = null;
    this._vfcId = null;
    this._stream?.getTracks().forEach(t => t.stop());
    this._stream = null;
    this._video  = null;
    this._background = null;
    this._prevSample  = null;
  }

  /** rAF fallback loop (browsers without requestVideoFrameCallback) */
  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());
    if (!this._video || this._video.readyState < 2) return;
    this._processSample(performanceTimeOrigin() + performance.now());
  }

  /** rVFC path — fires once per actually-decoded camera frame */
  _onVideoFrame(now, metadata) {
    if (!this._video) return;
    this._vfcId = this._video.requestVideoFrameCallback((n, m) => this._onVideoFrame(n, m));
    // expectedDisplayTime shares the performance.now() timebase — convert to epoch ms.
    const frameEpochMs = performanceTimeOrigin() + (metadata.expectedDisplayTime ?? now);
    this._processSample(frameEpochMs);
  }

  /** Shared per-frame analysis. `frameEpochMs` is this frame's capture-linked wall-clock time. */
  _processSample(frameEpochMs) {
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

    // Count foreground pixels — either the whole strip, or (dual-zone) the
    // top/bottom bands separately, gated by their minimum (both must break).
    let fgPct, fgTopPct, fgBottomPct;
    if (this.dualZone) {
      const splitRow = Math.max(1, Math.min(H - 1, Math.round(H * this.zoneSplitFrac)));
      const topLen = splitRow * zW;
      const botLen = len - topLen;
      let fgTop = 0, fgBottom = 0;
      for (let i = 0; i < len; i++) {
        if (Math.abs(gray[i] - this._background[i]) > this.sensitivity) {
          if (i < topLen) fgTop++; else fgBottom++;
        }
      }
      fgTopPct    = fgTop / topLen;
      fgBottomPct = fgBottom / botLen;
      fgPct       = Math.min(fgTopPct, fgBottomPct);
    } else {
      let fg = 0;
      for (let i = 0; i < len; i++) {
        if (Math.abs(gray[i] - this._background[i]) > this.sensitivity) fg++;
      }
      fgPct = fg / len;
    }

    this.onFrame?.({
      mad:        Math.round(fgPct * 100),       // reuse field: foreground % (dual-zone: min of both bands)
      armed:      this._armed,
      zoneCenter: this.zoneCenter,
      zoneWidth:  this.zoneWidth,
      threshold:  Math.round(this.minFgPercent * 100),
      dualZone:      this.dualZone,
      zoneSplitFrac: this.zoneSplitFrac,
      ...(this.dualZone ? { fgTop: Math.round(fgTopPct * 100), fgBottom: Math.round(fgBottomPct * 100) } : {}),
    });

    if (this.diagnostics) {
      this._trace.push({ t: frameEpochMs, fg: fgPct });
      if (this._trace.length > this._traceMax) this._trace.shift();
    }

    if (this._armed && fgPct >= this.minFgPercent) {
      const now = Date.now();
      if (now - this._lastFire >= this.debounce) {
        this._lastFire = now;
        this._armed    = false;

        // Sub-frame linear interpolation of the true crossing instant, using the
        // last sample below threshold and this (at/above threshold) sample.
        let crossTime = frameEpochMs;
        let interpolated = false;
        const prev = this._prevSample;
        if (prev && prev.fg < this.minFgPercent && fgPct > prev.fg) {
          const frac = Math.max(0, Math.min(1, (this.minFgPercent - prev.fg) / (fgPct - prev.fg)));
          crossTime = prev.t + frac * (frameEpochMs - prev.t);
          interpolated = true;
        }

        // this._getServerTime() applies the NTP-style clock offset on top of Date.now();
        // extracting that offset lets us apply it to the frame's own capture timestamp
        // instead of the (later, jitter-prone) moment the trigger condition was noticed.
        const clockOffset = this._getServerTime() - Date.now();

        this.onTrigger?.({
          method:        'camera',
          correctedTime: crossTime + clockOffset,
          rawTime:       now,
          mad:           Math.round(fgPct * 100),
          interpolated,
          ...(this.diagnostics ? { signalTrace: this._trace.slice() } : {}),
        });
      }
    }

    this._prevSample = { t: frameEpochMs, fg: fgPct };
  }

  getStream() { return this._stream; }
}

function performanceTimeOrigin() {
  return performance.timeOrigin ?? (Date.now() - performance.now());
}
