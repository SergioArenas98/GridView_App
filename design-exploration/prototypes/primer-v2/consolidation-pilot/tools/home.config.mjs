// Home pilot (Step 46, 2026-11-10): approved ../../refinement-01/ vs ../home/.
// Home has one rendered state per language (the frozen staging scenario; its
// conditional states are not rendered, HOME-04) and no URL parameters.
// Coverage: EN and ES × 390×844 / 320×693 × 100% / 200% text, full scroll
// capture; keyboard walks at every size; forced :hover / :active on every
// interactive pattern; every hash route and keyboard activation; data checks
// read from lib/l10n/app_*.arb (never retyped), true in both versions;
// reduced motion.
import { ARB } from './settings-common.mjs';

const LANGS = [['en', 'index.html'], ['es', 'index.es.html']];
const SIZES = [[390, 844, 100], [390, 844, 200], [320, 693, 100], [320, 693, 200]];

/** ARB value with placeholders filled; ICU plural resolved to its `other` branch (count > 1). */
const arb = (lang, key, args = {}) => {
  let v = ARB[lang][key];
  const plural = v.match(/^\{\w+, plural, .*other\{(.*)\}\}$/);
  if (plural) v = plural[1];
  return Object.entries(args).reduce((t, [k, a]) => t.split(`{${k}}`).join(a), v);
};

// Every interactive pattern and its pointer states (pointer runs at 390×844 / 100%).
const FORCED = [
  ['.icon-btn', 'hover'], ['.icon-btn', 'active'], ['.icon-btn + .icon-btn', 'hover'],
  ['.hero', 'hover'], ['.hero__action', 'active'],
  ['.session', 'hover'], ['.session', 'active'],
  ['.leader__link', 'hover'], ['.leader + .leader .leader__link', 'active'],
  ['.result .text-link', 'hover'], ['.result .text-link', 'active'], ['.text-link--ember', 'hover'],
  ['.explore__strip li:nth-child(2) a', 'hover'], ['.explore__strip li:nth-child(2) a', 'active'],
  ['.tab.is-selected', 'hover'], ['.tab:not(.is-selected)', 'hover'], ['.tab:not(.is-selected)', 'active'],
];

// Home composition probe: the layout switches that depend on width and text size.
const HOME = `(() => { const q = (s) => document.querySelector(s); const r = (e) => e.getBoundingClientRect(); const px = (v) => Math.round(v * 100) / 100;
  const cols = (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length;
  return { heroStrip: cols(q('.hero__top')) === 1, heroH: px(r(q('.hero')).height), roundNum: getComputedStyle(q('.hero__round-num')).fontSize,
    sessionCols: cols(q('.session')), champH: px(r(q('.champ')).height), leaderPoints: [...document.querySelectorAll('.leader__points .num')].map((e) => getComputedStyle(e).fontSize),
    exploreCols: cols(q('.explore__strip')), mainPadBottom: getComputedStyle(q('main.home')).paddingBottom, docH: document.documentElement.scrollHeight }; })()`;

// The rendered record: texts, classes that carry meaning, and raw hrefs.
const T = `(e) => (e ? e.textContent.trim().replace(/\\s+/g, ' ') : null)`;
const DATA = `(() => { const t = ${T}; const q = (s) => document.querySelector(s); const all = (s) => [...document.querySelectorAll(s)];
  const link = (a) => [t(a), a.getAttribute('href')];
  return { lang: document.documentElement.lang, wordmark: t(q('.wordmark')), season: t(q('.season')), freshness: t(q('.freshness')),
    actions: all('.appbar__actions button').map((b) => b.getAttribute('aria-label')),
    hero: { kind: t(q('.hero__kind')), when: t(q('.hero__when')), chips: all('.hero .chip').map((c) => [t(c), c.className]), round: t(q('.hero__round')),
      name: t(q('.hero__name')), circuit: t(q('.hero__circuit')), action: link(q('.hero__action')), labelledBy: t(document.getElementById(q('.hero').getAttribute('aria-labelledby'))) },
    sessions: { title: t(q('#sessions-title')), items: all('.session').map((s) => ({ focus: t(s.querySelector('.session__focus')), name: t(s.querySelector('.session__name')),
      time: t(s.querySelector('.session__time')), date: t(s.querySelector('.session__date')), status: [t(s.querySelector('.session__status')), s.querySelector('.session__status').className], href: s.getAttribute('href') })),
      tz: t(q('.sessions__tz')) },
    leaders: all('.leader').map((l) => ({ label: t(l.querySelector('.leader__label')), points: t(l.querySelector('.leader__points .num')), unit: t(l.querySelector('.leader__unit')),
      name: t(l.querySelector('.leader__name')), team: t(l.querySelector('.leader__team')), link: link(l.querySelector('.leader__link')) })),
    result: { title: t(q('#result-title')), chip: [t(q('.result .chip')), q('.result .chip').className], mark: [t(q('.result__mark')), q('.result__mark').getAttribute('aria-hidden')],
      event: t(q('.result__event')), meta: t(q('.result__meta')), tag: t(q('.result .tag')), driver: t(q('.result__driver')), team: t(q('.result__team')), link: link(q('.result .text-link')) },
    upcoming: { title: t(q('#upcoming-title')), empty: t(q('.upcoming__empty')), link: link(q('.upcoming .text-link')), items: all('.upcoming li').length },
    explore: { title: t(q('#explore-title')), links: all('.explore__strip a').map(link) },
    tabs: all('.tab').map((a) => [t(a), a.getAttribute('href'), a.getAttribute('aria-current'), a.classList.contains('is-selected')]),
    notices: all('.notice, [role="alert"], [role="status"]').length }; })()`;

