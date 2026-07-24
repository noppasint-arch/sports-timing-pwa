import React, { useState } from 'react';

export default function SettingsScreen({ settings, onSave, onBack }) {
  const [form, setForm] = useState({ ...settings });

  function update(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function handleSave() {
    onSave(form);
    onBack();
  }

  return (
    <div className="screen gap-4 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 text-sm">← Back</button>
        <h2 className="text-xl font-black">Settings</h2>
      </div>

      {/* Device */}
      <div className="card space-y-4">
        <h3 className="font-bold text-slate-300">Device</h3>
        <div className="space-y-1">
          <label className="text-slate-400 text-sm">Device Name</label>
          <input
            className="w-full bg-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500"
            value={form.deviceName}
            onChange={e => update('deviceName', e.target.value)}
            placeholder="e.g. Left Gate"
          />
        </div>
        <div className="space-y-1">
          <label className="text-slate-400 text-sm">Server URL (leave blank for auto)</label>
          <input
            className="w-full bg-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
            value={form.serverUrl}
            onChange={e => update('serverUrl', e.target.value)}
            placeholder="http://192.168.1.x:3001"
          />
          <p className="text-slate-500 text-xs">
            For LAN mode: enter your host machine's local IP. Leave blank when using same device.
          </p>
        </div>
      </div>

      {/* Audio trigger */}
      <div className="card space-y-4">
        <h3 className="font-bold text-slate-300">Audio Trigger</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Enable Audio Detection</div>
            <div className="text-slate-500 text-xs">Detects claps/beeps via microphone</div>
          </div>
          <button
            onClick={() => update('audioEnabled', !form.audioEnabled)}
            className={`w-12 h-6 rounded-full transition-colors ${form.audioEnabled ? 'bg-brand-500' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5
              ${form.audioEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        {form.audioEnabled && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <label className="text-slate-400">Sensitivity Threshold</label>
              <span className="font-mono">{(form.audioThreshold * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range" min={0.5} max={0.99} step={0.01}
              value={form.audioThreshold}
              onChange={e => update('audioThreshold', +e.target.value)}
              className="w-full accent-brand-500"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>More sensitive</span>
              <span>Less sensitive</span>
            </div>
          </div>
        )}
      </div>

      {/* Camera gate */}
      <div className="card space-y-4">
        <h3 className="font-bold text-slate-300">📷 Camera Gate (Light Gate Mode)</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Enable Camera as Default</div>
            <div className="text-slate-500 text-xs">Camera gate opens automatically on each trial</div>
          </div>
          <button
            onClick={() => update('cameraEnabled', !form.cameraEnabled)}
            className={`w-12 h-6 rounded-full transition-colors ${form.cameraEnabled ? 'bg-brand-500' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5
              ${form.cameraEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <label className="text-slate-400">Default Sensitivity (MAD threshold)</label>
            <span className="font-mono">{form.cameraSensitivity}</span>
          </div>
          <input type="range" min={5} max={80} step={1}
            value={form.cameraSensitivity}
            onChange={e => update('cameraSensitivity', +e.target.value)}
            className="w-full accent-brand-500" />
          <div className="flex justify-between text-xs text-slate-500">
            <span>More sensitive (shadows trigger)</span>
            <span>Less sensitive</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <label className="text-slate-400">Default Detection Zone (from top)</label>
            <span className="font-mono">{Math.round((form.cameraZone ?? 0.45) * 100)}%</span>
          </div>
          <input type="range" min={10} max={85} step={1}
            value={Math.round((form.cameraZone ?? 0.45) * 100)}
            onChange={e => update('cameraZone', e.target.value / 100)}
            className="w-full accent-brand-500" />
        </div>

        <div className="bg-slate-900 rounded-xl p-3 text-xs text-slate-400 space-y-1">
          <p>💡 <strong>How to calibrate in the field:</strong></p>
          <p>1. Mount phone sideways at the gate line, camera pointing across the track</p>
          <p>2. Adjust zone so the green band overlaps where athletes pass</p>
          <p>3. Walk through — MAD bar should spike above the threshold line</p>
          <p>4. If false triggers: raise sensitivity number. If misses: lower it.</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <div>
            <div className="text-sm font-medium">Dual-zone False-trigger Filter</div>
            <div className="text-slate-500 text-xs">Splits the beam into top+bottom bands — both must trigger together, like a double photocell. Cuts false triggers from a leading arm or stray motion, but needs the athlete's full body height in frame.</div>
          </div>
          <button
            onClick={() => update('cameraDualZone', !form.cameraDualZone)}
            className={`w-12 h-6 rounded-full transition-colors shrink-0 ml-3 ${form.cameraDualZone ? 'bg-brand-500' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5
              ${form.cameraDualZone ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <div>
            <div className="text-sm font-medium">Research Diagnostic Mode</div>
            <div className="text-slate-500 text-xs">Records the raw sensor signal trace with each trigger, for comparing against a reference timing system</div>
          </div>
          <button
            onClick={() => update('cameraDiagnostics', !form.cameraDiagnostics)}
            className={`w-12 h-6 rounded-full transition-colors shrink-0 ml-3 ${form.cameraDiagnostics ? 'bg-brand-500' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5
              ${form.cameraDiagnostics ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Line marker */}
      <div className="card space-y-4">
        <h3 className="font-bold text-slate-300">Line Marker</h3>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <label className="text-slate-400">Marker Position (from top)</label>
            <span className="font-mono">{form.markerPosition}%</span>
          </div>
          <input
            type="range" min={20} max={80} step={5}
            value={form.markerPosition}
            onChange={e => update('markerPosition', +e.target.value)}
            className="w-full accent-brand-500"
          />
        </div>
        <div className="text-slate-500 text-xs">
          Adjust where the reference line appears on screen to match your physical gate placement.
        </div>
      </div>

      {/* Trial flow */}
      <div className="card space-y-4">
        <h3 className="font-bold text-slate-300">Trial Flow</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Auto-continue Between Trials</div>
            <div className="text-slate-500 text-xs">After a result is shown, return to Ready automatically so the next runner can go without extra taps. Marker only needs confirming once per session either way.</div>
          </div>
          <button
            onClick={() => update('autoContinue', !form.autoContinue)}
            className={`w-12 h-6 rounded-full transition-colors shrink-0 ml-3 ${form.autoContinue ? 'bg-brand-500' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5
              ${form.autoContinue ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      <button onClick={handleSave} className="btn-primary w-full">
        Save Settings
      </button>

      {/* About */}
      <div className="text-center text-slate-600 text-xs py-2">
        Sports Timing PWA v1.0 • Open source
      </div>
    </div>
  );
}
