// Step 55C.15 Chrome references for the global surfaces (review evidence,
// not goldens).
//
//   node tool/primer_review/capture_shell_55c15_refs.mjs
//
// Writes build/primer-review/55c15/ref-<surface>-<theme>-<lang>-<viewport>.png
// at device pixel ratio 2 (not resized), plus ref-metrics.json:
// - nav: the bottom navigation (`.tabbar`) of the approved Home pages
//   `cross-screen-refinement/cross-theme-54b/home-{dark,light}` (XT-6, LT-9),
//   clipped to the bar plus 8px above;
// - envstrip: the environment strip and the top of the app bar
//   (`.envstrip`, Settings pilot `consolidation-pilot/settings/
//   non-production`), Light by setting `data-theme="light"` as settings.js
//   does;
// - banner: the fixture-data banner (`.page-notice` holding `.banner`) of the
//   Grand Prix states pages `cross-screen-refinement/light-rollout-b2/
//   gp-states-{dark,light}` (spec 26).
// 200% text is the prototypes' own emulation (root font-size 200%). Pages are
// only read. Chrome emulation only; dependency-free.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROTO = join(ROOT, 'design-exploration/prototypes/primer-v2');
const OUT = join(ROOT, 'build/primer-review/55c15');
const DPR = 2;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const SIZES = [
  ['390-100', 390, 844, 100],
  ['320-200', 320, 693, 200],
];
const LANGS = ['en', 'es'];
const THEMES = ['dark', 'light'];

const SURFACES = {
  nav: {
    page: (t) => `cross-screen-refinement/cross-theme-54b/home-${t}`,
    selector: '.tabbar',
    above: 8,
    below: 0,
    setTheme: false,
  },
  envstrip: {
    page: () => 'consolidation-pilot/settings/non-production',
    selector: '.envstrip',
    above: 0,
    below: 24,
    setTheme: true,
  },
  banner: {
    page: (t) => `cross-screen-refinement/light-rollout-b2/gp-states-${t}`,
    selector: '.banner',
    parent: true,
    above: 0,
    below: 0,
    setTheme: false,
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-55c15-'))}`, '--hide-scrollbars',
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

const metrics = {};
for (const [surface, spec] of Object.entries(SURFACES)) {
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      for (const [vp, w, h, scale] of SIZES) {
        await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
        await send('Emulation.setTouchEmulationEnabled', { enabled: true });
        const file = join(PROTO, `${spec.page(theme)}${lang === 'en' ? '' : '.es'}.html`);
        await send('Page.navigate', { url: pathToFileURL(file).href });
        await sleep(700);
        await evalJs('document.fonts.ready.then(() => true)');
        if (spec.setTheme && theme === 'light') {
          await evalJs(`document.documentElement.dataset.theme = 'light'; true`);
        }
        if (scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
        // nav-inset.js re-fits the navigation on resize.
        await evalJs(`window.dispatchEvent(new Event('resize')); true`);
        await sleep(400);
        const m = await evalJs(`(() => {
          let n = document.querySelector('${spec.selector}');
          if (!n) return null;
          const inner = n;
          if (${spec.parent ? 'true' : 'false'}) n = n.parentElement;
          n.scrollIntoView({ block: 'center' });
          const r = n.getBoundingClientRect();
          const ir = inner.getBoundingClientRect();
          const cs = getComputedStyle(inner);
          const tabs = [...document.querySelectorAll('.tabbar .tab')].map((t) => {
            const b = t.getBoundingClientRect();
            return { x: b.x, y: b.y, w: b.width, h: b.height };
          });
          // Page coordinates: the screenshot clip is in document space.
          return {
            top: r.top + window.scrollY, bottom: r.bottom + window.scrollY,
            height: r.height, scrollY: window.scrollY,
            inner: { x: ir.x, y: ir.y, w: ir.width, h: ir.height },
            fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
            fit: document.querySelector('.tabbar')?.dataset.fit ?? null,
            tabs,
          };
        })()`);
        if (!m) { console.log(`missing ${surface} ${theme} ${lang} ${vp}`); continue; }
        const y = Math.max(0, Math.floor(m.top - spec.above));
        const bottom = Math.min(m.scrollY + h, Math.ceil(m.bottom + spec.below));
        const shot = await send('Page.captureScreenshot', {
          format: 'png',
          clip: { x: 0, y, width: w, height: bottom - y, scale: 1 },
        });
        const out = `ref-${surface}-${theme}-${lang}-${vp}.png`;
        writeFileSync(join(OUT, out), Buffer.from(shot.data, 'base64'));
        metrics[out] = m;
        console.log(out);
      }
    }
  }
}
writeFileSync(join(OUT, 'ref-metrics.json'), JSON.stringify(metrics, null, 2));
ws.close();
chrome.kill();
process.exit(0);
