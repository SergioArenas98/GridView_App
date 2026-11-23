// Status visual consistency EXPERIMENT (Step 49E): current (pilot) vs proposed
// (this folder) for the affected frames only. Read-only for every source;
// writes a new validation-<stamp>-experiment/ folder here.
//
//   node checks.mjs [--out <dir>] [--no-screens]
//
// Harness copied from ../notice-coexistence/checks.mjs (Chrome flags, software
// raster, DPR 2, CDP, no dependencies). Chrome emulation only: no Android, no
// TalkBack. "Accessible text" = text content without aria-hidden subtrees, an
// approximation of the accessible name, not a screen-reader measurement.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PILOT = resolve(HERE, '../../consolidation-pilot');
const VIEWPORTS = [[390, 844, 100], [320, 693, 200]];
const DPR = 2;
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const SCREENS = !argv.includes('--no-screens');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-experiment`));
mkdirSync(join(OUT, 'screens'), { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-svc-'))}`,
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

async function open(path, [w, h, scale]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
  await send('Page.navigate', { url: pathToFileURL(path).href });
  await sleep(400);
  await evalJs(`new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r))`);
  await evalJs('document.fonts.ready.then(() => true)');
  if (scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
  await sleep(450); await frames();
}
const shots = [];
async function shotClip(name, sel) {
  if (!SCREENS) return;
  const r = await evalJs(`(() => { const e = ${sel}; e.scrollIntoView({ block: 'start' }); const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; })()`);
  await frames();
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: Math.min(r.h, 1400), scale: 1 } });
  writeFileSync(join(OUT, 'screens', `${name}.png`), Buffer.from(data, 'base64'));
  shots.push(`screens/${name}.png`);
}
async function shotViewport(name) {
  if (!SCREENS) return;
  await evalJs('window.scrollTo(0, 0); true'); await frames();
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, 'screens', `${name}.png`), Buffer.from(data, 'base64'));
  shots.push(`screens/${name}.png`);
}
const vpName = ([w, h, s]) => `${w}x${h}-${s}`;

// Frame selectors: a gallery frame by its number, or the first frame containing a text.
const byNum = (n) => `[...document.querySelectorAll('section.spec')].find((s) => s.querySelector('.spec__title').textContent.trim().startsWith('${n}.')).querySelector('.spec__frame')`;
const byText = (t) => `[...document.querySelectorAll('section.spec')].find((s) => s.querySelector('.spec__frame') && s.querySelector('.spec__frame').textContent.includes(${JSON.stringify(t)})).querySelector('.spec__frame')`;

// Measured inside one frame. Contrast of a chip's border against the page ground (#141518) and the raised tray (#1F2125).
const MEASURE = (sel) => `(() => { const q = (v) => Math.round(v * 100) / 100; const f = ${sel};
  const lum = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return q((x + 0.05) / (y + 0.05)); };
  const parse = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const blend = (c, bg) => { const a = c.length > 3 ? c[3] : 1; return [0, 1, 2].map((i) => Math.round(c[i] * a + bg[i] * (1 - a))); };
  const acc = (e) => { if (e.nodeType === 3) return e.data; if (e.nodeType !== 1 || e.getAttribute('aria-hidden') === 'true') return ''; return [...e.childNodes].map(acc).join(''); };
  const chips = [...f.querySelectorAll('.chip')].map((c) => { const cs = getComputedStyle(c), r = c.getBoundingClientRect();
    const border = parse(cs.borderTopColor), lines = c.getClientRects().length && (() => { const rg = document.createRange(); rg.selectNodeContents(c); return new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size; })();
    return { cls: c.className.replace('chip ', ''), text: acc(c).trim(), h: q(r.height), w: q(r.width), style: cs.borderTopStyle, borderW: cs.borderTopWidth, fill: cs.backgroundColor,
      clipped: c.scrollWidth > c.clientWidth + 1, lines,
      borderContrast: cs.borderTopStyle === 'none' ? null : { ground: ratio(blend(border, [20, 21, 24]), [20, 21, 24]), tray: ratio(blend(border, [31, 33, 37]), [31, 33, 37]) } }; });
  const sess = [...f.querySelectorAll('.sess__status')].map((s) => ({ text: acc(s).trim(), h: q(s.getBoundingClientRect().height) }));
  const tabbable = [...f.querySelectorAll('a[href], button')].map((e) => (e.getAttribute('aria-label') || acc(e)).trim().replace(/\\s+/g, ' ').slice(0, 40));
  return { frameH: q(f.getBoundingClientRect().height), accessibleText: acc(f).replace(/\\s+/g, ' ').trim(), chips, sessions: sess, tabbable }; })()`;
