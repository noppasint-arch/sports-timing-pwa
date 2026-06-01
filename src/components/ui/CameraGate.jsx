import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraMotionDetector } from '../../core/CameraMotionDetector';

/**
 * CameraGate — renders the live camera feed with the detection zone overlay.
 * Acts as the visual replacement for the manual trigger button when in camera mode.
 *
 * Props:
 *   armed          — bool: gate is active, waiting for athlete
 *   onTrigger      — called when motion detected: ({ method, correctedTime, rawTime, mad })
 *   getServerTime  — fn() → corrected server ms
 *   sensitivity    — initial MAD threshold (5–80)
 *   zonePosition   — initial zone center as fraction of frame height (0–1)
 *   onDetectorReady — (detector) => void — gives parent access to enable/disable
 */
export default function CameraGate({
  armed,
  onTrigger,
  getServerTime,
  sensitivity: initSensitivity = 25,
  zonePosition: initZone = 0.45,
  onDetectorReady,
}) {
  const videoRef      = useRef(null);
  const overlayRef    = useRef(null);
  const detectorRef   = useRef(null);

  const [started,     setStarted]     = useState(false);
  const [error,       setError]       = useState(null);
  const [stats,       setStats]       = useState(null);   // { mad, armed, threshold }
  const [sensitivity, setSensitivity] = useState(initSensitivity);
  const [zonePos,     setZonePos]     = useState(initZone);
  const [zoneHeight]                  = useState(0.10);
  const [justFired,   setJustFired]   = useState(false);

  // ── Start camera on mount ────────────────────────────────────────────────
  useEffect(() => {
    const detector = new CameraMotionDetector({
      onTrigger: (ev) => {
        onTrigger?.(ev);
        setJustFired(true);
        setTimeout(() => setJustFired(false), 800);
      },
      onFrame: (s) => setStats(s),
      sensitivity: initSensitivity,
    });
    detectorRef.current = detector;
    onDetectorReady?.(detector);

    detector.setServerTimeFn(getServerTime);
    detector.setZone(initZone - zoneHeight / 2, zoneHeight);

    detector.start(videoRef.current)
      .then(() => setStarted(true))
      .catch(err => {
        console.error('[CameraGate]', err);
        setError(err.message || 'Camera unavailable');
      });

    return () => detector.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync armed state into detector
  useEffect(() => {
    if (!detectorRef.current) return;
    if (armed) detectorRef.current.enable();
    else       detectorRef.current.disable();
  }, [armed]);

  // Sync sensitivity
  useEffect(() => {
    detectorRef.current?.setSensitivity(sensitivity);
  }, [sensitivity]);

  // Sync zone position
  useEffect(() => {
    detectorRef.current?.setZone(zonePos - zoneHeight / 2, zoneHeight);
  }, [zonePos, zoneHeight]);

  // Draw overlay on canvas (detection zone + MAD meter) ─────────────────────
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !stats) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Detection zone band
    const zTop = (stats.zoneTop ?? zonePos - zoneHeight / 2) * H;
    const zH   = (stats.zoneHeight ?? zoneHeight) * H;

    // Background tint for zone
    ctx.fillStyle = justFired
      ? 'rgba(239,68,68,0.35)'
      : armed
        ? 'rgba(34,197,94,0.15)'
        : 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, zTop, W, zH);

    // Zone border lines (top & bottom)
    ctx.strokeStyle = justFired ? '#ef4444' : armed ? '#22c55e' : '#64748b';
    ctx.lineWidth   = 3;
    ctx.setLineDash([8, 6]);

    ctx.beginPath(); ctx.moveTo(0, zTop);      ctx.lineTo(W, zTop);      ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, zTop + zH); ctx.lineTo(W, zTop + zH); ctx.stroke();
    ctx.setLineDash([]);

    // Centre crosshair tick marks
    ctx.strokeStyle = justFired ? '#ef4444' : '#22c55e';
    ctx.lineWidth = 2;
    [[12, zTop + zH / 2], [W - 12, zTop + zH / 2]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke();
    });

    // ARMED / TRIGGERED label in zone
    ctx.font      = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = justFired ? '#ef4444' : armed ? '#22c55e' : '#94a3b8';
    ctx.fillText(
      justFired ? '⚡ TRIGGERED' : armed ? '● ARMED — detection zone' : '○ DISARMED',
      W / 2, zTop + zH / 2 + 5
    );

    // MAD bar at bottom
    if (stats.mad !== undefined) {
      const pct = Math.min(stats.mad / 100, 1);
      const barW = W * 0.6;
      const barX = (W - barW) / 2;
      const barY = H - 22;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, 12);

      const color = pct > (sensitivity / 100) ? '#ef4444' : pct > (sensitivity / 150) ? '#f59e0b' : '#22c55e';
      ctx.fillStyle = color;
      ctx.fillRect(barX, barY, barW * pct, 12);

      // Threshold marker
      const threshX = barX + barW * (sensitivity / 100);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.moveTo(threshX, barY - 3); ctx.lineTo(threshX, barY + 15); ctx.stroke();

      ctx.fillStyle   = '#ffffff';
      ctx.font        = '11px monospace';
      ctx.textAlign   = 'center';
      ctx.fillText(`MAD ${stats.mad.toFixed(1)}`, W / 2, barY - 4);
    }
  }, [stats, armed, justFired, sensitivity, zonePos, zoneHeight]);

  if (error) {
    return (
      <div className="rounded-2xl bg-red-950 border border-red-700 p-4 text-center">
        <div className="text-3xl mb-2">📵</div>
        <div className="text-red-300 font-bold">Camera unavailable</div>
        <div className="text-red-400 text-xs mt-1">{error}</div>
        <div className="text-slate-400 text-xs mt-2">
          Allow camera access in browser settings, then reload.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Camera viewport */}
      <div className="relative rounded-2xl overflow-hidden bg-black"
           style={{ aspectRatio: '4/3' }}>
        {/* Live video feed */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}  // mirror for front cam ergonomics
          playsInline muted autoPlay
        />

        {/* Overlay canvas — detection zone + MAD meter */}
        <canvas
          ref={overlayRef}
          width={640} height={480}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        {!started && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-slate-400 text-sm">Starting camera…</div>
          </div>
        )}

        {/* Status chip */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-bold
          ${justFired ? 'bg-red-600 text-white' : armed ? 'bg-green-700 text-green-100' : 'bg-slate-700 text-slate-300'}`}>
          {justFired ? '⚡ TRIGGERED' : armed ? '● ARMED' : '○ DISARMED'}
        </div>

        {/* Drag handle overlay for zone position */}
        <input
          type="range" min={15} max={85} step={1}
          value={Math.round(zonePos * 100)}
          onChange={e => setZonePos(e.target.value / 100)}
          className="absolute left-0 right-0 opacity-0 h-full cursor-ns-resize"
          style={{ writingMode: 'vertical-lr', direction: 'rtl', width: '100%' }}
          title="Drag to move detection zone"
        />
      </div>

      {/* Controls row */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>🎯 Detection zone</span>
          <span className="font-mono">{Math.round(zonePos * 100)}% from top</span>
        </div>
        <input type="range" min={10} max={85} step={1}
          value={Math.round(zonePos * 100)}
          onChange={e => setZonePos(e.target.value / 100)}
          className="w-full accent-brand-500 h-2" />

        <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
          <span>⚡ Sensitivity (threshold)</span>
          <span className="font-mono">{sensitivity}</span>
        </div>
        <input type="range" min={5} max={80} step={1}
          value={sensitivity}
          onChange={e => setSensitivity(+e.target.value)}
          className="w-full accent-brand-500 h-2" />
        <div className="flex justify-between text-xs text-slate-600">
          <span>← More sensitive</span>
          <span>Less sensitive →</span>
        </div>
      </div>

      {/* Setup guide */}
      <div className="text-xs text-slate-500 px-1 space-y-1">
        <p>📐 <strong className="text-slate-400">Aim:</strong> point camera at the gate line from the side — athlete should cross the green band.</p>
        <p>🔧 <strong className="text-slate-400">Calibrate:</strong> walk through the zone, watch the MAD bar spike — lower threshold if it doesn't trigger, raise if it fires on wind/shadows.</p>
      </div>
    </div>
  );
}
