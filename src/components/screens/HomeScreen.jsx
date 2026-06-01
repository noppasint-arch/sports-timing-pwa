import React, { useState, useRef } from 'react';
import { getAllTemplates } from '../../templates/TemplateEngine';
import { getSettings } from '../../core/StorageManager';

export default function HomeScreen({ onCreateSession, onJoinSession, onHistory, onSettings, connected }) {
  const [mode,       setMode]       = useState(null); // null | 'create' | 'join'
  const [digits,     setDigits]     = useState(['', '', '', '']);
  const [hostName,   setHostName]   = useState(getSettings().deviceName || 'Coach');
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
        <div className="text-5xl mb-1">⏱️</div>
        <h1 className="text-2xl font-black tracking-tight">Sports Timing</h1>
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
          <h2 className="text-xl font-bold">New Session</h2>

          <div className="space-y-2">
            <label className="text-slate-400 text-sm">Your name / Coach name</label>
            <input
              className="w-full bg-slate-700 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-brand-500"
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              placeholder="Coach name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-slate-400 text-sm">Select Test</label>
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={`w-full text-left rounded-xl px-4 py-3 border-2 transition-all ${
                  templateId === t.id
                    ? 'border-brand-500 bg-brand-900/30'
                    : 'border-slate-700 bg-slate-800'
                }`}
              >
                <span className="mr-2">{t.icon}</span>
                <span className="font-bold">{t.name}</span>
                <div className="text-slate-400 text-xs mt-1 ml-7">{t.nodes.filter(n=>n.required).length} required devices</div>
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading || !connected}
            className="btn-primary w-full mt-4"
          >
            {loading ? 'Creating…' : connected ? 'Create Session' : 'Connecting…'}
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
