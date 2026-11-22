// Settings INFORMATION pilot: approved ../../settings/information/ vs
// ../settings/information/. Thirteen scenario pages (Data and updates D1-D5,
// Acknowledgements A1-A2, Privacy and legal P1-P4, App information I1-I2) in
// English and Spanish, and the eleven-frame development gallery.
//
// Content equivalence is checked against the sources the approved generator
// reads, not against the generator: ARB copy (settings-common.mjs) and the
// attribution record content/attribution/data-sources.json (provider name,
// status, licence name / title / URL, project and terms URLs, the provider's
// English notice, which stays English on Spanish pages: SETT-20). App
// information is NOT checked against fixed numbers: the pages show the golden
// test fixture of a runtime-resolved value, so the check is "a version and a
// build number are shown" (I1) and "both rows are omitted" (I2).
//
// sharedRoots: the back links (../index.html, ../non-production.html) leave
// the page folder for the Settings root; in both versions that folder becomes
// "<settings>/", so the comparison sees the same target.
import { LANGS, SIZES, BAR, INFO, RECORD, eq, s, BACK } from './settings-common.mjs';

const FROZEN = '2026-10-07';            // captureDateLabel of the golden _frozenCapture (shown on D3 and A2)
const SRC = RECORD.sources;
const PROD = 'PRODUCTION', DEV = [['DEV', 'Build environment: DEV']];

const fact = (lang, dt, dd, extra = {}) => ({ dt: s(lang, dt), dd, lang: null, ...extra });
const DATA_PAGES = {
  data: { env: PROD, source: ['settingsDataSourceRemote'], season: '2026', explain: ['settingsDataOfflineExplanation'] },
  'data-sample': { env: 'DEV', source: ['settingsDataSourceSample'], season: '2026', explain: ['settingsDataBundledExplanation'] },
  'data-frozen': { env: 'DEV', source: ['settingsDataSourceFrozen', { date: FROZEN }], season: '2026', explain: ['settingsDataFrozenExplanation', { date: FROZEN }] },
  'data-unverified': { env: 'DEV', source: ['settingsDataSourceUnverified'], season: '2026', explain: ['settingsDataBundledExplanation'] },
  // SETT-16: the offline explanation with no season stored is kept exactly as Flutter has it.
  'data-season-unavailable': { env: PROD, source: ['settingsDataSourceRemote'], season: null, explain: ['settingsDataOfflineExplanation'] },
};
const dataAssert = (lang, sfx, o) => [
  ['facts-in-order', (d) => eq(d.facts.map(({ dt, dd }) => [dt, dd]), [
    [s(lang, 'settingsDataEnvironment'), o.env], [s(lang, 'settingsDataSource'), s(lang, ...o.source)], [s(lang, 'settingsDataApiVersion'), '1'],
    [s(lang, 'settingsDataCurrentSeason'), o.season ?? s(lang, 'settingsDataCurrentSeasonUnresolved')]])],
  ['explanation', (d) => eq(d.paras, [['explain', s(lang, ...o.explain), o.explain[0]]])],
  ['no-actions', (d) => d.links.length === 0 && d.buttons.length === 0],
  ['back-and-strip', (d) => d.back === `../${o.env === PROD ? 'index' : 'non-production'}${sfx}.html` && eq(d.badge, o.env === PROD ? [] : DEV)],
];

