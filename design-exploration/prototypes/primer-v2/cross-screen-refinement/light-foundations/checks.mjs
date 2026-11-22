// Primer V2 Light foundations EXPLORATION, Step 53A: Dark reference vs Light A vs Light B.
//
//   node checks.mjs [--out <dir>] [--no-screens]
//
// Dependency-free: Chrome over the DevTools Protocol (software raster, DPR 2,
// mobile + touch), PNG decode/encode with node:zlib (decoder copied from
// ../../consolidation-pilot/tools/visual-compare.mjs, which is only read).
// Chrome emulation only: no Android, no TalkBack, no WCAG compliance claim.
//
// Per page x size (EN 390x844 @100%, ES 320x693 @200%):
//  - structure: each Light page against its Dark reference: identical text,
//    attributes, boxes, accessibility tree, Tab order, adaptive fit modes and
//    layout-quality metrics; every computed-style difference must be a colour
//    property (colour, background, border/outline colour, shadow, stroke);
//  - focus: every Tab stop captured focused and unfocused at the same scroll
//    position; ring = pixels that change; ring colour = most frequent changed
//    colour, measured against every unchanged pixel touching it;
//  - chips: each outlined chip's rendered border pixel against the pixel just
//    outside it;
//  - text: every visible text run (Range rects, uncovered at three points),
//    rendered: background = most frequent colour in the run's box, text = the
//    pixel with the highest contrast to it (glyph core);
//  - pairs: named fill/boundary samples (selected slab, nav slab, cards, team
//    ticks, notice border).
// Owner screenshots: 3-up composites (Dark | Light A | Light B), downscaled
// to CSS pixels, a small fixed set.
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
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const stepArg = argv.indexOf('--step');
const STEP = stepArg >= 0 ? argv[stepArg + 1] : '53a';    // '53a': Dark | A | B on five pages; '53a1': B | B Motorsport on three
const S1 = STEP === '53a1';
const S3 = STEP === '53b';   // '53b': B Motorsport (approved, LT-1) | Step 53B corrections, on four pages, three sizes
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-${STEP}`));
mkdirSync(join(OUT, 'screens'), { recursive: true });

const pagesArg = argv.indexOf('--pages');
const PAGES = pagesArg >= 0 ? argv[pagesArg + 1].split(',') : S3 ? ['home', 'st-index', 'gp-results', 'ex-cue'] : S1 ? ['home', 'gp-results', 'st-index'] : ['home', 'st-index', 'st-states', 'ex-cue', 'gp-results'];
const VARIANTS = S3 ? ['dark', 'light-bm', 'light-53b'] : S1 ? ['dark', 'light-b', 'light-bm'] : ['dark', 'light-a', 'light-b'];   // first = structural reference (frozen Dark)
const LIGHT = VARIANTS.slice(1);
const COMPOSITE = S3 ? ['light-bm', 'light-53b'] : S1 ? ['light-b', 'light-bm'] : VARIANTS;   // owner composites, left to right
const SIZES = S3 ? [['en', 390, 844, 100], ['en', 320, 693, 200], ['es', 320, 693, 200]] : [['en', 390, 844, 100], ['es', 320, 693, 200]];
const fileOf = (page, v, lang) => join(HERE, `${page}-${v}${lang === 'en' ? '' : '.es'}.html`);
const ALLOWED_STYLE = /^(color|background-color|background-image|border-(top|right|bottom|left|block-start|block-end|inline-start|inline-end)-color|outline-color|box-shadow|-webkit-text-stroke-color|-webkit-text-fill-color|text-decoration-color|text-decoration|text-emphasis-color|caret-color|column-rule-color|row-rule-color|fill|stroke|color-scheme|--.*)$/;

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
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-53a-'))}`,
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
  pageUrl = pathToFileURL(path).href;
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
  return lines.join('\n').split(page).join('<page>').replace(/(home|st-index|st-states|ex-cue|gp-results)-(dark|light-a|light-bm|light-b|light-53b)(\.es)?\.html/g, '<page>');
}
function compareSnap(a, b) {
  const hard = [], styles = new Map();
  if (a.nodes.length !== b.nodes.length) hard.push(`element count ${a.nodes.length} vs ${b.nodes.length}`);
  a.nodes.forEach((n, i) => { const m = b.nodes[i]; if (!m) return;
    if (n.path !== m.path) { hard.push(`element ${i}: ${n.path} vs ${m.path}`); return; }
    if (n.text !== m.text) hard.push(`text ${n.path}`);
    const an = JSON.stringify(n.attrs).replace(/-(dark|light-a|light-bm|light-b|light-53b)(\.es)?\.html/g, ''), am = JSON.stringify(m.attrs).replace(/-(dark|light-a|light-bm|light-b|light-53b)(\.es)?\.html/g, '');
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

// ---------- Named fill / boundary samples ----------
// Each entry: [name, js returning {fg:[x,y], bg:[x,y]} in viewport px after scrolling into view, or null].
const PAIRS = [
  ['selector: selected slab vs container', `(() => { const s = document.querySelector('.seg__btn[aria-pressed="true"]'), u = document.querySelector('.seg__btn[aria-pressed="false"]'); if (!s || !u) return null; s.scrollIntoView({ block: 'center' }); const a = s.getBoundingClientRect(), b = u.getBoundingClientRect(); return { fg: [(a.left + a.right) / 2, a.top + 5], bg: [(b.left + b.right) / 2, b.top + 5] }; })()`],
  ['selector: container vs page', `(() => { const g = document.querySelector('.seg'); if (!g) return null; g.scrollIntoView({ block: 'center' }); const u = document.querySelector('.seg__btn[aria-pressed="false"]').getBoundingClientRect(), r = g.getBoundingClientRect(); return { fg: [(u.left + u.right) / 2, u.top + 5], bg: [(u.left + u.right) / 2, r.top - 4] }; })()`],
  ['nav: selected slab vs bar', `(() => { const s = document.querySelector('.tab.is-selected .tab__icon'), u = document.querySelector('.tab:not(.is-selected) .tab__icon'); if (!s || !u) return null; const a = s.getBoundingClientRect(), b = u.getBoundingClientRect(); return { fg: [(a.left + a.right) / 2, a.top + 3], bg: [(b.left + b.right) / 2, b.top + 3] }; })()`],
  ['nav: bar vs page', `(() => { const n = document.querySelector('.tabbar'); if (!n) return null; const r = n.getBoundingClientRect(), u = document.querySelector('.tab:not(.is-selected) .tab__icon').getBoundingClientRect(); window.scrollTo(0, 0); return { fg: [(u.left + u.right) / 2, u.top + 3], bg: [4, r.top - 30] }; })()`],
  ['home: editorial card vs page', `(() => { const e = document.querySelector('.hero'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.left + 6, r.bottom - 60], bg: [r.left + 6, r.bottom + 8] }; })()`],
  ['home: inverse band vs page', `(() => { const e = document.querySelector('.champ'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.left + 8, r.top + 40], bg: [r.left + 8, r.top - 8] }; })()`],
  ['home: sessions band vs page', `(() => { const e = document.querySelector('.sessions'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [4, r.top + 8], bg: [4, r.top - 8] }; })()`],
  ['standings: leader card vs page', `(() => { const e = document.querySelector('section:not([hidden]) .st--leader .st__link'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.left + 10, r.bottom - 6], bg: [r.left + 10, r.bottom + 3] }; })()`],
  ['notice: border vs page', `(() => { const e = document.querySelector('.notice'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.left + 0.5, (r.top + r.bottom) / 2], bg: [r.left - 3, (r.top + r.bottom) / 2] }; })()`],
  ['notice: fill vs page', `(() => { const e = document.querySelector('.notice'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.right - 4, r.top + 4], bg: [r.right - 4, r.top - 4] }; })()`],
  ['gp: rail cell vs page', `(() => { const e = document.querySelector('.cl:not(.cl--winner) .cl__pos'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { fg: [r.left + 4, r.top + 4], bg: [r.right + 30, r.top + 4] }; })()`],
  ['explore: team tick #1E41FF vs row', `(() => { const e = document.querySelector('.ent[style*="1E41FF"] .ent__link'); if (!e || !e.offsetParent) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { scan: [r.left, r.left + 24, r.top + 38], bg: [r.left + 1, r.top + 38] }; })()`],
  ['explore: team tick #FF8000 vs row', `(() => { const e = document.querySelector('.ent[style*="FF8000"] .ent__link'); if (!e || !e.offsetParent) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { scan: [r.left, r.left + 24, r.top + 38], bg: [r.left + 1, r.top + 38] }; })()`],
  // Step 53A.1 (B Motorsport) surfaces
  ['home: action strip vs card', `(() => { const a = document.querySelector('.hero__action'); if (!a) return null; a.scrollIntoView({ block: 'center' }); const r = a.getBoundingClientRect(); return { fg: [r.left + 6, r.top + 6], bg: [r.left + 6, r.top - 10] }; })()`],
  ['home: action label vs strip', `(() => { const a = document.querySelector('.hero__action'); if (!a) return null; a.scrollIntoView({ block: 'center' }); const r = a.getBoundingClientRect(), t = a.querySelector('span').getBoundingClientRect(); return { scan: [t.left, t.right, (t.top + t.bottom) / 2], bg: [r.left + 6, r.top + 6] }; })()`],
  ['home: arrow disc vs strip', `(() => { const d = document.querySelector('.hero__arrow'); if (!d) return null; d.scrollIntoView({ block: 'center' }); const r = d.getBoundingClientRect(); return { fg: [r.left + 4, (r.top + r.bottom) / 2], bg: [r.left - 6, (r.top + r.bottom) / 2] }; })()`],
  ['home: arrow glyph vs disc', `(() => { const d = document.querySelector('.hero__arrow'); if (!d) return null; d.scrollIntoView({ block: 'center' }); const r = d.getBoundingClientRect(); return { scan: [r.left + 8, r.right - 8, (r.top + r.bottom) / 2], bg: [r.left + 4, (r.top + r.bottom) / 2] }; })()`],
  ['gp: identity band vs page', `(() => { const e = document.querySelector('.gp'); if (!e) return null; window.scrollTo(0, 0); const r = e.getBoundingClientRect(); return { fg: [r.right - 6, r.top + 20], bg: [r.right - 6, r.bottom + 6] }; })()`],
];
async function samplePairs() {
  const out = [];
  for (const [name, js] of PAIRS) {
    const p = await evalJs(js); if (!p) continue;
    await frames();
    const im = decodePng(await shot());
    const at = ([x, y]) => { const cx = Math.min(im.w - 1, Math.max(0, Math.round(x * DPR))), cy = Math.min(im.h - 1, Math.max(0, Math.round(y * DPR))); const o = (cy * im.w + cx) * 4; return [im.px[o], im.px[o + 1], im.px[o + 2]]; };
    const b = at(p.bg);
    let a = p.fg ? at(p.fg) : b;   // scan: the pixel in the span with the highest contrast to the background (thin, skewed ticks)
    if (p.scan) for (let x = p.scan[0]; x <= p.scan[1]; x += 0.5) { const c = at([x, p.scan[2]]); if (ratio(c, b) > ratio(a, b)) a = c; }
    out.push({ name, fg: hex(a), bg: hex(b), rendered: r2(ratio(a, b)) });
  }
  return out;
}

// ---------- Owner composites ----------
const shots = [];
async function capture(page, v, lang, w, h, scale, region) {
  await open(fileOf(page, v, lang), w, h, scale);
  if (!region) return shot();
  const r = await evalJs(region.js);
  if (!r) throw new Error(`no region for ${page} ${region.name}`);
  await frames();
  return shot({ x: 0, y: r.y, width: w, height: r.h });
}
async function focusTo(sel) {
  await evalJs('window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); true');
  for (let i = 0; i < 60; i++) { await pressTab(); if (await evalJs(`document.activeElement === document.querySelector(${JSON.stringify(sel)})`)) { await frames(); return i + 1; } }
  throw new Error(`focusTo: never reached ${sel}`);
}
const frame = (n) => `[...document.querySelectorAll('section.spec')].find((s) => s.querySelector('.spec__title').textContent.trim().startsWith('${n}.')).querySelector('.spec__frame')`;
const regionOf = (sel, above = 12, below = 12) => `(() => { const e = ${sel}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { y: Math.max(0, b.top + scrollY - ${above}), h: b.height + ${above + below} }; })()`;
const stTop = `(() => { const s = document.querySelector('.seg'), l = document.querySelector('section:not([hidden]) .st--leader'); const a = s.getBoundingClientRect(), b = l.getBoundingClientRect(); return { y: a.top + scrollY - 10, h: b.bottom - a.top + 22 }; })()`;
async function ownerComposite(name, page, lang, w, h, scale, opts = {}) {
  if (!SCREENS) return;
  const pngs = [];
  for (const v of COMPOSITE) {
    await open(fileOf(page, v, lang), w, h, scale);
    if (opts.focus) await focusTo(opts.focus);
    if (opts.region) { const r = await evalJs(opts.region); if (!r) throw new Error(`no region ${name}`); await frames(); pngs.push(await shot({ x: 0, y: r.y, width: w, height: r.h })); }
    else pngs.push(await shot());
  }
  const file = `screens/${name}.png`; writeFileSync(join(OUT, file), composite(pngs)); shots.push(file);
}

// Which elements' computed colours differ between two variants (Step 53A.1: B vs B Motorsport).
function changedElements(a, b) {
  const out = new Map();
  a.nodes.forEach((n, i) => { const m = b.nodes[i]; if (!m) return;
    for (const part of ['style', '::before', '::after']) { const s = n[part] || {}, t = m[part] || {};
      const props = [...new Set([...Object.keys(s), ...Object.keys(t)])].filter((p) => !p.startsWith('--') && s[p] !== t[p] && !/caret|emphasis|rule-color|fill-color|text-decoration|stroke-color|outline-color/.test(p));
      if (!props.length) continue;
      const key = n.path.split('/').slice(-2).map((x) => x.replace(/:\d+$/, '')).join(' > ') + (part === 'style' ? '' : part);
      const cur = out.get(key) || new Set(); props.forEach((p) => cur.add(`${p.replace(/^border-.*-color$/, 'border-color')}: ${s[p]} -> ${t[p]}`)); out.set(key, cur); } });
  return [...out].map(([k, v]) => ({ element: k, changes: [...v] }));
}

// ---------- Runs ----------
const results = { generated: new Date().toISOString(), browser: browser.product, dpr: DPR, raster: 'software',
  note: 'Chrome emulation only (root font-size for 200%, zero insets). No Android, no TalkBack, no WCAG compliance claim.', pages: {} };
const order = (x) => JSON.stringify(x.map((s) => [s.locator, s.name]));
for (const page of PAGES) {
  results.pages[page] = {};
  for (const [lang, w, h, scale] of SIZES) {
    const key = `${lang}-${w}x${h}-${scale}`, rec = {}, snaps = {};
    let ref = null;
    for (const v of VARIANTS) {
      await open(fileOf(page, v, lang), w, h, scale);
      const snap = await evalJs(SNAPSHOT), ax = await axTree();
      const walk = await keyboardWalk(snap.stops, w, h), chips = await chipBorders(), pairs = await samplePairs(), text = await textRuns(h);
      const r = { stops: snap.stops, fit: snap.fit, quality: snap.quality, walk, chips, pairs, text,
        focusAlwaysVisible: walk.every((s) => s.focusVisible && s.ring && s.ring.changedPx > 0) };
      snaps[v] = snap;
      if (!ref) ref = { snap, ax, walk };
      else {
        const c = compareSnap(ref.snap, snap);
        Object.assign(r, { hardDiffs: c.hard, colourProperties: c.colourProperties, axIdentical: ax === ref.ax, tabOrderIdentical: order(walk) === order(ref.walk),
          targetsUnchanged: JSON.stringify(walk.map((s) => s.target)) === JSON.stringify(ref.walk.map((s) => s.target)) });
      }
      rec[v] = r;
    }
    if (S1) rec.changedElements = changedElements(snaps['light-b'], snaps['light-bm']);
    if (S3) rec.changedElements = changedElements(snaps['light-bm'], snaps['light-53b']);   // resting state
    results.pages[page][key] = rec;
    for (const v of LIGHT) if (rec[v].hardDiffs.length) console.log('  ' + v + ' first hard diffs: ' + rec[v].hardDiffs.slice(0, 6).join(' | '));
    console.log(page, key, LIGHT.map((v) => `${v}: hard ${rec[v].hardDiffs.length} ax ${rec[v].axIdentical} tab ${rec[v].tabOrderIdentical} focus ${rec[v].focusAlwaysVisible}`).join(' | '), `dark focus ${rec.dark.focusAlwaysVisible}`);
  }
}

// ---------- Owner screenshots (53A: Dark | Light A | Light B; 53A.1: B | B Motorsport) ----------
const stopCrop = (sel, above = 14, below = 14) => regionOf(`document.querySelector(${JSON.stringify(sel)})`, above, below);
if (S3 && SCREENS) {
  const seg = `(() => { const s = document.querySelector('.seg'); s.scrollIntoView({ block: 'center' }); const b = s.getBoundingClientRect(); return { y: b.top + scrollY - 10, h: b.height + 20 }; })()`;
  await ownerComposite('53b-st-focus-unselected-en-390', 'st-index', 'en', 390, 844, 100, { focus: '.seg__btn[aria-pressed="false"]', region: seg });
  await ownerComposite('53b-st-focus-selected-en-390', 'st-index', 'en', 390, 844, 100, { focus: '.seg__btn[aria-pressed="true"]', region: seg });
  await ownerComposite('53b-ex-focus-unselected-en-390', 'ex-cue', 'en', 390, 844, 100, { focus: '.seg__btn[aria-controls="teams"]', region: seg });
  await ownerComposite('53b-gp-focus-winner-en-390', 'gp-results', 'en', 390, 844, 100, { focus: '.cl--winner .cl__hit', region: stopCrop('.cl--winner', 16, 16) });
  await ownerComposite('53b-gp-focus-dnf-en-390', 'gp-results', 'en', 390, 844, 100, { focus: '.cl:has(.chip--outline) > .cl__hit', region: regionOf(`document.querySelector('.chip--outline').closest('.cl')`, 16, 16) });
  await ownerComposite('53b-gp-focus-back-en-390', 'gp-results', 'en', 390, 844, 100, { focus: '.dbar .icon-btn', region: `(() => ({ y: 0, h: 96 }))()` });
  await ownerComposite('53b-home-focus-hero-en-390', 'home', 'en', 390, 844, 100, { focus: '.hero__action', region: stopCrop('.hero', 12, 12) });
  await ownerComposite('53b-ex-team-ticks-en-390', 'ex-cue', 'en', 390, 844, 100, { region: `(() => { const a = document.querySelectorAll('#drivers .ent'); a[0].scrollIntoView({ block: 'center' }); const p = a[0].getBoundingClientRect(), q = a[2].getBoundingClientRect(); return { y: p.top + scrollY - 8, h: q.bottom - p.top + 16 }; })()` });
  await ownerComposite('53b-st-focus-unselected-es-320-200', 'st-index', 'es', 320, 693, 200, { focus: '.seg__btn[aria-pressed="false"]', region: seg });
  await ownerComposite('53b-gp-focus-winner-es-320-200', 'gp-results', 'es', 320, 693, 200, { focus: '.cl--winner .cl__hit', region: stopCrop('.cl--winner', 16, 16) });
}
if (S1 && SCREENS) {
  await ownerComposite('53a1-home-en-390', 'home', 'en', 390, 844, 100);
  await ownerComposite('53a1-gp-results-en-390', 'gp-results', 'en', 390, 844, 100);
  await ownerComposite('53a1-gp-results-classification-en-390', 'gp-results', 'en', 390, 844, 100, { region: regionOf(`document.querySelector('.cls').closest('.sec')`, 12, 12) });
  await ownerComposite('53a1-st-index-en-390', 'st-index', 'en', 390, 844, 100);
  await ownerComposite('53a1-home-focus-hero-en-390', 'home', 'en', 390, 844, 100, { focus: '.hero__action', region: regionOf(`document.querySelector('.hero')`, 12, 12) });
  await ownerComposite('53a1-home-hero-es-320-200', 'home', 'es', 320, 693, 200, { region: regionOf(`document.querySelector('.hero__action')`, 150, 16) });
  await ownerComposite('53a1-gp-results-es-320-200', 'gp-results', 'es', 320, 693, 200);
}
if (SCREENS && PAGES.length === 5) for (const page of PAGES) await ownerComposite(`53a-${page}-en-390`, page, 'en', 390, 844, 100);
if (PAGES.length === 5) {
await ownerComposite('53a-st-states-notices-en-390', 'st-states', 'en', 390, 844, 100, { region: `(() => { const a = ${frame(10)}, b = ${frame(11)}; a.scrollIntoView({ block: 'center' }); const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return { y: p.top + scrollY - 12, h: q.bottom - p.top + 24 }; })()` });
await ownerComposite('53a-st-states-08-marker-en-390', 'st-states', 'en', 390, 844, 100, { region: regionOf(frame(8)) });
await ownerComposite('53a-st-focus-unselected-en-390', 'st-index', 'en', 390, 844, 100, { focus: '.seg__btn[aria-pressed="false"]', region: stTop });
await ownerComposite('53a-st-focus-selected-en-390', 'st-index', 'en', 390, 844, 100, { focus: '.seg__btn[aria-pressed="true"]', region: stTop });
await ownerComposite('53a-st-focus-leader-en-390', 'st-index', 'en', 390, 844, 100, { focus: 'section:not([hidden]) .st--leader .st__link', region: stTop });
await ownerComposite('53a-home-focus-champ-link-en-390', 'home', 'en', 390, 844, 100, { focus: '.leader__link', region: regionOf(`document.querySelector('.champ')`) });
await ownerComposite('53a-gp-focus-winner-en-390', 'gp-results', 'en', 390, 844, 100, { focus: '.cl--winner .cl__hit', region: regionOf(`document.querySelector('.cl--winner')`, 16, 16) });
await ownerComposite('53a-home-es-320-200', 'home', 'es', 320, 693, 200);
await ownerComposite('53a-st-index-es-320-200', 'st-index', 'es', 320, 693, 200);
}
results.screens = shots; results.unstableFrames = unstable;
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1));

// ---------- Summary ----------
const L = [`Primer V2 Light foundations (Step ${S3 ? '53B, B Motorsport vs 53B corrections' : S1 ? '53A.1, B vs B Motorsport' : '53A'}) - ${results.generated}`, `${results.browser} · DPR ${DPR} · software raster · unstable frames ${unstable}`, results.note, ''];
L.push('Structure (each Light page vs its Dark reference):');
for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) for (const v of LIGHT) { const c = rec[v];
  L.push(`  ${page} ${key} ${v}: hard diffs ${c.hardDiffs.length} · ax identical ${c.axIdentical} · tab order identical ${c.tabOrderIdentical} (${c.walk.length} stops) · targets unchanged ${c.targetsUnchanged} · focus always visible ${c.focusAlwaysVisible} · fit ${JSON.stringify(c.fit)} · quality ${JSON.stringify(c.quality) === '{"hScroll":false,"outside":[],"clipped":[],"spill":[],"small":[]}' ? 'clean' : JSON.stringify(c.quality)}`);
  if (c.hardDiffs.length) L.push('    HARD ' + c.hardDiffs.slice(0, 8).join(' | '));
  if (key.startsWith('en')) L.push('    colour properties changed: ' + Object.entries(c.colourProperties).map(([p, n]) => `${p} x${n}`).join(', ')); }
