import React, { useState, useEffect } from 'react';

export default function SyncScreen({ onSyncDone, onRunSync, session, myRole }) {
  const [phase,   setPhase]   = useState('idle');   // idle | running | done
  const [result,  setResult]  = useState(null);
  const [progress,setProgress]= useState(0);

  useEffect(() => {
    startSync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startSync() {
    setPhase('running');
    setProgress(0);

    // Simulate progress while sync runs
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 10, 90));
    }, 120);

    const res = await onRunSync();
    clearInterval(interval);
    setProgress(100);
    setResult(res);
    setPhase('done');
  }

  const qualityConfig = {
    good:    { label: 'GOOD',    color: 'text-green-400',  bg: 'bg-green-900/40',  icon: '✅', desc: '±<20ms — Excellent for timing gates' },
    fair:    { label: 'FAIR',    color: 'text-yellow-400', bg: 'bg-yellow-900/40', icon: '⚠️', desc: '±20–50ms — Acceptable, minor inaccuracy' },
    poor:    { label: 'POOR',    color: 'text-red-400',    bg: 'bg-red-900/40',    icon: '❌', desc: '>50ms — Re-sync recommended before testing' },
    unknown: { label: 'UNKNOWN', color: 'text-slate-400',  bg: 'bg-slate-800',     icon: '?',  desc: '' },
  };
  const q = qualityConfig[result?.quality || 'unknown'];

  return (
    <div className="screen items-center justify-center gap-6 text-center">
      <div className="text-5xl">🔄</div>
      <h2 className="text-2xl font-black">Clock Synchronization</h2>

      {phase === 'running' && (
        <>
          <p className="text-slate-400">Synchronizing all devices…</p>
          <div className="w-full bg-slate-800 rounded-full h-3">
            <div
              className="bg-brand-500 h-3 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-slate-500 text-sm">Running 10 ping-pong rounds</p>
        </>
      )}

      {phase === 'done' && result && (
        <>
          <div className={`${q.bg} rounded-2xl p-6 w-full`}>
            <div className={`text-5xl font-black mb-2 ${q.color}`}>{q.icon}</div>
            <div className={`text-3xl font-black ${q.color}`}>{q.label}</div>
            <div className="text-slate-300 text-sm mt-2">{q.desc}</div>
          </div>

          <div className="w-full card space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Clock Offset</span>
              <span className="font-mono font-bold">
                {result.offset > 0 ? '+' : ''}{result.offset.toFixed(1)} ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Round-trip Time</span>
              <span className="font-mono font-bold">{result.rtt.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Your Role</span>
              <span className="font-bold text-brand-400">{myRole}</span>
            </div>
          </div>

          <div className="w-full space-y-3">
            {result.quality === 'poor' && (
              <button onClick={startSync} className="btn-danger w-full">
                🔄 Re-sync (Recommended)
              </button>
            )}
            <button onClick={onSyncDone} className="btn-primary w-full">
              {result.quality === 'poor' ? 'Continue Anyway →' : 'Proceed to Test →'}
            </button>
          </div>
        </>
      )}

      {/* Connected nodes sync status */}
      {session?.nodes?.length > 0 && (
        <div className="w-full card">
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Device Sync Status</div>
          {session.nodes.map(n => {
            const nq = qualityConfig[n.syncQuality || 'unknown'];
            return (
              <div key={n.deviceId} className="flex justify-between text-sm py-1">
                <span>{n.name} <span className="text-slate-500">({n.role})</span></span>
                <span className={nq.color}>{nq.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
