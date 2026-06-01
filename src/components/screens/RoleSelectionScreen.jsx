import React, { useState } from 'react';
import { getTemplate } from '../../templates/TemplateEngine';

const ROLE_COLORS = {
  START:   'bg-blue-700   border-blue-500',
  FINISH:  'bg-green-700  border-green-500',
  CENTER:  'bg-purple-700 border-purple-500',
  LEFT:    'bg-yellow-700 border-yellow-500',
  RIGHT:   'bg-orange-700 border-orange-500',
  FORWARD: 'bg-red-700    border-red-500',
  SPLIT:   'bg-cyan-700   border-cyan-500',
  SPLIT2:  'bg-teal-700   border-teal-500',
  DISPLAY: 'bg-pink-700   border-pink-500',
};

export default function RoleSelectionScreen({
  session, myRole, isHost, settings,
  onRoleSelect, onStartSync, onHome,
}) {
  const [selected, setSelected]   = useState(myRole);
  const [showLayout, setShowLayout] = useState(false);

  const template = session ? getTemplate(session.testTemplate) : null;
  if (!template) return null;

  const takenRoles = new Set(session.nodes.map(n => n.role));

  function handleSelect(role, label) {
    setSelected(role);
    onRoleSelect(role, label);
  }

  const allRequiredFilled = template.nodes
    .filter(n => n.required)
    .every(n => takenRoles.has(n.role));

  return (
    <div className="screen gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onHome} className="text-slate-400 text-sm">✕ Leave</button>
        <div className="text-center">
          <div className="text-2xl font-black tracking-widest text-brand-400">
            {session.code}
          </div>
          <div className="text-slate-400 text-xs">Session Code</div>
        </div>
        <div className="text-slate-400 text-xs">
          {isHost ? '👑 Host' : '📱 Client'}
        </div>
      </div>

      <div className="card">
        <div className="text-lg font-bold mb-1">{template.icon} {template.name}</div>
        <div className="text-slate-400 text-sm">{template.description}</div>
        <button
          onClick={() => setShowLayout(v => !v)}
          className="text-brand-400 text-xs mt-2"
        >
          {showLayout ? 'Hide' : 'Show'} field layout
        </button>
        {showLayout && (
          <pre className="text-xs text-slate-300 mt-2 whitespace-pre-wrap font-mono bg-slate-900 rounded-lg p-3">
            {template.fieldLayout}
          </pre>
        )}
      </div>

      {/* Role buttons */}
      <h3 className="text-slate-400 text-xs uppercase tracking-widest">Select Your Role</h3>
      <div className="grid grid-cols-2 gap-3">
        {template.nodes.map(node => {
          const isTaken    = takenRoles.has(node.role) && selected !== node.role;
          const isSelected = selected === node.role;
          const takenBy    = session.nodes.find(n => n.role === node.role);

          return (
            <button
              key={node.id}
              onClick={() => !isTaken && handleSelect(node.role, node.label)}
              disabled={isTaken}
              className={`rounded-2xl border-2 p-4 text-left transition-all ${
                isSelected  ? `${ROLE_COLORS[node.role] || 'bg-slate-700 border-slate-500'} ring-2 ring-white` :
                isTaken     ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' :
                              'bg-slate-800 border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="font-black text-lg">{node.role}</div>
              <div className="text-xs text-slate-300 mt-1">{node.label}</div>
              {!node.required && <div className="text-xs text-slate-500 mt-0.5">Optional</div>}
              {isTaken && takenBy && (
                <div className="text-xs text-slate-400 mt-1">📱 {takenBy.name}</div>
              )}
              {isSelected && (
                <div className="text-xs text-brand-400 mt-1 font-bold">✓ YOU</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Connected devices */}
      <div className="card">
        <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">
          Connected Devices ({session.nodes.length})
        </div>
        <div className="space-y-1">
          {session.nodes.map(n => (
            <div key={n.deviceId} className="flex items-center justify-between text-sm">
              <span>{n.name}</span>
              <span className={`font-bold ${ROLE_COLORS[n.role] ? 'text-white' : 'text-slate-400'} px-2 py-0.5 rounded`}>
                {n.role || 'No role'}
              </span>
            </div>
          ))}
          {session.nodes.length === 0 && (
            <div className="text-slate-500 text-sm">Waiting for devices to join…</div>
          )}
        </div>
      </div>

      {/* Role description */}
      {selected && (
        <div className="card border-brand-500/50">
          <div className="text-sm font-bold mb-1 text-brand-400">Your Role: {selected}</div>
          <div className="text-sm text-slate-300">
            {template.nodes.find(n => n.role === selected)?.description || ''}
          </div>
          <div className="mt-3 text-xs text-slate-400">
            ⚠️ Place this device exactly at your designated line before proceeding.
          </div>
        </div>
      )}

      {/* Host: start sync when all roles filled */}
      {isHost && (
        <button
          onClick={onStartSync}
          disabled={!selected || !allRequiredFilled}
          className={`btn-primary w-full ${(!selected || !allRequiredFilled) ? 'opacity-50' : ''}`}
        >
          {allRequiredFilled ? '🔄 Start Time Sync' : 'Waiting for required roles…'}
        </button>
      )}
      {!isHost && selected && (
        <div className="text-center text-slate-400 text-sm py-2">
          ✓ Role selected — waiting for host to start sync
        </div>
      )}
      {!selected && (
        <div className="text-center text-yellow-400 text-sm py-2">
          ↑ Select your role above
        </div>
      )}
    </div>
  );
}
