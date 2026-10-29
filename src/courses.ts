// Short courses, each on one Volt concept. Every program here compiles as
// the step describes (clean, or with exactly the error or warning the step
// is about); scripts in the playground's tests check that. Lesson text marks
// code with backticks.
import { tour, type Course, type Lesson, type Result } from './lessons';

const errors = (r: Result) => r.diags.filter((d) => d.severity === 'error');
const clean = (r: Result) => !errors(r).length;
const said = (r: Result, re: RegExp) => r.diags.some((d) => re.test(d.message));
const fixed = (code: string) => () => code;

// ---------- Pins and modes ----------
const pinsProgram = (buzzer: number, led = 2) => `hardware {
    pin led: Output = ${led}
    pin button: PullUpInput = 27
    pin dial: Analog = 34
    pin buzzer: PWM = ${buzzer}
}

every 100ms {
    if button.is_pressed() {
        buzzer.set_pwm(dial.read() / 16)
    } else {
        buzzer.set_pwm(0)
    }
    led.toggle()
}
`;
const INPUT_ONLY = new Set([34, 35, 36, 37, 38, 39]);

const pins: Lesson[] = [
  {
    title: 'A pin has a job',
    body: [
      'After the colon comes the pin’s mode: what you want it to do. `Output` drives an LED, `PullUpInput` reads a button, `Analog` measures a voltage and `PWM` pulses a buzzer.',
      'Volt checks each mode against what that pin can physically do.',
    ],
    code: fixed(pinsProgram(18)),
    notes: [
      { line: 'pin button', at: 'PullUpInput', text: 'reads a button' },
      { line: 'pin dial', at: 'Analog', text: 'measures a voltage' },
      { line: 'pin buzzer', at: 'PWM', text: 'pulses an output' },
    ],
    spot: ['pin led', 'pin button', 'pin dial', 'pin buzzer'],
    panel: 'pins',
  },
  {
    title: 'Some pins only listen',
    body: ['GPIOs 34 to 39 on the ESP32 can read a signal, but they can’t drive one.'],
    code: fixed(pinsProgram(18)),
    spot: ['pin buzzer'],
    panel: 'pins',
    try: {
      at: 'pin buzzer',
      hint: 'Change the number after `PWM =`.',
      task: 'Move the buzzer to GPIO `35`.',
      answer: fixed(pinsProgram(35)),
      done: (r) => r.diags.some((d) => d.code === 'pin-input-only' || /input-only/.test(d.message)),
      after: 'A PWM signal has to be driven, so pin 35 can’t carry it. The dial is fine on 34: reading is all it needs.',
      wantsError: true,
    },
  },
  {
    title: 'Pick one that can',
    body: ['The suggestions under the error are pins that can drive PWM and aren’t already taken.'],
    code: fixed(pinsProgram(35)),
    spot: ['pin buzzer'],
    panel: 'pins',
    try: {
      at: 'pin buzzer',
      hint: 'The buttons under the red message are pins that can drive PWM.',
      task: 'Click one of the suggested pins.',
      answer: fixed(pinsProgram(4)),
      done: (r) => clean(r) && r.pins.some((p) => p.name === 'buzzer' && !INPUT_ONLY.has(p.gpio)),
      after: 'Fixed. Every suggestion is checked against the other pins in your program, so it never offers one you’ve used.',
    },
  },
  {
    title: 'Errors and warnings',
    body: [
      'Red means it won’t build. Amber means it will, but there’s something you should know.',
      'GPIO 0 decides how the chip starts up, so an LED wired to it can stop the board booting normally. Volt lets you use it, and tells you why you might not want to.',
    ],
    code: fixed(pinsProgram(4, 0)),
    spot: ['pin led'],
    panel: 'pins',
  },
];

// ---------- Time ----------
const timeProgram = (blink: string) => `hardware {
    pin led = 2
    pin status = 23
}

every ${blink} { led.toggle() }

every 200ms { status.toggle() }
`;
const timeWhen = `hardware {
    pin led = 2
    pin status = 23
}

var armed: bool = false

every 1s when armed { led.toggle() }

every 200ms { status.toggle() }
`;
const timeStrict = `hardware {
    pin led = 2
    pin motor: PWM = 4
}

var armed: bool = false

every 1s when armed { led.toggle() }

every 1ms strict { motor.set_pwm(100) }
`;

