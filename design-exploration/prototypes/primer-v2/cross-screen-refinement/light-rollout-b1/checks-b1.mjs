// Primer V2 Light rollout, Batch 1 (Step 53C): Calendar, Driver Detail, Team Detail, Dark reference vs Light.
//
//   node checks-b1.mjs [--out <dir>] [--pages cal,dd-index,...] [--no-screens]
//   node checks-b1.mjs --lt14 [--no-screens]   Step 53C.1: the LT-14 completed-row specimen only
//     (variants dark | light | light-a | light-b; EN 390x844 @100% and ES 320x693 @200%;
//     opacity may differ between variants, nothing else that is not a colour).
//
// Dependency-free: Chrome over the DevTools Protocol (software raster, DPR 2,
// mobile + touch). The measurement code (PNG codec, structural snapshot,
// accessibility tree, keyboard walk with ring adjacency and the 53B perimeter
// test, chip borders, rendered text) is copied verbatim from
// ../light-foundations/checks.mjs (Step 53B), which is only read; only the
// page list, the named samples and the owner composites are this batch's.
// Chrome emulation only: no Android, no TalkBack, no WCAG compliance claim.
//
// Per page x size (EN and ES 390x844 @100%, EN and ES 320x693 @200%):
//  - structure: each Light page against its Dark reference (same markup):
//    identical text, attributes, boxes, accessibility tree, Tab order,
//    targets, layout-quality metrics; every computed-style difference must be
//    a colour property;
//  - focus: every Tab stop, focused vs unfocused, ring adjacency and the
//    perimeter test (share of the ring path with a >= 3:1 change);
//  - chips, rendered text, named fill/boundary samples (team colours).
// Owner screenshots: 2-up composites (Dark | Light; Light | Graphite
// alternative for LT-13), a small fixed set.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const DPR = 2;
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const SCREENS = !argv.includes('--no-screens');
const LT14 = argv.includes('--lt14');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-${LT14 ? 'lt14' : 'b1'}`));
mkdirSync(join(OUT, 'screens'), { recursive: true });

// run id -> [built page id, query]. Calendar states come from its own ?state= preview switch.
const RUNS = {
  'cal': ['cal', ''],
  'cal-stale': ['cal', 'state=stale'],
  'cal-failed': ['cal', 'state=refreshing,failed'],
  'dd-index': ['dd-index', ''], 'dd-partial': ['dd-partial', ''], 'dd-states': ['dd-states', ''],
  'td-index': ['td-index', ''], 'td-partial': ['td-partial', ''], 'td-returning': ['td-returning', ''], 'td-states': ['td-states', ''],
  'lt14': ['lt14', ''],
};
const pagesArg = argv.indexOf('--pages');
const PAGES = pagesArg >= 0 ? argv[pagesArg + 1].split(',') : LT14 ? ['lt14'] : Object.keys(RUNS).filter((r) => r !== 'lt14');
const VARIANTS = LT14 ? ['dark', 'light', 'light-a', 'light-b'] : ['dark', 'light'];   // first = structural reference (frozen Dark)
const CMP = VARIANTS.slice(1);
const LIGHT = ['light'];
const SIZES = LT14 ? [['en', 390, 844, 100], ['es', 320, 693, 200]]
  : [['en', 390, 844, 100], ['es', 390, 844, 100], ['en', 320, 693, 200], ['es', 320, 693, 200]];
const fileOf = (run, v, lang) => { const [page, q] = RUNS[run] || [run, '']; return join(HERE, `${page}-${v}${lang === 'en' ? '' : '.es'}.html`) + (q ? '?' + q : ''); };
const ALLOWED_STYLE = new RegExp(String.raw`^(color|background-color|background-image|border-(top|right|bottom|left|block-start|block-end|inline-start|inline-end)-color|outline-color|box-shadow|-webkit-text-stroke-color|-webkit-text-fill-color|text-decoration-color|text-decoration|text-emphasis-color|caret-color|column-rule-color|row-rule-color|fill|stroke|color-scheme|--.*${LT14 ? '|opacity' : ''})$`);

// ---------- PNG decode (copied from visual-compare.mjs) ----------
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0 || (ct !== 2 && ct !== 6)) throw new Error(`unsupported PNG ${data[8]}/${ct}`); }
    else if (type === 'IDAT') idat.push(data);
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

// ---------- PNG encode (RGB, filter 0) for the owner composites ----------
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
function encodePng({ w, h, px }) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, d = y * (w * 3 + 1) + 1 + x * 3; raw[d] = px[o]; raw[d + 1] = px[o + 1]; raw[d + 2] = px[o + 2]; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// 3-up composite, each image box-averaged from DPR 2 to CSS pixels, 16px neutral gutters.
function composite(pngs) {
  const imgs = pngs.map(decodePng).map((im) => { const w = im.w >> 1, h = im.h >> 1, px = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) { let s = 0; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) s += im.px[((2 * y + dy) * im.w + 2 * x + dx) * 4 + c]; px[(y * w + x) * 4 + c] = Math.round(s / 4); }
    return { w, h, px }; });
  const G = 16, W = imgs.reduce((s, im) => s + im.w, 0) + G * (imgs.length + 1), H = Math.max(...imgs.map((im) => im.h)) + 2 * G;
  const px = Buffer.alloc(W * H * 4, 128); let x0 = G;
  for (const im of imgs) { for (let y = 0; y < im.h; y++) im.px.copy(px, ((y + G) * W + x0) * 4, y * im.w * 4, (y + 1) * im.w * 4); x0 += im.w + G; }
  return encodePng({ w: W, h: H, px });
}

// ---------- Colour ----------
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(...a), lum(...b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const r2 = (v) => Math.round(v * 100) / 100;

// ---------- Chrome ----------
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9600 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-b1-'))}`,
  '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-rasterization',
  '--disable-partial-raster', 'about:blank'], { stdio: 'ignore' });
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
for (const d of ['Page', 'Runtime', 'Accessibility']) await send(`${d}.enable`);
const browser = await send('Browser.getVersion');
const frames = () => evalJs('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r(true), 100))))');
let pageUrl = '';
async function open(path, w, h, scale) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const [file, query] = path.split('?');
  pageUrl = pathToFileURL(file).href + (query ? '?' + query : '');
  await send('Page.navigate', { url: pageUrl });
  await sleep(400);
  await evalJs(`new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r))`);
  await evalJs('document.fonts.ready.then(() => true)');
  if (scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
  await evalJs(`dispatchEvent(new Event('resize')); true`);
  await sleep(450); await frames();
}
let unstable = 0;
async function shot(clip) {
  const take = async () => Buffer.from((await send('Page.captureScreenshot', clip ? { format: 'png', captureBeyondViewport: true, clip: { ...clip, scale: 1 } } : { format: 'png' })).data, 'base64');
  let prev = await take();
  for (let i = 0; i < 8; i++) { await sleep(100); const cur = await take(); if (cur.equals(prev)) return cur; prev = cur; }
  unstable++; return prev;
}

