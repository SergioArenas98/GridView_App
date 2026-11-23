// Primer V2 consolidation: baseline-vs-pilot visual regression utility.
// Generalised from ../validation-20261108-224601-regression/compare.mjs (that
// copy stays as the Calendar pilot's evidence). Dependency-free: Chrome over
// the DevTools Protocol, PNG decode/encode with node:zlib.
//
//   node visual-compare.mjs <config.mjs> [--control] [--gpu] [--out <dir>] [--shots none|first|all]
//
//   --control  compare the baseline with itself (noise floor of the harness)
//   --gpu      Chrome's default raster path; default is software raster and
//              compositing, which is deterministic between page loads
//   --out      output folder (default: <pilot>/validation-<timestamp>-regression/<sw|gpu>-<pilot|control>)
//   --shots    which pilot screenshots to keep (default: config.saveShots or "first")
//
// Both versions load in ONE Chrome session, back to back per run, with the same
// device metrics, DPR, touch emulation, media features, query and text scale.
// Per run it compares: every screenshot as decoded RGBA (explicit pixel
// counts), every body element's box, attributes and full computed style
// (including ::before/::after), html attributes and computed style, loaded font
// faces, the accessibility tree (page folder normalised), touch targets,
// horizontal overflow, clipped / spilling text, text under 12.5px, words broken
// across lines, text contrast pairs, and the config's probes. Interaction runs:
// keyboard focus walk, forced :hover/:active, and scripted steps with recorded
// state. See tools/README.md for the config format.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { inflateSync, deflateSync, crc32 } from 'node:zlib';
import { createHash } from 'node:crypto';

// ---------- CLI and config ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const configPath = resolve(argv.find((a) => a.endsWith('.mjs')) || '');
const config = (await import(pathToFileURL(configPath).href)).default;
const here = dirname(configPath);
const MODE = flag('--control') ? 'control' : 'pilot';
const RASTER = flag('--gpu') ? 'gpu' : 'sw';
const RASTER_FLAGS = RASTER === 'sw' ? ['--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-rasterization', '--disable-partial-raster'] : [];
const DPR = config.dpr ?? 2;
const DIRS = { baseline: resolve(here, config.baseline), pilot: resolve(here, MODE === 'control' ? config.baseline : config.pilot) };
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
// config.outLabel (added 2026-11-10, Settings): names the default folder validation-<stamp>-<outLabel>, so
// subgroups sharing one pilot folder (Settings root and preferences) keep separate evidence. Default "regression".
const OUT = resolve(opt('--out') || join(resolve(here, config.pilot), `validation-${stamp}-${config.outLabel || 'regression'}`, `${RASTER}-${MODE}`));
const SHOTS_POLICY = opt('--shots') || config.saveShots || 'first';
mkdirSync(OUT, { recursive: true });
// A page's file in each version; pages may sit at different depths in baseline and pilot (page.pilotFile).
const fileFor = (v, page) => (v === 'baseline' || MODE === 'control' ? resolve(DIRS.baseline, page.file) : resolve(DIRS.pilot, page.pilotFile ?? page.file));
// URL prefixes for one page as [prefix, token] pairs, longest first: the folders of its baseline and pilot files
// become "<page>/". config.sharedRoots (added 2026-11-10, Settings; opt-in) adds [baselineDir, pilotDir, token]
// triples relative to the config: both folders become "<token>/", so a link from a page to a sibling pilot
// folder (the information screens' back link to the Settings root) compares as the same target. A page
// folder always wins over a shared root (dedupe keeps the first token; longest prefix replaced first).
const prefixesFor = (page) => {
  const pairs = [dirname(resolve(DIRS.baseline, page.file)), dirname(resolve(here, config.pilot, page.pilotFile ?? page.file))].map((d) => [d, '<page>/']);
  for (const [b, p, token] of config.sharedRoots || []) pairs.push([resolve(here, b), `${token}/`], [resolve(here, p), `${token}/`]);
  const seen = new Set();
  return pairs.map(([d, t]) => [pathToFileURL(d).href + '/', t]).filter(([u]) => !seen.has(u) && seen.add(u)).sort((x, y) => y[0].length - x[0].length);
};
// Reports carry no machine-specific path (added 2026-11-09): any other file URL under the repository
// becomes "<repo>/…" after the page prefixes, and the summary names folders relative to the repository.
const REPO = (() => { for (let d = here; ; d = dirname(d)) { if (existsSync(join(d, '.git'))) return d; if (dirname(d) === d) return null; } })();
const REPO_URL = REPO ? pathToFileURL(REPO).href + '/' : null;
const repoRel = (p) => (REPO ? relative(REPO, p).split('\\').join('/') : relative(here, p).split('\\').join('/'));
const normUrls = (s, prefixes) => { const t = prefixes.reduce((x, [p, tok]) => x.split(p).join(tok), s); return REPO_URL ? t.split(REPO_URL).join('<repo>/') : t; };

