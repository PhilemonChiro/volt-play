import './style.css';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentUnit, bracketMatching } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { setDiagnostics, lintGutter, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { voltLanguage } from './language';
import { loadCompiler, type Diagnostic } from './compiler';
import { examples } from './examples';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const status = $('#status');
const problems = $('#panel-problems');
const cCode = $('#panel-c code');
const statesPanel = $('#panel-states');

// The program comes from a shared link, else the visitor's last session,
// else the first example.
const STORE = 'volt-play-source';
function stored(): string | null {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
}
function store(src: string) {
  try {
    localStorage.setItem(STORE, src);
  } catch {
    // Private windows can refuse storage; the program just isn't remembered.
  }
}

// Shared links carry the program in the URL fragment, deflated and base64url
// encoded, so nothing is stored on a server.
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
async function initialSource(): Promise<string> {
  const m = location.hash.match(/^#code=(.+)$/);
  if (m) {
    try {
      return await decode(m[1]);
    } catch {
      status.textContent = "That link's program couldn't be read, so an example is open instead.";
    }
  }
  return stored() ?? examples[0].source;
}

const view = new EditorView({
  parent: $('#editor'),
  state: EditorState.create({
    doc: await initialSource(),
    extensions: [
      lineNumbers(),
      lintGutter(),
      history(),
      drawSelection(),
      highlightActiveLine(),
      bracketMatching(),
      indentUnit.of('    '),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      voltLanguage,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) schedule();
      }),
    ],
  }),
});

// Examples.
const picker = $<HTMLSelectElement>('#example');
picker.append(new Option('Open an example…', ''));
for (const ex of examples) picker.append(new Option(ex.name, ex.id));
picker.addEventListener('change', () => {
  const ex = examples.find((e) => e.id === picker.value);
  if (ex) setSource(ex.source);
  picker.value = '';
});

function setSource(src: string) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: src } });
  view.focus();
}

// Tabs.
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    }
    if (tab.id === 'tab-states') renderStates();
  });
}

const compiler = await loadCompiler().catch((e: Error) => {
  status.textContent = `The compiler didn't load: ${e.message}. Reload the page to try again.`;
  throw e;
});

// Compile shortly after typing stops; a compile takes a few milliseconds.
let timer = 0;
function schedule() {
  clearTimeout(timer);
  timer = window.setTimeout(run, 150);
}

function offset(line: number, col: number): number {
  const doc = view.state.doc;
  const l = doc.line(Math.min(Math.max(line, 1), doc.lines));
  return Math.min(l.from + Math.max(col - 1, 0), l.to);
}

function run() {
  const src = view.state.doc.toString();
  store(src);
  const t0 = performance.now();
  const res = compiler.compile(src);
  const ms = Math.max(1, Math.round(performance.now() - t0));
  if (res.error) {
    status.textContent = `The compiler stopped: ${res.error}`;
    return;
  }
  const diags: Diagnostic[] = res.diagnostics ?? [];
  const errors = diags.filter((d) => d.severity === 'error').length;
  const warnings = diags.length - errors;

  view.dispatch(
    setDiagnostics(
      view.state,
      diags.map((d): CmDiagnostic => {
        const from = offset(d.line, d.col);
        const to = d.end_line ? offset(d.end_line, d.end_col ?? d.col) : view.state.doc.line(Math.min(d.line, view.state.doc.lines)).to;
        return {
          from,
          to: Math.max(to, from),
          severity: d.severity === 'error' ? 'error' : 'warning',
          message: d.hint ? `${d.message}\n${d.hint}` : d.message,
        };
      }),
    ),
  );

  renderProblems(diags);
  cCode.textContent = errors ? '// Fix the problems to see the C Volt generates.' : res.c_code;
  statesDirty = true;
  if (!statesPanel.hidden) renderStates();

  const parts = [errors ? `${errors} ${errors === 1 ? 'error' : 'errors'}` : 'No errors'];
  if (warnings) parts.push(`${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`);
  status.textContent = `${parts.join(', ')}. Checked against the ESP32 in ${ms} ms.`;
  $('#tab-problems').textContent = diags.length ? `Problems (${diags.length})` : 'Problems';
}

function renderProblems(diags: Diagnostic[]) {
  problems.replaceChildren();
  if (!diags.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No problems. Every pin and device checks out for the ESP32.';
    problems.append(p);
    return;
  }
  const list = document.createElement('ul');
  for (const d of diags) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `problem ${d.severity === 'error' ? 'error' : 'warning'}`;
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
    b.addEventListener('click', () => {
      const pos = offset(d.line, d.col);
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      view.focus();
    });
    li.append(b);
    list.append(li);
  }
  problems.append(list);
}

// State machine diagrams, drawn with Mermaid, loaded the first time the tab opens.
let statesDirty = true;
let mermaid: typeof import('mermaid').default | null = null;
async function renderStates() {
  if (!statesDirty) return;
  statesDirty = false;
  const res = compiler.states(view.state.doc.toString());
  const machines = res.machines ?? [];
  if (!machines.length) {
    statesPanel.innerHTML = '<p class="empty">This program has no state machines. Open the State machine example to see one.</p>';
    return;
  }
  if (!mermaid) {
    statesPanel.innerHTML = '<p class="empty">Drawing…</p>';
    mermaid = (await import('mermaid')).default;
  }
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral', fontFamily: 'Chivo, system-ui, sans-serif' });
  const out: HTMLElement[] = [];
  for (const [i, m] of machines.entries()) {
    const fig = document.createElement('figure');
    const cap = document.createElement('figcaption');
    cap.textContent = m.name;
    try {
      const { svg } = await mermaid.render(`machine-${i}-${Date.now()}`, m.mermaid);
      fig.innerHTML = svg;
    } catch {
      fig.textContent = "This machine couldn't be drawn.";
    }
    fig.prepend(cap);
    out.push(fig);
  }
  statesPanel.replaceChildren(...out);
}

// Format.
$('#format').addEventListener('click', () => {
  const res = compiler.format(view.state.doc.toString());
  if (res.code !== undefined) setSource(res.code);
  else status.textContent = `Fix the errors before formatting: ${res.error}`;
});

// Copy a link that opens this program.
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
  setTimeout(() => (share.textContent = 'Copy link'), 1800);
});

run();