// ---------- In-page snapshot (as in ../dark-state-boundaries/checks.mjs) ----------
const SNAPSHOT = `(() => {
  const page = location.href.split('#')[0].split('?')[0];
  const norm = (u) => u.split(page).join('<page>');
  const path = (el) => { const p = []; for (let e = el; e && e !== document.body; e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (e.classList[0] ? '.' + e.classList[0] : '') + ':' + [...e.parentElement.children].indexOf(e)); return p.join('/'); };
  const style = (cs) => { const o = {}; for (let i = 0; i < cs.length; i++) o[cs[i]] = cs.getPropertyValue(cs[i]); return o; };
  const attrs = (el) => Object.fromEntries([...el.attributes].map((a) => [a.name, (a.name === 'href' || a.name === 'src') && typeof el[a.name] === 'string' ? norm(el[a.name]) : a.value]));
  const nodes = [...document.body.querySelectorAll('*')].map((el) => { const r = el.getBoundingClientRect(); const n = { path: path(el), attrs: attrs(el),
    text: [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(''), box: [r.x, r.y + scrollY, r.width, r.height].map((v) => Math.round(v * 100) / 100), style: style(getComputedStyle(el)) };
    for (const pe of ['::before', '::after']) { const cs = getComputedStyle(el, pe); if (cs.content !== 'none' && cs.content !== 'normal') n[pe] = style(cs); }
    return n; });
  const de = document.documentElement, vw = de.clientWidth;
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const shown = [...document.body.querySelectorAll('*')].filter((el) => !el.closest('.sr-only, .sprite, svg') && vis(el));
  const textEls = shown.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const label = (el) => (el.getAttribute('class') || el.tagName) + ': ' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40);
  const quality = { hScroll: de.scrollWidth > vw,
    outside: shown.filter((el) => { const r = el.getBoundingClientRect(); return r.right > vw + 0.5 || r.left < -0.5; }).map(label),
    clipped: textEls.filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible').map(label),
    spill: textEls.filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'visible' && getComputedStyle(el).display !== 'inline').map(label),
    small: textEls.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12.5).map(label) };
  const tabbable = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((el) => el.tabIndex >= 0 && !el.disabled && vis(el) && !el.closest('[inert]'));
  const seg = document.querySelector('.seg'), nav = document.querySelector('.tabbar');
  return { nodes, quality, docHeight: de.scrollHeight, stops: tabbable.length, disabled: document.querySelectorAll(':disabled, [aria-disabled="true"]').length,
    fit: { seg: seg ? seg.dataset.fit || 'regular' : null, nav: nav ? nav.dataset.fit || 'regular' : null } };
})()`;
async function axTree() {
  const { nodes } = await send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n])); const lines = [];
  const page = pageUrl.split('#')[0];
  const walk = (n, depth) => { if (!n) return;
    if (!n.ignored) lines.push(`${'  '.repeat(depth)}${n.role?.value} "${n.name?.value || ''}" ${(n.properties || []).map((p) => `${p.name}=${JSON.stringify(p.value?.value)}`).join(' ')}`.trimEnd());
    for (const c of n.childIds || []) walk(byId.get(c), n.ignored ? depth : depth + 1); };
  walk(nodes[0], 0);
  // The file name differs per variant; normalise it so only names, roles and states are compared.
  return lines.join('\n').split(page).join('<page>').replace(/(cal|dd-index|dd-partial|dd-states|td-index|td-partial|td-returning|td-states)-(dark|light-alt|light)(\.es)?\.html/g, '<page>');
}
function compareSnap(a, b) {
  const hard = [], styles = new Map();
  if (a.nodes.length !== b.nodes.length) hard.push(`element count ${a.nodes.length} vs ${b.nodes.length}`);
  a.nodes.forEach((n, i) => { const m = b.nodes[i]; if (!m) return;
    if (n.path !== m.path) { hard.push(`element ${i}: ${n.path} vs ${m.path}`); return; }
    if (n.text !== m.text) hard.push(`text ${n.path}`);
    const an = JSON.stringify(n.attrs).replace(/-(dark|light-alt|light)(\.es)?\.html/g, ''), am = JSON.stringify(m.attrs).replace(/-(dark|light-alt|light)(\.es)?\.html/g, '');
    if (an !== am) hard.push(`attrs ${n.path}: ${an} vs ${am}`);
    if (n.box.join() !== m.box.join()) hard.push(`box ${n.path}: ${n.box} vs ${m.box}`);
    for (const part of ['style', '::before', '::after']) { const s = n[part] || {}, t = m[part] || {};
      if (!!n[part] !== !!m[part]) { hard.push(`${part} presence ${n.path}`); continue; }
      for (const p of new Set([...Object.keys(s), ...Object.keys(t)])) if (s[p] !== t[p]) {
        if (!ALLOWED_STYLE.test(p)) hard.push(`style ${n.path}${part === 'style' ? '' : part} ${p}: ${s[p]} -> ${t[p]}`);
        else if (!p.startsWith('--')) { const k = p.replace(/^border-.*-color$/, 'border-color'); styles.set(k, (styles.get(k) || 0) + 1); }
      } } });
  for (const k of ['docHeight', 'stops', 'disabled']) if (a[k] !== b[k]) hard.push(`${k} ${a[k]} vs ${b[k]}`);
  if (JSON.stringify(a.fit) !== JSON.stringify(b.fit)) hard.push(`fit ${JSON.stringify(a.fit)} vs ${JSON.stringify(b.fit)}`);
  if (JSON.stringify(a.quality) !== JSON.stringify(b.quality)) hard.push('quality metrics differ');
  return { hard, colourProperties: Object.fromEntries(styles) };
}