// ---------- PNG (8-bit RGB/RGBA, non-interlaced) ----------
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9];
      if (data[8] !== 8 || data[12] !== 0 || (ct !== 2 && ct !== 6)) throw new Error(`unsupported PNG depth ${data[8]} type ${ct}`);
    } else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4), prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; px[o] = cur[x * bpp]; px[o + 1] = cur[x * bpp + 1]; px[o + 2] = cur[x * bpp + 2]; px[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255; }
    cur.copy(prev);
  }
  return { w, h, px };
}
function encodePng(w, h, px) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function pixelDiff(a, b) {
  if (a.w !== b.w || a.h !== b.h) return { count: -1, sizeMismatch: `${a.w}x${a.h} vs ${b.w}x${b.h}` };
  let count = 0, maxDelta = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; const vis = Buffer.from(b.px);
  for (let i = 0; i < a.px.length; i += 4) {
    const d = Math.max(Math.abs(a.px[i] - b.px[i]), Math.abs(a.px[i + 1] - b.px[i + 1]), Math.abs(a.px[i + 2] - b.px[i + 2]), Math.abs(a.px[i + 3] - b.px[i + 3]));
    if (!d) continue;
    count++; maxDelta = Math.max(maxDelta, d);
    const k = i / 4, x = k % a.w, y = (k - x) / a.w; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    vis[i] = 255; vis[i + 1] = 0; vis[i + 2] = 255; vis[i + 3] = 255;
  }
  return { count, maxDelta, bbox: count ? [x0, y0, x1, y1] : null, vis };
}
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

// ---------- Chrome ----------
const CHROME = config.chrome || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-compare-'))}`,
  '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', ...RASTER_FLAGS, 'about:blank'], { stdio: 'ignore' });
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
for (const d of ['Page', 'Runtime', 'DOM', 'CSS', 'Accessibility']) await send(`${d}.enable`);
const browser = await send('Browser.getVersion');

