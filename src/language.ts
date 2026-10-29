// Volt syntax colouring for CodeMirror, matching the landing page's
// highlighter (web/src/lib/highlight.ts).
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const KEYWORDS = new Set([
  'hardware', 'pin', 'device', 'setup', 'every', 'when', 'strict', 'task', 'machine', 'state', 'initial',
  'enter', 'exit', 'after', 'on', 'let', 'var', 'const', 'if', 'else', 'match', 'for', 'in', 'while', 'fn',
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
    if (stream.match(/^\d+(?:\.\d+)?(?:ms|us|s|m|h)?\b/)) return 'number';
    if (stream.match('->')) return 'keyword';
    const word = stream.match(/^[A-Za-z_]\w*/) as RegExpMatchArray | null;
    if (word) {
      if (KEYWORDS.has(word[0])) return 'keyword';
      if (TYPES.has(word[0]) || /^[A-Z][A-Z0-9]{2,}$/.test(word[0])) return 'typeName';
      if (stream.peek() === '(') return 'function';
      return 'variableName';
    }
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '//', block: { open: '/*', close: '*/' } } },
});

export const highlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.modifier, t.operatorKeyword], color: 'var(--c-keyword)' },
    { tag: [t.typeName, t.standard(t.typeName)], color: 'var(--c-type)' },
    { tag: [t.string, t.character], color: 'var(--c-string)' },
    { tag: [t.number, t.bool], color: 'var(--c-number)' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--c-comment)', fontStyle: 'italic' },
    { tag: [t.processingInstruction, t.meta], color: 'var(--c-comment)' },
  ]),
);

export const voltLanguage = [volt, highlight];
