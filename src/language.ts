// Volt syntax colouring for CodeMirror, matching the landing page's
// highlighter (web/src/lib/highlight.ts).
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const KEYWORDS = new Set([
  'hardware', 'pin', 'setup', 'every', 'when', 'strict', 'task', 'machine', 'state', 'initial', 'enter',
  'exit', 'after', 'on', 'let', 'var', 'const', 'if', 'else', 'match', 'for', 'in', 'while', 'fn',
  'return', 'or', 'and', 'not', 'retry', 'true', 'false', 'become', 'struct', 'enum', 'channel', 'storage',
]);
const TYPES = new Set([
  'PWM', 'Analog', 'Input', 'Output', 'PullUpInput', 'PullDownInput', 'Touch', 'int', 'float', 'bool', 'string',
]);

const volt = StreamLanguage.define<{ comment: boolean }>({
  name: 'volt',
  startState: () => ({ comment: false }),
  token(stream, state) {
    if (state.comment) {
      if (stream.skipTo('*/')) {
        stream.match('*/');
        state.comment = false;
      } else stream.skipToEnd();
      return 'comment';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('/*')) {
      state.comment = true;
      return 'comment';
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string';
    if (stream.match(/^\d+(?:ms|us|s|m|h)\b/)) return 'number';
    if (stream.match(/^\d+(?:\.\d+)?/)) return 'number';
    if (stream.match('->')) return 'keyword';
    const word = stream.match(/^[A-Za-z_]\w*/) as RegExpMatchArray | null;
    if (word) {
      if (KEYWORDS.has(word[0])) return 'keyword';
      if (TYPES.has(word[0])) return 'typeName';
      if (stream.peek() === '(') return 'function';
      return 'variableName';
    }
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '//', block: { open: '/*', close: '*/' } } },
});

const style = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--c-keyword)' },
  { tag: t.typeName, color: 'var(--c-type)' },
  { tag: t.string, color: 'var(--c-string)' },
  { tag: t.number, color: 'var(--c-number)' },
  { tag: t.comment, color: 'var(--c-comment)', fontStyle: 'italic' },
]);

export const voltLanguage = [volt, syntaxHighlighting(style)];
