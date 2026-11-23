// Standings pilot: approved ../../standings/ vs ../standings/.
// Main pages (frozen staging data, Drivers and Constructors) and the
// development fixture galleries (leader, tie, delivered order, unranked,
// missing name/team, decimal points, provisional uniform/mixed, refreshing,
// last check 09:05 + stale, failed, empty, error, season unavailable, loading).
// No data or timestamps beyond those already in the prototype.
const VIEWS = { drivers: '', constructors: 'championship=constructors' };
const FORCED = [['.icon-btn', 'hover'], ['.icon-btn', 'active'], ['.seg__btn[aria-pressed="false"]', 'hover'],
  ['.st--leader .st__link', 'hover'], ['.st--leader .st__link', 'active'],
  ['.st:nth-child(3) .st__link', 'hover'], ['.st:nth-child(3) .st__link', 'active'], ['.tab:not(.is-selected)', 'hover']];

const TITLE_GAP = `(() => { const t = document.querySelector('.wordmark'), a = document.querySelector('.appbar__actions'); if (!t || !a) return null;
  const r = document.createRange(); r.selectNodeContents(t); return Math.round((a.getBoundingClientRect().left - r.getBoundingClientRect().right) * 100) / 100; })()`;
const TITLE_FIT = `(() => { const t = document.querySelector('.appbar--pinned .wordmark'); return t ? { fit: t.dataset.fit || null, inlineSize: t.style.fontSize || null, wdth: getComputedStyle(t).fontVariationSettings } : null; })()`;
const HEADER = `(() => { const de = document.documentElement; return document.querySelector('.pinbar') ? { header: de.dataset.header || null, appbarH: de.style.getPropertyValue('--appbar-h'), segFit: document.querySelector('.seg').dataset.fit || null } : null; })()`;
const STATE = `(() => ({ scrollY: Math.round(scrollY),
  pressed: [...document.querySelectorAll('.seg__btn')].map((b) => b.getAttribute('aria-pressed')),
  hidden: [...document.querySelectorAll('main > section')].map((s) => s.id + ':' + s.hidden),
  active: document.activeElement === document.body ? 'body' : document.activeElement.textContent.trim(),
  header: document.documentElement.dataset.header || null, segFit: document.querySelector('.seg').dataset.fit || null }))()`;

// Selector switching and per-table scroll restoration (README "Behaviour").
const SELECTOR_STEPS = [
  { record: 'initial' },
  { scroll: 400, record: 'drivers-scrolled' },
  { click: '.seg__btn[data-target="constructors"]', record: 'constructors', shot: 'constructors' },
  { click: '.seg__btn[data-target="constructors"]', record: 'constructors-repeat' },
  { scroll: 60, record: 'constructors-scrolled' },
  { click: '.seg__btn[data-target="drivers"]', record: 'drivers-restored', shot: 'drivers-restored' },
  { click: '.seg__btn[data-target="constructors"]', record: 'constructors-restored' },
  { focus: '.seg__btn[data-target="drivers"]', key: 'Enter', record: 'kbd-enter-drivers' },
  { focus: '.seg__btn[data-target="constructors"]', key: 'Space', record: 'kbd-space-constructors', shot: 'kbd-space' },
];
const SELECTOR_ASSERT = [
  ['first-switch-at-top', (r) => r.constructors.scrollY === 0 && r.constructors.pressed.join() === 'false,true' && r.constructors.hidden.join() === 'drivers:true,constructors:false'],
  ['repeat-tap-no-change', (r) => JSON.stringify(r['constructors-repeat']) === JSON.stringify(r.constructors)],
  ['drivers-offset-restored', (r) => r['drivers-restored'].scrollY === r['drivers-scrolled'].scrollY && r['drivers-restored'].pressed.join() === 'true,false'],
  ['constructors-offset-restored', (r) => r['constructors-restored'].scrollY === r['constructors-scrolled'].scrollY],
  ['enter-selects', (r) => r['kbd-enter-drivers'].pressed.join() === 'true,false'],
  ['space-selects', (r) => r['kbd-space-constructors'].pressed.join() === 'false,true'],
];

export default {
  name: 'standings',
  baseline: '../../standings',
  pilot: '../standings',
  viewports: [[390, 844], [320, 693]],
  textScales: [100, 200],
  pages: [
    { id: 'en', file: 'index.html', queries: VIEWS },
    { id: 'es', file: 'index.es.html', queries: VIEWS },
    { id: 'en-states', file: 'states.html', capture: 'segments' },
    { id: 'es-states', file: 'states.es.html', capture: 'segments' },
  ],
  runs: [
    ...['en', 'es'].flatMap((page) => [[390, 844, 100], [320, 693, 200]].flatMap(([w, h, scale]) => Object.entries(VIEWS).map(([view, query]) =>
      ({ name: `${page}-${view}-${w}x${h}-${scale}-focus`, page, query, viewport: [w, h], scale, action: 'focus' })))),
    ...['en', 'es'].map((page) => ({ name: `${page}-drivers-390x844-100-pointer`, page, query: '', viewport: [390, 844], action: 'forced', states: FORCED })),
    ...[['en', 390, 844, 100], ['en', 320, 693, 200], ['es', 390, 844, 100], ['es', 320, 693, 200]].map(([page, w, h, scale]) =>
      ({ name: `${page}-selector-${w}x${h}-${scale}`, page, query: '', viewport: [w, h], scale, action: 'steps', steps: SELECTOR_STEPS, assert: SELECTOR_ASSERT })),
    { name: 'en-drivers-390x844-100-reduced-motion', page: 'en', query: '', viewport: [390, 844], action: 'scroll', media: { reducedMotion: true } },
  ],
  stateProbe: STATE,
  probes: { titleGap: TITLE_GAP, titleFit: TITLE_FIT, header: HEADER },
  saveShots: 'first',
};
