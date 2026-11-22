// Step 55C.11 Chrome references of the approved Primer V2 Circuit Detail
// (review evidence, not goldens).
//
//   node tool/primer_review/capture_circuit_55c11_refs.mjs
//
// Writes build/primer-review/55c11/ref-<name>-<theme>-<lang>-<viewport>.png
// at device pixel ratio 2 (not resized) and ref-geometry.json (element boxes
// in CSS px, page coordinates) for the numeric comparison with Flutter. Pages
// are only read.
// - Whole pages (`index`, `partial`, `no-event`, `focus-*`): the document
//   from the app bar to the end of the page.
// - State frames (`frame-<n>`): the frame body of one fixture of the states
//   gallery (no caption).
//
// Sources, latest approved chain per theme (LT-18, Light rollout Batch 2):
// - index / partial / no-event: light-rollout-b2/cd-*-{dark,light}
//   (cd-partial-light-n8, cd-unknown-assoc and cd-partial-unknown are the
//   CR-04 comparison pages: never used)
// - focus-row: index, the related Grand Prix row (`.rx`) focused
// - focus-back: index, the back button focused
// - frame-<n>: light-rollout-b2/cd-states-{dark,light}, except frame 13
//   (status vocabulary), taken from light-coverage-gaps/cd-states-*: the
//   Step 54A correction (explicit unknown format dashed, VS-1). Superseded
//   in those pages and not to be copied: the cloud-off notice icon (VS-4:
//   alert / clock / help) and the one-notice precedence (N-1, N-2).
// Every value is a development test fixture (`test/support/entity_fixtures.dart`),
// not a real-world result. Chrome emulation only; dependency-free (DevTools
// Protocol).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REFINE = join(ROOT, 'design-exploration/prototypes/primer-v2/cross-screen-refinement');
const PROTO = join(REFINE, 'light-rollout-b2');
const GAPS = join(REFINE, 'light-coverage-gaps');
const OUT = join(ROOT, 'build/primer-review/55c11');
const DPR = 2;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const EN390 = ['en', '390-100', 390, 844, 100];
const ES390 = ['es', '390-100', 390, 844, 100];
const EN320 = ['en', '320-200', 320, 693, 200];
const ES320 = ['es', '320-200', 320, 693, 200];
const ALL = [EN390, ES390, EN320, ES320];
const PAIR = [EN390, ES320];

// [name, page, focus selector or null, frame number or null, sizes]
const REFS = [
  ['index', 'cd-index', null, null, ALL],
  ['partial', 'cd-partial', null, null, ALL],
  ['no-event', 'cd-no-event', null, null, ALL],
  ['focus-row', 'cd-index', '.rx', null, PAIR],
  ['focus-back', 'cd-index', '.dbar__back', null, PAIR],
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
    (n) => [`frame-${n}`, 'cd-states', null, n, PAIR]),
];

// Boxes dumped for the numeric comparison (every match, in document order).
const MEASURE = [
  '.dbar', '.dbar__back', '.dbar__title', '.page-notice', '.notice',
  '.ch', '.ch__name', '.ch__loc', '.ch__media', '.ch__kicker', '.dim',
  '.dim__val', '.dim__num', '.dim__arm', '.facts', '.fact', '.fact dd',
  '.sec', '.sec__title', '.lap', '.lap__time dd', '.lap__by',
  '.lap__by > div', '.rel__season', '.rel__none', '.rx', '.rx__round',
  '.rx__round-num', '.rx__seam', '.rx__name', '.rx__date', '.rx__chips',
  '.rx__disc', '.chip', '.skel span', '.empty', '.empty__title', '.btn',
];

/** The page file: frame 13 comes from the 54A coverage-gap gallery. */
function pageFile(page, theme, lang, frame) {
  const suffix = lang === 'en' ? '' : '.es';
  if (frame === 13) return join(GAPS, `${page}-${theme}${suffix}.html`);
  return join(PROTO, `${page}-${theme}${suffix}.html`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-55c11-'))}`, '--hide-scrollbars',
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
for (const theme of ['dark', 'light']) {
  for (const [name, page, focus, frame, sizes] of REFS) {
    for (const [lang, vp, w, h, scale] of sizes) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true });
      const file = pageFile(page, theme, lang, frame);
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
      const scope = frame === null
        ? 'document'
        : `document.getElementById('spec-${frame}').closest('.spec').querySelector('.spec__frame')`;
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
          const list = [...s.querySelectorAll(sel)].map((e) => {
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