const sourceParas = (lang, src, frozen) => [
  frozen ? s(lang, 'settingsSourceStatusFrozen', { date: FROZEN }) : s(lang, { dormant: 'settingsSourceStatusDormant', active: 'settingsSourceStatusActive', automatic: 'settingsSourceStatusAutomatic' }[src.status]),
  s(lang, 'settingsSourceModified'), s(lang, 'settingsSourceLicenseNotice', { source: src.name, license: src.licenseName }), s(lang, 'settingsSourceNotEndorsed', { source: src.name }),
];
const display = (url) => { const [host, ...rest] = url.split('://')[1].split('/'); const p = rest.length ? '/' + rest.join('/') : ''; return host + p.split('?')[0].split('#')[0].replace(/\/$/, ''); };
const ackAssert = (lang, sfx, frozen) => {
  const en = lang === 'en' ? null : 'en';
  return [
    ['independence-statement-first', (d) => d.paras[0][0] === 'lede' && d.paras[0][1] === s(lang, 'settingsAboutUnofficial')],
    ['headings', (d) => eq(d.headings, [['h2', s(lang, 'settingsAcknowledgementsData')], ['h2', s(lang, 'settingsAcknowledgementsSources')], ...SRC.map((x) => ['h3', x.name]), ['h2', s(lang, 'settingsAcknowledgementsMedia')]])],
    ['data-source-value', (d) => eq(d.facts[0], fact(lang, 'settingsDataSource', frozen ? s(lang, 'settingsDataSourceFrozen', { date: FROZEN }) : s(lang, 'settingsDataSourceRemote'), { k: frozen ? 'settingsDataSourceFrozen' : 'settingsDataSourceRemote' }))],
    ['status-licence-modification-endorsement-notices', (d) => eq(d.paras.filter((p) => p[0] === '').map((p) => p[1]), SRC.flatMap((x) => sourceParas(lang, x, frozen && x.sourceId === 'jolpica')))],
    // Licensor-supplied notices verbatim (credit, copyright, provider notice); absent ones render nothing. The provider notice stays English (SETT-20).
    ['supplied-notices-verbatim', (d) => eq(d.facts.slice(1), SRC.flatMap((x) => [
      ['settingsSourceCredit', x.creatorDesignation, null], ['settingsSourceCopyright', x.copyrightNotice, null], ['settingsSourceNotice', x.warrantyDisclaimerNotice, en]]
      .filter(([, v]) => v).map(([k, v, l]) => ({ dt: s(lang, k), dd: v, lang: l, k: null }))))],
    ['external-links-and-destinations', (d) => eq(d.links.map(({ href, target, rel, title, value, valueLang, desc, descLang, glyph }) => ({ href, target, rel, title, value, valueLang, desc, descLang, glyph })),
      SRC.flatMap((x) => [['settingsSourceProject', x.sourceUrl, display(x.sourceUrl), null], ...(x.termsUrl ? [['settingsSourceTerms', x.termsUrl, display(x.termsUrl), null]] : []),
        ['settingsSourceLicense', x.licenseUrl, x.licenseName, x.licenseTitle]].map(([k, href, value, desc]) => ({ href, target: '_blank', rel: 'noopener noreferrer', title: s(lang, k), value, valueLang: null,
          desc, descLang: desc ? en : null, glyph: '#i-open' }))))],
    ['media-known-empty', (d) => eq(d.paras.at(-1), ['istate istate--empty', s(lang, 'settingsAcknowledgementsEmpty'), 'settingsAcknowledgementsEmpty']) && d.loading.length === 0],
    ['back-and-strip', (d) => d.back === `../${frozen ? 'non-production' : 'index'}${sfx}.html` && eq(d.badge, frozen ? DEV : [])],
  ];
};

const PRIV = {
  privacy: { prod: true, session: 'settingsPrivacySessionActive', button: true },
  'privacy-starting': { prod: true, session: 'settingsPrivacyStarting', button: true },
  'privacy-unconfirmed': { prod: true, session: 'settingsPrivacySessionUnconfirmed', button: false },
  'privacy-non-production': { prod: false, session: null, button: false },
};
const privAssert = (lang, sfx, o) => {
  const pol = o.prod ? 'settingsPrivacyConfigured' : 'settingsPrivacyDisabled';
  return [
    ['statement-heading-and-note', (d) => eq(d.paras, [['lede', s(lang, 'settingsAboutUnofficial'), 'settingsAboutUnofficial'], ['note', s(lang, 'settingsPrivacyDiagnosticsNote'), 'settingsPrivacyDiagnosticsNote']])
      && eq(d.headings, [['h2', s(lang, 'settingsPrivacy')]])],
    ['policies-and-session', (d) => eq(d.facts.map(({ dt, dd }) => [dt, dd]), [
      [s(lang, 'settingsPrivacyCrashReporting'), s(lang, pol)], [s(lang, 'settingsPrivacyPerformance'), s(lang, pol)], [s(lang, 'settingsPrivacyAdvertising'), s(lang, 'settingsPrivacyDisabled')],
      ...(o.session ? [[s(lang, 'settingsPrivacySessionReporting'), s(lang, o.session)]] : [])])],
    ['policy-action-conditional', (d) => eq(d.buttons, o.button ? [[s(lang, 'settingsPrivacyPolicyOpen'), 'privacy-policy']] : [])
      && eq(d.statics, o.prod ? [] : [s(lang, 'settingsPrivacyPolicyUnavailable')]) && d.links.length === 0],
    ['back-and-strip', (d) => d.back === `../${o.prod ? 'index' : 'non-production'}${sfx}.html` && eq(d.badge, o.prod ? [] : DEV)],
  ];
};
const aboutAssert = (lang, sfx, resolved) => [
  // Runtime-resolved metadata: a version and a build number are shown when resolved, both rows omitted when not.
  ['application-and-metadata-rows', (d) => d.facts[0].dt === s(lang, 'settingsAboutApplication') && d.facts[0].dd === 'GridView'
    && (resolved ? d.facts.length === 3 && d.facts[1].dt === s(lang, 'settingsVersion') && /^\d+\.\d+\.\d+$/.test(d.facts[1].dd) && d.facts[2].dt === s(lang, 'settingsAboutBuild') && /^\d+$/.test(d.facts[2].dd)
      : d.facts.length === 1)],
  ['independence-statement-last', (d) => eq(d.paras, [['lede', s(lang, 'settingsAboutUnofficial'), 'settingsAboutUnofficial']])],
  ['no-links', (d) => d.links.length === 0 && d.buttons.length === 0 && d.back === `../index${sfx}.html`],
];
const TITLES = { data: 'settingsDataAndUpdates', acknowledgements: 'settingsAcknowledgements', privacy: 'settingsPrivacyAndLegal', about: 'settingsAppInformation' };
const titleAssert = (lang, screen) => [['title-h1-full-text-fits-back-48', (d) => d.bar.length === 1 && d.bar[0].tag === 'h1' && d.bar[0].text === s(lang, TITLES[screen])
  && !d.bar[0].overflow && d.bar[0].ellipsis === 'clip' && d.bar[0].back[0] === BACK[lang] && d.bar[0].back[1] >= 48 && d.bar[0].back[2] >= 48]];

