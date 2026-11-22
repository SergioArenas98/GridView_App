// Team Detail pilot: approved ../../team-detail/ vs ../team-detail/.
// Scenario A (index: complete, the Alpine fixture), Scenario B (returning:
// one driver, two participation entries), Scenario C (partial: banner only)
// and the development-only state gallery (14 frames: loading, season
// unavailable, not found, first-load failure, refresh failed, stale, empty
// line-up, no numbers, same season/stable name, the Red Bull card with the
// TM-03 Chalk edge, the McLaren card, a 2024 season, provisional chip, media
// geometry). Fixture data only.
import { detailConfig } from './detail-common.mjs';

const DATA = `(() => { const t = (e) => (e ? e.textContent.trim().replace(/\\s+/g, ' ') : null); const all = (s, r = document) => [...r.querySelectorAll(s)];
  return {
    banners: all('.tb').map((b) => ({ name: t(b.querySelector('.tb__name')), season: t(b.querySelector('.tb__season')), meta: all('.tb__meta > div', b).map(t),
      colour: b.style.getPropertyValue('--team') || null, edge: b.classList.contains('tb--edge'), rail: !!b.querySelector('.tb__rail') })),
    lineups: all('.lu').map((ul) => ({ colour: ul.style.getPropertyValue('--team') || null, edge: ul.classList.contains('lu--edge'),
      rows: all('.lu__row', ul).map((li) => ({ entry: li.dataset.entry, name: t(li.querySelector('.lu__name')), num: t(li.querySelector('.lu__num')), code: t(li.querySelector('.lu__code')),
        span: t(li.querySelector('.lu__span')), facts: all('.lu__facts > div', li).map(t), link: li.querySelector('.lu__hit')?.getAttribute('href') ?? null })) })),
    championship: all('.tc > div').map(t), standingsLinks: all('.dest').map((a) => a.getAttribute('href')),
    sheet: all('.sheet__row').map(t), about: all('.about').map(t), notices: all('.notice').map(t),
    empties: all('.empty__title').map(t), retries: all('.empty .btn').length, skeletons: all('.skel').length, frames: all('.spec').length,
    text: document.body.innerText }; })()`;

const L = {
  en: { until6: 'Until round 6', from7: 'From round 7', from12: 'From round 12', role: 'Race driver', seasonStart: 'From season start', pu: 'Power unit' },
  es: { until6: 'Hasta la ronda 6', from7: 'Desde la ronda 7', from12: 'Desde la ronda 12', role: 'Piloto titular', seasonStart: 'Desde el inicio de la temporada', pu: 'Unidad de potencia' },
};
const noSeasonStartWording = (lang) => ['null-span-never-uses-driver-wording', (d) => !d.text.includes(L[lang].seasonStart)];
const scenarioA = (lang) => [
  ['season-name-and-stable-identity', (d) => d.banners[0].name === 'BWT Alpine Formula One Team' && d.banners[0].meta[0].endsWith('Alpine') && /2026/.test(d.banners[0].season)],
  ['alpine-three-distinct-entries', (d) => d.lineups[0].rows.map((r) => r.entry).join() === '2026-jack-doohan,2026-pierre-gasly,2026-franco-colapinto-7'],
  ['roster-order-unchanged', (d) => d.lineups[0].rows.map((r) => r.code + r.num.replace(/\D/g, '')).join() === 'DOO7,GAS10,COL43'],
  ['observed-boundaries-shown', (d) => d.lineups[0].rows[0].span === L[lang].until6 && d.lineups[0].rows[2].span === L[lang].from7],
  ['null-null-span-omitted-role-kept', (d) => d.lineups[0].rows[1].span === null && d.lineups[0].rows[1].facts.length === 1],
  noSeasonStartWording(lang),
  ['every-entry-links-its-driver', (d) => d.lineups[0].rows.every((r) => r.link === '#drivers/' + r.entry.replace(/^2026-/, '').replace(/-\d+$/, ''))],
  ['team-colour-no-edge-above-3to1', (d) => d.banners[0].colour === '#0093CC' && !d.banners[0].edge && d.lineups[0].colour === '#0093CC' && !d.lineups[0].edge],
  ['championship-and-power-unit', (d) => d.championship.length === 3 && d.standingsLinks.join() === '#standings/constructors/2026' && d.sheet.some((s) => s.startsWith(L[lang].pu) && s.endsWith('Renault'))],
];
const scenarioB = (lang) => [
  ['returning-driver-two-entries', (d) => d.lineups[0].rows.map((r) => r.entry).join() === '2026-jack-doohan,2026-jack-doohan-12'],
  ['spans-in-roster-order', (d) => d.lineups[0].rows.map((r) => r.span).join('|') === `${L[lang].until6}|${L[lang].from12}`],
  noSeasonStartWording(lang),
];
const scenarioC = (lang) => [
  ['partial-banner-only', (d) => d.notices.length === 1 && d.banners.length === 1 && d.lineups.length === 0 && d.championship.length === 0 && d.about.length === 0],
];
const states = (lang) => [
  ['fourteen-frames', (d) => d.frames === 14],
  ['loading-skeleton', (d) => d.skeletons === 1],
  ['tm03-chalk-edge-on-low-contrast-colour-only', (d) => d.banners.filter((b) => b.edge).map((b) => b.colour).join() === '#1E41FF'
    && d.lineups.filter((l) => l.edge).map((l) => l.colour).join() === '#1E41FF'],
  noSeasonStartWording(lang),
];

export default detailConfig({
  name: 'team-detail',
  baseline: '../../team-detail',
  pilot: '../team-detail',
  scenarios: ['index', 'returning', 'partial'],
  forced: [
    ['index', [['.dbar__back', 'hover'], ['.dbar__back', 'active'], ['.dest', 'hover'], ['.dest', 'active'],
      ['.lu__row:nth-child(1) .lu__hit', 'hover'], ['.lu__row:nth-child(1) .lu__hit', 'active'], ['.lu__row:nth-child(1)', 'hover']]],
    ['states', [['.btn', 'hover'], ['.btn', 'active']]],
  ],
  data: DATA,
  dataAssert: { 'en-index': scenarioA('en'), 'es-index': scenarioA('es'), 'en-returning': scenarioB('en'), 'es-returning': scenarioB('es'),
    'en-partial': scenarioC('en'), 'es-partial': scenarioC('es'), 'en-states': states('en'), 'es-states': states('es') },
});
