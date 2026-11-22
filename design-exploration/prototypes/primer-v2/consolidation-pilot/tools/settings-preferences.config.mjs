// Settings PREFERENCES pilot: approved ../../settings/{language,theme,time}[.es].html
// vs ../settings/ (same folder as the root; see settings-root.config.mjs).
//
// Options, defaults and explanations from the ARB files and the approved
// generator (enum order; defaults system / dark / device). The behaviour is
// settings.js's simulation, unchanged: selection applies at once, the screen
// stays open, a failed write (fail=1) restores the previous value and shows
// settingsSaveFailed, a newer selection supersedes a pending one, Language
// re-renders the open screen, arrows move focus only, Space and Enter select,
// Back restores focus to the originating row. The Light option shows the
// labelled PROVISIONAL preview only (no light design is made here).
import { LANGS, SIZES, BAR, PREF, ROOT_AFTER, eq, s, BACK } from './settings-common.mjs';

const OPTS = {
  language: [['system', 'settingsLanguageSystem', 'settingsLanguageSystemDescription', null], ['english', 'settingsLanguageEnglish', null, 'en'], ['spanish', 'settingsLanguageSpanish', null, 'es']],
  theme: [['system', 'settingsThemeSystem', 'settingsThemeSystemDescription', null], ['dark', 'settingsThemeDark', null, null], ['light', 'settingsThemeLight', null, null]],
  time: [['device', 'settingsTimeDevice', 'settingsTimeDeviceDescription', null], ['event', 'settingsTimeEvent', 'settingsTimeEventDescription', null], ['both', 'settingsTimeBoth', 'settingsTimeBothDescription', null]],
};
const TITLE = { language: 'settingsLanguage', theme: 'settingsTheme', time: 'settingsTimeDisplay' };
const DEFAULT = { language: 'system', theme: 'dark', time: 'device' };
const QUERIES = {
  language: { default: '', 'device-es': 'device=es', english: 'language=english' },
  theme: { default: '', light: 'theme=light' },
  time: { default: '', both: 'time=both', fail: 'fail=1' },
};

const options = (lang, pref, checked) => OPTS[pref].map(([value, l, d, own]) => ({ value, checked: String(value === checked), tabindex: value === checked ? 0 : -1,
  label: s(lang, l), lang: own, desc: d && s(lang, d) }));
const strip = (d) => d.radios.map(({ value, checked, tabindex, label, lang, desc }) => ({ value, checked, tabindex, label, lang, desc }));
const screenAssert = (lang, pref, checked = DEFAULT[pref], shown = lang) => [
  ['options-order-labels-descriptions-selection', (d) => eq(strip(d.pref), options(shown, pref, checked))],
  ['radiogroup-labelled-by-title', (d) => d.pref.labelledby === 'screen-title' && d.pref.title === s(shown, TITLE[pref]) && d.pref.docTitle === `GridView ${s(shown, TITLE[pref])}`],
  ['selected-weight-and-fill-only-on-checked', (d) => d.pref.radios.every((r) => (r.checked === 'true') === (r.weight === '800'))
    && new Set(d.pref.radios.filter((r) => r.checked === 'true').map((r) => r.markFill)).size === 1 && d.pref.radios.filter((r) => r.checked === 'true').length === 1],
  ['one-h1-title-back-48', (d) => d.bar.length === 1 && d.bar[0].tag === 'h1' && d.bar[0].back[0] === BACK[shown] && d.bar[0].back[1] >= 48 && d.bar[0].back[2] >= 48],
  ['title-wraps-never-truncates', (d) => d.bar[0].ellipsis === 'clip' && d.bar[0].whiteSpace === 'normal' && !d.bar[0].overflow],
];
const DATA = `({ pref: ${PREF}, bar: ${BAR} })`;
const rec = (label, extra = {}) => ({ record: label, js: DATA, ...extra });

