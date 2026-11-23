// Explore pilot: approved Alternative B (../../explore/comparison-missing-media/
// cue[.es].html, EX-02) vs ../explore/. Also the two galleries the approved
// Explore folder already has: the missing-media gallery (media-states, same
// folder as B) and the baseline's state fixtures (../states.html: refreshing,
// update failed, empty ×3, first-load error, season unavailable, loading, long
// roster). Fixture data only (test/support/entity_fixtures.dart via the
// generators); nothing added.
const CATEGORIES = { drivers: '', teams: 'category=teams', circuits: 'category=circuits' };
const FORCED_DRIVERS = [['.icon-btn', 'hover'], ['.icon-btn', 'active'], ['.seg__btn[aria-pressed="false"]', 'hover'],
  ['#drivers .ent:nth-child(1) .ent__link', 'hover'], ['#drivers .ent:nth-child(1) .ent__link', 'active'],
  ['#drivers .ent:nth-child(3) .ent__link', 'active'], ['.tab:not(.is-selected)', 'hover']];
const FORCED_TEAMS = [['#teams .ent:nth-child(1) .ent__link', 'hover'], ['#teams .ent:nth-child(1) .ent__link', 'active']];

const TITLE_GAP = `(() => { const t = document.querySelector('.wordmark'), a = document.querySelector('.appbar__actions'); if (!t || !a) return null;
  const r = document.createRange(); r.selectNodeContents(t); return Math.round((a.getBoundingClientRect().left - r.getBoundingClientRect().right) * 100) / 100; })()`;
const HEADER = `(() => { const de = document.documentElement, t = document.querySelector('.appbar--pinned .wordmark'); return document.querySelector('.pinbar') ? {
  header: de.dataset.header || null, appbarH: de.style.getPropertyValue('--appbar-h'), segFit: document.querySelector('.seg').dataset.fit || null,
  titleFit: t.dataset.fit || null, titleInline: t.style.fontSize || null } : null; })()`;
// Team-colour ticks in the visible list and their contrast on the ground (#141518), XS-25.
const ACCENTS = `(() => { const lum = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const g = lum('#141518'); return [...document.querySelectorAll('.ent[style]')].filter((e) => !e.closest('[hidden]')).map((e) => { const c = getComputedStyle(e).getPropertyValue('--accent').trim(); const l = lum(c);
    return e.querySelector('.ent__name').textContent.trim() + ' ' + c + ' ' + ((Math.max(l, g) + 0.05) / (Math.min(l, g) + 0.05)).toFixed(2); }); })()`;
const MEDIA = `(() => ({ slots: document.querySelectorAll('.ent__media').length, lists: [...document.querySelectorAll('ol.lib')].map((l) => l.className) }))()`;
const CATEGORY_STATE = `(() => ({ scrollY: Math.round(scrollY),
  pressed: [...document.querySelectorAll('.seg__btn')].map((b) => b.getAttribute('aria-pressed')),
  hidden: [...document.querySelectorAll('main > section')].map((s) => s.id + ':' + s.hidden),
  active: document.activeElement === document.body ? 'body' : document.activeElement.textContent.trim(),
  header: document.documentElement.dataset.header || null }))()`;
// Media gallery, section 3: text geometry of the interactive list, and the slot states.
const MEDIA_STATE = `(() => { const live = document.getElementById('live'); const r = (e) => { const b = e.getBoundingClientRect(); return [b.x, b.y + scrollY, b.width, b.height].map((v) => Math.round(v * 100) / 100).join(','); };
  return { text: [...live.querySelectorAll('.ent__body, .ent__name, .ent__fig, .ent__go')].map(r), slots: [...live.querySelectorAll('.ent__media')].map((s) => s.dataset.state + ':' + r(s)),
    pressed: [...document.querySelectorAll('[data-set]')].map((b) => b.dataset.set + ':' + b.getAttribute('aria-pressed')) }; })()`;

