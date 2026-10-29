// Runs the Learn Volt lessons in the column beside the editor: moves between
// steps, types each step's program into the editor, spotlights the lines it's
// about, and waits for the compiler to confirm a "your turn" step.
import type { EditorView } from '@codemirror/view';
import { lessons, spotLines, type Result } from './lessons';
import { typeTo, setSpotlight } from './editor';

type Deps = {
  view: EditorView;
  showPanel: (panel: 'pins' | 'problems' | 'states') => void;
  setEditable: (on: boolean) => void;
  openExamples: () => void;
  store: { get(k: string): string | null; set(k: string, v: string): void };
};

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));

export function tutorial(d: Deps) {
  const panel = $('#lesson');
  const split = $('#split');
  const content = $('#lesson-content');
  const bar = $('#lesson-progress');
  const stepLabel = $('#lesson-step');
  const back = $<HTMLButtonElement>('#lesson-back');
  const next = $<HTMLButtonElement>('#lesson-next');

  let index = 0;
  let isOpen = false;
  let met = false;
  let busy = 0;

  function render(i: number) {
    const l = lessons[i];
    const frag = document.createDocumentFragment();
    const h = document.createElement('h2');
    h.className = 'lesson-title';
    h.textContent = l.title;
    frag.append(h);
    for (const text of l.body) {
      const p = document.createElement('p');
      p.className = 'lesson-text';
      p.append(...withCode(text));
      frag.append(p);
    }
    if (l.try) {
      const box = document.createElement('div');
      box.className = 'try';
      box.id = 'lesson-try';
      const head = document.createElement('div');
      head.className = 'try-head';
      head.innerHTML =
        '<svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" /><path d="M6 10.4 8.7 13 14 7.4" /></svg>';
      const task = document.createElement('p');
      task.className = 'try-task';
      task.append(...withCode(l.try.task));
      head.append(task);
      const show = document.createElement('button');
      show.type = 'button';
      show.className = 'quiet try-show';
      show.textContent = 'Show me';
      show.addEventListener('click', async () => {
        show.disabled = true;
        await typeTo(d.view, l.try!.answer(lampPin()), 500);
      });
      const slip = document.createElement('p');
      slip.className = 'try-slip';
      slip.id = 'lesson-slip';
      const after = document.createElement('p');
      after.className = 'try-after';
      after.append(...withCode(l.try.after));
      box.append(head, show, slip, after);
      frag.append(box);
    }
    if (l.recap) {
      const list = document.createElement('dl');
      list.className = 'recap';
      for (const r of l.recap) {
        const dt = document.createElement('dt');
        const c = document.createElement('code');
        c.textContent = r.word;
        dt.append(c);
        const dd = document.createElement('dd');
        dd.textContent = r.meaning;
        list.append(dt, dd);
      }
      frag.append(list);
      const row = document.createElement('div');
      row.className = 'finish';
      const ide = document.createElement('a');
      ide.className = 'solid';
      ide.href = 'https://voltembedded.com/#download';
      ide.textContent = 'Get Volt IDE';
      const ex = document.createElement('button');
      ex.type = 'button';
      ex.className = 'quiet';
      ex.textContent = 'Open an example';
      ex.addEventListener('click', () => {
        close(true);
        d.openExamples();
      });
      row.append(ide, ex);
      frag.append(row);
    }
    content.replaceChildren(frag);
  }

  async function go(i: number) {
    const run = ++busy;
    index = Math.max(0, Math.min(i, lessons.length - 1));
    d.store.set('volt-play:lesson', String(index));
    const l = lessons[index];
    met = false;

    content.classList.add('is-leaving');
    await wait(150);
    if (run !== busy) return;
    render(index);
    stepLabel.textContent = `${index + 1} of ${lessons.length}`;
    bar.style.transform = `scaleX(${(index + 1) / lessons.length})`;
    back.disabled = index === 0;
    next.textContent = l.recap ? 'Done' : index === 0 ? 'Start' : 'Continue';
    next.disabled = !!l.try;
    next.classList.remove('is-ready');
    content.classList.remove('is-leaving');

    d.view.dispatch({ effects: setSpotlight.of([]) });
    d.view.dom.classList.toggle('is-preview', !!l.preview);
    if (l.panel) d.showPanel(l.panel);
    d.setEditable(false);
    const code = l.code(lampPin());
    await typeTo(d.view, code, l.preview ? 0 : 1100);
    if (run !== busy) return;
    d.setEditable(true);
    d.view.dispatch({ effects: setSpotlight.of(spotLines(code, l.spot)) });
    if (l.try) d.view.focus();
    else next.focus({ preventScroll: true });
  }

  // Called after every check, so a "your turn" step notices when it's done.
  function result(r: Result) {
    const l = lessons[index];
    if (!isOpen || !l?.try || met || busy === 0) return;
    const slip = document.querySelector<HTMLElement>('#lesson-slip');
    if (!l.try.done(r)) {
      // A typo shouldn't leave someone stuck: point at it.
      const err = l.try.wantsError ? undefined : r.diags.find((d) => d.severity === 'error');
      if (slip) slip.textContent = err ? `Not quite yet: there’s an error on line ${err.line}. Its message is in the editor.` : '';
      return;
    }
    if (slip) slip.textContent = '';
    met = true;
    $('#lesson-try')?.classList.add('is-met');
    next.disabled = false;
    next.classList.add('is-ready');
    d.view.dispatch({ effects: setSpotlight.of([]) });
    d.view.dom.classList.add('is-confirmed');
    setTimeout(() => d.view.dom.classList.remove('is-confirmed'), 900);
  }

  // The lamp's pin as the visitor has it now; 2 until they choose.
  function lampPin(): number {
    const m = d.view.state.doc.toString().match(/pin\s+lamp\s*=\s*(\d+)/);
    const n = m ? Number(m[1]) : 2;
    return [6, 7, 8, 9, 10, 11].includes(n) ? 2 : n;
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    // The visitor's own program comes back if they leave part way through.
    d.store.set('volt-play:before-lesson', d.view.state.doc.toString());
    panel.hidden = false;
    requestAnimationFrame(() => split.classList.add('is-learning'));
    $('#learn').setAttribute('aria-pressed', 'true');
    go(Number(d.store.get('volt-play:lesson')) || 0);
  }

  function close(keep = false) {
    if (!isOpen) return;
    isOpen = false;
    busy++;
    split.classList.remove('is-learning');
    $('#learn').setAttribute('aria-pressed', 'false');
    d.setEditable(true);
    d.view.dispatch({ effects: setSpotlight.of([]) });
    d.view.dom.classList.remove('is-preview');
    setTimeout(() => {
      if (!isOpen) panel.hidden = true;
    }, reduced() ? 0 : 460);
    const before = d.store.get('volt-play:before-lesson');
    if (!keep && before !== null) typeTo(d.view, before, 0);
    if (lessons[index].recap) d.store.set('volt-play:lesson', '0');
    d.view.focus();
  }

  $('#learn').addEventListener('click', () => (isOpen ? close() : open()));
  $('#lesson-close').addEventListener('click', () => close());
  back.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => (lessons[index].recap ? close(true) : go(index + 1)));
  document.addEventListener('keydown', (e) => {
    if (!isOpen || (e.target as HTMLElement).closest('.cm-editor, input, textarea')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' && !next.disabled) next.click();
    else if (e.key === 'ArrowLeft' && !back.disabled) back.click();
    else return;
    e.preventDefault();
  });

  return { open, close, result, get isOpen() {
    return isOpen;
  } };
}

// Lesson text marks code with backticks: `every`.
function withCode(text: string): Node[] {
  return text.split('`').map((part, i) => {
    if (i % 2 === 0) return document.createTextNode(part);
    const c = document.createElement('code');
    c.textContent = part;
    return c;
  });
}
