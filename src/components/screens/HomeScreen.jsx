import React, { useState, useRef } from 'react';
import { getAllTemplates } from '../../templates/TemplateEngine';
import { getSettings } from '../../core/StorageManager';

export default function HomeScreen({ onCreateSession, onJoinSession, onHistory, onSettings, connected }) {
  const [mode,       setMode]       = useState(null); // null | 'create' | 'join'
  const [digits,     setDigits]     = useState(['', '', '', '']);
  const [hostName,   setHostName]   = useState('');
  const [deviceName, setDeviceName] = useState(getSettings().deviceName || 'Device');
  const [templateId, setTemplateId] = useState('sprint-30m');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const digitRefs = [useRef(), useRef(), useRef(), useRef()];
  const joinCode = digits.join('');

  const templates = getAllTemplates();

  async function handleCreate() {
    setError(''); setLoading(true);
    const res = await onCreateSession({ templateId, hostName });
    if (!res.ok) setError(res.error || 'Failed to create session');
    setLoading(false);
  }

  function handleDigitInput(i, val) {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 3) digitRefs[i + 1].current?.focus();
  }

  function handleDigitKey(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      digitRefs[i - 1].current?.focus();
    }
  }

  function handleDigitPaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (text.length === 4) {
      setDigits(text.split(''));
      digitRefs[3].current?.focus();
      e.preventDefault();
    }
  }

  async function handleJoin() {
    if (joinCode.length !== 4) { setError('Enter a 4-digit session code'); return; }
    setError(''); setLoading(true);
    const res = await onJoinSession({ code: joinCode, deviceName });
    if (!res.ok) setError(res.error || 'Session not found');
    setLoading(false);
  }

  return (
    <div className="screen overflow-y-auto gap-4">
      {/* Logo */}
      <div className="text-center pt-4 pb-2">
        <div className="text-5xl mb-1">⚡</div>
        <h1 className="text-2xl font-black tracking-tight">PulseGate</h1>
        <p className="text-slate-400 text-sm">Multi-device performance testing</p>
      </div>

      {!mode && (
        <>
          <button onClick={() => setMode('create')}
            className="btn-primary w-full text-xl py-5">
            🏁  Host New Session
          </button>
          <button onClick={() => setMode('join')}
            className="btn-secondary w-full text-xl py-5">
            📱  Join Session
          </button>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <button onClick={onHistory}  className="btn-secondary text-base py-3">📊 History</button>
            <button onClick={onSettings} className="btn-secondary text-base py-3">⚙️ Settings</button>
          </div>

          {/* Test preview cards */}
          <div className="mt-2">
            <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-2">Available Tests</h2>
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="card flex items-center gap-3">
                  <span className="text-3xl">{t.icon}</span>
                  <div>
                    <div className="font-bold">{t.name}</div>
                    <div className="text-slate-400 text-xs">{t.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Create session ── */}
      {mode === 'create' && (
        <div className="space-y-4 flex-1">
          <button onClick={() => setMode(null)} className="text-slate-400 text-sm">← Back</button>
          <div>
            <h2 className="text-xl font-black">New Session</h2>
            <p className="text-slate-500 text-xs mt-0.5">Set up a coach name and pick a test to host</p>
          </div>

          <div className="card space-y-2">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Coach</div>
            <input
              className="w-full bg-slate-700 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-brand-500"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              placeholder="Your name / coach name"
            />
          </div>

          <div className="card space-y-2">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Select Test</div>
            <div className="space-y-2">
              {templates.map(t => {
                const selected = templateId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={`relative w-full text-left rounded-xl pl-4 pr-3 py-3 border-2 transition-all overflow-hidden flex items-center gap-3 ${
                      selected
                        ? 'border-brand-500 bg-brand-900/30'
                        : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    {selected && <span className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500" />}
                    <span className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                      selected ? 'bg-brand-500/20' : 'bg-slate-800'
                    }`}>{t.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{t.name}</div>
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-700 text-slate-300">
                        {t.nodes.filter(n => n.required).length} required devices
                      </span>
                    </div>
                    {selected && (
                      <span className="shrink-0 w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading || !connected}
            className="btn-primary w-full mt-4"
          >
            {loading ? 'Creating…' : connected ? '🏁 Create Session' : 'Connecting…'}
          </button>
        </div>
      )}

      {/* ── Join session ── */}
      {mode === 'join' && (
        <div className="space-y-4 flex-1">
          <button onClick={() => setMode(null)} className="text-slate-400 text-sm">← Back</button>
          <h2 className="text-xl font-bold">Join Session</h2>

          <div className="space-y-2">
            <label className="text-slate-400 text-sm">Your device name</label>
            <input
              className="w-full bg-slate-700 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-brand-500"
              value={deviceName}
              onChange={e => setDeviceName(e.target.value)}
              placeholder="e.g. Left Gate"
            />
          </div>

          <div className="space-y-2">
            <label className="text-slate-400 text-sm">4-Digit Session Code</label>
            <div className="flex gap-3 justify-center">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={digitRefs[i]}
                  className="w-16 h-16 bg-slate-700 rounded-xl text-3xl font-mono text-center
                             outline-none focus:ring-2 focus:ring-brand-500 caret-transparent"
                  value={d}
                  onChange={e => handleDigitInput(i, e.target.value)}
                  onKeyDown={e => handleDigitKey(i, e)}
                  onPaste={handleDigitPaste}
                  onFocus={e => e.target.select()}
                  inputMode="numeric"
                  maxLength={1}
                  placeholder="—"
                />
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={loading || !connected || joinCode.length !== 4}
            className="btn-primary w-full mt-4"
          >
            {loading ? 'Joining…' : 'Join Session'}
          </button>
        </div>
      )}
    </div>
  );
}
