import React, { useState, useEffect, useRef } from 'react';
import { getTemplate, getNormRating } from '../../templates/TemplateEngine';
import SyncBadge from '../ui/SyncBadge';
import { exportCSV, exportJSON } from '../../core/StorageManager';
import { pushResultToAPL, getLastStudentId } from '../../core/apiSync';

const AUTO_ADVANCE_SECONDS = 8;

export default function ResultScreen({ session, result, trialEvents, onNextTrial, onVoid, onHome, isHost, settings }) {
  const [showRaw,    setShowRaw]    = useState(false);
  const [athleteAge, setAthleteAge] = useState(20);
  const [gender,     setGender]     = useState('male');
  const [voided,     setVoided]     = useState(false);
  const [studentId,  setStudentId]  = useState(getLastStudentId);
  const [sendStatus, setSendStatus] = useState('idle'); // idle | sending | sent | error
  const [sendError,  setSendError]  = useState('');
  const [autoSecondsLeft, setAutoSecondsLeft] = useState(
    settings?.autoContinue === false ? null : AUTO_ADVANCE_SECONDS
  );

  const onNextTrialRef = useRef(onNextTrial);
  onNextTrialRef.current = onNextTrial;

  // Auto-continue: return to Ready on its own so the next runner doesn't need a manual tap.
  // Any hands-on interaction with this screen (below) cancels it so nothing gets whisked away mid-review.
  useEffect(() => {
    if (autoSecondsLeft === null) return;
    if (autoSecondsLeft <= 0) { onNextTrialRef.current(); return; }
    const t = setTimeout(() => setAutoSecondsLeft(s => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [autoSecondsLeft]);

  function cancelAutoAdvance() {
    setAutoSecondsLeft(null);
  }

  const template = session ? getTemplate(session.testTemplate) : null;
  if (!result || !template) {
    return (
      <div className="screen items-center justify-center gap-4">
        <div className="text-slate-400">Waiting for results…</div>
        <button onClick={onNextTrial} className="btn-secondary">Next Trial</button>
      </div>
    );
  }

  const metrics = result.metrics || {};

  // Norm rating for time-based tests
  const normRating = (() => {
    const time = metrics.totalTimeS;
    if (time && template.normTable) {
      return getNormRating(template, gender, athleteAge, time);
    }
    return null;
  })();

  const primaryTime = metrics.totalTimeS ?? metrics.repTime;
  const speed_ms    = metrics.speedMs;
  const speed_kmh   = metrics.speedKmh;

  function handleVoid() {
    setVoided(true);
    onVoid?.();
    cancelAutoAdvance();
  }

  async function handleSendToAPL() {
    if (!studentId.trim()) {
      setSendStatus('error');
      setSendError('Enter a student ID first');
      return;
    }
    setSendStatus('sending');
    setSendError('');
    try {
      await pushResultToAPL({
        studentId,
        testType: session.testTemplate,
        result,
        deviceName: settings?.deviceName,
      });
      setSendStatus('sent');
    } catch (err) {
      setSendStatus('error');
      setSendError(err.message || 'Failed to send');
    }
  }

  return (
    <div className="screen gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onHome} className="text-slate-400 text-sm">✕ End</button>
        <div className="font-bold">{template.name}</div>
        <SyncBadge quality={result.syncQuality} />
      </div>

      {/* Voided banner */}
      {voided && (
        <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 text-red-300 font-bold text-center">
          ⚠️ Result Voided
        </div>
      )}

      {/* Primary result */}
      <div className={`card text-center py-6 ${voided ? 'opacity-40' : ''}`}>
        {primaryTime !== null && primaryTime !== undefined ? (
          <>
            <div className="text-6xl font-black font-mono tabular-nums text-brand-400">
              {typeof primaryTime === 'number'
                ? `${primaryTime.toFixed(2)}s`
                : primaryTime}
            </div>
            <div className="text-slate-400 text-sm mt-1">
              {metrics.totalTime ? `${metrics.totalTime} ms` : ''}
            </div>

            {speed_ms && (
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div>
                  <div className="font-bold text-lg">{speed_ms}</div>
                  <div className="text-slate-400">m/s</div>
                </div>
                <div>
                  <div className="font-bold text-lg">{speed_kmh}</div>
                  <div className="text-slate-400">km/h</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-slate-400 text-lg">No primary metric</div>
        )}
      </div>

      {/* Send to Athlete Performance Lab */}
      {!voided && (
        <div className="card">
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Send to Athlete Performance Lab</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={studentId}
              onChange={e => { setStudentId(e.target.value); setSendStatus('idle'); }}
              onFocus={cancelAutoAdvance}
              placeholder="Student ID"
              className="flex-1 bg-slate-700 rounded px-3 py-2 text-white text-sm"
            />
            <button
              onClick={handleSendToAPL}
              disabled={sendStatus === 'sending'}
              className={`btn-secondary text-sm px-4 whitespace-nowrap ${sendStatus === 'sent' ? 'bg-green-700' : ''}`}
            >
              {sendStatus === 'sending' ? 'Sending…' : sendStatus === 'sent' ? '✓ Sent' : 'Send'}
            </button>
          </div>
          {sendStatus === 'error' && (
            <div className="text-red-400 text-xs mt-2">{sendError}</div>
          )}
        </div>
      )}

      {/* Norm rating */}
      {normRating && !voided && (
        <div className={`card text-center ${normRating.color}`}>
          <div className="text-3xl font-black">{normRating.label}</div>
          <div className="text-sm text-slate-400 mt-1">vs. age/gender norms</div>
          <div className="flex gap-3 mt-3 justify-center text-xs">
            <label className="flex items-center gap-1 text-slate-300">
              Age:
              <input type="number" value={athleteAge} onChange={e => setAthleteAge(+e.target.value)}
                className="bg-slate-700 rounded px-2 py-1 w-16 text-white"
                min={10} max={80} />
            </label>
            <label className="flex items-center gap-1 text-slate-300">
              Gender:
              <select value={gender} onChange={e => setGender(e.target.value)}
                className="bg-slate-700 rounded px-2 py-1 text-white">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Split times */}
      {(metrics.split1Time || metrics.split2Time) && (
        <div className="card">
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Split Times</div>
          {metrics.split1Time && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">10m split</span>
              <span className="font-mono font-bold">{metrics.split1Time}s</span>
            </div>
          )}
          {metrics.split2Time && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">20m split</span>
              <span className="font-mono font-bold">{metrics.split2Time}s</span>
            </div>
          )}
        </div>
      )}

      {/* Trigger info */}
      <div className="card">
        <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Trial Info</div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Trigger method</span>
            <span className="capitalize">{result.triggerMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Sync quality</span>
            <SyncBadge quality={result.syncQuality} small />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Time</span>
            <span>{new Date(result.savedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Raw events toggle */}
      <button onClick={() => { setShowRaw(v => !v); cancelAutoAdvance(); }} className="text-slate-400 text-xs">
        {showRaw ? '▾ Hide' : '▸ Show'} raw timestamps
      </button>
      {showRaw && (
        <div className="card font-mono text-xs space-y-1">
          {(trialEvents || result.events || []).map((ev, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="text-brand-400">{ev.role}</span>
              <span>{ev.correctedTime}</span>
              <span className="text-slate-500">raw:{ev.rawTime}</span>
              <span className="text-slate-500">{ev.method}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => exportCSV([result])} className="btn-secondary text-sm py-3">
          📊 Export CSV
        </button>
        <button onClick={() => exportJSON([result])} className="btn-secondary text-sm py-3">
          📄 Export JSON
        </button>
      </div>

      {!voided && isHost && (
        <button onClick={handleVoid} className="text-red-400 text-sm text-center">
          ⚠️ Void this result
        </button>
      )}

      {autoSecondsLeft !== null && (
        <button onClick={cancelAutoAdvance} className="text-slate-400 text-xs text-center">
          ⏱ Auto-continuing in {autoSecondsLeft}s — tap to pause
        </button>
      )}

      <div className="flex gap-3">
        <button onClick={onHome}      className="btn-secondary flex-1">🏠 End Session</button>
        <button onClick={onNextTrial} className="btn-primary flex-1">Next Trial →</button>
      </div>
    </div>
  );
}
