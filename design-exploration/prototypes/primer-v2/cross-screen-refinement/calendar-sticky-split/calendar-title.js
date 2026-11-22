// EXPERIMENT (Step 48B). Calendar's title uses the shared title fit
// (../../shared/title-fit.js) with its own triggers, as Standings' layout pass
// has: Calendar has no header budget, so nothing is measured after the fit.
(() => {
  const title = document.querySelector('.appbar--sticky .wordmark');
  if (title && window.GvTitleFit) window.GvTitleFit.attach(title);
})();
