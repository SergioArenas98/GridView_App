// Step 55C.1 Chrome references of the approved Primer V2 Home (review
// evidence, not goldens).
//
//   node tool/primer_review/capture_home_55c1_refs.mjs
//
// Writes build/primer-review/55c1/ref-home-<theme>-<lang>-<viewport>.png: the
// whole Home document at device pixel ratio 2 (not resized), with the bottom
// navigation hidden so the content compares with the Flutter Home content (the
// production shell keeps its legacy navigation in this step). Pages: the
// latest approved Home chain in each theme, `cross-theme-54b/home-*-inset`
// (HM-01 omission, DK-*, B Motorsport LT-*, XT-1). 200% text is the
// prototypes' own emulation (root font-size 200%). Pages are only read.
// Chrome emulation only; dependency-free (DevTools Protocol).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROTO = join(ROOT, 'design-exploration/prototypes/primer-v2/cross-screen-refinement');
const OUT = join(ROOT, 'build/primer-review/55c1');
const DPR = 2;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const PAGES = [['dark', 'cross-theme-54b/home-dark-inset'], ['light', 'cross-theme-54b/home-light-inset']];
const SIZES = [
  ['390-100', 390, 844, 100],
  ['320-200', 320, 693, 200],
];
const LANGS = ['en', 'es'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-55c1-'))}`, '--hide-scrollbars',
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

for (const [theme, page] of PAGES) {
  for (const lang of LANGS) {
    for (const [vp, w, h, scale] of SIZES) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true });
      const file = join(PROTO, `${page}${lang === 'en' ? '' : '.es'}.html`);
      await send('Page.navigate', { url: pathToFileURL(file).href });
      await sleep(600);
      await evalJs('document.fonts.ready.then(() => true)');
      if (scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
      await evalJs(`(() => { const n = document.querySelector('.tabbar'); if (n) n.style.display = 'none'; return true; })()`);
      await sleep(300);
      const height = await evalJs(`(() => {
        const main = document.querySelector('main');
        const last = main.lastElementChild.getBoundingClientRect();
        return Math.ceil(last.bottom + window.scrollY + 24);
      })()`);
      const shot = await send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height, scale: 1 },
      });
      const name = `ref-home-${theme}-${lang}-${vp}.png`;
      writeFileSync(join(OUT, name), Buffer.from(shot.data, 'base64'));
      console.log(name, `${w}x${height}`);
    }
  }
}
ws.close();
chrome.kill();
process.exit(0);
