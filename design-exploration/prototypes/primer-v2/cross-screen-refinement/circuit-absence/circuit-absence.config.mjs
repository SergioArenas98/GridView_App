// Circuit Detail event-absence EXPERIMENT (Step 49B.1): the Circuit Detail
// consolidation pilot ../../consolidation-pilot/circuit-detail/ (baseline,
// pixel-identical to the approved ../../circuit-detail/) vs this folder.
// Run with the consolidation tool, unchanged:
//
//   node ../../consolidation-pilot/tools/visual-compare.mjs circuit-absence.config.mjs
//   node ../../consolidation-pilot/tools/visual-compare.mjs circuit-absence.config.mjs --control
//
// Pages (baseline -> experiment):
//   index -> index                      linked event (must be identical)
//   no-event -> no-event                confirmed absence (must be identical)
//   no-event -> unknown-association     completeness not established (block omitted)
//   partial -> partial-unknown          Scenario B, same condition (block omitted)
// Assertions report baseline/pilot: on the two "unknown" pages the baseline is
// EXPECTED to fail "no-absence-claim" (it shows the statement).
// Matrix: the pilot's detail matrix (EN, ES × 390×844, 320×693 × 100%, 200%,
// full-page capture; focus walks, navigation and data at 390 @100% and
// 320 @200%; pointer states on index; reduced motion), without the states
// gallery, which this experiment does not change.
import { detailConfig } from '../../consolidation-pilot/tools/detail-common.mjs';

const DATA = `(() => { const t = (e) => (e ? e.textContent.trim().replace(/\\s+/g, ' ') : null); const all = (s, r = document) => [...r.querySelectorAll(s)];
  return {
    sheets: all('section.ch').map((s) => ({ name: t(s.querySelector('.ch__name')), loc: t(s.querySelector('.ch__loc')), bare: s.classList.contains('ch--bare'),
      length: t(s.querySelector('.dim dd')), facts: all('.fact', s).map(t) })),
    laps: all('.lap').map((l) => all('.lap__time, .lap__by > div', l).map(t)),
    related: all('.rel').map((r) => ({ title: t(r.querySelector('.sec__title')), season: t(r.querySelector('.rel__season')), none: t(r.querySelector('.rel__none')),
      links: all('a.rx', r).map((a) => a.getAttribute('href')) })),
    headings: all('main h1, main h2, main h3').map(t), notices: all('.notice').map(t), lastSectionGap: (() => { const m = document.querySelector('main.page');
      const last = m && m.lastElementChild; return last ? Math.round(m.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom) : null; })() }; })()`;

const NONE = { en: 'No Grand Prix this season', es: 'Sin Gran Premio esta temporada' };
const fullSheet = ['circuit-information-kept', (d) => d.sheets.length === 1 && d.sheets[0].name === 'Circuit de Spa-Francorchamps' && d.sheets[0].facts.length > 0 && d.laps.length === 1];
const linked = () => [fullSheet, ['linked-event-shown', (d) => d.related.length === 1 && d.related[0].none === null && d.related[0].links.join() === '#calendar/2026/13']];
const confirmedNone = (lang) => [fullSheet, ['confirmed-absence-statement', (d) => d.related.length === 1 && d.related[0].none === NONE[lang] && d.related[0].links.length === 0]];
const unknown = () => [fullSheet, ['no-absence-claim', (d) => d.related.length === 0 && !d.headings.join('|').includes('2026')]];
const partialUnknown = () => [
  ['partial-notice-and-bare-sheet-kept', (d) => d.notices.length === 1 && d.sheets.length === 1 && d.sheets[0].bare && d.laps.length === 0],
  ['no-absence-claim', (d) => d.related.length === 0],
];

const base = detailConfig({
  name: 'circuit-absence',
  baseline: '../../consolidation-pilot/circuit-detail',
  pilot: '.',
  scenarios: ['index', 'no-event', 'unknown-association', 'partial-unknown'],
  forced: [['index', [['.dbar__back', 'hover'], ['.dbar__back', 'active'], ['.rx', 'hover'], ['.rx', 'active']]]],
  data: DATA,
  dataAssert: {
    'en-index': linked(), 'es-index': linked(),
    'en-no-event': confirmedNone('en'), 'es-no-event': confirmedNone('es'),
    'en-unknown-association': unknown(), 'es-unknown-association': unknown(),
    'en-partial-unknown': partialUnknown(), 'es-partial-unknown': partialUnknown(),
  },
});

// Baseline file for each experiment-only page; the states gallery is not part of this experiment.
const BASELINE_OF = { 'unknown-association': 'no-event', 'partial-unknown': 'partial' };
const pages = base.pages.filter((p) => !p.id.endsWith('-states')).map((p) => {
  const scenario = p.id.replace(/^(en|es)-/, '');
  return BASELINE_OF[scenario] ? { ...p, file: p.file.replace(scenario, BASELINE_OF[scenario]), pilotFile: p.file } : p;
});
// The tool pairs frames by index; the "unknown" pages are shorter, so the
// automatic full-scroll capture is replaced by anchored captures (top, lap
// record, bottom) taken in every version.
const CAPTURE = [
  { scroll: 0, shot: 'top' },
  { js: '(() => { const e = document.querySelector(".lap") || document.querySelector("main"); e.scrollIntoView({ block: "start" }); return true; })()', shot: 'middle' },
  { js: '(() => { scrollTo(0, document.documentElement.scrollHeight); return true; })()', shot: 'bottom' },
];
const SIZES = [[390, 844, 100], [390, 844, 200], [320, 693, 100], [320, 693, 200]];
const runs = [
  ...pages.flatMap((pg) => SIZES.map(([w, h, scale]) => ({ name: `${pg.id}-${w}x${h}-${scale}-capture`, page: pg.id, viewport: [w, h], scale, action: 'steps', steps: CAPTURE }))),
  ...base.runs.filter((r) => !r.page.endsWith('-states')).map((r) => (r.action === 'scroll' ? { ...r, action: 'steps', steps: CAPTURE } : r)),
];

export default { ...base, outLabel: 'experiment', pages: pages.map((pg) => ({ ...pg, viewports: [] })), runs, saveShots: 'all' };
