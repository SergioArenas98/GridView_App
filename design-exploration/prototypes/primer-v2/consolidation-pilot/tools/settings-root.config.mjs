// Settings ROOT pilot: approved ../../settings/ vs ../settings/ (root pages and the
// development-only gallery; the preference screens share the folder and have
// their own config, settings-preferences.config.mjs).
//
// Scenarios as approved: A index (production, support contact configured: the
// build default), A2 production-no-contact (feedback omitted), B non-production
// (development, no contact: DEV strip, explanation row, Developer section);
// plus the URL-parameter scenarios settings.js supports (staging with contact,
// development with contact, non-default values, Light preview) and the
// five-frame gallery with its scenario hub. Values come from the ARB files.
import { ARB, BACK, LANGS, SIZES, BAR, ROOT, ROOT_AFTER, eq, s } from './settings-common.mjs';

const VARIANTS = {
  staging: 'env=staging&contact=configured',
  'dev-contact': 'env=development&contact=configured',
  values: 'language=english&theme=system&time=event',
  'values-es': 'language=spanish&theme=light&time=both',
};

// Expected rows per scenario, from the ARB files and settings_screen.dart's order (approved generator).
const prefRows = (lang, v = { language: 'settingsLanguageSystem', theme: 'settingsThemeDark', time: 'settingsTimeDevice' }, shown = lang) => [
  ['settingsLanguage', v.language], ['settingsTheme', v.theme], ['settingsTimeDisplay', v.time],
].map(([l, val]) => ({ kind: 'link', label: s(shown, l), value: s(shown, val), desc: null, glyph: '#i-chevron', mark: true }));
const nav = (lang, key, glyph = '#i-chevron', desc = null) => ({ kind: 'link', label: s(lang, key), value: null, desc: desc && s(lang, desc), glyph, mark: false });
const expected = (lang, { feedback, dev, values, shown = lang }) => {
  const L = shown;
  const privacy = [nav(L, 'settingsPrivacyAndLegal')];
  if (feedback === 'link') privacy.push(nav(L, 'settingsFeedback', '#i-external'));      // SETT-04: arrow kept, mail icon not applied
  if (feedback === 'explain') privacy.push({ kind: 'static', label: s(L, 'settingsFeedback'), value: null, desc: s(L, 'settingsFeedbackUnavailable'), glyph: null, mark: false });
  const sections = [
    [s(L, 'settingsSectionPreferences'), false, prefRows(lang, values, L)],
    [s(L, 'settingsSectionDataApp'), false, [nav(L, 'settingsDataAndUpdates'), nav(L, 'settingsAcknowledgements'), nav(L, 'settingsAppInformation')]],
    [s(L, 'settingsSectionPrivacySupport'), false, privacy],
  ];
  if (dev) sections.push([s(L, 'settingsSectionDeveloper'), true, [nav(L, 'settingsComponentCatalogue', '#i-chevron', 'settingsComponentCatalogueDescription')]]);
  return sections.map(([heading, dashed, rows]) => ({ heading, dashed, rows }));
};
const strip = (d) => d.sections.map((x) => ({ heading: x.heading, dashed: x.dashed, rows: x.rows.map(({ kind, label, value, desc, glyph, mark }) => ({ kind, label, value, desc, glyph, mark })) }));
const SC = {
  index: { feedback: 'link', dev: false, badge: [] },
  'production-no-contact': { feedback: null, dev: false, badge: [] },
  'non-production': { feedback: 'explain', dev: true, badge: [['DEV', 'Build environment: DEV']] },
};
const rootAssert = (lang, sc, extra = {}) => {
  const o = { ...SC[sc], ...extra };
  return [
    ['sections-rows-values-and-order', (d) => eq(strip(d.root), expected(lang, o))],
    ['environment-strip', (d) => eq(d.root.badge, o.badge) && eq(d.bar.map((b) => b.strip), [o.badge.length ? o.badge[0][0] : null])],
    ['title-is-h1-back-named', (d) => d.bar.length === 1 && d.bar[0].tag === 'h1' && d.bar[0].text === s(o.shown || lang, 'settingsTitle') && d.bar[0].back[0] === BACK[o.shown || lang]],
    ['back-48px', (d) => d.bar[0].back[1] >= 48 && d.bar[0].back[2] >= 48],
    ['pref-links-carry-state', (d) => d.root.sections[0].rows.every((r) => /^(language|theme|time)(\.es)?\.html\?language=\w+&theme=\w+&time=\w+&env=\w+&contact=\w+&device=\w+$/.test(r.href))],
    ['destinations-are-placeholder-hashes', (d) => eq(d.root.sections[1].rows.map((r) => r.href), ['#settings/data', '#settings/acknowledgements', '#settings/about'])],
  ];
};
const DATA = `({ root: ${ROOT}, bar: ${BAR} })`;

const pages = LANGS.flatMap(([lang, sfx]) => [
  ...Object.keys(SC).map((st) => ({ id: `${lang}-${st}`, file: `${st}${sfx}.html` })),
  { id: `${lang}-variants`, file: `index${sfx}.html`, queries: VARIANTS },
  { id: `${lang}-states`, file: `states${sfx}.html`, capture: 'segments' },
]);