L.push('', 'Focus rings (element centred in the viewport): stops whose lowest adjacent contrast is below 3:1, or whose ring colour differs from the declared outline:');
const declared = (o) => { const m = o.match(/rgb\((\d+), (\d+), (\d+)\)/); return m ? hex([+m[1], +m[2], +m[3]]) : null; };
for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) for (const v of VARIANTS) for (const s of rec[v].walk) {
  if (!s.ring || !s.ring.changedPx) { L.push(`  ${page} ${key} ${v} stop ${s.stop} ${s.locator}: NO RING PIXELS`); continue; }
  const hidden = s.ring.ringColour !== declared(s.outline);
  if (s.ring.adjacentMin < 3 || hidden) L.push(`  ${page} ${key} ${v} stop ${s.stop} ${s.locator} "${s.name.slice(0, 30)}": ring ${s.ring.ringColour} (declared ${declared(s.outline)})${hidden ? ' HIDDEN/OTHER' : ''} min ${s.ring.adjacentMin} p05 ${s.ring.adjacentP05} share>=3 ${s.ring.adjacentShareAtLeast3} low ${s.ring.lowNeighbours.join(', ')}`);
}
L.push('', 'Rings not fully visible where the Tab key leaves them (declared colour not the measured ring colour, or no ring pixels): pre-existing XS-32 cases are expected in every variant:');
for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) for (const v of VARIANTS) {
  const hid = rec[v].walk.filter((s) => s.atTab && (!s.atTab.changedPx || s.atTab.ringColour !== declared(s.outline)) && !/hero__action/.test(s.locator));
  if (hid.length) L.push(`  ${page} ${key} ${v}: stops ${hid.map((s) => s.stop + ' (' + s.name.slice(0, 24) + ')').join(', ')}`); }