const SCREENS = {
  ...Object.fromEntries(Object.entries(DATA_PAGES).map(([st, o]) => [st, ['data', (l, x) => dataAssert(l, x, o)]])),
  acknowledgements: ['acknowledgements', (l, x) => ackAssert(l, x, false)],
  'acknowledgements-frozen': ['acknowledgements', (l, x) => ackAssert(l, x, true)],
  ...Object.fromEntries(Object.entries(PRIV).map(([st, o]) => [st, ['privacy', (l, x) => privAssert(l, x, o)]])),
  about: ['about', (l, x) => aboutAssert(l, x, true)],
  'about-unresolved': ['about', (l, x) => aboutAssert(l, x, false)],
};
const galleryAssert = (lang) => [
  ['eleven-frames', (d) => d.frames === 11],
  ['loading-unreadable-and-credit-states', (d) => eq(d.info.loading, [s(lang, 'a11yLoading'), s(lang, 'a11yLoading'), s(lang, 'a11yLoading')]) && d.info.skeletons === 3
    && eq(d.info.notices, [[s(lang, 'settingsSourcesUnavailable'), 'status']])
    && d.info.facts.some((f) => f.dt === s(lang, 'mediaCategoryPortrait') && f.dd === 'Example Rights Holder · CC BY 4.0')
    && d.info.facts.some((f) => f.dt === s(lang, 'mediaCategoryCircuitLayout') && f.dd === 'Second Rights Holder')],
  ['open-failed-frame', (d) => d.snacks.includes(s(lang, 'settingsOpenFailed'))],
];
const DATA = `({ info: ${INFO}, bar: ${BAR} })`;
const GALLERY = `({ info: ${INFO}, frames: document.querySelectorAll('figure.frame').length, snacks: [...document.querySelectorAll('.frame .snack__msg')].map((e) => e.textContent) })`;

