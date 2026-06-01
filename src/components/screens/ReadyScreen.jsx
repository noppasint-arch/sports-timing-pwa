import React, { useState } from 'react';
import { getTemplate } from '../../templates/TemplateEngine';
import SyncBadge from '../ui/SyncBadge';
import LineMarker from '../ui/LineMarker';

export default function ReadyScreen({
  session, myRole, isHost, syncResult, latency,
  onStartTrial, onHome,
}) {
  const [showMarker,   setShowMarker]   = useState(true);
  const [markerConfirm, setMarkerConfirm] = useState(false);
  const [trialCount,   setTrialCount]   = useState(0);

  const template = session ? getTemplate(session.testTemplate) : null;
  if (!template) return null;

  function handleStart() {
    const trialId = `trial_${Date.now()}`;
    setTrialCount(c => c + 1);
    onStartTrial(trialId, 3);
  }

  const nodeInfo = template.nodes.find(n => n.role === myRole);
  const isStartNode = myRole === 'START' || myRole === 'CENTER';

  return (
    <div className="screen gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button onClick={onHome} className="text-slate-400 text-sm">✕ End</button>
        <div className="text-center">
          <div className="font-bold">{template.name}</div>
          <div className="text-slate-400 text-xs">Trial {trialCount + 1}</div>
        </div>
        <SyncBadge quality={syncResult?.quality} />
      </div>

      {/* Device role badge */}
      <div className="card text-center py-6">
        <div className="text-4xl font-black text-brand-400">{myRole}</div>
        <div className="text-slate-300 text-sm mt-1">{nodeInfo?.label}</div>
        <div className="text-slate-500 text-xs mt-2">{nodeInfo?.description}</div>
      </div>

      {/* Line marker calibration */}
      {showMarker && (
        <div className="card border-yellow-700/50 relative overflow-hidden" style={{ minHeight: 120 }}>
          <LineMarker />
          <div className="text-sm text-yellow-300 font-bold mt-2">📍 Line Marker Active</div>
          <div className="text-xs text-slate-400 mt-1">
            Align this green line with your physical gate/tape on the ground.
            The athlete crossing this line = sensor trigger point.
          </div>
          {!markerConfirm && (
            <button
              onClick={() => setMarkerConfirm(true)}
              className="mt-3 bg-yellow-700 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl text-sm font-bold w-full"
            >
              ✓ Marker Aligned — Ready
            </button>
          )}
          {markerConfirm && (
            <div className="mt-3 text-green-400 text-sm font-bold">✓ Marker confirmed</div>
          )}
        </div>
      )}

      {/* Trigger sequence guide */}
      <div className="card">
        <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Trigger Sequence</div>
        <div className="space-y-1">
          {template.triggerSequence.map((role, i) => (
            <div key={i} className={`flex items-center gap-2 text-sm ${role === myRole ? 'text-brand-400 font-bold' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${role === myRole ? 'bg-brand-600' : 'bg-slate-700'}`}>{i + 1}</span>
              <span>{role} triggers</span>
              {role === myRole && <span className="text-xs bg-brand-900 px-1 rounded">← YOU</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Connected nodes */}
      <div className="card">
        <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Devices Ready</div>
        <div className="grid grid-cols-2 gap-1">
          {session.nodes.map(n => (
            <div key={n.deviceId} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${n.syncQuality === 'good' ? 'bg-green-400' : n.syncQuality === 'fair' ? 'bg-yellow-400' : 'bg-red-400'}`} />
              <span className="truncate">{n.name}</span>
              <span className="text-slate-500">{n.role}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      {/* Start button — host only */}
      {isHost && isStartNode ? (
        <button
          onClick={handleStart}
          disabled={!markerConfirm && showMarker}
          className={`btn-trigger text-white pulse-green ${
            (!markerConfirm && showMarker) ? 'bg-slate-700 opacity-60' : 'bg-brand-600'
          }`}
        >
          {(!markerConfirm && showMarker) ? 'Confirm Marker First' : '▶ START TRIAL'}
        </button>
      ) : isHost ? (
        <button
          onClick={handleStart}
          disabled={!markerConfirm && showMarker}
          className="btn-primary w-full text-lg"
        >
          ▶ Start Trial (Host)
        </button>
      ) : (
        <div className="card text-center text-slate-400 py-4">
          Waiting for host to start trial…
        </div>
      )}

      {latency !== null && (
        <div className="text-center text-slate-500 text-xs">
          Network latency: {latency}ms
        </div>
      )}
    </div>
  );
}
