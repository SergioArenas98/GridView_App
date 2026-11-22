// Shared pieces of the Settings pilot configs (2026-11-10). Not a config:
// settings-root.config.mjs, settings-preferences.config.mjs and
// settings-information.config.mjs import it.
//
// Expected values are read from the repository sources the approved
// generators read (lib/l10n/app_*.arb, content/attribution/data-sources.json),
// never retyped here, and every assertion is checked in BOTH versions: a check
// that fails in the baseline is a wrong check, not a pilot regression.
import { readFileSync } from 'node:fs';

const repo = new URL('../../../../../', import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, repo), 'utf8'));
export const ARB = { en: json('lib/l10n/app_en.arb'), es: json('lib/l10n/app_es.arb') };
export const RECORD = json('content/attribution/data-sources.json');
export const BACK = { en: 'Back', es: 'Atrás' };             // MaterialLocalizations back tooltip (not ARB)
/** ARB value with ICU string placeholders filled, as the approved generators do. */
export const s = (lang, key, args = {}) => Object.entries(args).reduce((v, [k, a]) => v.split(`{${k}}`).join(a), ARB[lang][key]);

export const LANGS = [['en', ''], ['es', '.es']];
export const SIZES = [[390, 844, 100], [320, 693, 200]];   // key sizes for interaction runs

const T = `(e) => (e ? e.textContent.trim().replace(/\\s+/g, ' ') : null)`;

// The Settings app bar (local variant, not the detail bar): h1 title that wraps, environment strip above it.
// Records the title's text, line count, size, width axis, S-2 fit state (information screens), the chrome height,
// the strip and the back action's name and target size.
export const BAR = `(() => [...document.querySelectorAll('.chrome')].filter((c) => c.getClientRects().length).map((c) => {
  const t = c.querySelector('.dbar__title'), k = c.querySelector('.dbar__back'), st = c.querySelector('.envstrip'); const cs = getComputedStyle(t); const r = (e) => e.getBoundingClientRect();
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
  return { tag: t.tagName.toLowerCase(), text: t.textContent, lines: Math.round(r(t).height / lh), fontSize: cs.fontSize, wdth: cs.fontVariationSettings, fit: t.dataset.fit || null,
    overflow: t.scrollWidth > t.clientWidth + 1, ellipsis: cs.textOverflow, whiteSpace: cs.whiteSpace, chromeH: Math.round(r(c).height * 100) / 100, sticky: getComputedStyle(c).position,
    strip: st && st.getClientRects().length ? st.textContent.trim() : null, back: k ? [k.getAttribute('aria-label'), Math.round(r(k).width), Math.round(r(k).height)] : null }; }))()`;

// Root: sections in order, each row's kind, texts, glyph and raw link; badge; values; page language and theme.
export const ROOT = `(() => { const t = ${T}; const all = (s, r = document) => [...r.querySelectorAll(s)]; const vis = (e) => e.getClientRects().length > 0;
  return { lang: document.documentElement.lang, theme: document.documentElement.dataset.theme || null, title: document.title,
    sections: all('main .sgroup').filter(vis).map((g) => ({ heading: t(g.querySelector('h2')), dashed: g.classList.contains('sgroup--dev'),
      rows: all('.srows > li', g).filter(vis).map((li) => { const row = li.firstElementChild; const use = row.querySelector('svg use');
        return { kind: row.tagName === 'A' ? 'link' : 'static', label: t(row.querySelector('.srow__label [data-k], .srow__title [data-k]')), value: t(row.querySelector('[data-pref-value]')),
          desc: t(row.querySelector('.srow__desc')), name: t(row), href: row.getAttribute('href'), glyph: use ? use.getAttribute('href') : null, mark: !!row.querySelector('.mark--sm') }; }) })),
    badge: all('.envbadge').filter(vis).map((b) => [b.textContent, b.getAttribute('aria-label')]), devnotes: all('.devnote').filter(vis).map(t) }; })()`;

