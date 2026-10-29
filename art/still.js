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
