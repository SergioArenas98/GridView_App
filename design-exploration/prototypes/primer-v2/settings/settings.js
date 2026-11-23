/* GridView — Primer V2 Settings: presentation-only behaviour.
 *
 * This is NOT the application's persistence. Prototype state lives only in
 * the URL query (carried on every in-prototype link) and in this page's
 * memory. Nothing is written to storage. It exists to show, in the browser,
 * what Flutter already does:
 *
 * - Selecting applies immediately; the screen stays open (no Save/Apply).
 *   (PreferenceChoiceScreen, AppPreferencesRepository._write)
 * - Language re-renders the open screen in place; Theme re-tones it.
 * - A failed write restores the previous stored value and shows
 *   settingsSaveFailed. A newer selection supersedes an older pending one
 *   (latest wins, no message for the superseded write).
 * - Unknown parameter values fall back to the documented defaults, as
 *   *.fromWire does: language system, theme dark, time device.
 *
 * Development-only parameters: fail=1 (every write fails), env=production|
 * development|staging, contact=configured|none, device=en|es (the simulated
 * device language that "System default" resolves to).
 */
(() => {
  'use strict';
  const S = window.GV_STRINGS;
  const html = document.documentElement;
  const body = document.body;
  const q = new URLSearchParams(location.search);
  const one = (k, allowed, fallback) => (allowed.includes(q.get(k)) ? q.get(k) : fallback);

  const LABEL = {
    language: { system: 'settingsLanguageSystem', english: 'settingsLanguageEnglish', spanish: 'settingsLanguageSpanish' },
    theme: { system: 'settingsThemeSystem', dark: 'settingsThemeDark', light: 'settingsThemeLight' },
    time: { device: 'settingsTimeDevice', event: 'settingsTimeEvent', both: 'settingsTimeBoth' },
  };
  const state = {
    language: one('language', Object.keys(LABEL.language), body.dataset.language || 'system'),
    theme: one('theme', Object.keys(LABEL.theme), body.dataset.theme || 'dark'),
    time: one('time', Object.keys(LABEL.time), body.dataset.time || 'device'),
    env: one('env', ['production', 'development', 'staging'], body.dataset.env || 'production'),
    contact: one('contact', ['configured', 'none'], body.dataset.contact || 'configured'),
    device: one('device', ['en', 'es'], body.dataset.device || 'en'),
    fail: q.get('fail') === '1',
  };
  const WRITE_MS = 280;      // simulated persistence latency
  const SNACK_MS = 4000;     // Material SnackBar default duration
  const lightQuery = matchMedia('(prefers-color-scheme: light)');

  // Locale resolution (locale_resolution.dart): a pinned language wins; System
  // follows the device language when supported, otherwise English.
  const resolvedLang = () => (state.language === 'english' ? 'en'
    : state.language === 'spanish' ? 'es' : (state.device === 'es' ? 'es' : 'en'));
  const resolvedTheme = () => (state.theme === 'system' ? (lightQuery.matches ? 'light' : 'dark') : state.theme);

  const query = (extra) => {
    const p = new URLSearchParams({ language: state.language, theme: state.theme, time: state.time,
      env: state.env, contact: state.contact, device: state.device });
    if (state.fail) p.set('fail', '1');
    Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  };
  const show = (sel, on) => document.querySelectorAll(sel).forEach((el) => { el.hidden = !on; });

  function render() {
    const lang = resolvedLang();
    const strings = S[lang];
    html.lang = lang;
    document.querySelectorAll('[data-k]').forEach((el) => {
      const text = strings[el.dataset.k];
      if (text != null && el.textContent !== text) el.textContent = text;
    });
    document.querySelectorAll('[data-k-label]').forEach((el) => el.setAttribute('aria-label', strings[el.dataset.kLabel]));
    document.querySelectorAll('[data-pref-value]').forEach((el) => {
      const key = LABEL[el.dataset.prefValue][state[el.dataset.prefValue]];
      el.dataset.k = key;
      el.textContent = strings[key];
    });
    const title = document.getElementById('screen-title');
    if (title) document.title = `GridView ${title.textContent}`;

    const theme = resolvedTheme();
    if (theme === 'light') html.dataset.theme = 'light'; else delete html.dataset.theme;

    // settings_screen.dart: Developer outside production only; feedback is a
    // row when a contact is configured, an explanation outside production when
    // none is, and absent in production when none is.
    const prod = state.env === 'production';
    show('[data-show="nonprod"]', !prod);
    show('[data-show="contact"]', state.contact === 'configured');
    show('[data-show="nocontact-nonprod"]', state.contact === 'none' && !prod);
    show('[data-show="light"]', theme === 'light');
    show('[data-show="fail"]', state.fail);
    const label = state.env === 'staging' ? 'STAGING' : 'DEV';
    document.querySelectorAll('.envbadge').forEach((b) => {
      b.textContent = label;
      b.setAttribute('aria-label', `Build environment: ${label}`);
    });

    if (group) {
      radios.forEach((r) => r.setAttribute('aria-checked', String(r.dataset.value === state[pref])));
      if (!group.contains(document.activeElement)) rove(radios.find((r) => r.dataset.value === state[pref]));
    }
    const sfx = body.dataset.suffix || '';
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const nav = a.dataset.nav;
      a.href = nav === 'back' ? `index${sfx}.html?${query({ from: pref })}` : `${nav}${sfx}.html?${query()}`;
    });
  }

  // ---------- Selection screens ----------
  const group = document.querySelector('[role="radiogroup"]');
  const pref = group ? group.dataset.pref : null;
  const radios = group ? [...group.querySelectorAll('[role="radio"]')] : [];
  let persisted = pref ? state[pref] : null;   // last value known to be stored
  let generation = 0;

  function rove(target) {
    radios.forEach((r) => { r.tabIndex = r === target ? 0 : -1; });
  }

  function select(value, el) {
    rove(el);
    const gen = ++generation;
    state[pref] = value;                 // applied immediately
    render();
    setTimeout(() => {
      if (gen !== generation) return;    // superseded: the newer selection wins
      if (state.fail) {
        state[pref] = persisted;         // restore the previous stored value
        render();
        snack(S[resolvedLang()].settingsSaveFailed);
      } else {
        persisted = value;
      }
      history.replaceState(null, '', `?${query()}`);
    }, WRITE_MS);
  }

  if (group) {
    radios.forEach((r, i) => {
      r.addEventListener('click', () => select(r.dataset.value, r));
      r.addEventListener('keydown', (e) => {
        // Space and Enter select (Flutter activates with both). Arrows move
        // focus only: selecting on arrow would re-render the language or
        // theme at every keystroke, because every selection applies at once.
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); select(r.dataset.value, r); return; }
        const n = radios.length;
        const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1 + n, ArrowLeft: i - 1 + n, Home: 0, End: n - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        const next = radios[to % n];
        rove(next);
        next.focus();
      });
    });
  }

  // ---------- Snackbar ----------
  const bar = document.querySelector('.snack');
  const msg = bar && bar.querySelector('.snack__msg');
  let snackTimer;
  function snack(text) {
    if (!bar) return;
    clearTimeout(snackTimer);
    msg.textContent = '';
    requestAnimationFrame(() => {        // a fresh text node is announced again
      msg.textContent = text;
      bar.classList.add('is-shown');
    });
    snackTimer = setTimeout(() => {
      bar.classList.remove('is-shown');
      setTimeout(() => { msg.textContent = ''; }, 300);
    }, SNACK_MS);
  }

  lightQuery.addEventListener('change', render);
  render();

  // Focus restoration (accessibility report 4.5): coming back from a
  // selection screen puts focus on the row that opened it.
  const from = q.get('from');
  const origin = from && document.getElementById(`row-${from}`);
  if (origin) {
    origin.focus();
    history.replaceState(null, '', `?${query()}`);
  }
})();
