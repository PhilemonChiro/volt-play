// A strip under the code showing when each `every` block runs, on one time
// axis. It's drawn from the source, not run: it shows the schedule the
// program asks for.

const UNIT_MS: Record<string, number> = { us: 0.001, ms: 1, s: 1000, sec: 1000, second: 1000, seconds: 1000, min: 60_000, hour: 3_600_000 };

type Row = { label: string; ms: number; when: string; strict: boolean; does: string };

function rows(src: string): Row[] {
  const out: Row[] = [];
  const re = /\bevery\s+(\d+(?:\.\d+)?)(us|ms|s|sec|seconds?|min|hour)\b([^{]*)\{/g;
  for (const m of src.matchAll(re)) {
    const ms = Number(m[1]) * UNIT_MS[m[2]];
    // The block's body, to say what it does.
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    while (i < src.length && depth) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    const body = src.slice(start, i - 1);
    const call = body.match(/([A-Za-z_]\w*)\.(toggle|on|off|set_pwm|send|read|move)\(/);
    const log = /\blog\(/.test(body);
    const does = call ? `${call[1]}.${call[2]}()` : log ? 'log()' : '';
    const rest = m[3];
    out.push({
      label: `every ${m[1]}${m[2]}`,
      ms,
      when: rest.match(/when\s+(.+?)\s*$/)?.[1] ?? '',
      strict: /\bstrict\b/.test(rest),
      does,
    });
  }
  return out;
}

const fmt = (ms: number) => (ms >= 1000 ? `${+(ms / 1000).toFixed(2)}s` : `${+ms.toFixed(2)}ms`);

export function renderTimeline(root: HTMLElement, src: string) {
  const list = rows(src);
  if (!list.length) {
    root.replaceChildren();
    return;
  }
  // A window that shows the slowest timer at least twice, within reason.
  const slowest = Math.max(...list.map((r) => r.ms));
  const span = Math.min(Math.max(2000, slowest * 2), 20_000);
  const W = 1000;
  const frag = document.createDocumentFragment();
  for (const r of list) {
    const row = document.createElement('div');
    row.className = `tl-row${r.strict ? ' is-strict' : ''}${r.when ? ' is-when' : ''}`;
    const label = document.createElement('div');
    label.className = 'tl-label';
    const code = document.createElement('code');
    code.textContent = r.label;
    label.append(code);
    const sub = document.createElement('span');
    sub.textContent = r.strict ? 'hardware timer' : r.when ? `while ${r.when}` : r.does;
    label.append(sub);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} 20`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'tl-track');
    const count = Math.floor(span / r.ms);
    if (count > 120) {
      // Too fast to draw run by run: a solid band, with the rate written out.
      const band = document.createElementNS(svg.namespaceURI, 'rect');
      band.setAttribute('x', '0');
      band.setAttribute('y', '6');
      band.setAttribute('width', String(W));
      band.setAttribute('height', '8');
      band.setAttribute('class', 'tl-band');
      svg.append(band);
      sub.textContent = `${sub.textContent ? `${sub.textContent}, ` : ''}${Math.round(1000 / r.ms).toLocaleString()} times a second`;
    } else {
      for (let k = 1; k <= count; k++) {
        const x = ((k * r.ms) / span) * W;
        const tick = document.createElementNS(svg.namespaceURI, 'rect') as SVGRectElement;
        tick.setAttribute('x', String(x - 2));
        tick.setAttribute('y', '3');
        tick.setAttribute('width', '4');
        tick.setAttribute('height', '14');
        tick.setAttribute('rx', '2');
        tick.setAttribute('class', 'tl-tick');
        tick.style.animationDelay = `${Math.min(k * 18, 500)}ms`;
        svg.append(tick);
      }
    }
    row.append(label, svg);
    frag.append(row);
  }
  const axis = document.createElement('div');
  axis.className = 'tl-axis';
  axis.innerHTML = `<span>0</span><span>${fmt(span / 2)}</span><span>${fmt(span)}</span>`;
  frag.append(axis);
  root.replaceChildren(frag);
}
