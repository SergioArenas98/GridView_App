// Calendar sticky-split EXPERIMENT (Step 48C): the visually approved title-fit
// variant ../calendar-title-fit/ (baseline, "before") vs this folder ("after").
// Run with the consolidation tool, unchanged:
//
//   node ../../consolidation-pilot/tools/visual-compare.mjs calendar-sticky-split.config.mjs
//   node ../../consolidation-pilot/tools/visual-compare.mjs calendar-sticky-split.config.mjs --control
//
// Differences are EXPECTED (the header structure changed); the run exits 1 by
// design. What must hold is in REPORT.md §4: visible text, link targets,
// accessible names, focus order and touch targets stay identical; the only
// structural change is the status block moving from the header to <main>.
// Measured geometry and dynamic behaviour: dynamic-checks.mjs.
//
// Coverage: EN, ES × 390×844, 320×693 × 100%, 200% × default, refreshing,
// stale, failed (full-page scroll capture); the four critical frames at
// 320×693 @200% for every state (initial, mid-list, focused race row, bottom);
// focus walks; forced pointer states; reduced motion; landscape @200%.
const STATES = { default: '', refreshing: 'state=refreshing', stale: 'state=stale', failed: 'state=failed' };
const FORCED = [['.icon-btn', 'hover'], ['.icon-btn', 'active'], ['.ev:nth-child(2) .ev__link', 'hover'], ['.ev:nth-child(2) .ev__link', 'active'],
  ['.ev--next .ev__link', 'hover'], ['.ev--next .ev__link', 'active'], ['.tab:not(.is-selected)', 'hover']];

// Measured in the page, identical expression for both versions.
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
    focusClear: fr ? fr.top >= top - 0.5 && fr.bottom <= n.top + 0.5 : null }; })()`;
const MID = `(() => { scrollTo(0, Math.round((document.documentElement.scrollHeight - innerHeight) / 2)); return ${STATE}; })()`;
const BOTTOM = `(() => { scrollTo(0, document.documentElement.scrollHeight); return ${STATE}; })()`;
// The four critical frames (320×693 @200%): initial, mid-list, a keyboard-focused race row, bottom of the list.
const CRITICAL = [
  { record: 'initial', shot: 'initial' },
  { record: 'mid-list', js: MID, shot: 'mid-list' },
  { focus: '.ev:nth-child(3) .ev__link', record: 'focused-round-22', shot: 'focused-round-22' },
  { record: 'bottom', js: BOTTOM, shot: 'bottom' },
];

export default {
  name: 'calendar-sticky-split',
  baseline: '../calendar-title-fit',
  pilot: '.',
  outLabel: 'experiment',
  viewports: [[390, 844], [320, 693]],
  textScales: [100, 200],
  pages: [
    { id: 'en', file: 'index.html', queries: STATES },
    { id: 'es', file: 'index.es.html', queries: STATES },
  ],
  runs: [
    ...['en', 'es'].flatMap((page) => Object.entries(STATES).map(([state, query]) =>
      ({ name: `${page}-${state}-320x693-200-critical`, page, query, viewport: [320, 693], scale: 200, action: 'steps', steps: CRITICAL }))),
    ...['en', 'es'].flatMap((page) => [[390, 844, 100, 'failed'], [320, 693, 200, 'failed'], [320, 693, 200, 'default'], [693, 320, 200, 'failed']].map(([w, h, scale, state]) =>
      ({ name: `${page}-${state}-${w}x${h}-${scale}-focus`, page, query: STATES[state], viewport: [w, h], scale, action: 'focus' }))),
    ...['en', 'es'].map((page) => ({ name: `${page}-failed-693x320-200-landscape`, page, query: STATES.failed, viewport: [693, 320], scale: 200, action: 'scroll' })),
    ...['en', 'es'].map((page) => ({ name: `${page}-390x844-100-pointer`, page, query: '', viewport: [390, 844], action: 'forced', states: FORCED })),
    { name: 'en-390x844-100-reduced-motion', page: 'en', query: STATES.failed, viewport: [390, 844], action: 'scroll', media: { reducedMotion: true } },
  ],
  stateProbe: STATE,
  probes: { header: HEADER },
  saveShots: 'all',
};
