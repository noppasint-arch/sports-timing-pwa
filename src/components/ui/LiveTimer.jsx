import React, { useEffect, useState } from 'react';

/**
 * Displays an elapsed timer that ticks in real time.
 * startTime: server-corrected ms timestamp of when the trial began.
 */
export default function LiveTimer({ startTime, getServerTime }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const id = setInterval(() => {
      setElapsed(getServerTime() - startTime);
    }, 50); // 50ms tick is visually smooth and CPU-light
    return () => clearInterval(id);
  }, [startTime, getServerTime]);

  const secs = (elapsed / 1000).toFixed(2);

  return (
    <div className="text-center py-4">
      <div className="timer-display">{secs}</div>
      <div className="text-slate-500 text-xs mt-1">seconds elapsed</div>
    </div>
  );
}