const CATEGORY_STEPS = [
  { record: 'initial' },
  { scroll: 400, record: 'drivers-scrolled' },
  { click: '.seg__btn[data-target="teams"]', record: 'teams', shot: 'teams' },
  { click: '.seg__btn[data-target="teams"]', record: 'teams-repeat' },
  { scroll: 120, record: 'teams-scrolled' },
  { click: '.seg__btn[data-target="circuits"]', record: 'circuits', shot: 'circuits' },
  { click: '.seg__btn[data-target="drivers"]', record: 'drivers-restored', shot: 'drivers-restored' },
  { click: '.seg__btn[data-target="teams"]', record: 'teams-restored' },
  { focus: '.seg__btn[data-target="drivers"]', key: 'Enter', record: 'kbd-enter-drivers' },
  { focus: '.seg__btn[data-target="circuits"]', key: 'Space', record: 'kbd-space-circuits', shot: 'kbd-space' },
];
const CATEGORY_ASSERT = [
  ['first-switch-at-top', (r) => r.teams.scrollY === 0 && r.teams.pressed.join() === 'false,true,false' && r.teams.hidden.join() === 'drivers:true,teams:false,circuits:true'],
  ['repeat-tap-no-change', (r) => JSON.stringify(r['teams-repeat']) === JSON.stringify(r.teams)],
  ['circuits-at-top', (r) => r.circuits.scrollY === 0 && r.circuits.pressed.join() === 'false,false,true'],
  ['drivers-offset-restored', (r) => r['drivers-restored'].scrollY === r['drivers-scrolled'].scrollY],
  ['teams-offset-restored', (r) => r['teams-restored'].scrollY === r['teams-scrolled'].scrollY],
  ['enter-selects', (r) => r['kbd-enter-drivers'].pressed.join() === 'true,false,false'],
  ['space-selects', (r) => r['kbd-space-circuits'].pressed.join() === 'false,false,true'],
];
const MEDIA_STEPS = [{ scrollTo: '#live' }, ...['loaded', 'failed', 'none', 'loading', 'loaded'].map((state, i) =>
  ({ click: `[data-set="${state}"]`, record: `${i + 1}-${state}`, js: MEDIA_STATE, shot: `${i + 1}-${state}` }))];
const MEDIA_ASSERT = [
  ['no-text-shift-across-states', (r) => new Set(Object.values(r).map((x) => JSON.stringify(x.text))).size === 1],
  ['no-slot-resize-across-states', (r) => new Set(Object.values(r).map((x) => JSON.stringify(x.slots.map((s) => s.split(':')[1])))).size === 1],
  ['state-applied', (r) => Object.entries(r).every(([k, x]) => x.slots.every((s) => s.startsWith(k.split('-')[1] + ':')))],
];

export default {
  name: 'explore',
  baseline: '../../explore/comparison-missing-media',
  pilot: '../explore',
  viewports: [[390, 844], [320, 693]],
  textScales: [100, 200],
  pages: [
    { id: 'en', file: 'cue.html', queries: CATEGORIES },
    { id: 'es', file: 'cue.es.html', queries: CATEGORIES },
    { id: 'en-media', file: 'media-states.html', capture: 'segments' },
    { id: 'es-media', file: 'media-states.es.html', capture: 'segments' },
    // Baseline state gallery: one folder up in the approved tree, flat in the pilot.
    { id: 'en-states', file: '../states.html', pilotFile: 'states.html', capture: 'segments', freezeAnimations: 700 },
    { id: 'es-states', file: '../states.es.html', pilotFile: 'states.es.html', capture: 'segments', freezeAnimations: 700 },
  ],
  runs: [
    ...['en', 'es'].flatMap((page) => [[390, 844, 100], [320, 693, 200]].flatMap(([w, h, scale]) => Object.entries(CATEGORIES).map(([cat, query]) =>
      ({ name: `${page}-${cat}-${w}x${h}-${scale}-focus`, page, query, viewport: [w, h], scale, action: 'focus' })))),
    ...['en', 'es'].flatMap((page) => [
      { name: `${page}-drivers-390x844-100-pointer`, page, query: '', viewport: [390, 844], action: 'forced', states: FORCED_DRIVERS },
      { name: `${page}-teams-390x844-100-pointer`, page, query: CATEGORIES.teams, viewport: [390, 844], action: 'forced', states: FORCED_TEAMS },
    ]),
    ...[['en', 390, 844, 100], ['en', 320, 693, 200], ['es', 390, 844, 100], ['es', 320, 693, 200]].map(([page, w, h, scale]) =>
      ({ name: `${page}-categories-${w}x${h}-${scale}`, page, query: '', viewport: [w, h], scale, action: 'steps', steps: CATEGORY_STEPS, assert: CATEGORY_ASSERT })),
    ...[['en-media', 390, 844, 100], ['en-media', 320, 693, 200], ['es-media', 390, 844, 100], ['es-media', 320, 693, 200]].map(([page, w, h, scale]) =>
      ({ name: `${page}-switch-${w}x${h}-${scale}`, page, query: '', viewport: [w, h], scale, action: 'steps', steps: MEDIA_STEPS, assert: MEDIA_ASSERT })),
    { name: 'en-drivers-390x844-100-reduced-motion', page: 'en', query: '', viewport: [390, 844], action: 'scroll', media: { reducedMotion: true } },
    { name: 'en-states-390x844-100-reduced-motion', page: 'en-states', query: '', viewport: [390, 844], action: 'segments', media: { reducedMotion: true } },
  ],
  stateProbe: CATEGORY_STATE,
  probes: { titleGap: TITLE_GAP, header: HEADER, accents: ACCENTS, media: MEDIA },
  saveShots: 'first',
};
