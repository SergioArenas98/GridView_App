/* GridView — Primer V2 Settings information screens: presentation-only behaviour.
 *
 * Nothing here is application logic and nothing is stored. It only shows, in
 * the browser, what Flutter's openExternalLink() already does
 * (lib/features/settings/presentation/information_screens.dart):
 *
 * - An external row hands the destination to another application. Here an
 *   attribution link opens the recorded https URL in a new tab; the privacy
 *   policy row has no URL in the prototype (it is build configuration that is
 *   never shown), so a prototype annotation is revealed instead.
 * - When opening fails, the existing settingsOpenFailed message appears in a
 *   polite status region for 4 s (Material SnackBar default). No URL, no
 *   exception text. Focus does not move.
 *
 * Development-only parameter: openfail=1 (every external open fails).
 */
(() => {
  'use strict';
  const fail = new URLSearchParams(location.search).get('openfail') === '1';
  const SNACK_MS = 4000;
  const snack = document.querySelector('.snack');
  let timer = 0;

  document.querySelectorAll('[data-show="openfail"]').forEach((el) => { el.hidden = !fail; });

  function showFailure() {
    if (!snack) return;
    const msg = snack.querySelector('.snack__msg');
    // A fresh text node, so a repeated failure is announced again.
    msg.textContent = '';
    msg.appendChild(document.createTextNode(snack.dataset.msg));
    snack.classList.add('is-shown');
    clearTimeout(timer);
    timer = setTimeout(() => snack.classList.remove('is-shown'), SNACK_MS);
  }

  document.addEventListener('click', (event) => {
    const row = event.target.closest('[data-ext]');
    if (!row) return;
    if (fail) {
      event.preventDefault();
      showFailure();
      return;
    }
    if (row.dataset.ext === 'privacy-policy') {
      const note = document.querySelector('[data-show="policy-opened"]');
      if (note) note.hidden = false;
    }
    // Attribution links: the browser follows the recorded https href.
  });
})();

/* App-bar title fit (approved rule S-2, as standings.js): the title wraps
 * between words; a single word wider than the column narrows the width axis
 * first and is scaled down only as a last resort. Never truncated. */
(() => {
  'use strict';
  const titles = [...document.querySelectorAll('.info-screen .dbar__title, .gallery .dbar__title')];
  if (!titles.length) return;
  const modes = ['w88', 'w76', 'w66', 'w62'];
  const fitOne = (title) => {
    const fits = () => title.scrollWidth <= title.clientWidth + 1;
    title.style.fontSize = '';
    for (const mode of modes) {
      title.dataset.fit = mode;
      if (fits()) return;
    }
    title.dataset.fit = 'scaled';
    const base = parseFloat(getComputedStyle(title).fontSize);
    title.style.fontSize = `${Math.floor((base * title.clientWidth * 100) / title.scrollWidth) / 100}px`;
  };
  const fit = () => titles.forEach(fitOne);
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fit(); });
  };
  new ResizeObserver(schedule).observe(document.documentElement);
  document.fonts.ready.then(fit);
  fit();
})();
