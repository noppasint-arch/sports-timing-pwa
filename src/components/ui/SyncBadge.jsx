import React from 'react';

const MAP = {
  excellent: { cls: 'badge-good',    text: 'SYNC EXCELLENT' },
  good:      { cls: 'badge-good',    text: 'SYNC GOOD' },
  fair:      { cls: 'badge-fair',    text: 'SYNC FAIR' },
  poor:      { cls: 'badge-poor',    text: 'SYNC POOR' },
  unknown:   { cls: 'badge-unknown', text: 'NO SYNC' },
};

export default function SyncBadge({ quality, accuracy, small }) {
  const cfg = MAP[quality] || MAP.unknown;
  const label = accuracy != null && accuracy < 999
    ? `±${accuracy}ms`
    : cfg.text;
  return (
    <span className={cfg.cls} style={small ? { fontSize: '0.65rem' } : {}}>
      {label}
    </span>
  );
}
