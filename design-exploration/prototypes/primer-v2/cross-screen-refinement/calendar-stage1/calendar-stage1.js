// EXPERIMENT (Step 48E, Stage 1). Calendar: the title row and the season row
// both stay pinned (no dynamic title release); the last-check caption and the
// notices scroll with the content (moved in the markup). This script only keeps
// keyboard focus clear of the pinned chrome. It publishes:
//   --cal-pinned-h  the measured sticky header height (scroll-padding-top;
//                   the navigation's --nav-space is the bottom padding)
//
// Focus rules (keyboard focus only: :focus-visible; pointer and programmatic
// focus are left alone):
// - L1: a focused race row taller than the band between the header and the
//   navigation is aligned to its top edge, so its start (round, Grand Prix,
//   status) is never under the season row. Chrome would centre it.
// - After a text-scale or viewport change, a focused race row is brought back
//   into the band with the same rule. Ordinary layout changes (a notice
//   appearing) never move the scroll position.
(() => {
  const root = document.documentElement;
  const header = document.querySelector('.appbar--sticky');
  const list = document.querySelector('.rounds');
  const nav = document.querySelector('.tabbar');
  if (!header || !list) return;

  const band = () => (nav ? nav.getBoundingClientRect().top : window.innerHeight) - Math.max(0, header.getBoundingClientRect().bottom);
  const oversized = (row) => row && row.getBoundingClientRect().height > band();
  const reveal = (target) => {
    const row = target.closest('.ev');
    if (oversized(row)) row.scrollIntoView({ block: 'start' });
    else target.scrollIntoView({ block: 'nearest' });
  };

  let env = '';
  const layout = () => {
    root.style.setProperty('--cal-pinned-h', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    const now = `${window.innerWidth}x${window.innerHeight}@${getComputedStyle(root).fontSize}`;
    const changed = env !== '' && env !== now;
    env = now;
    const focused = document.activeElement;
    if (changed && focused && list.contains(focused) && focused.matches(':focus-visible')) reveal(focused);
  };

  list.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!target.matches(':focus-visible')) return;
    // After the browser's own focus scrolling, which centres an oversized row.
    requestAnimationFrame(() => {
      const row = target.closest('.ev');
      if (document.activeElement === target && oversized(row)) row.scrollIntoView({ block: 'start' });
    });
  });
  const observer = new ResizeObserver(() => requestAnimationFrame(layout));
  observer.observe(document.body);
  observer.observe(header);
  window.addEventListener('resize', layout);
  document.fonts.ready.then(layout);
  layout();
})();