const NOTICES = `(() => { const q = (v) => Math.round(v * 100) / 100; const b = document.querySelector('.page-notice');
  const n = [...b.querySelectorAll('.notice')].map((e) => ({ kind: e.dataset.kind, icon: e.querySelector('use').getAttribute('href'), iconAriaHidden: e.querySelector('svg').getAttribute('aria-hidden'), text: e.textContent.trim(), h: q(e.getBoundingClientRect().height), role: e.getAttribute('role') }));
  return { blockH: q(b.getBoundingClientRect().height), notices: n, symbolsDefined: n.every((x) => !!document.querySelector(x.icon)) }; })()`;

const results = { generated: new Date().toISOString(), dpr: DPR, raster: 'software', note: 'Chrome emulation only; no Android, no TalkBack. Accessible text excludes aria-hidden subtrees.', frames: {}, notices: {} };

// [id, pilot screen, proposed page, selector, screenshot plan: viewport+lang keys]
const FRAMES = [
  ['A1-gp-hero-unknown', 'grand-prix-detail', 'gp-states', byNum(8), ['en|390x844-100', 'es|320x693-200']],
  ['A2-gp-session-unknown', 'grand-prix-detail', 'gp-states', byNum(9), ['en|320x693-200']],
  ['A3-gp-finish-unknown', 'grand-prix-detail', 'gp-states', byNum(22), ['en|390x844-100']],
  ['A4-cd-format-unknown', 'circuit-detail', 'cd-states', null, ['es|320x693-200']],
  ['B1-gp-provisional-section', 'grand-prix-detail', 'gp-states', byNum(20), []],
  ['B2-gp-certainty-vocabulary', 'grand-prix-detail', 'gp-states', byNum(25), ['en|390x844-100', 'es|320x693-200']],
  ['B3-dd-provisional', 'driver-detail', 'dd-states', null, ['en|320x693-200']],
  ['B4-td-provisional', 'team-detail', 'td-states', null, []],
];
const FORMAT = { en: 'Format unknown', es: 'Formato desconocido' };
for (const [id, screen, page, sel0, plan] of FRAMES) for (const lang of ['en', 'es']) for (const vp of VIEWPORTS) {
  const sfx = lang === 'en' ? '' : '.es';
  const sel = sel0 || (id.startsWith('A4') ? byText(FORMAT[lang]) : byText('Provisional'));
  const rec = {};
  for (const [label, path] of [['current', join(PILOT, screen, `states${sfx}.html`)], ['proposed', join(HERE, `${page}${sfx}.html`)]]) {
    await open(path, vp);
    rec[label] = await evalJs(MEASURE(sel));
    if (plan.includes(`${lang}|${vpName(vp)}`)) await shotClip(`${id}-${label}-${lang}-${vpName(vp)}`, sel);
  }
  rec.accessibleTextUnchanged = rec.current.accessibleText === rec.proposed.accessibleText;
  rec.tabOrderUnchanged = JSON.stringify(rec.current.tabbable) === JSON.stringify(rec.proposed.tabbable);
  rec.frameHeightDelta = Math.round((rec.proposed.frameH - rec.current.frameH) * 100) / 100;
  results.frames[`${id}|${lang}|${vpName(vp)}`] = rec;
}
// Reference only: Standings mixed-table dagger (unchanged pilot).
for (const lang of ['en', 'es']) {
  await open(join(PILOT, 'standings', `states${lang === 'en' ? '' : '.es'}.html`), [390, 844, 100]);
  results.frames[`B0-standings-dagger-reference|${lang}|390x844-100`] = { current: await evalJs(MEASURE(byNum(8))) };
  if (lang === 'en') await shotClip('B0-standings-dagger-reference-en-390x844-100', byNum(8));
}

