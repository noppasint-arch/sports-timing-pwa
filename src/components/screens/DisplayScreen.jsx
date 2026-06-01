import React, { useState, useEffect } from 'react';
import { getTemplate, getNormRating } from '../../templates/TemplateEngine';
import { connection } from '../../core/ConnectionManager';

/**
 * DisplayScreen — full-screen result board for the DISPLAY role device.
 * Placed at the finish line facing the athlete.
 * Shows the time BIG the moment the trial completes.
 */
export default function DisplayScreen({ session, syncResult }) {
  const [phase,  setPhase]  = useState('waiting'); // waiting | countdown | running | result
  const [result, setResult] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const template = session ? getTemplate(session.testTemplate) : null;

  useEffect(() => {
    const offs = [
      connection.on('test:start_trial', ({ countdown: cd, serverTime }) => {
        setResult(null);
        setElapsed(0);
        setPhase('countdown');
        setCountdown(cd ?? 3);
      }),

      connection.on('test:abort_trial', () => {
        setPhase('waiting');
        setResult(null);
        setStartTime(null);
      }),

      connection.on('test:next_trial', () => {
        setPhase('waiting');
        setResult(null);
        setStartTime(null);
      }),

      // START trigger fires → switch to running + start live timer
      connection.on('trigger:event', (ev) => {
        if (ev.role === 'START' || ev.role === 'CENTER_CUE') {
          setStartTime(ev.correctedTime);
          setPhase('running');
        }
      }),

      connection.on('result:new', (r) => {
        setResult(r);
        setPhase('result');
        setStartTime(null);
      }),
    ];
    return () => offs.forEach(fn => fn());
  }, []);

  // Countdown tick
  useEffect(() => {
    if (phase !== 'countdown' || countdown === null) return;
    if (countdown <= 0) return; // RunningScreen handles the GO→running transition
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Live timer tick
  useEffect(() => {
    if (phase !== 'running' || !startTime) return;
    const id = setInterval(() => setElapsed(Date.now() - startTime), 50);
    return () => clearInterval(id);
  }, [phase, startTime]);

  // Norm rating
  const normRating = (() => {
    if (!result?.metrics?.totalTimeS || !template?.normTable) return null;
    return getNormRating(template, 'male', 20, result.metrics.totalTimeS);
  })();

  // ── WAITING ───────────────────────────────────────────────────────────────
  if (phase === 'waiting') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 gap-6 px-8">
        <div className="text-8xl animate-pulse">⏱️</div>
        <div className="text-3xl font-black text-slate-400 text-center">Ready</div>
        {template && (
          <div className="text-slate-600 text-xl">{template.icon} {template.name}</div>
        )}
        <div className="text-slate-700 text-sm mt-8">Waiting for trial to start…</div>
      </div>
    );
  }

  // ── COUNTDOWN ─────────────────────────────────────────────────────────────
  if (phase === 'countdown') {
    const colors = { 3: 'text-yellow-400', 2: 'text-orange-400', 1: 'text-red-400', 0: 'text-brand-400' };
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 gap-4">
        <div className="text-slate-400 text-2xl font-bold uppercase tracking-widest">Get Ready</div>
        <div
          className={`font-black tabular-nums leading-none ${colors[countdown] || 'text-white'}`}
          style={{ fontSize: 'clamp(10rem, 40vw, 20rem)', textShadow: '0 0 60px currentColor' }}
        >
          {countdown === 0 ? 'GO!' : countdown}
        </div>
      </div>
    );
  }

  // ── RUNNING ───────────────────────────────────────────────────────────────
  if (phase === 'running') {
    const secs = (elapsed / 1000).toFixed(2);
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 gap-2">
        <div className="text-slate-600 text-xl font-bold uppercase tracking-widest mb-4">Running</div>
        <div
          className="font-mono font-black tabular-nums text-brand-400"
          style={{ fontSize: 'clamp(5rem, 22vw, 14rem)', textShadow: '0 0 40px #22c55e66' }}
        >
          {secs}
        </div>
        <div className="text-slate-600 text-2xl">seconds</div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  const time    = result?.metrics?.totalTimeS;
  const speedKmh= result?.metrics?.speedKmh;
  const speedMs = result?.metrics?.speedMs;

  return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-900 gap-6 px-6">
      {/* Big time */}
      <div className="text-center">
        <div className="text-slate-400 text-xl font-bold uppercase tracking-widest mb-2">
          {template?.name}
        </div>
        <div
          className="font-mono font-black tabular-nums text-white"
          style={{ fontSize: 'clamp(5rem, 20vw, 13rem)', textShadow: '0 0 60px #ffffff33' }}
        >
          {time != null ? `${time}s` : '—'}
        </div>
      </div>

      {/* Speed row */}
      {speedKmh && (
        <div className="flex gap-12 text-center">
          <div>
            <div className="text-brand-400 font-black" style={{ fontSize: 'clamp(2rem,8vw,4rem)' }}>
              {speedMs}
            </div>
            <div className="text-slate-500 text-lg">m/s</div>
          </div>
          <div>
            <div className="text-brand-400 font-black" style={{ fontSize: 'clamp(2rem,8vw,4rem)' }}>
              {speedKmh}
            </div>
            <div className="text-slate-500 text-lg">km/h</div>
          </div>
        </div>
      )}

      {/* Norm rating badge */}
      {normRating && (
        <div className={`px-8 py-3 rounded-2xl text-3xl font-black ${normRating.color}
          bg-slate-800 border-2 border-current`}>
          {normRating.label}
        </div>
      )}

      {/* Sync quality footer */}
      <div className="absolute bottom-4 right-4 text-slate-700 text-xs">
        Sync: {result?.syncQuality || '—'}
      </div>
    </div>
  );
}