const dataRun = (lang, page, query, assert, [w, h, scale], tag) => ({ name: `${lang}-${tag}-${w}x${h}-${scale}-data`, page: `${lang}-${page}`, query, viewport: [w, h], scale,
  action: 'steps', steps: [{ record: 'data', js: DATA }], assert: assert.map(([l, fn]) => [l, (r) => fn(r.data)]) });

const runs = [
  // Keyboard: Tab through every visible link from the top of the page. No stop past the last one: in headless
  // Chrome that Tab either leaves the document or wraps to Back, alternating between loads (harness, not page).
  ...LANGS.flatMap(([lang]) => Object.keys(SC).flatMap((st) => SIZES.map(([w, h, scale]) =>
    ({ name: `${lang}-${st}-${w}x${h}-${scale}-focus`, page: `${lang}-${st}`, viewport: [w, h], scale, action: 'focus' })))),
  // Gallery: the nine hub links are the only focusable controls (the frames are inert, though their links count as visible targets).
  ...LANGS.map(([lang]) => ({ name: `${lang}-states-390x844-100-focus`, page: `${lang}-states`, viewport: [390, 844], action: 'focus', stops: 9 })),
  // Pointer: forced :hover / :active on a preference row, a destination row, the external feedback row and Back.
  ...LANGS.flatMap(([lang]) => [
    { name: `${lang}-index-390x844-100-pointer`, page: `${lang}-index`, viewport: [390, 844], action: 'forced',
      states: [['#row-theme', 'hover'], ['#row-theme', 'active'], ['a[href="#settings/acknowledgements"]', 'hover'], ['a[href="#settings/acknowledgements"]', 'active'],
        ['a[href="#feedback"]', 'hover'], ['a[href="#feedback"]', 'active'], ['.dbar__back', 'hover'], ['.dbar__back', 'active']] },
    { name: `${lang}-non-production-390x844-100-pointer`, page: `${lang}-non-production`, viewport: [390, 844], action: 'forced',
      states: [['.srow--static', 'hover'], ['.srow--static', 'active'], ['a[href="#catalogue"]', 'hover'], ['a[href="#catalogue"]', 'active']] },
  ]),
  // Data: every scenario's sections, rows, values, glyphs and strip, at both key sizes.
  ...LANGS.flatMap(([lang]) => SIZES.flatMap((size) => [
    ...Object.keys(SC).map((st) => dataRun(lang, st, '', rootAssert(lang, st), size, st)),
    dataRun(lang, 'variants', VARIANTS.staging, rootAssert(lang, 'index', { dev: true, badge: [['STAGING', 'Build environment: STAGING']] }), size, 'staging'),
    dataRun(lang, 'variants', VARIANTS['dev-contact'], rootAssert(lang, 'index', { dev: true, badge: [['DEV', 'Build environment: DEV']] }), size, 'dev-contact'),
    // A pinned language re-renders the page in that language (English on the Spanish page, Español on the English one).
    dataRun(lang, 'variants', VARIANTS.values, rootAssert(lang, 'index', { shown: 'en', values: { language: 'settingsLanguageEnglish', theme: 'settingsThemeSystem', time: 'settingsTimeEvent' } }), size, 'values'),
    dataRun(lang, 'variants', VARIANTS['values-es'], [...rootAssert(lang, 'index', { shown: 'es', values: { language: 'settingsLanguageSpanish', theme: 'settingsThemeLight', time: 'settingsTimeBoth' } }),
      ['light-preview-labelled', (d) => d.root.theme === 'light' && d.root.devnotes.length === 1 && /provisional light preview/.test(d.root.devnotes[0])]], size, 'values-es'),
  ])),
  // Navigation: a preference row opens its screen with the state in the query; Back from it restores focus to that row.
  ...LANGS.map(([lang, sfx]) => ({ name: `${lang}-index-390x844-100-navigation`, page: `${lang}-index`, viewport: [390, 844], action: 'steps',
    steps: [{ click: '#row-time', wait: 1200, record: 'opened', js: `({ file: location.pathname.split('/').pop(), search: location.search, title: document.getElementById('screen-title').textContent })` },
      { click: '.dbar__back', wait: 1200, record: 'back', js: ROOT_AFTER, shot: 'back-focus' }],
    assert: [['row-opens-time-screen', (r) => r.opened.file === `time${sfx}.html` && r.opened.title === s(lang, 'settingsTimeDisplay') && /time=device/.test(r.opened.search)],
      ['back-restores-focus-to-row', (r) => r.back.file === `index${sfx}.html` && r.back.focus === 'row-time']] })),
  // Reduced motion.
  { name: 'en-index-390x844-100-reduced-motion', page: 'en-index', viewport: [390, 844], action: 'scroll', media: { reducedMotion: true } },
  { name: 'en-states-390x844-100-reduced-motion', page: 'en-states', viewport: [390, 844], action: 'segments', media: { reducedMotion: true } },
];

export default {
  name: 'settings-root', baseline: '../../settings', pilot: '../settings', outLabel: 'root',
  viewports: [[390, 844], [320, 693]], textScales: [100, 200],
  pages, runs, stateProbe: ROOT_AFTER, probes: { bar: BAR }, saveShots: 'first',
};
export { ARB };
