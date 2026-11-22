// EXPERIMENT (Step 48C). Calendar header split: the title row (title,
// Refresh, Settings) stays pinned unless keeping it would stop the tallest
// race row from fitting whole between the pinned chrome and the navigation.
// Then the header's sticky offset becomes minus the title row's height: the
// title row scrolls away with the content and the season row stays pinned.
//
// Measured, not thresholded: the rule compares real heights (header, season,
// navigation, rows, viewport), never a share of the viewport. It runs on
// text-scale changes (body resize), viewport changes (resize), font loading
// and once on load. It publishes:
//   --cal-pin-top   the header's sticky offset (0 or minus the title row)
//   --cal-pinned-h  the header height that stays pinned (scroll-padding-top)
//   data-title-row  "pinned", "scroll" or "revealed" on <html> (diagnostic)
//
// Two focus rules complete it:
// - While keyboard focus is on Refresh or Settings, a released title row is
//   pinned again ("revealed"), so the focused action is never off-screen.
// - After a text-scale or viewport change, a focused race row that the
//   change pushed out of the band between the pinned chrome and the
//   navigation is scrolled back into it (scroll padding applies). Ordinary
//   layout changes (a notice appearing) never move the scroll position.
(() => {
  const root = document.documentElement;
  const header = document.querySelector('.appbar--sticky');
  const season = header && header.querySelector('.season');
  const list = document.querySelector('.rounds');
  const nav = document.querySelector('.tabbar');
  if (!header || !season || !list) return;

  let busy = false;
  let revealed = false;
  let env = '';
  const layout = () => {
    if (busy) return;
    busy = true;
    const h = header.getBoundingClientRect();
    // Title row = from the header's top padding (safe area) to the season row.
    const titleRow = season.getBoundingClientRect().top - h.top - parseFloat(getComputedStyle(header).paddingTop);
    const navH = nav ? nav.getBoundingClientRect().height : 0;
    const tallest = Math.max(0, ...[...list.children].map((row) => row.getBoundingClientRect().height));
    const pinned = window.innerHeight - h.height - navH >= tallest;
    const offset = pinned || revealed ? 0 : Math.max(0, titleRow);
    root.dataset.titleRow = pinned ? 'pinned' : revealed ? 'revealed' : 'scroll';
    root.style.setProperty('--cal-pin-top', `${-offset}px`);
    root.style.setProperty('--cal-pinned-h', `${Math.ceil(h.height - offset)}px`);
    const now = `${window.innerWidth}x${window.innerHeight}@${getComputedStyle(root).fontSize}`;
    const changed = env !== '' && env !== now;
    env = now;
    const focused = document.activeElement;
    if (changed && focused && list.contains(focused) && focused.matches(':focus-visible')) focused.scrollIntoView({ block: 'nearest' });
    busy = false;
  };
  const setRevealed = (value) => { if (revealed !== value) { revealed = value; layout(); } };

  header.addEventListener('focusin', () => setRevealed(true));
  header.addEventListener('focusout', (event) => setRevealed(header.contains(event.relatedTarget)));
  new ResizeObserver(() => requestAnimationFrame(layout)).observe(document.body);
  window.addEventListener('resize', layout);
  document.fonts.ready.then(layout);
  layout();
})();