// ---------- Keyboard walk with ring measurement ----------
const TAB = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 };
async function pressTab() { await send('Input.dispatchKeyEvent', { type: 'keyDown', ...TAB }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...TAB }); await sleep(120); }
const ACTIVE = `(() => { const e = document.activeElement; if (!e || e === document.body) return null;
  const seg = (x) => x.tagName.toLowerCase() + (x.classList[0] ? '.' + x.classList[0] : '') + (x.getAttribute('aria-pressed') ? '[pressed=' + x.getAttribute('aria-pressed') + ']' : '');
  const parts = []; for (let x = e; x && x !== document.body && parts.length < 4; x = x.parentElement) parts.unshift(seg(x));
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return { locator: parts.join(' > '), name: e.getAttribute('aria-label') || e.textContent.trim().replace(/\\s+/g, ' ').slice(0, 60), focusVisible: e.matches(':focus-visible'),
    rect: [r.left, r.top, r.right, r.bottom], outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor + ' offset ' + cs.outlineOffset,
    w: r.width, h: r.height, selected: e.getAttribute('aria-pressed') === 'true' || e.getAttribute('aria-current') === 'page' }; })()`;
function ringStats(fPng, uPng, rect, vw, vh) {
  const f = decodePng(fPng), u = decodePng(uPng), W = f.w;
  const [l, t, r, b] = [Math.max(0, rect[0] - 8), Math.max(0, rect[1] - 8), Math.min(vw, rect[2] + 8), Math.min(vh, rect[3] + 8)].map((v) => Math.round(v * DPR));
  const changed = new Set(), hist = new Map();
  for (let y = t; y < b; y++) for (let x = l; x < r; x++) { const o = (y * W + x) * 4;
    if (f.px[o] !== u.px[o] || f.px[o + 1] !== u.px[o + 1] || f.px[o + 2] !== u.px[o + 2]) { changed.add(y * W + x); const k = (f.px[o] << 16) | (f.px[o + 1] << 8) | f.px[o + 2]; hist.set(k, (hist.get(k) || 0) + 1); } }
  if (!changed.size) return { changedPx: 0 };
  const mode = [...hist].sort((p, q) => q[1] - p[1])[0][0], ring = [(mode >> 16) & 255, (mode >> 8) & 255, mode & 255];
  const adj = [], neighbours = new Map(); let strongChange = 0;
  for (const q of changed) {
    const x = q % W, y = (q - x) / W, o = q * 4;
    if (ratio([f.px[o], f.px[o + 1], f.px[o + 2]], [u.px[o], u.px[o + 1], u.px[o + 2]]) >= 3) strongChange++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nq = (y + dy) * W + (x + dx); if (changed.has(nq) || x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= f.h) continue;
      const no = nq * 4, c = [f.px[no], f.px[no + 1], f.px[no + 2]], cr = ratio(ring, c); adj.push(cr);
      if (cr < 3) { const k = hex(c); neighbours.set(k, (neighbours.get(k) || 0) + 1); } }
  }
  adj.sort((p, q) => p - q);
  // Step 53B: the ring line against what is actually next to it in the FOCUSED image (mask bands included):
  // ring pixels = changed pixels within 1.1:1 of the ring colour; for each ring-edge pixel, the neighbour is
  // taken 2 device px beyond it, skipping the 1px anti-aliased fringe (half ring, half surface).
  const isRing = (q) => { if (!changed.has(q)) return false; const o = q * 4; return ratio([f.px[o], f.px[o + 1], f.px[o + 2]], ring) < 1.1; };
  const line = [];
  for (const q of changed) { if (!isRing(q)) continue; const x = q % W, y = (q - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, fx = x + 2 * dx, fy = y + 2 * dy;
      if (fx < 0 || fy < 0 || fx >= W || fy >= f.h) continue; if (isRing(ny * W + nx) || isRing(fy * W + fx)) continue;
      const no = (fy * W + fx) * 4; line.push(ratio(ring, [f.px[no], f.px[no + 1], f.px[no + 2]])); } }
  line.sort((p, q) => p - q);
  const focusedNeighbours = line.length ? { samples: line.length, min: r2(line[0]), p05: r2(line[Math.floor(line.length * 0.05)]), median: r2(line[Math.floor(line.length / 2)]), shareAtLeast3: r2(line.filter((v) => v >= 3).length / line.length) } : null;
  return { changedPx: changed.size, ringColour: hex(ring), focusedNeighbours, adjacentSamples: adj.length, adjacentMin: r2(adj[0]), adjacentP05: r2(adj[Math.floor(adj.length * 0.05)]),
    adjacentMedian: r2(adj[Math.floor(adj.length / 2)]),
    adjacentShareAtLeast3: r2(adj.filter((v) => v >= 3).length / adj.length), changedShareAtLeast3: r2(strongChange / changed.size),
    lowNeighbours: [...neighbours].sort((p, q) => q[1] - p[1]).slice(0, 4).map(([k, n]) => `${k} x${n} (${r2(ratio(ring, [1, 3, 5].map((i) => parseInt(k.slice(i, i + 2), 16))))})`) };
}
// Perimeter test (Step 53B): walk the ring's intended path (the host's border box: sides, one diagonal per corner arc,
// or a circle) and, at each position, take the strongest focused-vs-unfocused change on the normal line from 8px
// inside to 8px outside the edge. A position passes when some pixel there changes by >= 3:1. Weakest runs listed.
function perimeter(fPng, uPng, host, vw, vh) {
  const f = decodePng(fPng), u = decodePng(uPng), W = f.w, H = f.h;
  const px = (img, x, y) => { const o = (y * W + x) * 4; return [img.px[o], img.px[o + 1], img.px[o + 2]]; };
  const line = (x0, y0, dx, dy) => { let best = 0, seen = 0;
    for (let k = -8; k <= 8; k += 0.5) { const x = Math.round((x0 + dx * k) * DPR), y = Math.round((y0 + dy * k) * DPR);
      if (x < 0 || y < 0 || x >= W || y >= H) continue; seen++; best = Math.max(best, ratio(px(f, x, y), px(u, x, y))); }
    return seen ? best : null; };
  const [l, t, r, b] = host.rect, pos = [];
  if (host.circle) {
    const cx = (l + r) / 2, cy = (t + b) / 2, R = (r - l) / 2;
    for (let deg = 0; deg < 360; deg += 3) { const a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), v = line(cx + dx * R, cy + dy * R, dx, dy); if (v !== null) pos.push({ side: `arc ${deg}deg`, at: deg, v }); }
  } else {
    const c = Math.min(host.radius, (r - l) / 2, (b - t) / 2) + 2;
    for (let x = l + c; x <= r - c; x += 1) { const v1 = line(x, t, 0, -1), v2 = line(x, b, 0, 1); if (v1 !== null) pos.push({ side: 'top', at: x - l, v: v1 }); if (v2 !== null) pos.push({ side: 'bottom', at: x - l, v: v2 }); }
    for (let y = t + c; y <= b - c; y += 1) { const v1 = line(l, y, -1, 0), v2 = line(r, y, 1, 0); if (v1 !== null) pos.push({ side: 'left', at: y - t, v: v1 }); if (v2 !== null) pos.push({ side: 'right', at: y - t, v: v2 }); }
    const rr = Math.min(host.radius, (r - l) / 2, (b - t) / 2), k = rr * (1 - Math.SQRT1_2), d = Math.SQRT1_2;
    for (const [x, y, dx, dy, side] of [[l + k, t + k, -d, -d, 'corner TL'], [r - k, t + k, d, -d, 'corner TR'], [l + k, b - k, -d, d, 'corner BL'], [r - k, b - k, d, d, 'corner BR']]) { const v = line(x, y, dx, dy); if (v !== null) pos.push({ side, at: 0, v }); }
  }
  if (!pos.length) return null;
  const weak = []; let run = null;
  for (const p of pos) { if (p.v < 3) { if (run && run.side === p.side && p.at - run.to <= 3) { run.to = p.at; run.min = Math.min(run.min, p.v); } else { run = { side: p.side, from: p.at, to: p.at, min: p.v }; weak.push(run); } } else run = null; }
  return { positions: pos.length, shareAtLeast3: r2(pos.filter((p) => p.v >= 3).length / pos.length), min: r2(Math.min(...pos.map((p) => p.v))),
    weakest: weak.sort((a, c) => a.min - c.min).slice(0, 4).map((w) => `${w.side} ${r2(w.from)}-${r2(w.to)}px min ${r2(w.min)}`) };
}
async function keyboardWalk(stops, vw, vh) {
  const out = [];
  await evalJs('window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); true'); await frames();
  for (let i = 0; i < stops; i++) {
    await pressTab(); await frames();
    const a = await evalJs(ACTIVE);
    if (!a) { out.push({ stop: i + 1, element: null }); continue; }
    const pair = async () => { const f = await shot();
      await evalJs('window.__gvFocus = document.activeElement; document.activeElement.blur(); true'); await frames();
      const u = await shot();
      await evalJs('window.__gvFocus.focus({ preventScroll: true }); true'); await frames(); return [f, u]; };
    // 1) where the Tab key leaves it (fixed navigation and pinned headers included)
    const [f1, u1] = await pair(), nat = ringStats(f1, u1, a.rect, vw, vh);
    // 2) the same element scrolled to the middle of the viewport: the ring against its own surfaces
    // The ring is measured around the element that draws it (Home: the .hero card draws the ring of its action link).
    const host = await evalJs(`(() => { const e = document.activeElement; if (getComputedStyle(e.closest('.tabbar') || e).position !== 'fixed') e.scrollIntoView({ block: 'center' });
      let h = e; while (h && h !== document.body && getComputedStyle(h).outlineStyle === 'none') h = h.parentElement; if (!h || h === document.body) h = e;
      const r = h.getBoundingClientRect(), cs = getComputedStyle(h);
      return { rect: [r.left, r.top, r.right, r.bottom], radius: parseFloat(cs.borderTopLeftRadius) || 0, circle: cs.borderTopLeftRadius.endsWith('%') && parseFloat(cs.borderTopLeftRadius) >= 50,
        host: h === e ? 'self' : h.tagName.toLowerCase() + '.' + h.classList[0], outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor + ' offset ' + cs.outlineOffset }; })()`);
    await frames();
    const [f2, u2] = await pair();
    out.push({ stop: i + 1, locator: a.locator, name: a.name, selected: a.selected, focusVisible: a.focusVisible, outline: host.host === 'self' ? a.outline : host.outline, ringHost: host.host,
      target: [r2(a.w), r2(a.h)], ring: ringStats(f2, u2, host.rect, vw, vh), perimeter: perimeter(f2, u2, host, vw, vh),
      atTab: { changedPx: nat.changedPx, ringColour: nat.ringColour, adjacentShareAtLeast3: nat.adjacentShareAtLeast3 } });
  }
  return out;
}

