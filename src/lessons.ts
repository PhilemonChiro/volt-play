// The Learn Volt tutorial: one program, built a step at a time, from a single
// pin to a lamp that remembers how often it was switched on. A step either
// shows a change (typed into the editor for you) or asks you to make one; the
// compiler's result tells the tutorial when you've done it. Lesson text marks
// code with backticks.
import type { Diagnostic, Pin } from './compiler';

export type Result = { diags: Diagnostic[]; pins: Pin[]; source: string };

export type Lesson = {
  title: string;
  body: string[];
  // The program this step shows, given the lamp's pin (the visitor picks it
  // in step 4 and keeps it from then on). A try step starts from it.
  code: (lamp: number) => string;
  // Lines to keep bright, found by their text.
  spot?: string[];
  // Shows the program dimmed, as a preview of where the lessons lead.
  preview?: boolean;
  // Labels drawn under a line, pointing at words in it.
  notes?: { line: string; at: string; text: string }[];
  // Draws the program's timers as a strip under the code.
  timeline?: boolean;
  panel?: 'pins' | 'problems' | 'states';
  try?: {
    task: string;
    // The line the task card sits under (default: the first spotlit line).
    at?: string;
    // A nudge offered before "Show me".
    hint: string;
    answer: (lamp: number) => string;
    done: (r: Result) => boolean;
    after: string;
    // The goal is an error, so errors aren't pointed out as a slip.
    wantsError?: boolean;
    // A nudge for a near miss the compiler doesn't flag.
    nudge?: (r: Result) => string | null;
  };
  recap?: { word: string; meaning: string }[];
};

const hw = (lamp: number, beat = false, button = false) =>
  `hardware {
    pin lamp = ${lamp}
${beat ? '    pin heartbeat = 23\n' : ''}${button ? '    pin button: PullUpInput = 27\n' : ''}}
`;
const beat = (every: string) => `
every ${every} { heartbeat.toggle() }
`;
const machine = (after: string) => `
machine light {
    initial state dark {
        enter { lamp.off() }
        on button.is_pressed() -> lit
    }

    state lit {
        enter { lamp.on() }
        after ${after} -> dark
    }
}
`;
const counted = (saved: boolean) => `
machine light {
    initial state dark {
        enter { lamp.off() }
        on button.is_pressed() -> lit
    }

    state lit {
        enter {
            lamp.on()
            presses += 1${saved ? '\n            storage.save("presses", presses)' : ''}
        }
        after 10s -> dark
    }
}
`;
const withStorage = (lamp: number, saved: boolean) =>
  hw(lamp, true, true) + '\nstorage presses: int = 0\n' + beat('500ms') + counted(saved);

const FLASH = new Set([6, 7, 8, 9, 10, 11]);
const errors = (r: Result) => r.diags.filter((d) => d.severity === 'error');

