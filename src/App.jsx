import React, { useState, useEffect, useCallback, useRef } from 'react';
import { connection } from './core/ConnectionManager';
import { TimeSync }   from './core/TimeSync';
import { getSettings, saveSettings } from './core/StorageManager';

import HomeScreen        from './components/screens/HomeScreen';
import SessionSetupScreen from './components/screens/SessionSetupScreen';
import RoleSelectionScreen from './components/screens/RoleSelectionScreen';
import SyncScreen        from './components/screens/SyncScreen';
import ReadyScreen       from './components/screens/ReadyScreen';
import RunningScreen     from './components/screens/RunningScreen';
import ResultScreen      from './components/screens/ResultScreen';
import HistoryScreen     from './components/screens/HistoryScreen';
import SettingsScreen    from './components/screens/SettingsScreen';
import DisplayScreen     from './components/screens/DisplayScreen';

/**
 * Global app state machine:
 *  home → setup → role → sync → ready → running → result
 *                                          ↑___________↓  (next trial)
 */
export default function App() {
  const [screen,      setScreen]      = useState('home');    // current screen
  const [session,     setSession]     = useState(null);      // server session data
  const [myRole,      setMyRole]      = useState(null);      // this device's role
  const [isHost,      setIsHost]      = useState(false);
  const [deviceId]                    = useState(() => {
    let id = localStorage.getItem('stp_deviceId');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('stp_deviceId', id); }
    return id;
  });
  const [settings,    setSettingsState] = useState(getSettings);
  const [syncResult,  setSyncResult]  = useState(null);      // { offset, rtt, quality }
  const [trialEvents, setTrialEvents] = useState([]);        // events for current trial
  const [lastResult,  setLastResult]  = useState(null);      // computed result to display
  const [latency,     setLatency]     = useState(null);
  const [connected,   setConnected]   = useState(false);

  const timeSyncRef = useRef(null);

  // ── Connection lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    const serverUrl = settings.serverUrl || window.location.origin;
    connection.connect(serverUrl);

    const off = [
      connection.on('connect',    ()  => setConnected(true)),
      connection.on('disconnect', ()  => setConnected(false)),
      connection.on('latency',    (ms) => setLatency(ms)),
      connection.on('session:updated', (s) => setSession(s)),
      connection.on('trigger:event',   (ev) => {
        setTrialEvents(prev => {
          if (prev.find(e => e.role === ev.role && e.correctedTime === ev.correctedTime)) return prev;
          return [...prev, ev];
        });
      }),
      connection.on('result:new', (result) => {
        setLastResult(result);
      }),
      connection.on('test:start_trial', () => setTrialEvents([])),
      connection.on('test:abort_trial', () => {
        setTrialEvents([]);
        setScreen('ready');
      }),
      connection.on('test:next_trial', () => {
        setTrialEvents([]);
        setLastResult(null);
        setScreen('ready');
      }),
      connection.on('test:ready', () => {
        // DISPLAY role stays on its own screen, not the ready/running flow
        setScreen(prev => prev === 'display' ? 'display' : 'ready');
      }),
      connection.on('test:start_sync', () => setScreen('sync')),
    ];

    return () => { off.forEach(fn => fn()); connection.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync clock offset getter ──────────────────────────────────────────────
  const getServerTime = useCallback(() => {
    return timeSyncRef.current ? timeSyncRef.current.now() : Date.now();
  }, []);

  // ── Handlers passed down to screens ───────────────────────────────────────
  const handleCreateSession = useCallback(async ({ templateId, hostName }) => {
    const res = await connection.emitAsync('session:create', {
      hostName,
      testTemplate: templateId,
    });
    if (res.ok) {
      setSession(res.sessionData);
      setIsHost(true);
      setScreen('role');
    }
    return res;
  }, []);

  const handleJoinSession = useCallback(async ({ code, deviceName }) => {
    const res = await connection.emitAsync('session:join', {
      code: code.trim(),
      deviceName,
      deviceId,
    });
    if (res.ok) {
      setSession(res.sessionData);
      setIsHost(res.isHost);
      setScreen('role');
    }
    return res;
  }, [deviceId]);

  const handleAssignRole = useCallback((role, label) => {
    setMyRole(role);
    connection.emit('role:assign', {
      role,
      label,
      name: settings.deviceName,
    });
  }, [settings.deviceName]);

  const handleStartSync = useCallback(async () => {
    if (isHost) connection.emit('test:start_sync');
    // All devices run sync independently
    const ts = new TimeSync(connection.socket, 10);
    timeSyncRef.current = ts;
    const result = await ts.run();
    setSyncResult(result);
    connection.emit('sync:report', { offset: result.offset, quality: result.quality });
    return result;
  }, [isHost]);

  const handleSyncDone = useCallback(() => {
    if (isHost) connection.emit('test:ready');
    // DISPLAY role skips the ready/running screens entirely
    else if (myRole === 'DISPLAY') setScreen('display');
    else setScreen('ready');
  }, [isHost, myRole]);

  const handleStartTrial = useCallback((trialId, countdown = 3) => {
    setTrialEvents([]);
    connection.emit('test:start_trial', { trialId, countdown });
    setScreen('running');
  }, []);

  const handleTrigger = useCallback((role, correctedTime, rawTime, method) => {
    connection.emit('trigger:event', {
      trialId: Date.now(),
      role,
      correctedTime,
      rawTime,
      method,
    });
  }, []);

  const handleSaveResult = useCallback((result) => {
    connection.emit('result:save', result);
    setLastResult(result);
    setScreen('result');
  }, []);

  const handleNextTrial = useCallback(() => {
    if (isHost) connection.emit('test:next_trial');
    else { setTrialEvents([]); setLastResult(null); setScreen('ready'); }
  }, [isHost]);

  const handleAbortTrial = useCallback(() => {
    connection.emit('test:abort_trial');
    setTrialEvents([]);
    setScreen('ready');
  }, []);

  const handleSettingsSave = useCallback((newSettings) => {
    saveSettings(newSettings);
    setSettingsState(newSettings);
  }, []);

  const handleHome = useCallback(() => {
    setScreen('home');
    setSession(null);
    setMyRole(null);
    setIsHost(false);
    setTrialEvents([]);
    setLastResult(null);
    setSyncResult(null);
  }, []);

  // ── Common props ──────────────────────────────────────────────────────────
  const commonProps = {
    session, myRole, isHost, settings, syncResult,
    connected, latency, deviceId, getServerTime,
    onHome: handleHome,
  };

  // ── Screen router ─────────────────────────────────────────────────────────
  const screens = {
    home:    <HomeScreen    {...commonProps}
               onCreateSession={handleCreateSession}
               onJoinSession={handleJoinSession}
               onHistory={() => setScreen('history')}
               onSettings={() => setScreen('settings')} />,

    role:    <RoleSelectionScreen {...commonProps}
               onRoleSelect={handleAssignRole}
               onStartSync={handleStartSync} />,

    sync:    <SyncScreen    {...commonProps}
               onSyncDone={handleSyncDone}
               onRunSync={handleStartSync} />,

    ready:   <ReadyScreen   {...commonProps}
               trialEvents={trialEvents}
               onStartTrial={handleStartTrial}
               onHome={handleHome} />,

    running: <RunningScreen {...commonProps}
               trialEvents={trialEvents}
               onTrigger={handleTrigger}
               onSaveResult={handleSaveResult}
               onAbort={handleAbortTrial} />,

    result:  <ResultScreen  {...commonProps}
               result={lastResult}
               trialEvents={trialEvents}
               onNextTrial={handleNextTrial}
               onHome={handleHome} />,

    display: <DisplayScreen session={session} syncResult={syncResult} />,

    history: <HistoryScreen {...commonProps}
               onBack={() => setScreen('home')} />,

    settings:<SettingsScreen settings={settings}
               onSave={handleSettingsSave}
               onBack={() => setScreen('home')} />,
  };

  // "setup" is embedded in HomeScreen (modal/step)
  return (
    <div className="h-full bg-slate-900 text-white overflow-hidden">
      {/* Global status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-slate-950 text-xs">
        <span className="text-slate-400 truncate">
          {session ? `Session ${session.code}` : 'Sports Timing'}
        </span>
        <div className="flex items-center gap-2">
          {latency !== null && (
            <span className={latency < 30 ? 'text-green-400' : latency < 80 ? 'text-yellow-400' : 'text-red-400'}>
              {latency}ms
            </span>
          )}
          <span className={connected ? 'text-green-400' : 'text-red-400'}>
            {connected ? '● Online' : '○ Offline'}
          </span>
        </div>
      </div>

      <div className="flex flex-col" style={{ height: 'calc(100% - 28px)' }}>
        {screens[screen] || screens.home}
      </div>
    </div>
  );
}
