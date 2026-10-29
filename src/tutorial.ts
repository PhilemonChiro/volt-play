// Runs Learn Volt beside the editor: a list of courses, then each course's
// steps. A step types its program into the editor, spotlights the lines it's
// about, and labels the words that matter. A "your turn" step puts its task
// in a card under the line to change, and waits for the compiler to confirm.
import type { EditorView } from '@codemirror/view';
import type { StateEffect } from '@codemirror/state';
import { spotLines, type Course, type Lesson, type Result } from './lessons';
import { courses } from './courses';
import { typeTo, setSpotlight, setNotes, setCallout, type Note } from './editor';
import { renderTimeline } from './timeline';
import { hues } from './illustrations';
// Where each course image's labels point, measured when the images were rendered.
import labelSpots from './learn-labels.json';

type Panel = 'pins' | 'problems' | 'states';
type Deps = {
  view: EditorView;
  showPanel: (panel: Panel) => void;
  // Shows or folds away the results pane while learning.
  showSide: (on: boolean) => void;
  // Shows the state diagram under the code.
  showFigure: (on: boolean) => void;
  setEditable: (on: boolean) => void;
  openExamples: () => void;
  store: { get(k: string): string | null; set(k: string, v: string): void };
};

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const TICK =
  '<svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" /><path d="M6 10.4 8.7 13 14 7.4" /></svg>';

