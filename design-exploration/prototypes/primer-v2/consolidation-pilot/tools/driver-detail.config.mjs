// Driver Detail pilot: approved ../../driver-detail/ vs ../driver-detail/.
// Scenario A (index: complete), Scenario B (partial: 404 with a real summary)
// and the development-only state gallery (states: loading skeleton, season
// unavailable, not found, first-load failure, partial, refresh failed, stale,
// permanent-number fallback with no observed boundary, mid-season move,
// unresolved constructor, reserve role, unranked zeros, provisional chip,
// number-only and bare plates, portrait geometry). Fixture data only.
import { detailConfig } from './detail-common.mjs';

// Permanent identity vs season participation, kept apart (task §4). Lists cover every frame of the gallery.
const DATA = `(() => { const t = (e) => (e ? e.textContent.trim().replace(/\\s+/g, ' ') : null); const all = (s, r = document) => [...r.querySelectorAll(s)];
  return {
    names: all('.dp__name').map(t), seasons: all('.dp__season').map(t), nationalities: all('.dp__nat').map(t),
    boards: all('.dp__plate').map((p) => ({ label: t(p.querySelector('.dp__lab')), figure: t(p.querySelector('.dp__fig')), code: t(p.querySelector('.dp__code')), spoken: t(p.querySelector('.sr-only')) })),
    spanLists: all('.stints').map((ul) => all('.st', ul).map((li) => ({ team: t(li.querySelector('.st__team')), fallback: !!li.querySelector('.st__team--fallback'), span: t(li.querySelector('.st__span')),
      facts: all('.st__facts > div', li).map(t), link: li.querySelector('.st__hit')?.getAttribute('href') ?? null }))),
    championship: all('.ch__main > div, .ch__more > div').map(t), standingsLinks: all('.ch__link').map((a) => a.getAttribute('href')),
    facts: all('.fact').map(t), about: all('.about').map(t), notices: all('.notice').map(t), chips: all('.chip').map(t),
    empties: all('.empty__title').map(t), retries: all('.empty .btn').length, skeletons: all('.skel').length, frames: all('.spec').length }; })()`;

const L = {
  en: { start: 'From season start', race: 'Race number', permanent: 'Permanent number', points: '402.5' },
  es: { start: 'Desde el inicio de la temporada', race: 'Dorsal de la temporada', permanent: 'Dorsal permanente', points: '402,5' },
};
const scenarioA = (lang) => [
  ['season-number-on-board-with-its-source', (d) => d.boards.length === 1 && d.boards[0].figure === '1' && d.boards[0].label === L[lang].race && d.boards[0].code === 'VER'],
  ['permanent-number-kept-apart-in-profile', (d) => d.facts.some((f) => f.startsWith(L[lang].permanent) && f.endsWith('33'))],
  ['season-context-on-plate', (d) => d.seasons.length === 1 && /2026/.test(d.seasons[0])],
  ['unknown-start-rule-unchanged', (d) => d.spanLists.length === 1 && d.spanLists[0].length === 1 && d.spanLists[0][0].span === L[lang].start],
  ['relevant-span-links-its-team', (d) => d.spanLists[0][0].link === '#constructors/red-bull'],
  ['championship-figures', (d) => d.championship.join('|').includes(L[lang].points) && d.standingsLinks.join() === '#standings/drivers/2026'],
  ['biography-present', (d) => d.about.length === 1],
];
const scenarioB = (lang) => [
  ['partial-notice-shown', (d) => d.notices.length === 1],
  ['missing-values-omitted-not-invented', (d) => d.nationalities.length === 0 && d.about.length === 0 && d.championship.length === 0 && !d.facts.some((f) => f.startsWith(L[lang].permanent))],
];
const states = (lang) => [
  ['sixteen-frames', (d) => d.frames === 16],
  ['loading-skeleton', (d) => d.skeletons === 1],
  ['three-empty-states-two-retries', (d) => d.empties.length === 3 && d.retries === 2],
  ['permanent-number-fallback-says-so', (d) => d.boards.some((b) => b.label === L[lang].permanent)],
  ['mid-season-move-both-spans-one-link', (d) => d.spanLists.some((l) => l.length === 2 && l.filter((s) => s.link).length === 1)],
  ['unresolved-constructor-fallback-no-link', (d) => d.spanLists.some((l) => l.length === 1 && l[0].fallback && l[0].link === null)],
  ['bare-plate-has-no-board', (d) => d.names.length > d.boards.length],
];

export default detailConfig({
  name: 'driver-detail',
  baseline: '../../driver-detail',
  pilot: '../driver-detail',
  scenarios: ['index', 'partial'],
  forced: [
    ['index', [['.dbar__back', 'hover'], ['.dbar__back', 'active'], ['.st__hit', 'hover'], ['.st__hit', 'active'], ['.ch__link', 'hover'], ['.ch__link', 'active']]],
    ['states', [['.btn', 'hover'], ['.btn', 'active']]],
  ],
  data: DATA,
  dataAssert: { 'en-index': scenarioA('en'), 'es-index': scenarioA('es'), 'en-partial': scenarioB('en'), 'es-partial': scenarioB('es'),
    'en-states': states('en'), 'es-states': states('es') },
});
