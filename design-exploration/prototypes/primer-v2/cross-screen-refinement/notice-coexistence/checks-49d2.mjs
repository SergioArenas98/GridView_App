// Notice coexistence EXPERIMENT, Step 49D.2: final combined-copy comparison and
// the two non-overlay Calendar first-open options. Focused, not a regression
// sweep. Read-only for every source; writes only a new
// validation-<stamp>-49d2/ folder here.
//
//   node checks-49d2.mjs [--out <dir>] [--no-screens]
//
// Harness copied from checks.mjs (Chrome flags, software raster, DPR 2, CDP,
// no dependencies). Chrome emulation only: no Android system bars, no
// TalkBack. "Accessible order" lists DOM order without aria-hidden content:
// an approximation of a screen reader's linear order, not a measurement.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DPR = 2;
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const SCREENS = !argv.includes('--no-screens');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-49d2`));
mkdirSync(join(OUT, 'screens'), { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-nc2-'))}`,
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

async function open(file, query, [w, h, scale], { scaleAfterLoad = false } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const q = new URLSearchParams(query);
  if (!scaleAfterLoad && scale !== 100) q.set('scale', String(scale));
  const qs = q.toString();
  await send('Page.navigate', { url: pathToFileURL(join(HERE, file)).href + (qs ? `?${qs}` : '') });
  await sleep(400);
  await evalJs(`new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r))`);
  await evalJs('document.fonts.ready.then(() => true)');
  if (scaleAfterLoad && scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
  await sleep(450); await frames();
}
const shots = [];
async function shot(name) {
  if (!SCREENS) return;
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, 'screens', `${name}.png`), Buffer.from(data, 'base64'));
  shots.push(`screens/${name}.png`);
}
const vpName = ([w, h, s]) => `${w}x${h}-${s}`;
const KEY = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 };
async function tab() {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...KEY });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...KEY });
  await sleep(220); await frames();
}

// Lines of a notice's text, from the rendered line boxes.
const LINES = `const lines = (el) => { const t = el.querySelector('span') || el; const node = t.firstChild; if (!node) return [];
  const out = []; let cur = '', top = null; const r = document.createRange();
  for (let i = 0; i < node.length; i++) { r.setStart(node, i); r.setEnd(node, i + 1); const b = r.getBoundingClientRect(); if (!b.width && node.data[i] !== ' ') continue;
    if (top !== null && b.top - top > 4) { out.push(cur.trim()); cur = ''; } if (top === null || b.top - top > 4) top = b.top; cur += node.data[i]; }
  if (cur.trim()) out.push(cur.trim()); return out; };`;

const CAL = `(() => { const q = (v) => Math.round(v * 100) / 100; ${LINES}
  const H = innerHeight, hdr = document.querySelector('.appbar--sticky').getBoundingClientRect(), nav = document.querySelector('.tabbar').getBoundingClientRect();
  const top = Math.max(0, hdr.bottom), bottom = nav.top, clip = (r) => Math.max(0, Math.min(r.bottom, bottom) - Math.max(r.top, top));
  const notices = [...document.querySelectorAll('.cal > .notice')].filter((e) => !e.hidden).map((e) => { const r = e.getBoundingClientRect();
    return { kind: e.dataset.state, h: q(r.height), top: q(r.top), fullyVisible: r.top >= top - 0.5 && r.bottom <= bottom + 0.5, lines: lines(e) }; });
  const next = document.querySelector('.ev--next').getBoundingClientRect(), first = document.querySelector('.ev').getBoundingClientRect();
  const line = document.querySelector('.ev-status'), lr = line && !line.hidden ? line.getBoundingClientRect() : null;
  const order = [...document.querySelectorAll('.cal > .freshness, .cal > .notice, .ev-status, .ev')].filter((e) => !e.hidden)
    .map((e) => ({ item: e.matches('.notice') ? 'notice:' + e.dataset.state : e.matches('.ev-status') ? 'inline-status' : e.matches('.freshness') ? 'caption' : 'round ' + e.querySelector('.ev__num').textContent.trim(),
      ariaHidden: !!e.closest('[aria-hidden="true"]') }));
  const live = [...document.querySelectorAll('[role="status"]')].filter((e) => !e.hidden && e.textContent.trim());
  return { scrollY: Math.round(scrollY), maxScroll: document.documentElement.scrollHeight - H, band: q(bottom - top), notices,
    firstRace: { top: q(first.top), visiblePx: q(clip(first)) },
    nextRace: { top: q(next.top), h: q(next.height), visiblePx: q(clip(next)), fullyVisible: next.top >= top - 0.5 && next.bottom <= bottom + 0.5, scrollToReachTop: q(Math.max(0, next.top - top)) },
    inline: lr ? { h: q(lr.height), top: q(lr.top), visible: lr.top >= top - 0.5 && lr.bottom <= bottom + 0.5, text: line.textContent.trim(), lines: lines(line) } : null,
    accessibleOrder: order.filter((o) => !o.ariaHidden).map((o) => o.item), ariaHiddenItems: order.filter((o) => o.ariaHidden).map((o) => o.item),
    liveRegionsWithText: live.length, data: { ...document.documentElement.dataset } }; })()`;