// ---------- Chip borders, rendered ----------
const CHIPS = `[...document.querySelectorAll('.chip--scheduled, .chip--outline, .chip--done, .chip--provisional, .chip--unknown, .chip--alert')].filter((e) => e.getBoundingClientRect().width > 0)`;
async function chipBorders(limit = 40) {
  const n = await evalJs(`${CHIPS}.length`); const out = [];
  for (let i = 0; i < Math.min(n, limit); i++) {
    const info = await evalJs(`(() => { const e = ${CHIPS}[${i}]; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return { cls: [...e.classList].filter((c) => c !== 'chip').join(' '), text: e.textContent.trim(), onInverse: !!e.closest('.st--leader, .champ'), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
        bw: parseFloat(cs.borderLeftWidth), style: cs.borderLeftStyle, color: cs.borderLeftColor }; })()`);
    await frames();
    const pad = 6, png = decodePng(await shot({ x: info.x - pad, y: info.y, width: info.w + pad * 2, height: info.h }));
    const xb = Math.round((pad + info.bw / 2) * DPR), xo = Math.round(pad * DPR) - 3, rows = [];
    for (let y = Math.round(png.h * 0.2); y < Math.round(png.h * 0.8); y++) rows.push(y);
    const px = (x, y) => { const o = (y * png.w + x) * 4; return [png.px[o], png.px[o + 1], png.px[o + 2]]; };
    let pairs = [];
    for (let dx = -2; dx <= 2; dx++) {
      const cand = rows.map((y) => [px(xb + dx, y), px(xo, y)]).map(([bd, o]) => ({ bd, out: o, cr: ratio(bd, o) })).sort((p, q) => p.cr - q.cr);
      if (!pairs.length || cand[Math.floor(cand.length / 2)].cr > pairs[Math.floor(pairs.length / 2)].cr) pairs = cand;
    }
    const pick = info.style === 'dashed' ? pairs[pairs.length - 1] : pairs[Math.floor(pairs.length / 2)];
    out.push({ cls: info.cls, text: info.text, onInverse: info.onInverse, style: info.style, declared: info.color, borderPx: hex(pick.bd), outsidePx: hex(pick.out), rendered: r2(pick.cr) });
  }
  return out;
}

