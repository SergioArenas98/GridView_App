/* GridView — Grand Prix Detail prototype. Presentation only.
   Stands in for the existing time-display preference (Settings → Device /
   Event / Both): ?time=device|event|both picks which pre-rendered schedule
   is shown. Default is Device, as in Flutter. A screenshot aid, not a
   feature. Runs before first paint to avoid a flash of the wrong schedule. */
(function () {
  var mode = 'device';
  try {
    var p = new URLSearchParams(window.location.search).get('time');
    if (p === 'event' || p === 'both') mode = p;
  } catch (e) { /* keep the default */ }
  document.documentElement.setAttribute('data-time', mode);
})();
