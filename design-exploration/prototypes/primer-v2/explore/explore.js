// Presentation only. Emulates the Explore category selector of the Flutter
// screen; it changes no data and makes no request.
// 1. Selection: Drivers by default (/explore opens Drivers). ?category=teams or
//    ?category=circuits stands in for the sibling routes /explore/teams and
//    /explore/circuits (a capture aid, not a new feature). In the app the
//    category is route state, so a branch switch or a detail round trip
//    returns to the same category.
// 2. Independent scroll positions: each category remembers its own offset
//    while the page is open, as ExploreUiState does for the app session.
// 3. Adaptive selector fit: regular → condensed → stacked, measured with every
//    label in the selected weight so the layout never changes with selection.
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
  const requested = new URLSearchParams(window.location.search).get('category');
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
    // The selector's height feeds the header budget: ask for a re-check.
    window.dispatchEvent(new Event('gv:layout'));
  };
  new ResizeObserver(() => requestAnimationFrame(fit)).observe(seg);
  document.fonts.ready.then(fit);
  fit();
})();

// 4. Screen title fit: one unbreakable word ("Clasificaciones" in Standings) narrows the
//    Archivo width axis 118 → 100 → 84 → 72, then scales down to its column.
//    (Flutter's AppBar would ellipsize it; the prototype keeps the whole word.)
// 5. Header budget: the app bar row and the selector bar are both pinned, as
//    Flutter's fixed header is. When together they would take more than a
//    quarter of the viewport (large text), the app bar row scrolls away and
//    only the selector bar stays pinned. If the selector bar alone exceeds
//    the budget, nothing but the bottom navigation stays fixed. See README.
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
    // Extension for Explore's three segments: when the selector bar alone
    // exceeds the budget (stacked at large text), it scrolls too and only the
    // bottom navigation stays fixed. Scroll up to change category.
    if (p > window.innerHeight * BUDGET) root.dataset.header = 'none';
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
  if (pinbar) new ResizeObserver(() => requestAnimationFrame(layout)).observe(pinbar);
  window.addEventListener('resize', layout);
  window.addEventListener('gv:layout', () => requestAnimationFrame(layout));
  document.fonts.ready.then(layout);
  layout();
})();
