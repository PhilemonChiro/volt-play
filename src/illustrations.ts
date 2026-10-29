// One small drawing per course, in a single style: 2px rounded strokes in
// the tile's colour on a 160x90 canvas, with soft fills from the same colour.
// `c` is the stroke, `f` a light fill.
const svg = (body: string) =>
  `<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const F = 'fill="currentColor" fill-opacity="0.16"';

export const illustrations: Record<string, string> = {
  // A lamp and the button that switches it on.
  tour: svg(`
    <path d="M62 24a16 16 0 0 1 9 29v7h-18v-7a16 16 0 0 1 9-29z" ${F}/>
    <path d="M55 66h14M57 71h10"/>
    <path d="M62 14v-4M44 22l-3-3M80 22l3-3M38 38h-4M86 38h4" opacity="0.7"/>
    <rect x="102" y="44" width="24" height="24" rx="5" ${F}/>
    <circle cx="114" cy="56" r="6.5"/>
    <path d="M71 60h18a6 6 0 0 0 6-6v-2a6 6 0 0 1 6-6" opacity="0.5" stroke-dasharray="3 4"/>`),
  // A header of pins, one of them chosen.
  pins: svg(`
    <rect x="22" y="34" width="116" height="22" rx="5" ${F}/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${34 + i * 15.3}" cy="45" r="3.5" ${i === 4 ? 'fill="currentColor"' : ''}/>`).join('')}
    <path d="M95 34V20h14" />
    <circle cx="113" cy="20" r="3"/>`),
  // Timer ticks along a line: two rhythms side by side.
  time: svg(`
    <path d="M18 34h124M18 62h124" opacity="0.35"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${30 + i * 32}" y="25" width="5" height="18" rx="2.5" fill="currentColor" stroke="none"/>`).join('')}
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<rect x="${24 + i * 12.4}" y="55" width="4" height="14" rx="2" ${F} stroke="none"/>`).join('')}`),
  // Two states and the arrows between them.
  machines: svg(`
    <rect x="18" y="30" width="46" height="30" rx="10" ${F}/>
    <rect x="96" y="30" width="46" height="30" rx="10" ${F}/>
    <path d="M66 38c10-8 20-8 28 0"/><path d="M89 33l5 5-6 3"/>
    <path d="M94 52c-10 8-20 8-28 0"/><path d="M71 57l-5-5 6-3"/>
    <circle cx="41" cy="45" r="4" fill="currentColor" stroke="none"/>`),
  // Lanes of work, each on its own beat.
  tasks: svg(`
    <path d="M20 26h120M20 45h120M20 64h120" opacity="0.3"/>
    <rect x="28" y="20" width="22" height="12" rx="4" ${F}/><rect x="80" y="20" width="22" height="12" rx="4" ${F}/>
    <rect x="44" y="39" width="40" height="12" rx="4" fill="currentColor" fill-opacity="0.35"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${26 + i * 24}" y="58" width="10" height="12" rx="3" ${F}/>`).join('')}`),
  // A sensor chip on its legs, reading the air.
  devices: svg(`
    <rect x="56" y="28" width="38" height="38" rx="6" ${F}/>
    ${[0, 1, 2].map((i) => `<path d="M${64 + i * 11} 28v-7M${64 + i * 11} 66v7"/>`).join('')}
    ${[0, 1, 2].map((i) => `<path d="M56 ${36 + i * 11}h-7M94 ${36 + i * 11}h7"/>`).join('')}
    <circle cx="75" cy="47" r="6"/>
    <path d="M112 30c6 5 6 12 0 17M120 24c10 9 10 22 0 31" opacity="0.6"/>`),
  // Memory that keeps what's written to it.
  storage: svg(`
    <ellipse cx="80" cy="28" rx="30" ry="9" ${F}/>
    <path d="M50 28v34c0 5 13 9 30 9s30-4 30-9V28"/>
    <path d="M50 45c0 5 13 9 30 9s30-4 30-9" opacity="0.6"/>
    <path d="M118 52l8 8 14-16" stroke-width="2.5"/>`),
  // Values moving through a pipe from one side to the other.
  channels: svg(`
    <rect x="14" y="32" width="26" height="26" rx="6" ${F}/>
    <rect x="120" y="32" width="26" height="26" rx="6" ${F}/>
    <path d="M44 37h72M44 53h72"/>
    ${[0, 1, 2, 3].map((i) => `<circle cx="${56 + i * 16}" cy="45" r="4" fill="currentColor" fill-opacity="${0.3 + i * 0.2}" stroke="none"/>`).join('')}`),
  // Trying again: a loop around a signal.
  failures: svg(`
    <path d="M104 30a28 28 0 1 0 6 21"/><path d="M110 22v10h-10"/>
    <path d="M70 52a14 14 0 0 1 20 0M64 46a22 22 0 0 1 32 0" opacity="0.8"/>
    <circle cx="80" cy="58" r="3" fill="currentColor" stroke="none"/>`),
};

// Each course's colour, as a hue; the tile mixes it with the page's tokens.
export const hues: Record<string, number> = {
  tour: 205,
  pins: 32,
  time: 265,
  machines: 168,
  tasks: 340,
  devices: 130,
  storage: 45,
  channels: 190,
  failures: 0,
};
