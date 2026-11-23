// Grand Prix Detail pilot: approved ../../grand-prix-detail/ vs ../grand-prix-detail/.
// Scenario A (index: upcoming Belgian GP, round 13, sprint weekend, five
// scheduled sessions, results not available yet), Scenario B (results:
// completed Italian GP, round 12, final race classification of three rows),
// each with the three pre-rendered clock modes (?time=device|event|both,
// gpd.js), and the 26-frame development gallery (loading, not found,
// first-load failure, stale, refresh failed, missing values, unknown / cancelled
// / postponed sessions, no sessions, results loading / unavailable / failure /
// refresh failed, provisional, fastest lap, finish statuses, duplicates,
// unresolved names, status vocabulary, fixture banner). Fixture data only.
//
// Plus the DEVELOPMENT-ONLY title stress page (../grand-prix-detail/stress-title/):
// no approved fixture truncates the app-bar title, so the same markup with an
// existing long 2026 event name is rendered with the approved assets
// (baseline/title[.es].html, the baseline) and with the pilot's (title[.es].html). Same file names in
// both folders, so in-page hash links resolve identically.
import { detailConfig } from './detail-common.mjs';

const TIME = { device: '', event: 'time=event', both: 'time=both' };

// App-bar title vs the full name (task §3): visual truncation, the full text, the heading in the same frame,
// the back target, overlap and containment. One record per visible detail app bar.
const TITLES = `(() => [...document.querySelectorAll('.dbar')].filter((b) => b.getClientRects().length).map((b) => {
  const t = b.querySelector('.dbar__title'), k = b.querySelector('.dbar__back'), h = b.parentElement.querySelector('.gp__name'); const r = (e) => e.getBoundingClientRect();
  const rb = r(b), rt = r(t), rk = r(k);
  return { text: t.textContent, attr: t.getAttribute('title'), heading: h ? h.textContent : null, ellipsized: t.scrollWidth > t.clientWidth + 1,
    shown: t.clientWidth, needed: t.scrollWidth, back: [Math.round(rk.width * 100) / 100, Math.round(rk.height * 100) / 100],
    overlap: rk.right > rt.left + 0.5, inside: rt.right <= rb.right - parseFloat(getComputedStyle(b).paddingRight) + 0.5 && rt.left >= rb.left, barH: Math.round(rb.height * 100) / 100 }; }))()`;

const DATA = `(() => { const t = (e) => (e ? e.textContent.trim().replace(/\\s+/g, ' ') : null); const all = (s, r = document) => [...r.querySelectorAll(s)];
  return {
    vw: innerWidth, titles: ${TITLES},
    names: all('.gp__name').map(t), officials: all('.gp__official').map(t), rounds: all('.gp__round').map(t), seasons: all('.gp__season').map(t),
    chips: all('.gp__chips .chip').map(t), facts: all('.gp__facts > div').map(t),
    circuits: all('a.cx').map((a) => ({ href: a.getAttribute('href'), label: a.getAttribute('aria-label') })), zones: all('.zones > div').map(t),
    scheds: all('.sched').map((s) => ({ mode: s.dataset.mode, visible: s.getClientRects().length > 0,
      days: all('.day', s).map((d) => ({ label: t(d.querySelector('.day__label')), sessions: all('.sess', d).map((x) => ({ t1: t(x.querySelector('.sess__t1')), t2: t(x.querySelector('.sess__t2')),
        name: t(x.querySelector('.sess__name')), status: t(x.querySelector('.sess__status')) })) })) })),
    classifications: all('.cls').map((ol) => ({ head: all('.section-title, .chip', ol.parentElement.querySelector('.sec__head') || document.createElement('i')).map(t),
      rows: all('.cl', ol).map((li) => ({ winner: li.classList.contains('cl--winner'), kicker: t(li.querySelector('.cl__kicker')), pos: t(li.querySelector('.cl__pos')), name: t(li.querySelector('.cl__name')),
        team: t(li.querySelector('.cl__team')), teamHref: li.querySelector('.cl__team')?.getAttribute('href') ?? null, driverHref: li.querySelector('.cl__hit')?.getAttribute('href') ?? null,
        label: li.querySelector('.cl__hit')?.getAttribute('aria-label') ?? null, vals: t(li.querySelector('.cl__val')) })) })),
    sectionTitles: all('.section-title').map(t), empties: all('.empty__title').map(t), retries: all('.empty .btn').length,
    notices: all('.notice').map(t), skeletons: all('.skel').length, frames: all('section.spec').length }; })()`;

