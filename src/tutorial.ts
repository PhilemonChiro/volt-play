// Runs Learn Volt in the column beside the editor: a list of courses, then
// each course's steps. A step types its program into the editor, spotlights
// the lines it's about, and for a "your turn" step waits for the compiler to
// confirm the visitor's change.
import type { EditorView } from '@codemirror/view';
import { spotLines, type Course, type Result } from './lessons';
import { courses } from './courses';
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
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

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

  let course: Course | null = null;
  let index = 0;
  let isOpen = false;
  let met = false;
  let busy = 0;

  const done = (): Set<string> => {
    try {
      return new Set(JSON.parse(d.store.get('volt-play:done') ?? '[]'));
    } catch {
      return new Set();
    }
  };
  const markDone = (id: string) => d.store.set('volt-play:done', JSON.stringify([...done(), id]));

  // ---------- the list of courses ----------
  async function showList(highlight?: string) {
    const run = ++busy;
    course = null;
    d.store.set('volt-play:course', '');
    content.classList.add('is-leaving');
    await wait(150);
    if (run !== busy) return;
    const finished = done();
    const suggested = highlight ?? courses.find((c) => !finished.has(c.id))?.id;

    const frag = document.createDocumentFragment();
    frag.append(el('h2', 'lesson-title', 'Learn Volt'));
    const intro = el('p', 'lesson-text');
    intro.textContent = finished.size
      ? `${finished.size} of ${courses.length} done. Each course is a few minutes on one idea.`
      : 'Short, hands-on courses, each on one idea. Start with the tour, or go straight to what you need.';
    frag.append(intro);

    const list = el('ol', 'courses');
    for (const c of courses) {
      const li = el('li');
      const b = el('button', 'course');
      b.type = 'button';
      if (finished.has(c.id)) b.classList.add('is-done');
      if (c.id === suggested) b.classList.add('is-next');
      const mark = el('span', 'course-mark');
      mark.setAttribute('aria-hidden', 'true');
      const text = el('span', 'course-text');
      text.append(el('span', 'course-title', c.title), el('span', 'course-about', c.about));
      const meta = el('span', 'course-meta', finished.has(c.id) ? 'Done' : `${c.steps.length} steps`);
      b.append(mark, text, meta);
      b.setAttribute('aria-label', `${c.title}. ${c.about} ${finished.has(c.id) ? 'Done.' : `${c.steps.length} steps.`}`);
      b.addEventListener('click', () => start(c));
      li.append(b);
      list.append(li);
    }
    frag.append(list);
    content.replaceChildren(frag);
    content.classList.remove('is-leaving');

    stepLabel.textContent = '';
    bar.style.transform = `scaleX(${finished.size / courses.length})`;
    toList.hidden = true;
    foot.hidden = true;
    d.view.dispatch({ effects: setSpotlight.of([]) });
    d.view.dom.classList.remove('is-preview');
    d.setEditable(true);
    content.querySelector<HTMLButtonElement>('.course.is-next, .course')?.focus({ preventScroll: true });
  }

  function start(c: Course, at = 0) {
    course = c;
    d.store.set('volt-play:course', c.id);
    toList.hidden = false;
    foot.hidden = false;
    go(at);
  }

  // ---------- one step ----------
  function render(c: Course, i: number) {
    const l = c.steps[i];
    const frag = document.createDocumentFragment();
    frag.append(el('h2', 'lesson-title', l.title));
    for (const text of l.body) {
      const p = el('p', 'lesson-text');
      p.append(...withCode(text));
      frag.append(p);
    }
    if (l.try) {
      const box = el('div', 'try');
      box.id = 'lesson-try';
      const head = el('div', 'try-head');
      head.innerHTML =
        '<svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" /><path d="M6 10.4 8.7 13 14 7.4" /></svg>';
      const task = el('p', 'try-task');
      task.append(...withCode(l.try.task));
      head.append(task);
      const show = el('button', 'quiet try-show', 'Show me');
      show.type = 'button';
      show.addEventListener('click', async () => {
        show.disabled = true;
        await typeTo(d.view, l.try!.answer(lampPin()), 500);
      });
      const slip = el('p', 'try-slip');
      slip.id = 'lesson-slip';
      // The inner span keeps the sentence in one piece inside the grid that animates its height.
      const after = el('p', 'try-after');
      const afterText = el('span');
      afterText.append(...withCode(l.try.after));
      after.append(afterText);
      box.append(head, show, slip, after);
      frag.append(box);
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
    const last = i === c.steps.length - 1;
    if (last) {
      const nextCourse = courses[courses.indexOf(c) + 1];
      frag.append(
        el(
          'p',
          'lesson-text next-step',
          'To run it, Volt IDE builds your program and flashes it to an ESP32 over USB, with the same checks as you type.',
        ),
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
      const get = el('a', nextCourse ? 'quiet' : 'solid', 'Get Volt IDE');
      (get as HTMLAnchorElement).href = 'https://voltembedded.com/#download';
      row.append(get);
      frag.append(row);
    }
    content.replaceChildren(frag);
  }

  async function go(i: number) {
    if (!course) return;
    const c = course;
    const run = ++busy;
    index = Math.max(0, Math.min(i, c.steps.length - 1));
    d.store.set('volt-play:lesson', String(index));
    const l = c.steps[index];
    met = false;

    content.classList.add('is-leaving');
    await wait(150);
    if (run !== busy) return;
    render(c, index);
    // The tour opens with a welcome that isn't a step of its own.
    const welcome = c.id === 'tour' ? 1 : 0;
    stepLabel.textContent =
      index < welcome ? c.title : `${c.title}, step ${index + 1 - welcome} of ${c.steps.length - welcome}`;
    bar.style.transform = `scaleX(${(index + 1) / c.steps.length})`;
    back.disabled = false;
    const last = index === c.steps.length - 1;
    next.textContent = last ? 'Finish' : index === 0 && welcome ? 'Start' : 'Continue';
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
    const l = course?.steps[index];
    if (!isOpen || !l?.try || met || busy === 0) return;
    const slip = document.querySelector<HTMLElement>('#lesson-slip');
    if (!l.try.done(r)) {
      // A typo shouldn't leave someone stuck: point at it.
      const err = l.try.wantsError ? undefined : r.diags.find((x) => x.severity === 'error');
      const nudge = l.try.nudge?.(r);
      slip?.replaceChildren(
        ...(err
          ? [document.createTextNode(`Not quite yet: there’s an error on line ${err.line}. Its message is in the editor.`)]
          : nudge
            ? withCode(nudge)
            : []),
      );
      return;
    }
    slip?.replaceChildren();
    met = true;
    $('#lesson-try')?.classList.add('is-met');
    next.disabled = false;
    next.classList.add('is-ready');
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
    panel.hidden = false;
    requestAnimationFrame(() => split.classList.add('is-learning'));
    $('#learn').setAttribute('aria-pressed', 'true');
    const wanted = courses.find((c) => c.id === courseId);
    const resume = courses.find((c) => c.id === d.store.get('volt-play:course'));
    if (wanted) start(wanted);
    else if (resume) start(resume, Number(d.store.get('volt-play:lesson')) || 0);
    else showList();
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
    if (!keep && before !== null) {
      typeTo(d.view, before, 0).then(() => d.view.dispatch({ selection: { anchor: 0 }, scrollIntoView: true }));
    }
    d.view.focus();
  }

  function finish() {
    if (!course) return;
    markDone(course.id);
    const nextCourse = courses[courses.indexOf(course) + 1];
    showList(nextCourse?.id);
  }

  $('#learn').addEventListener('click', () => (isOpen ? close() : open()));
  $('#lesson-close').addEventListener('click', () => close());
  toList.addEventListener('click', () => showList(course?.id));
  back.addEventListener('click', () => (index === 0 ? showList(course?.id) : go(index - 1)));
  next.addEventListener('click', () => (course && index === course.steps.length - 1 ? finish() : go(index + 1)));
  document.addEventListener('keydown', (e) => {
    if (!isOpen || !course || (e.target as HTMLElement).closest('.cm-editor, input, textarea')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' && !next.disabled) next.click();
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
  return text.split('`').map((part, i) => {
    if (i % 2 === 0) return document.createTextNode(part);
    return el('code', '', part);
  });
}
