// The Examples menu: a button that opens a listbox. Arrow keys move, Enter
// or a click chooses, Escape or a click elsewhere closes.
import type { Example } from './examples';

export function examplesMenu(root: HTMLElement, examples: Example[], choose: (ex: Example) => void) {
  const button = root.querySelector<HTMLButtonElement>('.menu-button')!;
  const list = root.querySelector<HTMLUListElement>('.menu-list')!;

  const items = examples.map((ex, i) => {
    const li = document.createElement('li');
    li.id = `example-${ex.id}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    const name = document.createElement('span');
    name.className = 'opt-name';
    name.textContent = ex.name;
    const about = document.createElement('span');
    about.className = 'opt-about';
    about.textContent = ex.about;
    li.append(name, about);
    li.addEventListener('mousemove', () => setActive(i));
    li.addEventListener('mousedown', (e) => e.preventDefault());
    li.addEventListener('click', () => pick(i));
    list.append(li);
    return li;
  });

  let active = 0;
  function setActive(i: number) {
    active = (i + items.length) % items.length;
    items.forEach((li, j) => li.setAttribute('aria-selected', String(j === active)));
    list.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({ block: 'nearest' });
  }
  function open() {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    setActive(active);
    list.focus();
  }
  function close(refocus = true) {
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  }
  function pick(i: number) {
    close(false);
    choose(examples[i]);
  }

  button.addEventListener('click', () => (list.hidden ? open() : close()));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open();
    }
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') setActive(active + 1);
    else if (e.key === 'ArrowUp') setActive(active - 1);
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(items.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') pick(active);
    else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') return close(false);
    else return;
    e.preventDefault();
  });
  list.addEventListener('blur', () => close(false));
}
