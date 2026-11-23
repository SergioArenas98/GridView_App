// Step 55C.12 Chrome references of the approved Primer V2 Grand Prix Detail
// (review evidence, not goldens).
//
//   node tool/primer_review/capture_gp_55c12_refs.mjs
//
// Writes build/primer-review/55c12/ref-<name>-<theme>-<lang>-<viewport>.png
// at device pixel ratio 2 (not resized) and ref-geometry.json (element boxes
// in CSS px, from the top of the captured area) for the numeric comparison
// with Flutter. Pages are only read.
// - Whole pages (`index`, `results`, `focus-*`): the document from the app
//   bar to the end of the page.
// - Frames (`title-1`, `frame-<n>`): the frame body of one fixture of a
//   gallery page (no caption).
//
// Sources, latest approved chain per theme (LT-18, Light rollout Batch 2):
// - index / results: light-rollout-b2/gp-{index,results}-{dark,light};
// - focus-row: results, the second classification row's driver link;
// - focus-team: the same row's team link, with the LT-17 ring (2px inside):
//   Dark from gp-results-dark-tl (the isolated LT-17 chain), Light from
//   gp-results-light (light-b2.css carries LT-17);
// - title-1: light-rollout-b2/gp-title-*, frame 1 (long app-bar title);
// - frame-<n>: light-rollout-b2/gp-states-*, except frames 8, 9 and 22,
//   taken from light-coverage-gaps/gp-states-* (VS-1 dashed unknowns).
// Never used (comparison-only pages): gp-states-light-n8 (LT-8) and
// gp-states-light-s16 (the rejected Graphite skeleton, LT-16). Superseded in
// the state frames and not copied: the cloud-off notice icon (VS-4: alert /
// clock) and the one-notice precedence (N-1, N-2).
// Every value is a development test fixture, not a real-world result.
// Chrome emulation only; dependency-free (DevTools Protocol).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REFINE = join(ROOT, 'design-exploration/prototypes/primer-v2/cross-screen-refinement');
const PROTO = join(REFINE, 'light-rollout-b2');
const GAPS = join(REFINE, 'light-coverage-gaps');
const OUT = join(ROOT, 'build/primer-review/55c12');
const DPR = 2;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const EN390 = ['en', '390-100', 390, 844, 100];
const ES390 = ['es', '390-100', 390, 844, 100];
const EN320 = ['en', '320-200', 320, 693, 200];
const ES320 = ['es', '320-200', 320, 693, 200];
const ALL = [EN390, ES390, EN320, ES320];
const PAIR = [EN390, ES320];

// Frames: one viewport per theme keeps the evidence lean (Dark EN 390 @100%,
// Light ES 320 @200%).
const FRAMES = [1, 4, 5, 8, 9, 10, 14, 17, 18, 19, 20, 21, 22, 24];

// [name, page, focus selector or null, frame number or null, sizes, themes]
const REFS = [
  ['index', 'gp-index', null, null, ALL, ['dark', 'light']],
  ['results', 'gp-results', null, null, ALL, ['dark', 'light']],
  ['focus-row', 'gp-results', '.cl:nth-child(2) .cl__hit', null, PAIR, ['dark', 'light']],
  ['focus-team', 'gp-results', '.cl:nth-child(2) .cl__team', null, PAIR, ['dark', 'light']],
  ['title-1', 'gp-title', null, 1, PAIR, ['dark', 'light']],
  ...FRAMES.map((n) => [`frame-${n}`, 'gp-states', null, n, [EN390], ['dark']]),
  ...FRAMES.map((n) => [`frame-${n}`, 'gp-states', null, n, [ES320], ['light']]),
];

// Boxes dumped for the numeric comparison (every match, in document order).
const MEASURE = [
  '.dbar', '.dbar__back', '.dbar__title', '.page-notice', '.notice', '.gp',
  '.gp__chips', '.gp__round-num', '.gp__seam', '.gp__season', '.gp__name',
  '.gp__official', '.gp__facts', '.fact', '.cx', '.cx__name', '.cx__disc',
  '.section-title', '.zones', '.day__label', '.sess', '.sess__hm',
  '.sess__name', '.sess__t2', '.sec__notice', '.cls', '.cl', '.cl__pos',
  '.cl__name', '.cl__team', '.cl__pts', '.cl__time', '.chip', '.empty',
  '.empty__title', '.btn', '.skel span',
];

/** The page file for one theme, language and frame. */
function pageFile(page, theme, lang, frame, focus) {
  const suffix = lang === 'en' ? '' : '.es';
  if (page === 'gp-states' && [8, 9, 22].includes(frame)) {
    return join(GAPS, `${page}-${theme}${suffix}.html`);
  }
  if (focus && focus.includes('cl__team') && theme === 'dark') {
    return join(PROTO, `${page}-dark-tl${suffix}.html`);
  }
  return join(PROTO, `${page}-${theme}${suffix}.html`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-55c12-'))}`, '--hide-scrollbars',
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
for (const [name, page, focus, frame, sizes, themes] of REFS) {
  for (const theme of themes) {
    for (const [lang, vp, w, h, scale] of sizes) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true });
      const file = pageFile(page, theme, lang, frame, focus);
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
