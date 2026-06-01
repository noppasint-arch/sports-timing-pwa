import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getTemplate, calculateMetrics } from '../../templates/TemplateEngine';
import { TriggerSystem } from '../../core/TriggerSystem';
import { connection }    from '../../core/ConnectionManager';
import CountdownDisplay  from '../ui/CountdownDisplay';
import LiveTimer         from '../ui/LiveTimer';
import CameraGate        from '../ui/CameraGate';
import { v4 as uuid }   from 'uuid';

const COUNTDOWN_SECONDS = 3;

export default function RunningScreen({
  session, myRole, isHost, syncResult, settings,
  trialEvents, onTrigger, onSaveResult, onAbort, getServerTime,
}) {
  const [phase,      setPhase]     = useState('countdown');
  const [countdown,  setCountdown] = useState(COUNTDOWN_SECONDS);
  const [triggered,  setTriggered] = useState(false);
  const [flashColor, setFlashColor]= useState(null);   // 'red' | 'green' | null
  const [yDirection, setYDir]      = useState(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const triggerMode = 'camera';

  const triggerSystemRef  = useRef(null);
  const cameraDetectorRef = useRef(null);
  const startTimeRef      = useRef(null);

  const template = session ? getTemplate(session.testTemplate) : null;

  const isYCenter    = myRole === 'CENTER' && template?.id === 'y-shape-agility';
  const isEndpoint   = ['LEFT', 'RIGHT', 'FORWARD', 'FINISH', 'SPLIT', 'SPLIT2'].includes(myRole);
  const isStartRole  = myRole === 'START';
  const isTriggerRole= isEndpoint || isStartRole;

  // ── Audio/button trigger system ──────────────────────────────────────────
  useEffect(() => {
    const ts = new TriggerSystem({
      onTrigger: ({ method, correctedTime }) => {
        handleTriggerFired(method, correctedTime);
      },
      audioThreshold: settings?.audioThreshold ?? 0.85,
    });
    triggerSystemRef.current = ts;
    if (settings?.audioEnabled) ts.startAudio();
    return () => ts.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      setPhase('active');
      // startTimeRef will be set when START trigger fires, not here

      // Arm trigger systems
      triggerSystemRef.current?.enable();
      cameraDetectorRef.current?.enable();

      // Y-test CENTER: auto-select direction
      if (isYCenter) {
        const dirs = template.directions || ['LEFT', 'RIGHT', 'FORWARD'];
        const dir  = dirs[Math.floor(Math.random() * dirs.length)];
        setYDir(dir);
        connection.emit('ytest:direction', { direction: dir, trialId: uuid() });
        onTrigger('CENTER_CUE', getServerTime(), Date.now(), 'auto');
      }
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Y-test direction from server ─────────────────────────────────────────
  useEffect(() => {
    if (template?.id !== 'y-shape-agility') return;
    return connection.on('ytest:direction', ({ direction }) => setYDir(direction));
  }, [template]);

  // ── Start timer when START trigger fires ─────────────────────────────────
  useEffect(() => {
    if (timerStarted) return;
    const startEvent = trialEvents.find(e => e.role === 'START');
    if (startEvent) {
      startTimeRef.current = startEvent.correctedTime;
      setTimerStarted(true);
    }
  }, [trialEvents, timerStarted]);

  // ── Trial completion check (host only) ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'active' || !template || !isHost) return;

    const firedRoles = new Set(trialEvents.map(e => e.role));
    const allFired   = template.triggerSequence.every(r => firedRoles.has(r));

    if (allFired) {
      triggerSystemRef.current?.disable();
      cameraDetectorRef.current?.disable();
      setPhase('done');

      const metrics = calculateMetrics(template, trialEvents);
      onSaveResult({
        id:            uuid(),
        testId:        template.id,
        testName:      template.name,
        metrics,
        events:        trialEvents,
        syncQuality:   syncResult?.quality || 'unknown',
        triggerMethod: trialEvents[trialEvents.length - 1]?.method || 'button',
        savedAt:       Date.now(),
      });
    }
  }, [trialEvents, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trigger fired (any method) ────────────────────────────────────────────
  const handleTriggerFired = useCallback((method, correctedTime) => {
    if (triggered || phase !== 'active') return;
    setTriggered(true);
    triggerSystemRef.current?.disable();
    cameraDetectorRef.current?.disable();
    onTrigger(myRole, correctedTime, Date.now(), method);

    const color = method === 'camera' ? 'green' : 'red';
    setFlashColor(color);
    setTimeout(() => setFlashColor(null), 800);
  }, [triggered, phase, myRole, onTrigger]);

  // Camera gate trigger handler
  const handleCameraTrigger = useCallback(({ method, correctedTime, rawTime }) => {
    handleTriggerFired(method || 'camera', correctedTime);
  }, [handleTriggerFired]);

  if (!template) return null;

  const flashBg = flashColor === 'green'
    ? 'bg-green-950'
    : flashColor === 'red'
      ? 'bg-red-950'
      : '';

  const directionArrow = { LEFT: '←', RIGHT: '→', FORWARD: '↑' };

  return (
    <div className={`screen gap-3 overflow-y-auto transition-colors duration-300 ${flashBg}`}>

      {/* Top bar */}
      <div className="flex items-center justify-between shrink-0">
        <button onClick={onAbort} className="text-red-400 text-sm font-bold">✕ Abort</button>
        <div className="text-slate-400 text-sm font-bold">{myRole}</div>
        {isTriggerRole && (
          <div className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-300 font-bold">
            📷 Camera Gate
          </div>
        )}
      </div>

      {/* ── COUNTDOWN ─────────────────────────────────────────────────────── */}
      {phase === 'countdown' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <CountdownDisplay value={countdown} />
          <div className="text-slate-400 text-lg">
            📷 Camera gate arming…
          </div>
        </div>
      )}

      {/* ── ACTIVE ────────────────────────────────────────────────────────── */}
      {phase === 'active' && (
        <>
          {/* Live timer — only after START camera fires */}
          {timerStarted
            ? <LiveTimer startTime={startTimeRef.current} getServerTime={getServerTime} />
            : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="text-7xl font-black font-mono text-slate-600">0.00</div>
                <div className="text-slate-400 text-lg animate-pulse">⏳ Waiting for START gate…</div>
              </div>
            )
          }

          {/* Y-test direction */}
          {isYCenter && yDirection && (
            <div className="card text-center shrink-0">
              <div className="text-6xl font-black text-brand-400">
                {directionArrow[yDirection] || yDirection}
              </div>
              <div className="text-xl font-bold mt-1">{yDirection}</div>
            </div>
          )}

          {/* Y-test endpoint alert */}
          {template.id === 'y-shape-agility' && isEndpoint && yDirection && (
            <div className={`card text-center shrink-0 ${yDirection === myRole ? 'border-brand-500 bg-brand-900/30' : ''}`}>
              {yDirection === myRole ? (
                <div className="text-brand-400 font-black text-lg">🎯 ATHLETE COMING HERE</div>
              ) : (
                <div className="text-slate-500">Athlete directed to {yDirection}</div>
              )}
            </div>
          )}

          {/* ── CAMERA MODE ──────────────────────────────────────────────── */}
          {isTriggerRole && triggerMode === 'camera' && !triggered && (
            <CameraGate
              armed={phase === 'active' && !triggered}
              onTrigger={handleCameraTrigger}
              getServerTime={getServerTime}
              sensitivity={settings?.cameraSensitivity ?? 25}
              zonePosition={settings?.cameraZone ?? 0.45}
              onDetectorReady={d => { cameraDetectorRef.current = d; }}
            />
          )}


          {/* Triggered confirmation */}
          {triggered && (
            <div className="card text-center py-8 border-green-600 shrink-0">
              <div className="text-5xl">✅</div>
              <div className="text-green-400 font-black text-2xl mt-2">TRIGGERED!</div>
              <div className="text-slate-400 text-sm mt-1">
                Method: {trialEvents.find(e => e.role === myRole)?.method || '—'}
              </div>
              <div className="text-slate-500 text-sm mt-1">Waiting for other gates…</div>
            </div>
          )}

          {/* Event log */}
          {trialEvents.length > 0 && (
            <div className="card shrink-0">
              <div className="text-xs text-slate-400 uppercase mb-2">Events</div>
              {trialEvents.map((ev, i) => (
                <div key={i} className="flex justify-between items-center text-sm py-0.5">
                  <span className={`font-bold ${ev.method === 'camera' ? 'text-green-400' : 'text-brand-400'}`}>
                    {ev.role}
                  </span>
                  <span className="font-mono text-xs">
                    +{(ev.correctedTime - (trialEvents[0]?.correctedTime || ev.correctedTime)).toFixed(0)}ms
                  </span>
                  <span className="text-slate-500 text-xs">
                    {ev.method === 'camera' ? '📷' : ev.method === 'audio' ? '🎙️' : '👆'} {ev.method}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── DONE ──────────────────────────────────────────────────────────── */}
      {phase === 'done' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl">🏁</div>
            <div className="text-xl font-black mt-2">Trial Complete!</div>
            <div className="text-slate-400 text-sm mt-1">Calculating results…</div>
          </div>
        </div>
      )}
    </div>
  );
}