// Applies to every visible bar that has an identity heading in its frame (main pages, stress frames, gallery frames).
const titleRules = [
  ['full-name-in-heading-title-text-and-attribute', (d) => d.titles.filter((x) => x.heading !== null).every((x) => x.heading === x.text && x.attr === x.text)],
  ['back-target-48px', (d) => d.titles.every((x) => x.back[0] >= 48 && x.back[1] >= 48)],
  ['no-overlap-title-inside-bar', (d) => d.titles.every((x) => !x.overlap && x.inside)],
];
const L = {
  en: { round: 'Round', sprint: 'Sprint weekend', upcoming: 'Upcoming', scheduled: 'Scheduled', unavailable: 'Results not available yet', race: 'Race results', winner: 'Winner', completed: 'Completed' },   // completed = the event chip
  es: { round: 'Ronda', sprint: 'Fin de semana al sprint', upcoming: 'Próximo', scheduled: 'Programada', unavailable: 'Resultados aún no disponibles', race: 'Resultados de la carrera', winner: 'Ganador', completed: 'Finalizado' },   // event chip (sessions read 'Finalizada')
};
const sessionsOf = (d, mode) => d.scheds.find((s) => s.mode === mode).days.flatMap((x) => x.sessions);
const scenarioA = (lang) => [
  ...titleRules,
  ['belgian-round-13-identity', (d) => d.names.join() === 'Belgian Grand Prix' && d.rounds[0].endsWith('13') && d.rounds[0].startsWith(L[lang].round) && /2026/.test(d.seasons[0])
    && d.officials.join() === 'Formula 1 Mock Belgian Grand Prix 2026'],
  ['upcoming-and-sprint-weekend-chips', (d) => d.chips.join('|') === `${L[lang].upcoming}|${L[lang].sprint}`],
  ['circuit-link', (d) => d.circuits.length === 1 && d.circuits[0].href === '#circuits/spa-francorchamps' && d.circuits[0].label.endsWith('Circuit de Spa-Francorchamps')],
  ['five-sessions-sprint-kept-in-order', (d) => ['device', 'event', 'both'].every((m) => sessionsOf(d, m).map((s) => s.name).join('|') === 'Practice 1|Sprint Qualifying|Sprint|Qualifying|Race')],
  ['all-sessions-scheduled', (d) => sessionsOf(d, 'device').every((s) => s.status === L[lang].scheduled)],
  ['device-clock-default-utc', (d) => d.scheds.filter((s) => s.visible).map((s) => s.mode).join() === 'device' && sessionsOf(d, 'device')[0].t1 === '10:30 UTC'],
  ['event-clock-cest-both-adds-device', (d) => sessionsOf(d, 'event')[0].t1 === '12:30 CEST' && sessionsOf(d, 'both')[0].t1 === '12:30 CEST' && sessionsOf(d, 'both')[0].t2 === '10:30 UTC'],
  ['time-zones-shown', (d) => d.zones.join('|').includes('Europe/Brussels') && d.zones.join('|').includes('UTC')],
  ['no-classification-results-not-available', (d) => d.classifications.length === 0 && d.empties.join() === L[lang].unavailable],
];
const scenarioB = (lang) => [
  ...titleRules,
  ['italian-round-12-completed', (d) => d.names.join() === 'Italian Grand Prix' && d.rounds[0].endsWith('12') && d.officials.length === 0 && d.chips[0] === L[lang].completed],
  ['one-race-classification-no-sprint-results', (d) => d.classifications.length === 1 && d.classifications[0].head[0] === L[lang].race],
  ['order-and-positions-as-delivered', (d) => d.classifications[0].rows.map((r) => `${r.pos} ${r.name}`).join('|') === '1 Max Verstappen|2 Lando Norris|— Charles Leclerc'],
  ['winner-highlight-row-1-only', (d) => d.classifications[0].rows.map((r) => `${r.winner}:${r.kicker}`).join() === `true:${L[lang].winner},false:null,false:null`],
  ['points-timing-and-dnf-not-invented', (d) => { const [a, b, c] = d.classifications[0].rows; return a.vals.startsWith('25') && a.vals.includes('1:15:12.345') && b.vals.startsWith('18') && b.vals.includes('+3.210') && c.vals === 'DNF'; }],
  ['driver-and-team-routes', (d) => d.classifications[0].rows.map((r) => `${r.driverHref} ${r.teamHref}`).join('|')
    === '#drivers/max-verstappen #constructors/red-bull|#drivers/lando-norris #constructors/mclaren|#drivers/charles-leclerc #constructors/ferrari'],
  ['circuit-link', (d) => d.circuits.length === 1 && d.circuits[0].href === '#circuits/monza'],
];
const states = () => [
  ...titleRules,
  ['twenty-six-frames', (d) => d.frames === 26],
  ['loading-skeletons', (d) => d.skeletons >= 1],
  ['retries-offered', (d) => d.retries === 3],
  ['generic-title-while-loading-or-failed', (d) => d.titles.filter((x) => x.heading === null).length >= 1],
];
const stress = () => [
  ...titleRules,
  ['truncation-exercised-at-320-200', (d) => d.vw >= 390 || d.titles.some((x) => x.ellipsized)],
];