L.push('', 'Focus rings by component, EN 390x844 @100% (ring colour, adjacent min / median, share >= 3):');
for (const [page, sizes] of Object.entries(results.pages)) { const rec = sizes['en-390x844-100']; const seen = new Set();
  rec.dark.walk.forEach((s, i) => { const k = s.locator.split(' > ').slice(-2).join(' > ') + (s.selected ? ' [selected]' : ''); if (seen.has(k)) return; seen.add(k);
    L.push(`  ${page} ${k}: ` + VARIANTS.map((v) => { const t = rec[v].walk[i]; return t && t.ring.changedPx ? `${v} ${t.ring.ringColour} ${t.ring.adjacentMin}/${t.ring.adjacentMedian} (${t.ring.adjacentShareAtLeast3})` : `${v} none`; }).join(' · ')); }); }
L.push('', 'Rendered chip borders (border pixel vs pixel outside), EN 390x844 @100%:');
for (const [page, sizes] of Object.entries(results.pages)) { const rec = sizes['en-390x844-100'];
  rec.dark.chips.forEach((c, i) => L.push(`  ${page} ${c.cls} "${c.text}" ${c.style}${c.onInverse ? ' (inverse plane)' : ''}: ` + VARIANTS.map((v) => { const d = rec[v].chips[i]; return `${v} ${d.rendered} (${d.borderPx} on ${d.outsidePx})`; }).join(' · '))); }
