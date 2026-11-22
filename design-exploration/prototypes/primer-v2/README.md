# GridView — Primer V2: Motorsport Editorial

Hand-built HTML/CSS visual prototype of Home (dark-first). Not a Flutter
implementation. Frozen staging data from `../../shared-reference-data.md`.

- `index.html` — markup, inline SVG icon sprite (Lucide paths, ISC licence)
- `styles.css` — all styling; no JavaScript
- Font: Archivo variable (wdth 62–125, wght 100–900, OFL) from Google Fonts.
- `validation-20261107-213322-final-padding/` — **current** screenshots and
  metrics (after the chip/tag padding fix flagged by the Impeccable hook)
- `validation-20261107-213048-final/` (includes `touch-targets-320.txt`),
  `validation-20261107-212923-refined/`, `validation-20261107-212652-draft/` —
  earlier passes, kept for comparison

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

Touch targets (320): all ≥48×48 (`validation-…-final/touch-targets-320.txt`).

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
