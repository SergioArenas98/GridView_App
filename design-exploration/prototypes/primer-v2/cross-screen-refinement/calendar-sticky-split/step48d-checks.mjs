// Calendar sticky-split, Step 48D: development-only checks behind DECISIONS-48D.md.
// Read-only against the prototypes: the two candidate behaviours below are
// injected into the page at test time and are NOT part of the experiment.
//
//   node step48d-checks.mjs [--out <dir>]
//
// 1. Landscape 693x320 @200%: an oversized focused row (round 23) - whole-row
//    fit, reachability of its top and bottom by scrolling, and a candidate
//    rule (oversized focused row aligned to its top edge).
// 2. Title-row release rule: text-scale sweeps, viewport-height sweep,
//    rotations, notices while released, content growth, focus between the
//    title controls and the rows (writes after settling = feedback loops).
// 3. Focus jump: Shift+Tab from a race row to Settings with the title row
//    released, before / after / after with a candidate keep-scroll rule.
// Harness (Chrome flags, software raster, DPR 2, geometry) copied from
// dynamic-checks.mjs (Step 48C). Chrome emulation: safe-area insets are 0.
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
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-step48d`));
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

// ================= Step 48D development-only tests (scratchpad, not in the repo) =================
const focusedRound = () => evalJs(`(document.activeElement.closest('.ev')?.querySelector('.ev__num')?.textContent || document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 30)`);
const rowBox = (round) => evalJs(`(() => { const e = [...document.querySelectorAll('.ev')].find((x) => x.querySelector('.ev__num').textContent.trim() === '${round}');
  const r = e.getBoundingClientRect(), l = e.querySelector('.ev__link').getBoundingClientRect(), hdr = document.querySelector('.appbar--sticky').getBoundingClientRect(), nav = document.querySelector('.tabbar').getBoundingClientRect();
  const top = Math.max(0, hdr.bottom), q = (v) => Math.round(v * 100) / 100;
  return { rowTop: q(r.top), rowBottom: q(r.bottom), rowH: q(r.height), linkH: q(l.height), linkTop: q(l.top), bandTop: q(top), bandBottom: q(nav.top), band: q(nav.top - top),
    hiddenTop: q(Math.max(0, top - r.top)), hiddenBottom: q(Math.max(0, r.bottom - nav.top)), scrollY: Math.round(scrollY), maxScroll: document.documentElement.scrollHeight - innerHeight }; })()`);
const rounds = () => evalJs(`[...document.querySelectorAll('.ev .ev__num')].map((n) => n.textContent.trim())`);
async function tabUntil(round, shift = false, max = 14) { for (let i = 0; i < max; i++) { await tab(shift); if ((await focusedRound()) === round) return true; } return false; }
const CANDIDATE = `(() => { const list = document.querySelector('.rounds'), hdr = document.querySelector('.appbar--sticky'), nav = document.querySelector('.tabbar');
  list.addEventListener('focusin', (e) => { const row = e.target.closest('.ev'); if (!row || !e.target.matches(':focus-visible')) return;
    requestAnimationFrame(() => { const band = nav.getBoundingClientRect().top - Math.max(0, hdr.getBoundingClientRect().bottom);
      if (row.getBoundingClientRect().height > band) row.scrollIntoView({ block: 'start' }); }); }); return true; })()`;

async function landscape(lang, state, candidate) {
  await load('after', lang, state, [693, 320, 200]);
  if (candidate) await evalJs(CANDIDATE);
  const list = await rounds(); const target = '23', last = list[list.length - 1];
  const out = { lang, state, candidate, rounds: list, titleRow: await evalJs('document.documentElement.dataset.titleRow') };
  await tabUntil(target); await frames(); out.tabForward = { focused: await focusedRound(), ...(await rowBox(target)) };
  if (last !== target) { await tabUntil(last); await tabUntil(target, true); await frames(); out.shiftTabFromBelow = { focused: await focusedRound(), ...(await rowBox(target)) }; }
  if (!candidate) {
    let b = await rowBox(target); await evalJs(`window.scrollBy(0, ${b.rowTop - b.bandTop}); true`); await frames(); out.scrollTopToBand = await rowBox(target);
    b = await rowBox(target); await evalJs(`window.scrollBy(0, ${b.rowBottom - b.bandBottom}); true`); await frames(); out.scrollBottomToNav = await rowBox(target);
    await evalJs('window.scrollTo(0, document.documentElement.scrollHeight); true'); await frames(); out.lastRowAtMax = { round: last, ...(await rowBox(last)) };
  }
  return out;
}

const RECORDER = `(() => { window.__log = []; const de = document.documentElement;
  new MutationObserver(() => window.__log.push({ t: Math.round(performance.now()), titleRow: de.dataset.titleRow, pin: de.style.getPropertyValue('--cal-pin-top') }))
    .observe(de, { attributes: true, attributeFilter: ['style', 'data-title-row'] }); return true; })()`;
const snap = () => evalJs(`(() => { const de = document.documentElement, hdr = document.querySelector('.appbar--sticky'), nav = document.querySelector('.tabbar'), q = (v) => Math.round(v * 100) / 100;
  const rows = [...document.querySelectorAll('.ev')].map((e) => e.getBoundingClientRect().height); const h = hdr.getBoundingClientRect().height, n = nav.getBoundingClientRect().height;
  return { vp: innerWidth + 'x' + innerHeight, font: de.style.fontSize || '100%', titleRow: de.dataset.titleRow, pin: de.style.getPropertyValue('--cal-pin-top'), headerFull: q(h), nav: q(n),
    tallest: q(Math.max(...rows)), tallestRound: [...document.querySelectorAll('.ev .ev__num')][rows.indexOf(Math.max(...rows))].textContent.trim(),
    bandIfPinned: q(innerHeight - h - n), margin: q(innerHeight - h - n - Math.max(...rows)), scrollY: Math.round(scrollY) }; })()`);
// Writes made by the driver after the font change itself (the font write is excluded: the log is reset after it).
const settleCount = async () => { await evalJs('window.__log.length = 0; true'); await sleep(1000); return evalJs('window.__log.length'); };
const font = async (pct) => { await evalJs(`document.documentElement.style.fontSize = '${pct}%'; true`); await frames(); };

async function stability(lang) {
  const out = { lang };
  await load('after', lang, 'failed', [693, 320, 200]); await evalJs(RECORDER);
  out.settledLandscape = { ...(await snap()), writesIn1s: await settleCount() };
  for (const [w, h] of [[693, 320], [320, 693]]) {
    await viewport(w, h); const sweep = [];
    for (const pct of [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100]) { await font(pct); sweep.push({ pct, ...(await snap()), writesIn1s: await settleCount() }); }
    out[`fontSweep_${w}x${h}`] = sweep;
  }
  await font(200);
  const heights = []; for (let hh = 693; hh >= 300; hh -= 25) { await viewport(320, hh); heights.push(await snap()); } out.heightSweep_320_200 = heights;
  const rot = []; for (let i = 0; i < 3; i++) { await viewport(693, 320); rot.push((await snap()).titleRow); await viewport(320, 693); rot.push((await snap()).titleRow); } out.rotations = rot;
  await viewport(693, 320); await evalJs('window.scrollTo(0, 200); true'); await frames();
  const notices = []; for (const s of ['default', 'refreshing', 'refreshing,failed', 'failed', 'default', 'stale', 'default']) { await setState(s); await sleep(120); await frames(); const g = await snap(); notices.push({ state: s, titleRow: g.titleRow, pin: g.pin, scrollY: g.scrollY, headerFull: g.headerFull }); }
  out.noticesWhileReleased = notices;
  const closest = heights.filter((x) => x.titleRow === 'pinned').sort((a, b) => a.margin - b.margin)[0];
  if (closest) { await viewport(320, Number(closest.vp.split('x')[1])); await evalJs('window.scrollTo(0, 0); true'); const before = await snap();
    await evalJs(`(() => { const n = document.querySelector('.ev--next .ev__name'); n.insertAdjacentHTML('beforeend', '<br>' + n.textContent); return true; })()`); await sleep(150); await frames();
    out.contentGrowth = { before, after: await snap(), writesIn1s: await settleCount() }; }
  await load('after', lang, 'failed', [693, 320, 200]); await evalJs(RECORDER);
  await tabUntil('20'); const a = { focused: await focusedRound(), ...(await snap()), row: await rowBox('20') };
  await tab(true); const b = { focused: await focusedRound(), ...(await snap()), row: await rowBox('20') };
  await tab(); const c = { focused: await focusedRound(), ...(await snap()), row: await rowBox('20') };
  out.focusHeaderRows = [a, b, c].map((x) => ({ focused: x.focused, titleRow: x.titleRow, pin: x.pin, scrollY: x.scrollY, rowTop: x.row.rowTop, bandTop: x.row.bandTop, hiddenTop: x.row.hiddenTop, hiddenBottom: x.row.hiddenBottom }));
  out.focusWritesTotal = await evalJs('window.__log.length');
  return out;
}

const result = { generated: new Date().toISOString(), chrome: (await send('Browser.getVersion')).product, landscape: [], stability: [] };
for (const lang of ['en', 'es']) for (const state of ['default', 'failed']) for (const cand of [false, true]) result.landscape.push(await landscape(lang, state, cand));
for (const lang of ['en', 'es']) result.stability.push(await stability(lang));
writeFileSync(join(OUT, 'd48.json'), JSON.stringify(result, null, 1)); console.log('wrote', join(OUT, 'd48.json'));

// Step 48D dev-only: does moving keyboard focus from a race row to Settings move the content? (landscape 693x320 @200%)
const fr = () => evalJs(`(document.activeElement.closest('.ev')?.querySelector('.ev__num')?.textContent || document.activeElement.getAttribute('aria-label') || '').trim()`);
const row20 = () => evalJs(`(() => { const e = [...document.querySelectorAll('.ev')].find((x) => x.querySelector('.ev__num').textContent.trim() === '20'); const s = document.querySelector('[aria-label]:focus'); const f = document.activeElement.getBoundingClientRect();
  return { scrollY: Math.round(scrollY), rowTop: Math.round(e.getBoundingClientRect().top * 100) / 100, focusTop: Math.round(f.top * 100) / 100, focusBottom: Math.round(f.bottom * 100) / 100, titleRow: document.documentElement.dataset.titleRow || 'n/a' }; })()`);
const KEEP = `(() => { let saved = null; const hdr = document.querySelector('.appbar--sticky');
  document.addEventListener('keydown', (e) => { if (e.key === 'Tab') saved = scrollY; }, true);
  hdr.addEventListener('focusin', () => { if (saved === null) return; const y = saved; requestAnimationFrame(() => scrollTo(0, y)); }); return true; })()`;
const out = [];
for (const lang of ['en', 'es']) for (const [version, keep] of [['before', false], ['after', false], ['after', true]]) {
  await load(version, lang, 'failed', [693, 320, 200]);
  if (keep) await evalJs(KEEP);
  for (let i = 0; i < 14 && (await fr()) !== '20'; i++) await tab();
  const a = { focused: await fr(), ...(await row20()) };
  await tab(true); await frames(); const b = { focused: await fr(), ...(await row20()) };
  await tab(); await frames(); const c = { focused: await fr(), ...(await row20()) };
  out.push({ lang, version, keep, steps: [a, b, c] });
}
writeFileSync(join(OUT, 'd48-focusjump.json'), JSON.stringify(out, null, 1));
for (const o of out) console.log(o.lang, o.version, o.keep ? 'KEEP' : '', o.steps.map((s) => `${s.focused}: y=${s.scrollY} row20=${s.rowTop} focus=${s.focusTop}..${s.focusBottom} ${s.titleRow}`).join(' | '));
ws.close(); chrome.kill();
