// Calendar Stage 1 EXPERIMENT (Step 48E): measured geometry and dynamic
// behaviour for three versions, read-only:
//   A = ../calendar-title-fit/   (visually approved title fit, status in the header)
//   B = this folder              (Stage 1: title and season rows pinned, status scrolls)
//   C = ../calendar-sticky-split/ (Stage 2: B plus the dynamic title release, Step 48C)
//
//   node stage1-checks.mjs [--out <dir>]
//
// Covers: header, navigation and list band (initial, mid, bottom); L1-L5 on
// round 23 (the tallest row); Tab / Shift+Tab walks; status changes with a
// keyboard-focused row and while scrolled; text-scale, rotation and
// viewport-height changes with a focused row; back from a Grand Prix; layout
// settling. Harness (Chrome flags, software raster, DPR 2, GEO probe) copied
// from ../calendar-sticky-split/dynamic-checks.mjs. Chrome emulation has no
// Android system bars: env(safe-area-inset-*) is 0 here.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSIONS = { A: resolve(HERE, '../calendar-title-fit'), B: HERE, C: resolve(HERE, '../calendar-sticky-split') };
const PAGES = { en: 'index.html', es: 'index.es.html' };
const STATES = ['default', 'refreshing', 'stale', 'failed'];
const VIEWPORTS = [[320, 693, 200], [320, 693, 100], [390, 844, 100], [390, 844, 200]];
const DPR = 2;
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-stage1-dynamic`));
mkdirSync(OUT, { recursive: true });

// ---------- Chrome (same flags as visual-compare.mjs, software raster) ----------
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-dyn-'))}`,
  '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-rasterization',
  '--disable-partial-raster', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pageTarget() {
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = list.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch { /* starting */ }
    await sleep(200);
  }
  throw new Error('chrome did not start');
}
const ws = new WebSocket(await pageTarget());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let msgId = 0; const pending = new Map();
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); } });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++msgId; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`); return r.result.value; };
for (const d of ['Page', 'Runtime']) await send(`${d}.enable`);
const frames = () => evalJs('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r(true), 120))))');

async function viewport(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true }); await frames(); }
async function load(version, lang, state, [w, h, scale]) {
  await viewport(w, h);
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const url = pathToFileURL(join(VERSIONS[version], PAGES[lang])).href + (state === 'default' ? '' : `?state=${state}`);
  await send('Page.navigate', { url });
  await sleep(400);
  await evalJs(`new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r))`);
  await evalJs('document.fonts.ready.then(() => true)');
  if (scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
  await sleep(300); await frames();
}
const KEY = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 };
async function tab(shift = false) {
  const modifiers = shift ? 8 : 0;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, ...KEY });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, ...KEY });
  await sleep(200); await frames();
}

// ---------- In-page geometry (identical expression for both versions) ----------
// pinnedBottom: bottom edge of whatever header part is on screen (sticky or not);
// listViewport: the band between it and the navigation where rows can be read.
const GEO = `(() => {
  const q = (v) => Math.round(v * 100) / 100, H = innerHeight;
  const hdr = document.querySelector('.appbar--sticky'), nav = document.querySelector('.tabbar'), season = document.getElementById('season'), title = document.querySelector('.wordmark');
  const hr = hdr.getBoundingClientRect(), nr = nav.getBoundingClientRect(), sr = season.getBoundingClientRect(), tr = title.getBoundingClientRect();
  const top = Math.max(0, hr.bottom), bottom = nr.top;
  const clip = (r) => Math.max(0, Math.min(r.bottom, bottom) - Math.max(r.top, top));
  const rows = [...document.querySelectorAll('.ev')].map((e) => { const r = e.getBoundingClientRect(); return { round: e.querySelector('.ev__num').textContent, top: q(r.top), h: q(r.height), visible: q(clip(r) / r.height) }; });
  const status = [...document.querySelectorAll('.freshness, .notice')].filter((e) => !e.hidden).map((e) => { const r = e.getBoundingClientRect();
    return { kind: e.classList.contains('notice') ? 'notice:' + e.dataset.state : 'caption', h: q(r.height), top: q(r.top), inHeader: !!e.closest('header'), onScreen: q(clip(r)) }; });
  const f = document.activeElement, fr = f && f !== document.body ? f.getBoundingClientRect() : null;
  const de = document.documentElement;
  return { viewportH: H, scrollY: Math.round(scrollY), maxScroll: de.scrollHeight - H, docH: de.scrollHeight, rootFont: de.style.fontSize || '100%',
    titleRow: de.dataset.titleRow || 'n/a', headerH: q(hr.height), headerTop: q(hr.top), pinnedBottom: q(top), navH: q(nr.height), navFit: nav.dataset.fit,
    titleVisible: tr.bottom > 0.5, seasonH: q(sr.height), seasonVisible: sr.top >= -0.5 && sr.bottom <= bottom + 0.5,
    statusH: q(status.reduce((s, x) => s + x.h, 0)), status, listViewport: q(bottom - top), listViewportPct: q(((bottom - top) / H) * 100),
    rowsVisible: q(rows.reduce((s, r) => s + r.visible, 0)), rowsFull: rows.filter((r) => r.visible >= 0.999).length, rows,
    focus: fr ? { name: (f.getAttribute('aria-label') || f.textContent).trim().replace(/\\s+/g, ' ').slice(0, 32), top: q(fr.top), bottom: q(fr.bottom),
      ...(() => { const where = f.closest('nav') ? 'nav' : f.closest('header') ? 'header' : 'content';
        const lo = where === 'content' ? top : 0, hi = where === 'nav' ? H : bottom;   // chrome controls: on screen and, for the header, above the nav
        return { where, clear: fr.top >= lo - 0.5 && fr.bottom <= hi + 0.5,
          hiddenBy: fr.top < lo - 0.5 ? (where === 'content' ? 'header ' : 'off-screen top ') + q(lo - fr.top) + 'px' : fr.bottom > hi + 0.5 ? (where === 'nav' ? 'off-screen bottom ' : 'nav ') + q(fr.bottom - hi) + 'px' : null }; })() } : null };
})()`;
const geo = () => evalJs(GEO);
const setState = (state) => evalJs(`(() => { document.querySelectorAll('[data-state]').forEach((e) => { e.hidden = true; });
  const s = new Set(${JSON.stringify(state)}.split(',').filter((x) => x && x !== 'default'));
  const show = (n) => document.querySelectorAll('[data-state="' + n + '"]').forEach((e) => { e.hidden = false; });
  if (s.has('refreshing')) show('refreshing'); if (s.has('failed')) show('failed'); else if (s.has('stale')) show('stale'); return true; })()`);
const scrollTo = async (y) => { await evalJs(`window.scrollTo(0, ${y}); true`); await frames(); };
const focusRow = async (n) => { await evalJs(`document.querySelectorAll('.ev__link')[${n}].focus(); true`); await frames(); };
// Keyboard focus on race row n (0-based) from a fresh load: Refresh, Settings, then the rows.
const tabToRow = async (n) => { for (let i = 0; i < n + 3; i++) await tab(); };
const rowTop = (n) => evalJs(`Math.round(document.querySelectorAll('.ev')[${n}].getBoundingClientRect().top * 100) / 100`);

// ---------- Scenarios ----------
async function staticCase(version, lang, state, vp) {
  await load(version, lang, state, vp);
  const out = { initial: await geo() };
  await scrollTo(Math.round(out.initial.maxScroll / 2)); out.mid = await geo();
  await scrollTo(out.initial.maxScroll); out.bottom = await geo();
  return out;
}

// ---------- Step 48E scenarios (A = title fit, B = Stage 1, C = Stage 2 sticky split) ----------
const focusedName = () => evalJs(`(document.activeElement.closest('.ev')?.querySelector('.ev__num')?.textContent || document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || 'body').trim().replace(/\\s+/g, ' ').slice(0, 30)`);
const rowBox = (round) => evalJs(`(() => { const e = [...document.querySelectorAll('.ev')].find((x) => x.querySelector('.ev__num').textContent.trim() === '${round}');
  const r = e.getBoundingClientRect(), hdr = document.querySelector('.appbar--sticky').getBoundingClientRect(), nav = document.querySelector('.tabbar').getBoundingClientRect();
  const top = Math.max(0, hdr.bottom), q = (v) => Math.round(v * 100) / 100;
  return { rowTop: q(r.top), rowH: q(r.height), band: q(nav.top - top), fits: r.height <= nav.top - top + 0.5, hiddenTop: q(Math.max(0, top - r.top)), hiddenBottom: q(Math.max(0, r.bottom - nav.top)),
    visible: q(Math.max(0, Math.min(r.bottom, nav.top) - Math.max(r.top, top)) / r.height), scrollY: Math.round(scrollY), maxScroll: document.documentElement.scrollHeight - innerHeight }; })()`);
async function tabUntil(name, shift = false, max = 16) { for (let i = 0; i < max; i++) { await tab(shift); if ((await focusedName()) === name) return true; } return false; }
const tabbable = () => evalJs(`[...document.querySelectorAll('a[href], button:not([disabled])')].filter((e) => e.offsetParent !== null || e.getClientRects().length).length`);

// L1-L5, landscape and portrait, one oversized-or-not row (round 23, the "Next" row).
async function rowCase(version, lang, state, vp) {
  await load(version, lang, state, vp);
  const out = { titleRow: await evalJs(`document.documentElement.dataset.titleRow || 'n/a'`) };
  const order = []; for (let i = 0; i < 6; i++) { await tab(); order.push(await focusedName()); }
  out.tabOrder = order; out.tabForward = { focused: await focusedName(), ...(await rowBox('23')), focus: (await geo()).focus };
  await tab(); const after23 = await focusedName(); await tab(true); out.shiftTabFromNav = { from: after23, focused: await focusedName(), ...(await rowBox('23')), focus: (await geo()).focus };
  await tab(true); out.shiftTabTo22 = { focused: await focusedName(), ...(await rowBox('22')), focus: (await geo()).focus };
  // L2: every part reachable by scrolling (no focus involved).
  let b = await rowBox('23'); await evalJs(`document.activeElement.blur(); window.scrollBy(0, ${b.rowTop} - Math.max(0, document.querySelector('.appbar--sticky').getBoundingClientRect().bottom)); true`); await frames(); out.scrollTopToBand = await rowBox('23');
  b = await rowBox('23'); await evalJs(`window.scrollBy(0, ${b.rowTop + b.rowH} - document.querySelector('.tabbar').getBoundingClientRect().top); true`); await frames(); out.scrollBottomToNav = await rowBox('23');
  // L4 (Chrome part only): the row's accessible name is complete whatever is visible.
  out.accessibleName = await evalJs(`(() => { const l = [...document.querySelectorAll('.ev')].find((x) => x.querySelector('.ev__num').textContent.trim() === '23').querySelector('.ev__link'); return (l.getAttribute('aria-label') || l.textContent).trim().replace(/\\s+/g, ' '); })()`);
  return out;
}

// Focus walk: 10 Tab, 9 Shift+Tab.
async function walkCase(version, lang, state, vp) {
  await load(version, lang, state, vp);
  const fw = []; for (let i = 0; i < 10; i++) { await tab(); fw.push((await geo()).focus); }
  const bw = []; for (let i = 0; i < 9; i++) { await tab(true); bw.push((await geo()).focus); }
  return { forward: fw, backward: bw };
}

// Status changes with keyboard focus on a race row (Tab) and, separately, scrolled with no focus.
// The Flutter order: a refresh hides the failure while it runs; a failure is shown after; success clears it.
const SEQUENCE = [['refresh starts', 'refreshing'], ['refresh fails', 'failed'], ['retry starts', 'refreshing'], ['retry fails again', 'failed'],
  ['retry starts', 'refreshing'], ['refresh succeeds', 'default'], ['data goes stale', 'stale'], ['refresh starts (stale)', 'refreshing,stale'], ['refresh succeeds', 'default']];
async function statusCase(version, lang, vp, withFocus) {
  await load(version, lang, 'default', vp);
  let watch;
  if (withFocus) { await tabUntil('22'); watch = '22'; }
  else { await scrollTo(Math.round((await geo()).maxScroll / 2)); const g = await geo(); watch = (g.rows.find((r) => r.visible > 0.5) || g.rows[1]).round; }
  const rec = async (label) => { const g = await geo(); const r = await rowBox(watch);
    return { label, scrollY: g.scrollY, pinnedBottom: g.pinnedBottom, listViewport: g.listViewport, watchedRowTop: r.rowTop, status: g.status.map((s) => `${s.kind}${s.inHeader ? '@header' : ''} on-screen ${s.onScreen}`), focus: g.focus }; };
  const steps = [await rec('start')];
  for (const [label, state] of SEQUENCE) { await setState(state); await sleep(150); await frames(); steps.push(await rec(label)); }
  return { watchedRound: watch, steps, roleStatus: await evalJs(`document.querySelectorAll('[role=status]').length`), ariaLive: await evalJs(`document.querySelectorAll('[aria-live]').length`) };
}

// Environment changes with keyboard focus on a race row: text scale, rotation, viewport height.
async function envCase(version, lang, state, round) {
  const rec = async (label) => { const g = await geo(); const r = await rowBox(round);
    return { label, vp: `${await evalJs('innerWidth')}x${g.viewportH}`, font: g.rootFont, titleRow: g.titleRow, pinnedBottom: g.pinnedBottom, listViewport: g.listViewport, focused: await focusedName(),
      rowH: r.rowH, fits: r.fits, hiddenTop: r.hiddenTop, hiddenBottom: r.hiddenBottom, visible: r.visible }; };
  const font = async (pct) => { await evalJs(`document.documentElement.style.fontSize = '${pct}%'; true`); await frames(); };
  await load(version, lang, state, [320, 693, 200]); await tabUntil(round);
  const out = [await rec('portrait 200%, focused by Tab')];
  await font(100); out.push(await rec('text 100%')); await font(200); out.push(await rec('text 200% again'));
  await viewport(693, 320); out.push(await rec('rotated to landscape'));
  await font(100); out.push(await rec('landscape, text 100%')); await font(200); out.push(await rec('landscape, text 200% again'));
  await viewport(320, 693); out.push(await rec('rotated back to portrait'));
  await viewport(320, 520); out.push(await rec('viewport height 520'));
  await viewport(320, 693); out.push(await rec('viewport height 693'));
  return out;
}

// Open a Grand Prix (hash route) from a keyboard-focused row and come back.
async function backCase(version, lang, state, vp, round) {
  await load(version, lang, state, vp); await tabUntil(round);
  const before = { scrollY: (await geo()).scrollY, ...(await rowBox(round)) };
  await evalJs(`document.activeElement.click(); true`); await sleep(200);
  await evalJs(`new Promise((r) => { addEventListener('popstate', () => r(true), { once: true }); history.back(); })`); await frames();
  return { hash: await evalJs('location.hash'), before, after: { scrollY: (await geo()).scrollY, focused: await focusedName(), ...(await rowBox(round)) } };
}

// Layout stability: no further writes after settling (B and C publish CSS variables).
async function settleCase(version, lang, vp) {
  await load(version, lang, 'failed', vp);
  await evalJs(`(() => { window.__w = 0; new MutationObserver(() => window.__w++).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-title-row'] }); return true; })()`);
  await sleep(1000); return evalJs('window.__w');
}


// Snackbar text length (assumption, not a Flutter render): each notice string set in the notice's own
// font at the given width minus a floating snackbar's 15px side margins and 16px side padding.
async function snackTextCase(lang, vp) {
  await load('B', lang, 'default', vp);
  return evalJs(`(() => { const q = (v) => Math.round(v * 100) / 100, span = document.querySelector('.notice span'), cs = getComputedStyle(span), nav = document.querySelector('.tabbar').getBoundingClientRect(),
    hdr = document.querySelector('.appbar--sticky').getBoundingClientRect(), width = innerWidth - 30 - 32;
    return [...document.querySelectorAll('.notice span')].map((s) => { const d = document.createElement('div'); d.textContent = s.textContent;
      Object.assign(d.style, { position: 'absolute', visibility: 'hidden', width: width + 'px', font: cs.font, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, fontVariationSettings: cs.fontVariationSettings });
      document.body.append(d); const h = d.getBoundingClientRect().height, lines = Math.round(h / parseFloat(cs.lineHeight)); d.remove();
      return { state: s.parentElement.dataset.state, chars: s.textContent.length, textWidth: width, fontSize: cs.fontSize, lines, textH: q(h), snackH: q(h + 28), band: q(nav.top - hdr.bottom), shareOfBand: q((h + 28) / (nav.top - hdr.bottom) * 100) }; }); })()`);
}

// ---------- Run ----------
const STATIC_VPS = [[320, 693, 200], [320, 693, 100], [390, 844, 100], [390, 844, 200], [693, 320, 200], [693, 320, 100]];
const result = { generated: new Date().toISOString(), chrome: (await send('Browser.getVersion')).product, dpr: DPR, raster: 'software',
  note: 'Chrome device emulation: no Android status or navigation bars (safe-area insets 0). A = calendar-title-fit, B = calendar-stage1, C = calendar-sticky-split.',
  static: {}, row: {}, walk: {}, status: {}, env: {}, back: {}, settle: {}, snackText: {} };
for (const lang of Object.keys(PAGES)) for (const vp of [[320, 693, 200], [390, 844, 200], [390, 844, 100], [693, 320, 200]]) result.snackText[`${lang}|${vp.join('x')}`] = await snackTextCase(lang, vp);
for (const lang of Object.keys(PAGES)) for (const vp of STATIC_VPS) for (const state of STATES) for (const v of Object.keys(VERSIONS))
  result.static[`${v}|${lang}|${state}|${vp.join('x')}`] = await staticCase(v, lang, state, vp);
for (const lang of Object.keys(PAGES)) for (const v of Object.keys(VERSIONS)) {
  for (const state of ['default', 'failed']) for (const vp of [[693, 320, 200], [320, 693, 200], [693, 320, 100]]) result.row[`${v}|${lang}|${state}|${vp.join('x')}`] = await rowCase(v, lang, state, vp);
  for (const state of ['default', 'failed']) for (const vp of [[320, 693, 200], [693, 320, 200], [390, 844, 100]]) result.walk[`${v}|${lang}|${state}|${vp.join('x')}`] = await walkCase(v, lang, state, vp);
  for (const vp of [[320, 693, 200], [693, 320, 200]]) for (const f of [true, false]) result.status[`${v}|${lang}|${vp.join('x')}|${f ? 'focused' : 'scrolled'}`] = await statusCase(v, lang, vp, f);
  for (const round of ['22', '23']) result.env[`${v}|${lang}|failed|round${round}`] = await envCase(v, lang, 'failed', round);
  for (const vp of [[320, 693, 200], [693, 320, 200]]) result.back[`${v}|${lang}|failed|${vp.join('x')}`] = await backCase(v, lang, 'failed', vp, '22');
  for (const vp of [[320, 693, 200], [693, 320, 200]]) result.settle[`${v}|${lang}|${vp.join('x')}`] = await settleCase(v, lang, vp);
}
writeFileSync(join(OUT, 'stage1.json'), JSON.stringify(result, null, 1));
console.log('wrote', join(OUT, 'stage1.json'));
ws.close(); chrome.kill();
