// Notice coexistence EXPERIMENT (Step 49D.1): measurements and a small,
// representative screenshot set. Read-only for every source; writes only
// into a new validation-<stamp>-experiment/ folder here.
//
//   node checks.mjs [--out <dir>] [--no-screens]
//
// Harness (Chrome flags, software raster, DPR 2, CDP over WebSocket, no
// dependencies) copied from ../calendar-stage1/stage1-checks.mjs. Chrome
// emulation only: no Android system bars (safe-area insets 0), no TalkBack.
// Live-region figures count HTML role="status" nodes: a PLACEHOLDER for the
// Flutter semantics, not an announcement measurement.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VIEWPORTS = [[390, 844, 100], [320, 693, 200], [693, 320, 200]];
const LANGS = ['en', 'es'];
const DPR = 2;
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const SCREENS = !argv.includes('--no-screens');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const OUT = resolve(outArg >= 0 ? argv[outArg + 1] : join(HERE, `validation-${stamp}-experiment`));
mkdirSync(join(OUT, 'screens'), { recursive: true });

// ---------- Chrome ----------
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gv-nc-'))}`,
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
for (const d of ['Page', 'Runtime']) await send(`${d}.enable`);
const frames = () => evalJs('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r(true), 120))))');

async function viewport(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true }); await frames(); }
async function open(file, query, [w, h, scale], { scaleAfterLoad = false } = {}) {
  await viewport(w, h);
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const q = new URLSearchParams(query);
  if (!scaleAfterLoad && scale !== 100) q.set('scale', String(scale));
  const qs = q.toString();
  await send('Page.navigate', { url: pathToFileURL(join(HERE, file)).href + (qs ? `?${qs}` : '') });
  await sleep(400);
  await evalJs(`new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r))`);
  await evalJs('document.fonts.ready.then(() => true)');
  if (scaleAfterLoad && scale !== 100) await evalJs(`document.documentElement.style.fontSize = '${scale}%'; true`);
  await sleep(450); await frames();
}
const shots = [];
async function shot(name) {
  if (!SCREENS) return;
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, 'screens', `${name}.png`), Buffer.from(data, 'base64'));
  shots.push(`screens/${name}.png`);
}
const vpName = ([w, h, s]) => `${w}x${h}-${s}`;

// ---------- In-page measurements ----------
const Q = 'const q = (v) => Math.round(v * 100) / 100;';
const CAL = `(() => { ${Q}
  const de = document.documentElement, H = innerHeight;
  const hdr = document.querySelector('.appbar--sticky').getBoundingClientRect(), nav = document.querySelector('.tabbar').getBoundingClientRect();
  const top = Math.max(0, hdr.bottom), bottom = nav.top, band = bottom - top;
  const clip = (r) => Math.max(0, Math.min(r.bottom, bottom) - Math.max(r.top, top));
  const overlap = (a, b) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const notices = [...document.querySelectorAll('.cal > .notice')].filter((e) => !e.hidden).map((e) => { const r = e.getBoundingClientRect();
    return { kind: e.dataset.state, h: q(r.height), top: q(r.top), fullyVisible: r.top >= top - 0.5 && r.bottom <= bottom + 0.5, text: e.textContent.trim() }; });
  const firstRow = document.querySelector('.ev').getBoundingClientRect();
  const firstNotice = document.querySelector('.cal > .notice:not([hidden])');
  const statusBlock = firstNotice ? q(firstRow.top - firstNotice.getBoundingClientRect().top) : 0;
  const cueEl = document.getElementById('status-cue'), cue = cueEl && !cueEl.hidden ? cueEl.getBoundingClientRect() : null;
  const rows = [...document.querySelectorAll('.ev')].map((e) => { const r = e.getBoundingClientRect(), vis = clip(r);
    const covered = cue ? Math.max(0, Math.min(r.bottom, bottom, cue.bottom) - Math.max(r.top, top, cue.top)) : 0;
    return { round: e.querySelector('.ev__num').textContent.trim(), next: !!e.querySelector('.ev__kicker'), top: q(r.top), h: q(r.height), visiblePx: q(vis),
      coveredByCuePx: q(covered), visibleUncoveredPx: q(vis - covered), fullyConcealed: vis > 0 && vis - covered <= 0.5 }; });
  const live = [...document.querySelectorAll('[role="status"]')].filter((e) => !e.hidden && e.getClientRects().length);
  const text = notices.map((n) => n.text).join(' ').toLowerCase();
  return { viewportH: H, scrollY: Math.round(scrollY), maxScroll: de.scrollHeight - H, pinnedBottom: q(top), navTop: q(bottom), band: q(band), bandPct: q(band / H * 100),
    notices, noticesH: q(notices.reduce((s, n) => s + n.h, 0)), statusBlockH: statusBlock,
    savedRepeats: (text.match(/saved|guardad/g) || []).length,
    cue: cue ? { h: q(cue.height), top: q(cue.top), bottom: q(cue.bottom), pctOfBand: q(cue.height / band * 100), text: cueEl.textContent.trim() } : null,
    rows, liveRegionsVisible: live.length, liveRegionsWithText: live.filter((e) => e.textContent.trim()).length,
    data: { ...de.dataset } }; })()`;