const pages = LANGS.flatMap(([lang, sfx]) => [
  ...Object.keys(SCREENS).map((st) => ({ id: `${lang}-${st}`, file: `${st}${sfx}.html`, maxShots: 40 })),
  { id: `${lang}-states`, file: `states${sfx}.html`, capture: 'segments' },
]);
const FOCUS = ['data', 'acknowledgements', 'acknowledgements-frozen', 'privacy', 'privacy-non-production', 'about'];
const runs = [];
for (const [lang, sfx] of LANGS) {
  for (const [st, [screen, assert]] of Object.entries(SCREENS)) for (const [w, h, scale] of SIZES)
    runs.push({ name: `${lang}-${st}-${w}x${h}-${scale}-data`, page: `${lang}-${st}`, viewport: [w, h], scale, action: 'steps', steps: [{ record: 'data', js: DATA }],
      assert: [...titleAssert(lang, screen), ...assert(lang, sfx)].map(([l, fn]) => [l, (r) => fn(r.data.info ? { ...r.data.info, bar: r.data.bar } : r.data)]) });
  for (const st of FOCUS) for (const [w, h, scale] of SIZES)
    runs.push({ name: `${lang}-${st}-${w}x${h}-${scale}-focus`, page: `${lang}-${st}`, viewport: [w, h], scale, action: 'focus' });
  // Gallery: the fifteen hub links are the only focusable controls (the frames are inert).
  runs.push({ name: `${lang}-states-390x844-100-focus`, page: `${lang}-states`, viewport: [390, 844], action: 'focus', stops: 15 });
  runs.push({ name: `${lang}-states-390x844-100-data`, page: `${lang}-states`, viewport: [390, 844], action: 'steps', steps: [{ record: 'data', js: GALLERY }],
    assert: galleryAssert(lang).map(([l, fn]) => [l, (r) => fn(r.data)]) });
  runs.push({ name: `${lang}-acknowledgements-390x844-100-pointer`, page: `${lang}-acknowledgements`, viewport: [390, 844], action: 'forced',
    states: [['a.xrow', 'hover'], ['a.xrow', 'active'], ['.xlinks > li:last-child > a.xrow', 'hover'], ['.xlinks > li:last-child > a.xrow', 'active'], ['.dbar__back', 'hover'], ['.dbar__back', 'active']] });
  runs.push({ name: `${lang}-privacy-390x844-100-pointer`, page: `${lang}-privacy`, viewport: [390, 844], action: 'forced',
    states: [['button.srow', 'hover'], ['button.srow', 'active']] });
  runs.push({ name: `${lang}-privacy-non-production-390x844-100-pointer`, page: `${lang}-privacy-non-production`, viewport: [390, 844], action: 'forced',
    states: [['.srow--static', 'hover'], ['.srow--static', 'active']] });
  // External opening: an attribution link that fails shows the existing message and stays on the page (no URL, focus kept).
  runs.push({ name: `${lang}-acknowledgements-390x844-100-open-failed`, page: `${lang}-acknowledgements`, query: 'openfail=1', viewport: [390, 844], action: 'steps',
    steps: [{ focus: 'a[data-ext]', wait: 50 }, { click: 'a[data-ext]', wait: 300, record: 'data', js: `({ info: ${INFO}, focus: document.activeElement.getAttribute('href') })`, shot: 'open-failed' }],
    assert: [['message-no-navigation', (r) => r.data.info.snack.shown && r.data.info.snack.text === s(lang, 'settingsOpenFailed') && r.data.info.file === `acknowledgements${sfx}.html`
      && r.data.focus === SRC[0].sourceUrl && r.data.info.devnotes.length === 1]] });
  // Privacy policy action: opens (prototype annotation, no address shown) or fails with the existing message.
  runs.push({ name: `${lang}-privacy-390x844-100-policy`, page: `${lang}-privacy`, viewport: [390, 844], action: 'steps',
    steps: [{ click: 'button[data-ext="privacy-policy"]', wait: 300, record: 'data', js: INFO, shot: 'policy-opened' }],
    assert: [['annotation-no-address', (r) => r.data.devnotes.length === 1 && /would open in the device browser/.test(r.data.devnotes[0]) && !/https?:/.test(r.data.devnotes[0]) && !r.data.snack.shown]] });
  runs.push({ name: `${lang}-privacy-390x844-100-policy-failed`, page: `${lang}-privacy`, query: 'openfail=1', viewport: [390, 844], action: 'steps',
    steps: [{ click: 'button[data-ext="privacy-policy"]', wait: 300, record: 'data', js: INFO, shot: 'policy-failed' }],
    assert: [['message-only', (r) => r.data.snack.shown && r.data.snack.text === s(lang, 'settingsOpenFailed') && !r.data.devnotes.some((t) => /would open/.test(t))]] });
}
runs.push({ name: 'en-acknowledgements-390x844-100-reduced-motion', page: 'en-acknowledgements', viewport: [390, 844], action: 'scroll', media: { reducedMotion: true }, maxShots: 40 });
runs.push({ name: 'en-states-390x844-100-reduced-motion', page: 'en-states', viewport: [390, 844], action: 'segments', media: { reducedMotion: true } });

export default {
  name: 'settings-information', baseline: '../../settings/information', pilot: '../settings/information', outLabel: 'regression',
  sharedRoots: [['../../settings', '../settings', '<settings>']],
  viewports: [[390, 844], [320, 693]], textScales: [100, 200],
  pages, runs, stateProbe: INFO, probes: { bar: BAR }, saveShots: 'first',
};
