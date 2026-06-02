import React, { useRef, useEffect, useState } from 'react';
import { ensureCameraStarted, updateCameraCallbacks, getCameraDetector } from '../../core/CameraManager';

/**
 * CameraGate — live camera view with vertical gate overlay.
 * Uses a module-level singleton so the camera stream persists across trials.
 * Permission is requested once; background model never resets between trials.
 */
export default function CameraGate({
  armed,
  onTrigger,
  getServerTime,
  sensitivity: initSensitivity = 20,
  zonePosition: initZone = 0.50,
  onDetectorReady,
}) {
  const videoRef   = useRef(null);
  const overlayRef = useRef(null);

  const [started,     setStarted]     = useState(() => !!getCameraDetector()?._stream);
  const [error,       setError]       = useState(null);
  const [stats,       setStats]       = useState(null);
  const [sensitivity, setSensitivity] = useState(initSensitivity);
  const [zoneCenter,  setZoneCenter]  = useState(initZone);
  const [justFired,   setJustFired]   = useState(false);
  const zoneWidth = 0.08;

  // ── Attach callbacks & start if needed ───────────────────────────────────
  useEffect(() => {
    const callbacks = {
      onTrigger: (ev) => {
        onTrigger?.(ev);
        setJustFired(true);
        setTimeout(() => setJustFired(false), 1000);
      },
      onFrame: (s) => setStats(s),
    };

    // If singleton already running, just re-attach callbacks and wire video
    const existing = getCameraDetector();
    if (existing?._stream) {
      updateCameraCallbacks(callbacks);
      if (videoRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = existing.getStream();
        videoRef.current.play().catch(() => {});
      }
      onDetectorReady?.(existing);
      setStarted(true);
      return;
    }

    // First time — start the camera (asks permission once)
    ensureCameraStarted({
      videoEl:     videoRef.current,
      sensitivity: initSensitivity,
      zoneCenter:  initZone,
      zoneWidth,
      getServerTime,
    }).then(detector => {
      detector.onTrigger = callbacks.onTrigger;
      detector.onFrame   = callbacks.onFrame;
      onDetectorReady?.(detector);
      setStarted(true);
    }).catch(err => {
      setError(err.message || 'Camera unavailable');
    });

    // No cleanup stop — camera keeps running between trials
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Arm / disarm
  useEffect(() => {
    const d = getCameraDetector();
    if (!d) return;
    if (armed) d.enable();
    else       d.disable();
  }, [armed]);

  // Sensitivity
  useEffect(() => {
    getCameraDetector()?.setSensitivity(sensitivity);
  }, [sensitivity]);

  // Zone position
  useEffect(() => {
    getCameraDetector()?.setZone(zoneCenter, zoneWidth);
  }, [zoneCenter]);

  // ── Canvas overlay — vertical gate ───────────────────────────────────────
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const center = (stats?.zoneCenter ?? zoneCenter) * W;
    const hw     = ((stats?.zoneWidth  ?? zoneWidth) * W) / 2;
    const fgPct  = stats ? stats.mad / 100 : 0;
    const thresh = stats ? stats.threshold / 100 : 0.20;
    const color  = justFired ? '#ef4444' : armed ? '#22c55e' : '#64748b';

    // Strip fill
    ctx.fillStyle = justFired ? 'rgba(239,68,68,0.35)' : armed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(center - hw, 0, hw * 2, H);

    // Border dashes
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.moveTo(center - hw, 0); ctx.lineTo(center - hw, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(center + hw, 0); ctx.lineTo(center + hw, H); ctx.stroke();
    ctx.setLineDash([]);

    // Centre beam
    ctx.strokeStyle = color; ctx.lineWidth = justFired ? 4 : 2.5;
    ctx.beginPath(); ctx.moveTo(center, 0); ctx.lineTo(center, H); ctx.stroke();

    // Crosshair ticks
    [[center, 16], [center, H - 16]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.stroke();
    });

    // Label beside line
    ctx.save();
    ctx.translate(center + hw + 14, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'bold 11px system-ui'; ctx.fillStyle = color; ctx.textAlign = 'center';
    ctx.fillText(justFired ? '⚡ TRIGGERED' : armed ? '● GATE ARMED' : '○ DISARMED', 0, 0);
    ctx.restore();

    // Foreground bar
    const barW = W * 0.65, barX = (W - barW) / 2, barY = H - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, 16);
    const barColor = fgPct >= thresh ? '#ef4444' : fgPct >= thresh * 0.5 ? '#f59e0b' : '#22c55e';
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barW * Math.min(fgPct, 1), 12);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    const tx = barX + barW * Math.min(thresh, 1);
    ctx.beginPath(); ctx.moveTo(tx, barY - 4); ctx.lineTo(tx, barY + 16); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`Gate ${Math.round(fgPct * 100)}% / trigger ${Math.round(thresh * 100)}%`, W / 2, barY - 5);

  }, [stats, armed, justFired, zoneCenter]);

  if (error) {
    return (
      <div className="rounded-2xl bg-red-950 border border-red-700 p-4 text-center space-y-2">
        <div className="text-3xl">📵</div>
        <div className="text-red-300 font-bold">Camera unavailable</div>
        <div className="text-red-400 text-xs">{error}</div>
        <div className="text-slate-400 text-xs">Allow camera access in browser settings, then reload.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
        <canvas ref={overlayRef} width={640} height={480}
          className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />

        {!started && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-slate-400 animate-pulse text-sm">Starting camera…</div>
          </div>
        )}

        <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-bold
          ${justFired ? 'bg-red-600 text-white' : armed ? 'bg-green-700 text-green-100' : 'bg-slate-700 text-slate-300'}`}>
          {justFired ? '⚡ TRIGGERED' : armed ? '● ARMED' : '○ DISARMED'}
        </div>
      </div>

      <div className="card flex flex-col gap-3">
        <div className="flex justify-between text-xs text-slate-400">
          <span>↔ Gate position (from left)</span>
          <span className="font-mono">{Math.round(zoneCenter * 100)}%</span>
        </div>
        <input type="range" min={10} max={90} step={1}
          value={Math.round(zoneCenter * 100)}
          onChange={e => setZoneCenter(e.target.value / 100)}
          className="w-full accent-brand-500 h-2" />

        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>⚡ Pixel sensitivity</span>
          <span className="font-mono">{sensitivity}</span>
        </div>
        <input type="range" min={5} max={60} step={1}
          value={sensitivity}
          onChange={e => setSensitivity(+e.target.value)}
          className="w-full accent-brand-500 h-2" />
        <div className="flex justify-between text-xs text-slate-600">
          <span>← More sensitive</span><span>Less sensitive →</span>
        </div>
      </div>

      <div className="bg-slate-800/60 rounded-xl p-3 text-xs text-slate-400 space-y-1">
        <p>📱 <strong className="text-slate-300">Setup:</strong> Mount phone <strong>sideways</strong>, camera pointing across the track.</p>
        <p>🟢 <strong className="text-slate-300">Align:</strong> Slide until the vertical line sits on the gate point.</p>
        <p>⏳ <strong className="text-slate-300">Calibrate:</strong> Stay clear 2–3 sec, then walk through — bar turns red.</p>
      </div>
    </div>
  );
}
