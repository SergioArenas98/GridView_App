# Consolidation regression utility

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a consolidation pilot of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../README.md#validation-output).

`visual-compare.mjs` compares an approved prototype (baseline) with its
consolidation pilot. It is a single dependency-free Node script (Node 22+,
installed Chrome), generalised from the Calendar pilot's original harness.
That original stays unchanged as evidence in
`../validation-20261108-224601-regression/compare.mjs`.

```sh
node visual-compare.mjs standings.config.mjs              # pilot vs baseline, software raster
node visual-compare.mjs standings.config.mjs --control    # baseline vs itself (noise floor)
node visual-compare.mjs calendar.config.mjs --out <dir> --shots none
```

Flags: `--control`, `--gpu` (Chrome's default raster; it is non-deterministic
between loads on gradients + skew + shadow, so use it only to compare against
its own control), `--out <dir>`, `--shots none|first|all`. The script exits 1
if any pixel, DOM, style, box, metric or accessibility difference is found.

## What one run compares

Baseline and pilot load back to back in one headless Chrome session, with the
same device metrics (DPR 2, mobile, touch), media features, query and root
text scale. Software raster and compositing are the default. Each screenshot
is retaken until two consecutive frames match.

- Pixels: every screenshot as decoded RGBA, with an explicit count, max delta
  and bounding box. Diff images are written only when a pair differs.
- DOM: every body element's own text, attributes (hrefs compared resolved),
  box at 0.01px, and full computed style including `::before` / `::after`. Also the
  `<html>` attributes and computed style, and the loaded font faces.
- Quality metrics, in both versions: horizontal scroll, elements outside the
  viewport, clipped or spilling text, text under 12.5px, words broken across
  lines, touch targets under 48×48, and text contrast pairs. Contrast is
  computed over flat backgrounds; text on a gradient or on a pseudo-element
  slab is listed as complex.
- Accessibility tree, with the page folder normalised.
- Probes: the nav fit and selected-label style, plus the config's own
  expressions.

Actions: `scroll` (viewport steps), `segments` (full-page slices for long
galleries), `focus` (Tab through every visible link and button; each stop
records Chrome's computed accessible role and name, a structural locator such
as `main.page > section.sec:nth-child(2) > ul.stints > li.st > a.st__hit`, and
the resolved href normalised like the DOM comparison (`<page>/…`, `<repo>/…`;
a raw href would differ by design where a pilot sits deeper than its
baseline). Before 2026-11-09 it recorded the aria-label or visible text
only; `stops` defaults to the number of visible links and buttons, so set it
explicitly where some are inert, as in a gallery's frames. Never walk past
the last focusable control: in headless Chrome that Tab either leaves the
document or wraps to the first control, alternating between loads, and the
next page then loads with a different root focus state), `forced`
(`:hover` / `:active` per selector), `steps` (click / focus / key / scroll,
recording state and screenshots; `scrollTo: selector` brings a section into
view; keys: Tab, Enter, Space, and since 2026-11-10 the arrows, Home and
End). Asserts are checked in both versions. Each `scroll` capture records its
coverage (`results.json` → `coverage`: document height, step, shots needed
and taken); a capped capture is flagged `COVERAGE n/m` in `summary.txt`.

## Config

A config is an ES module (`*.config.mjs`) with paths relative to itself:

```js
export default {
  name, baseline: '../../standings', pilot: '../standings',
  viewports: [[390, 844], [320, 693]], textScales: [100, 200],
  pages: [{ id, file, pilotFile?, queries: { label: 'query=string' }, capture: 'scroll' | 'segments', freezeAnimations?: ms, maxShots?: n }],
  runs: [{ name, page, query, viewport, scale, action, states | steps | stops, assert: [[label, (records) => bool]], media: { reducedMotion } }],
  stateProbe: 'js expression',          // default record for steps
  probes: { label: 'js expression' },   // compared and reported per run
  saveShots: 'none' | 'first' | 'all',
  outLabel?: 'root',                    // default folder validation-<stamp>-<outLabel> (default "regression")
  sharedRoots?: [[baselineDir, pilotDir, '<token>']],   // both folders normalised to "<token>/" in URLs
};
```

Options added 2026-11-10 for the Settings pilot, all opt-in (without them the
earlier configs run exactly as before): page `maxShots` (static `scroll`
captures; default 12), `outLabel` (Settings root and preferences share one
pilot folder and keep separate evidence), `sharedRoots` (the information
screens' back links leave their page folder for the Settings root; in both
versions that folder becomes `<settings>/`, so the resolved targets compare
equal).

`pilotFile` is the page's path in the pilot when it differs from `file` (the
baseline path), for pages that sit at another depth in the pilot. URLs are
normalised per page from both files' folders. `freezeAnimations` pauses every
CSS animation at that time after load in both versions, so a looping sweep
(Explore's refresh line) captures deterministically.

Static runs are the cartesian product pages × queries × viewports × scales.
`runs` adds the interaction runs. Configs: `calendar.config.mjs`,
`standings.config.mjs`, `explore.config.mjs`, and the three entity-detail
configs `driver-detail.config.mjs`, `team-detail.config.mjs`,
`circuit-detail.config.mjs`, `grand-prix-detail.config.mjs`, and the three
Settings configs `settings-root.config.mjs`, `settings-preferences.config.mjs`,
`settings-information.config.mjs` (shared probes and ARB / attribution-record
loading in `settings-common.mjs`, not a config; expected values are read from
`lib/l10n/app_*.arb` and `content/attribution/data-sources.json`, never
retyped), and `home.config.mjs` (Step 46: the approved `../../refinement-01/`
against `../home/`; ARB-backed data checks via `settings-common.mjs`, every
hash route, keyboard walks at every size). The detail configs share one run matrix,
`detail-common.mjs` (not a config): every scenario page and the state gallery
in EN and ES at both sizes and scales; keyboard walks; forced pointer states;
a navigation run that activates every hash link and Enter on Back; data runs
that record the screen's own values and assert its data rules in both
versions; reduced motion. Optional `queries` (per scenario page; GP's
`?time=` clock modes), `extraPages` and `extraRuns` (GP's development-only
title stress page) were added for the Grand Prix pilot; with their defaults
the other detail configs run exactly as before.

## Evidence in Git

Reports (`results.json`, and `summary.txt` and accessibility trees when they
hold no local path) are committed; screenshots, diffs and path-bearing
reports stay local (`design-exploration/.gitignore`) and are regenerated by
re-running a config. A run always writes a new timestamped folder unless
`--out` is given. See `../../CHECKPOINT-PREPARATION.md` §12.

## Local paths in reports

Since 2026-11-09 new reports carry no machine-specific path: file URLs
outside the page folder (for example nav links to other prototypes) become
`<repo>/…` in the accessibility trees and compared hrefs, and the
baseline/pilot lines of `summary.txt` are repository-relative. The
repository root is the nearest folder above the config that holds `.git`.
Validation folders written before that date still contain absolute paths
and are left as they are; check any folder before staging it.