const pages = LANGS.flatMap(([lang, sfx]) => Object.keys(OPTS).map((p) => ({ id: `${lang}-${p}`, file: `${p}${sfx}.html`, queries: QUERIES[p] })));
const at = (lang, p, q = '') => ({ page: `${lang}-${p}`, query: q });
const runs = [];
for (const [lang, sfx] of LANGS) {
  const other = lang === 'en' ? 'es' : 'en';
  for (const p of Object.keys(OPTS)) {
    for (const [w, h, scale] of SIZES) {
      // Keyboard: Back, then ONE stop for the group (on the checked option). (No stop past it: nondeterministic in headless Chrome.)
      runs.push({ name: `${lang}-${p}-${w}x${h}-${scale}-focus`, ...at(lang, p), viewport: [w, h], scale, action: 'focus', stops: 2 });
      // Data: options, defaults, explanations, own-language labels, title.
      runs.push({ name: `${lang}-${p}-${w}x${h}-${scale}-data`, ...at(lang, p), viewport: [w, h], scale, action: 'steps', steps: [rec('d')],
        assert: screenAssert(lang, p).map(([l, fn]) => [l, (r) => fn(r.d)]) });
    }
    // Pointer.
    runs.push({ name: `${lang}-${p}-390x844-100-pointer`, ...at(lang, p), viewport: [390, 844], action: 'forced',
      states: [['.opt:nth-child(2)', 'hover'], ['.opt:nth-child(2)', 'active'], ['.opt[aria-checked="true"]', 'hover'], ['.dbar__back', 'hover'], ['.dbar__back', 'active']] });
    // Immediate selection (focus + click, as a tap focuses the option); the screen stays open; the write completes (query updated).
    const pick = OPTS[p][2][0];
    runs.push({ name: `${lang}-${p}-390x844-100-select`, ...at(lang, p), viewport: [390, 844], action: 'steps',
      steps: [rec('before'), { focus: `.opt[data-value="${pick}"]`, wait: 50 }, { click: `.opt[data-value="${pick}"]`, wait: 40, ...rec('immediate') }, { wait: 500, ...rec('stored'), shot: 'selected' }],
      assert: [['applies-immediately', (r) => r.immediate.pref.radios.find((x) => x.value === pick).checked === 'true' && r.immediate.pref.file === r.before.pref.file],
        ['stays-open-and-stores', (r) => r.stored.pref.file === r.before.pref.file && new URLSearchParams(r.stored.pref.search).get(p) === pick && !r.stored.pref.snack.shown],
        ['focus-stays-on-option', (r) => r.stored.pref.focus === pick]] });
    // Failure rollback (development scenario fail=1): selected at once, then the previous value and the message.
    runs.push({ name: `${lang}-${p}-390x844-100-fail`, ...at(lang, p, 'fail=1'), viewport: [390, 844], action: 'steps',
      steps: [{ click: `.opt[data-value="${pick}"]`, wait: 40, ...rec('immediate') }, { wait: 700, ...rec('reverted'), shot: 'save-failed' }],
      assert: [['selected-then-reverted', (r) => r.immediate.pref.radios.find((x) => x.value === pick).checked === 'true'
        && r.reverted.pref.radios.find((x) => x.checked === 'true').value === DEFAULT[p]],
        ['message-shown', (r) => r.reverted.pref.snack.shown && r.reverted.pref.snack.text === s(lang, 'settingsSaveFailed')],
        ['failure-annotation-visible', (r) => r.reverted.pref.devnotes.length === 1 && /every save fails/i.test(r.reverted.pref.devnotes[0])]] });
    // Keyboard model: arrows / Home / End move focus only; Space and Enter select.
    runs.push({ name: `${lang}-${p}-390x844-100-keyboard`, ...at(lang, p), viewport: [390, 844], action: 'steps',
      steps: [{ key: 'Tab' }, { key: 'Tab', ...rec('group') }, { key: 'ArrowDown', ...rec('down') }, { key: 'End', ...rec('end') }, { key: 'Home', ...rec('home') },
        { key: 'ArrowUp', ...rec('up') }, { key: 'Space', wait: 500, ...rec('space'), shot: 'space' }, { key: 'ArrowDown', ...rec('down2') }, { key: 'Enter', wait: 500, ...rec('enter') }],
      assert: [['tab-enters-on-checked', (r) => r.group.pref.focus === DEFAULT[p]],
        ['arrows-move-focus-only', (r) => ['down', 'end', 'home', 'up'].every((k) => r[k].pref.radios.find((x) => x.checked === 'true').value === DEFAULT[p])
          && r.down.pref.focus !== r.group.pref.focus && r.end.pref.focus === OPTS[p][2][0] && r.home.pref.focus === OPTS[p][0][0] && r.up.pref.focus === OPTS[p][2][0]],
        ['space-selects-focused', (r) => r.space.pref.radios.find((x) => x.checked === 'true').value === OPTS[p][2][0]],
        ['enter-selects-focused', (r) => r.enter.pref.radios.find((x) => x.checked === 'true').value === OPTS[p][0][0]]] });
    // Back to Settings: the root shows the new value and focus returns to the originating row.
    runs.push({ name: `${lang}-${p}-390x844-100-back`, ...at(lang, p), viewport: [390, 844], action: 'steps',
      steps: [{ click: `.opt[data-value="${pick}"]`, wait: 500 }, { click: '.dbar__back', wait: 1200, record: 'root', js: ROOT_AFTER, shot: 'root' }],
      assert: [['back-to-root-with-value-and-focus', (r) => r.root.file === `index${sfx}.html` && r.root.focus === `row-${p}` && new URLSearchParams(r.root.search).get(p) === pick]] });
  }
  // Superseded write: a newer selection wins, no message.
  runs.push({ name: `${lang}-theme-390x844-100-superseded`, ...at(lang, 'theme', 'fail=1'), viewport: [390, 844], action: 'steps',
    steps: [{ click: '.opt[data-value="light"]', wait: 60 }, { click: '.opt[data-value="system"]', wait: 60, ...rec('pending') }, { wait: 700, ...rec('after') }],
    assert: [['only-the-latest-write-reports', (r) => r.pending.pref.radios.find((x) => x.checked === 'true').value === 'system'
      && r.after.pref.radios.find((x) => x.checked === 'true').value === 'dark' && r.after.pref.snack.text === s(lang, 'settingsSaveFailed')]] });
  // Language re-renders the open screen in place (title, options, back label, html lang); focus stays.
  const pinned = lang === 'en' ? 'spanish' : 'english';
  runs.push({ name: `${lang}-language-390x844-100-rerender`, ...at(lang, 'language'), viewport: [390, 844], action: 'steps',
    steps: [{ focus: `.opt[data-value="${pinned}"]`, wait: 50 }, { click: `.opt[data-value="${pinned}"]`, wait: 500, ...rec('after'), shot: 'rerendered' }],
    assert: [...screenAssert(lang, 'language', pinned, other).map(([l, fn]) => [`rerender-${l}`, (r) => fn(r.after)]),
      ['html-lang-and-focus', (r) => r.after.pref.lang === other && r.after.pref.focus === pinned]] });
  // Language failure: Español is shown at once, then the page returns to its language with the message in it.
  runs.push({ name: `${lang}-language-390x844-100-fail-rerender`, ...at(lang, 'language', 'fail=1'), viewport: [390, 844], action: 'steps',
    steps: [{ click: `.opt[data-value="${pinned}"]`, wait: 40, ...rec('immediate') }, { wait: 700, ...rec('reverted'), shot: 'reverted' }],
    assert: [['immediate-language', (r) => r.immediate.pref.lang === other], ['reverted-language-and-message', (r) => r.reverted.pref.lang === lang
      && r.reverted.pref.snack.text === s(lang, 'settingsSaveFailed') && r.reverted.pref.radios.find((x) => x.checked === 'true').value === 'system']] });
  // System default resolution: device=es on the English page shows Spanish (Spanish page with device=en: English).
  runs.push({ name: `${lang}-language-390x844-100-system-resolution`, ...at(lang, 'language', lang === 'en' ? 'device=es' : 'device=en'), viewport: [390, 844], action: 'steps',
    steps: [rec('d')], assert: screenAssert(lang, 'language', 'system', other).map(([l, fn]) => [l, (r) => fn(r.d)]) });
  // Light: the labelled provisional preview only.
  runs.push({ name: `${lang}-theme-390x844-100-light-provisional`, ...at(lang, 'theme', 'theme=light'), viewport: [390, 844], action: 'steps', steps: [rec('d')],
    assert: [...screenAssert(lang, 'theme', 'light').map(([l, fn]) => [l, (r) => fn(r.d)]),
      ['provisional-label', (r) => r.d.pref.theme === 'light' && r.d.pref.devnotes.length === 1 && /provisional light preview/.test(r.d.pref.devnotes[0])]] });
}
// Reduced motion: the failure snackbar appears without its slide.
runs.push({ name: 'en-theme-390x844-100-reduced-motion-fail', page: 'en-theme', query: 'fail=1', viewport: [390, 844], action: 'steps', media: { reducedMotion: true },
  steps: [{ click: '.opt[data-value="light"]', wait: 700, record: 'motion', js: `(() => { const x = document.querySelector('.snack'), o = document.querySelector('.opt');
    return { snack: getComputedStyle(x).transitionDuration, opt: getComputedStyle(o).transitionDuration, shown: x.classList.contains('is-shown') }; })()`, shot: 'snack' }],
  assert: [['no-transition', (r) => r.motion.shown && r.motion.snack.split(',').every((v) => parseFloat(v) === 0) && parseFloat(r.motion.opt) === 0]] });

export default {
  name: 'settings-preferences', baseline: '../../settings', pilot: '../settings', outLabel: 'preferences',
  viewports: [[390, 844], [320, 693]], textScales: [100, 200],
  pages, runs, stateProbe: PREF, probes: { bar: BAR }, saveShots: 'first',
};