// ---------- In-page measurement ----------
const MEASURE = `(() => {
  const norm = (u) => { const t = __PREFIXES__.reduce((s, [p, tok]) => s.split(p).join(tok), u); const r = __REPO_URL__; return r ? t.split(r).join('<repo>/') : t; };
  const path = (el) => { const p = []; for (let e = el; e && e !== document.body; e = e.parentElement) p.unshift(e.tagName.toLowerCase() + ':' + [...e.parentElement.children].indexOf(e)); return p.join('/'); };
  const style = (cs) => { const o = {}; for (let i = 0; i < cs.length; i++) o[cs[i]] = cs.getPropertyValue(cs[i]); return o; };
  const attrs = (el) => Object.fromEntries([...el.attributes].map((a) => [a.name, a.name === 'href' && typeof el.href === 'string' ? norm(el.href) : a.value]));
  const de = document.documentElement, vw = de.clientWidth;
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const skip = (el) => el.closest('.sr-only, .sprite, svg');
  const els = [...document.body.querySelectorAll('*')];
  const nodes = els.map((el) => { const r = el.getBoundingClientRect(); const n = { path: path(el), attrs: attrs(el), text: [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(''), box: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100), style: style(getComputedStyle(el)) };
    for (const pe of ['::before', '::after']) { const cs = getComputedStyle(el, pe); if (cs.content !== 'none' && cs.content !== 'normal') n[pe] = style(cs); }
    return n; });
  const shown = els.filter((el) => !skip(el) && vis(el));
  const textEls = shown.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const label = (el) => (el.getAttribute('class') || el.tagName) + ': ' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40);
  const outside = shown.filter((el) => { const r = el.getBoundingClientRect(); return r.right > vw + 0.5 || r.left < -0.5; }).map(label);
  const clipped = textEls.filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible').map(label);
  const spill = textEls.filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'visible' && getComputedStyle(el).display !== 'inline').map(label);
  const small = textEls.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12.5).map(label);
  // Words split across lines (hyphenation or forced break). Real hyphens / slashes are reported apart.
  const broken = [];
  for (const el of textEls) for (const tn of el.childNodes) {
    if (tn.nodeType !== 3) continue;
    for (const m of tn.textContent.matchAll(/\\S{2,}/g)) {
      const rg = document.createRange(); rg.setStart(tn, m.index); rg.setEnd(tn, m.index + m[0].length);
      const tops = [...new Set([...rg.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top / 3)))];
      if (tops.length > 1) broken.push((/[-\\u2010/]/.test(m[0]) ? 'at-hyphen: ' : '') + m[0]);
    }
  }
  // Contrast: text colour over the composited plain background; gradients and pseudo slabs reported as complex.
  const rgba = (s) => { const v = s.match(/[\\d.]+/g).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const hasSlab = (e) => ['::before', '::after'].some((pe) => { const cs = getComputedStyle(e, pe); return cs.content !== 'none' && cs.content !== 'normal' && (cs.backgroundImage !== 'none' || rgba(cs.backgroundColor).a > 0) && parseFloat(cs.width) > 6 && parseFloat(cs.height) > 6; });
  const contrast = textEls.map((el) => {
    const layers = []; let complex = '';
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') { complex = 'gradient'; break; }
      if (hasSlab(e)) { complex = 'slab'; break; }
      const c = rgba(cs.backgroundColor); if (c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    const cs = getComputedStyle(el);
    if (complex) return label(el) + ' | ' + cs.color + ' | ' + complex;
    let bg = { r: 255, g: 255, b: 255, a: 1 }; for (const l of layers.reverse()) bg = over(l, bg);
    const fg = over(rgba(cs.color), bg); const [L1, L2] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return label(el) + ' | ' + ((L1 + 0.05) / (L2 + 0.05)).toFixed(2);
  });
  const targets = [...document.querySelectorAll('a, button')].filter(vis).map((el) => { const r = el.getBoundingClientRect(); return [(el.getAttribute('aria-label') || el.textContent.trim()).replace(/\\s+/g, ' ').slice(0, 50), Math.round(r.width), Math.round(r.height)]; });
  const faces = [...document.fonts].map((f) => [f.family, f.style, f.weight, f.stretch, f.unicodeRange, f.status].join(' | ')).sort();
  return { nodes, faces, archivo: document.fonts.check('16px Archivo'), docHeight: de.scrollHeight, scrollWidth: de.scrollWidth, clientWidth: vw,
    htmlAttrs: attrs(de), rootStyle: style(getComputedStyle(de)),
    quality: { hScroll: de.scrollWidth > vw, outside, clipped, spill, small, broken, targetsBad: targets.filter((t) => t[1] < 47.5 || t[2] < 47.5), contrast }, targets };
})()`;

const NAV_PROBE = `(() => { const nav = document.querySelector('.tabbar'); if (!nav) return null; const l = nav.querySelector('.tab.is-selected .tab__label'); const cs = l && getComputedStyle(l);
  return { fit: nav.dataset.fit || null, navSpace: document.documentElement.style.getPropertyValue('--nav-space'), selectedLabel: l ? { text: l.textContent, wdth: cs.fontVariationSettings, weight: cs.fontWeight, fits: l.scrollWidth <= l.clientWidth + 1 } : null }; })()`;

