import './style.css';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { cpp } from '@codemirror/lang-cpp';
import { loadCompiler, type Compiler, type Diagnostic } from './compiler';
import { createEditor, replaceDoc, jumpTo, setProblems, setLinkedLine } from './editor';
import { highlight } from './language';
import { renderHardware, markRow, type PinState, type DeviceState } from './pinout';
import { examplesMenu } from './menu';
import { examples } from './examples';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

// Small wrappers so a browser that refuses storage still works.
const saved = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Nothing to do: the setting just isn't remembered.
    }
  },
};

// Shared links carry the program in the URL fragment, deflated and
// base64url-encoded, so nothing is stored on a server.
async function encode(src: string): Promise<string> {
  const stream = new Blob([src]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function decode(code: string): Promise<string> {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

let linkNotice = '';
async function firstProgram(): Promise<string> {
  const m = location.hash.match(/^#code=(.+)$/);
  if (m) {
    try {
      return await decode(m[1]);
    } catch {
      linkNotice = "The shared link was damaged, so the Blink example is open instead.";
      return examples[0].source;
    }
  }
  return saved.get('volt-play:source') ?? examples[0].source;
}

// ---------- status bar ----------
const stateEl = $('#state');
const stateText = $('#state-text');
const timing = $('#timing');
function setStatus(kind: 'loading' | 'ok' | 'warning' | 'error', text: string, ms?: number) {
  stateEl.dataset.kind = kind;
  stateText.textContent = text;
  timing.textContent = ms === undefined ? '' : `Checked in ${ms} ms`;
}

// ---------- editor ----------
let compiler: Compiler | null = null;
let timer = 0;
let linkedLines = new Set<number>();

const view = createEditor({
  parent: $('#editor'),
  doc: await firstProgram(),
  onChange() {
    clearTimeout(timer);
    timer = window.setTimeout(check, 120);
  },
  onCursorLine(line) {
    markRow($('#panel-pins'), linkedLines.has(line) ? line : null);
  },
  onFormat: format,
});

// ---------- tabs ----------
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
function selectTab(tab: HTMLButtonElement, focus = false) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
  }
  if (focus) tab.focus();
  saved.set('volt-play:tab', tab.id);
  if (tab.id === 'tab-states') drawStates();
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    selectTab(tabs[(next + tabs.length) % tabs.length], true);
  });
});
const savedTab = tabs.find((t) => t.id === saved.get('volt-play:tab'));
if (savedTab) selectTab(savedTab);

// ---------- generated C (read-only) ----------
const cView = new EditorView({
  parent: $('#c-view'),
  state: EditorState.create({
    doc: '',
    extensions: [lineNumbers(), cpp(), highlight, EditorState.readOnly.of(true), EditorView.editable.of(false)],
  }),
});
let cText = '';
function showC(text: string) {
  if (text === cText) return;
  cText = text;
  cView.dispatch({ changes: { from: 0, to: cView.state.doc.length, insert: text } });
}
const copyC = $<HTMLButtonElement>('#copy-c');
copyC.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(cText);
    copyC.textContent = 'Copied';
  } catch {
    copyC.textContent = 'Select the code to copy it';
  }
  setTimeout(() => (copyC.textContent = 'Copy'), 1600);
});

// ---------- checking ----------
// The line declaring each pin or device, by name.
function declLines(src: string, keyword: 'pin' | 'device'): Map<string, number> {
  const lines = new Map<string, number>();
  const re = new RegExp(`^\\s*${keyword}\\s+([A-Za-z_]\\w*)`);
  src.split('\n').forEach((text, i) => {
    const m = text.match(re);
    if (m && !lines.has(m[1])) lines.set(m[1], i + 1);
  });
  return lines;
}

function check() {
  if (!compiler) return;
  const src = view.state.doc.toString();
  saved.set('volt-play:source', src);
  const t0 = performance.now();
  const res = compiler.compile(src);
  const ms = Math.max(1, Math.round(performance.now() - t0));
  if (res.error) {
    setStatus('error', `The compiler stopped on this program: ${res.error}`);
    return;
  }
  const diags = res.diagnostics ?? [];
  const errors = diags.filter((d) => d.severity === 'error').length;
  const warnings = diags.length - errors;

  view.dispatch({ effects: setProblems.of(diags) });
  renderProblems(diags);

  const at = (line: number) => diags.filter((d) => d.line === line);
  const pinDecl = declLines(src, 'pin');
  const devDecl = declLines(src, 'device');
  const pins: PinState[] = (res.pins ?? []).map((pin) => {
    const line = pinDecl.get(pin.name) ?? 1;
    return { pin, line, problems: at(line) };
  });
  const devices: DeviceState[] = (res.devices ?? []).map((device) => {
    const line = devDecl.get(device.name) ?? 1;
    return { device, line, problems: at(line) };
  });
  linkedLines = new Set([...pins, ...devices].map((u) => u.line));
  renderHardware($('#panel-pins'), pins, devices, {
    hover: (line) => view.dispatch({ effects: setLinkedLine.of(line) }),
    open: (line) => jumpTo(view, line),
  });


  showC(errors ? '' : res.c_code);
  $('#panel-c').classList.toggle('is-empty', errors > 0);
  statesStale = true;
  if (!$('#panel-states').hidden) drawStates();

  $('#problem-count').textContent = diags.length ? String(diags.length) : '';
  const say = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (errors) setStatus('error', warnings ? `${say(errors, 'error')}, ${say(warnings, 'warning')}` : say(errors, 'error'), ms);
  else if (warnings) setStatus('warning', say(warnings, 'warning'), ms);
  else setStatus('ok', 'Ready to build for the ESP32', ms);
}

