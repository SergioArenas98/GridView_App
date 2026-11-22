// Home upcoming-section EXPERIMENT (Step 49B.1): the Home consolidation pilot
// ../../consolidation-pilot/home/ (baseline, pixel-identical to the approved
// ../../refinement-01/) vs this folder (secondary upcoming section omitted in
// the frozen pre-event + available-empty state). Run with the consolidation
// tool, unchanged:
//
//   node ../../consolidation-pilot/tools/visual-compare.mjs home-upcoming-omit.config.mjs
//   node ../../consolidation-pilot/tools/visual-compare.mjs home-upcoming-omit.config.mjs --control
//
// The pilot's own matrix, unchanged (EN, ES × 390×844, 320×693 × 100%, 200%;
// full-page capture, keyboard walks, pointer states, every route, ARB data
// checks, reduced motion). Its assertions report baseline/pilot. EXPECTED
// pilot failures, and only these: "upcoming-known-empty" (the section is
// gone) and "every-link-opens-its-own-route" (13 routes become 12: "View
// Calendar" is removed; the Calendar tab remains). Every other assertion
// must hold in both.
import home from '../../consolidation-pilot/tools/home.config.mjs';

// Records the upcoming section's presence and the Calendar destinations left.
const EXTRA = `(() => ({ upcoming: !!document.querySelector('.upcoming'), upcomingTitle: !!document.getElementById('upcoming-title'),
  calendarLinks: [...document.querySelectorAll('a[href="#calendar"]')].map((a) => (a.getAttribute('aria-label') || a.textContent.trim().replace(/\\s+/g, ' '))),
  sections: [...document.querySelectorAll('main.home > section')].map((s) => s.className),
  gaps: (() => { const s = [...document.querySelectorAll('main.home > section')]; return s.slice(1).map((e, i) => Math.round(e.getBoundingClientRect().top - s[i].getBoundingClientRect().bottom)); })() }))()`;

// The tool pairs frames by index, so both versions must take the same frames.
// The experiment page is shorter and has one link fewer, so the automatic
// full-scroll capture is replaced by anchored captures (top, latest result,
// bottom) and the keyboard walk takes the baseline's 15 stops in both.
const SIZES = [[390, 844, 100], [390, 844, 200], [320, 693, 100], [320, 693, 200]];
const CAPTURE = [
  { scroll: 0, shot: 'top' },
  { scrollTo: '.result', shot: 'latest-result' },
  { js: '(() => { scrollTo(0, document.documentElement.scrollHeight); return true; })()', shot: 'bottom' },
];

// The pilot's data probe reads the upcoming link unconditionally; in the
// experiment that link is gone, so the same probe is read null-safely there
// (the record then reports link: null instead of throwing).
const UPCOMING_LINK = "link(q('.upcoming .text-link'))";
const nullSafeData = (js) => {
  if (!js.includes(UPCOMING_LINK)) throw new Error('home data probe changed: upcoming link read not found');
  return js.split(UPCOMING_LINK).join("(q('.upcoming .text-link') ? link(q('.upcoming .text-link')) : null)");
};

export default {
  ...home,
  name: 'home-upcoming-omit',
  baseline: '../../consolidation-pilot/home',
  pilot: '.',
  outLabel: 'experiment',
  pages: home.pages.map((pg) => ({ ...pg, viewports: [] })),
  runs: [
    ...['en', 'es'].flatMap((page) => SIZES.map(([w, h, scale]) => ({ name: `${page}-${w}x${h}-${scale}-capture`, page, viewport: [w, h], scale, action: 'steps', steps: CAPTURE }))),
    // The removed "View Calendar" link (.text-link--ember) has no pointer state to force in the experiment.
    ...home.runs.map((r) => (r.action === 'focus' ? { ...r, stops: 15 } : r.action === 'scroll' ? { ...r, action: 'steps', steps: CAPTURE }
      : r.action === 'forced' ? { ...r, states: r.states.filter(([sel]) => sel !== '.text-link--ember') }
      : /-data$/.test(r.name) ? { ...r, steps: r.steps.map((s) => ({ ...s, js: nullSafeData(s.js) })) } : r))
      // An inherited assertion that reads the removed section reports false instead of throwing.
      .map((r) => (r.assert ? { ...r, assert: r.assert.map(([d, fn]) => [d, (v) => { try { return fn(v); } catch { return false; } }]) } : r)),
    ...['en', 'es'].flatMap((page) => [[390, 844, 100], [320, 693, 200]].map(([w, h, scale]) => ({
      name: `${page}-${w}x${h}-${scale}-sections`, page, viewport: [w, h], scale, action: 'steps', steps: [{ record: 'sections', js: EXTRA }],
      assert: [
        ['calendar-tab-still-available', (r) => r.sections.calendarLinks.length >= 1],
        ['even-section-rhythm', (r) => r.sections.gaps.every((g) => g === r.sections.gaps[0])],
      ] }))),
  ],
  saveShots: 'all',
};