const DET = `(() => { ${Q}
  const H = innerHeight, bar = document.querySelector('.dbar').getBoundingClientRect(), block = document.querySelector('.page-notice');
  const br = block ? block.getBoundingClientRect() : null, name = document.getElementById('dp-name').getBoundingClientRect();
  const notices = [...document.querySelectorAll('.page-notice .notice')].map((e) => ({ kind: e.dataset.kind, h: q(e.getBoundingClientRect().height), text: e.textContent.trim() }));
  const avail = H - bar.bottom;
  const order = [...document.querySelectorAll('.page-notice .notice, h1, h2')].map((e) => e.matches('.notice') ? 'notice:' + e.dataset.kind : e.tagName.toLowerCase() + ':' + e.textContent.trim().slice(0, 24));
  const text = notices.map((n) => n.text).join(' ').toLowerCase();
  const words = text.replace(/[^a-záéíóúñü ]/g, ' ').split(/\\s+/).filter((w) => w.length > 4);
  const dup = [...new Set(words.filter((w, i) => words.indexOf(w) !== i))];
  return { viewportH: H, appBarBottom: q(bar.bottom), available: q(avail), notices, noticesH: q(notices.reduce((s, n) => s + n.h, 0)),
    blockH: br ? q(br.height) : 0, blockPctOfAvailable: br ? q(br.height / avail * 100) : 0, nameTop: q(name.top), nameVisible: name.bottom <= H,
    contentBelowBlockPx: q(Math.max(0, H - (br ? br.bottom : bar.bottom))), readingOrder: order.slice(0, 5),
    liveRegions: document.querySelectorAll('[role="status"]').length, repeatedWords: dup }; })()`;
const cal = () => evalJs(CAL);
const det = () => evalJs(DET);

const results = { generated: new Date().toISOString(), chrome: CHROME, dpr: DPR, raster: 'software',
  note: 'Chrome emulation; safe-area insets 0; no TalkBack. Live regions = HTML role="status" placeholder.', calendar: {}, detail: {} };

// ---------- A. Calendar: stacked vs combined (top of the list, no anchor) ----------
results.calendar.compare = {};
for (const lang of LANGS) for (const vp of VIEWPORTS) {
  const file = lang === 'en' ? 'calendar.html' : 'calendar.es.html';
  for (const [label, query] of [['failed', 'state=failed'], ['stale', 'state=stale'], ['stacked', 'state=failed,stale&notices=stacked'], ['combined', 'state=failed,stale&notices=combined']]) {
    await open(file, query, vp);
    const m = await cal();
    results.calendar.compare[`${lang}|${vpName(vp)}|${label}`] = { noticesH: m.noticesH, statusBlockH: m.statusBlockH, notices: m.notices.map((n) => ({ kind: n.kind, h: n.h })),
      band: m.band, firstRowTop: m.rows[0].top, firstRowVisiblePx: m.rows[0].visiblePx, savedRepeats: m.savedRepeats, liveRegionsVisible: m.liveRegionsVisible };
    const wanted = (label === 'stacked' || label === 'combined') && ((vp[0] === 320) || (lang === 'en'));
    if (wanted) await shot(`cal-${label}-${lang}-${vpName(vp)}`);
  }
}