function renderProblems(diags: Diagnostic[]) {
  const panel = $('#panel-problems');
  if (!diags.length) {
    const p = document.createElement('p');
    p.className = 'aside';
    p.textContent = 'No problems. Every pin and device fits the ESP32.';
    panel.replaceChildren(p);
    return;
  }
  const list = document.createElement('ol');
  list.className = 'problems';
  for (const d of diags) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = d.severity === 'error' ? 'is-error' : 'is-warning';
    const where = document.createElement('span');
    where.className = 'where';
    where.textContent = `Line ${d.line}`;
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = d.message;
    b.append(where, msg);
    if (d.hint) {
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = d.hint;
      b.append(hint);
    }
    b.addEventListener('click', () => jumpTo(view, d.line, d.col));
    li.append(b);
    list.append(li);
  }
  panel.replaceChildren(list);
}

// ---------- state machines ----------
let statesStale = true;
let mermaid: typeof import('mermaid').default | null = null;
let drawSeq = 0;
async function drawStates() {
  if (!compiler || !statesStale) return;
  statesStale = false;
  const panel = $('#panel-states');
  const machines = compiler.states(view.state.doc.toString()).machines ?? [];
  if (!machines.length) {
    const p = document.createElement('p');
    p.className = 'aside';
    p.textContent = 'This program has no state machines. The State machine and Elevator examples have one.';
    panel.replaceChildren(p);
    return;
  }
  const seq = ++drawSeq;
  if (!mermaid) mermaid = (await import('mermaid')).default;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    fontFamily: 'Chivo, system-ui, sans-serif',
    themeVariables: {
      background: v('--sheet'),
      primaryColor: v('--sheet'),
      primaryBorderColor: v('--line-strong'),
      primaryTextColor: v('--ink'),
      lineColor: v('--muted'),
      textColor: v('--muted'),
      fontSize: '13px',
      labelBackgroundColor: v('--paper'),
      edgeLabelBackground: v('--paper'),
    },
  });
  const figures: HTMLElement[] = [];
  for (const [i, m] of machines.entries()) {
    const fig = document.createElement('figure');
    const cap = document.createElement('figcaption');
    cap.textContent = m.name;
    fig.append(cap);
    try {
      const { svg } = await mermaid.render(`machine-${seq}-${i}`, m.mermaid);
      fig.insertAdjacentHTML('beforeend', svg);
    } catch {
      const p = document.createElement('p');
      p.className = 'aside';
      p.textContent = "This machine couldn't be drawn.";
      fig.append(p);
    }
    figures.push(fig);
  }
  if (seq === drawSeq) panel.replaceChildren(...figures);
}

// ---------- actions ----------
function format() {
  if (!compiler) return;
  const res = compiler.format(view.state.doc.toString());
  if (res.code === undefined) {
    setStatus('error', 'Fix the errors first, then format');
    return;
  }
  if (res.code !== view.state.doc.toString()) {
    const head = view.state.selection.main.head;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: res.code }, selection: { anchor: Math.min(head, res.code.length) } });
  }
}
$('#format').addEventListener('click', () => {
  format();
  view.focus();
});

const share = $<HTMLButtonElement>('#share');
share.addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#code=${await encode(view.state.doc.toString())}`;
  window.history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    share.textContent = 'Link copied';
  } catch {
    share.textContent = 'Link is in the address bar';
  }
  setTimeout(() => (share.textContent = 'Share'), 1800);
});

examplesMenu($('#examples'), examples, (ex) => {
  replaceDoc(view, ex.source);
  window.history.replaceState(null, '', location.pathname);
  view.focus();
});

// ---------- resizable split ----------
const split = $('#split');
const divider = $('#divider');
function setSplit(pct: number) {
  const clamped = Math.min(75, Math.max(35, pct));
  split.style.setProperty('--code', `${clamped}%`);
  divider.setAttribute('aria-valuenow', String(Math.round(clamped)));
  saved.set('volt-play:split', String(clamped));
}
setSplit(Number(saved.get('volt-play:split')) || 60);
divider.setAttribute('aria-valuemin', '35');
divider.setAttribute('aria-valuemax', '75');
divider.addEventListener('pointerdown', (e) => {
  divider.setPointerCapture(e.pointerId);
  split.classList.add('is-resizing');
  const rect = split.getBoundingClientRect();
  const move = (ev: PointerEvent) => setSplit(((ev.clientX - rect.left) / rect.width) * 100);
  const up = () => {
    split.classList.remove('is-resizing');
    divider.removeEventListener('pointermove', move);
    divider.removeEventListener('pointerup', up);
  };
  divider.addEventListener('pointermove', move);
  divider.addEventListener('pointerup', up);
});
divider.addEventListener('keydown', (e) => {
  const now = Number(divider.getAttribute('aria-valuenow'));
  if (e.key === 'ArrowLeft') setSplit(now - 2);
  else if (e.key === 'ArrowRight') setSplit(now + 2);
  else return;
  e.preventDefault();
});
divider.addEventListener('dblclick', () => setSplit(60));

// ---------- start ----------
setStatus('loading', 'Loading the compiler');
try {
  compiler = await loadCompiler();
  check();
  if (linkNotice) setStatus('warning', linkNotice);
} catch {
  setStatus('error', "The compiler didn't load. Check your connection and reload the page.");
}