export function tutorial(d: Deps) {
  const panel = $('#lesson');
  const split = $('#split');
  const content = $('#lesson-content');
  const bar = $('#lesson-progress');
  const stepLabel = $('#lesson-step');
  const back = $<HTMLButtonElement>('#lesson-back');
  const next = $<HTMLButtonElement>('#lesson-next');
  const toList = $<HTMLButtonElement>('#lesson-courses');
  const foot = $('#lesson-foot');
  const strip = $('#timeline');

  let course: Course | null = null;
  let index = 0;
  let isOpen = false;
  let met = false;
  let busy = 0;
  let callout: HTMLElement | null = null;
  let showMeTimer = 0;

  const done = (): Set<string> => {
    try {
      return new Set(JSON.parse(d.store.get('volt-play:done') ?? '[]'));
    } catch {
      return new Set();
    }
  };
  const markDone = (id: string) => d.store.set('volt-play:done', JSON.stringify([...done(), id]));

  function clearCode() {
    d.view.dispatch({ effects: [setSpotlight.of([]), setNotes.of([]), setCallout.of(null)] });
    d.view.dom.classList.remove('is-preview');
    callout = null;
    clearTimeout(showMeTimer);
    strip.hidden = true;
    d.showFigure(false);
  }

  // ---------- the course window ----------
  const sheet = $('#learn-sheet');
  const grid = $('#ls-grid');
  const stepsSeen = (id: string) => Number(d.store.get(`volt-play:steps:${id}`)) || 0;

  function showSheet() {
    busy++;
    // Remembered before it's cleared, so the gallery can offer to continue it.
    const inProgress = course?.id ?? d.store.get('volt-play:course');
    course = null;
    clearCode();
    split.classList.remove('is-learning');
    panel.hidden = true;
    d.setEditable(true);

    const finished = done();
    const next = courses.find((c) => !finished.has(c.id)) ?? courses[0];
    $('#ls-sub').textContent = finished.size
      ? `${finished.size} of ${courses.length} courses done`
      : `${courses.length} short courses, each on one idea`;
    grid.replaceChildren(
      ...courses.map((c) => {
        const li = el('li');
        const b = el('button', 'ls-tile');
        b.type = 'button';
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', String(c === next));
        const isDone = finished.has(c.id);
        if (isDone) b.classList.add('is-done');
        b.style.setProperty('--hue', String(hues[c.id] ?? 205));
        const art = el('span', 'ls-art');
        const img = el('img') as HTMLImageElement;
        img.src = `/learn/${c.id}.webp`;
        img.alt = '';
        img.decoding = 'async';
        art.append(img);
        for (const spot of (labelSpots as Record<string, { x: number; y: number; text: string; tone?: string }[]>)[c.id] ?? []) {
          const tag = el('span', `ls-tag${spot.tone ? ` is-${spot.tone}` : ''}${spot.x > 0.6 ? ' is-flip' : ''}`, spot.text);
          tag.style.setProperty('--n', String(art.querySelectorAll('.ls-tag').length));
          tag.style.left = `${spot.x * 100}%`;
          tag.style.top = `${spot.y * 100}%`;
          art.append(tag);
        }
        const body = el('span', 'ls-body');
        const resumeAt = c.id === inProgress ? Number(d.store.get('volt-play:lesson')) || 0 : 0;
        const seen = isDone ? c.steps.length : Math.min(stepsSeen(c.id), c.steps.length);
        const state = isDone
          ? 'Done'
          : resumeAt
            ? `Continue, ${seen} of ${c.steps.length} steps`
            : c === next && finished.size
              ? `Up next, ${c.steps.length} steps`
              : seen
                ? `${seen} of ${c.steps.length} steps`
                : `${c.steps.length} steps`;
        body.append(el('span', 'ls-name', c.title), el('span', 'ls-about', c.about), el('span', 'ls-state', state));
        b.append(art, body);

        b.addEventListener('click', () => start(c, resumeAt));
        li.append(b);
        return li;
      }),
    );
    sheet.hidden = false;
    document.body.classList.add('is-gallery');
    grid.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
  }

  function hideSheet() {
    sheet.hidden = true;
    document.body.classList.remove('is-gallery');
  }

  // Arrow keys move between tiles, in reading order and by row.
  grid.addEventListener('keydown', (e) => {
    const tiles = [...grid.querySelectorAll<HTMLButtonElement>('.ls-tile')];
    const i = tiles.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const t = tiles[Math.max(0, Math.min(tiles.length - 1, to))];
    tiles.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    t.focus();
  });

  function start(c: Course, at = 0) {
    course = c;
    hideSheet();
    panel.hidden = false;
    requestAnimationFrame(() => split.classList.add('is-learning'));
    d.store.set('volt-play:course', c.id);
    toList.hidden = false;
    foot.hidden = false;
    go(at);
  }

  // ---------- one step ----------
  function renderColumn(c: Course, i: number) {
    const l = c.steps[i];
    const frag = document.createDocumentFragment();
    frag.append(el('h2', 'lesson-title', l.title));
    for (const text of l.body) {
      const p = el('p', 'lesson-text');
      p.append(...withCode(text));
      frag.append(p);
    }
    if (l.try) {
      // The task itself is in the editor; this just says where.
      const turn = el('p', 'turn');
      turn.id = 'lesson-turn';
      turn.innerHTML = TICK;
      turn.append(el('span', 'turn-text', 'Your turn, in the editor'));
      frag.append(turn);
    }
    if (l.recap) {
      const list = el('dl', 'recap');
      for (const r of l.recap) {
        const dt = el('dt');
        dt.append(el('code', '', r.word));
        list.append(dt, el('dd', '', r.meaning));
      }
      frag.append(list);
    }
    if (i === c.steps.length - 1) {
      const nextCourse = courses[courses.indexOf(c) + 1];
      frag.append(
        el('p', 'lesson-text next-step', 'To run it, Volt IDE builds your program and flashes it to an ESP32 over USB, with the same checks as you type.'),
      );
      const row = el('div', 'finish');
      if (nextCourse) {
        const nb = el('button', 'solid', `Next: ${nextCourse.title}`);
        nb.type = 'button';
        nb.addEventListener('click', () => {
          markDone(c.id);
          start(nextCourse);
        });
        row.append(nb);
      }
      const get = el('a', nextCourse ? 'quiet' : 'solid', 'Get Volt IDE') as HTMLAnchorElement;
      get.href = 'https://voltembedded.com/#download';
      row.append(get);
      frag.append(row);
    }
    content.replaceChildren(frag);
  }

  // The "your turn" card that sits in the code.
  function buildCallout(l: Lesson): HTMLElement {
    const t = l.try!;
    const card = el('div', 'callout');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', 'Your turn');
    const head = el('div', 'callout-head');
    head.innerHTML = TICK;
    const task = el('p', 'callout-task');
    task.append(...withCode(t.task));
    head.append(task);
    const row = el('div', 'callout-actions');
    const hintBtn = el('button', 'callout-link', 'Hint');
    hintBtn.type = 'button';
    const show = el('button', 'callout-link callout-show', 'Show me');
    show.type = 'button';
    show.hidden = true;
    row.append(hintBtn, show);
    const hint = el('p', 'callout-hint');
    hint.hidden = true;
    hint.append(...withCode(t.hint));
    const slip = el('p', 'callout-slip');
    const after = el('p', 'callout-after');
    const afterText = el('span');
    afterText.append(...withCode(t.after));
    after.append(afterText);
    hintBtn.addEventListener('mousedown', (e) => e.preventDefault());
    hintBtn.addEventListener('click', () => {
      hint.hidden = false;
      hintBtn.hidden = true;
      // After a hint, the answer is one more click away.
      clearTimeout(showMeTimer);
      showMeTimer = window.setTimeout(() => (show.hidden = false), reduced() ? 0 : 6000);
    });
    show.addEventListener('mousedown', (e) => e.preventDefault());
    show.addEventListener('click', async () => {
      show.disabled = true;
      await typeTo(d.view, t.answer(lampPin()), 500);
    });
    card.append(head, row, hint, slip, after);
    return card;
  }

  function notesFor(l: Lesson, code: string): Note[] {
    const lines = code.split('\n');
    return (l.notes ?? []).flatMap((n) => {
      const i = lines.findIndex((x) => x.includes(n.line));
      if (i < 0) return [];
      const col = lines[i].indexOf(n.at);
      return col < 0 ? [] : [{ line: i + 1, col: col + 1, len: n.at.length, text: n.text }];
    });
  }

  function setNext(state: 'skip' | 'ready' | 'plain', label?: string) {
    next.className = state === 'skip' ? 'quiet' : 'solid';
    next.classList.toggle('is-ready', state === 'ready');
    next.textContent = label ?? (state === 'skip' ? 'Skip' : 'Continue');
  }

  const offerAnswer = () => callout?.querySelector<HTMLElement>('.callout-show')?.removeAttribute('hidden');

  async function go(i: number) {
    if (!course) return;
    const c = course;
    const run = ++busy;
    index = Math.max(0, Math.min(i, c.steps.length - 1));
    d.store.set('volt-play:lesson', String(index));
    d.store.set(`volt-play:steps:${c.id}`, String(Math.max(stepsSeen(c.id), index)));
    const l = c.steps[index];
    met = false;

    content.classList.add('is-leaving');
    clearCode();
    await wait(150);
    if (run !== busy) return;
    renderColumn(c, index);
    // The tour opens with a welcome that isn't a step of its own.
    const welcome = c.id === 'tour' ? 1 : 0;
    stepLabel.textContent =
      index < welcome ? c.title : `${c.title}, step ${index + 1 - welcome} of ${c.steps.length - welcome}`;
    bar.style.transform = `scaleX(${(index + 1) / c.steps.length})`;
    const last = index === c.steps.length - 1;
    if (l.try) setNext('skip');
    else setNext('plain', last ? 'Finish' : index === 0 && welcome ? 'Start' : 'Continue');
    content.classList.remove('is-leaving');

    // The lesson explains the code itself, so the results pane stays out of the way;
    // a state diagram, when the step is about one, sits under the code instead.
    d.showSide(false);
    d.view.dom.classList.toggle('is-preview', !!l.preview);
    d.setEditable(false);
    const code = l.code(lampPin());
    await typeTo(d.view, code, l.preview ? 0 : 1100);
    if (run !== busy) return;
    d.setEditable(true);

    const notes = notesFor(l, code);
    // A line with labels on it is always one of the lines the step is about.
    const spots = [...new Set([...spotLines(code, l.spot), ...notes.map((n) => n.line)])];
    const effects: StateEffect<unknown>[] = [setSpotlight.of(spots), setNotes.of(notes)];
    if (l.try) {
      callout = buildCallout(l);
      const at = l.try.at ? spotLines(code, [l.try.at])[0] : spots[0];
      effects.push(setCallout.of({ line: at ?? 1, el: callout }));
      // If someone hasn't got going after a while, offer the answer too.
      showMeTimer = window.setTimeout(offerAnswer, 20_000);
    }
    d.view.dispatch({ effects });
    if (l.timeline) {
      strip.hidden = false;
      renderTimeline(strip, code);
    }
    if (l.panel === 'states') d.showFigure(true);
    if (l.try) d.view.focus();
    else next.focus({ preventScroll: true });
  }

  // Called after every check, so a "your turn" step notices when it's done.
  function result(r: Result) {
    const l = course?.steps[index];
    if (!isOpen || !l || busy === 0) return;
    if (l.timeline && !strip.hidden) renderTimeline(strip, r.source);
    if (!l.try || met || !callout) return;
    const slip = callout.querySelector<HTMLElement>('.callout-slip')!;
    if (!l.try.done(r)) {
      // A typo shouldn't leave someone stuck: point at it, and offer the answer.
      const err = l.try.wantsError ? undefined : r.diags.find((x) => x.severity === 'error');
      const nudge = l.try.nudge?.(r);
      slip.replaceChildren(
        ...(err ? [document.createTextNode(`Not quite: there’s an error on line ${err.line}.`)] : nudge ? withCode(nudge) : []),
      );
      if (err || nudge) offerAnswer();
      return;
    }
    slip.replaceChildren();
    met = true;
    clearTimeout(showMeTimer);
    callout.classList.add('is-met');
    $('#lesson-turn')?.classList.add('is-met');
    const turnText = document.querySelector('#lesson-turn .turn-text');
    if (turnText) turnText.textContent = 'Done';
    setNext('ready', index === (course?.steps.length ?? 0) - 1 ? 'Finish' : 'Continue');
    d.view.dispatch({ effects: setSpotlight.of([]) });
    d.view.dom.classList.add('is-confirmed');
    setTimeout(() => d.view.dom.classList.remove('is-confirmed'), 900);
  }

  // The tour's lamp pin as the visitor has it now; 2 until they choose.
  function lampPin(): number {
    const m = d.view.state.doc.toString().match(/pin\s+lamp\s*=\s*(\d+)/);
    const n = m ? Number(m[1]) : 2;
    return [6, 7, 8, 9, 10, 11].includes(n) ? 2 : n;
  }

  // Opens the list, the course in progress, or a given course.
  function open(courseId?: string) {
    if (isOpen) return;
    isOpen = true;
    // The visitor's own program comes back if they leave part way through.
    d.store.set('volt-play:before-lesson', d.view.state.doc.toString());
    $('#learn').setAttribute('aria-pressed', 'true');
    $('#learn').setAttribute('aria-current', 'page');
    $('#go-playground').removeAttribute('aria-current');
    const wanted = courses.find((c) => c.id === courseId);
    if (wanted) start(wanted);
    else showSheet();
  }

  function close(keep = false) {
    if (!isOpen) return;
    isOpen = false;
    busy++;
    split.classList.remove('is-learning');
    hideSheet();
    $('#learn').setAttribute('aria-pressed', 'false');
    $('#learn').removeAttribute('aria-current');
    $('#go-playground').setAttribute('aria-current', 'page');
    d.setEditable(true);
    d.showSide(true);
    clearCode();
    setTimeout(() => {
      if (!isOpen) panel.hidden = true;
    }, reduced() ? 0 : 460);
    const before = d.store.get('volt-play:before-lesson');
    if (!keep && before !== null) {
      typeTo(d.view, before, 0).then(() => d.view.dispatch({ selection: { anchor: 0 }, scrollIntoView: true }));
    }
    d.view.focus();
  }

  function finish() {
    if (!course) return;
    markDone(course.id);
    showSheet();
  }

  $('#learn').addEventListener('click', () => (isOpen ? showSheet() : open()));
  $('#lesson-close').addEventListener('click', () => close());
  toList.addEventListener('click', showSheet);
  back.addEventListener('click', () => (index === 0 ? showSheet() : go(index - 1)));
  $('#go-playground').addEventListener('click', () => close());
  next.addEventListener('click', () => (course && index === course.steps.length - 1 ? finish() : go(index + 1)));
  document.addEventListener('keydown', (e) => {
    if (isOpen && !course && e.key === 'Escape') return close();
    if (!isOpen || !course || (e.target as HTMLElement).closest('.cm-editor, input, textarea')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next.click();
    else if (e.key === 'ArrowLeft') back.click();
    else return;
    e.preventDefault();
  });

  return {
    open,
    close,
    result,
    get isOpen() {
      return isOpen;
    },
  };
}

// Lesson text marks code with backticks: `every`.
function withCode(text: string): Node[] {
  return text.split('`').map((part, i) => (i % 2 === 0 ? document.createTextNode(part) : el('code', '', part)));
}