// Notices: current (cloud-off everywhere) vs proposed (cause icons).
const NPLAN = { 'failed-partial': ['es|320x693-200'], 'combined-partial': ['en|390x844-100', 'es|320x693-200'], stale: ['en|390x844-100'] };
for (const [variant, plan] of Object.entries(NPLAN)) for (const lang of ['en', 'es']) for (const vp of VIEWPORTS) {
  const sfx = lang === 'en' ? '' : '.es';
  const rec = {};
  for (const icons of ['current', 'proposed']) {
    await open(join(HERE, `notices-${icons}-${variant}${sfx}.html`), vp);
    rec[icons] = await evalJs(NOTICES);
    if (plan.includes(`${lang}|${vpName(vp)}`)) await shotViewport(`C-${variant}-${icons}-${lang}-${vpName(vp)}`);
  }
  rec.textUnchanged = JSON.stringify(rec.current.notices.map((n) => n.text)) === JSON.stringify(rec.proposed.notices.map((n) => n.text));
  rec.heightUnchanged = rec.current.blockH === rec.proposed.blockH;
  results.notices[`${variant}|${lang}|${vpName(vp)}`] = rec;
}

results.screens = shots;
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const L = [`Status visual consistency (Step 49E) - ${results.generated}`, results.note, '', 'Frames (current -> proposed): changed chips, accessible text, tab order, height delta'];
for (const [k, v] of Object.entries(results.frames)) {
  if (!v.proposed) { L.push(`  ${k.padEnd(48)} reference: ${v.current.chips.filter((c) => /provisional/i.test(c.text)).map((c) => `${c.cls} "${c.text}" ${c.h}px`).join('; ')}`); continue; }
  const diff = v.proposed.chips.map((c, i) => [v.current.chips[i], c]).filter(([a, b]) => a && (a.cls !== b.cls || a.text !== b.text));
  const fmt = (c) => `${c.cls} "${c.text}" ${c.style} ${c.h}px${c.lines > 1 ? ` ${c.lines} lines` : ''}${c.clipped ? ' CLIPPED' : ''}${c.borderContrast ? ` border ${c.borderContrast.ground}:1` : ''}`;
  const sess = v.current.sessions.map((s, i) => [s, v.proposed.sessions[i]]).filter(([a, b]) => a.text === b.text && /unknown|desconocido/i.test(a.text)).map(([a, b]) => `session "${a.text}" ${a.h}->${b.h}px`);
  L.push(`  ${k.padEnd(48)} ${diff.map(([a, b]) => `${fmt(a)} -> ${fmt(b)}`).join(' | ') || '(chip classes unchanged)'} ${sess.join(' ')}  accText same ${v.accessibleTextUnchanged}  tab same ${v.tabOrderUnchanged}  dH ${v.frameHeightDelta}  anyClipped ${v.proposed.chips.some((c) => c.clipped)}`);
}
L.push('', 'Notices (current -> proposed icons)');
for (const [k, v] of Object.entries(results.notices)) L.push(`  ${k.padEnd(34)} ${v.current.notices.map((n) => n.icon).join('+')} -> ${v.proposed.notices.map((n) => n.icon).join('+')}  text same ${v.textUnchanged}  height same ${v.heightUnchanged} (${v.proposed.blockH}px)  symbols ok ${v.proposed.symbolsDefined}  icons aria-hidden ${v.proposed.notices.every((n) => n.iconAriaHidden === 'true')}`);
L.push('', `Screens: ${shots.length}`);
writeFileSync(join(OUT, 'summary.txt'), L.join('\n') + '\n');
console.log(`wrote ${OUT} (${shots.length} screens)`);
ws.close(); chrome.kill();
process.exit(0);