// ---------- B. Calendar first open: anchor + cue alternatives ----------
results.calendar.firstOpen = {};
const CUES = ['none', 'toast', 'toast-long', 'toast-full', 'edge'];
const CUE_STATES = [['combined', 'failed,stale'], ['failed', 'failed'], ['stale', 'stale']];
for (const lang of LANGS) for (const vp of VIEWPORTS) for (const [sLabel, state] of CUE_STATES) for (const cue of CUES) {
  if (cue === 'toast-long' && sLabel !== 'combined') continue;   // only failure + stale has a long cue text
  const file = lang === 'en' ? 'calendar.html' : 'calendar.es.html';
  const cueParam = cue === 'toast-long' ? 'toast&cueCopy=long' : cue;
  await open(file, `state=${state}&anchor=1&cue=${cueParam}&hold=1`, vp);
  const m = await cal();
  const next = m.rows.find((r) => r.next), r22 = m.rows.find((r) => r.round === '22');
  const rec = { anchorY: Number(m.data.anchorY), scrollY: m.scrollY, maxScroll: m.maxScroll, noticeVisibleAtOpen: m.data.noticeVisibleAtOpen === 'true', decision: m.data.cueDecision,
    cue: m.cue, band: m.band, nextRow: next, row22: r22, anyRowFullyConcealed: m.rows.some((r) => r.fullyConcealed), liveRegionsWithText: m.liveRegionsWithText };
  // Focus: programmatic focus without scrolling, then geometry of the focused link against the cue.
  if (m.cue) {
    rec.focus = {};
    for (const round of ['22', '23']) {
      rec.focus[round] = await evalJs(`(() => { const q = (v) => Math.round(v * 100) / 100; const e = [...document.querySelectorAll('.ev')].find((x) => x.querySelector('.ev__num').textContent.trim() === '${round}');
        const a = e.querySelector('.ev__link'); a.focus({ preventScroll: true }); const r = a.getBoundingClientRect(), c = document.getElementById('status-cue').getBoundingClientRect();
        const hdr = document.querySelector('.appbar--sticky').getBoundingClientRect(), nav = document.querySelector('.tabbar').getBoundingClientRect(), top = Math.max(0, hdr.bottom);
        const vis = Math.max(0, Math.min(r.bottom, nav.top) - Math.max(r.top, top)), cov = Math.max(0, Math.min(r.bottom, nav.top, c.bottom) - Math.max(r.top, top, c.top));
        return { visiblePx: q(vis), coveredByCuePx: q(cov), uncoveredPx: q(vis - cov), entirelyObscured: vis > 0 && vis - cov <= 0.5, scrollY: Math.round(scrollY) }; })()`);
    }
    await evalJs('document.activeElement.blur(); true');
  }
  results.calendar.firstOpen[`${lang}|${vpName(vp)}|${sLabel}|${cue}`] = rec;
  const key320 = vp[0] === 320, keyLand = vp[0] === 693, key390 = vp[0] === 390;
  const wanted = (sLabel === 'combined' && key320 && cue !== 'toast-long') ||
    (sLabel === 'combined' && keyLand && (lang === 'en' ? cue !== 'toast-full' : cue === 'toast')) ||
    (sLabel === 'combined' && key390 && lang === 'en' && cue === 'toast') ||
    (sLabel === 'stale' && key320 && lang === 'es' && cue === 'toast');
  if (wanted) await shot(`cal-open-${sLabel}-${cue}-${lang}-${vpName(vp)}`);
}

// ---------- C. Calendar dynamics: dismissal, no repeat on resize, retry ----------
results.calendar.dynamics = {};
for (const lang of LANGS) {
  const file = lang === 'en' ? 'calendar.html' : 'calendar.es.html';
  const vp = [320, 693, 200];
  // 1. Timeout: the cue leaves after 6 s; the list never moves.
  await open(file, 'state=failed,stale&anchor=1&cue=toast', vp);
  const a = await cal(); await sleep(6400); const b = await cal();
  // 2. Resize / rotation after the decision: no second cue.
  await viewport(693, 320); await sleep(300); const c = await cal(); await viewport(320, 693); await sleep(300); const d = await cal();
  // 3. Scrolling the notice into view removes a held cue.
  await open(file, 'state=failed,stale&anchor=1&cue=toast&hold=1', vp);
  const e = await cal(); await evalJs('window.scrollTo(0, 0); true'); await frames(); const f = await cal();
  // 4. N-4 / N-5: a user-initiated retry that fails while the notice is off-screen.
  await open(file, 'state=failed&anchor=1&cue=toast&sim=refresh-fail&simMs=1200', vp);
  await sleep(6400);   // the first-open cue has timed out
  const g = await cal();
  await evalJs(`document.querySelector('.appbar__actions .icon-btn').click(); true`); await sleep(250); await frames();
  const h = await cal();
  await sleep(1400); await frames();
  const i = await cal();
  const top23 = (m) => m.rows.find((r) => r.round === '23').top;
  results.calendar.dynamics[lang] = {
    timeout: { shownAtOpen: a.data.cueShows, hiddenAfter6s: b.cue === null, hiddenReason: b.data.cueHidden, scrollYBefore: a.scrollY, scrollYAfter: b.scrollY, nextRowTopBefore: top23(a), nextRowTopAfter: top23(b) },
    resize: { cueShowsAfterRotate: c.data.cueShows, cueShowsAfterReturn: d.data.cueShows, cueVisibleAfterRotate: c.cue !== null },
    scrollToNotice: { cueBefore: e.cue !== null, cueAfter: f.cue !== null, hiddenReason: f.data.cueHidden },
    retry: { beforeClick: { cueVisible: g.cue !== null, noticeMutations: g.data.noticeMutations, nextRowTop: top23(g), scrollY: g.scrollY },
      during: { refreshing: h.data.refreshing, failureNoticeStillShown: h.notices.some((n) => n.kind === 'failed'), noticeMutations: h.data.noticeMutations, nextRowTop: top23(h), scrollY: h.scrollY },
      after: { cueVisible: i.cue !== null, cueReason: i.data.cueReason, cueShows: i.data.cueShows, noticeMutations: i.data.noticeMutations, nextRowTop: top23(i), scrollY: i.scrollY, cueText: i.cue?.text } },
  };
}

