// The code editor: Volt colouring, problems shown under the line they're on
// (with the compiler's one-click fixes), and a highlight for the line linked
// to a pin hovered in the pinout.
import { EditorState, StateEffect, StateField, RangeSetBuilder, Compartment, type Range } from '@codemirror/state';
import {
  EditorView, Decoration, WidgetType, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, type DecorationSet,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentUnit, bracketMatching } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { voltLanguage } from './language';
import type { Diagnostic, Fix } from './compiler';

// Converts the compiler's 1-based line and column to a document offset.
export function offset(state: EditorState, line: number, col: number): number {
  const doc = state.doc;
  const l = doc.line(Math.min(Math.max(line, 1), doc.lines));
  return Math.min(l.from + Math.max(col - 1, 0), l.to);
}

function applyFix(view: EditorView, fix: Fix) {
  const from = offset(view.state, fix.line, fix.col);
  const to = offset(view.state, fix.end_line, fix.end_col);
  view.dispatch({ changes: { from, to, insert: fix.text }, selection: { anchor: from + fix.text.length } });
  view.focus();
}

class ProblemWidget extends WidgetType {
  constructor(readonly diag: Diagnostic) {
    super();
  }
  eq(other: ProblemWidget) {
    return JSON.stringify(other.diag) === JSON.stringify(this.diag);
  }
  toDOM(view: EditorView) {
    const d = this.diag;
    // CodeMirror measures a block widget's border box, so spacing lives on
    // this wrapper's padding rather than the box's margins.
    const wrap = document.createElement('div');
    wrap.className = 'inline-problem-wrap';
    const box = document.createElement('div');
    box.className = 'inline-problem';
    wrap.append(box);
    const msg = document.createElement('p');
    msg.className = 'ip-message';
    msg.textContent = d.message;
    box.append(msg);
    if (d.hint) {
      const hint = document.createElement('p');
      hint.className = 'ip-hint';
      hint.textContent = d.hint;
      box.append(hint);
    }
    if (d.fixes?.length) {
      const row = document.createElement('div');
      row.className = 'ip-fixes';
      for (const fix of d.fixes.slice(0, 3)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = fix.title;
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => applyFix(view, fix));
        row.append(b);
      }
      box.append(row);
    }
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

// A warning is a quiet note at the end of its line; errors get the full block. A warning with a fix
// offers its first one as a small action after the note.
class NoteWidget extends WidgetType {
  constructor(readonly diags: Diagnostic[]) {
    super();
  }
  eq(other: NoteWidget) {
    return JSON.stringify(other.diags) === JSON.stringify(this.diags);
  }
  toDOM(view: EditorView) {
    const span = document.createElement('span');
    span.className = 'inline-note';
    span.textContent = this.diags.map((d) => d.message).join('  ');
    const fix = this.diags.find((d) => d.fixes?.length)?.fixes?.[0];
    if (fix) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inline-note-fix';
      b.textContent = fix.title;
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => applyFix(view, fix));
      span.append(b);
    }
    return span;
  }
  ignoreEvent() {
    return true;
  }
}

export const setProblems = StateEffect.define<Diagnostic[]>();

// Underlines plus a block under each problem's line. Positions follow edits
// until the next check replaces them.
const problemField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setProblems)) continue;
      const ranges: Range<Decoration>[] = [];
      const state = tr.state;
      const lastLine = new Map<number, Diagnostic[]>();
      for (const d of e.value) {
        const from = offset(state, d.line, d.col);
        let to = d.end_line ? offset(state, d.end_line, d.end_col ?? d.col) : state.doc.lineAt(from).to;
        if (to <= from) to = Math.min(from + 1, state.doc.lineAt(from).to);
        const cls = d.severity === 'error' ? 'cm-problem-error' : 'cm-problem-warning';
        if (to > from) ranges.push(Decoration.mark({ class: cls }).range(from, to));
        const line = state.doc.lineAt(from).number;
        lastLine.set(line, [...(lastLine.get(line) ?? []), d]);
      }
      for (const [line, diags] of lastLine) {
        const end = state.doc.line(line).to;
        const errors = diags.filter((d) => d.severity === 'error');
        const warnings = diags.filter((d) => d.severity !== 'error');
        if (warnings.length) ranges.push(Decoration.widget({ widget: new NoteWidget(warnings), side: 1 }).range(end));
        for (const d of errors) ranges.push(Decoration.widget({ widget: new ProblemWidget(d), block: true, side: 2 }).range(end));
      }
      deco = Decoration.set(ranges, true);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const setLinkedLine = StateEffect.define<number | null>();

