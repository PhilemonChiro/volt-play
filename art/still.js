// With ?still in the URL, a figure page shows only its drawing, filling the
// window: art/render.sh screenshots it for a course tile.
if (new URLSearchParams(location.search).has('still')) {
  const s = document.createElement('style');
  s.textContent = `
    html, body { margin: 0 !important; padding: 0 !important; height: 100%; overflow: hidden; background: transparent !important; background-image: none !important; }
    body > header, .controls, #readout, .made-with, .actions, .stats, .idea, .toast, .vset, .zchip, .lgd { display: none !important; }
    .stage { max-width: none !important; width: 100vw; height: 100vh; margin: 0 !important; }
    #fig { max-width: none !important; width: 100vw !important; height: 100vh !important; margin: 0 !important; }`;
  document.head.append(s);
}

// With ?sheet=N&first=F as well, the page lays out the N frames of the figure's loop (art/anim.js), from frame F,
// in a grid of 600 x 400 cells, for art/render.sh to shoot once (in a window big enough) and cut up.
const sheetQ = new URLSearchParams(location.search);
if (sheetQ.has('still') && sheetQ.has('sheet')) {
  const n = Number(sheetQ.get('sheet')), first = Number(sheetQ.get('first') || 0), cols = Math.ceil(Math.sqrt(n));
  window.addEventListener('load', () => setTimeout(() => {
    const fig = document.querySelector('#fig'), w = 600, h = 400, cells = [];
    fig.style.cssText = `width:${w}px !important;height:${h}px !important`;
    for (let i = 0; i < n; i++) {
      window.animAt = ((first + i) % n) / n;
      ui.render();
      cells.push(`<div style="width:${w}px;height:${h}px">${fig.outerHTML.replace(' id="fig"', '')}</div>`);
    }
    const grid = document.createElement('div');
    grid.style.cssText = `position:fixed;inset:0;display:grid;grid-template-columns:repeat(${cols},${w}px);background:transparent`;
    grid.innerHTML = cells.join('');
    grid.querySelectorAll('svg').forEach((s) => { s.style.cssText = `width:${w}px;height:${h}px;max-width:none;margin:0`; });
    fig.style.display = 'none';
    document.body.append(grid);
  }, 50));
}
