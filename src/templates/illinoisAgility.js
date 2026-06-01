/**
 * TEST TEMPLATE: Illinois Agility Test
 * 2 nodes: START + FINISH (same sensor logic as sprint)
 * Coach physically places 8 cones; sensors only record entry/exit time.
 */

export const illinoisTemplate = {
  id: 'illinois-agility',
  name: 'Illinois Agility Test',
  description:
    'Slalom agility course. 10 m × 5 m field with 4 slalom cones. Athlete runs, turns, weaves, returns.',
  icon: '🏟️',

  nodes: [
    {
      id: 'start',
      role: 'START',
      label: 'Start Line',
      description: 'Place at bottom-left cone (athlete lies face-down here)',
      required: true,
    },
    {
      id: 'finish',
      role: 'FINISH',
      label: 'Finish Line',
      description: 'Place at bottom-right cone, 5 m from start',
      required: true,
    },
    {
      id: 'display',
      role: 'DISPLAY',
      label: 'Result Display Board',
      description: 'Big screen facing athlete at finish — shows time the moment trial ends',
      required: false,
    },
  ],

  triggerSequence: ['START', 'FINISH'],

  metrics: [
    {
      key: 'totalTime',
      label: 'Total Time',
      unit: 'ms',
      formula(events) {
        const start  = events.find(e => e.role === 'START');
        const finish = events.find(e => e.role === 'FINISH');
        if (!start || !finish) return null;
        return Math.round(finish.correctedTime - start.correctedTime);
      },
    },
    {
      key: 'totalTimeS',
      label: 'Total Time',
      unit: 's',
      formula(events) {
        const start  = events.find(e => e.role === 'START');
        const finish = events.find(e => e.role === 'FINISH');
        if (!start || !finish) return null;
        return +((finish.correctedTime - start.correctedTime) / 1000).toFixed(2);
      },
    },
  ],

  fieldLayout: `
  START ●─────────────────────────────●
  (0,0) |   ●cone   ●cone   ●cone    | (5,0)
        |                             |
        |   ●cone   ●cone   ●cone    |
        |                             |
  (0,10)●─────────────────────────────●
        ↑                             ↑
      START                        FINISH
  (athlete)                       (sensor)

  10 m length × 5 m width
  `,

  // Illinois agility test norms (seconds) — commonly referenced values
  normTable: {
    male: {
      16: { excellent: 15.2, good: 15.9, average: 17.0, belowAverage: 18.2, poor: 18.3 },
      20: { excellent: 15.2, good: 15.9, average: 17.0, belowAverage: 18.2, poor: 18.3 },
      25: { excellent: 15.2, good: 15.9, average: 17.0, belowAverage: 18.2, poor: 18.3 },
      30: { excellent: 15.2, good: 15.9, average: 17.0, belowAverage: 18.6, poor: 18.7 },
      40: { excellent: 15.6, good: 16.4, average: 17.6, belowAverage: 19.1, poor: 19.2 },
    },
    female: {
      16: { excellent: 17.0, good: 17.9, average: 21.7, belowAverage: 23.0, poor: 23.1 },
      20: { excellent: 17.0, good: 17.9, average: 21.7, belowAverage: 23.0, poor: 23.1 },
      25: { excellent: 17.0, good: 17.9, average: 21.7, belowAverage: 23.0, poor: 23.1 },
      30: { excellent: 17.5, good: 18.4, average: 22.4, belowAverage: 24.2, poor: 24.3 },
      40: { excellent: 18.1, good: 19.3, average: 23.2, belowAverage: 25.6, poor: 25.7 },
    },
  },
};
