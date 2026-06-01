import React from 'react';
import { getSettings } from '../../core/StorageManager';

/**
 * Renders the standardized gate reference line on top of the screen.
 * Position is configurable in Settings so coaches can calibrate
 * the screen line to match the physical tape/cone on the ground.
 */
export default function LineMarker() {
  const { markerPosition = 50 } = getSettings();

  return (
    <>
      <div
        className="line-marker"
        style={{ top: `${markerPosition}%` }}
      />
      {/* Tick marks at edges for precision alignment */}
      <div className="absolute left-0 flex flex-col items-start" style={{ top: `${markerPosition}%` }}>
        <div className="w-4 h-0.5 bg-brand-500 opacity-90" />
      </div>
      <div className="absolute right-0 flex flex-col items-end" style={{ top: `${markerPosition}%` }}>
        <div className="w-4 h-0.5 bg-brand-500 opacity-90" />
      </div>
    </>
  );
}