const dataAssert = (lang) => {
  const a = (k, args) => arb(lang, k, args);
  return [
    ['app-bar', (d) => d.wordmark === 'GridView' && d.season === a('seasonLabel', { season: '2026' }) && d.freshness === a('homeUpdated', { time: '4:22' })
      && d.actions.join('|') === [a('homeRefreshAction'), a('settingsOpen')].join('|')],
    ['hero-copy-and-round', (d) => d.hero.kind === a('homeNextGrandPrix') && d.hero.labelledBy === d.hero.kind && d.hero.when === a('homeStartsInDays', { count: 2 })
      && d.hero.round === a('roundLabel', { round: 23 }) && d.hero.action[0] === a('homeOpenGrandPrix') && d.hero.action[1] === '#grand-prix'],
    ['event-status-stays-unknown-dashed', (d) => d.hero.chips.length === 1 && d.hero.chips[0][0] === a('eventStateUnknown') && d.hero.chips[0][1] === 'chip chip--unknown'],
    ['api-names-as-delivered', (d) => d.hero.name === 'Abu Dhabi Grand Prix' && d.hero.circuit === 'Yas Marina Circuit' && d.result.event === 'Qatar Grand Prix'],
    ['one-focused-session-unknown-status', (d) => d.sessions.title === a('homeSessions') && d.sessions.items.length === 1 && d.sessions.items[0].focus === a('homeNextSession')
      && d.sessions.items[0].status[0] === a('sessionStateUnknown') && /chip--unknown/.test(d.sessions.items[0].status[1]) && d.sessions.items[0].href === '#grand-prix'
      && d.sessions.tz.startsWith(a('fieldDeviceTimeZone'))],
    ['two-leaders-with-links', (d) => d.leaders.length === 2 && d.leaders[0].label === a('homeDriversLeaderTitle') && d.leaders[1].label === a('homeTeamsLeaderTitle')
      && d.leaders[0].link.join('|') === `${a('driverViewStandings')}|#standings-drivers` && d.leaders[1].link.join('|') === `${a('teamViewStandings')}|#standings-constructors`
      && d.leaders[1].team === null],
    ['result-final-winner', (d) => d.result.title === a('homeLatestResult') && d.result.chip[0] === a('resultStatusFinal') && d.result.chip[1] === 'chip chip--final'
      && d.result.tag === a('homeWinnerLabel') && d.result.meta.startsWith(a('roundLabel', { round: 22 })) && d.result.mark.join('|') === '22|true'
      && d.result.link.join('|') === `${a('homeOpenGrandPrix')}|#grand-prix-qatar`],
    ['upcoming-known-empty', (d) => d.upcoming.title === a('homeUpcoming') && d.upcoming.empty === a('homeNoUpcomingEvents') && d.upcoming.items === 0
      && d.upcoming.link.join('|') === `${a('homeViewCalendar')}|#calendar`],
    ['explore-shortcuts', (d) => d.explore.title === a('homeQuickLinks')
      && JSON.stringify(d.explore.links) === JSON.stringify([[a('exploreDrivers'), '#drivers'], [a('exploreTeams'), '#teams'], [a('exploreCircuits'), '#circuits']])],
    ['nav-home-selected-only', (d) => JSON.stringify(d.tabs) === JSON.stringify([[a('navHome'), '#home', 'page', true], [a('navCalendar'), '#calendar', null, false],
      [a('navStandings'), '#standings', null, false], [a('navExplore'), '#explore', null, false]])],
    ['no-conditional-notice-rendered', (d) => d.notices === 0 && d.lang === lang],
  ];
};