L.push('', 'Named samples, EN 390x844 @100%:');
for (const [page, sizes] of Object.entries(results.pages)) { const rec = sizes['en-390x844-100'];
  rec.dark.pairs.forEach((p, i) => L.push(`  ${page} ${p.name}: ` + VARIANTS.map((v) => { const d = rec[v].pairs[i]; return `${v} ${d.rendered} (${d.fg}/${d.bg})`; }).join(' · '))); }
L.push('', 'Rendered text below its threshold (4.5:1; 3:1 for large text), every page and size:');
for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) for (const v of VARIANTS) for (const t of rec[v].text)
  if (t.rendered < (t.large ? 3 : 4.5)) L.push(`  ${page} ${key} ${v} ${t.key} "${t.text}" ${t.size}px/${t.weight}: ${t.rendered} (${t.fg} on ${t.bg})`);
if (S3) { L.push('', 'Perimeter test per focus stop (positions along the intended ring path passing a >= 3:1 focused-vs-unfocused change; corner arcs sampled once each) and ring vs its focused neighbours:');
  for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) { const seen = new Set();
    rec.dark.walk.forEach((s, i) => { const k = s.locator.split(' > ').slice(-2).join(' > ') + (s.selected ? ' [selected]' : '') + ' "' + s.name.slice(0, 22) + '"'; if (seen.has(k)) return; seen.add(k);
      L.push(`  ${page} ${key} ${k}:`);
      for (const v of LIGHT) { const t = rec[v].walk[i]; if (!t || !t.perimeter) { L.push(`      ${v}: no perimeter`); continue; }
        const fn = t.ring.focusedNeighbours;
        L.push(`      ${v}: perimeter ${t.perimeter.shareAtLeast3} (min ${t.perimeter.min}, ${t.perimeter.positions} positions${t.ringHost !== 'self' ? ', ring on ' + t.ringHost : ''}) · ring ${t.ring.ringColour} vs focused neighbours min ${fn ? fn.min : '-'} p05 ${fn ? fn.p05 : '-'} share>=3 ${fn ? fn.shareAtLeast3 : '-'} · 53A adjacency min ${t.ring.adjacentMin} share>=3 ${t.ring.adjacentShareAtLeast3}${t.perimeter.weakest.length ? ' · weakest: ' + t.perimeter.weakest.join('; ') : ''}`); } }); }
  L.push('', 'Resting-state elements whose computed colours differ between light-bm and light-53b (every size):');
  for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) {
    L.push(`  ${page} ${key}: ${rec.changedElements.length} element parts`);
    for (const c of rec.changedElements) L.push(`    ${c.element}: ${c.changes.join('; ')}`); } }
