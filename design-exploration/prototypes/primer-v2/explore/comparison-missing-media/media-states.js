// Development-only: switches every slot of the interactive mixed list to one
// media state (loaded / loading / failed / none). Presentation only; no image
// is requested or drawn. The validation measures that no text moves.
(() => {
  const list = document.querySelector('[data-interactive="true"]');
  const buttons = [...document.querySelectorAll('[data-set]')];
  if (!list || !buttons.length) return;
  const ICON = '<svg class="icon" aria-hidden="true"><use href="#i-driver"/></svg>';
  const set = (state) => {
    list.querySelectorAll('.ent__media').forEach((slot) => {
      slot.className = `ent__media ent__media--${state}`;
      slot.dataset.state = state;
      slot.innerHTML = state === 'failed' ? ICON : '';
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === state)));
  };
  buttons.forEach((b) => b.addEventListener('click', () => set(b.dataset.set)));
  set('loading');
})();
