// Calendar pilot: approved ../../calendar/ vs ../ (consolidation-pilot root).
// Same coverage as the 2026-11-08 evidence run (39 runs): 2 languages ×
// 2 viewports × 2 text scales × 4 header states, focus walks, forced pointer
// states, reduced motion.
const STATES = { default: '', refreshing: 'state=refreshing', stale: 'state=stale', failed: 'state=failed' };
const FORCED = [['.icon-btn', 'hover'], ['.icon-btn', 'active'], ['.ev:nth-child(2) .ev__link', 'hover'], ['.ev:nth-child(2) .ev__link', 'active'],
  ['.ev--next .ev__link', 'hover'], ['.ev--next .ev__link', 'active'], ['.tab:not(.is-selected)', 'hover']];
const TITLE_GAP = `(() => { const t = document.querySelector('.wordmark'), a = document.querySelector('.appbar__actions'); if (!t || !a) return null;
  const r = document.createRange(); r.selectNodeContents(t); return Math.round((a.getBoundingClientRect().left - r.getBoundingClientRect().right) * 100) / 100; })()`;

export default {
  name: 'calendar',
  baseline: '../../calendar',
  pilot: '..',
  viewports: [[390, 844], [320, 693]],
  textScales: [100, 200],
  pages: [
    { id: 'en', file: 'index.html', queries: STATES },
    { id: 'es', file: 'index.es.html', queries: STATES },
  ],
  runs: [
    ...['en', 'es'].flatMap((page) => [[390, 844, 100], [320, 693, 200]].map(([w, h, scale]) =>
      ({ name: `${page}-${w}x${h}-${scale}-focus`, page, query: STATES.failed, viewport: [w, h], scale, action: 'focus' }))),
    ...['en', 'es'].map((page) => ({ name: `${page}-390x844-100-pointer`, page, query: '', viewport: [390, 844], action: 'forced', states: FORCED })),
    { name: 'en-390x844-100-reduced-motion', page: 'en', query: STATES.failed, viewport: [390, 844], action: 'scroll', media: { reducedMotion: true } },
  ],
  probes: { titleGap: TITLE_GAP },
  saveShots: 'none',
};