// ---------- Run helpers ----------
async function load(path, query, [w, h], scale, media = {}, freeze) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: media.reducedMotion ? 'reduce' : '' }] });
  await send('Page.navigate', { url: pathToFileURL(path).href + (query ? `?${query}` : '') });
  await sleep(400);
  await evalJs(`new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r))`);
  await evalJs('document.fonts.ready.then(() => true)');
  if (scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
  // Looping CSS animations (e.g. a progress sweep) are paused at one fixed time in both versions.
  if (freeze !== undefined) await evalJs(`document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ${freeze}; }); true`);
  await sleep(300);
  await evalJs('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');
  await sleep(150);
}
async function rawShot(clip) { const { data } = await send('Page.captureScreenshot', clip ? { format: 'png', captureBeyondViewport: true, clip } : { format: 'png' }); return Buffer.from(data, 'base64'); }
let unstable = 0;
async function shot(clip) {   // retake until two consecutive frames are byte-identical
  let prev = await rawShot(clip);
  for (let i = 0; i < 8; i++) { await sleep(120); const cur = await rawShot(clip); if (cur.equals(prev)) return cur; prev = cur; }
  unstable++; return prev;
}
async function axTree(prefixes) {
  const { nodes } = await send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n])); const lines = [];
  const walk = (n, depth) => { if (!n) return;
    if (!n.ignored) lines.push(`${'  '.repeat(depth)}${n.role?.value} "${n.name?.value || ''}" ${(n.properties || []).map((p) => `${p.name}=${JSON.stringify(p.value?.value)}`).join(' ')}`.trimEnd());
    for (const c of n.childIds || []) walk(byId.get(c), n.ignored ? depth : depth + 1); };
  walk(nodes[0], 0);
  return normUrls(lines.join('\n'), prefixes);
}
const KEYS = { Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }, Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
  // Added 2026-11-10 (Settings radio groups: arrows move focus only, Home / End).
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }, ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }, ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
  Home: { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 }, End: { key: 'End', code: 'End', windowsVirtualKeyCode: 35 } };
async function press(name) { const k = KEYS[name]; await send('Input.dispatchKeyEvent', { type: 'keyDown', ...k }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...k, text: undefined }); await sleep(200); }
// Focused element for the keyboard trace (2026-11-09): computed accessible role and name (Chrome's
// accessibility tree, not visible text), a structural locator (tag.firstClass, :nth-child only among
// same-class siblings, anchored at the nearest id) and the raw href, so a stop is identifiable without
// relying on visible text or ids alone.
const LOCATOR = `function () { if (this === document.body || this === document.documentElement) return null;
  const seg = (e) => { const t = e.tagName.toLowerCase(); if (e.id) return t + '#' + e.id; const c = e.classList[0]; const kids = [...e.parentElement.children];
    const same = kids.filter((x) => x.tagName === e.tagName && (!c || x.classList.contains(c))); return t + (c ? '.' + c : '') + (same.length > 1 ? ':nth-child(' + (kids.indexOf(e) + 1) + ')' : ''); };
  const parts = []; for (let e = this; e && e !== document.body; e = e.parentElement) { parts.unshift(seg(e)); if (e.id) break; }
  return { locator: parts.join(' > '), href: typeof this.href === 'string' ? this.href : null }; }`;
// href is the RESOLVED target, normalised like the DOM comparison ("<page>/…", "<repo>/…"): a raw href
// differs by design when a pilot sits deeper than its baseline (Standings' nav links gain one "../").
async function activeElement(prefixes) {
  const { result } = await send('Runtime.evaluate', { expression: 'document.activeElement' });
  const loc = (await send('Runtime.callFunctionOn', { objectId: result.objectId, functionDeclaration: LOCATOR, returnByValue: true })).result.value;
  let role = null, name = null;
  if (loc) { const { nodes } = await send('Accessibility.getPartialAXTree', { objectId: result.objectId, fetchRelatives: false }); const n = nodes.find((x) => !x.ignored) || nodes[0]; role = n?.role?.value ?? null; name = n?.name?.value ?? null; }
  await send('Runtime.releaseObject', { objectId: result.objectId });
  return loc ? { role, name, locator: loc.locator, href: loc.href === null ? null : normUrls(loc.href, prefixes) } : 'body';
}

