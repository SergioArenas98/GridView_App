// Dark state-boundaries EXPERIMENT, Step 51C: pilot ("current") vs candidate.
//
//   node checks.mjs [--out <dir>] [--no-screens]
//
// Dependency-free: Chrome over the DevTools Protocol (software raster, DPR 2,
// mobile + touch), PNG decode with node:zlib (decoder copied from
// ../../consolidation-pilot/tools/visual-compare.mjs, which is only read).
// Chrome emulation only: no Android, no TalkBack, no WCAG compliance claim.
//
// Per pair x language x size (EN/ES, 390x844 @100%, 320x693 @200%):
//  - control: the candidate page with its experiment stylesheets disabled
//    must equal the pilot (DOM, boxes, styles, accessibility tree, pixels);
//  - candidate: identical text, attributes, boxes, accessibility tree and Tab
//    order; every computed-style difference listed; every differing pixel
//    must fall inside an expected region (solid chips, selector, next-event
//    band), viewport by viewport over the whole document;
//  - focus: every Tab stop is captured focused and unfocused at the same
//    scroll position. Ring pixels = pixels that change; the ring colour is
//    the most frequent changed colour; it is measured against every unchanged
//    pixel touching the ring (the pixels actually adjacent to its rendered
//    boundary), and each changed pixel against its own unfocused colour;
//  - chips: each outlined chip's rendered border pixel against the pixel just
//    outside it.
// Owner screenshots (crops) are written for 390x844 EN @100% plus four
// 320x693 @200% stacked-selector crops; nothing else is saved.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const PILOT = resolve(HERE, '../../consolidation-pilot');
const DPR = 2;
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const SCREENS = !argv.includes('--no-screens');
const CROPS_ONLY = argv.includes('--crops-only');   // re-take the owner crops into --out; no checks, no reports
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-51c`));
mkdirSync(join(OUT, 'screens'), { recursive: true });

const PAIRS = [
  { id: 'gp-results', current: 'grand-prix-detail/results', candidates: { candidate: 'gp-results-candidate' } },
  { id: 'gp-states', current: 'grand-prix-detail/states', candidates: { candidate: 'gp-states-candidate' } },
  { id: 'st-index', current: 'standings/index', candidates: { candidate: 'st-index-candidate', mark: 'st-index-candidate-mark' } },
  { id: 'st-states', current: 'standings/states', candidates: { candidate: 'st-states-candidate' } },
  { id: 'cal-index', current: 'index', candidates: { candidate: 'cal-index-candidate' } },
];
const SIZES = [['en', 390, 844, 100], ['es', 390, 844, 100], ['en', 320, 693, 200], ['es', 320, 693, 200]];
const fileOf = (base, lang, inPilot) => (inPilot ? join(PILOT, `${base}${lang === 'en' ? '' : '.es'}.html`) : join(HERE, `${base}${lang === 'en' ? '' : '.es'}.html`));
const EXPECTED = '.chip--scheduled, .chip--outline, .chip--done, .chip--provisional, .seg, .ev--next';
const ALLOWED_STYLE = /^(border-(top|right|bottom|left|block-start|block-end|inline-start|inline-end)-color|background-image|background-color|text-decoration-(line|thickness|skip-ink|color|style)|text-decoration|text-underline-offset|-webkit-text-decorations-in-effect|--x-line-status(-on-chalk)?)$/;

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

// ---------- Colour ----------
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(...a), lum(...b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const r2 = (v) => Math.round(v * 100) / 100;

// ---------- Chrome ----------
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9600 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-51c-'))}`,
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
async function open(path, w, h, scale, control = false) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  pageUrl = pathToFileURL(path).href;
  await send('Page.navigate', { url: pageUrl });
  await sleep(400);
  await evalJs(`new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r))`);
  await evalJs('document.fonts.ready.then(() => true)');
  if (control) await evalJs(`[...document.querySelectorAll('link[href^="candidate"]')].forEach((l) => { l.disabled = true; }); true`);
  if (scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
  // Fit scripts listen to resize; nudge them after the root scale like a settled frame.
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

// ---------- In-page snapshot ----------
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
  return lines.join('\n').split(page).join('<page>');
}
function compareSnap(a, b) {
  const hard = [], styles = new Map();
  if (a.nodes.length !== b.nodes.length) hard.push(`element count ${a.nodes.length} vs ${b.nodes.length}`);
  a.nodes.forEach((n, i) => { const m = b.nodes[i]; if (!m) return;
    if (n.path !== m.path) { hard.push(`element ${i}: ${n.path} vs ${m.path}`); return; }
    if (n.text !== m.text) hard.push(`text ${n.path}`);
    if (JSON.stringify(n.attrs) !== JSON.stringify(m.attrs)) hard.push(`attrs ${n.path}: ${JSON.stringify(n.attrs)} vs ${JSON.stringify(m.attrs)}`);
    if (n.box.join() !== m.box.join()) hard.push(`box ${n.path}: ${n.box} vs ${m.box}`);
    for (const part of ['style', '::before', '::after']) { const s = n[part] || {}, t = m[part] || {};
      if (!!n[part] !== !!m[part]) { hard.push(`${part} presence ${n.path}`); continue; }
      for (const p of new Set([...Object.keys(s), ...Object.keys(t)])) if (s[p] !== t[p]) {
        const leaf = n.path.split('/').pop().replace(/:\d+$/, '');
        const key = `${leaf}${part === 'style' ? '' : part} ${p}: ${s[p] ?? '(unset)'} -> ${t[p] ?? '(unset)'}`;
        if (!ALLOWED_STYLE.test(p)) hard.push(`style ${n.path}${part === 'style' ? '' : part} ${p}`);
        else if (!p.startsWith('--')) styles.set(key, (styles.get(key) || 0) + 1);
      } } });
  for (const k of ['docHeight', 'stops', 'disabled']) if (a[k] !== b[k]) hard.push(`${k} ${a[k]} vs ${b[k]}`);
  if (JSON.stringify(a.fit) !== JSON.stringify(b.fit)) hard.push(`fit ${JSON.stringify(a.fit)} vs ${JSON.stringify(b.fit)}`);
  if (JSON.stringify(a.quality) !== JSON.stringify(b.quality)) hard.push('quality metrics differ');
  return { hard, styles: [...styles].map(([k, n]) => `${k} (x${n})`) };
}

