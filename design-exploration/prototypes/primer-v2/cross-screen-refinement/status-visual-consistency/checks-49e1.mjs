// Status visual consistency EXPERIMENT, Step 49E.1: the Standings provisional
// row marker with and without the dagger. Focused; no other comparison is
// regenerated. Writes a new validation-<stamp>-49e1/ folder here.
//
//   node checks-49e1.mjs [--out <dir>] [--no-screens]
//
// Harness copied from checks.mjs (Chrome, software raster, DPR 2, CDP, no
// dependencies). Chrome emulation only: no Android, no TalkBack.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PILOT = resolve(HERE, '../../consolidation-pilot/standings');
const DPR = 2;
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const SCREENS = !argv.includes('--no-screens');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-49e1`));
mkdirSync(join(OUT, 'screens'), { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-svc1-'))}`,
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
const frameSel = (n) => `[...document.querySelectorAll('section.spec')].find((s) => s.querySelector('.spec__title').textContent.trim().startsWith('${n}.')).querySelector('.spec__frame')`;
async function shotClip(name, sel) {
  if (!SCREENS) return;
  const r = await evalJs(`(() => { const e = ${sel}; e.scrollIntoView({ block: 'start' }); const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; })()`);
  await frames();
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
  writeFileSync(join(OUT, 'screens', `${name}.png`), Buffer.from(data, 'base64'));
  shots.push(`screens/${name}.png`);
}
const MEASURE = (n) => `(() => { const q = (v) => Math.round(v * 100) / 100; const f = ${frameSel(n)};
  const acc = (e) => { if (e.nodeType === 3) return e.data; if (e.nodeType !== 1 || e.getAttribute('aria-hidden') === 'true') return ''; return [...e.childNodes].map(acc).join(''); };
  const chip = f.querySelector('.chip--provisional'), cr = chip ? chip.getBoundingClientRect() : null, cs = chip ? getComputedStyle(chip) : null;
  return { frameH: q(f.getBoundingClientRect().height), accessibleText: acc(f).replace(/\\s+/g, ' ').trim(),
    rowLabels: [...f.querySelectorAll('a[aria-label]')].map((a) => a.getAttribute('aria-label')),
    tabbable: [...f.querySelectorAll('a[href], button')].map((e) => e.getAttribute('aria-label') || acc(e).trim()),
    caption: (f.querySelector('.status__line') || {}).textContent || null,
    chip: chip ? { text: chip.textContent.trim(), accessible: acc(chip).trim(), w: q(cr.width), h: q(cr.height), border: cs.borderTopStyle + ' ' + cs.borderTopWidth,
      clipped: chip.scrollWidth > chip.clientWidth + 1 } : null }; })()`;

const results = { generated: new Date().toISOString(), dpr: DPR, raster: 'software', note: 'Chrome emulation only; no Android, no TalkBack.', standings: {} };
const PLAN = ['current|en|320x693-200', 'proposed|en|320x693-200', 'current|es|320x693-200', 'proposed|es|320x693-200', 'proposed|en|390x844-100'];
for (const lang of ['en', 'es']) for (const vp of [[390, 844, 100], [320, 693, 200]]) {
  const sfx = lang === 'en' ? '' : '.es';
  const vpName = `${vp[0]}x${vp[1]}-${vp[2]}`;
  const rec = {};
  for (const [label, path] of [['current', join(PILOT, `states${sfx}.html`)], ['proposed', join(HERE, `st-states${sfx}.html`)]]) {
    await open(path, vp);
    rec[label] = { mixed: await evalJs(MEASURE(8)), uniform: await evalJs(MEASURE(7)) };
    if (PLAN.includes(`${label}|${lang}|${vpName}`)) await shotClip(`D-standings-marker-${label}-${lang}-${vpName}`, frameSel(8));
  }
  const c = rec.current.mixed, p = rec.proposed.mixed;
  rec.checks = {
    accessibleTextUnchanged: c.accessibleText === p.accessibleText,
    rowLabelsUnchanged: JSON.stringify(c.rowLabels) === JSON.stringify(p.rowLabels),
    tabOrderUnchanged: JSON.stringify(c.tabbable) === JSON.stringify(p.tabbable),
    uniformCaptionUnchanged: rec.current.uniform.caption === rec.proposed.uniform.caption && rec.current.uniform.accessibleText === rec.proposed.uniform.accessibleText,
    chipHeightUnchanged: c.chip.h === p.chip.h, chipWidthDelta: Math.round((p.chip.w - c.chip.w) * 100) / 100, frameHeightDelta: Math.round((p.frameH - c.frameH) * 100) / 100,
  };
  results.standings[`${lang}|${vpName}`] = rec;
}
results.screens = shots;
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const L = [`Standings provisional marker without the dagger (Step 49E.1) - ${results.generated}`, results.note, ''];
for (const [k, v] of Object.entries(results.standings)) {
  const c = v.current.mixed.chip, p = v.proposed.mixed.chip;
  L.push(`  ${k.padEnd(16)} "${c.text}" ${c.w}x${c.h} -> "${p.text}" ${p.w}x${p.h} (${p.border})  accessible "${c.accessible}" -> "${p.accessible}"  clipped ${p.clipped}  ${Object.entries(v.checks).map(([a, b]) => `${a} ${b}`).join('  ')}`);
}
L.push('', `Row label (EN): ${results.standings['en|390x844-100'].proposed.mixed.rowLabels[0]}`, `Uniform caption (EN): ${results.standings['en|390x844-100'].proposed.uniform.caption}`, '', `Screens: ${shots.length}`);
writeFileSync(join(OUT, 'summary.txt'), L.join('\n') + '\n');
console.log(`wrote ${OUT} (${shots.length} screens)`);
ws.close(); chrome.kill();
process.exit(0);
