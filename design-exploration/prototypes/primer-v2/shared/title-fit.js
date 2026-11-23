// GridView — Primer V2 shared script: screen-title fit (rule S-2, provisionally
// approved 2026-11-07; title policy XS-07 still pending).
//
// One unbreakable title word ("Clasificaciones") narrows Archivo's width axis
// 118 → 100 → 84 → 72, then, only if it still overflows, scales down to its
// column. Never an ellipsis, never a smaller size while a narrower cut fits.
//
// Moved verbatim (Step 48B, 2026-11-10): `fitTitle` was byte-identical in
// standings.js and explore.js (approved and pilot copies alike). Here it takes
// the title element as a parameter instead of closing over it; the body is
// unchanged. The width steps themselves are CSS, in the consuming screen
// stylesheet (`.wordmark[data-fit="w100"]` and so on), together with the
// measuring preconditions: the title on one line (`white-space: nowrap`,
// `max-width: 100%`) inside a column that may shrink (`min-width: 0`).
//
//   GvTitleFit.fit(title)     one pass; screens with a header budget call it
//                             from their own layout pass, before measuring
//                             the header (Standings, Explore).
//   GvTitleFit.attach(title)  the same triggers as those layout passes, for a
//                             screen with no header budget: body resize
//                             (next frame), window resize, fonts ready, and
//                             once immediately. Used by the Calendar
//                             title-fit experiment only.
//
// Load it before the screen script, both `defer`, so it runs first.
(() => {
  const MODES = Object.freeze(['w118', 'w100', 'w84', 'w72']);

  const fit = (title) => {
    title.style.fontSize = '';
    for (const mode of MODES) {
      title.dataset.fit = mode;
      if (title.scrollWidth <= title.clientWidth + 1) return;
    }
    title.dataset.fit = 'scaled';
    const base = parseFloat(getComputedStyle(title).fontSize);
    title.style.fontSize = `${Math.floor((base * title.clientWidth * 100) / title.scrollWidth) / 100}px`;
  };

  const attach = (title) => {
    let busy = false;
    const layout = () => {
      if (busy) return;
      busy = true;
      fit(title);
      busy = false;
    };
    new ResizeObserver(() => requestAnimationFrame(layout)).observe(document.body);
    window.addEventListener('resize', layout);
    document.fonts.ready.then(layout);
    layout();
  };

  window.GvTitleFit = Object.freeze({ MODES, fit, attach });
})();