// Preference screen state.
export const PREF = `(() => { const t = ${T}; const g = document.querySelector('[role="radiogroup"]'); const a = document.activeElement; const snack = document.querySelector('.snack');
  return { lang: document.documentElement.lang, theme: document.documentElement.dataset.theme || null, title: t(document.getElementById('screen-title')), docTitle: document.title,
    labelledby: g.getAttribute('aria-labelledby'), radios: [...g.querySelectorAll('[role="radio"]')].map((r) => { const l = r.querySelector('.opt__label'); const d = r.getAttribute('aria-describedby');
      return { value: r.dataset.value, checked: r.getAttribute('aria-checked'), tabindex: r.tabIndex, label: t(l), lang: l.getAttribute('lang'), desc: d ? t(document.getElementById(d)) : null,
        weight: getComputedStyle(l).fontWeight, markFill: getComputedStyle(r.querySelector('.mark'), '::before').backgroundColor }; }),
    focus: a && a.dataset ? (a.dataset.value || a.id || a.className || a.tagName) : null, search: location.search, file: location.pathname.split('/').pop(),
    back: document.querySelector('.dbar__back').getAttribute('href'), snack: snack ? { text: snack.textContent, shown: snack.classList.contains('is-shown') } : null,
    devnotes: [...document.querySelectorAll('.devnote')].filter((e) => e.getClientRects().length).map(t) }; })()`;

// After navigating back to the root: file, query, focused row, shown values.
export const ROOT_AFTER = `(() => { const t = ${T}; const a = document.activeElement;
  return { file: location.pathname.split('/').pop(), search: location.search, focus: a ? a.id || a.tagName : null, lang: document.documentElement.lang,
    values: [...document.querySelectorAll('[data-pref-value]')].map((e) => [e.dataset.prefValue, t(e)]) }; })()`;

// Information screen content: every heading, fact, paragraph, link, button, state and the back target.
export const INFO = `(() => { const t = ${T}; const all = (s, r = document) => [...r.querySelectorAll(s)]; const vis = (e) => e.getClientRects().length > 0;
  const main = document.querySelector('main.info') || document.querySelector('main');
  return { lang: document.documentElement.lang, back: document.querySelector('.dbar__back')?.getAttribute('href') ?? null,
    badge: all('.envbadge').filter(vis).map((b) => [b.textContent, b.getAttribute('aria-label')]),
    headings: all('h2, h3', main).map((h) => [h.tagName.toLowerCase(), t(h)]),
    facts: all('.fact', main).map((f) => ({ dt: t(f.querySelector('dt')), dd: t(f.querySelector('dd')), lang: f.querySelector('dd').getAttribute('lang'), k: f.querySelector('dd').dataset.k || null })),
    paras: all('.lede, .explain, .note, .prose p, .istate--empty', main).map((p) => [p.className, t(p), p.dataset.k || null]),
    links: all('a[data-ext]', main).map((a) => ({ name: t(a), href: a.getAttribute('href'), target: a.target, rel: a.rel, title: t(a.querySelector('.srow__title [data-k]')),
      value: [...a.querySelector('.xrow__value').childNodes].filter((n) => !(n.classList && n.classList.contains('sep'))).map((n) => n.textContent).join(''), valueLang: a.querySelector('.xrow__value').getAttribute('lang'), desc: t(a.querySelector('.srow__desc')), descLang: a.querySelector('.srow__desc')?.getAttribute('lang') ?? null,
      glyph: a.querySelector('svg use').getAttribute('href') })),
    buttons: all('button', main).map((b) => [t(b), b.dataset.ext || null]), statics: all('.srow--static', main).map(t),
    notices: all('.notice', main).map((n) => [t(n), n.getAttribute('role')]), loading: all('[role="status"] .sr-only', main).map(t), skeletons: all('.skel', main).length,
    sources: all('.source', main).map((x) => x.dataset.source), devnotes: all('.devnote').filter(vis).map(t),
    snack: (() => { const x = document.querySelector('.snack'); return x ? { text: t(x), shown: x.classList.contains('is-shown'), msg: x.dataset.msg ?? null } : null; })(),
    file: location.pathname.split('/').pop() }; })()`;

export const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