// Lines a tutorial step is about; the others dim (see .has-spot in style.css).
export const setSpotlight = StateEffect.define<number[]>();

const spotField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setSpotlight)) continue;
      const b = new RangeSetBuilder<Decoration>();
      for (const n of [...new Set(e.value)].sort((x, y) => x - y)) {
        if (n >= 1 && n <= tr.state.doc.lines) {
          const from = tr.state.doc.line(n).from;
          b.add(from, from, Decoration.line({ class: 'cm-spot' }));
        }
      }
      deco = b.finish();
    }
    return deco;
  },
  provide: (f) => [
    EditorView.decorations.from(f),
    EditorView.editorAttributes.from(f, (d): Record<string, string> => (d.size ? { class: 'has-spot' } : {})),
  ],
});

const linkedField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setLinkedLine)) continue;
      if (e.value === null || e.value > tr.state.doc.lines) {
        deco = Decoration.none;
      } else {
        const b = new RangeSetBuilder<Decoration>();
        b.add(tr.state.doc.line(e.value).from, tr.state.doc.line(e.value).from, Decoration.line({ class: 'cm-linked' }));
        deco = b.finish();
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const editable = new Compartment();

// Pauses typing while the tutorial types a step's program.
export function setEditable(view: EditorView, on: boolean) {
  view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(on)) });
}

export function createEditor(opts: {
  parent: HTMLElement;
  doc: string;
  onChange: () => void;
  onCursorLine: (line: number) => void;
  onFormat: () => void;
}) {
  return new EditorView({
    parent: opts.parent,
    state: EditorState.create({
      doc: opts.doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        bracketMatching(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        keymap.of([
          { key: 'Mod-s', preventDefault: true, run: () => (opts.onFormat(), true) },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
        ]),
        voltLanguage,
        problemField,
        linkedField,
        spotField,
        coachField,
        editable.of(EditorView.editable.of(true)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) opts.onChange();
          if (u.selectionSet || u.docChanged) opts.onCursorLine(u.state.doc.lineAt(u.state.selection.main.head).number);
        }),
      ],
    }),
  });
}

export function replaceDoc(view: EditorView, text: string) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: 0 }, scrollIntoView: true });
}

export function jumpTo(view: EditorView, line: number, col = 1) {
  const pos = offset(view.state, line, col);
  view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
  view.focus();
}

