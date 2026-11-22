// Freshness-caption localization MEASUREMENT (Step 49F.1). Not a design, not a
// prototype: it loads existing pages read-only and swaps only the caption text
// in the browser (no file is derived or written outside this folder), then
// measures wrapping, height and the shift of the adjacent content.
//
//   node checks.mjs [--out <dir>]
//
// Pages (never modified):
//   Home pilot             ../../consolidation-pilot/home/index[.es].html
//   Calendar pilot         ../../consolidation-pilot/index[.es].html  (pinned header, like today's Flutter)
//   Calendar Stage 1       ../calendar-stage1/index[.es].html?state=refreshing  (caption scrolls, CT-03)
// Caption texts: EN "Last successful check: {t}", ES current "Comprobado: {t}",
// ES proposed "Última comprobación correcta: {t}" (O-1). {t} is "4:22" (Home's
// existing fixture time; on Calendar a layout probe only, never a Calendar
// check time) or "…" (Calendar's refreshing state today). Viewport 320x693,
// root font size 200%. No screenshots. Chrome emulation only: no Android, no
// TalkBack. Harness copied from ../status-visual-consistency/checks-49e1.mjs.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DPR = 2;
const VIEWPORT = [320, 693, 200];
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-caption`));
mkdirSync(OUT, { recursive: true });

const TEXT = {
  'en': (t) => `Last successful check: ${t}`,
  'es-current': (t) => `Comprobado: ${t}`,
  'es-proposed': (t) => `Última comprobación correcta: ${t}`,
};
const PAGES = {
  home: { file: (lang) => join(ROOT, 'consolidation-pilot/home', lang === 'en' ? 'index.html' : 'index.es.html'), query: '',
    next: 'main.home', pinned: null, times: ['4:22'] },
  'calendar-pilot': { file: (lang) => join(ROOT, 'consolidation-pilot', lang === 'en' ? 'index.html' : 'index.es.html'), query: '?state=refreshing',
    next: 'main.cal', pinned: '.appbar--sticky', times: ['…', '4:22'] },
  'calendar-stage1': { file: (lang) => join(ROOT, 'cross-screen-refinement/calendar-stage1', lang === 'en' ? 'index.html' : 'index.es.html'), query: '?state=refreshing',
    next: '.proto-note', pinned: '.appbar--sticky', firstRow: '.rounds > li', times: ['…', '4:22'] },
};

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-cap-'))}`,
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

async function open(url) {
  const [w, h, scale] = VIEWPORT;
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
  await send('Page.navigate', { url });
  await sleep(400);
  await evalJs(`new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r))`);
  await evalJs('document.fonts.ready.then(() => true)');
  await evalJs(`document.documentElement.style.fontSize = '${scale}%'; dispatchEvent(new Event('resize')); true`);
  await sleep(450); await frames();
}

// Swaps the caption text, then measures in document coordinates (scroll-independent).
const MEASURE = (page, text) => `(async () => {
  const q = (v) => Math.round(v * 100) / 100;
  const cap = document.querySelector('p.freshness');
  cap.textContent = ${JSON.stringify(text)};
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const top = (sel) => { const e = sel && document.querySelector(sel); return e ? q(e.getBoundingClientRect().top + scrollY) : null; };
  const r = cap.getBoundingClientRect(), cs = getComputedStyle(cap);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
  const range = document.createRange(); range.selectNodeContents(cap);
  const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
  const pinned = ${JSON.stringify(page.pinned)} ? document.querySelector(${JSON.stringify(page.pinned)}) : null;
  const capInPinned = pinned ? pinned.contains(cap) : false;
  return {
    text: cap.textContent, lines, height: q(r.height), width: q(r.width), fontSizePx: parseFloat(cs.fontSize), lineHeightPx: q(lh),
    overflowX: cap.scrollWidth > cap.clientWidth + 1, nextTop: top(${JSON.stringify(page.next)}), firstRowTop: top(${JSON.stringify(page.firstRow || null)}),
    pinnedHeight: pinned ? q(pinned.getBoundingClientRect().height) : null, captionInPinnedArea: capInPinned,
    pinnedShareOfViewport: pinned ? q(pinned.getBoundingClientRect().height / innerHeight * 100) : null,
    pageScrollWidthOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    fontFamily: cs.fontFamily, archivoLoaded: document.fonts.check('16px Archivo'),
  };
})()`;

const results = { generated: new Date().toISOString(), viewport: VIEWPORT, dpr: DPR, raster: 'software',
  note: 'Chrome emulation only; no Android, no TalkBack. Caption text swapped in the browser; source pages unchanged.', pages: {} };
for (const [name, page] of Object.entries(PAGES)) {
  results.pages[name] = {};
  for (const t of page.times) {
    for (const [variant, make] of Object.entries(TEXT)) {
      const lang = variant === 'en' ? 'en' : 'es';
      await open(pathToFileURL(page.file(lang)).href + page.query);
      results.pages[name][`${variant}|${t}`] = await evalJs(MEASURE(page, make(t)));
    }
    const g = (v) => results.pages[name][`${v}|${t}`];
    results.pages[name][`delta|${t}`] = {
      esProposedVsCurrent: { heightPx: Math.round((g('es-proposed').height - g('es-current').height) * 100) / 100,
        nextContentShiftPx: g('es-proposed').nextTop != null ? Math.round((g('es-proposed').nextTop - g('es-current').nextTop) * 100) / 100 : null,
        firstRowShiftPx: g('es-proposed').firstRowTop != null ? Math.round((g('es-proposed').firstRowTop - g('es-current').firstRowTop) * 100) / 100 : null,
        pinnedHeightPx: g('es-proposed').pinnedHeight != null ? Math.round((g('es-proposed').pinnedHeight - g('es-current').pinnedHeight) * 100) / 100 : null },
      esProposedVsEn: { heightPx: Math.round((g('es-proposed').height - g('en').height) * 100) / 100 },
    };
  }
}
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const L = [`Freshness caption localization (Step 49F.1) - ${results.generated}`, `${VIEWPORT[0]}x${VIEWPORT[1]} @${VIEWPORT[2]}%. ${results.note}`, ''];
for (const [name, rec] of Object.entries(results.pages)) {
  L.push(name);
  for (const [k, v] of Object.entries(rec)) {
    if (k.startsWith('delta|')) { L.push(`  ${k.padEnd(22)} ${JSON.stringify(v)}`); continue; }
    L.push(`  ${k.padEnd(22)} "${v.text}"  lines ${v.lines}  h ${v.height}  w ${v.width}  next@${v.nextTop}${v.firstRowTop != null ? `  row1@${v.firstRowTop}` : ''}${v.pinnedHeight != null ? `  pinned ${v.pinnedHeight} (${v.pinnedShareOfViewport}%)${v.captionInPinnedArea ? ' incl. caption' : ''}` : ''}  overflow ${v.overflowX || v.pageScrollWidthOverflow}  archivo ${v.archivoLoaded}`);
  }
  L.push('');
}
writeFileSync(join(OUT, 'summary.txt'), L.join('\n').replace(/\n+$/, '') + '\n');
console.log(`wrote ${OUT}`);
ws.close(); chrome.kill();
process.exit(0);
