// Presentation only. Emulates what the Flutter layout would do natively:
// 1. Adaptive navigation: pick the first layout in which every label fits
//    without truncation — regular (current identity) → condensed (Archivo
//    width axis) → stacked (2 × 2 grid, labels may wrap at hyphenation points).
// 2. Reserve the navigation's real height at the end of the scroll, as a
//    Scaffold's bottomNavigationBar does, so no content stays hidden.
(() => {
  const root = document.documentElement;
  const nav = document.querySelector('.tabbar');
  if (!nav) return;
  const labels = [...nav.querySelectorAll('.tab__label')];
  const modes = ['regular', 'condensed', 'stacked'];
  const overflowing = () => labels.some((label) => label.scrollWidth > label.clientWidth + 1);

  let busy = false;
  const fit = () => {
    if (busy) return;
    busy = true;
    for (const mode of modes) {
      nav.dataset.fit = mode;
      if (!overflowing()) break;
    }
    root.style.setProperty('--nav-space', `${Math.ceil(nav.getBoundingClientRect().height)}px`);
    busy = false;
  };

  new ResizeObserver(() => requestAnimationFrame(fit)).observe(document.body);
  window.addEventListener('resize', fit);
  document.fonts.ready.then(fit);
  fit();
})();
