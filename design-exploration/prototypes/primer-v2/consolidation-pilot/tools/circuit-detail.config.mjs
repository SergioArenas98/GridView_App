// Circuit Detail pilot: approved ../../circuit-detail/ vs ../circuit-detail/.
// Scenario A (index: complete, related Grand Prix), Scenario B (partial: no
// physical facts, no lap record, never synced; no related event, as in the
// golden), Scenario C (no-event: complete circuit, no Grand Prix in the
// season) and the development-only state gallery (16 frames, including the
// media slot's loading / failed geometry). Fixture data only. The statement
// "No Grand Prix this season" on Scenario B is the approved copy, reproduced
// as is: whether a missing local calendar should read differently is
// unresolved (DESIGN-DECISIONS, Circuit Detail season statement).
import { detailConfig } from './detail-common.mjs';

const DATA = `(() => { const t = (e) => (e ? e.textContent.trim().replace(/\\s+/g, ' ') : null); const all = (s, r = document) => [...r.querySelectorAll(s)];
  return {
    sheets: all('section.ch').map((s) => ({ name: t(s.querySelector('.ch__name')), loc: t(s.querySelector('.ch__loc')), bare: s.classList.contains('ch--bare'),
      length: t(s.querySelector('.dim dd')), arms: all('.dim__arm', s).length, facts: all('.fact', s).map(t), media: all('.ch__media', s).map((m) => m.className) })),
    laps: all('.lap').map((l) => all('.lap__time, .lap__by > div', l).map(t)),
    related: all('.rel').map((r) => ({ season: t(r.querySelector('.rel__season')), none: t(r.querySelector('.rel__none')),
      links: all('a.rx', r).map((a) => ({ href: a.getAttribute('href'), label: a.getAttribute('aria-label'), described: (a.getAttribute('aria-describedby') || '').split(' ').filter(Boolean).map((id) => !!document.getElementById(id)) })) })),
    notices: all('.notice').map(t), chips: all('.chip').map(t),
    empties: all('.empty__title').map(t), retries: all('.empty .btn').length, skeletons: all('.skel').length, frames: all('section.spec').length }; })()`;

const L = {
  en: { km: '7.004 km', cw: 'Clockwise', none: 'No Grand Prix this season' },
  es: { km: '7,004 km', cw: 'Horario', none: 'Sin Gran Premio esta temporada' },
};
const fullSheet = (lang) => ['identity-and-physical-facts', (d) => d.sheets.length === 1 && d.sheets[0].name === 'Circuit de Spa-Francorchamps' && d.sheets[0].loc.startsWith('Stavelot, ')
  && d.sheets[0].length === L[lang].km && d.sheets[0].arms === 2 && d.sheets[0].facts.join('|').includes('19') && d.sheets[0].facts.join('|').includes(L[lang].cw) && d.sheets[0].facts.join('|').includes('1950')];
const lapRecord = ['lap-record', (d) => d.laps.length === 1 && d.laps[0].join('|').includes('1:46.286') && d.laps[0].join('|').includes('Valtteri Bottas') && d.laps[0].join('|').includes('2018')];
const scenarioA = (lang) => [
  fullSheet(lang), lapRecord,
  ['related-grand-prix-links-its-event', (d) => d.related.length === 1 && d.related[0].none === null && d.related[0].links.length === 1
    && d.related[0].links[0].href === '#calendar/2026/13' && d.related[0].links[0].described.length === 3 && d.related[0].links[0].described.every(Boolean)],
  ['season-line-in-related-section', (d) => /2026/.test(d.related[0].season)],
  ['no-imagery-without-an-asset', (d) => d.sheets[0].media.length === 0],
];
const scenarioC = (lang) => [
  fullSheet(lang), lapRecord,
  ['no-event-statement-no-link', (d) => d.related[0].none === L[lang].none && d.related[0].links.length === 0 && /2026/.test(d.related[0].season)],
];
const scenarioB = (lang) => [
  ['partial-notice-and-bare-sheet', (d) => d.notices.length === 1 && d.sheets[0].bare && d.sheets[0].length === null && d.sheets[0].facts.length === 0 && d.laps.length === 0],
  ['approved-statement-reproduced-unchanged', (d) => d.related[0].none === L[lang].none && d.related[0].links.length === 0],
];
const states = () => [
  ['sixteen-frames', (d) => d.frames === 16],
  ['loading-skeleton', (d) => d.skeletons === 1],
  ['media-slot-geometry-loading-and-failed', (d) => ['ch__media--loading', 'ch__media--failed'].every((c) => d.sheets.some((s) => s.media.some((m) => m.includes(c))))],
];

export default detailConfig({
  name: 'circuit-detail',
  baseline: '../../circuit-detail',
  pilot: '../circuit-detail',
  scenarios: ['index', 'partial', 'no-event'],
  forced: [
    ['index', [['.dbar__back', 'hover'], ['.dbar__back', 'active'], ['.rx', 'hover'], ['.rx', 'active']]],
    ['states', [['.btn', 'hover'], ['.btn', 'active']]],
  ],
  data: DATA,
  dataAssert: { 'en-index': scenarioA('en'), 'es-index': scenarioA('es'), 'en-partial': scenarioB('en'), 'es-partial': scenarioB('es'),
    'en-no-event': scenarioC('en'), 'es-no-event': scenarioC('es'), 'en-states': states(), 'es-states': states() },
});
