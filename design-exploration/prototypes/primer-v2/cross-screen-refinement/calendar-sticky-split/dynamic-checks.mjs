// Calendar sticky-split EXPERIMENT (Step 48C): measured geometry and dynamic
// behaviour, before (../calendar-title-fit/, the visually approved title-fit
// variant) and after (this folder). Dependency-free: headless Chrome over the
// DevTools Protocol, software raster, DPR 2, mobile + touch emulation, the
// same launch flags as ../../consolidation-pilot/tools/visual-compare.mjs.
//
//   node dynamic-checks.mjs [--out <dir>]
//
// Covers what the comparison tool's steps cannot drive: Shift+Tab, viewport
// changes inside one page load (portrait <-> landscape), notices that appear
// or disappear while scrolled. Every value is read in the page
// (getBoundingClientRect / getComputedStyle); nothing is estimated. Chrome
// emulation has no Android system bars: env(safe-area-inset-*) is 0 here.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSIONS = { before: resolve(HERE, '../calendar-title-fit'), after: HERE };
const PAGES = { en: 'index.html', es: 'index.es.html' };
const STATES = ['default', 'refreshing', 'stale', 'failed'];
const VIEWPORTS = [[320, 693, 200], [320, 693, 100], [390, 844, 100], [390, 844, 200]];
const DPR = 2;
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-dynamic`));
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
async function focusCase(version, lang, state, vp) {
  await load(version, lang, state, vp);
  const forward = []; for (let i = 0; i < 10; i++) { await tab(); forward.push((await geo()).focus); }
  const backward = []; for (let i = 0; i < 9; i++) { await tab(true); backward.push((await geo()).focus); }
  return { forward, backward };
}
async function anchorCase(version, lang, state, vp) {   // first open: one-time positioning on the relevant event
  await load(version, lang, state, vp);
  await evalJs(`document.getElementById('anchor').scrollIntoView({ block: 'start' }); true`); await frames();
  const g = await geo(); const next = g.rows.find((r) => r.round === '23');
  return { scrollY: g.scrollY, anchorTop: next.top, pinnedBottom: g.pinnedBottom, anchorVisible: next.visible, clear: next.top >= g.pinnedBottom - 0.5 };
}
async function backCase(version, lang, state, vp) {   // open a Grand Prix (hash route) and come back
  await load(version, lang, state, vp);
  await focusRow(2); const before = await geo();
  await evalJs(`document.activeElement.click(); true`); await sleep(200);
  await evalJs(`new Promise((r) => { addEventListener('popstate', () => r(true), { once: true }); history.back(); })`); await frames();
  const after = await geo();
  return { hashAfterBack: await evalJs('location.hash'), before: { scrollY: before.scrollY, focus: before.focus }, after: { scrollY: after.scrollY, focus: after.focus } };
}
async function noticeCase(version, lang, vp) {   // notices change while the user is scrolled down, a row focused
  await load(version, lang, 'default', vp);
  await scrollTo(Math.round((await geo()).maxScroll / 2));
  const t0 = await geo(); const watch = t0.rows.find((r) => r.visible > 0.5) || t0.rows[1]; const idx = t0.rows.indexOf(watch);
  const step = async (label, state) => { await setState(state); await sleep(150); await frames(); const g = await geo();
    return { label, scrollY: g.scrollY, pinnedBottom: g.pinnedBottom, listViewport: g.listViewport, watchedRowTop: await rowTop(idx), status: g.status, focus: g.focus, rowsVisible: g.rowsVisible }; };
  const steps = [{ label: 'scrolled, no notice', scrollY: t0.scrollY, pinnedBottom: t0.pinnedBottom, listViewport: t0.listViewport, watchedRowTop: await rowTop(idx), status: t0.status, focus: t0.focus, rowsVisible: t0.rowsVisible }];
  steps.push(await step('refresh starts', 'refreshing'));
  steps.push(await step('refresh fails', 'refreshing,failed'));
  steps.push(await step('failure shown', 'failed'));
  steps.push(await step('refresh succeeds', 'default'));
  steps.push(await step('data goes stale', 'stale'));
  await scrollTo(0); const top = await geo();
  return { watchedRound: watch.round, steps, atTopAfterwards: { status: top.status, statusOnScreen: top.status.map((s) => s.onScreen) } };
}
async function textScaleCase(version, lang, state) {   // 200 -> 100 -> 200 % (a) with a focused row, (b) scrolled, nothing focused
  const rec = async (label) => { const g = await geo(); const first = g.rows.find((r) => r.visible > 0);
    return { label, rootFont: g.rootFont, scrollY: g.scrollY, titleRow: g.titleRow, pinnedBottom: g.pinnedBottom, listViewport: g.listViewport, firstVisibleRow: first && { round: first.round, top: first.top }, focus: g.focus }; };
  const scale = async (pct) => { await evalJs(`document.documentElement.style.fontSize = '${pct}%'; true`); await frames(); };
  await load(version, lang, state, [320, 693, 200]);
  await tabToRow(2); const focused = [await rec('200%, round 22 focused (Tab)')];
  await scale(100); focused.push(await rec('100%')); await scale(200); focused.push(await rec('200% again'));
  await load(version, lang, state, [320, 693, 200]);
  await scrollTo(300); const scrolled = [await rec('200%, scrolled 300')];
  await scale(100); scrolled.push(await rec('100%')); await scale(200); scrolled.push(await rec('200% again'));
  return { focused, scrolled };
}
async function rotateCase(version, lang, state, scale) {   // portrait -> landscape -> portrait with a keyboard-focused row
  await load(version, lang, state, [320, 693, scale]);
  await tabToRow(2);
  const rec = async (label) => { const g = await geo(); return { label, viewport: `${await evalJs('innerWidth')}x${g.viewportH}`, scrollY: g.scrollY, titleRow: g.titleRow,
    headerH: g.headerH, pinnedBottom: g.pinnedBottom, navH: g.navH, listViewport: g.listViewport, listViewportPct: g.listViewportPct, rowsVisible: g.rowsVisible, focus: g.focus }; };
  const refocus = async () => { await tab(true); await tab(); };   // Shift+Tab, Tab: back onto round 22
  const out = [await rec('portrait, round 22 focused (Tab)')];
  await viewport(693, 320); out.push(await rec('landscape'));
  await refocus(); out.push(await rec('landscape, Shift+Tab then Tab onto round 22'));
  await scrollTo(400); await tab(true); await tab(true); await tab(true); out.push(await rec('landscape, scrolled, Shift+Tab x3'));
  await viewport(320, 693); out.push(await rec('portrait again'));
  return out;
}

// ---------- Run ----------
const result = { generated: new Date().toISOString(), chrome: (await send('Browser.getVersion')).product, dpr: DPR, raster: 'software',
  note: 'Chrome device emulation: no Android status or navigation bars (safe-area insets 0).', static: {}, focus: {}, anchor: {}, back: {}, notice: {}, textScale: {}, rotate: {} };
for (const lang of Object.keys(PAGES)) for (const vp of VIEWPORTS) for (const state of STATES) for (const v of Object.keys(VERSIONS))
  result.static[`${v}|${lang}|${state}|${vp.join('x')}`] = await staticCase(v, lang, state, vp);
for (const lang of Object.keys(PAGES)) for (const state of STATES) for (const vp of [[320, 693, 200], [390, 844, 100], [693, 320, 200]]) for (const v of Object.keys(VERSIONS)) {
  const k = `${v}|${lang}|${state}|${vp.join('x')}`;
  result.focus[k] = await focusCase(v, lang, state, vp);
  result.anchor[k] = await anchorCase(v, lang, state, vp);
}
for (const lang of Object.keys(PAGES)) for (const v of Object.keys(VERSIONS)) {
  result.back[`${v}|${lang}|failed|320x693x200`] = await backCase(v, lang, 'failed', [320, 693, 200]);
  for (const vp of [[320, 693, 200], [390, 844, 100]]) result.notice[`${v}|${lang}|${vp.join('x')}`] = await noticeCase(v, lang, vp);
  for (const state of ['default', 'failed']) result.textScale[`${v}|${lang}|${state}`] = await textScaleCase(v, lang, state);
  for (const scale of [100, 200]) result.rotate[`${v}|${lang}|failed|${scale}`] = await rotateCase(v, lang, 'failed', scale);
}
writeFileSync(join(OUT, 'dynamic.json'), JSON.stringify(result, null, 1));
console.log('wrote', join(OUT, 'dynamic.json'));
ws.close(); chrome.kill();
