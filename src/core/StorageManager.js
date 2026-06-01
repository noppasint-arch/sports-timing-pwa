/**
 * StorageManager — localStorage persistence layer.
 * Stores athlete profiles, session history, and raw trial data.
 */

const KEYS = {
  athletes:  'stp_athletes',
  sessions:  'stp_sessions',
  settings:  'stp_settings',
};

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; }
  catch { return null; }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Athletes ─────────────────────────────────────────────────────────────────
export function getAthletes() {
  return load(KEYS.athletes) || [];
}

export function saveAthlete(athlete) {
  const list = getAthletes();
  const idx  = list.findIndex(a => a.id === athlete.id);
  if (idx >= 0) list[idx] = athlete;
  else list.push(athlete);
  save(KEYS.athletes, list);
  return athlete;
}

export function deleteAthlete(id) {
  save(KEYS.athletes, getAthletes().filter(a => a.id !== id));
}

// ── Sessions ─────────────────────────────────────────────────────────────────
export function getSessions() {
  return load(KEYS.sessions) || [];
}

export function saveSession(session) {
  const list = getSessions();
  const idx  = list.findIndex(s => s.id === session.id);
  if (idx >= 0) list[idx] = session;
  else list.push(session);
  save(KEYS.sessions, list);
}

export function appendResult(sessionId, result) {
  const list = getSessions();
  const s    = list.find(s => s.id === sessionId);
  if (!s) return;
  s.results = s.results || [];
  const existing = s.results.findIndex(r => r.id === result.id);
  if (existing >= 0) s.results[existing] = result;
  else s.results.push(result);
  save(KEYS.sessions, list);
}

export function getSessionResults(sessionId) {
  const s = getSessions().find(s => s.id === sessionId);
  return s?.results || [];
}

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSettings() {
  return load(KEYS.settings) || {
    deviceName:        'Device',
    audioEnabled:      false,
    audioThreshold:    0.85,
    markerPosition:    50,    // % from top
    cameraEnabled:     false,
    cameraSensitivity: 25,    // MAD threshold
    cameraZone:        0.45,  // fraction from top of frame
    serverUrl:         '',
  };
}

export function saveSettings(settings) {
  save(KEYS.settings, { ...getSettings(), ...settings });
}

// ── Export ────────────────────────────────────────────────────────────────────
export function exportCSV(results) {
  const headers = ['Trial', 'Athlete', 'Test', 'Date', 'TotalTime_ms', 'TotalTime_s',
                   'Speed_ms', 'Speed_kmh', 'SyncQuality', 'TriggerMethod', 'Voided'];
  const rows = results.map((r, i) => [
    i + 1,
    r.athleteName || '',
    r.testName    || '',
    new Date(r.savedAt || Date.now()).toISOString(),
    r.metrics?.totalTime ?? '',
    r.metrics?.totalTimeS ?? '',
    r.metrics?.speedMs    ?? '',
    r.metrics?.speedKmh   ?? '',
    r.syncQuality || '',
    r.triggerMethod || '',
    r.voided ? 'YES' : 'NO',
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  downloadBlob(csv, 'sports-timing-results.csv', 'text/csv');
}

export function exportJSON(results) {
  downloadBlob(JSON.stringify(results, null, 2), 'sports-timing-results.json', 'application/json');
}

function downloadBlob(content, filename, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
}