const FOCUS = `(() => { const q = (v) => Math.round(v * 100) / 100; const f = document.activeElement;
  const hdr = document.querySelector('.appbar--sticky').getBoundingClientRect(), nav = document.querySelector('.tabbar').getBoundingClientRect(), top = Math.max(0, hdr.bottom);
  const r = f.getBoundingClientRect(), where = f.closest('header') ? 'header' : f.closest('nav') ? 'nav' : 'content';
  const name = (f.closest('.ev')?.querySelector('.ev__num')?.textContent || f.getAttribute('aria-label') || f.textContent).trim().slice(0, 24);
  const vis = Math.max(0, Math.min(r.bottom, nav.top) - Math.max(r.top, top));
  return { name, where, scrollY: Math.round(scrollY), clear: where !== 'content' || (r.top >= top - 0.5 && r.bottom <= nav.top + 0.5), visiblePx: q(vis), h: q(r.height) }; })()`;
const DET = `(() => { const q = (v) => Math.round(v * 100) / 100; ${LINES}
  const H = innerHeight, bar = document.querySelector('.dbar').getBoundingClientRect(), block = document.querySelector('.page-notice').getBoundingClientRect(), name = document.getElementById('dp-name').getBoundingClientRect();
  return { blockH: q(block.height), blockPct: q(block.height / (H - bar.bottom) * 100), nameTop: q(name.top), nameVisible: name.bottom <= H,
    notices: [...document.querySelectorAll('.page-notice .notice')].map((e) => ({ kind: e.dataset.kind, h: q(e.getBoundingClientRect().height), lines: lines(e) })) }; })()`;

const results = { generated: new Date().toISOString(), dpr: DPR, raster: 'software', note: 'Chrome emulation only; no Android system bars; no TalkBack.', copy: {}, open: {} };

// ---------- 1. Combined copy: candidate A (49D.1) vs candidate B ----------
for (const vp of [[320, 693, 200], [693, 320, 200]]) for (const lang of ['en', 'es']) {
  const cal = lang === 'en' ? 'calendar.html' : 'calendar.es.html';
  for (const [cand, extra] of [['A', ''], ['B', '&copy=b']]) {
    await open(cal, `state=failed,stale${extra}`, vp);
    const m = await evalJs(CAL);
    results.copy[`calendar|${lang}|${vpName(vp)}|${cand}`] = { notice: m.notices[0], firstRaceVisiblePx: m.firstRace.visiblePx, band: m.band };
    if (vp[0] === 320) await shot(`copy-calendar-${cand}-${lang}-${vpName(vp)}`);
    const det = `detail-${cand === 'A' ? 'combined' : 'combined-b'}-partial${lang === 'en' ? '' : '.es'}.html`;
    await open(det, '', vp, { scaleAfterLoad: true });
    results.copy[`detail|${lang}|${vpName(vp)}|${cand}`] = await evalJs(DET);
    if (vp[0] === 320 && cand === 'B') await shot(`copy-detail-B-${lang}-${vpName(vp)}`);
  }
}

