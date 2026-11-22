// Step 55C.13A Chrome references of the approved Primer V2 Settings root and
// preference screens (review evidence, not goldens).
//
//   node tool/primer_review/capture_settings_55c13a_refs.mjs
//
// Writes build/primer-review/55c13a/ref-<name>-<theme>-<lang>-<viewport>.png
// at device pixel ratio 2 (not resized) and ref-geometry.json (element boxes
// in CSS px, from the top of the captured area). Pages are only read.
// - Whole pages (`root-a`, `root-no-contact`, `root-dev`, `language`,
//   `theme`, `time`, `focus-row`): the document from the top to the end of
//   the page.
// - Frames (`marks`, `save-failure`): the frame screen of one fixture of the
//   states gallery (no caption): frame 2 (System focused, Dark selected,
//   Light pressed) and frame 3 (save failure snackbar).
// - `title` (overlong single-word title): the app bar (`.chrome`) of the
//   Spanish Acknowledgements page, the approved S-2 fit; the screen itself is
//   Step 55C.13B, only its title rule is compared here.
//
// Sources, the latest approved chain per theme (LT-18, Light rollout
// Batch 2): light-rollout-b2/set-*-{dark,light}[.es].html and
// info-acknowledgements-*.es.html. The provisional GvColorsLight preview
// (states frame 5) is superseded and never captured.
// Chrome emulation only; dependency-free (DevTools Protocol).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROTO = join(ROOT, 'design-exploration/prototypes/primer-v2/cross-screen-refinement/light-rollout-b2');
const OUT = join(ROOT, 'build/primer-review/55c13a');
const DPR = 2;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const EN390 = ['en', '390-100', 390, 844, 100];
const ES390 = ['es', '390-100', 390, 844, 100];
const EN320 = ['en', '320-200', 320, 693, 200];
const ES320 = ['es', '320-200', 320, 693, 200];
const PAIR = [EN390, ES320];
const BOTH = ['dark', 'light'];

// [name, page, focus selector or null, frame number or null, scope selector
//  or null, sizes, themes]
const REFS = [
  ['root-a', 'set-index', null, null, null, [EN390, ES390, EN320, ES320], BOTH],
  ['root-no-contact', 'set-production-no-contact', null, null, null, PAIR, BOTH],
  ['root-dev', 'set-non-production', null, null, null, PAIR, BOTH],
  ['language', 'set-language', null, null, null, PAIR, BOTH],
  ['theme', 'set-theme', null, null, null, PAIR, BOTH],
  ['time', 'set-time', null, null, null, PAIR, BOTH],
  ['focus-row', 'set-index', '#row-theme', null, null, PAIR, BOTH],
  ['marks', 'set-states', null, 2, null, PAIR, BOTH],
  ['save-failure', 'set-states', null, 3, null, PAIR, BOTH],
  ['title', 'info-acknowledgements', null, null, '.chrome', [ES320, ES390], BOTH],
];

const MEASURE = [
  '.dbar', '.dbar__back', '.dbar__title', '.kicker', '.srow', '.srow__label',
  '.srow__value', '.srow__title', '.srow__desc', '.mark', '.opt',
  '.opt__label', '.opt__desc', '.snack', '.snack__msg',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-55c13a-'))}`, '--hide-scrollbars',
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

const geometry = {};
for (const [name, page, focus, frame, scopeSel, sizes, themes] of REFS) {
  for (const theme of themes) {
    for (const [lang, vp, w, h, scale] of sizes) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true });
      const file = join(PROTO, `${page}-${theme}${lang === 'en' ? '' : '.es'}.html`);
      await send('Page.navigate', { url: pathToFileURL(file).href });
      await sleep(700);
      await evalJs('document.fonts.ready.then(() => true)');
      if (scale !== 100) {
        await evalJs(`document.documentElement.style.fontSize = '${scale}%'; window.dispatchEvent(new Event('resize')); true`);
      }
      await sleep(400);
      if (focus) {
        // A Tab press first, so :focus-visible applies as for keyboard users.
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await evalJs(`document.querySelector('${focus}').focus({ preventScroll: true }); true`);
        await sleep(200);
      }
      await evalJs('window.scrollTo(0, 0); true');
      const scope = frame !== null
        ? `document.querySelectorAll('figure.frame')[${frame - 1}].querySelector('.frame__screen')`
        : scopeSel !== null ? `document.querySelector('${scopeSel}')` : 'document';
      const clip = await evalJs(`(() => {
        const s = ${scope};
        const r = (s === document ? document.documentElement : s).getBoundingClientRect();
        const height = s === document ? document.documentElement.scrollHeight : Math.ceil(r.height);
        return { x: 0, y: s === document ? 0 : Math.floor(r.top + window.scrollY), width: ${w}, height, scale: 1 };
      })()`);
      const boxes = await evalJs(`(() => {
        const s = ${scope};
        const top = ${clip.y};
        const out = {};
        for (const sel of ${JSON.stringify(MEASURE)}) {
          const list = [...s.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || e.tagName === 'HEADER').map((e) => {
            const r = e.getBoundingClientRect();
            return [+(r.left).toFixed(1), +(r.top + window.scrollY - top).toFixed(1),
              +(r.width).toFixed(1), +(r.height).toFixed(1)];
          }).filter((b) => b[2] > 0 && b[3] > 0);
          if (list.length) out[sel] = list;
        }
        return out;
      })()`);
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
      const key = `${name}-${theme}-${lang}-${vp}`;
      geometry[key] = { height: clip.height, boxes };
      writeFileSync(join(OUT, `ref-${key}.png`), Buffer.from(shot.data, 'base64'));
      console.log(`ref-${key}.png`, `${clip.width}x${clip.height}`);
    }
  }
}
writeFileSync(join(OUT, 'ref-geometry.json'), JSON.stringify(geometry, null, 1));
ws.close();
chrome.kill();
process.exit(0);
