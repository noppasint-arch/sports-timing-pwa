import React from 'react';

const COLORS = {
  3: 'text-yellow-400',
  2: 'text-orange-400',
  1: 'text-red-400',
  0: 'text-brand-400',
};

export default function CountdownDisplay({ value }) {
  return (
    <div className={`countdown ${COLORS[value] || 'text-white'} transition-all duration-300`}
         style={{ textShadow: '0 0 40px currentColor' }}>
      {value === 0 ? 'GO!' : value}
    </div>
  );
}
