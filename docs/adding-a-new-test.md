# Developer Guide: Adding a New Test Template

The sensor engine is fully decoupled from any specific test. Adding a new test requires **only creating one new file** — no changes to the engine, server, or UI.

---

## Step 1 — Create the Template File

Create `src/templates/myTest.js`. The shape every template must follow:

```js
export const myTestTemplate = {
  // ── Identity ──────────────────────────────────────────────────────────────
  id:          'my-test',          // unique slug, no spaces
  name:        'My Custom Test',   // displayed in UI
  description: 'One sentence describing the test.',
  icon:        '🏃',               // emoji shown on cards

  // ── Sensor nodes ─────────────────────────────────────────────────────────
  // Define every device that participates. required:false = optional gate.
  nodes: [
    {
      id:          'start',
      role:        'START',        // role ID — must match triggerSequence below
      label:       'Start Line',   // short label shown on role-selection screen
      description: 'Place at 0 m mark.',
      required:    true,
    },
    {
      id:          'finish',
      role:        'FINISH',
      label:       'Finish Line (40 m)',
      description: 'Place at 40 m mark.',
      required:    true,
    },
    {
      id:          'split',
      role:        'SPLIT',
      label:       'Split Gate (20 m)',
      description: 'Optional gate at 20 m.',
      required:    false,
    },
  ],

  // ── Trigger sequence ──────────────────────────────────────────────────────
  // Ordered list of roles that MUST fire (in any order) to complete a trial.
  // The engine marks the trial done when all required roles have fired.
  triggerSequence: ['START', 'FINISH'],

  // ── Metrics ───────────────────────────────────────────────────────────────
  // Each metric receives the full events array and returns a value (or null).
  // events: [{ role, correctedTime, rawTime, method }]
  metrics: [
    {
      key:   'totalTime',
      label: 'Total Time',
      unit:  'ms',
      formula(events) {
        const start  = events.find(e => e.role === 'START');
        const finish = events.find(e => e.role === 'FINISH');
        if (!start || !finish) return null;
        return Math.round(finish.correctedTime - start.correctedTime);
      },
    },
    {
      key:   'totalTimeS',
      label: 'Total Time',
      unit:  's',
      formula(events) {
        const start  = events.find(e => e.role === 'START');
        const finish = events.find(e => e.role === 'FINISH');
        if (!start || !finish) return null;
        return +((finish.correctedTime - start.correctedTime) / 1000).toFixed(2);
      },
    },
    // Add as many metrics as you need
  ],

  // ── Field layout ──────────────────────────────────────────────────────────
  // ASCII art or plain text shown to coaches during setup.
  fieldLayout: `
START ──────────────── [SPLIT] ──────────────── FINISH
  0m                    20m                      40m
  `,

  // ── Norm table (optional) ────────────────────────────────────────────────
  // If null, no rating is shown on the result screen.
  // Values are in SECONDS (lower = better for time-based tests).
  // Keys are age brackets; closest bracket is selected automatically.
  normTable: {
    male: {
      20: { excellent: 4.8, good: 5.2, average: 5.8, belowAverage: 6.3, poor: 6.4 },
      30: { excellent: 5.0, good: 5.4, average: 6.0, belowAverage: 6.5, poor: 6.6 },
    },
    female: {
      20: { excellent: 5.5, good: 6.0, average: 6.6, belowAverage: 7.2, poor: 7.3 },
      30: { excellent: 5.7, good: 6.2, average: 6.8, belowAverage: 7.4, poor: 7.5 },
    },
  },
};
```

---

## Step 2 — Register in TemplateEngine

Open `src/templates/TemplateEngine.js` and add two lines:

```js
import { myTestTemplate } from './myTest';   // ← add this

const REGISTRY = [
  sprint30mTemplate,
  yShapeTemplate,
  illinoisTemplate,
  myTestTemplate,                            // ← add this
];
```

That's it. The new test now appears in:
- Home screen → "Host New Session" test selector
- Role selection screen with the correct node buttons
- Result screen with your metrics and norm rating

---

## Special Roles

| Role ID    | Meaning                                            |
|------------|----------------------------------------------------|
| `START`    | Triggers to begin timing; host countdown runs here |
| `FINISH`   | Triggers to stop timing                            |
| `CENTER`   | Y-test controller; sends direction cue             |
| `LEFT`     | Y-test left endpoint                               |
| `RIGHT`    | Y-test right endpoint                              |
| `FORWARD`  | Y-test forward endpoint                            |
| `SPLIT`    | Intermediate timing gate                           |
| `SPLIT2`   | Second intermediate gate                           |

You can invent any role name — it becomes the button label on the role-selection screen.

---

## Audio-Cued Tests (e.g. Beep / Yo-Yo)

For tests where the CENTER device plays an audio cue, emit a `CENTER_CUE` event from the CENTER node at the moment the beep plays. The trigger system will record it as a timestamp event identical to a button press.

```js
// In your test-specific logic, after playing the audio:
onTrigger('CENTER_CUE', getServerTime(), Date.now(), 'audio_cue');
```

Then reference `CENTER_CUE` in your `triggerSequence` and metric formulas.

---

## Runtime Registration (Coach-Defined Tests)

To register a template without redeploying:

```js
import { registerTemplate } from './templates/TemplateEngine';
registerTemplate(myCustomTemplate);
```

This persists only for the current session. For permanent custom tests, add the file as in Step 1–2.
