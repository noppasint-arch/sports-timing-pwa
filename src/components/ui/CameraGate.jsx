import React, { useRef, useEffect, useState } from 'react';
import { CameraMotionDetector } from '../../core/CameraMotionDetector';

export default function CameraGate({
  armed,
  onTrigger,
  getServerTime,
  sensitivity: initSensitivity = 20,
  zonePosition: initZone = 0.45,
  onDetectorReady,
}) {
  const videoRef    = useRef(null);
  const overlayRef  = useRef(null);
  const detectorRef = useRef(null);

  const [started,     setStarted]     = useState(false);
  const [error,       setError]       = useState(null);
  const [stats,       setStats]       = useState(null);
  const [sensitivity, setSensitivity] = useState(initSensitivity);
  const [zonePos,     setZonePos]     = useState(initZone);
  const [justFired,   setJustFired]   = useState(false);
  const zoneHeight = 0.15;

  useEffect(() => {
    const detector = new CameraMotionDetector({
      onTrigger: (ev) => {
        onTrigger?.(ev);
        setJustFired(true);
        setTimeout(() => setJustFired(false), 1000);
      },
      onFrame: (s) => setStats(s),
      sensitivity: initSensitivity,
      minFgPercent: 0.15,
    });
    detectorRef.current = detector;
    onDetectorReady?.(detector);
    detector.setServerTimeFn(getServerTime);
    detector.setZone(initZone - zoneHeight / 2, zoneHeight);
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
  useEffect(() => { detectorRef.current?.setZone(zonePos - zoneHeight / 2, zoneHeight); }, [zonePos]);

  // Canvas overlay drawing
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !stats) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const zTop = (stats.zoneTop ?? (zonePos - zoneHeight / 2)) * H;
    const zH   = (stats.zoneHeight ?? zoneHeight) * H;

    // Zone fill
    ctx.fillStyle = justFired
      ? 'rgba(239,68,68,0.4)'
      : armed ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, zTop, W, zH);

    // Zone borders
    const lineColor = justFired ? '#ef4444' : armed ? '#22c55e' : '#64748b';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(0, zTop);      ctx.lineTo(W, zTop);      ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, zTop + zH); ctx.lineTo(W, zTop + zH); ctx.stroke();
    ctx.setLineDash([]);

    // Crosshairs
    ctx.strokeStyle = lineColor; ctx.lineWidth = 2;
    [[14, zTop + zH/2], [W-14, zTop + zH/2]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.moveTo(x-8,y); ctx.lineTo(x+8,y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,y-8); ctx.lineTo(x,y+8); ctx.stroke();
    });

    // Zone label
    ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = lineColor;
    ctx.fillText(
      justFired ? '⚡ TRIGGERED' : armed ? '● ARMED' : '○ DISARMED',
      W/2, zTop + zH/2 + 5
    );

    // Foreground % bar
    if (stats.mad !== undefined) {
      const fgPct = stats.mad / 100;  // 0–1
      const threshold = stats.threshold / 100;
      const barW = W * 0.7, barX = (W - barW) / 2, barY = H - 22;

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(barX - 2, barY - 2, barW + 4, 16);

      const barColor = fgPct >= threshold ? '#ef4444' : fgPct >= threshold * 0.6 ? '#f59e0b' : '#22c55e';
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barW * Math.min(fgPct, 1), 12);

      // Threshold line
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      const tx = barX + barW * threshold;
      ctx.beginPath(); ctx.moveTo(tx, barY - 4); ctx.lineTo(tx, barY + 16); ctx.stroke();

      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`Zone ${Math.round(fgPct * 100)}% / trigger ${Math.round(threshold * 100)}%`, W/2, barY - 5);
    }
  }, [stats, armed, justFired, zonePos]);

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
          style={{ transform: 'scaleX(-1)' }} playsInline muted autoPlay />
        <canvas ref={overlayRef} width={640} height={480}
          className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />

        {!started && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-slate-400 animate-pulse">Starting camera…</div>
          </div>
        )}

        <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-bold
          ${justFired ? 'bg-red-600 text-white' : armed ? 'bg-green-700 text-green-100' : 'bg-slate-700 text-slate-300'}`}>
          {justFired ? '⚡ TRIGGERED' : armed ? '● ARMED' : '○ DISARMED'}
        </div>
      </div>

      {/* Controls */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>🎯 Detection zone (from top)</span>
          <span className="font-mono">{Math.round(zonePos * 100)}%</span>
        </div>
        <input type="range" min={10} max={85} step={1}
          value={Math.round(zonePos * 100)}
          onChange={e => setZonePos(e.target.value / 100)}
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

      {/* Guide */}
      <div className="text-xs text-slate-500 px-1 space-y-1">
        <p>📐 <strong className="text-slate-400">Setup:</strong> Mount phone sideways, camera pointing across the track. Align green band at athlete's waist/hip height.</p>
        <p>🔧 <strong className="text-slate-400">Calibrate:</strong> Stand still 3 sec (background builds), then walk through — bar should fill red. Lower sensitivity if it doesn't trigger.</p>
      </div>
    </div>
  );
}