// ---------- Text runs, rendered ----------
const TEXT_RUNS = `(() => {
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const vw = innerWidth, vh = innerHeight, out = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('.sr-only, .sprite, svg, .result__mark') || !vis(el)) continue;   // the watermark is decorative
    const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()); if (!nodes.length) continue;
    const rects = []; for (const n of nodes) { const rg = document.createRange(); rg.selectNodeContents(n); rects.push(...rg.getClientRects()); }
    if (!rects.length) continue;
    const l = Math.min(...rects.map((r) => r.left)), t = Math.min(...rects.map((r) => r.top)), r = Math.max(...rects.map((q) => q.right)), b = Math.max(...rects.map((q) => q.bottom));
    if (t < 0 || l < 0 || b > vh || r > vw || r - l < 2) continue;
    const owns = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); };
    const my = (t + b) / 2; if (!owns((l + r) / 2, my) || !owns(l + 2, my) || !owns(r - 2, my)) continue;
    const cs = getComputedStyle(el), size = parseFloat(cs.fontSize), weight = +cs.fontWeight;
    const path = []; for (let e = el; e && e !== document.body && path.length < 3; e = e.parentElement) path.unshift(e.tagName.toLowerCase() + (e.classList[0] ? '.' + e.classList[0] : ''));
    out.push({ key: path.join(' > '), text: nodes.map((n) => n.textContent).join('').trim().slice(0, 40), rect: [l, t, r, b], size, weight, large: size >= 24 || (size >= 18.66 && weight >= 700), color: cs.color });
  }
  return out; })()`;
function textStats(png, rect) {
  const im = decodePng(png), [l, t, r, b] = rect.map((v) => Math.round(v * DPR));
  const hist = new Map(), frameHist = new Map(), F = 3;
  const add = (map, x, y) => { if (x < 0 || y < 0 || x >= im.w || y >= im.h) return; const o = (y * im.w + x) * 4, k = (im.px[o] << 16) | (im.px[o + 1] << 8) | im.px[o + 2]; map.set(k, (map.get(k) || 0) + 1); };
  for (let y = t; y < b; y++) for (let x = l; x < r; x++) add(hist, x, y);
  // Background: the most frequent colour in a 3px frame just outside the run (the glyphs of heavy display text can outnumber the background inside it).
  for (let y = t - F; y < b + F; y++) for (let x = l - F; x < r + F; x++) if (x < l || x >= r || y < t || y >= b) add(frameHist, x, y);
  if (!hist.size || !frameHist.size) return null;
  const m = [...frameHist].sort((p, q) => q[1] - p[1])[0][0], bg = [(m >> 16) & 255, (m >> 8) & 255, m & 255];
  let best = 1, fg = bg;
  for (const [k] of hist) { const c = [(k >> 16) & 255, (k >> 8) & 255, k & 255], cr = ratio(c, bg); if (cr > best) { best = cr; fg = c; } }
  return { bg: hex(bg), fg: hex(fg), rendered: r2(best) };
}
async function textRuns(h) {
  const doc = await evalJs('document.documentElement.scrollHeight'), step = Math.max(200, h - 260), seen = new Map();
  for (let y = 0; y < doc; y += step) {
    await evalJs(`window.scrollTo(0, ${y}); true`); await sleep(120); await frames();
    const runs = await evalJs(TEXT_RUNS), png = await shot();
    for (const run of runs) { const id = `${run.key}|${run.text}`; if (seen.has(id)) continue; const s = textStats(png, run.rect); if (s) seen.set(id, { ...run, rect: undefined, ...s }); }
    if (y + h >= doc) break;
  }
  return [...seen.values()];
}