const time: Lesson[] = [
  {
    title: 'Blocks on a timer',
    body: [
      '`every` runs its block again and again at a fixed interval. These two run side by side at their own speeds.',
      'There’s no loop to write, and neither block waits for the other.',
    ],
    code: fixed(timeProgram('1s')),
    timeline: true,
    spot: ['every 1s', 'every 200ms'],

  },
  {
    title: 'Time has a unit',
    body: ['In C, `delay(1000)` could mean milliseconds or ticks, depending on the library. Volt doesn’t guess.'],
    code: fixed(timeProgram('1s')),
    spot: ['every 1s'],
    try: {
      at: 'every 1s',
      hint: 'Put the cursor just after `1s` and press Backspace.',
      task: 'Delete the `s` from `1s`.',
      answer: fixed(timeProgram('1')),
      done: (r) => said(r, /must be a duration/),
      after: 'A bare number isn’t a time. Put a unit back, or try another one: `250ms`, `2s` and `1min` all work.',
      wantsError: true,
    },
  },
  {
    title: 'Put a unit back',
    body: ['Any unit works: `us`, `ms`, `s`, `min` or `hour`.'],
    code: fixed(timeProgram('1')),
    spot: ['every 1 '],
    try: {
      at: 'every 1 ',
      hint: 'Type `s` straight after the `1`, or try `250ms`.',
      task: 'Give the interval a unit again.',
      answer: fixed(timeProgram('1s')),
      done: (r) => clean(r) && /every\s+\d+(\.\d+)?(us|ms|s|sec|second|seconds|min|hour)\s*\{\s*led/.test(r.source),
      after: 'Back to blinking.',
    },
  },
  {
    title: 'Only when it makes sense',
    body: [
      '`when` skips a run while its condition is false. The LED only blinks while `armed` is true.',
      'It’s how you tie a timer to the state of things, without an `if` wrapped around the whole block.',
    ],
    code: fixed(timeWhen),
    notes: [
      { line: 'every 1s when armed', at: 'when', text: 'skips runs while this is false' },
    ],
    timeline: true,
    spot: ['var armed', 'every 1s when armed'],
  },
  {
    title: 'When timing must be exact',
    body: [
      '`strict` runs a block from a hardware timer, so nothing else can delay it. Use it for motors and signals that need precise timing.',
      'Keep a strict block short: no Wi-Fi and no waiting. Volt reports it if you try.',
    ],
    code: fixed(timeStrict),
    notes: [
      { line: 'every 1ms strict', at: 'strict', text: 'runs from a hardware timer' },
    ],
    timeline: true,
    spot: ['every 1ms strict'],
  },
];

// ---------- State machines ----------
const door = (extra = '', alarmLink = '') => `hardware {
    pin relay: Output = 4
    pin button: PullUpInput = 27
}

var failures: int = 0

machine door {
    initial state locked {
        enter { relay.off() }
        on button.is_pressed() -> unlocked${alarmLink}
    }

    state unlocked {
        enter { relay.on() }
        after 10s -> locked
    }
${extra}}
`;
const alarmState = `
    state alarm {
        enter { log("door", "ALARM") }
        after 30s -> locked
    }
`;
const guarded = `hardware {
    pin relay: Output = 4
    pin button: PullUpInput = 27
}

var failures: int = 0

machine door {
    initial state locked {
        enter { relay.off() }
        on button.is_pressed() [failures < 3] -> unlocked
        on failures >= 3 -> alarm
    }

    state unlocked {
        enter { relay.on() }
        exit { log("door", "relocking") }
        after 10s -> locked
    }

    state alarm {
        enter { log("door", "ALARM") }
        after 30s -> locked { failures = 0 }
    }
}
`;

const machines: Lesson[] = [
  {
    title: 'One state at a time',
    body: [
      'A door lock is always either `locked` or `unlocked`. A `machine` writes that down directly.',
      '`enter` runs as a state begins. `on` moves when something happens, `after` when time passes.',
    ],
    code: fixed(door()),
    notes: [
      { line: 'initial state locked', at: 'initial', text: 'where it starts' },
      { line: 'enter { relay.off() }', at: 'enter', text: 'runs as the state begins' },
    ],
    spot: ['machine door', 'on button', 'after 10s'],
    panel: 'states',
  },
  {
    title: 'A state nothing reaches',
    body: [
      'Here is an `alarm` state. Read the note Volt has put beside it, and look at the diagram: nothing leads to it.',
    ],
    code: fixed(door(alarmState)),
    spot: ['state alarm', '-> unlocked'],
    panel: 'states',
    try: {
      at: '-> unlocked',
      hint: 'Put the cursor at the end of the highlighted `on button` line, press Return, and type it.',
      task: 'In `locked`, on a new line after the button line, add `on failures >= 3 -> alarm`.',
      answer: fixed(door(alarmState, '\n        on failures >= 3 -> alarm')),
      done: (r) => clean(r) && !said(r, /unreachable/) && /on\s+failures\s*>=\s*3\s*->\s*alarm/.test(r.source),
      after: 'The warning is gone and the diagram has a new arrow. Volt checks that every state can actually happen.',
    },
  },
  {
    title: 'Guards and actions',
    body: [
      'Square brackets add a guard: `[failures < 3]` lets the button unlock only while that’s true.',
      'A block after a transition is an action that runs as it’s taken. Here, leaving the alarm resets the count.',
    ],
    code: fixed(guarded),
    notes: [
      { line: '[failures < 3]', at: '[failures < 3]', text: 'a guard: only while true' },
      { line: 'failures = 0', at: '{ failures = 0 }', text: 'an action as it leaves' },
    ],
    spot: ['[failures < 3]', 'exit {', 'failures = 0'],
    panel: 'states',
  },
];

// ---------- Tasks ----------
const buttonsTask = (report: boolean) => `hardware {
    pin button: PullUpInput = 27
}

var presses: int = 0

task buttons {
    var last: int = 1
    every 20ms {
        let now: int = button.read()
        if now == 0 && last == 1 {
            presses += 1
        }
        last = now
    }${report ? `

    every 5s { log("buttons", "presses={presses}") }` : ''}
}
`;
const withNetwork = `${buttonsTask(true)}
task report {
    every 10s when wifi.is_connected() {
        mqtt.send_int("home/presses", presses)
    }
}

setup {
    wifi.connect("home", "secret") or retry(5)
    mqtt.connect("mqtt://broker.local") or retry(3)
}
`;

const tasks: Lesson[] = [
  {
    title: 'Keep things together',
    body: [
      'A `task` groups variables with the blocks that use them. `last` belongs to `buttons`; nothing outside the task can change it.',
      'This one counts button presses by watching for the moment the pin goes low.',
    ],
    code: fixed(buttonsTask(false)),
    notes: [
      { line: 'var last', at: 'var last', text: 'belongs to this task alone' },
    ],
    spot: ['task buttons', 'var last'],
  },
  {
    title: 'Two speeds, one task',
    body: ['A task can hold several blocks, each on its own timer.'],
    code: fixed(buttonsTask(false)),
    spot: ['task buttons'],
    try: {
      at: 'last = now',
      hint: 'Put it after the `}` that closes the 20ms block, still inside the task.',
      task: 'Inside the task, add `every 5s { log("buttons", "presses={presses}") }`.',
      answer: fixed(buttonsTask(true)),
      done: (r) => clean(r) && /every\s+5s\s*\{\s*log\(/.test(r.source),
      after: 'One block polls the button fast, the other reports slowly, and both share the task’s variables.',
    },
  },
  {
    title: 'Volt decides how tasks run',
    body: [
      'This `report` task waits on Wi-Fi, which can take seconds. Volt sees that and runs it as its own RTOS task, so a slow network never delays the button.',
      'Plain tasks share one scheduler, and `strict` blocks run from a timer. You write tasks; Volt picks the cheapest safe way to run each.',
    ],
    code: fixed(withNetwork),
    spot: ['task report', 'wifi.is_connected', 'mqtt.send_int'],
  },
];

// ---------- Sensors ----------
const sensor = (extra = '') => `hardware {
    device env: BME280
}

every 2s {
    let t: float = env.temperature()${extra}
    log("env", "temp={t}")
}
`;
const sensorBus = `hardware {
    device env: BME280 on i2c0 at 0x76
    i2c i2c0(sda: 21, scl: 22)
}

every 2s {
    let t: float = env.temperature()
    let h: float = env.humidity()
    log("env", "temp={t} humidity={h}")
}
`;

const devices: Lesson[] = [
  {
    title: 'Name the part',
    body: [
      'A `device` comes from Volt’s library of parts. Name it, and Volt picks the bus, the pins and the part’s address.',
      'The Hardware panel shows what it chose: a BME280 on I2C at address 0x76.',
    ],
    code: fixed(sensor()),
    notes: [
      { line: 'device env', at: 'device', text: 'a part from the library' },
      { line: 'device env', at: 'BME280', text: 'which part' },
    ],
    spot: ['device env', 'env.temperature'],
    panel: 'pins',
  },
  {
    title: 'Read more from it',
    body: ['Each part knows its own methods. The BME280 measures temperature, humidity and pressure.'],
    code: fixed(sensor()),
    spot: ['env.temperature'],
    try: {
      at: 'env.temperature',
      hint: 'Put the cursor at the end of the `env.temperature()` line, press Return, and type it.',
      task: 'On the next line, add `let h: float = env.humidity()`.',
      answer: fixed(sensor('\n    let h: float = env.humidity()')),
      done: (r) => clean(r) && /env\.humidity\(\)/.test(r.source),
      after: 'If you misspell a method, Volt suggests the right one and lists what the part can do.',
    },
  },
  {
    title: 'Choose the wiring yourself',
    body: [
      'When you need control, declare the bus and attach the part with `on` and `at`. The compiler checks the pins and addresses for clashes.',
    ],
    code: fixed(sensorBus),
    spot: ['device env', 'i2c i2c0'],
    panel: 'pins',
  },
];

// ---------- Storage ----------
const boots = (saved: boolean) => `storage boots: int = 0

setup {
    boots += 1${saved ? '\n    storage.save("boots", boots)' : ''}
    log("boot", "boot #{boots}")
}
`;

const storage: Lesson[] = [
  {
    title: 'Values that last',
    body: [
      'A `storage` value lives in the chip’s flash, so it survives a restart. This one counts how many times the board has started.',
      '`setup` runs once at boot, which makes it the right place to count.',
    ],
    code: fixed(boots(true)),
    notes: [
      { line: 'storage.save', at: 'storage.save', text: 'writes it to flash' },
    ],
    spot: ['storage boots', 'storage.save'],
  },
  {
    title: 'Forget to save',
    body: ['Changing a storage value only changes it in memory. Saving writes it to flash.'],
    code: fixed(boots(true)),
    spot: ['storage.save'],
    try: {
      at: 'storage.save',
      hint: 'Select the whole `storage.save` line and delete it.',
      task: 'Delete the `storage.save` line.',
      answer: fixed(boots(false)),
      done: (r) => said(r, /never saved/),
      after: 'Volt noticed: without the save, `boots` would start from zero on every power-up.',
      wantsError: true,
    },
  },
  {
    title: 'Save it again',
    body: ['Put the save back after the count changes.'],
    code: fixed(boots(false)),
    spot: ['boots += 1'],
    try: {
      at: 'boots += 1',
      hint: 'Put the cursor at the end of `boots += 1`, press Return, and type it.',
      task: 'After `boots += 1`, add `storage.save("boots", boots)`.',
      answer: fixed(boots(true)),
      done: (r) => clean(r) && !said(r, /never saved/) && /storage\.save\(\s*"boots"/.test(r.source),
      after: 'Saved. The count now survives a power cut.',
    },
  },
];

// ---------- Channels ----------
const channel = (every: string) => `channel events: int[8]

every 1s { events.send(1) }

task consumer {
    every ${every} {
        if events.has_data() {
            let e: int = events.receive()
            log("event", "got {e}")
        }
    }
}
`;

const channels: Lesson[] = [
  {
    title: 'Pass values safely',
    body: [
      'A `channel` carries values from one part of a program to another. `int[8]` holds up to eight waiting values.',
      'One block sends, a task receives. Volt handles the locking, so neither side sees a half-written value.',
    ],
    code: fixed(channel('100ms')),
    notes: [
      { line: 'channel events', at: 'int[8]', text: 'up to eight ints wait here' },
      { line: 'events.send', at: 'send', text: 'puts a value in' },
      { line: 'events.receive', at: 'receive', text: 'takes one out' },
    ],
    spot: ['channel events', 'events.send', 'events.receive'],
  },
  {
    title: 'Drain it faster',
    body: ['The consumer checks the channel ten times a second.'],
    code: fixed(channel('100ms')),
    spot: ['every 100ms'],
    try: {
      at: 'every 100ms',
      hint: 'Change `100ms` on the highlighted line.',
      task: 'Make the consumer check every `10ms`.',
      answer: fixed(channel('10ms')),
      done: (r) => clean(r) && /task consumer\s*\{\s*every\s+10ms/.test(r.source),
      after: 'Sender and receiver keep their own pace, and the channel absorbs the difference.',
    },
  },
];

// ---------- When things fail ----------
const net = (retries: number) => `hardware {
    device env: BME280
}

every 10s {
    try {
        let t: float = env.temperature()
        mqtt.send_float("home/temp", t)
    } or skip
}

setup {
    wifi.connect("home", "secret") or retry(${retries})
    mqtt.connect("mqtt://broker.local") or retry(3)
}
`;

const failures: Lesson[] = [
  {
    title: 'Say what happens on failure',
    body: [
      'Wi-Fi drops and sensors glitch. After `or` you say what to do: `retry(5)` tries again, `skip` moves on, `restart` reboots the board.',
      'The plan sits next to the call, not in error codes checked three lines later.',
    ],
    code: fixed(net(5)),
    notes: [
      { line: 'wifi.connect', at: 'or retry(5)', text: 'try again, up to five times' },
    ],
    spot: ['wifi.connect', 'mqtt.connect'],
  },
  {
    title: 'A block that can fail',
    body: [
      '`try` covers several calls at once. If reading the sensor or sending fails, `or skip` drops this round and the next one runs on time.',
    ],
    code: fixed(net(5)),
    spot: ['try {', '} or skip'],
    try: {
      at: 'wifi.connect',
      hint: 'Change the number inside `retry( )` on the Wi-Fi line.',
      task: 'Let the Wi-Fi retry `10` times instead of 5.',
      answer: fixed(net(10)),
      done: (r) => clean(r) && /wifi\.connect\([^)]*\)\s*or\s+retry\(\s*10\s*\)/.test(r.source),
      after: 'Each call carries its own plan, so how the program behaves on a bad day is written down where you can see it.',
    },
  },
];

export const courses: Course[] = [
  { id: 'tour', title: 'The tour', about: 'A lamp with a button and a saved count.', steps: tour },
  { id: 'pins', title: 'Pins and modes', about: 'What each pin can do, and how Volt keeps you to it.', steps: pins },
  { id: 'time', title: 'Time', about: 'Timers, units and conditions.', steps: time },
  { id: 'machines', title: 'State machines', about: 'Behaviour as states, with guards and actions.', steps: machines },
  { id: 'tasks', title: 'Tasks', about: 'Grouping work, and how Volt chooses how it runs.', steps: tasks },
  { id: 'devices', title: 'Sensors and parts', about: 'Use a part from the library by its name.', steps: devices },
  { id: 'storage', title: 'Storage', about: 'Values that survive a restart.', steps: storage },
  { id: 'channels', title: 'Channels', about: 'Pass values between tasks without races.', steps: channels },
  { id: 'failures', title: 'When things fail', about: 'Retries and fallbacks, written next to the call.', steps: failures },
];