// ---------- Whole-document pixels, viewport by viewport ----------
async function viewportShots(h) {
  const doc = await evalJs('document.documentElement.scrollHeight');
  const step = h - 80, n = Math.max(1, Math.ceil((doc - 80) / step)); const out = [];
  for (let i = 0; i < n; i++) {
    await evalJs(`window.scrollTo(0, ${i * step}); true`); await sleep(120); await frames();
    const regions = await evalJs(`[...document.querySelectorAll(${JSON.stringify(EXPECTED)})].map((e) => { const r = e.getBoundingClientRect(); return [r.left - 2, r.top - 2, r.right + 2, r.bottom + 2]; })`);
    out.push({ png: await shot(), regions, scrollY: await evalJs('scrollY') });
  }
  return out;
}
function pixelCompare(A, B) {
  let diff = 0, unexpected = 0; const boxes = [];
  if (A.length !== B.length) return { error: `shot count ${A.length} vs ${B.length}` };
  A.forEach((sa, k) => {
    const a = decodePng(sa.png), b = decodePng(B[k].png), regions = B[k].regions.map((r) => r.map((v) => v * DPR));
    if (a.w !== b.w || a.h !== b.h) { unexpected += 1e6; return; }
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < a.px.length; i += 4) {
      if (a.px[i] === b.px[i] && a.px[i + 1] === b.px[i + 1] && a.px[i + 2] === b.px[i + 2]) continue;
      diff++; const q = i / 4, x = q % a.w, y = (q - x) / a.w;
      if (!regions.some(([l, t, r, bt]) => x >= l && x <= r && y >= t && y <= bt)) { unexpected++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    if (x1 >= 0) boxes.push({ shot: k + 1, scrollY: sa.scrollY, bboxCss: [x0, y0, x1, y1].map((v) => r2(v / DPR)) });
  });
  return { shots: A.length, diffPixels: diff, unexpectedPixels: unexpected, unexpectedBoxes: boxes };
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
    w: r.width, h: r.height, selected: e.getAttribute('aria-pressed') === 'true' }; })()`;
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
  return { changedPx: changed.size, ringColour: hex(ring), adjacentSamples: adj.length, adjacentMin: r2(adj[0]), adjacentP05: r2(adj[Math.floor(adj.length * 0.05)]),
    adjacentShareAtLeast3: r2(adj.filter((v) => v >= 3).length / adj.length), changedShareAtLeast3: r2(strongChange / changed.size),
    lowNeighbours: [...neighbours].sort((p, q) => q[1] - p[1]).slice(0, 4).map(([k, n]) => `${k} x${n} (${r2(ratio(ring, [1, 3, 5].map((i) => parseInt(k.slice(i, i + 2), 16))))})`) };
}
async function keyboardWalk(stops, vw, vh, keepFor) {
  const out = [];
  await evalJs('window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); true'); await frames();
  for (let i = 0; i < stops; i++) {
    await pressTab(); await frames();
    const a = await evalJs(ACTIVE);
    if (!a) { out.push({ stop: i + 1, element: null }); continue; }
    const focused = await shot();
    await evalJs('window.__gvFocus = document.activeElement; document.activeElement.blur(); true'); await frames();
    const unfocused = await shot();
    await evalJs('window.__gvFocus.focus({ preventScroll: true }); true'); await frames();
    const back = await evalJs('document.activeElement === window.__gvFocus && window.__gvFocus.matches(":focus-visible")');
    const rec = { stop: i + 1, locator: a.locator, name: a.name, selected: a.selected, focusVisible: a.focusVisible, refocusVisible: back, outline: a.outline,
      target: [r2(a.w), r2(a.h)], ring: ringStats(focused, unfocused, a.rect, vw, vh) };
    if (keepFor) keepFor(rec, focused, unfocused, a.rect);
    out.push(rec);
  }
  return out;
}

// ---------- Chip borders, rendered ----------
const CHIPS = `[...document.querySelectorAll('.chip--scheduled, .chip--outline, .chip--done, .chip--provisional, .chip--unknown, .chip--alert')].filter((e) => e.getBoundingClientRect().width > 0)`;
async function chipBorders(limit = 40) {
  const n = await evalJs(`${CHIPS}.length`); const out = [];
  for (let i = 0; i < Math.min(n, limit); i++) {
    const info = await evalJs(`(() => { const e = ${CHIPS}[${i}]; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return { cls: [...e.classList].filter((c) => c !== 'chip').join(' '), text: e.textContent.trim(), onChalk: !!e.closest('.st--leader'), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
        bw: parseFloat(cs.borderLeftWidth), style: cs.borderLeftStyle, color: cs.borderLeftColor }; })()`);
    await frames();
    const pad = 6, png = decodePng(await shot({ x: info.x - pad, y: info.y, width: info.w + pad * 2, height: info.h }));
    const xb = Math.round((pad + info.bw / 2) * DPR), xo = Math.round(pad * DPR) - 3, rows = [];
    for (let y = Math.round(png.h * 0.2); y < Math.round(png.h * 0.8); y++) rows.push(y);
    const px = (x, y) => { const o = (y * png.w + x) * 4; return [png.px[o], png.px[o + 1], png.px[o + 2]]; };
    // The border column with the strongest median contrast among xb-2..xb+2 (sub-pixel chip positions).
    let pairs = [];
    for (let dx = -2; dx <= 2; dx++) {
      const cand = rows.map((y) => [px(xb + dx, y), px(xo, y)]).map(([bd, out]) => ({ bd, out, cr: ratio(bd, out) })).sort((p, q) => p.cr - q.cr);
      if (!pairs.length || cand[Math.floor(cand.length / 2)].cr > pairs[Math.floor(pairs.length / 2)].cr) pairs = cand;
    }
    const pick = info.style === 'dashed' ? pairs[pairs.length - 1] : pairs[Math.floor(pairs.length / 2)];   // dashed: a painted dash, not a gap
    out.push({ ...info, x: undefined, y: undefined, borderPx: hex(pick.bd), outsidePx: hex(pick.out), rendered: r2(pick.cr) });
  }
  return out;
}

// ---------- Owner crops ----------
const shots = [];
async function cropEl(name, sel, opts = {}) {
  if (!SCREENS) return;
  const r = await evalJs(`(() => { const e = ${sel}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: 0, y: Math.max(0, b.top + scrollY - ${opts.above ?? 12}), w: document.documentElement.clientWidth, h: b.height + ${(opts.above ?? 12) + (opts.below ?? 12)} }; })()`);
  if (!r) throw new Error(`crop: nothing for ${name}`);
  await frames();
  writeFileSync(join(OUT, 'screens', `${name}.png`), await shot({ x: r.x, y: r.y, width: r.w, height: r.h }));
  shots.push(`screens/${name}.png`);
}
const frame = (n) => `[...document.querySelectorAll('section.spec')].find((s) => s.querySelector('.spec__title').textContent.trim().startsWith('${n}.')).querySelector('.spec__frame')`;
// Standings top: from the selector down to the end of the first leader row (pinned header kept out of the crop).
async function cropStTop(name) {
  if (!SCREENS) return;
  const r = await evalJs(`(() => { const s = document.querySelector('.seg'), l = document.querySelector('section:not([hidden]) .st--leader'); const a = s.getBoundingClientRect(), b = l.getBoundingClientRect();
    return { y: a.top + scrollY - 10, h: b.bottom - a.top + 22, w: document.documentElement.clientWidth }; })()`);
  writeFileSync(join(OUT, 'screens', `${name}.png`), await shot({ x: 0, y: r.y, width: r.w, height: r.h }));
  shots.push(`screens/${name}.png`);
}
async function focusTo(sel) {   // keyboard only: Tab until the element is focused
  await evalJs('window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); true');
  for (let i = 0; i < 40; i++) { await pressTab(); if (await evalJs(`document.activeElement === document.querySelector(${JSON.stringify(sel)})`)) { await frames(); return i + 1; } }
  throw new Error(`focusTo: never reached ${sel}`);
}

// ---------- Runs ----------
const results = { generated: new Date().toISOString(), browser: browser.product, dpr: DPR, raster: 'software',
  note: 'Chrome emulation only (root font-size for 200%, zero insets). No Android, no TalkBack, no WCAG compliance claim.', pairs: {} };
for (const pair of CROPS_ONLY ? [] : PAIRS) {
  results.pairs[pair.id] = {};
  for (const [lang, w, h, scale] of SIZES) {
    const key = `${lang}-${w}x${h}-${scale}`; const rec = {};
    await open(fileOf(pair.current, lang, true), w, h, scale);
    const cur = { snap: await evalJs(SNAPSHOT), ax: await axTree() };
    cur.pixels = await viewportShots(h);
    cur.walk = await keyboardWalk(cur.snap.stops, w, h);
    cur.chips = await chipBorders();
    rec.current = { stops: cur.snap.stops, fit: cur.snap.fit, quality: cur.snap.quality, disabled: cur.snap.disabled, walk: cur.walk, chips: cur.chips };
    for (const [label, base] of Object.entries(pair.candidates)) {
      // control: experiment stylesheets disabled, must equal the pilot
      await open(fileOf(base, lang, false), w, h, scale, true);
      const csnap = await evalJs(SNAPSHOT), cax = await axTree(), cpx = await viewportShots(h);
      const cc = compareSnap(cur.snap, csnap), cp = pixelCompare(cur.pixels, cpx);
      rec[`control-${label}`] = { identical: !cc.hard.length && !cc.styles.length && cax === cur.ax && cp.diffPixels === 0, hard: cc.hard, styles: cc.styles, axIdentical: cax === cur.ax, pixels: cp };
      // candidate
      await open(fileOf(base, lang, false), w, h, scale);
      const snap = await evalJs(SNAPSHOT), ax = await axTree(), px = await viewportShots(h);
      const c = compareSnap(cur.snap, snap), p = pixelCompare(cur.pixels, px);
      const walk = await keyboardWalk(snap.stops, w, h), chips = await chipBorders();
      const order = (x) => JSON.stringify(x.map((s) => [s.locator, s.name]));
      rec[label] = { hardDiffs: c.hard, styleDiffs: c.styles, axIdentical: ax === cur.ax, pixels: p, tabOrderIdentical: order(walk) === order(cur.walk),
        focusAlwaysVisible: walk.every((s) => s.focusVisible && s.ring.changedPx > 0), targetsUnchanged: JSON.stringify(walk.map((s) => s.target)) === JSON.stringify(cur.walk.map((s) => s.target)),
        fit: snap.fit, walk, chips };
      if (!rec[label].axIdentical) rec[label].axDiff = { current: cur.ax, candidate: ax };
    }
    results.pairs[pair.id][key] = rec;
    console.log(pair.id, key, Object.keys(pair.candidates).map((l) => `${l}: hard ${rec[l].hardDiffs.length} ax ${rec[l].axIdentical} px ${rec[l].pixels.diffPixels}/${rec[l].pixels.unexpectedPixels} tab ${rec[l].tabOrderIdentical} control ${rec[`control-${l}`].identical}`).join(' | '));
  }
}

// ---------- Owner screenshots ----------
const variants = (pair) => [['current', fileOf(pair.current, 'en', true)], ...Object.entries(pair.candidates).map(([l, b]) => [l === 'candidate' ? 'candidate' : 'candidate-mark', fileOf(b, 'en', false)])];
const byId = Object.fromEntries(PAIRS.map((p) => [p.id, p]));
for (const [v, f] of variants(byId['gp-results'])) { await open(f, 390, 844, 100); await cropEl(`A1-gp-results-dnf-${v}-en-390`, `document.querySelector('.chip--outline').closest('ol')`); }
for (const [v, f] of variants(byId['gp-states'])) { await open(f, 390, 844, 100);
  await cropEl(`A1-gp-states-25-vocabulary-${v}-en-390`, frame(25)); await cropEl(`A1-gp-states-22-finish-${v}-en-390`, frame(22)); await cropEl(`A1-gp-states-04-upcoming-${v}-en-390`, frame(4)); }
for (const [v, f] of variants(byId['st-states'])) { await open(f, 390, 844, 100); await cropEl(`A1-st-states-08-leader-marker-${v}-en-390`, frame(8)); }
for (const [v, f] of variants(byId['st-index'])) { await open(f, 390, 844, 100);
  await cropStTop(`A2-st-top-rest-${v}-en-390`);
  await focusTo('.seg__btn[aria-pressed="true"]'); await cropStTop(`A3-st-top-focus-selected-${v}-en-390`);
  await focusTo('.seg__btn[aria-pressed="false"]'); await cropStTop(`A3-st-top-focus-unselected-${v}-en-390`);
  if (v !== 'candidate-mark') { await focusTo('section:not([hidden]) .st--leader .st__link'); await cropStTop(`A3-st-top-focus-leader-${v}-en-390`); } }
for (const [v, f] of variants(byId['cal-index'])) { await open(f, 390, 844, 100);
  await cropEl(`A2-cal-next-rest-${v}-en-390`, `document.querySelector('.ev--next')`);
  await focusTo('.ev--next .ev__link'); await cropEl(`A3-cal-next-focus-${v}-en-390`, `document.querySelector('.ev--next')`); }
for (const lang of ['en', 'es']) for (const [v, f] of [['current', fileOf('standings/index', lang, true)], ['candidate-mark', fileOf('st-index-candidate-mark', lang, false)]]) {
  await open(f, 320, 693, 200); await focusTo('.seg__btn[aria-pressed="true"]'); await cropStTop(`A3-st-top-focus-selected-${v}-${lang}-320-200`); }
if (CROPS_ONLY) { console.log(`crops only: ${shots.length} screens in ${OUT}`); ws.close(); chrome.kill(); process.exit(0); }
results.screens = shots; results.unstableFrames = unstable;
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1));

// ---------- Summary ----------
const L = [`Dark state boundaries (Step 51C) - ${results.generated}`, `${results.browser} · DPR ${DPR} · software raster · unstable frames ${unstable}`, results.note, ''];
for (const [id, sizes] of Object.entries(results.pairs)) for (const [key, rec] of Object.entries(sizes)) {
  for (const l of Object.keys(byId[id].candidates)) { const c = rec[l], k = rec[`control-${l}`];
    L.push(`${id} ${key} ${l}: control identical ${k.identical} · hard diffs ${c.hardDiffs.length} · ax identical ${c.axIdentical} · pixels ${c.pixels.diffPixels} differing, ${c.pixels.unexpectedPixels} outside expected regions · tab order identical ${c.tabOrderIdentical} (${c.walk.length} stops) · focus always visible ${c.focusAlwaysVisible} · targets unchanged ${c.targetsUnchanged} · fit ${JSON.stringify(c.fit)} · quality ${JSON.stringify(rec.current.quality) === '{"hScroll":false,"outside":[],"clipped":[],"spill":[],"small":[]}' ? 'clean' : JSON.stringify(rec.current.quality)}`);
    if (c.hardDiffs.length) L.push('    HARD ' + c.hardDiffs.slice(0, 6).join(' | '));
    if (k.hard.length || k.styles.length || !k.axIdentical || k.pixels.diffPixels) L.push('    CONTROL ' + JSON.stringify({ hard: k.hard.slice(0, 4), styles: k.styles.slice(0, 4), ax: k.axIdentical, px: k.pixels.diffPixels }));
    if (key === 'en-390x844-100') { L.push('    style differences:'); for (const s of c.styleDiffs) L.push('      ' + s); } } }
L.push('', 'Focus rings below 3:1 against adjacent pixels (adjacentMin), every page and size:');
for (const [id, sizes] of Object.entries(results.pairs)) for (const [key, rec] of Object.entries(sizes)) for (const v of ['current', ...Object.keys(byId[id].candidates)]) {
  for (const s of rec[v].walk) if (s.ring && s.ring.changedPx && s.ring.adjacentMin < 3) L.push(`  ${id} ${key} ${v} stop ${s.stop} ${s.locator} "${s.name}": ring ${s.ring.ringColour} min ${s.ring.adjacentMin} p05 ${s.ring.adjacentP05} share>=3 ${s.ring.adjacentShareAtLeast3} changed>=3 ${s.ring.changedShareAtLeast3} low ${s.ring.lowNeighbours.join(', ')}`);
}
L.push('', 'Stops where the measured ring colour is not the declared outline colour (ring hidden, e.g. under the fixed navigation), every page and size:');
const declared = (o) => { const m = o.match(/rgb\((\d+), (\d+), (\d+)\)/); return m ? hex([+m[1], +m[2], +m[3]]) : null; };
for (const [id, sizes] of Object.entries(results.pairs)) for (const [key, rec] of Object.entries(sizes)) for (const v of ['current', ...Object.keys(byId[id].candidates)]) {
  const hid = rec[v].walk.filter((s) => s.ring && s.ring.changedPx && s.ring.ringColour !== declared(s.outline));
  if (hid.length) L.push(`  ${id} ${key} ${v}: stops ${hid.map((s) => s.stop + ' (' + s.name.slice(0, 24) + ')').join(', ')}`);
}
L.push('', 'Selector and next-event focus, 390x844 EN @100%:');
for (const id of ['st-index', 'cal-index']) for (const v of ['current', ...Object.keys(byId[id].candidates)]) for (const s of results.pairs[id]['en-390x844-100'][v].walk.filter((x) => x.stop >= 3 && x.stop <= 6))
  L.push(`  ${id} ${v} ${s.locator} "${s.name}" target ${s.target.join('x')}: ring ${s.ring.ringColour} adjacent min ${s.ring.adjacentMin} p05 ${s.ring.adjacentP05} share>=3 ${s.ring.adjacentShareAtLeast3} · changed>=3 ${s.ring.changedShareAtLeast3}`);
L.push('', 'Rendered chip borders (border pixel vs pixel outside), 390x844 EN @100%:');
for (const id of ['gp-results', 'gp-states', 'st-states', 'cal-index']) for (const v of ['current', 'candidate']) {
  const seen = new Set();
  for (const c of results.pairs[id]['en-390x844-100'][v].chips) { const k = `${c.cls}|${c.text}|${c.onChalk}`; if (seen.has(k)) continue; seen.add(k);
    L.push(`  ${id} ${v.padEnd(9)} ${c.cls.padEnd(24)} "${c.text}"${c.onChalk ? ' (Chalk row)' : ''}: ${c.style} ${c.borderPx} on ${c.outsidePx} = ${c.rendered}`); } }
L.push('', `Screens (${shots.length}):`, ...shots.map((s) => '  ' + s));
writeFileSync(join(OUT, 'summary.txt'), L.join('\n') + '\n');
console.log(`wrote ${OUT} (${shots.length} screens)`);
ws.close(); chrome.kill();
process.exit(0);
