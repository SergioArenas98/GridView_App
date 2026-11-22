// Dark state-boundaries EXPERIMENT, Step 51C.1: focused comparisons only.
//
//   node checks-51c1.mjs [--out <dir>] [--no-screens]
//
// Harness copied from checks.mjs (same Chrome flags, PNG decoder, snapshot,
// pixel, keyboard-walk and ring measurements). Reference = the 51C candidate
// page (approved A1 + flat oxide + Chalk ring on selected oxide); variants =
// the "-refine" pages. Control: a refine page with refine-*.css disabled must
// equal its 51C candidate page (no regression to A1 / A2).
// Added here: ring continuity. Along the ring's intended centre line (from
// the computed outline width and offset), the share of points drawn in the
// ring colour, per edge, inside the viewport. Chrome emulation only: no
// Android, no TalkBack, no WCAG compliance claim.
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
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-51c1`));
mkdirSync(join(OUT, 'screens'), { recursive: true });

const PAIRS_51C = [
  { id: 'gp-results', current: 'grand-prix-detail/results', candidates: { candidate: 'gp-results-candidate' } },
  { id: 'gp-states', current: 'grand-prix-detail/states', candidates: { candidate: 'gp-states-candidate' } },
  { id: 'st-index', current: 'standings/index', candidates: { candidate: 'st-index-candidate', mark: 'st-index-candidate-mark' } },
  { id: 'st-states', current: 'standings/states', candidates: { candidate: 'st-states-candidate' } },
  { id: 'cal-index', current: 'index', candidates: { candidate: 'cal-index-candidate' } },
];
const SIZES = [['en', 390, 844, 100], ['en', 320, 693, 200], ['es', 320, 693, 200]];
const fileOf = (base, lang, inPilot) => (inPilot ? join(PILOT, `${base}${lang === 'en' ? '' : '.es'}.html`) : join(HERE, `${base}${lang === 'en' ? '' : '.es'}.html`));
let EXPECTED = '';
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
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-51c1-'))}`,
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
  if (control) await evalJs(`[...document.querySelectorAll('link[href^="refine"]')].forEach((l) => { l.disabled = true; }); true`);
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
    const regions = !EXPECTED ? [] : await evalJs(`[...document.querySelectorAll(${JSON.stringify(EXPECTED)})].map((e) => { const r = e.getBoundingClientRect(); return [r.left - 2, r.top - 2, r.right + 2, r.bottom + 2]; })`);
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


// ---------- Ring continuity along the intended boundary ----------
const declaredHex = (o) => { const m = o.match(/rgb\((\d+), (\d+), (\d+)\)/); return m ? [+m[1], +m[2], +m[3]] : null; };
function ringCoverage(fPng, uPng, a, vw, vh) {
  const f = decodePng(fPng), u = decodePng(uPng), W = f.w, ring = declaredHex(a.outline);
  const m = a.outline.match(/ ([\d.]+)px rgb.* offset (-?[\d.]+)px/); if (!m || !ring) return null;
  const d = +m[2] + +m[1] / 2, [L, T, R, B] = a.rect, x0 = L - d, x1 = R + d, y0 = T - d, y1 = B + d, c = 7;
  const edges = { top: [], right: [], bottom: [], left: [] };
  for (let x = x0 + c; x <= x1 - c; x += 0.5) { edges.top.push([x, y0]); edges.bottom.push([x, y1]); }
  for (let y = y0 + c; y <= y1 - c; y += 0.5) { edges.left.push([x0, y]); edges.right.push([x1, y]); }
  const out = {}; let all = 0, ok = 0;
  for (const [k, pts] of Object.entries(edges)) {
    let n = 0, v = 0;
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      const px = Math.floor(x * DPR), py = Math.floor(y * DPR), o = (py * W + px) * 4; n++;
      const fc = [f.px[o], f.px[o + 1], f.px[o + 2]], uc = [u.px[o], u.px[o + 1], u.px[o + 2]];
      if ((fc[0] !== uc[0] || fc[1] !== uc[1] || fc[2] !== uc[2]) && ratio(fc, ring) < 1.15) v++;
    }
    out[k] = n ? r2(v / n) : null; all += n; ok += v;
  }
  return { colour: hex(ring), inViewport: all, drawn: all ? r2(ok / all) : null, edges: out };
}
async function walkWithCoverage(stops, vw, vh) {
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
    out.push({ stop: i + 1, locator: a.locator, name: a.name, selected: a.selected, focusVisible: a.focusVisible, outline: a.outline, target: [r2(a.w), r2(a.h)],
      ring: ringStats(focused, unfocused, a.rect, vw, vh), coverage: ringCoverage(focused, unfocused, a, vw, vh) });
  }
  return out;
}

