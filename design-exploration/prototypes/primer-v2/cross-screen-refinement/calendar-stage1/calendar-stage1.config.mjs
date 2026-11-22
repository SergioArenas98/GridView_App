// Calendar Stage 1 EXPERIMENT (Step 48E): the visually approved title-fit
// variant ../calendar-title-fit/ (A, baseline) vs this folder (B, Stage 1).
// Run with the consolidation tool, unchanged:
//
//   node ../../consolidation-pilot/tools/visual-compare.mjs calendar-stage1.config.mjs
//   node ../../consolidation-pilot/tools/visual-compare.mjs calendar-stage1.config.mjs --control
//   node ../../consolidation-pilot/tools/visual-compare.mjs calendar-stage1-vs-stage2.config.mjs
//
// Differences are EXPECTED against A (the status block moved); the run exits 1
// by design. What must hold is in REPORT.md: visible text, link targets,
// accessible names, focus order and touch targets identical; the only
// structural change is the status block moving from the header to <main>.
// Measured geometry and dynamic behaviour for A, B and C: stage1-checks.mjs.
//
// Coverage: EN, ES × 390×844, 320×693, 693×320 × 100%, 200% × default,
// refreshing, stale, failed (full-page scroll capture); keyboard frames at
// 320×693, 693×320 and 390×844 @200% for every state (initial, mid-list,
// round 22 and round 23 focused by Tab, bottom); focus walks; forced pointer
// states; reduced motion.
const STATES = { default: '', refreshing: 'state=refreshing', stale: 'state=stale', failed: 'state=failed' };
const FORCED = [['.icon-btn', 'hover'], ['.icon-btn', 'active'], ['.ev:nth-child(2) .ev__link', 'hover'], ['.ev:nth-child(2) .ev__link', 'active'],
  ['.ev--next .ev__link', 'hover'], ['.ev--next .ev__link', 'active'], ['.tab:not(.is-selected)', 'hover']];

// Measured in the page, identical expression for every version.
const R = 'const q = (v) => Math.round(v * 100) / 100;';
const HEADER = `(() => { ${R} const h = document.querySelector('.appbar--sticky').getBoundingClientRect(), s = document.getElementById('season').getBoundingClientRect(),
  n = document.querySelector('.tabbar').getBoundingClientRect(), t = document.querySelector('.wordmark'), H = innerHeight, de = document.documentElement;
  const status = [...document.querySelectorAll('.freshness, .notice')].filter((e) => !e.hidden).map((e) => (e.closest('header') ? 'header:' : 'main:') + (e.dataset.state));
  return { titleRow: de.dataset.titleRow || null, pinTop: de.style.getPropertyValue('--cal-pin-top') || null, pinnedH: de.style.getPropertyValue('--cal-pinned-h') || null,
    title: { fontSize: getComputedStyle(t).fontSize, fit: t.dataset.fit || null }, headerH: q(h.height), seasonH: q(s.height), navH: q(n.height),
    listViewport: q(n.top - Math.max(0, h.bottom)), listViewportPct: q(((n.top - Math.max(0, h.bottom)) / H) * 100), status, docH: de.scrollHeight }; })()`;
const STATE = `(() => { ${R} const h = document.querySelector('.appbar--sticky').getBoundingClientRect(), n = document.querySelector('.tabbar').getBoundingClientRect();
  const f = document.activeElement, fr = f && f !== document.body ? f.getBoundingClientRect() : null, top = Math.max(0, h.bottom);
  return { scrollY: Math.round(scrollY), pinnedBottom: q(top), navTop: q(n.top), active: f === document.body ? 'body' : (f.getAttribute('aria-label') || f.textContent).trim().replace(/\\s+/g, ' ').slice(0, 40),
    focusClear: fr ? fr.top >= top - 0.5 && fr.bottom <= n.top + 0.5 : null, focusTopHidden: fr ? q(Math.max(0, top - fr.top)) : null, focusBottomHidden: fr ? q(Math.max(0, fr.bottom - n.top)) : null }; })()`;
const MID = `(() => { scrollTo(0, Math.round((document.documentElement.scrollHeight - innerHeight) / 2)); return ${STATE}; })()`;
const BOTTOM = `(() => { scrollTo(0, document.documentElement.scrollHeight); return ${STATE}; })()`;
const TOP = `(() => { scrollTo(0, 0); return ${STATE}; })()`;
// Keyboard frames: Refresh, Settings, then the race rows (round 22 = 5th stop, round 23 = 6th).
const tabs = (n) => Array.from({ length: n }, () => ({ key: 'Tab', wait: 120 }));
const KEYBOARD = [
  { record: 'initial', shot: 'initial' },
  { record: 'mid-list', js: MID, shot: 'mid-list' },
  { js: TOP, wait: 150 },
  ...tabs(4), { key: 'Tab', record: 'focused-round-22', shot: 'focused-round-22' },
  { key: 'Tab', record: 'focused-round-23', shot: 'focused-round-23' },
  { record: 'bottom', js: BOTTOM, shot: 'bottom' },
];

export const matrix = {
  viewports: [[390, 844], [320, 693], [693, 320]],
  textScales: [100, 200],
  pages: [
    { id: 'en', file: 'index.html', queries: STATES },
    { id: 'es', file: 'index.es.html', queries: STATES },
  ],
  runs: [
    ...['en', 'es'].flatMap((page) => [[320, 693], [693, 320], [390, 844]].flatMap(([w, h]) => Object.entries(STATES).map(([state, query]) =>
      ({ name: `${page}-${state}-${w}x${h}-200-keyboard`, page, query, viewport: [w, h], scale: 200, action: 'steps', steps: KEYBOARD })))),
    ...['en', 'es'].flatMap((page) => [[390, 844, 100, 'failed'], [320, 693, 200, 'failed'], [320, 693, 200, 'default'], [693, 320, 200, 'failed'], [693, 320, 200, 'default']].map(([w, h, scale, state]) =>
      ({ name: `${page}-${state}-${w}x${h}-${scale}-focus`, page, query: STATES[state], viewport: [w, h], scale, action: 'focus' }))),
    ...['en', 'es'].map((page) => ({ name: `${page}-390x844-100-pointer`, page, query: '', viewport: [390, 844], action: 'forced', states: FORCED })),
    { name: 'en-390x844-100-reduced-motion', page: 'en', query: STATES.failed, viewport: [390, 844], action: 'scroll', media: { reducedMotion: true } },
  ],
  stateProbe: STATE,
  probes: { header: HEADER },
};

export default {
  name: 'calendar-stage1',
  baseline: '../calendar-title-fit',
  pilot: '.',
  outLabel: 'stage1-vs-title-fit',
  ...matrix,
  saveShots: 'all',
};
