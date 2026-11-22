// EXPERIMENT (Step 49D.1), not an approved design. Replaces Stage 1's
// calendar-states.js in this folder's calendar[.es].html only; Stage 1 itself
// is read, never written. Presentation only: no data, no network.
//
// URL parameters
//   ?state=refreshing,failed,stale   conditions (any combination)
//   ?notices=combined | stacked      failure + stale of the same content (N-2):
//                                    one combined notice (default) or both
//                                    existing notices in N-1 order
//   ?anchor=1                        simulate Flutter's one-time first-open
//                                    positioning: the "Next" race row is
//                                    scrolled to the top of the list band
//                                    (clamped by the page, as in Flutter)
//   ?cue=none | toast | toast-full | edge
//                                    first-open cue when the full notice is
//                                    not visible after positioning (N-6)
//   ?cueCopy=long                    failure + stale cue states both (EXPERIMENTAL
//                                    text); default = the failure wording only
//   ?hold=1                          keep a shown cue (capture only; the real
//                                    cue dismisses itself after 6 s)
//   ?sim=refresh-fail                the Refresh button simulates a
//                                    user-initiated retry that fails (N-4, N-5)
//   ?copy=b                          failure + stale: N-2 candidate B (Step 49D.2)
//   ?open=notice                     Step 49D.2 option A: when a notice exists,
//                                    skip the one-time positioning (open at the
//                                    top with the notice visible)
//   ?inline=1                        Step 49D.2 option B: keep the positioning;
//                                    if the notice is off-screen afterwards, show
//                                    the inline status line before the next race
//                                    and position that line at the band top
//   ?scale=200                       root text size, applied before
//                                    positioning (the harness's 200% text)
//
// Cue rules implemented here:
// - decided once per page open, after the first positioning; never again on
//   resize, rotation or text-scale change;
// - shown only when at least one visible notice is not fully inside the band
//   between the pinned header and the navigation;
// - removed after 6 s, or as soon as the full notice becomes visible;
// - fixed overlay, pointer-events none, not focusable: it never changes the
//   scroll position or the focus;
// - a user-initiated retry whose outcome is a failure may show it again
//   (new feedback for a new action, N-5); a background condition never does.
// Accessibility: PLACEHOLDER. The cue is an HTML live region (role="status",
// text inserted after it is shown). This models the intent (one announcement,
// from the cue, while the in-list notice is off-screen and unchanged); it is
// not Flutter or TalkBack behaviour and was not validated on a device.
(() => {
  const params = new URLSearchParams(window.location.search);
  const root = document.documentElement;
  const scale = Number(params.get('scale') || 100);
  if (scale !== 100) root.style.fontSize = `${scale}%`;

  const states = new Set((params.get('state') || '').split(',').map((s) => s.trim()).filter(Boolean));
  const stacked = params.get('notices') === 'stacked';
  const cueKind = ['toast', 'toast-full', 'edge'].includes(params.get('cue')) ? params.get('cue') : 'none';
  const hold = params.get('hold') === '1';
  const header = document.querySelector('.appbar--sticky');
  const nav = document.querySelector('.tabbar');
  const cue = document.getElementById('status-cue');
  const cueText = cue ? cue.querySelector('.cue__text') : null;

  const show = (name) => document.querySelectorAll(`[data-state="${name}"]`).forEach((el) => { el.hidden = false; });
  const hide = (name) => document.querySelectorAll(`[data-state="${name}"]`).forEach((el) => { el.hidden = true; });
  let failed = states.has('failed');
  let stale = states.has('stale');
  const key = () => (failed && stale ? 'combined' : failed ? 'failed' : stale ? 'stale' : null);
  const renderNotices = () => {
    ['failed', 'stale', 'combined', 'combined-b'].forEach(hide);
    const combinedState = params.get('copy') === 'b' ? 'combined-b' : 'combined';
    if (failed && stale) { if (stacked) { show('failed'); show('stale'); } else show(combinedState); }
    else if (failed) show('failed');
    else if (stale) show('stale');
    root.dataset.noticeKey = key() || 'none';
  };
  if (states.has('refreshing')) show('refreshing');
  renderNotices();
  root.dataset.cueKind = cueKind;
  root.dataset.noticeMode = stacked ? 'stacked' : 'combined';

  const notices = () => [...document.querySelectorAll('.cal > .notice')].filter((el) => !el.hidden);
  const band = () => ({
    top: Math.max(0, header.getBoundingClientRect().bottom),
    bottom: nav ? nav.getBoundingClientRect().top : window.innerHeight,
  });
  const fullyVisible = () => {
    const b = band();
    const list = notices();
    return list.length > 0 && list.every((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5;
    });
  };

  let timer = 0;
  let shows = 0;
  const hideCue = (why) => {
    if (!cue || cue.hidden) return;
    cue.hidden = true;
    cueText.textContent = '';
    clearTimeout(timer);
    root.dataset.cueHidden = why;
  };
  const showCue = (reason) => {
    const k = key();
    if (!cue || cueKind === 'none' || !k || fullyVisible()) return false;
    const message = cueKind === 'toast-full'
      ? notices().map((el) => el.textContent.trim()).join(' ')
      : cue.dataset[`msg${k[0].toUpperCase()}${k.slice(1)}${k === 'combined' && params.get('cueCopy') === 'long' ? 'Long' : ''}`];
    cue.className = `cue cue--${cueKind}`;
    cue.hidden = false;
    // Inserted after the region is shown, so a live region announces it once.
    requestAnimationFrame(() => { cueText.textContent = message; });
    shows += 1;
    root.dataset.cueShows = String(shows);
    root.dataset.cueReason = reason;
    clearTimeout(timer);
    if (!hold) timer = setTimeout(() => hideCue('timeout'), 6000);
    return true;
  };

  // One-time first positioning, then the one-time cue decision.
  let decided = false;
  const positionOnce = () => {
    if (decided) return;
    decided = true;
    const toBandTop = (el) => window.scrollTo(0, Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - band().top)));
    const next = [...document.querySelectorAll('.ev')].find((el) => el.querySelector('.ev__kicker'));
    const noticeFirst = params.get('open') === 'notice' && key() !== null;
    root.dataset.openMode = noticeFirst ? 'notice-first' : (params.get('anchor') === '1' ? 'anchored' : 'top');
    if (params.get('anchor') === '1' && next && !noticeFirst) {
      toBandTop(next);
      // Option B: in the same task (no paint in between), add the inline line
      // and position it, so the next race keeps its place just below it.
      const line = document.querySelector('.ev-status');
      if (params.get('inline') === '1' && line && key() && !fullyVisible()) {
        line.querySelector('.ev-status__text').textContent = line.dataset[`msg${key()[0].toUpperCase()}${key().slice(1)}`];
        line.hidden = false;
        toBandTop(line);
        root.dataset.inlineShown = 'true';
      }
    }
    root.dataset.anchorY = String(Math.round(window.scrollY));
    root.dataset.noticeVisibleAtOpen = String(fullyVisible());
    root.dataset.cueDecision = showCue('first-open') ? 'shown' : (key() ? (cueKind === 'none' ? 'no-cue-variant' : 'notice-visible') : 'no-notice');
  };
  window.addEventListener('scroll', () => { if (cue && !cue.hidden && fullyVisible()) hideCue('notice-visible'); }, { passive: true });
  document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(positionOnce, 60))));

  // N-4 / N-5 simulation: a user-initiated retry that fails.
  const refresh = document.querySelector('.appbar__actions .icon-btn');
  let mutations = 0;
  const watch = new MutationObserver((list) => { mutations += list.length; root.dataset.noticeMutations = String(mutations); });
  document.querySelectorAll('.cal > .notice').forEach((el) => watch.observe(el, { attributes: true, childList: true, characterData: true, subtree: true }));
  root.dataset.noticeMutations = '0';
  if (params.get('sim') === 'refresh-fail' && refresh) {
    refresh.addEventListener('click', () => {
      if (root.dataset.refreshing === '1') return;
      root.dataset.refreshing = '1';
      show('refreshing');          // the existing progress caption ("…")
      // N-4: the failure notice is NOT removed while the retry runs.
      setTimeout(() => {
        hide('refreshing');
        root.dataset.refreshing = '0';
        const before = key();
        failed = true;             // the retry's outcome is a failure
        if (key() !== before) renderNotices();   // stale only -> combined; failed -> unchanged
        root.dataset.refreshOutcomes = String(Number(root.dataset.refreshOutcomes || 0) + 1);
        showCue('user-refresh');   // only if the notice is off-screen
      }, Number(params.get('simMs') || 1200));
    });
  }
})();