// ---------- Selection cue geometry (refine-cue pages) ----------
const CUE = `(() => { const tan = Math.tan(12 * Math.PI / 180); return [...document.querySelectorAll('.seg__btn')].map((b) => {
  const r = b.getBoundingClientRect(), lab = b.querySelector('.seg__label'), rg = document.createRange(); rg.selectNodeContents(lab);
  const t = [...rg.getClientRects()].filter((x) => x.width > 0), cs = getComputedStyle(b, '::after'), on = cs.content !== 'none' && cs.content !== 'normal';
  const top = parseFloat(cs.top), bottom = parseFloat(cs.bottom), h = r.height - top - bottom, cueRight = r.left + parseFloat(cs.left) + parseFloat(cs.width) + tan * h / 2;
  return { label: lab.textContent, pressed: b.getAttribute('aria-pressed'), h: Math.round(r.height * 100) / 100, w: Math.round(r.width * 100) / 100, cue: on,
    cueHeight: on ? Math.round(h * 100) / 100 : null, gapToText: on ? Math.round((Math.min(...t.map((x) => x.left)) - cueRight) * 100) / 100 : null,
    ringClearance: on ? Math.round((parseFloat(cs.left) - tan * h / 2 - 3) * 100) / 100 : null, lines: new Set(t.map((x) => Math.round(x.top))).size }; }); })()`;

// ---------- Runs ----------
const PAIRS = [
  { id: 'st-index', base: 'st-index-candidate', variants: { refine: ['st-index-refine', ''], cue: ['st-index-refine-cue', '.seg'] } },
  { id: 'cal-index', base: 'cal-index-candidate', variants: { refine: ['cal-index-refine', ''] } },
  { id: 'gp-results', base: 'gp-results-candidate', variants: { refine: ['gp-results-refine', ''] } },
];
const results = { generated: new Date().toISOString(), browser: browser.product, dpr: DPR, raster: 'software',
  note: 'Chrome emulation only (root font-size for 200%, zero insets). No Android, no TalkBack, no WCAG compliance claim.', pairs: {} };
for (const pair of PAIRS) {
  results.pairs[pair.id] = {};
  for (const [lang, w, h, scale] of SIZES) {
    const key = `${lang}-${w}x${h}-${scale}`, rec = {};
    EXPECTED = '';
    await open(fileOf(pair.base, lang, false), w, h, scale);
    const base = { snap: await evalJs(SNAPSHOT), ax: await axTree() };
    base.pixels = await viewportShots(h);
    base.walk = await walkWithCoverage(base.snap.stops, w, h);
    rec.base = { page: pair.base, fit: base.snap.fit, quality: base.snap.quality, walk: base.walk };
    for (const [label, [file, expected]] of Object.entries(pair.variants)) {
      EXPECTED = expected;
      await open(fileOf(file, lang, false), w, h, scale, true);
      const cs = await evalJs(SNAPSHOT), cax = await axTree(), cpx = await viewportShots(h);
      const cc = compareSnap(base.snap, cs), cp = pixelCompare(base.pixels, cpx);
      rec[`control-${label}`] = { identical: !cc.hard.length && !cc.styles.length && cax === base.ax && cp.diffPixels === 0 };
      await open(fileOf(file, lang, false), w, h, scale);
      const snap = await evalJs(SNAPSHOT), ax = await axTree(), px = await viewportShots(h);
      const c = compareSnap(base.snap, snap), p = pixelCompare(base.pixels, px);
      const walk = await walkWithCoverage(snap.stops, w, h);
      const order = (x) => JSON.stringify(x.map((s) => [s.locator, s.name]));
      rec[label] = { page: file, hardDiffs: c.hard, styleDiffs: c.styles, axIdentical: ax === base.ax, pixels: p, tabOrderIdentical: order(walk) === order(base.walk),
        targetsUnchanged: JSON.stringify(walk.map((s) => s.target)) === JSON.stringify(base.walk.map((s) => s.target)), fit: snap.fit, quality: snap.quality, walk };
      if (label === 'cue') {
        await open(fileOf(file, lang, false), w, h, scale); const drivers = await evalJs(CUE);
        await evalJs(`document.querySelector('.seg__btn[aria-pressed="false"]').click(); true`); await sleep(300); await frames();
        rec.cueGeometry = { defaultSelection: drivers, otherSelected: await evalJs(CUE), fitAfterSwitch: await evalJs(`document.querySelector('.seg').dataset.fit || 'regular'`) };
        await open(fileOf(pair.base, lang, false), w, h, scale); await evalJs(`document.querySelector('.seg__btn[aria-pressed="false"]').click(); true`); await sleep(300); await frames();
        rec.cueGeometry.baseFitAfterSwitch = await evalJs(`document.querySelector('.seg').dataset.fit || 'regular'`);
        rec.cueGeometry.baseHeights = await evalJs(`[...document.querySelectorAll('.seg__btn')].map((b) => Math.round(b.getBoundingClientRect().height * 100) / 100)`);
      }
    }
    results.pairs[pair.id][key] = rec;
    console.log(pair.id, key, Object.keys(pair.variants).map((l) => `${l}: control ${rec[`control-${l}`].identical} hard ${rec[l].hardDiffs.length} ax ${rec[l].axIdentical} px ${rec[l].pixels.diffPixels}/${rec[l].pixels.unexpectedPixels} tab ${rec[l].tabOrderIdentical}`).join(' | '));
  }
}

