import React from 'react';

const MAP = {
  good:    { cls: 'badge-good',    text: 'SYNC GOOD' },
  fair:    { cls: 'badge-fair',    text: 'SYNC FAIR' },
  poor:    { cls: 'badge-poor',    text: 'SYNC POOR' },
  unknown: { cls: 'badge-unknown', text: 'NO SYNC' },
};

export default function SyncBadge({ quality, small }) {
  const cfg = MAP[quality] || MAP.unknown;
  return (
    <span className={cfg.cls} style={small ? { fontSize: '0.65rem' } : {}}>
      {cfg.text}
    </span>
  );
}
