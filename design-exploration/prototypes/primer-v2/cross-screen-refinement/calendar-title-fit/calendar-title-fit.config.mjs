// Calendar title-fit EXPERIMENT (Step 48B): approved ../../calendar/ (baseline)
// vs this folder. Run with the consolidation tool, unchanged:
//
//   node ../../consolidation-pilot/tools/visual-compare.mjs calendar-title-fit.config.mjs
//   node ../../consolidation-pilot/tools/visual-compare.mjs calendar-title-fit.config.mjs --control
//
// Differences are EXPECTED here (the title rule changed); the run exits 1 by
// design. What must hold is in REPORT.md §3: pixels change only in the title
// and the header geometry it causes; text, links, accessibility tree, focus
// order, targets and state behaviour stay identical.
//
// Coverage: the pilot config's matrix (EN, ES × 390×844, 320×693 × 100%, 200%
// × default, refreshing, stale, failed; full scroll), its focus walks, forced
// pointer states and reduced motion, plus a 320 @200% focus walk in the
// default state and scroll / text-scale / focus-visibility steps.
const STATES = { default: '', refreshing: 'state=refreshing', stale: 'state=stale', failed: 'state=failed' };
const FORCED = [['.icon-btn', 'hover'], ['.icon-btn', 'active'], ['.ev:nth-child(2) .ev__link', 'hover'], ['.ev:nth-child(2) .ev__link', 'active'],
  ['.ev--next .ev__link', 'hover'], ['.ev--next .ev__link', 'active'], ['.tab:not(.is-selected)', 'hover']];

// Measured in the page (getComputedStyle / getBoundingClientRect), never estimated.
const R = 'const q = (v) => Math.round(v * 100) / 100;';
const TITLE = `(() => { ${R} const t = document.querySelector('.wordmark'), a = document.querySelector('.appbar__actions'), b = document.querySelector('.appbar__brand');
  if (!t || !a) return null; const cs = getComputedStyle(t), rg = document.createRange(); rg.selectNodeContents(t);
  const ink = rg.getBoundingClientRect(), act = a.getBoundingClientRect(), box = t.getBoundingClientRect();
  const lines = new Set([...rg.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
  return { text: t.textContent, fontSize: cs.fontSize, wdth: cs.fontVariationSettings, fit: t.dataset.fit || null, inline: t.style.fontSize || null,
    textWidth: q(ink.width), column: q(b.getBoundingClientRect().width), gapToActions: q(act.left - ink.right), lines,
    fullyVisible: t.scrollWidth <= t.clientWidth + 1 && ink.right <= act.left + 0.5, titleBox: [box.x, box.y, box.width, box.height].map(q) }; })()`;
const HEADER = `(() => { ${R} const h = document.querySelector('.appbar--sticky'), nav = document.querySelector('.tabbar'), list = document.querySelector('.rounds');
  const hr = h.getBoundingClientRect(), nr = nav.getBoundingClientRect(), lr = list.getBoundingClientRect(), H = innerHeight;
  const rows = [...document.querySelectorAll('.ev')].map((e) => e.getBoundingClientRect());
  const win = nr.top - hr.bottom;
  return { viewportH: H, headerH: q(hr.height), headerPct: q((hr.height / H) * 100), navH: q(nr.height), contentWindow: q(win), contentWindowPct: q((win / H) * 100),
    listTop: q(lr.top), listVisibleAtTop: q(Math.max(0, Math.min(lr.bottom, nr.top) - Math.max(lr.top, hr.bottom))),
    rowsFull: rows.filter((r) => r.top >= hr.bottom - 0.5 && r.bottom <= nr.top + 0.5).length,
    rowsAnyPart: rows.filter((r) => r.bottom > hr.bottom && r.top < nr.top).length, docH: document.documentElement.scrollHeight }; })()`;
const STATE_BODY = `${R} const t = document.querySelector('.wordmark'), h = document.querySelector('.appbar--sticky').getBoundingClientRect(), nav = document.querySelector('.tabbar').getBoundingClientRect();
  const f = document.activeElement, fr = f && f !== document.body ? f.getBoundingClientRect() : null;
  return { scrollY: Math.round(scrollY), docH: document.documentElement.scrollHeight, rootFont: document.documentElement.style.fontSize || '100%',
    title: { fontSize: getComputedStyle(t).fontSize, wdth: getComputedStyle(t).fontVariationSettings, fit: t.dataset.fit || null }, headerBottom: q(h.bottom), navTop: q(nav.top),
    active: f === document.body ? 'body' : f.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40),
    focusClear: fr ? { top: q(fr.top), bottom: q(fr.bottom), belowHeader: fr.top >= h.bottom - 0.5, aboveNav: fr.bottom <= nav.top + 0.5 } : null };`;
const STATE = `(() => { ${STATE_BODY} })()`;
// Text-scale change while scrolled: set the root size, wait two frames (the fit runs on the body resize), record.
const scaleTo = (pct) => `new Promise((res) => { document.documentElement.style.fontSize = '${pct}%'; requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => res((() => { ${STATE_BODY} })()), 120))); })`;
const STEPS = [
  { record: 'initial' },
  { scroll: 300, record: 'scrolled-300' },
  { record: 'resize-event', js: `(() => { dispatchEvent(new Event('resize')); return (() => { ${STATE_BODY} })(); })()` },
  { record: 'text-100-while-scrolled', js: scaleTo(100), wait: 50 },
  { record: 'text-200-while-scrolled', js: scaleTo(200), wait: 50, shot: 'after-scale-roundtrip' },
  { focus: '.ev:nth-child(4) .ev__link', record: 'focus-round-23' },
  { focus: '.ev:nth-child(1) .ev__link', record: 'focus-round-20', shot: 'focus-round-20' },
];

export default {
  name: 'calendar-title-fit',
  baseline: '../../calendar',
  pilot: '.',
  viewports: [[390, 844], [320, 693]],
  textScales: [100, 200],
  pages: [
    { id: 'en', file: 'index.html', queries: STATES },
    { id: 'es', file: 'index.es.html', queries: STATES },
  ],
  runs: [
    ...['en', 'es'].flatMap((page) => [[390, 844, 100], [320, 693, 200]].map(([w, h, scale]) =>
      ({ name: `${page}-${w}x${h}-${scale}-focus`, page, query: STATES.failed, viewport: [w, h], scale, action: 'focus' }))),
    ...['en', 'es'].map((page) => ({ name: `${page}-default-320x693-200-focus`, page, query: '', viewport: [320, 693], scale: 200, action: 'focus' })),
    ...['en', 'es'].map((page) => ({ name: `${page}-390x844-100-pointer`, page, query: '', viewport: [390, 844], action: 'forced', states: FORCED })),
    { name: 'en-390x844-100-reduced-motion', page: 'en', query: STATES.failed, viewport: [390, 844], action: 'scroll', media: { reducedMotion: true } },
    ...['en', 'es'].flatMap((page) => ['', STATES.failed].map((query) =>
      ({ name: `${page}-${query ? 'failed' : 'default'}-320x693-200-steps`, page, query, viewport: [320, 693], scale: 200, action: 'steps', steps: STEPS }))),
  ],
  stateProbe: STATE,
  probes: { title: TITLE, header: HEADER },
  saveShots: 'first',
};