// Navigation: every hash link in document order; nothing leaves the page.
const LINK_LABEL = `(a) => (a.getAttribute('aria-label') || a.textContent.trim().replace(/\\s+/g, ' ')).slice(0, 60)`;
const CLICK_ALL_LINKS = `(() => { const label = ${LINK_LABEL}; const links = [...document.querySelectorAll('a[href]')];
  const other = links.filter((a) => !a.getAttribute('href').startsWith('#')).map((a) => a.getAttribute('href'));
  const routes = links.filter((a) => a.getAttribute('href').startsWith('#')).map((a) => { a.click(); return [label(a), a.getAttribute('href'), location.hash]; });
  return { routes, other, file: location.pathname.split('/').pop() }; })()`;
const NAV_STATE = `(() => ({ hash: location.hash, scrollY: Math.round(scrollY), file: location.pathname.split('/').pop(), active: document.activeElement ? (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim().replace(/\\s+/g, ' ')) : null }))()`;

export default {
  name: 'home',
  baseline: '../../refinement-01',
  pilot: '../home',
  outLabel: 'regression',
  viewports: [[390, 844], [320, 693]],
  textScales: [100, 200],
  pages: LANGS.map(([id, file]) => ({ id, file })),
  runs: [
    // Keyboard: Tab through every visible link and button, at every size (the nav changes mode with size).
    ...LANGS.flatMap(([page]) => SIZES.map(([w, h, scale]) => ({ name: `${page}-${w}x${h}-${scale}-focus`, page, viewport: [w, h], scale, action: 'focus' }))),
    // Pointer: forced :hover / :active.
    ...LANGS.map(([page]) => ({ name: `${page}-390x844-100-pointer`, page, viewport: [390, 844], action: 'forced', states: FORCED })),
    ...LANGS.map(([page]) => ({ name: `${page}-320x693-200-pointer`, page, viewport: [320, 693], scale: 200, action: 'forced',
      states: [['.hero', 'hover'], ['.session', 'hover'], ['.explore__strip li:nth-child(2) a', 'hover'], ['.tab:not(.is-selected)', 'hover']] })),
    // Navigation: every hash route; keyboard activation of a link (Enter) and of the hero action.
    ...LANGS.map(([page]) => ({ name: `${page}-390x844-100-navigation`, page, viewport: [390, 844], action: 'steps',
      steps: [{ record: 'links', js: CLICK_ALL_LINKS },
        { focus: '.tab:nth-child(2)', key: 'Enter', record: 'enter-tab' },
        { focus: '.hero__action', key: 'Enter', record: 'enter-hero', shot: 'hero-focus' },
        { focus: '.leader + .leader .leader__link', record: 'focus-champ', shot: 'champ-focus' }],
      assert: [
        ['every-link-opens-its-own-route', (r) => r.links.routes.length === 13 && r.links.routes.every(([, href, hash]) => href === hash)],
        ['no-link-leaves-home', (r) => r.links.other.length === 0 && r['enter-tab'].file === r.links.file],
        ['enter-activates-calendar-tab', (r) => r['enter-tab'].hash === '#calendar'],
        ['enter-activates-hero', (r) => r['enter-hero'].hash === '#grand-prix'],
      ] })),
    // Data: the rendered record against the ARB, at the two key sizes.
    ...LANGS.flatMap(([page]) => [[390, 844, 100], [320, 693, 200]].map(([w, h, scale]) => ({
      name: `${page}-${w}x${h}-${scale}-data`, page, viewport: [w, h], scale, action: 'steps', steps: [{ record: 'data', js: DATA }],
      assert: dataAssert(page).map(([label, fn]) => [label, (r) => fn(r.data)]) }))),
    // Reduced motion.
    ...LANGS.map(([page]) => ({ name: `${page}-390x844-100-reduced-motion`, page, viewport: [390, 844], action: 'scroll', media: { reducedMotion: true } })),
    { name: 'en-320x693-200-reduced-motion', page: 'en', viewport: [320, 693], scale: 200, action: 'scroll', media: { reducedMotion: true } },
  ],
  stateProbe: NAV_STATE,
  probes: { home: HOME },
  saveShots: 'first',
};