// ---------- Owner crops (small set) ----------
const save = async (name, sel) => { if (SCREENS) await cropEl(name, sel); };
for (const [v, f] of [['flat', 'st-index-refine'], ['cue', 'st-index-refine-cue']]) {
  for (const [lang, w, h, scale] of SIZES) { await open(fileOf(f, lang, false), w, h, scale); await save(`C1-selector-${v}-rest-${lang}-${w === 390 ? '390' : '320-200'}`, `document.querySelector('.seg')`); }
  await open(fileOf(f, 'en', false), 390, 844, 100);
  await send('Emulation.setEmulatedVisionDeficiency', { type: 'achromatopsia' }); await frames();
  await save(`C1-selector-${v}-achromatopsia-en-390`, `document.querySelector('.seg')`);
  await send('Emulation.setEmulatedVisionDeficiency', { type: 'none' }); await frames();
}
await open(fileOf('st-index-refine', 'en', false), 390, 844, 100);
await focusTo('.seg__btn[aria-pressed="true"]'); await save('C2-selector-focus-selected-chalk-en-390', `document.querySelector('.seg')`);
await focusTo('.seg__btn[aria-pressed="false"]'); await save('C3-selector-focus-unselected-chalk-en-390', `document.querySelector('.seg')`);
await open(fileOf('cal-index-refine', 'en', false), 390, 844, 100);
await focusTo('.ev--next .ev__link'); await save('C4-cal-next-focus-fixed-en-390', `document.querySelector('.ev--next')`);
for (const [v, f] of [['before', 'gp-results-candidate'], ['fixed', 'gp-results-refine']]) {
  await open(fileOf(f, 'en', false), 390, 844, 100);
  await focusTo('.cl--winner .cl__hit'); await save(`C5-gp-winner-focus-${v}-en-390`, `document.querySelector('.cl--winner')`);
}
results.screens = shots; results.unstableFrames = unstable;
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1));

// ---------- Summary ----------
const L = [`Dark state boundaries, Step 51C.1 focused checks - ${results.generated}`, `${results.browser} · DPR ${DPR} · software raster · unstable frames ${unstable}`, results.note, ''];
const fmtRing = (s) => `${s.ring.ringColour || '-'} adj min ${s.ring.adjacentMin ?? '-'} share>=3 ${s.ring.adjacentShareAtLeast3 ?? '-'} changed>=3 ${s.ring.changedShareAtLeast3 ?? '-'} · drawn ${s.coverage ? s.coverage.drawn : '-'} ${s.coverage ? JSON.stringify(s.coverage.edges) : ''}`;
for (const [id, sizes] of Object.entries(results.pairs)) for (const [key, rec] of Object.entries(sizes)) {
  const variants = Object.keys(PAIRS.find((p) => p.id === id).variants);
  for (const l of variants) { const c = rec[l];
    L.push(`${id} ${key} ${l} (${c.page} vs ${rec.base.page}): control identical ${rec[`control-${l}`].identical} · hard diffs ${c.hardDiffs.length} · ax identical ${c.axIdentical} · pixels at rest ${c.pixels.diffPixels} differing, ${c.pixels.unexpectedPixels} outside expected · tab order identical ${c.tabOrderIdentical} (${c.walk.length} stops) · targets unchanged ${c.targetsUnchanged} · fit ${JSON.stringify(c.fit)} · quality ${JSON.stringify(c.quality) === '{"hScroll":false,"outside":[],"clipped":[],"spill":[],"small":[]}' ? 'clean' : JSON.stringify(c.quality)}`);
    if (c.hardDiffs.length) L.push('    HARD ' + c.hardDiffs.slice(0, 6).join(' | '));
    for (const s of c.styleDiffs) L.push('    style ' + s);
  }
  const pick = (w) => w.filter((s) => s.locator && (/seg__btn|cl__hit/.test(s.locator) || /^(Round 23|Ronda 23)/.test(s.name || '')));
  for (const v of ['base', ...variants]) for (const s of pick(rec[v].walk).slice(0, 4))
    L.push(`  ${key} ${v.padEnd(6)} stop ${s.stop} ${s.locator.split(' > ').slice(-2).join(' > ')} "${(s.name || '').slice(0, 40)}": ${fmtRing(s)}`);
  if (rec.cueGeometry) L.push(`  ${key} cue geometry: ${JSON.stringify(rec.cueGeometry)}`);
}
L.push('', `Screens (${shots.length}):`, ...shots.map((s) => '  ' + s));
writeFileSync(join(OUT, 'summary.txt'), L.join('\n') + '\n');
console.log(`wrote ${OUT} (${shots.length} screens)`);
ws.close(); chrome.kill();
process.exit(0);
