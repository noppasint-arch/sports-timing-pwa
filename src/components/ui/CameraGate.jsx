import React, { useRef, useEffect, useState } from 'react';
import { CameraMotionDetector } from '../../core/CameraMotionDetector';

export default function CameraGate({
  armed,
  onTrigger,
  getServerTime,
  sensitivity: initSensitivity = 20,
  zonePosition: initZone = 0.50,
  onDetectorReady,
}) {
  const videoRef    = useRef(null);
  const overlayRef  = useRef(null);
  const detectorRef = useRef(null);

  const [started,     setStarted]     = useState(false);
  const [error,       setError]       = useState(null);
  const [stats,       setStats]       = useState(null);
  const [sensitivity, setSensitivity] = useState(initSensitivity);
  const [zoneCenter,  setZoneCenter]  = useState(initZone);
  const [justFired,   setJustFired]   = useState(false);
  const zoneWidth = 0.08;  // fixed narrow strip

  // ── Start detector ────────────────────────────────────────────────────────
  useEffect(() => {
    const detector = new CameraMotionDetector({
      onTrigger: (ev) => {
        onTrigger?.(ev);
        setJustFired(true);
        setTimeout(() => setJustFired(false), 1000);
      },
      onFrame: (s) => setStats(s),
      sensitivity: initSensitivity,
      minFgPercent: 0.20,
    });
    detectorRef.current = detector;
    onDetectorReady?.(detector);
    detector.setServerTimeFn(getServerTime);
    detector.setZone(initZone, zoneWidth);
    detector.start(videoRef.current)
      .then(() => setStarted(true))
      .catch(err => setError(err.message || 'Camera unavailable'));
    return () => detector.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!detectorRef.current) return;
    if (armed) detectorRef.current.enable();
    else       detectorRef.current.disable();
  }, [armed]);

  useEffect(() => { detectorRef.current?.setSensitivity(sensitivity); }, [sensitivity]);
  useEffect(() => { detectorRef.current?.setZone(zoneCenter, zoneWidth); }, [zoneCenter]);

  // ── Draw vertical gate overlay ────────────────────────────────────────────
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const center = (stats?.zoneCenter ?? zoneCenter) * W;
    const hw     = ((stats?.zoneWidth  ?? zoneWidth) * W) / 2;
    const fgPct  = stats ? stats.mad / 100 : 0;
    const threshold = stats ? stats.threshold / 100 : 0.20;

    const color = justFired ? '#ef4444' : armed ? '#22c55e' : '#64748b';

    // Vertical strip fill
    ctx.fillStyle = justFired
      ? 'rgba(239,68,68,0.35)'
      : armed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(center - hw, 0, hw * 2, H);

    // Left and right border lines (vertical dashed)
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.moveTo(center - hw, 0); ctx.lineTo(center - hw, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(center + hw, 0); ctx.lineTo(center + hw, H); ctx.stroke();
    ctx.setLineDash([]);

    // Centre solid line (the "beam")
    ctx.strokeStyle = color;
    ctx.lineWidth   = justFired ? 4 : 2.5;
    ctx.beginPath(); ctx.moveTo(center, 0); ctx.lineTo(center, H); ctx.stroke();

    // Horizontal crosshair ticks at top and bottom
    [[center, 16], [center, H - 16]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.stroke();
    });

    // Gate label (vertical, beside the line)
    ctx.save();
    ctx.translate(center + hw + 14, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font      = 'bold 11px system-ui';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(justFired ? '⚡ TRIGGERED' : armed ? '● GATE ARMED' : '○ DISARMED', 0, 0);
    ctx.restore();

    // Foreground % bar at bottom
    const barW = W * 0.65, barX = (W - barW) / 2, barY = H - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, 16);

    const barColor = fgPct >= threshold ? '#ef4444' : fgPct >= threshold * 0.5 ? '#f59e0b' : '#22c55e';
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barW * Math.min(fgPct, 1), 12);

    // Threshold marker
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    const tx = barX + barW * Math.min(threshold, 1);
    ctx.beginPath(); ctx.moveTo(tx, barY - 4); ctx.lineTo(tx, barY + 16); ctx.stroke();

    ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`Gate ${Math.round(fgPct * 100)}% / trigger ${Math.round(threshold * 100)}%`, W / 2, barY - 5);

  }, [stats, armed, justFired, zoneCenter]);

  if (error) {
    return (
      <div className="rounded-2xl bg-red-950 border border-red-700 p-4 text-center">
        <div className="text-3xl mb-2">📵</div>
        <div className="text-red-300 font-bold">Camera unavailable</div>
        <div className="text-red-400 text-xs mt-1">{error}</div>
        <div className="text-slate-400 text-xs mt-2">Allow camera access in browser settings, then reload.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Camera viewport */}
      <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
        <video ref={videoRef} className="w-full h-full object-cover"
          playsInline muted autoPlay />
        <canvas ref={overlayRef} width={640} height={480}
          className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />

        {!started && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-slate-400 animate-pulse">Starting camera…</div>
          </div>
        )}

        {/* Status chip */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-bold
          ${justFired ? 'bg-red-600 text-white' : armed ? 'bg-green-700 text-green-100' : 'bg-slate-700 text-slate-300'}`}>
          {justFired ? '⚡ TRIGGERED' : armed ? '● ARMED' : '○ DISARMED'}
        </div>
      </div>

      {/* Controls */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>↔ Gate position (from left)</span>
          <span className="font-mono">{Math.round(zoneCenter * 100)}%</span>
        </div>
        <input type="range" min={10} max={90} step={1}
          value={Math.round(zoneCenter * 100)}
          onChange={e => setZoneCenter(e.target.value / 100)}
          className="w-full accent-brand-500 h-2" />

        <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
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

      {/* Setup guide */}
      <div className="bg-slate-800/60 rounded-xl p-3 text-xs text-slate-400 space-y-1">
        <p>📱 <strong className="text-slate-300">Setup:</strong> Mount phone <strong>sideways</strong> at the gate — camera pointing across the track.</p>
        <p>🟢 <strong className="text-slate-300">Align:</strong> Drag slider so the vertical line sits exactly on the gate position.</p>
        <p>⏳ <strong className="text-slate-300">Calibrate:</strong> Keep clear for 2–3 sec (background builds), then walk through — bar should turn red.</p>
      </div>
    </div>
  );
}