// Actions return [{ label, png, value? }]
const ACTIONS = {
  async scroll(run, m) {
    // Coverage recorded per run (2026-11-10): shots needed to reach the end of the document vs shots taken.
    const [, h] = run.viewport; const step = h - 80, need = Math.max(1, Math.ceil((m.docHeight - 80) / step)), n = Math.min(run.maxShots ?? 12, need); const out = [];
    run.coverage = { docHeight: m.docHeight, step, need, taken: n, complete: n >= need };
    for (let i = 0; i < n; i++) { await evalJs(`window.scrollTo(0, ${i * step}); true`); await sleep(150); out.push({ label: String(i + 1).padStart(2, '0'), png: await shot() }); }
    return out;
  },
  async segments(run, m) {
    const [w] = run.viewport; const seg = 2400, n = Math.ceil(m.docHeight / seg); const out = [];
    for (let i = 0; i < n; i++) out.push({ label: `seg${String(i + 1).padStart(2, '0')}`, png: await shot({ x: 0, y: i * seg, width: w, height: Math.min(seg, m.docHeight - i * seg), scale: 1 }) });
    return out;
  },
  async focus(run, m) {
    const stops = run.stops ?? m.targets.length; const out = []; const prefixes = prefixesFor(pages[run.page]);
    for (let i = 0; i < stops; i++) { await press('Tab'); out.push({ label: `tab${String(i + 1).padStart(2, '0')}`, png: await shot(), value: await activeElement(prefixes) }); }
    return out;
  },
  async forced(run) {
    const out = [];
    for (const [sel, state] of run.states) {
      const { root } = await send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
      if (!nodeId) throw new Error(`forced: no element for ${sel}`);
      await evalJs(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' }); true`);
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [state] }); await sleep(450);
      out.push({ label: `${sel.replace(/[^a-z0-9]+/gi, '_')}-${state}`, png: await shot() });
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }); await sleep(450);
    }
    return out;
  },
  async steps(run) {
    const out = [];
    for (const s of run.steps) {
      if (s.click) await evalJs(`document.querySelector(${JSON.stringify(s.click)}).click(); true`);
      if (s.focus) await evalJs(`document.querySelector(${JSON.stringify(s.focus)}).focus(); true`);
      if (s.key) await press(s.key);
      if (s.scroll !== undefined) await evalJs(`window.scrollTo(0, ${s.scroll}); true`);
      if (s.scrollTo) await evalJs(`document.querySelector(${JSON.stringify(s.scrollTo)}).scrollIntoView({ block: 'start' }); true`);
      await sleep(s.wait ?? 250);
      if (s.record) out.push({ label: s.record, value: await evalJs(s.js || config.stateProbe) });
      if (s.shot) out.push({ label: s.shot, png: await shot() });
    }
    return out;
  },
};

// ---------- Comparison ----------
function compareMeasure(a, b) {
  const out = [];
  for (const k of ['archivo', 'docHeight', 'scrollWidth', 'clientWidth']) if (a[k] !== b[k]) out.push(`${k}: ${a[k]} vs ${b[k]}`);
  for (const k of ['htmlAttrs', 'faces', 'targets', 'quality']) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(`${k} differ`);
  for (const [p, v] of Object.entries(a.rootStyle)) if (b.rootStyle[p] !== v) out.push(`html ${p}: ${v} vs ${b.rootStyle[p]}`);
  if (a.nodes.length !== b.nodes.length) out.push(`element count ${a.nodes.length} vs ${b.nodes.length}`);
  a.nodes.forEach((n, i) => { const m = b.nodes[i]; if (!m) return;
    if (n.path !== m.path) { out.push(`element ${i}: ${n.path} vs ${m.path}`); return; }
    if (n.text !== m.text) out.push(`text ${n.path}: ${JSON.stringify(n.text)} vs ${JSON.stringify(m.text)}`);
    if (JSON.stringify(n.attrs) !== JSON.stringify(m.attrs)) out.push(`attrs ${n.path}: ${JSON.stringify(n.attrs)} vs ${JSON.stringify(m.attrs)}`);
    if (n.box.join() !== m.box.join()) out.push(`box ${n.path}: ${n.box} vs ${m.box}`);
    for (const part of ['style', '::before', '::after']) { const s = n[part] || {}, t = m[part] || {};
      if (!!n[part] !== !!m[part]) { out.push(`${part} presence ${n.path}`); continue; }
      for (const p of new Set([...Object.keys(s), ...Object.keys(t)])) if (s[p] !== t[p]) out.push(`${part} ${n.path} ${p}: ${s[p]} vs ${t[p]}`); } });
  return out;
}
const minContrast = (q) => { const v = q.contrast.map((c) => parseFloat(c.split(' | ').pop())).filter((x) => !Number.isNaN(x)); return v.length ? Math.min(...v) : null; };