export const tour: Lesson[] = [
  {
    title: 'Learn Volt',
    body: [
      'Volt is a language for microcontrollers. In eight short steps you’ll write the program beside this: a lamp with a button, a heartbeat light, and a count that survives a power cut.',
      'You’ll make the key changes yourself, and the compiler checks each one.',
    ],
    code: (lamp) => withStorage(lamp, true),
    preview: true,
  },
  {
    title: 'Say what’s wired',
    body: [
      'A Volt program starts by describing the board. This line says a lamp is connected to GPIO 2.',
      'Volt checks it against the ESP32’s datasheet straight away. The Hardware panel shows what it found.',
    ],
    code: () => hw(2),
    notes: [
      { line: 'pin lamp', at: 'pin', text: 'declares a pin' },
      { line: 'pin lamp', at: 'lamp', text: 'a name you choose' },
      { line: 'pin lamp', at: '2', text: 'the GPIO it’s wired to' },
    ],
    spot: ['pin lamp'],
    panel: 'pins',
  },
  {
    title: 'Pins have rules',
    body: ['Some pins on the board look free but aren’t. See what happens with one of them.'],
    code: () => hw(2),
    spot: ['pin lamp'],
    panel: 'pins',
    try: {
      at: 'pin lamp',
      hint: 'On the highlighted line, replace the `2` after the `=`.',
      task: 'Change the `2` to `6`.',
      answer: () => hw(6),
      done: (r) => r.diags.some((d) => d.code === 'pin-blocked'),
      after:
        'GPIO 6 is wired to the chip that stores your program. Using it would crash the ESP32 the moment it started. Volt caught it as you typed, before anything was built.',
      wantsError: true,
    },
  },
  {
    title: 'Fix it in one click',
    body: ['Under the error, Volt suggests pins that are free and can drive a lamp.'],
    code: () => hw(6),
    spot: ['pin lamp'],
    panel: 'pins',
    try: {
      at: 'pin lamp',
      hint: 'The buttons under the red message are pins Volt has already checked.',
      task: 'Click one of the suggested pins.',
      answer: () => hw(4),
      done: (r) => !errors(r).length && r.pins.some((p) => p.name === 'lamp' && !FLASH.has(p.gpio)),
      after: 'Fixed, and the new pin was checked too. Your lamp stays on it for the rest of the tour.',
    },
  },
  {
    title: 'Things that repeat',
    body: [
      'A heartbeat light shows the board is alive. `every` runs its block on a timer: this one toggles the light once a second.',
      'There’s no main loop to write and no `delay()` that freezes everything else.',
    ],
    code: (lamp) => hw(lamp, true) + beat('1s'),
    notes: [
      { line: 'every 1s', at: 'every', text: 'runs on a timer' },
      { line: 'every 1s', at: '1s', text: 'how often' },
      { line: 'every 1s', at: 'toggle', text: 'what it does each time' },
    ],
    timeline: true,
    spot: ['pin heartbeat', 'every 1s'],
    panel: 'pins',
    try: {
      at: 'every 1s',
      hint: 'Half of `1s` is `500ms`.',
      task: 'Make the heartbeat twice as fast.',
      answer: (lamp) => hw(lamp, true) + beat('500ms'),
      done: (r) => !errors(r).length && /every\s+(500ms|0\.5s)\s*\{\s*heartbeat/.test(r.source),
      after: 'Times carry their unit, like `500ms` or `2s`, so a number never leaves you guessing.',
      nudge: (r) => (/every\s+\d+\s*\{/.test(r.source) ? 'Add a unit to the time, like `500ms`.' : null),
    },
  },
  {
    title: 'Behaviour as states',
    body: [
      'Now the lamp. Pressing the button should switch it on, and it should go off by itself.',
      'A `machine` says that directly. The lamp is in one state at a time, `dark` or `lit`, and `on` and `after` move it between them.',
    ],
    code: (lamp) => hw(lamp, true, true) + beat('500ms') + machine('5s'),
    notes: [
      { line: 'on button', at: 'on', text: 'when this happens' },
      { line: 'on button', at: '-> lit', text: 'go to this state' },
      { line: 'after 5s', at: 'after', text: 'when this much time has passed' },
    ],
    spot: ['pin button', 'machine light', 'on button', 'after 5s'],
    panel: 'states',
  },
  {
    title: 'Change how it behaves',
    body: ['The State machines panel draws the machine from your code and keeps up as you edit.'],
    code: (lamp) => hw(lamp, true, true) + beat('500ms') + machine('5s'),
    spot: ['after 5s'],
    panel: 'states',
    try: {
      at: 'after 5s',
      hint: 'Change the `5s` on the highlighted line.',
      task: 'Keep the lamp on for 10 seconds instead of 5.',
      answer: (lamp) => hw(lamp, true, true) + beat('500ms') + machine('10s'),
      done: (r) => !errors(r).length && /after\s+(10s|10000ms)\s*->\s*dark/.test(r.source),
      after: 'Look at the arrow from `lit` back to `dark`. Its label changed as you typed.',
      nudge: (r) => (/after\s+\d+\s*->/.test(r.source) ? 'Add a unit to the time, like `10s`.' : null),
    },
  },
  {
    title: 'Remember through a power cut',
    body: [
      'Last, count how often the lamp is switched on. A `storage` value is kept in flash, so it can survive a restart.',
      'Read the note Volt has added beside it.',
    ],
    code: (lamp) => withStorage(lamp, false),
    notes: [
      { line: 'storage presses', at: 'storage', text: 'kept in flash, not memory' },
    ],
    spot: ['storage presses', 'presses += 1'],
    panel: 'pins',
    try: {
      at: 'presses += 1',
      hint: 'Put the cursor at the end of `presses += 1`, press Return, then type the line.',
      task: 'Do what the note says: on a new line after `presses += 1`, add `storage.save("presses", presses)`.',
      answer: (lamp) => withStorage(lamp, true),
      done: (r) =>
        !errors(r).length &&
        !r.diags.some((d) => /never saved/.test(d.message)) &&
        /storage\.save\(\s*"presses"/.test(r.source),
      after: 'Now the count is written to flash whenever it changes. Without the save, it would have quietly gone back to zero.',
    },
  },
  {
    title: 'You wrote Volt',
    body: [
      'The program beside this is yours. Four ideas carry most of the language:',
    ],
    code: (lamp) => withStorage(lamp, true),
    recap: [
      { word: 'hardware', meaning: 'the board, checked against its datasheet' },
      { word: 'every', meaning: 'work on a timer, side by side' },
      { word: 'machine', meaning: 'behaviour as states' },
      { word: 'storage', meaning: 'values that survive a restart' },
    ],
  },
];

export type Course = { id: string; title: string; about: string; steps: Lesson[] };

// Line numbers of the lines containing any of the given texts.
export function spotLines(code: string, texts: string[] = []): number[] {
  const lines = code.split('\n');
  return texts.flatMap((t) => {
    const i = lines.findIndex((l) => l.includes(t));
    return i >= 0 ? [i + 1] : [];
  });
}
