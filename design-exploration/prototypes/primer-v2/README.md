# GridView — Primer V2: Motorsport Editorial (design record)

Primer V2 is **implemented** in the Flutter app, on every production screen,
in Dark and Light (2026-11-22). This folder is the design record behind it:
the approved HTML/CSS prototypes, the decision log, the backlog of open work
and the history of how the design was reached. It is not application code.

- **Start here for current guidance:**
  [`docs/technical/GridView_Design_System.md`](../../../docs/technical/GridView_Design_System.md)
  (entry point) and
  [`docs/technical/GridView_Primer_V2_Theme_Foundation.md`](../../../docs/technical/GridView_Primer_V2_Theme_Foundation.md)
  (per-screen implementation record).
- **Where design intent and implementation differ**, the decision log wins
  for intent and the Theme Foundation record documents each accepted
  implementation exception.

## Authoritative documents

| Document | Role |
|---|---|
| [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md) | **The decision log.** Every owner decision, with the IDs (DK-, LT-, XT-, XS-, VS-, N-, SF-, GI-, NF- and so on) cited in code comments and tests. |
| [`DESIGN-BACKLOG.md`](DESIGN-BACKLOG.md) | **Open and deferred work**, with status, priority and phase per item. |
| [`CROSS-THEME-CONSOLIDATION.md`](CROSS-THEME-CONSOLIDATION.md) | Frozen cross-theme specification (XT-6): components, roles, exceptions, acceptance criteria. |
| [`CROSS-THEME-TOKEN-MAP.md`](CROSS-THEME-TOKEN-MAP.md) | Frozen token and component map; the source of `lib/core/theme/tokens/gv_primer_palette.dart` and the role builders. |
| [`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md), [`LIGHT-THEME-ROLES.md`](LIGHT-THEME-ROLES.md) | Frozen Dark (DK-1 to DK-6) and Light (LT-1 to LT-18) role specifications. |
| [`STATUS-ABSENCE-DECISIONS.md`](STATUS-ABSENCE-DECISIONS.md), [`STATUS-NOTICE-DECISIONS.md`](STATUS-NOTICE-DECISIONS.md), [`STATUS-RANKING-DECISIONS.md`](STATUS-RANKING-DECISIONS.md), [`STATUS-VISUAL-DECISIONS.md`](STATUS-VISUAL-DECISIONS.md) | Decision records for information states; their outcomes are in the decision log. |
| [`LIGHT-ROLLOUT-BATCH-1.md`](LIGHT-ROLLOUT-BATCH-1.md), [`LIGHT-ROLLOUT-BATCH-2.md`](LIGHT-ROLLOUT-BATCH-2.md) | Records of the approved Light screen adaptations. |
| [`shared/README.md`](shared/README.md), [`../../shared-reference-data.md`](../../shared-reference-data.md) | Shared prototype tokens and components; the frozen reference data every prototype shows. |

## Approved references (Dark and Light)

The latest approved prototype for each screen. The `tool/primer_review/`
capture scripts render exactly these pages.

| Screen | Approved pages (under `cross-screen-refinement/`) |
|---|---|
| Home | `cross-theme-54b/home-{dark,light}-inset`, `home-{dark,light}` (shell) |
| Calendar | `light-rollout-b1/cal-{dark,light}`, `lt14-light`; `cross-theme-54b/cal-dark-full` |
| Standings | `light-foundations/st-index-dark`, `st-index-light-53b`; `light-rollout-b2/st-states-*`; `dark-state-boundaries/st-index-refine` |
| Explore | `cross-theme-54b/ex-cue-{dark,light}-seam`; `light-rollout-b2/ex-states-*`, `ex-media-states-*` |
| Driver Detail | `light-rollout-b1/dd-{index,partial,states}-*` |
| Team Detail | `light-rollout-b1/td-*`; team-colour edges in `cross-theme-54b/td-states-*` |
| Circuit Detail | `light-rollout-b2/cd-*`; one state in `light-coverage-gaps/` |
| Grand Prix Detail | `light-rollout-b2/gp-*`; three states in `light-coverage-gaps/` |
| Settings and information | `light-rollout-b2/set-*`, `info-*` |
| Notices | `status-visual-consistency/notices-proposed-combined-partial` |
| Environment strip | `../consolidation-pilot/settings/non-production` |
| NotFound | No prototype: composed from the Grand Prix page-state precedent (decision NF-1). |

Each folder's `build.py` generates its pages and `checks-*.mjs` measures them;
both are kept with the pages. Pages reviewed in Spanish have a twin
(`*.es.html`).

**Shared dependencies, required by the approved pages:**

- `shared/`: `tokens.css`, `base.css`, `components/*.css`, `nav-inset.js`,
  `title-fit.js`.
- `consolidation-pilot/<screen>/`: the consolidated per-screen CSS and JS
  (`settings.css`, `settings.js`, `strings.js`, `information.css`,
  `information.js`, `gpd.css`, `gpd.js`, `dd.css`, `td.css`, `cd.css`,
  `standings.css`, `explore.css`, the Home pilot) that the approved pages link.
- A few earlier screen pages that approved pages embed or link
  (`calendar/`, `explore/`, `standings/`, `refinement-01/`).
- Archivo is loaded from Google Fonts; the icon paths are from Lucide (ISC
  licence).

Do not delete or move any of these without re-running the capture scripts:
their paths are hard-coded in `tool/primer_review/*_refs.mjs`.

## Historical material

Kept because the decision log and backlog cite it. None of it is current
guidance, and each document of this kind carries a historical notice:

- **Early per-screen prototypes (Dark only):** `calendar/`, `standings/`,
  `explore/` (with `comparison-missing-media/`), `grand-prix-detail/`,
  `driver-detail/`, `team-detail/`, `circuit-detail/`, `settings/` (with
  `information/`), `refinement-01/`, and this folder's own `index.html` and
  `styles.css` (the first Home prototype, described below).
- **Consolidation pilots:** `consolidation-pilot/` pages, reports and the
  `tools/` visual-comparison harness.
- **Cross-screen experiments:** `cross-screen-refinement/calendar-stage1/`,
  `calendar-sticky-split/`, `calendar-title-fit/`, `caption-localization/`,
  `circuit-absence/`, `home-upcoming-omit/`, `notice-coexistence/`, and the
  experiment reports in `dark-state-boundaries/`.
- **Proposals, audits and checkpoints:** `CORE-DESIGN-DECISIONS.md`,
  `DESIGN-SYSTEM-CONSOLIDATION.md`, `HEADER-AND-HEADING-DECISIONS.md`,
  `LIGHT-THEME-FOUNDATIONS.md`, `STATUS-SEMANTICS-AUDIT.md`,
  `STATUS-LOCALIZATION-ACCESSIBILITY-REVIEW.md`, `DARK-THEME-READINESS.md`,
  `LIGHT-READINESS.md`, `PRE-CHECKPOINT-AUDIT.md`,
  `CHECKPOINT-PREPARATION*.md`, and
  `cross-screen-refinement/*EVIDENCE-RETENTION.md`.
- **Concept explorations before Primer V2:** `../../concepts/` (Stitch
  concept specifications) and `../../GridView_Pre_Redesign_UI_UX_Audit.md`.

## Validation output

Each prototype validation pass wrote screenshots, measurement JSON, text
reports and a copy of its capture scripts into a timestamped
`validation-YYYYMMDD-HHMMSS[-label]/` folder. Those folders are run output:
they are **not part of the published repository** (excluded in the 2026-11
history consolidation, 1,394 files) and are kept out of Git by
[`../../.gitignore`](../../.gitignore). The historical runs are retained in the
owner's backup of the original development history. Documents here still name
those folders as the evidence a decision was based on; treat the names as
citations, not as files to open. New validation runs stay local.

---

## Historical record: the first Home prototype (v1, 2026-11-07)

Everything from here to the end of this file describes the first hand-built
HTML/CSS prototype of Home (dark-first, `index.html` and `styles.css` in this
folder), as it was written then. It is superseded by the approved references
above and by the Flutter implementation; its "Remaining issues" were resolved
or moved into the backlog. Frozen staging data from
`../../shared-reference-data.md`.

- `index.html` — markup, inline SVG icon sprite (Lucide paths, ISC licence)
- `styles.css` — all styling; no JavaScript
- Font: Archivo variable (wdth 62–125, wght 100–900, OFL) from Google Fonts.
- Validation passes `validation-20261107-213322-final-padding/` (final,
  after the chip/tag padding fix flagged by the Impeccable hook),
  `validation-20261107-213048-final/` (with `touch-targets-320.txt`),
  `validation-20261107-212923-refined/` and `validation-20261107-212652-draft/`:
  not published (see "Validation output").

## Visual system

**One signature move: the livery cut.** Primer's 12° seam (`skewX(-12deg)`)
recurs at four scales, always meaning "this is the GridView mark":

1. Hero — the round number sits on a Red Oxide block with a 12° leading edge.
2. Championship — a 3px oxide seam separates points from the leader.
3. Latest result — the "Winner" tag is a small oxide parallelogram.
4. Navigation — the selected tab's icon sits on an oxide slab cut at 12°.

**Type: one family, the width axis as hierarchy.** Archivo throughout.
Figures are expanded (wdth 112–125, weight 800+, tabular): round, session
time, points, watermark. Names are condensed (wdth 78–88, weight 750–800):
GP names, session name, drivers. Labels and body run at normal width,
sentence case, 13px minimum, no tracked capitals. Scale steps:
13 / 15 / 20 / 24–30 / 44 / 68 / 92.

**Colour: Primer's palette, roles tightened.** Graphite ground #141518 and
tray #1F2125; Chalk #ECEAE5 text; Red Oxide #A03E2B only as surfaces on
graphite and as link text on Chalk; Ember #F08A6C as the accent text on
graphite (relative start, "Next session", View Calendar, Explore icons).
No other hues.

**Depth in three planes.** Lit graphite panel with soft offset shadow (hero),
inverted Chalk band (championship), faint outlined "22" watermark behind the
latest result (the Racing Editorial idea, using a real value).

**Each section composed differently, one identity:**

| Section | Composition |
|---|---|
| Header | Wide wordmark, season, last check; 48px refresh/settings |
| Featured GP | Lit panel: label + relative start + status on the left, oxide round block on the right, condensed name below, full-width "View Grand Prix" row with Chalk arrow disc; the whole panel is the link |
| Weekend sessions | Full-bleed tray band, no card: focus label + status, then session name opposite a 44px tabular time, date, time-zone caption. Grid supports up to three sessions |
| Championship | Chalk band: label, 68px points, oxide seam, name and team, oxide link row. Stacks under the points when narrow |
| Latest result | Open on graphite: heading + Final chip, condensed event name, round and circuit, oxide Winner tag, winner, link; watermark behind |
| Upcoming | One ruled line: "No upcoming events" opposite "View Calendar" |
| Explore | One segmented strip, three shortcuts split by 12° seams; becomes a list at large text |
| Navigation | Four destinations, icon above full label, selected = oxide slab + Chalk bold label, `aria-current` |

## Status vocabulary (accommodates the audit's states)

Meaning is word + shape, never colour alone. Rendered: `Status unknown`
(dashed outline), `Final` (filled Chalk + check). Defined in CSS, not shown
in this scenario: Scheduled (solid outline), Live (Ember fill), Cancelled /
Postponed (outline + icon), Race weekend / Sprint context chips (raised
fill, sit in the hero chip row), Provisional (dagger + word beside the
points). Tied leaders, "Leader unavailable", "No leader yet", latest-result
explanations, the refreshing label and stale or failed notices all have
places in this structure, but none is rendered here (base state only).

## Validation (Chrome 157 headless, DevTools Protocol, mobile emulation, DPR 2)

Text scaling: root font size 200%. All text is in rem and layout in px, so
this behaves like Android sp scaling. Display figures use `min()` caps that
mirror Android 14's non-linear font scaling.

| Check | 390×844 | 320×693 | 320×693 @200% | 390×844 @200% |
|---|---|---|---|---|
| Document width (no horizontal scroll) | 390 | 320 | 320 | 390 |
| Elements outside viewport | 0 | 0 | 0 | 0 |
| Clipped text | none (hero clips only its decorative oxide skew) | none | none | none |
| Text under 12px | 0 | 0 | 0 | 0 |
| End of scroll: content bottom → nav top | 748 → 776 (28px) | 597 → 625 | 581 → 625 | 732 → 776 |
| Document height | 1720 | 1854 | 3282 | 2955 |
| Font loaded | Archivo | Archivo | Archivo | Archivo |

Touch targets (320): all ≥48×48 (recorded in the unpublished
`validation-…-final/touch-targets-320.txt`).

Contrast (WCAG): Chalk/ground 15.2; secondary/ground 7.95; secondary/tray
7.0; Ember/ground 7.4; Ember/tray 6.6; Chalk/Red Oxide 5.4 (4.6 at the
light end of the gradient); Red Oxide/Chalk 5.4 (4.9 on the darker Chalk);
on-Chalk secondary 5.9–6.5.

Draft → final fixes: 320px hero clipped the status chip and squeezed the
label into three lines (hero switches to a top livery strip below 21em of
panel width); session date wrapped behind the status chip (status moved to
the focus row); nav labels broke mid-word at 200% (capped at 17px and
narrowed instead); 7px of content sat under the nav at 200% (bottom padding
now scales); "Round" clipped at 200%; the Explore seams were wrong when
stacked; the championship seam crossed the name at large text. After the
final pass the Impeccable hook flagged `cramped-padding`; status chips and
the Winner tag went from 3px to 6px vertical padding, and validation was re-run
(`validation-20261107-213322-final-padding/`, same results).

## Remaining issues

- Nav labels stop scaling at about 130% (17px cap) so the four labels stay on one line;
  needs an explicit accessibility decision before implementation.
- At 390 the driver's name wraps to two lines beside the points (by design;
  long names wrap further, never truncate). On phones narrower than ~368dp
  the hero uses the strip layout.
- The "22" watermark crosses the event and circuit lines at 11% opacity;
  verify legibility on a real OLED panel.
- The focused-session row links to the GP placeholder; the real destination
  of the tappable session card must follow existing app behaviour.
- The round shows visually as "23" above "Round" (screen readers get
  "Round 23"); confirm word order for Spanish.
- Dark theme only; light theme, Spanish and the conditional states are not
  captured yet. Validated in Chrome emulation, not on a device.
- Impeccable: the design-check hook ran on every edit with no mechanical
  findings. The visual critique followed Impeccable's critique method by
  hand; the Impeccable launcher was not run, because it downloads a binary.

## Data fidelity

Every visible string is either a frozen staging value or an app label:
GridView, 2026 season, Last successful check: 4:22, Next Grand Prix, Starts
in 2 days, Status unknown, Round 23, Abu Dhabi Grand Prix, Yas Marina Circuit,
View Grand Prix, Weekend sessions, Next session, Race, 17:00 GMT, Monday,
November 9, 2026, Your time zone: GMT, Drivers'/Teams' Championship leader,
Lando Norris, McLaren, 120/150 pts, View drivers'/constructors' standings,
Latest result, Final, Qatar Grand Prix, Round 22, Lusail International
Circuit, Winner, Upcoming events, No upcoming events, View Calendar, Explore,
Drivers, Teams, Circuits, Home, Calendar, Standings, Refresh Home, Settings.
The watermark repeats the confirmed "22". No session counts, countdown
precision, offsets, numbers, team colours, telemetry, live indicators,
images, logos or identifiers were added.
