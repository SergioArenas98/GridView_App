// Presentation only. Emulates the Standings selector behaviour of the Flutter
// screen; it changes no data and makes no request.
// 1. Selection: Drivers by default. ?championship=constructors opens with
//    Constructors selected, standing in for the explicit season route
//    /standings/constructors/2026 (a capture aid, not a new feature).
// 2. Independent scroll positions: each table remembers its own offset while
//    the page is open, as StandingsUiState does for the app session. Switching
//    restores the other table's offset (0 the first time).
// 3. Adaptive selector fit, same order as the navigation: regular → condensed
//    → stacked, the first mode in which both labels fit untruncated.
(() => {
  const seg = document.querySelector('.seg');
  if (!seg) return;
  const buttons = [...seg.querySelectorAll('.seg__btn')];
  const panels = new Map(buttons.map((b) => [b.dataset.target, document.getElementById(b.dataset.target)]));
  const offsets = new Map(buttons.map((b) => [b.dataset.target, 0]));
  let current = null;

  const select = (target, { restore = true } = {}) => {
    if (target === current || !panels.has(target)) return;
    if (current !== null) offsets.set(current, window.scrollY);
    current = target;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.target === target)));
    panels.forEach((panel, key) => { panel.hidden = key !== target; });
    if (restore) window.scrollTo(0, offsets.get(target));
  };

  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.target)));
  const requested = new URLSearchParams(window.location.search).get('championship');
  select(panels.has(requested) ? requested : buttons[0].dataset.target, { restore: false });

  const labels = [...seg.querySelectorAll('.seg__label')];
  const modes = ['regular', 'condensed', 'stacked'];
  const overflowing = () => labels.some((l) => l.scrollWidth > l.clientWidth + 1);
  // Measured with both labels in the selected (bold) weight, so the layout
  // does not change when the selection does.
  const fit = () => {
    seg.dataset.measuring = 'true';
    for (const mode of modes) {
      seg.dataset.fit = mode;
      if (!overflowing()) break;
    }
    delete seg.dataset.measuring;
  };
  new ResizeObserver(() => requestAnimationFrame(fit)).observe(seg);
  document.fonts.ready.then(fit);
  fit();
})();

// 4. Screen title fit: one unbreakable word ("Clasificaciones") narrows the
//    Archivo width axis 118 → 100 → 84 → 72, then scales down to its column.
//    (Flutter's AppBar would ellipsize it; the prototype keeps the whole word.)
// 5. Header budget: the app bar row and the selector bar are both pinned, as
//    Flutter's fixed header is. When together they would take more than a
//    quarter of the viewport (large text), the app bar row scrolls away and
//    only the selector bar stays pinned. A proposal, see README.
(() => {
  const root = document.documentElement;
  const appbar = document.querySelector('.appbar--pinned');
  const pinbar = document.querySelector('.pinbar');
  const title = appbar && appbar.querySelector('.wordmark');
  if (!appbar || !title) return;
  const modes = ['w118', 'w100', 'w84', 'w72'];
  const BUDGET = 0.25;

  const fitTitle = () => {
    title.style.fontSize = '';
    for (const mode of modes) {
      title.dataset.fit = mode;
      if (title.scrollWidth <= title.clientWidth + 1) return;
    }
    title.dataset.fit = 'scaled';
    const base = parseFloat(getComputedStyle(title).fontSize);
    title.style.fontSize = `${Math.floor((base * title.clientWidth * 100) / title.scrollWidth) / 100}px`;
  };

  const budget = () => {
    root.dataset.header = 'pinned';
    const a = appbar.getBoundingClientRect().height;
    const p = pinbar ? pinbar.getBoundingClientRect().height : 0;
    root.style.setProperty('--appbar-h', `${Math.ceil(a)}px`);
    if (a + p > window.innerHeight * BUDGET) root.dataset.header = 'scroll';
  };

  let busy = false;
  const layout = () => {
    if (busy) return;
    busy = true;
    fitTitle();
    budget();
    busy = false;
  };
  new ResizeObserver(() => requestAnimationFrame(layout)).observe(document.body);
  window.addEventListener('resize', layout);
  document.fonts.ready.then(layout);
  layout();
})();
