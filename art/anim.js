// Each figure has one short looping motion. animT() is where it is in the loop, 0 to 1: from ?t= when
// art/render.sh shoots a frame, otherwise from the clock, so the page plays the loop when opened directly.
const ANIM_LOOP_MS = 3600;
const ANIM_T = (() => { const v = new URLSearchParams(location.search).get('t'); return v === null ? null : Number(v); })();
// art/frames.mjs sets window.animAt and redraws to step through the loop without reloading.
const animT = () => (window.animAt ?? (ANIM_T === null ? (performance.now() % ANIM_LOOP_MS) / ANIM_LOOP_MS : ANIM_T));
// 0 before a, 1 after b, eased in between.
const animRamp = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : ease((t - a) / (b - a)));
const animPlay = (ui) => { if (ANIM_T === null) ui.animate(() => true); };
