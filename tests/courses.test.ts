// Checks every course against the real compiler (public/volt.wasm): each
// program a step shows compiles as the step describes, each "your turn"
// starts unmet, and its answer meets it. Run: npm test
import fs from 'node:fs';
import path from 'node:path';
import { courses } from '../src/courses';

// npm test runs from the playground's folder.
const root = process.cwd();
await import(path.join(root, 'public/wasm_exec.js'));
const go = new (globalThis as any).Go();
const { instance } = await WebAssembly.instantiate(fs.readFileSync(path.join(root, 'public/volt.wasm')), go.importObject);
go.run(instance);
const volt = (globalThis as any).volt;

const result = (source: string) => {
  const r = JSON.parse(volt.compile(source));
  return { diags: r.diagnostics ?? [], pins: r.pins ?? [], source };
};

let failed = 0;
const fail = (where: string, why: string) => {
  failed++;
  console.log(`FAIL ${where}: ${why}`);
};

for (const c of courses) {
  c.steps.forEach((step, i) => {
    const where = `${c.id} ${i + 1} "${step.title}"`;
    for (const lamp of [2, 4, 18, 19]) {
      const code = step.code(lamp);
      const r = result(code);
      const errs = r.diags.filter((d: any) => d.severity === 'error');
      if (errs.length && !step.try?.wantsError && !(step.try && i > 0 && c.steps[i - 1].try?.wantsError))
        fail(where, `shows a program with an error: ${errs[0].message}`);
      if (step.try) {
        if (step.try.done(r)) fail(where, 'is already done before the visitor does anything');
        const answer = result(step.try.answer(lamp));
        if (!step.try.done(answer)) fail(where, `"Show me" doesn't meet the goal (${answer.diags.map((d: any) => d.message).join('; ') || 'no diagnostics'})`);
      }
      if (c.id !== 'tour') break;
    }
  });
}
const steps = courses.reduce((n, c) => n + c.steps.length, 0);
console.log(failed ? `${failed} failed` : `ok: ${courses.length} courses, ${steps} steps`);
process.exit(failed ? 1 : 0);