// Changes the document to target as if typed: the common start and end stay,
// the changed middle is removed, then the new text is typed in. It takes at
// most `budget` milliseconds; with reduced motion it happens at once.
export function typeTo(view: EditorView, target: string, budget = 1100): Promise<void> {
  const doc = view.state.doc.toString();
  if (doc === target) return Promise.resolve();
  let start = 0;
  while (start < doc.length && start < target.length && doc[start] === target[start]) start++;
  let end = 0;
  while (
    end < doc.length - start &&
    end < target.length - start &&
    doc[doc.length - 1 - end] === target[target.length - 1 - end]
  )
    end++;
  const insert = target.slice(start, target.length - end);
  view.dispatch({ changes: { from: start, to: doc.length - end, insert: '' }, selection: { anchor: start }, scrollIntoView: true });
  if (!insert) return Promise.resolve();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    view.dispatch({ changes: { from: start, insert }, selection: { anchor: start + insert.length } });
    return Promise.resolve();
  }
  const perChar = Math.min(22, budget / insert.length);
  const t0 = performance.now();
  let done = 0;
  return new Promise((resolve) => {
    const step = (now: number) => {
      let want = Math.min(insert.length, Math.floor((now - t0) / perChar) + 1);
      // Indentation arrives in one go, as an editor's auto-indent would.
      while (want < insert.length && insert[want] === ' ' && insert[want - 1] === ' ') want++;
      if (want > done) {
        const pos = start + done;
        view.dispatch({
          changes: { from: pos, insert: insert.slice(done, want) },
          selection: { anchor: start + want },
          scrollIntoView: true,
        });
        done = want;
      }
      if (done < insert.length) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

// ---------- tutorial coaching in the code ----------
// Notes point at words in a line with leader lines drawn underneath it; the
// callout is the tutorial's "your turn" card, placed under the line to change.
export type Note = { line: number; col: number; len: number; text: string };

class NotesWidget extends WidgetType {
  constructor(readonly notes: Note[]) {
    super();
  }
  eq(o: NotesWidget) {
    return JSON.stringify(o.notes) === JSON.stringify(this.notes);
  }
  toDOM() {
    // The rightmost note sits on the top row, so no line crosses a label.
    const sorted = [...this.notes].sort((a, b) => b.col - a.col);
    const ROW = 30;
    const box = document.createElement('div');
    box.className = 'cm-notes';
    // Vertical space is height, never margin, so the line numbers stay aligned.
    box.style.height = `${sorted.length * ROW + 10}px`;
    sorted.forEach((n, row) => {
      const delay = row * 110;
      const centre = `calc(${n.col - 1 + n.len / 2}ch)`;
      // A line from the middle of the word down to its label.
      const lead = document.createElement('span');
      lead.className = 'cm-note-lead';
      lead.style.left = centre;
      lead.style.height = `${row * ROW + 8}px`;
      lead.style.animationDelay = `${delay}ms`;
      // The label, with a caret pointing up at the word.
      const label = document.createElement('span');
      label.className = 'cm-note-label';
      label.style.left = `calc(${n.col - 1 + n.len / 2}ch - 12px)`;
      label.style.top = `${row * ROW + 8}px`;
      label.style.animationDelay = `${delay + 80}ms`;
      // Positioned in the code font's character widths; the words use the UI font.
      const words = document.createElement('span');
      words.textContent = n.text;
      label.append(words);
      box.append(lead, label);
    });
    return box;
  }
  ignoreEvent() {
    return true;
  }
}

class HostWidget extends WidgetType {
  constructor(readonly el: HTMLElement) {
    super();
  }
  eq(o: HostWidget) {
    return o.el === this.el;
  }
  toDOM() {
    // CodeMirror measures a block widget's border box, so spacing lives on
    // this wrapper's padding, not the card's margins.
    const wrap = document.createElement('div');
    wrap.className = 'cm-host';
    wrap.append(this.el);
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

export const setNotes = StateEffect.define<Note[]>();
export const setCallout = StateEffect.define<{ line: number; el: HTMLElement } | null>();

const coachField = StateField.define<{ notes: DecorationSet; callout: DecorationSet }>({
  create: () => ({ notes: Decoration.none, callout: Decoration.none }),
  update(v, tr) {
    let { notes, callout } = v;
    // Notes describe the code as the step typed it; once the visitor edits, they go.
    if (tr.docChanged && tr.isUserEvent('input') || tr.isUserEvent('delete')) notes = Decoration.none;
    else notes = notes.map(tr.changes);
    callout = callout.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setNotes)) {
        const byLine = new Map<number, Note[]>();
        for (const n of e.value) if (n.line >= 1 && n.line <= tr.state.doc.lines) byLine.set(n.line, [...(byLine.get(n.line) ?? []), n]);
        const ranges = [...byLine].flatMap(([line, ns]) => {
          const l = tr.state.doc.line(line);
          return [
            // Each word pulses as its label arrives (same order as the widget's rows).
            ...[...ns]
              .sort((a, b) => b.col - a.col)
              .map((n, row) =>
                Decoration.mark({ class: 'cm-noted', attributes: { style: `animation-delay: ${row * 110 + 60}ms` } }).range(
                  l.from + n.col - 1,
                  Math.min(l.to, l.from + n.col - 1 + n.len),
                ),
              )
              .sort((x, y) => x.from - y.from),
            Decoration.widget({ widget: new NotesWidget(ns), block: true, side: 3 }).range(l.to),
          ];
        });
        notes = Decoration.set(ranges, true);
      }
      if (e.is(setCallout)) {
        callout =
          e.value && e.value.line >= 1 && e.value.line <= tr.state.doc.lines
            ? Decoration.set([Decoration.widget({ widget: new HostWidget(e.value.el), block: true, side: 4 }).range(tr.state.doc.line(e.value.line).to)])
            : Decoration.none;
      }
    }
    return { notes, callout };
  },
  provide: (f) => [EditorView.decorations.from(f, (v) => v.notes), EditorView.decorations.from(f, (v) => v.callout)],
});

export const coaching = coachField;