// ---------- D. Detail coexistence ----------
const VARIANTS = ['failed', 'partial', 'failed-partial', 'combined-partial', 'stacked-partial'];
for (const lang of LANGS) for (const vp of VIEWPORTS) for (const v of VARIANTS) {
  await open(lang === 'en' ? `detail-${v}.html` : `detail-${v}.es.html`, '', vp, { scaleAfterLoad: true });
  results.detail[`${lang}|${vpName(vp)}|${v}`] = await det();
  const wanted = (vp[0] === 320) || (vp[0] === 390 && lang === 'en' && v.includes('partial') && v !== 'partial') || (vp[0] === 693 && lang === 'en' && v === 'combined-partial');
  if (wanted) await shot(`detail-${v}-${lang}-${vpName(vp)}`);
}

results.screens = shots;
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));

// ---------- Summary ----------
const L = [];
L.push(`Notice coexistence experiment (Step 49D.1) - ${results.generated}`, results.note, '');
L.push('A. Calendar notices at the top of the list (heights in CSS px; statusBlock = first notice top to first race top)');
for (const [k, v] of Object.entries(results.calendar.compare)) L.push(`  ${k.padEnd(28)} notices ${String(v.noticesH).padStart(7)}  block ${String(v.statusBlockH).padStart(7)}  firstRowVisible ${String(v.firstRowVisiblePx).padStart(7)}  "saved" x${v.savedRepeats}  live ${v.liveRegionsVisible}`);
L.push('', 'B. Calendar first open (anchor = next race; hold = cue kept for measurement)');
for (const [k, v] of Object.entries(results.calendar.firstOpen)) {
  const f = v.focus ? Object.entries(v.focus).map(([r, x]) => `r${r} ${x.entirelyObscured ? 'OBSCURED' : `${x.uncoveredPx}px clear`}`).join(', ') : '-';
  L.push(`  ${k.padEnd(40)} anchorY ${String(v.anchorY).padStart(5)}  noticeVisible ${String(v.noticeVisibleAtOpen).padEnd(5)}  ${String(v.decision).padEnd(14)} cue ${v.cue ? `${v.cue.h}px (${v.cue.pctOfBand}% band)` : '-'}  next row covered ${v.nextRow.coveredByCuePx}px of ${v.nextRow.visiblePx}px  focus ${f}`);
}
L.push('', 'C. Calendar dynamics (320x693 @200%)');
for (const [lang, v] of Object.entries(results.calendar.dynamics)) L.push(`  ${lang}: ${JSON.stringify(v)}`);
L.push('', 'D. Detail notices (block = .page-notice incl. padding; % of the viewport below the app bar)');
for (const [k, v] of Object.entries(results.detail)) L.push(`  ${k.padEnd(36)} notices ${String(v.noticesH).padStart(7)}  block ${String(v.blockH).padStart(7)} (${String(v.blockPctOfAvailable).padStart(5)}%)  name top ${String(v.nameTop).padStart(7)} visible ${v.nameVisible}  live ${v.liveRegions}  order ${v.readingOrder.slice(0, 3).join(' > ')}  repeated [${v.repeatedWords.join(', ')}]`);
L.push('', `Screens: ${shots.length}`);
writeFileSync(join(OUT, 'summary.txt'), L.join('\n') + '\n');
console.log(`wrote ${OUT} (${shots.length} screens)`);
ws.close(); chrome.kill();
process.exit(0);
