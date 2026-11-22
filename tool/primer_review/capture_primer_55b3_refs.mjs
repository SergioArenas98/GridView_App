// Step 55B.3 Chrome reference crops of the frozen Primer V2 row prototypes
// (review evidence, not goldens).
//
//   node tool/primer_review/capture_primer_55b3_refs.mjs
//
// Writes build/primer-review/55b3/ref-<family>-<theme>-<viewport>.png: the
// first list of each reference page, clipped to the viewport height from the
// list's top, at device pixel ratio 2 (not resized). 200% text is the
// prototypes' own emulation (root font-size 200%). Pages are only read.
// Dependency-free: Chrome over the DevTools Protocol, as the prototypes'
// checks scripts (`cross-theme-54b/checks-54b.mjs`). Chrome emulation only.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROTO = join(ROOT, 'design-exploration/prototypes/primer-v2/cross-screen-refinement');
const OUT = join(ROOT, 'build/primer-review/55b3');
const DPR = 2;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// The latest approved chain of each family and theme (CROSS-THEME-CONSOLIDATION §0, §10).
const REFS = [
  ['results', 'dark', 'light-rollout-b2/gp-results-dark', '.cls'],
  ['results', 'light', 'light-rollout-b2/gp-results-light', '.cls'],
  ['standings', 'dark', 'dark-state-boundaries/st-index-refine', '.table'],
  ['standings', 'light', 'light-foundations/st-index-light-53b', '.table'],
  ['calendar', 'dark', 'cross-theme-54b/cal-dark-full', '.rounds'],
  ['calendar', 'light', 'light-rollout-b1/lt14-light-a', '.rounds'],
];
const SIZES = [['390-100', 'en', 390, 844, 100], ['320-200', 'es', 320, 693, 200]];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-55b3-'))}`, '--hide-scrollbars',
  '--force-color-profile=srgb', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

async function pageTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('chrome did not start');
}

const ws = new WebSocket(await pageTarget());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { ok, fail } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
  }
});
const send = (method, params = {}) => new Promise((ok, fail) => {
  const id = ++nextId;
  pending.set(id, { ok, fail });
  ws.send(JSON.stringify({ id, method, params }));
});
const evalJs = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

await send('Page.enable');
await send('Runtime.enable');
mkdirSync(OUT, { recursive: true });

for (const [family, theme, page, selector] of REFS) {
  for (const [vp, lang, w, h, scale] of SIZES) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const file = join(PROTO, `${page}${lang === 'en' ? '' : '.es'}.html`);
    await send('Page.navigate', { url: pathToFileURL(file).href });
    await sleep(600);
    await evalJs('document.fonts.ready.then(() => true)');
    if (scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
    await sleep(300);
    const rect = await evalJs(`(() => {
      const el = [...document.querySelectorAll('${selector}')].find((e) => e.offsetParent !== null);
      const r = el.getBoundingClientRect();
      return { x: 0, y: r.top + window.scrollY, width: ${w}, height: Math.min(r.height, ${h}) };
    })()`);
    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 1 },
    });
    const name = `ref-${family}-${theme}-${vp}.png`;
    writeFileSync(join(OUT, name), Buffer.from(shot.data, 'base64'));
    console.log(name, `${rect.width}x${Math.round(rect.height)}`);
  }
}
ws.close();
chrome.kill();
process.exit(0);