// ---------- Runs ----------
const pages = Object.fromEntries(config.pages.map((p) => [p.id, p]));
const runs = [];
for (const p of config.pages) for (const [qid, query] of Object.entries(p.queries || { default: '' }))
  for (const viewport of p.viewports || config.viewports) for (const scale of p.textScales || config.textScales)
    runs.push({ name: `${p.id}-${qid}-${viewport.join('x')}-${scale}`, page: p.id, query, viewport, scale, action: p.capture || 'scroll', static: true, ...(p.maxShots ? { maxShots: p.maxShots } : {}) });
for (const r of config.runs || []) runs.push({ scale: 100, ...r, query: r.query ?? (pages[r.page].queries ? Object.values(pages[r.page].queries)[0] : '') });

const results = []; const lines = []; let totalShots = 0, totalDiff = 0; const firstAx = new Set();
mkdirSync(join(OUT, 'screens'), { recursive: true });
for (const run of runs) {
  const per = {};
  for (const v of ['baseline', 'pilot']) {
    const page = pages[run.page], prefixes = prefixesFor(page);
    await load(fileFor(v, page), run.query, run.viewport, run.scale, run.media, page.freezeAnimations ?? config.freezeAnimations);
    const m = await evalJs(MEASURE.replace('__PREFIXES__', JSON.stringify(prefixes)).replace('__REPO_URL__', JSON.stringify(REPO_URL)));
    const probes = {}; for (const [k, js] of Object.entries({ nav: NAV_PROBE, ...(config.probes || {}) })) probes[k] = await evalJs(js);
    const ax = await axTree(prefixes);
    const items = await ACTIONS[run.action](run, m);
    per[v] = { m, probes, ax, items };
  }
  const a = per.baseline, b = per.pilot;
  const diffs = compareMeasure(a.m, b.m);
  if (JSON.stringify(a.probes) !== JSON.stringify(b.probes)) diffs.push(`probes differ: ${JSON.stringify(a.probes)} vs ${JSON.stringify(b.probes)}`);
  const axSame = a.ax === b.ax;
  const items = a.items.map((it, i) => {
    const jt = b.items[i]; const rec = { label: it.label };
    if (it.value !== undefined || jt.value !== undefined) { rec.value = it.value; rec.valueSame = JSON.stringify(it.value) === JSON.stringify(jt.value); if (!rec.valueSame) { rec.pilotValue = jt.value; diffs.push(`value ${it.label} differs`); } }
    if (it.png) {
      const pa = decodePng(it.png), pb = decodePng(jt.png), d = pixelDiff(pa, pb); totalShots++; if (d.count) totalDiff += Math.abs(d.count);
      Object.assign(rec, { size: `${pa.w}x${pa.h}`, diffPixels: d.count, maxDelta: d.maxDelta ?? null, bbox: d.bbox ?? null, rgbaSha: [sha(pa.px), sha(pb.px)], pngBytesEqual: it.png.equals(jt.png) });
      const keep = MODE === 'pilot' && (SHOTS_POLICY === 'all' || (SHOTS_POLICY === 'first' && run.static && i === 0));
      if (keep) writeFileSync(join(OUT, 'screens', `${run.name}-${it.label}.png`), jt.png);
      if (d.count) { mkdirSync(join(OUT, 'diffs'), { recursive: true }); writeFileSync(join(OUT, 'diffs', `${run.name}-${it.label}-baseline.png`), it.png); writeFileSync(join(OUT, 'diffs', `${run.name}-${it.label}-pilot.png`), jt.png); if (d.vis) writeFileSync(join(OUT, 'diffs', `${run.name}-${it.label}-diff.png`), encodePng(pb.w, pb.h, d.vis)); }
    }
    return rec;
  });
  const assertions = (run.assert || []).map(([desc, fn]) => { const vals = Object.fromEntries(items.filter((x) => x.value !== undefined).map((x) => [x.label, x.value])); const pv = Object.fromEntries(b.items.filter((x) => x.value !== undefined).map((x) => [x.label, x.value])); return { desc, baseline: !!fn(vals), pilot: !!fn(pv) }; });
  const q = b.m.quality;
  const rec = { name: run.name, page: pages[run.page].file, query: run.query, viewport: run.viewport.join('x'), dpr: DPR, textScale: run.scale, action: run.action, media: run.media || {},
    elementsCompared: a.m.nodes.length, fontFacesLoaded: a.m.faces.filter((f) => f.endsWith('loaded')).length, archivo: [a.m.archivo, b.m.archivo],
    probes: b.probes, quality: { hScroll: q.hScroll, outside: q.outside, clipped: q.clipped, spill: q.spill, small: q.small, broken: q.broken, targetsBad: q.targetsBad, minContrast: minContrast(q), contrastPairs: q.contrast.length, complexContrast: q.contrast.filter((c) => /gradient|slab$/.test(c)).length },
    targets: b.m.targets, diffs, axTreeIdentical: axSame, items, assertions, ...(run.coverage ? { coverage: run.coverage } : {}) };
  if (!axSame) rec.axDiff = { baseline: a.ax, pilot: b.ax };
  results.push(rec);
  const axKey = `${run.page}-${run.query}`;
  if (MODE === 'pilot' && run.static && !firstAx.has(axKey)) { firstAx.add(axKey); writeFileSync(join(OUT, `accessibility-tree-${run.page}${run.query ? '-' + run.query.replace(/[^a-z0-9]+/gi, '_') : ''}.txt`), b.ax + '\n'); }
  const px = items.reduce((s, x) => s + Math.max(0, x.diffPixels || 0), 0);
  const line = `${run.name} [${run.action}]: shots ${items.filter((x) => x.size).length} diffPx ${px} diffs ${diffs.length} ax ${axSame ? 'same' : 'DIFF'} · hScroll ${q.hScroll} outside ${q.outside.length} clip ${q.clipped.length} spill ${q.spill.length} small ${q.small.length} broken ${q.broken.length} targets<48 ${q.targetsBad.length}/${b.m.targets.length} minContrast ${rec.quality.minContrast}` +
    (run.coverage && !run.coverage.complete ? ` · COVERAGE ${run.coverage.taken}/${run.coverage.need} shots` : '') +
    (assertions.length ? ` · asserts ${assertions.map((x) => `${x.desc}=${x.baseline}/${x.pilot}`).join(' ')}` : '');
  lines.push(line); console.log(line); if (diffs.length) console.log('   ', diffs.slice(0, 8).join('\n    '));
}

const configsWithDiffs = results.filter((r) => r.diffs.length).length, axDiffs = results.filter((r) => !r.axTreeIdentical).length;
const head = `config ${config.name} · mode ${MODE} · raster ${RASTER} ${RASTER_FLAGS.join(' ')} · unstable frames ${unstable}\n` +
  `${browser.product} · DPR ${DPR} · mobile emulation + touch · one session, baseline then pilot per run\n` +
  `baseline ${repoRel(DIRS.baseline)}\npilot    ${repoRel(DIRS.pilot)}\n` +
  `runs ${results.length} · screenshot pairs ${totalShots} · differing pixels ${totalDiff} · runs with DOM/style/box/metric diffs ${configsWithDiffs} · a11y-tree diffs ${axDiffs}\n`;
writeFileSync(join(OUT, 'summary.txt'), head + lines.join('\n') + '\n');
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ config: config.name, mode: MODE, raster: RASTER, browser: browser.product, dpr: DPR,
  chromeFlags: ['--headless=new', '--hide-scrollbars', '--force-color-profile=srgb', ...RASTER_FLAGS].join(' '), results }, null, 1));
console.log(head);
ws.close(); chrome.kill();
process.exit(totalDiff || configsWithDiffs || axDiffs ? 1 : 0);
