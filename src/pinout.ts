// The Hardware tab: a table of the pins and devices the program declares,
// each with what the compiler found. Rows are linked to their line of code.
import type { Device, Diagnostic, Pin } from './compiler';

export type PinState = { pin: Pin; line: number; problems: Diagnostic[] };
export type DeviceState = { device: Device; line: number; problems: Diagnostic[] };

const FLASH = new Set([6, 7, 8, 9, 10, 11]);
const INPUT_ONLY = new Set([34, 35, 36, 39]);

function linkRow(tr: HTMLTableRowElement, line: number, label: string, hooks: Hooks) {
  tr.tabIndex = 0;
  tr.dataset.line = String(line);
  tr.setAttribute('aria-label', `${label}. Go to line ${line}.`);
  tr.addEventListener('mouseenter', () => hooks.hover(line));
  tr.addEventListener('mouseleave', () => hooks.hover(null));
  tr.addEventListener('focus', () => hooks.hover(line));
  tr.addEventListener('blur', () => hooks.hover(null));
  tr.addEventListener('click', () => hooks.open(line));
  tr.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      hooks.open(line);
    }
  });
}

type Hooks = { hover: (line: number | null) => void; open: (line: number) => void };

function cell(text: string, cls = '') {
  const td = document.createElement('td');
  if (cls) td.className = cls;
  td.textContent = text;
  return td;
}

function nameCell(name: string, problems: Diagnostic[]) {
  const td = document.createElement('td');
  td.className = 'hw-name';
  const n = document.createElement('span');
  n.textContent = name;
  td.append(n);
  for (const d of problems) {
    const p = document.createElement('span');
    p.className = `hw-problem ${d.severity === 'error' ? 'is-error' : 'is-warning'}`;
    p.textContent = d.message;
    td.append(p);
  }
  return td;
}

function table(head: string[], rows: HTMLTableRowElement[]) {
  const t = document.createElement('table');
  t.className = 'hw';
  const thead = t.createTHead().insertRow();
  for (const h of head) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h;
    thead.append(th);
  }
  t.createTBody().append(...rows);
  return t;
}

export function renderHardware(root: HTMLElement, pins: PinState[], devices: DeviceState[], hooks: Hooks) {
  const parts: HTMLElement[] = [];

  if (pins.length) {
    const rows = [...pins]
      .sort((a, b) => a.line - b.line)
      .map((u) => {
        const tr = document.createElement('tr');
        const g = u.pin.gpio;
        const note = FLASH.has(g) ? 'wired to the flash chip' : INPUT_ONLY.has(g) ? 'input only' : '';
        tr.title = note ? `GPIO ${g} is ${note}` : '';
        const worst = u.problems.some((d) => d.severity === 'error') ? 'is-error' : u.problems.length ? 'is-warning' : '';
        if (worst) tr.className = worst;
        tr.append(nameCell(u.pin.name, u.problems), cell(`GPIO ${g}`, 'hw-num'), cell(u.pin.mode, 'hw-dim'));
        linkRow(tr, u.line, `${u.pin.name}, ${u.pin.mode} on GPIO ${g}`, hooks);
        return tr;
      });
    parts.push(table(['Pin', 'GPIO', 'Mode'], rows));
  }

  if (devices.length) {
    const rows = devices.map((u) => {
      const d = u.device;
      const tr = document.createElement('tr');
      if (u.problems.length) tr.className = u.problems.some((p) => p.severity === 'error') ? 'is-error' : 'is-warning';
      const bus = d.bus ? d.bus.toUpperCase() : '';
      const addr = d.address ? `0x${d.address.toString(16).toUpperCase().padStart(2, '0')}` : '';
      tr.append(nameCell(d.name, u.problems), cell(d.type), cell([bus, addr].filter(Boolean).join(' at '), 'hw-dim'));
      linkRow(tr, u.line, `${d.name}, ${d.type}`, hooks);
      return tr;
    });
    parts.push(table(['Device', 'Part', 'Connection'], rows));
  }

  if (!parts.length) {
    const p = document.createElement('p');
    p.className = 'aside';
    p.textContent = 'Pins and devices from the hardware block appear here. Try adding pin led = 2.';
    parts.push(p);
  }

  root.replaceChildren(...parts);
}

// Marks the row for a code line, when the cursor sits on its declaration.
export function markRow(root: HTMLElement, line: number | null) {
  for (const el of root.querySelectorAll<HTMLElement>('tr.is-linked')) el.classList.remove('is-linked');
  if (line !== null) root.querySelector<HTMLElement>(`tr[data-line="${line}"]`)?.classList.add('is-linked');
}