export default detailConfig({
  name: 'grand-prix-detail',
  baseline: '../../grand-prix-detail',
  pilot: '../grand-prix-detail',
  scenarios: ['index', 'results'],
  queries: { index: TIME, results: TIME },
  forced: [
    ['index', [['.dbar__back', 'hover'], ['.dbar__back', 'active'], ['.cx', 'hover'], ['.cx', 'active']]],
    ['results', [['.cl--winner .cl__hit', 'hover'], ['.cl--winner .cl__hit', 'active'], ['.cl:nth-child(2) .cl__team', 'hover'], ['.cl:nth-child(2) .cl__team', 'active']]],
    // GP has no .btn:hover (Driver, Team, Circuit do): forcing it must change nothing in either version.
    ['states', [['.btn', 'hover'], ['.btn', 'active']]],
  ],
  data: DATA,
  dataAssert: { 'en-index': scenarioA('en'), 'es-index': scenarioA('es'), 'en-results': scenarioB('en'), 'es-results': scenarioB('es'),
    'en-states': states(), 'es-states': states(), 'en-stress': stress(), 'es-stress': stress() },
  extraPages: [
    // Development-only: the baseline copy (same file name, own folder) links the approved assets.
    { id: 'en-stress', file: '../consolidation-pilot/grand-prix-detail/stress-title/baseline/title.html', pilotFile: 'stress-title/title.html', capture: 'segments' },
    { id: 'es-stress', file: '../consolidation-pilot/grand-prix-detail/stress-title/baseline/title.es.html', pilotFile: 'stress-title/title.es.html', capture: 'segments' },
  ],
  extraRuns: [
    ...['en', 'es'].map((lang) => ({ name: `${lang}-stress-320x693-200-focus`, page: `${lang}-stress`, viewport: [320, 693], scale: 200, action: 'focus' })),
    { name: 'en-index-both-390x844-100-reduced-motion', page: 'en-index', query: TIME.both, viewport: [390, 844], action: 'scroll', media: { reducedMotion: true } },
  ],
  probes: { titles: TITLES },
});
