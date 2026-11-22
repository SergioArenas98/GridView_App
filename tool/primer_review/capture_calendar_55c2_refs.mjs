// Step 55C.2 Chrome references of the approved Primer V2 Calendar (review
// evidence, not goldens).
//
//   node tool/primer_review/capture_calendar_55c2_refs.mjs
//
// Writes build/primer-review/55c2/ref-<name>-<theme>-<lang>-<viewport>.png at
// device pixel ratio 2 (not resized): the whole Calendar document (pinned
// header at the top, then the scrolling content), with the bottom navigation
// hidden so it compares with the Flutter content (the production shell keeps
// its legacy navigation in this step). Pages are only read.
//
// Sources, latest approved chain per theme (LIGHT-READINESS §11, §14;
// CROSS-THEME-CONSOLIDATION §6.2):
// - cal:       light-rollout-b1/cal-{dark,light}      Calendar Stage 1 (CT-03)
// - stale:     the same, ?state=stale                 (cloud-off icon: superseded
// - failed:    the same, ?state=failed                 by VS-4 clock / alert)
// - n2:        light-coverage-gaps/cal-n2-{dark,light}?state=failed,stale&copy=b
// - completed: cross-theme-54b/cal-dark-full (XT-2) and
//              light-rollout-b1/lt14-light (LT-14), with the round 12 completed row
// - focus:     cal-{dark,light} with the next-event row keyboard-focused
// Chrome emulation only; dependency-free (DevTools Protocol).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROTO = join(ROOT, 'design-exploration/prototypes/primer-v2/cross-screen-refinement');
const OUT = join(ROOT, 'build/primer-review/55c2');
const DPR = 2;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const EN390 = ['en', '390-100', 390, 844, 100];
const ES320 = ['es', '320-200', 320, 693, 200];
const ALL = [EN390, ['es', '390-100', 390, 844, 100], ['en', '320-200', 320, 693, 200], ES320];

// [name, theme, page, query, focus selector or null, sizes]
const REFS = [
  ['cal', 'dark', 'light-rollout-b1/cal-dark', '', null, ALL],
  ['cal', 'light', 'light-rollout-b1/cal-light', '', null, ALL],
  ['stale', 'dark', 'light-rollout-b1/cal-dark', '?state=stale', null, [EN390, ES320]],
  ['stale', 'light', 'light-rollout-b1/cal-light', '?state=stale', null, [EN390, ES320]],
  ['failed', 'dark', 'light-rollout-b1/cal-dark', '?state=failed', null, [EN390, ES320]],
  ['failed', 'light', 'light-rollout-b1/cal-light', '?state=failed', null, [EN390, ES320]],
  ['n2', 'dark', 'light-coverage-gaps/cal-n2-dark', '?state=failed,stale&copy=b', null, [EN390, ES320]],
  ['n2', 'light', 'light-coverage-gaps/cal-n2-light', '?state=failed,stale&copy=b', null, [EN390, ES320]],
  ['completed', 'dark', 'cross-theme-54b/cal-dark-full', '', null, [EN390, ES320]],
  ['completed', 'light', 'light-rollout-b1/lt14-light', '', null, [EN390, ES320]],
  ['focus', 'dark', 'light-rollout-b1/cal-dark', '', '.ev--next .ev__link', [EN390, ES320]],
  ['focus', 'light', 'light-rollout-b1/cal-light', '', '.ev--next .ev__link', [EN390, ES320]],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-55c2-'))}`, '--hide-scrollbars',
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

for (const [name, theme, page, query, focus, sizes] of REFS) {
  for (const [lang, vp, w, h, scale] of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const file = join(PROTO, `${page}${lang === 'en' ? '' : '.es'}.html`);
    await send('Page.navigate', { url: pathToFileURL(file).href + query });
    await sleep(700);
    await evalJs('document.fonts.ready.then(() => true)');
    if (scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
    await evalJs(`(() => { const n = document.querySelector('.tabbar'); if (n) n.style.display = 'none'; return true; })()`);
    await sleep(300);
    if (focus) {
      // A Tab press first, so :focus-visible applies as for keyboard users.
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await evalJs(`document.querySelector('${focus}').focus(); true`);
      await sleep(200);
    }
    await evalJs('window.scrollTo(0, 0); true');
    const height = await evalJs(`(() => {
      const items = document.querySelectorAll('.rounds > li');
      const last = items[items.length - 1].getBoundingClientRect();
      return Math.ceil(last.bottom + window.scrollY + 24);
    })()`);
    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height, scale: 1 },
    });
    const out = `ref-${name}-${theme}-${lang}-${vp}.png`;
    writeFileSync(join(OUT, out), Buffer.from(shot.data, 'base64'));
    console.log(out, `${w}x${height}`);
  }
}
ws.close();
chrome.kill();
process.exit(0);
