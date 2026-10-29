// The code editor: Volt colouring, problems shown under the line they're on
// (with the compiler's one-click fixes), and a highlight for the line linked
// to a pin hovered in the pinout.
import { EditorState, StateEffect, StateField, RangeSetBuilder, type Range } from '@codemirror/state';
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

// A warning is a quiet note at the end of its line; errors get the full block.
class NoteWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: NoteWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'inline-note';
    span.textContent = this.text;
    return span;
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
        if (warnings.length) ranges.push(Decoration.widget({ widget: new NoteWidget(warnings.map((d) => d.message).join('  ')), side: 1 }).range(end));
        for (const d of errors) ranges.push(Decoration.widget({ widget: new ProblemWidget(d), block: true, side: 2 }).range(end));
      }
      deco = Decoration.set(ranges, true);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const setLinkedLine = StateEffect.define<number | null>();

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
