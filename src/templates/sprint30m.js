/**
 * TEST TEMPLATE: 30-Metre Sprint
 * 2 nodes required: START + FINISH
 * Optional SPLIT nodes at intermediate distances (10m, 20m).
 */

export const sprint30mTemplate = {
  id: 'sprint-30m',
  name: '30m Sprint Test',
  description: 'Linear sprint over 30 metres. Measures total time, speed, and optional splits.',
  icon: '🏃',

  nodes: [
    {
      id: 'start',
      role: 'START',
      label: 'Start Line',
      description: "Place at the athlete's start position (0 m)",
      required: true,
    },
    {
      id: 'finish',
      role: 'FINISH',
      label: 'Finish Line (30 m)',
      description: 'Place exactly 30 m from start',
      required: true,
    },
    {
      id: 'split1',
      role: 'SPLIT',
      label: 'Split Gate (10 m)',
      description: 'Optional intermediate gate at 10 m',
      required: false,
    },
    {
      id: 'split2',
      role: 'SPLIT2',
      label: 'Split Gate (20 m)',
      description: 'Optional intermediate gate at 20 m',
      required: false,
    },
    {
      id: 'display',
      role: 'DISPLAY',
      label: 'Result Display Board',
      description: 'Big screen facing athlete at finish — shows time the moment trial ends',
      required: false,
    },
  ],

  // Roles that must fire to complete a trial (required nodes only)
  triggerSequence: ['START', 'FINISH'],

  // Metrics computed from event timestamps
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
    {
      key: 'speedMs',
      label: 'Speed',
      unit: 'm/s',
      formula(events) {
        const start  = events.find(e => e.role === 'START');
        const finish = events.find(e => e.role === 'FINISH');
        if (!start || !finish) return null;
        const t = (finish.correctedTime - start.correctedTime) / 1000;
        return +(30 / t).toFixed(2);
      },
    },
    {
      key: 'speedKmh',
      label: 'Speed',
      unit: 'km/h',
      formula(events) {
        const start  = events.find(e => e.role === 'START');
        const finish = events.find(e => e.role === 'FINISH');
        if (!start || !finish) return null;
        const t = (finish.correctedTime - start.correctedTime) / 1000;
        return +((30 / t) * 3.6).toFixed(2);
      },
    },
    {
      key: 'split1Time',
      label: 'Split 10m',
      unit: 's',
      formula(events) {
        const start = events.find(e => e.role === 'START');
        const split = events.find(e => e.role === 'SPLIT');
        if (!start || !split) return null;
        return +((split.correctedTime - start.correctedTime) / 1000).toFixed(2);
      },
    },
    {
      key: 'split2Time',
      label: 'Split 20m',
      unit: 's',
      formula(events) {
        const start = events.find(e => e.role === 'START');
        const split = events.find(e => e.role === 'SPLIT2');
        if (!start || !split) return null;
        return +((split.correctedTime - start.correctedTime) / 1000).toFixed(2);
      },
    },
  ],

  fieldLayout: `
START ──────────────────────── FINISH
  0m         [10m]     [20m]    30m
             (opt)     (opt)
  `,

  // Benchmark norms (lower time = better)
  // Source: adapted from general sports science literature
  normTable: {
    male: {
      15: { excellent: 3.80, good: 4.00, average: 4.30, belowAverage: 4.60, poor: 5.00 },
      17: { excellent: 3.70, good: 3.90, average: 4.20, belowAverage: 4.50, poor: 4.90 },
      20: { excellent: 3.60, good: 3.80, average: 4.10, belowAverage: 4.40, poor: 4.80 },
      25: { excellent: 3.65, good: 3.85, average: 4.15, belowAverage: 4.45, poor: 4.85 },
      30: { excellent: 3.70, good: 3.90, average: 4.20, belowAverage: 4.55, poor: 4.95 },
    },
    female: {
      15: { excellent: 4.10, good: 4.35, average: 4.65, belowAverage: 5.00, poor: 5.40 },
      17: { excellent: 4.00, good: 4.25, average: 4.55, belowAverage: 4.90, poor: 5.30 },
      20: { excellent: 3.90, good: 4.15, average: 4.45, belowAverage: 4.80, poor: 5.20 },
      25: { excellent: 3.95, good: 4.20, average: 4.50, belowAverage: 4.85, poor: 5.25 },
      30: { excellent: 4.05, good: 4.30, average: 4.60, belowAverage: 5.00, poor: 5.40 },
    },
  },
};
