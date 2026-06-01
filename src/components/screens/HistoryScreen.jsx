import React, { useState } from 'react';
import { getSessions, exportCSV, exportJSON } from '../../core/StorageManager';
import { getTemplate } from '../../templates/TemplateEngine';

export default function HistoryScreen({ onBack }) {
  const sessions  = getSessions();
  const allResults = sessions.flatMap(s => (s.results || []).map(r => ({ ...r, sessionId: s.id })));

  const [filter, setFilter] = useState('all');

  const templates = [...new Set(allResults.map(r => r.testId))];
  const filtered  = filter === 'all' ? allResults : allResults.filter(r => r.testId === filter);

  function bestTime(testId) {
    const times = allResults
      .filter(r => r.testId === testId && !r.voided && r.metrics?.totalTimeS)
      .map(r => r.metrics.totalTimeS);
    return times.length ? Math.min(...times) : null;
  }

  return (
    <div className="screen gap-4 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 text-sm">← Back</button>
        <h2 className="text-xl font-black flex-1">Session History</h2>
        <div className="flex gap-2">
          <button onClick={() => exportCSV(allResults)} className="text-xs text-brand-400">CSV</button>
          <button onClick={() => exportJSON(allResults)} className="text-xs text-brand-400">JSON</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <div className="text-3xl font-black text-brand-400">{allResults.length}</div>
          <div className="text-slate-400 text-xs">Total Trials</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-black text-brand-400">
            {allResults.filter(r => !r.voided).length}
          </div>
          <div className="text-slate-400 text-xs">Valid Results</div>
        </div>
      </div>

      {/* Filter by test */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-sm font-bold ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >All</button>
        {templates.map(tid => {
          const t = getTemplate(tid);
          return (
            <button
              key={tid}
              onClick={() => setFilter(tid)}
              className={`px-3 py-1 rounded-full text-sm font-bold ${filter === tid ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              {t?.icon} {t?.name || tid}
            </button>
          );
        })}
      </div>

      {/* Results list */}
      {filtered.length === 0 && (
        <div className="text-center text-slate-500 py-8">No results yet</div>
      )}
      <div className="space-y-2">
        {[...filtered].reverse().map((result, i) => {
          const t = getTemplate(result.testId);
          const time = result.metrics?.totalTimeS;
          return (
            <div key={result.id || i} className={`card ${result.voided ? 'opacity-40' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-sm">{t?.icon} {result.testName}</div>
                  <div className="text-slate-500 text-xs">
                    {result.savedAt ? new Date(result.savedAt).toLocaleString() : ''}
                  </div>
                  {result.voided && <div className="text-red-400 text-xs font-bold">VOIDED</div>}
                </div>
                {time && (
                  <div className="text-right">
                    <div className="text-brand-400 font-mono font-black text-xl">{time}s</div>
                    {result.metrics?.speedKmh && (
                      <div className="text-slate-400 text-xs">{result.metrics.speedKmh} km/h</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span>Sync: {result.syncQuality}</span>
                <span>Method: {result.triggerMethod}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Best times per test */}
      {templates.length > 0 && (
        <div className="card">
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Personal Bests</div>
          {templates.map(tid => {
            const t    = getTemplate(tid);
            const best = bestTime(tid);
            return (
              <div key={tid} className="flex justify-between text-sm py-1">
                <span>{t?.icon} {t?.name}</span>
                {best ? <span className="font-mono font-bold text-brand-400">{best}s</span>
                      : <span className="text-slate-500">–</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
