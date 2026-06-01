/**
 * TEST TEMPLATE: Y-Shape Agility Test
 * 4 nodes: CENTER (controller) + LEFT + RIGHT + FORWARD (endpoints)
 *
 * The CENTER device randomly selects a direction, displays an arrow,
 * plays an audio cue, and records reaction + travel times.
 * Endpoint devices trigger on athlete arrival.
 */

export const yShapeTemplate = {
  id: 'y-shape-agility',
  name: 'Y-Shape Agility Test',
  description:
    'Reactive agility test. Center device cues direction; athlete sprints to the indicated arm.',
  icon: '🔀',

  nodes: [
    {
      id: 'center',
      role: 'CENTER',
      label: 'Center Station',
      description: 'Direction controller & timer. Place at the junction of the Y.',
      required: true,
    },
    {
      id: 'left',
      role: 'LEFT',
      label: 'Left Arm',
      description: 'Left endpoint sensor. Place at far end of left arm.',
      required: true,
    },
    {
      id: 'right',
      role: 'RIGHT',
      label: 'Right Arm',
      description: 'Right endpoint sensor. Place at far end of right arm.',
      required: true,
    },
    {
      id: 'forward',
      role: 'FORWARD',
      label: 'Forward Arm',
      description: 'Forward endpoint sensor. Place at far end of forward arm.',
      required: true,
    },
    {
      id: 'display',
      role: 'DISPLAY',
      label: 'Result Display Board',
      description: 'Big screen facing athlete at center — shows rep time after each arrival',
      required: false,
    },
  ],

  // Each rep: CENTER cues → target arm triggers
  triggerSequence: ['CENTER_CUE', 'TARGET_ARRIVAL'],

  metrics: [
    {
      key: 'repTime',
      label: 'Rep Time',
      unit: 'ms',
      formula(events) {
        const cue    = events.find(e => e.role === 'CENTER_CUE');
        const arrive = events.find(e => ['LEFT', 'RIGHT', 'FORWARD'].includes(e.role));
        if (!cue || !arrive) return null;
        return Math.round(arrive.correctedTime - cue.correctedTime);
      },
    },
    {
      key: 'avgRepTime',
      label: 'Avg Rep Time',
      unit: 'ms',
      formula(events) {
        // Aggregate across reps — populated at session summary level
        return null;
      },
    },
  ],

  fieldLayout: `
          FORWARD
            |
            |  (5–6 m)
            |
  LEFT ────●──── RIGHT
          (3 m each side)

  ● = Center station
  Arms: typically 3–6 m from center
  `,

  directions: ['LEFT', 'RIGHT', 'FORWARD'],

  normTable: null, // Y-shape norms are composite-score based; handled in UI
};
