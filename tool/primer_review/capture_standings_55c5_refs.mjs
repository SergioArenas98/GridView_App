// Step 55C.5 Chrome references of the approved Primer V2 Standings (review
// evidence, not goldens).
//
//   node tool/primer_review/capture_standings_55c5_refs.mjs
//
// Writes build/primer-review/55c5/ref-<name>-<theme>-<lang>-<viewport>.png at
// device pixel ratio 2 (not resized). Pages are only read.
// - Whole pages (`index`, `constructors`, `focus-*`): the Standings document
//   from the pinned header to 24px under the last row, with the bottom
//   navigation hidden so it compares with the Flutter content (the
//   production shell keeps its legacy navigation in this step).
// - State frames (`frame-<n>`): the frame body of one fixture of the states
//   gallery (no caption).
//
// Sources, latest approved chain per theme (LIGHT-READINESS §11;
// CROSS-THEME-CONSOLIDATION §5):
// - index:        light-foundations/st-index-dark, st-index-light-53b
// - constructors: the same, ?championship=constructors
// - focus-seg:    the same, the unselected "Constructors" option focused
// - focus-row:    the same, the leader row focused (Ember / Graphite ring)
// - frame-2/7/8/9/10/11: light-rollout-b2/st-states-{dark,light} (tied leaders;
//   provisional uniform and mixed; refreshing; stale; failed). Superseded in
//   those pages and not to be copied: the dagger on "Provisional" (VS-3) and
//   the cloud-off notice icon (VS-4).
// Chrome emulation only; dependency-free (DevTools Protocol).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROTO = join(ROOT, 'design-exploration/prototypes/primer-v2/cross-screen-refinement');
const OUT = join(ROOT, 'build/primer-review/55c5');
const DPR = 2;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const EN390 = ['en', '390-100', 390, 844, 100];
const ES390 = ['es', '390-100', 390, 844, 100];
const EN320 = ['en', '320-200', 320, 693, 200];
const ES320 = ['es', '320-200', 320, 693, 200];
const ALL = [EN390, ES390, EN320, ES320];
const PAIR = [EN390, ES320];

const PAGES = {
  dark: 'light-foundations/st-index-dark',
  light: 'light-foundations/st-index-light-53b',
};
const STATES = {
  dark: 'light-rollout-b2/st-states-dark',
  light: 'light-rollout-b2/st-states-light',
};

// [name, page key, query, focus selector or null, frame number or null, sizes]
const REFS = [
  ['index', 'page', '', null, null, ALL],
  ['constructors', 'page', '?championship=constructors', null, null, ALL],
  ['focus-seg', 'page', '', '.seg__btn[aria-pressed="false"]', null, PAIR],
  ['focus-row', 'page', '', '#drivers .st--leader .st__link', null, PAIR],
  ['frame-2', 'states', '', null, 2, PAIR],
  ['frame-7', 'states', '', null, 7, PAIR],
  ['frame-8', 'states', '', null, 8, PAIR],
  ['frame-9', 'states', '', null, 9, PAIR],
  ['frame-10', 'states', '', null, 10, PAIR],
  ['frame-11', 'states', '', null, 11, PAIR],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-55c5-'))}`, '--hide-scrollbars',
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

for (const theme of ['dark', 'light']) {
  for (const [name, kind, query, focus, frame, sizes] of REFS) {
    for (const [lang, vp, w, h, scale] of sizes) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true });
      const page = kind === 'page' ? PAGES[theme] : STATES[theme];
      const file = join(PROTO, `${page}${lang === 'en' ? '' : '.es'}.html`);
      await send('Page.navigate', { url: pathToFileURL(file).href + query });
      await sleep(700);
      await evalJs('document.fonts.ready.then(() => true)');
      if (scale !== 100) {
        await evalJs(`document.documentElement.style.fontSize = '${scale}%'; window.dispatchEvent(new Event('resize')); true`);
      }
      await evalJs(`(() => { const n = document.querySelector('.tabbar'); if (n) n.style.display = 'none'; return true; })()`);
      await sleep(400);
      if (focus) {
        // A Tab press first, so :focus-visible applies as for keyboard users.
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await evalJs(`document.querySelector('${focus.replaceAll("'", "\\'")}').focus(); true`);
        await sleep(200);
      }
      await evalJs('window.scrollTo(0, 0); true');
      let clip;
      if (frame === null) {
        const height = await evalJs(`(() => {
          const table = [...document.querySelectorAll('.stand section')].find((s) => !s.hidden);
          const items = table.querySelectorAll('.st');
          const last = items[items.length - 1].getBoundingClientRect();
          return Math.ceil(last.bottom + window.scrollY + 24);
        })()`);
        clip = { x: 0, y: 0, width: w, height, scale: 1 };
      } else {
        clip = await evalJs(`(() => {
          const f = document.getElementById('spec-${frame}').closest('.spec').querySelector('.spec__frame');
          const r = f.getBoundingClientRect();
          return { x: 0, y: Math.floor(r.top + window.scrollY), width: ${w}, height: Math.ceil(r.height), scale: 1 };
        })()`);
      }
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
      const out = `ref-${name}-${theme}-${lang}-${vp}.png`;
      writeFileSync(join(OUT, out), Buffer.from(shot.data, 'base64'));
      console.log(out, `${clip.width}x${clip.height}`);
    }
  }
}
ws.close();
chrome.kill();
process.exit(0);