// ---------- Named fill / boundary samples (this batch) ----------
// Each entry: [name, js returning, after scrolling into view, viewport px:
//   {fg:[x,y], bg:[x,y]}                      a fill against its surroundings;
//   {scan:[x0,x1,y] | vscan:[x,y0,y1], bg, team}  a thin team-colour shape: "boundary" = the pixel on the line with
//   the highest contrast to the surface (the edge when there is one), "core" = the pixel closest to the team colour.
const el = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.getBoundingClientRect().width > 0)`;
const PAIRS = [
  ['cal: next band vs page', `(() => { const e = ${el('.ev--next')}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.right - 4, r.top + 6], bg: [r.right - 4, r.top - 3] }; })()`],
  ['cal: oxide block vs band', `(() => { const e = ${el('.ev--next .ev__round')}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.right - 3, r.bottom - 3], bg: [r.right + 8, r.bottom - 3] }; })()`],
  ['cal: next arrow disc vs band', `(() => { const e = ${el('.ev--next .ev__go')}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.left + 4, (r.top + r.bottom) / 2], bg: [r.left - 6, (r.top + r.bottom) / 2] }; })()`],
  ['notice: border vs page', `(() => { const e = ${el('.notice')}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.left + 0.5, (r.top + r.bottom) / 2], bg: [r.left - 3, (r.top + r.bottom) / 2] }; })()`],
  ['notice: fill vs page', `(() => { const e = ${el('.notice')}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.right - 4, r.top + 4], bg: [r.right - 4, r.top - 4] }; })()`],
  ['dd: plate band vs page', `(() => { const e = ${el('.dp')}; if (!e) return null; window.scrollTo(0, 0); const r = e.getBoundingClientRect(); return { fg: [r.left + 6, r.bottom - 4], bg: [r.left + 6, r.bottom + 6] }; })()`],
  ['dd: number board vs band', `(() => { const e = ${el('.dp__plate')}; if (!e) return null; window.scrollTo(0, 0); const r = e.getBoundingClientRect(); return { fg: [r.left + 8, r.bottom - 4], bg: [r.left - 6, r.bottom - 4] }; })()`],
  ['dd: arrow disc vs page', `(() => { const e = ${el('.disc')}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.left + 4, (r.top + r.bottom) / 2], bg: [r.left - 6, (r.top + r.bottom) / 2] }; })()`],
  ['dd: team tick #1E41FF vs row', `(() => { const e = ${el('.st__tick')}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(), y = (r.top + r.bottom) / 2; return { scan: [r.left - 4, r.right + 4, y], bg: [r.left - 9, y], team: getComputedStyle(e).getPropertyValue('--team').trim() }; })()`],
  ['td: banner vs page', `(() => { const e = ${el('.tb')}; if (!e) return null; window.scrollTo(0, 0); const r = e.getBoundingClientRect(); return { fg: [r.left + 6, r.bottom - 4], bg: [r.left + 6, r.bottom + 6] }; })()`],
];
for (const team of ['#0093CC', '#1E41FF', '#FF8000']) {
  const tb = `.tb[style*="${team}"]`, lu = `.lu[style*="${team}"]`;
  PAIRS.push([`td: rail bar ${team} vs banner`, `(() => { const e = ${el(tb + ' .tb__bar')}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(), x = r.left + r.width * 0.3; return { vscan: [x, r.top - 3, r.bottom + 3], bg: [x, r.top - 10], team: '${team}' }; })()`]);
  PAIRS.push([`td: pinstripe ${team} vs banner`, `(() => { const e = ${el(tb + ' .tb__pin')}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(), x = (r.left + r.right) / 2; return { vscan: [x, r.top - 3, r.bottom + 1], bg: [x, r.top - 8], team: '${team}' }; })()`]);
  PAIRS.push([`td: line-up seam ${team} vs page`, `(() => { const e = ${el(lu + ' .lu__seam')}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(), y = (r.top + r.bottom) / 2; return { scan: [r.left - 4, r.right + 4, y], bg: [r.left - 10, y], team: '${team}' }; })()`]);
}
async function samplePairs() {
  const out = [];
  for (const [name, js] of PAIRS) {
    const p = await evalJs(js); if (!p) continue;
    await frames();
    const im = decodePng(await shot());
    const at = ([x, y]) => { const cx = Math.min(im.w - 1, Math.max(0, Math.round(x * DPR))), cy = Math.min(im.h - 1, Math.max(0, Math.round(y * DPR))); const o = (cy * im.w + cx) * 4; return [im.px[o], im.px[o + 1], im.px[o + 2]]; };
    const b = at(p.bg);
    let a = p.fg ? at(p.fg) : b, core = null;
    const line = p.scan ? Array.from({ length: Math.ceil((p.scan[1] - p.scan[0]) * 2) + 1 }, (_, i) => [p.scan[0] + i / 2, p.scan[2]])
      : p.vscan ? Array.from({ length: Math.ceil((p.vscan[2] - p.vscan[1]) * 2) + 1 }, (_, i) => [p.vscan[0], p.vscan[1] + i / 2]) : [];
    const tc = p.team ? [1, 3, 5].map((i) => parseInt(p.team.slice(i, i + 2), 16)) : null, dist = (c) => c.reduce((s, v, i) => s + (v - tc[i]) ** 2, 0);
    for (const q of line) { const c = at(q); if (ratio(c, b) > ratio(a, b)) a = c; if (tc && (!core || dist(c) < dist(core))) core = c; }
    out.push({ name, fg: hex(a), bg: hex(b), rendered: r2(ratio(a, b)), ...(core ? { core: hex(core), coreVsSurface: r2(ratio(core, b)), coreVsBoundary: r2(ratio(core, a)) } : {}) });
  }
  return out;
}

// ---------- Owner composites ----------
const shots = [];
async function focusTo(sel) {
  await evalJs('window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); true');
  for (let i = 0; i < 80; i++) { await pressTab(); if (await evalJs(`document.activeElement === (${sel.startsWith('[...') ? sel : `document.querySelector(${JSON.stringify(sel)})`})`)) { await frames(); return i + 1; } }
  throw new Error(`focusTo: never reached ${sel}`);
}
const frame = (n) => `[...document.querySelectorAll('section.spec')].find((s) => s.querySelector('.spec__title').textContent.trim().startsWith('${n}.')).querySelector('.spec__frame')`;
const regionOf = (sel, above = 12, below = 12) => `(() => { const e = ${sel}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { y: Math.max(0, b.top + scrollY - ${above}), h: b.height + ${above + below} }; })()`;
const crop = (sel, above = 14, below = 14) => regionOf(`document.querySelector(${JSON.stringify(sel)})`, above, below);
async function ownerComposite(name, run, lang, w, h, scale, opts = {}) {
  if (!SCREENS) return;
  const pngs = [];
  for (const v of opts.variants || VARIANTS) {
    await open(fileOf(run, v, lang), w, h, scale);
    if (opts.focus) await focusTo(opts.focus);
    if (opts.region) { const r = await evalJs(opts.region); if (!r) throw new Error(`no region ${name}`); await frames(); pngs.push(await shot({ x: 0, y: r.y, width: w, height: r.h })); }
    else pngs.push(await shot());
  }
  const file = `screens/${name}.png`; writeFileSync(join(OUT, file), composite(pngs)); shots.push(file);
}

// LT-14: the completed row's text, measured with the row centred (clear of the pinned header and the fixed nav).
async function completedRowText() {
  if (!await evalJs(`(() => { const e = document.querySelector('.ev--completed'); if (!e) return false; e.scrollIntoView({ block: 'center' }); return true; })()`)) return null;
  await sleep(120); await frames();
  const keep = await evalJs(`(() => { const r = document.querySelector('.ev--completed').getBoundingClientRect(); return [r.top, r.bottom]; })()`);
  const runs = (await evalJs(TEXT_RUNS)).filter((t) => t.rect[1] >= keep[0] && t.rect[3] <= keep[1]), png = await shot();
  return runs.map((t) => ({ text: t.text, size: t.size, weight: t.weight, ...textStats(png, t.rect) }));
}

// ---------- Runs ----------
const results = { generated: new Date().toISOString(), browser: browser.product, dpr: DPR, raster: 'software',
  note: 'Chrome emulation only (root font-size for 200%, zero insets). No Android, no TalkBack, no WCAG compliance claim.', pages: {} };
const order = (x) => JSON.stringify(x.map((s) => [s.locator, s.name]));
for (const page of PAGES) {
  results.pages[page] = {};
  for (const [lang, w, h, scale] of SIZES) {
    const key = `${lang}-${w}x${h}-${scale}`, rec = {};
    let ref = null;
    for (const v of VARIANTS) {
      await open(fileOf(page, v, lang), w, h, scale);
      const snap = await evalJs(SNAPSHOT), ax = await axTree();
      const rowText = LT14 ? await completedRowText() : null;
      const walk = await keyboardWalk(snap.stops, w, h), chips = await chipBorders(), pairs = await samplePairs(), text = await textRuns(h);
      const r = { rowText, stops: snap.stops, quality: snap.quality, walk, chips, pairs, text,
        focusAlwaysVisible: walk.every((s) => s.focusVisible && s.ring && s.ring.changedPx > 0) };
      if (!ref) ref = { snap, ax, walk };
      else {
        const c = compareSnap(ref.snap, snap);
        Object.assign(r, { hardDiffs: c.hard, colourProperties: c.colourProperties, axIdentical: ax === ref.ax, tabOrderIdentical: order(walk) === order(ref.walk),
          targetsUnchanged: JSON.stringify(walk.map((s) => s.target)) === JSON.stringify(ref.walk.map((s) => s.target)) });
      }
      rec[v] = r;
    }
    results.pages[page][key] = rec;
    for (const v of CMP) { const l = rec[v];
      if (l.hardDiffs.length) console.log('  first hard diffs: ' + l.hardDiffs.slice(0, 6).join(' | '));
      console.log(page, key, v, `hard ${l.hardDiffs.length} ax ${l.axIdentical} tab ${l.tabOrderIdentical} targets ${l.targetsUnchanged} focus ${l.focusAlwaysVisible} | dark focus ${rec.dark.focusAlwaysVisible}`); }
  }
}

// ---------- Owner screenshots ----------
if (SCREENS && LT14) {
  // LT-14: completed row (round 12) and the ordinary row after it (round 20); Dark | Light A | Light B
  const pair = `(() => { const a = document.querySelector('.ev--completed'); if (!a) return null; window.scrollTo(0, 0); const b = a.nextElementSibling, r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect(); return { y: Math.max(0, r1.top + scrollY - 14), h: r2.bottom - r1.top + 28 }; })()`;
  const three = ['dark', 'light-a', 'light-b'];
  await ownerComposite('lt14-completed-en-390', 'lt14', 'en', 390, 844, 100, { variants: three, region: pair });
  // At 200% the two rows do not fit between the pinned header and the fixed nav: the completed row alone.
  await ownerComposite('lt14-completed-es-320-200', 'lt14', 'es', 320, 693, 200, { variants: three, region: crop('.ev--completed', 14, 14) });
  await ownerComposite('lt14-focus-completed-es-320-200', 'lt14', 'es', 320, 693, 200, { variants: three, focus: '.ev--completed .ev__link', region: crop('.ev--completed', 16, 16) });
}
if (SCREENS && !LT14) {
  // Calendar
  await ownerComposite('b1-cal-failed-en-390', 'cal-failed', 'en', 390, 844, 100);
  await ownerComposite('b1-cal-stale-es-320-200', 'cal-stale', 'es', 320, 693, 200);
  await ownerComposite('b1-cal-focus-next-en-390', 'cal', 'en', 390, 844, 100, { focus: '.ev--next .ev__link', region: crop('.ev--next', 16, 16) });
  await ownerComposite('b1-cal-focus-next-es-320-200', 'cal', 'es', 320, 693, 200, { focus: '.ev--next .ev__link', region: crop('.ev--next', 16, 16) });
  // Driver Detail
  await ownerComposite('b1-dd-en-390', 'dd-index', 'en', 390, 844, 100);
  await ownerComposite('b1-dd-es-320-200', 'dd-index', 'es', 320, 693, 200);
  await ownerComposite('b1-dd-focus-stint-en-390', 'dd-index', 'en', 390, 844, 100, { focus: '.st__hit', region: crop('.stints', 16, 16) });
  await ownerComposite('b1-dd-states-05-en-390', 'dd-states', 'en', 390, 844, 100, { region: regionOf(frame(5), 12, 12) });
  await ownerComposite('b1-dd-states-15-es-320-200', 'dd-states', 'es', 320, 693, 200, { region: regionOf(frame(15), 12, 12) });
  // Team Detail
  await ownerComposite('b1-td-en-390', 'td-index', 'en', 390, 844, 100);
  await ownerComposite('b1-td-es-320-200', 'td-index', 'es', 320, 693, 200);
  await ownerComposite('b1-td-focus-lineup-en-390', 'td-index', 'en', 390, 844, 100, { focus: '.lu__hit', region: crop('.lu', 16, 16) });
  await ownerComposite('b1-td-states-10-en-390', 'td-states', 'en', 390, 844, 100, { region: regionOf(frame(10), 12, 12) });
  await ownerComposite('b1-td-states-11-en-390', 'td-states', 'en', 390, 844, 100, { region: regionOf(frame(11), 12, 12) });
  await ownerComposite('b1-td-states-13-es-320-200', 'td-states', 'es', 320, 693, 200, { region: regionOf(frame(13), 12, 12) });
  // LT-13 comparison: Light (proposed) | Graphite identity band (not proposed)
  await ownerComposite('b1-lt13-dd-en-390', 'dd-index', 'en', 390, 844, 100, { variants: ['light', 'light-alt'], region: `(() => ({ y: 0, h: 380 }))()` });
  await ownerComposite('b1-lt13-td-en-390', 'td-index', 'en', 390, 844, 100, { variants: ['light', 'light-alt'], region: `(() => ({ y: 0, h: 380 }))()` });
}
results.screens = shots; results.unstableFrames = unstable;
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1));

// ---------- Summary ----------
const L = [`Primer V2 Light rollout Batch 1 (Step 53C${LT14 ? '.1, LT-14 specimen' : ''}) - ${results.generated}`, `${results.browser} · DPR ${DPR} · software raster · unstable frames ${unstable}`, results.note, ''];
L.push('Structure (Light vs Dark reference, same markup):');
for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) for (const v of CMP) { const c = rec[v];
  L.push(`  ${page} ${key}${CMP.length > 1 ? ' ' + v : ''}: hard diffs ${c.hardDiffs.length} · ax identical ${c.axIdentical} · tab order identical ${c.tabOrderIdentical} (${c.walk.length} stops) · targets unchanged ${c.targetsUnchanged} · focus always visible ${c.focusAlwaysVisible} (dark ${rec.dark.focusAlwaysVisible}) · quality ${JSON.stringify(c.quality) === '{"hScroll":false,"outside":[],"clipped":[],"spill":[],"small":[]}' ? 'clean' : JSON.stringify(c.quality)}`);
  if (c.hardDiffs.length) L.push('    HARD ' + c.hardDiffs.slice(0, 8).join(' | '));
  if (key === 'en-390x844-100') L.push('    colour properties changed: ' + Object.entries(c.colourProperties).map(([p, n]) => `${p} x${n}`).join(', ')); }
const declared = (o) => { const m = o.match(/rgb\((\d+), (\d+), (\d+)\)/); return m ? hex([+m[1], +m[2], +m[3]]) : null; };
L.push('', 'Focus by component, every size (perimeter share >= 3:1 change, min; ring colour; ring vs focused neighbours p05). Dark | Light:');
for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) { const seen = new Set();
  rec.dark.walk.forEach((s, i) => { const k = (s.locator || 'none').split(' > ').slice(-2).join(' > ') + (s.selected ? ' [selected]' : ''); if (seen.has(k)) return; seen.add(k);
    const f = (t) => !t || !t.ring || !t.ring.changedPx ? 'NO RING' : `${t.perimeter ? t.perimeter.shareAtLeast3 + ' (min ' + t.perimeter.min + ')' : '-'} ${t.ring.ringColour}${t.ring.ringColour !== declared(t.outline) ? ' [declared ' + declared(t.outline) + ']' : ''} p05 ${t.ring.focusedNeighbours ? t.ring.focusedNeighbours.p05 : '-'}${t.perimeter && t.perimeter.weakest.length ? ' weakest ' + t.perimeter.weakest.slice(0, 2).join('; ') : ''}`;
    L.push(`  ${page} ${key} ${k} "${(s.name || '').slice(0, 26)}": dark ${f(s)} | ${CMP.map((v) => `${v} ${f(rec[v].walk[i])}`).join(' | ')}`); }); }
L.push('', 'Rings not fully visible where the Tab key leaves them (pre-existing XS-32 cases expected in both variants):');
for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) for (const v of VARIANTS) {
  const hid = rec[v].walk.filter((s) => s.atTab && (!s.atTab.changedPx || s.atTab.ringColour !== declared(s.outline)));
  if (hid.length) L.push(`  ${page} ${key} ${v}: stops ${hid.map((s) => s.stop + ' (' + (s.name || '').slice(0, 24) + ')').join(', ')}`); }
L.push('', 'Rendered chip borders (border pixel vs pixel outside), EN 390x844 @100% and EN 320x693 @200%:');
for (const [page, sizes] of Object.entries(results.pages)) for (const key of (LT14 ? Object.keys(sizes) : ['en-390x844-100', 'en-320x693-200'])) { const rec = sizes[key]; if (!rec) continue;
  rec.dark.chips.forEach((c, i) => { L.push(`  ${page} ${key} ${c.cls} "${c.text}" ${c.style}: dark ${c.rendered} (${c.borderPx} on ${c.outsidePx}) · ` + CMP.map((v) => { const d = rec[v].chips[i]; return `${v} ${d ? `${d.rendered} (${d.borderPx} on ${d.outsidePx})` : '-'}`; }).join(' · ')); }); }
L.push('', 'Named samples, every size (rendered; team shapes: boundary vs surface, core vs surface, core vs boundary):');
for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) for (const v of VARIANTS) for (const p of rec[v].pairs)
  L.push(`  ${page} ${key} ${v} ${p.name}: ${p.rendered} (${p.fg}/${p.bg})${p.core ? ` · core ${p.core} ${p.coreVsSurface} vs surface, ${p.coreVsBoundary} vs boundary` : ''}`);
L.push('', 'Rendered text below its threshold (4.5:1; 3:1 for large text), every page and size:');
let low = 0;
for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) for (const v of VARIANTS) for (const t of rec[v].text)
  if (t.rendered < (t.large ? 3 : 4.5)) { low++; L.push(`  ${page} ${key} ${v} ${t.key} "${t.text}" ${t.size}px/${t.weight}: ${t.rendered} (${t.fg} on ${t.bg})`); }
if (!low) L.push('  none');
L.push('', 'Rendered text, lowest per element key, EN 390x844 @100% (dark · light):');
for (const [page, sizes] of Object.entries(results.pages)) { const rec = sizes['en-390x844-100']; if (!rec) continue; const keys = new Map();
  for (const v of VARIANTS) for (const t of rec[v].text) { const k = t.key.split(' > ').pop(); const cur = keys.get(k) || {}; if (!cur[v] || t.rendered < cur[v].rendered) cur[v] = t; keys.set(k, cur); }
  for (const [k, o] of keys) L.push(`  ${page} ${k}: ` + VARIANTS.map((v) => o[v] ? `${v} ${o[v].rendered} (${o[v].fg}/${o[v].bg})` : `${v} -`).join(' · ')); }
if (LT14) {
  const ROW = /^(12|Italian Grand Prix|Autodromo Nazionale Monza|Completed|Finalizado)$/, REF = /^(20|São Paulo Grand Prix|Autódromo José Carlos Pace)$/;
  L.push('', 'LT-14 completed row (round 12) vs the ordinary row after it (round 20), rendered text per variant:');
  for (const [, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) for (const v of VARIANTS) {
    const fmt = (re) => rec[v].text.filter((t) => re.test(t.text)).map((t) => `"${t.text}" ${t.rendered} (${t.fg}/${t.bg})`).join(' · ');
    L.push(`  ${key} ${v}: completed (row centred) ${(rec[v].rowText || []).map((t) => `"${t.text}" ${t.rendered} (${t.fg}/${t.bg})`).join(' · ')}`,
      `  ${key} ${v}: completed (page scan) ${fmt(ROW)}`, `  ${key} ${v}: round 20  ${fmt(REF)}`);
    const chip = rec[v].chips.find((c) => c.cls.includes('chip--done'));
    if (chip) L.push(`  ${key} ${v}: completed chip outline ${chip.rendered} (${chip.borderPx} on ${chip.outsidePx}, declared ${chip.declared})`);
    const stop = rec[v].walk.find((x) => /Italian/.test(x.name || ''));
    if (stop) L.push(`  ${key} ${v}: completed row focus stop ${stop.stop}, ring ${stop.ring ? stop.ring.ringColour : 'NONE'}, perimeter ${stop.perimeter ? stop.perimeter.shareAtLeast3 + ' (min ' + stop.perimeter.min + ')' : '-'}, target ${JSON.stringify(stop.target)}`);
  }
}
L.push('', 'Screens:', ...shots.map((s) => '  ' + s));
writeFileSync(join(OUT, 'summary.txt'), L.join('\n') + '\n');
console.log(`done: ${OUT}`);
ws.close(); chrome.kill(); process.exit(0);