// ---------- 2. Calendar first open: reference (anchored, no cue), A (notice first), B (inline line) ----------
const MODES = { reference: 'anchor=1', A: 'anchor=1&open=notice', B: 'anchor=1&inline=1' };
for (const vp of [[320, 693, 200], [693, 320, 200]]) for (const lang of ['en', 'es']) for (const state of ['failed', 'stale']) for (const [mode, q] of Object.entries(MODES)) {
  const cal = lang === 'en' ? 'calendar.html' : 'calendar.es.html';
  await open(cal, `state=${state}&${q}`, vp);
  const atOpen = await evalJs(CAL);
  await sleep(1500); await frames();
  const later = await evalJs(CAL);
  const rec = { atOpen, scrollStableAfter1500ms: later.scrollY === atOpen.scrollY && later.nextRace.top === atOpen.nextRace.top };
  const wantShot = (mode !== 'reference') && ((state === 'failed' && lang === 'en') || (state === 'stale' && lang === 'es'));
  if (wantShot) await shot(`open-${mode}-${state}-${lang}-${vpName(vp)}`);
  // Keyboard walk from the fresh state: Tab until round 23 (or 9 stops).
  const walk = [];
  for (let i = 0; i < 9; i++) { await tab(); const f = await evalJs(FOCUS); walk.push(f); if (f.name === '23') break; }
  rec.keyboard = { stopsToNextRace: walk.findIndex((f) => f.name === '23') + 1 || null, walk,
    jumps: walk.map((f, i) => (i === 0 ? f.scrollY - atOpen.scrollY : f.scrollY - walk[i - 1].scrollY)) };
  results.open[`${lang}|${vpName(vp)}|${state}|${mode}`] = rec;
}

results.screens = shots;
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));

const L = [`Notice coexistence, Step 49D.2 - ${results.generated}`, results.note, '', '1. Combined copy (failure + stale): A = 49D.1 candidate, B = Step 49D.2 candidate'];
for (const [k, v] of Object.entries(results.copy)) {
  if (k.startsWith('calendar')) L.push(`  ${k.padEnd(32)} notice ${String(v.notice.h).padStart(7)}px  lines ${v.notice.lines.length}  first race visible ${String(v.firstRaceVisiblePx).padStart(7)}px  | ${v.notice.lines.join(' / ')}`);
  else { const c = v.notices[0]; L.push(`  ${k.padEnd(32)} notice ${String(c.h).padStart(7)}px  lines ${c.lines.length}  block ${v.blockH}px (${v.blockPct}%)  name top ${v.nameTop} visible ${v.nameVisible}  | ${c.lines.join(' / ')}`); }
}
L.push('', '2. Calendar first open (reference = anchored, no cue; A = notice first; B = inline line before the next race)');
for (const [k, v] of Object.entries(results.open)) {
  const o = v.atOpen;
  L.push(`  ${k.padEnd(30)} scrollY ${String(o.scrollY).padStart(5)}  notice visible ${String(o.notices.every((n) => n.fullyVisible)).padEnd(5)}  next race visible ${String(o.nextRace.visiblePx).padStart(7)}/${o.nextRace.h}px (scroll ${o.nextRace.scrollToReachTop}px to reach)  inline ${o.inline ? `${o.inline.h}px "${o.inline.text}" visible ${o.inline.visible}` : '-'}  stable ${v.scrollStableAfter1500ms}  tabs to 23: ${v.keyboard.stopsToNextRace}  jumps [${v.keyboard.jumps.join(', ')}]  focus clear ${v.keyboard.walk.every((f) => f.clear)}  order ${o.accessibleOrder.slice(0, 3).join(' > ')}  live ${o.liveRegionsWithText}`);
}
L.push('', `Screens: ${shots.length}`);
writeFileSync(join(OUT, 'summary.txt'), L.join('\n') + '\n');
console.log(`wrote ${OUT} (${shots.length} screens)`);
ws.close(); chrome.kill();
process.exit(0);
