// Step 55C.10 Chrome references of the approved Primer V2 Team Detail
// (review evidence, not goldens).
//
//   node tool/primer_review/capture_team_55c10_refs.mjs
//
// Writes build/primer-review/55c10/ref-<name>-<theme>-<lang>-<viewport>.png
// at device pixel ratio 2 (not resized) and ref-geometry.json (element boxes
// in CSS px, page coordinates) for the numeric comparison with Flutter. Pages
// are only read.
// - Whole pages (`index`, `partial`, `returning`, `focus-*`): the document
//   from the app bar to the end of the page.
// - State frames (`frame-<n>`): the frame body of one fixture of the states
//   gallery (no caption).
//
// Sources, latest approved chain per theme (TM-01..03; LT-1 B Motorsport;
// LT-13 light heading band; XT-3 team-colour geometry):
// - index / partial / returning: light-rollout-b1/td-*-{dark,light}
//   (td-index-light-alt is the rejected Graphite alternative: never used)
// - focus-row: index, the first line-up row (`.lu__hit`) focused
// - focus-standings: index, the standings link (`.dest`) focused
// - focus-back: index, the back button focused
// - frame-<n>: light-rollout-b1/td-states-{dark,light}, except frames 10
//   and 11 (team-colour edges), taken from cross-theme-54b/
//   td-states-{dark,light}-seam: the XT-3 geometry that superseded the
//   Batch 1 edges (TM-03's 4px column, inner frames, Chalk pinstripe).
//   Superseded in those pages and not to be copied: the cloud-off notice
//   icon (VS-4: alert / clock / help) and the one-notice precedence (N-1,
//   N-2 apply to the detail resource).
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
const PROTO = join(REFINE, 'light-rollout-b1');
const SEAM = join(REFINE, 'cross-theme-54b');
const OUT = join(ROOT, 'build/primer-review/55c10');
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
  ['index', 'td-index', null, null, ALL],
  ['partial', 'td-partial', null, null, ALL],
  ['returning', 'td-returning', null, null, ALL],
  ['focus-row', 'td-index', '.lu__hit', null, PAIR],
  ['focus-standings', 'td-index', '.dest', null, PAIR],
  ['focus-back', 'td-index', '.dbar__back', null, PAIR],
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(
    (n) => [`frame-${n}`, 'td-states', null, n, PAIR]),
];

// Boxes dumped for the numeric comparison (every match, in document order).
const MEASURE = [
  '.dbar', '.dbar__back', '.dbar__title', '.page-notice', '.notice',
  '.tb', '.tb__season', '.tb__name', '.tb__meta', '.tb__stable', '.tb__nat',
  '.tb__rail', '.tb__pin', '.tb__bar', '.sec', '.sec__title', '.tc',
  '.tc__cell', '.tc__cell dd', '.tc__prov', '.dest', '.lu', '.lu__row',
  '.lu__car', '.lu__num', '.lu__code', '.lu__seam', '.lu__name', '.lu__facts',
  '.lu__span', '.lu__go', '.sheet', '.sheet__row', '.about', '.skel span',
  '.empty', '.empty__title', '.btn',
];

/** The page file: frames 10 and 11 come from the XT-3 seam pages. */
function pageFile(page, theme, lang, frame) {
  const suffix = lang === 'en' ? '' : '.es';
  if (frame === 10 || frame === 11) {
    return join(SEAM, `${page}-${theme}-seam${suffix}.html`);
  }
  return join(PROTO, `${page}-${theme}${suffix}.html`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-55c10-'))}`, '--hide-scrollbars',
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
