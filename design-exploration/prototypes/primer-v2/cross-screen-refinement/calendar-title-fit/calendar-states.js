// Presentation only. Previews the Calendar header's conditional states with
// app copy only, no invented values:
//   ?state=refreshing   C14 — "Last successful check: …" (the app's ellipsis)
//   ?state=stale        C15 — cached-data notice
//   ?state=failed       C15 — refresh-failed notice
// States combine with commas (?state=refreshing,failed). Failure wording takes
// precedence over the stale wording, as in the Flutter header.
(() => {
  const raw = new URLSearchParams(window.location.search).get('state') || '';
  const states = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  const show = (name) => {
    document.querySelectorAll(`[data-state="${name}"]`).forEach((el) => { el.hidden = false; });
  };
  if (states.has('refreshing')) show('refreshing');
  if (states.has('failed')) show('failed');
  else if (states.has('stale')) show('stale');
})();