if (S1) { L.push('', 'Elements whose computed colours differ between light-b and light-bm (every size):');
  for (const [page, sizes] of Object.entries(results.pages)) for (const [key, rec] of Object.entries(sizes)) {
    L.push(`  ${page} ${key}: ${rec.changedElements.length} element parts`);
    if (key.startsWith('en')) for (const c of rec.changedElements) L.push(`    ${c.element}: ${c.changes.join('; ')}`); } }
L.push('', `Rendered text, lowest per element key, EN 390x844 @100% (${LIGHT.join(' · ')}):`);
for (const [page, sizes] of Object.entries(results.pages)) { const rec = sizes['en-390x844-100']; const keys = new Map();
  for (const v of LIGHT) for (const t of rec[v].text) { const k = t.key.split(' > ').pop(); const cur = keys.get(k) || {}; if (!cur[v] || t.rendered < cur[v].rendered) cur[v] = t; keys.set(k, cur); }
  for (const [k, o] of keys) L.push(`  ${page} ${k}: ` + LIGHT.map((v) => o[v] ? `${v} ${o[v].rendered} (${o[v].fg}/${o[v].bg})` : `${v} -`).join(' · ')); }
L.push('', 'Screens:', ...shots.map((s) => '  ' + s));
writeFileSync(join(OUT, 'summary.txt'), L.join('\n') + '\n');
console.log(`done: ${OUT}`);
ws.close(); chrome.kill(); process.exit(0);
