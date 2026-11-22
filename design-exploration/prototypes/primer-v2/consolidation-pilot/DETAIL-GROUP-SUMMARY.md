# Entity and event detail consolidation pilots: family summary

**Status: technical experiment.**

- Step 43 (2026-11-09): Driver, Team and Circuit Detail.
- Step 44 (2026-11-10): Grand Prix Detail, which closes the detail family.

**No decision is made or changed here.** The four pilots, each run on its
own:

- [`grand-prix-detail/`](grand-prix-detail/REPORT.md)
- [`driver-detail/`](driver-detail/REPORT.md)
- [`team-detail/`](team-detail/REPORT.md)
- [`circuit-detail/`](circuit-detail/REPORT.md)

The approved prototypes are unmodified. Home and Settings were not
consolidated. Nothing outside `design-exploration/` changed.

## Result

Final evidence, all on Chrome 157.0.8103.39 (2026-11-10), each with a
baseline-vs-baseline control of 0:

| Pilot | Runs | Screenshot pairs | Differing pixels | DOM / style / box / metric diffs | A11y-tree diffs | Assertions true in both versions | Folder |
|---|---|---|---|---|---|---|---|
| Grand Prix Detail | 105 | 385 | **0** | 0 | 0 | 144 / 144 | `grand-prix-detail/validation-20261110-073121-regression/` |
| Driver Detail | 56 | 146 | **0** | 0 | 0 | 76 / 76 | `driver-detail/validation-20261110-070509-recheck/` |
| Team Detail | 74 | 187 | **0** | 0 | 0 | 86 / 86 | `team-detail/validation-20261110-070509-recheck/` |
| Circuit Detail | 74 | 152 | **0** | 0 | 0 | 70 / 70 | `circuit-detail/validation-20261110-070509-recheck/` |

Driver, Team and Circuit were rechecked after they switched to
`detail-page.css`. Their 2026-11-09 evidence
(`validation-20261109-220615-regression/`, Chrome 157.0.8103.38, also 0) is
kept.

Every pilot covers:

- EN and ES; 390×844 and 320×693; 100% and 200% text;
- every scenario page (GP also in its three clock modes) and the state
  gallery;
- keyboard walks with role, accessible name, locator and resolved target per
  stop;
- forced `:hover` / `:active`;
- navigation (every route, plus Enter on Back);
- data assertions;
- reduced motion;
- accessibility trees, computed styles, boxes and touch targets.

## 1. Detail app bar

- **Identical in the four sources.** `.dbar` and `.dbar__title` are
  identical in `gpd.css`, `dd.css`, `td.css` and `cd.css`.
- **Markup:** `<header class="dbar">` + `a.icon-btn.dbar__back` +
  `p.dbar__title` everywhere. GP adds `title="<event name>"`, which is
  preserved.
- **Shared** in `shared/components/detail-app-bar.css` (Step 43). Settings'
  bar is a different variant and stays local.
- **No title policy change.** The bars still ellipsize on one line (XS-07
  untouched).

**Truncation (Step 44).** No approved fixture truncates: the longest titles,
"Belgian Grand Prix" and "Italian Grand Prix", fit at 320×693 @200%. A
labelled development-only stress page used two existing 2026 event names
from `content/registries/events.development.json`:

- "Barcelona-Catalunya Grand Prix" truncates at 390@200%, 320@100% and
  320@200%;
- "United States Grand Prix" truncates at 320@200% only.

In both versions:

- the full name stays in the identity heading, the `title` attribute, the
  bar text and the accessibility tree (StaticText and inline text box in
  full): the truncation is visual only;
- Back stays 48×48, the bar 57px, with no overlap and no spill.

Details: [`grand-prix-detail/REPORT.md`](grand-prix-detail/REPORT.md) §3.

## 2. Shared components

| File | Origin | Consumers |
|---|---|---|
| `components/detail-app-bar.css` | Step 43: `.dbar`, `.dbar__title` (identical ×4) | GP, Driver, Team, Circuit |
| `components/empty-state-detail.css` | Step 43: opt-in detail size, 28px icon / 18px title (identical ×4); the list screens keep 32px / 20px | GP, Driver, Team, Circuit |
| `components/detail-page.css` | **Step 44:** `.page`, `.sec`, `.sec__title` (identical ×4). Loaded last among the shared files; no cascade competitor in any of the four stylesheets | GP, Driver, Team, Circuit |
| tokens, base, app-bar, section-title, chip, notice, empty-state | Reused unchanged | + the four detail pilots |

The pre-existing shared files are byte-unchanged in both steps. Each detail
stylesheet removes exactly the moved rules (13 each since Step 44) and keeps
`.notice { text-wrap: pretty; }` as a local extension. Calendar still lacks
it (XS-09).

## 3. Evaluated, intentionally not extracted

| Pattern | Finding | Why it stays local |
|---|---|---|
| `.page-notice` | GP `12px gutter 0`; Driver, Team, Circuit `12px gutter` | Differs |
| `.btn:hover` (Chalk-low) | Driver, Team, Circuit; **not** GP, Standings or Explore | Sharing it would add a hover to GP and the list screens. GP's forced hover is identical in both versions: none introduced |
| `.empty--inline` (GP) | Section-scoped empty and error states | GP only |
| `.about` | Driver, Team | Two consumers; editorial measure |
| Read-only facts | Driver `.fact`, Circuit `.fact` (different layouts, same class name), Team `.sheet`, GP `.gp__facts` | Not one pattern |
| Identity headings | `.dp__name` 40px `wdth` 78; `.tb__name` 36px `wdth` 90; `.ch__name` 40px `wdth` 72; GP `.gp__name` 32px `wdth` 78 | Deliberate per-entity identity |
| Destination and entity rows | Driver `.ch__link` = Team `.dest` (identical declarations, different classes); Circuit `.rx`, GP `.cx` (kicker + disc) | Different classes. Sharing needs markup |
| Focus / pressed | `:hover` 3% Chalk and `:focus-visible` −3px / 4px on `.st__hit`, `.ch__link`, `.dest`, `.lu__hit`, `.rx`, `.cx`, `.cl__hit`. `:active` is the tray on six of them, but **GP's `.cl__hit:active` is a 6% Chalk overlay** | Same pattern on seven selectors, but not identical. Needs a decision and a shared class. (The Step 43 summary called all seven identical; corrected here) |
| Status chips | Core shared. The GP additions (`--done`, `--alert`, `--outline`, `--fastest`, `--sm`) are copied into Driver (`--outline`), Team (`--outline`) and Circuit (`--done`, `--alert`) | XS-11 open |
| 12° geometry | Driver board, tick, seam: skew. Team rail: height-derived `clip-path`. Circuit ticks and seam: skew. GP seam: skew; **winner cell: fixed 17px run** | XS-27 open |
| Skeletons, banners, boards, timetable, classification | Screen compositions | Screen-specific |

## 4. Verified differences across the family (preserved)

| Topic | Grand Prix | Driver | Team | Circuit |
|---|---|---|---|---|
| Identity | Round figure \| 12° oxide seam \| name; fact rail | Red Oxide number board | Banner + team-colour rail | Circuit sheet + dimension line |
| Season context | Season line above the name | Season line on the plate (DR-02) | Season line in the banner (DR-02) | In the related section only (PD-13) |
| App-bar title | Event name (truncates only with long names: stress test) | "Driver" / "Piloto" | "Team" / "Equipo" | "Circuit" / "Circuito" |
| Null / unknown | Missing values omitted; "—" position; DNF with no points | "From season start" for a null/null span | Null/null span omitted, role kept (TEAM-05) | Approved "No Grand Prix this season" in the partial scenario, unresolved distinction kept |
| Team colour | n/a | Tick, no edge | TM-03 Chalk edge below 3:1 | n/a |
| Links | Circuit; driver + team per classification row | Relevant span → team; standings | Each entry → driver; standings | Related Grand Prix |
| Hover on retry button | **None** | Chalk-low | Chalk-low | Chalk-low |

## 5. Grand Prix scenario coverage (Step 44)

- **Upcoming Belgian GP:**
  - round 13; Upcoming + Sprint weekend;
  - Spa circuit link;
  - five sessions in delivered order (Practice 1, Sprint Qualifying, Sprint,
    Qualifying, Race), in device / event / both clocks, all Scheduled;
  - no classification.
- **Completed Italian GP:**
  - round 12, Completed;
  - one race classification (Final) in delivered order;
  - winner highlight on row 1 only;
  - 25 / 18 points, timing, Leclerc DNF with nothing invented;
  - driver and team routes.
- **Sprint:** sessions stay in the schedule. **No sprint results** exist or
  were invented: race-only release scope; the renderer question stays open.
- **Gallery (26 frames):** loading, not found, first-load failure, stale,
  refresh failed, missing values, session states, no sessions, clocks,
  results loading / unavailable / failure / refresh failed, provisional,
  fastest lap, finish statuses, duplicates, unresolved names, chip
  vocabulary, fixture banner.

## 6. Previous pilots after Step 44

Shared CSS (`detail-page.css`) and the detail run matrix changed, so all six
earlier pilots were re-run. The earlier evidence is untouched.

| Check | Runs | Pairs | Differing pixels | Other diffs | Folder |
|---|---|---|---|---|---|
| Calendar | 39 | 119 | **0** | 0 | `validation-20261110-070509-calendar-recheck/` (+ control 0) |
| Standings | 39 | 168 | **0** | 0 | `standings/validation-20261110-070509-recheck/` (+ control 0) |
| Explore Alternative B | 66 | 285 | **0** | 0 | `explore/validation-20261110-070509-recheck/` (+ control 0) |
| Driver, Team, Circuit | see Result | | **0** | 0 | `*/validation-20261110-070509-recheck/` (+ control 0) |

All assertions are true in both versions, and no report contains a local
path.

## 7. Tooling changes

**Step 43**, in `tools/visual-compare.mjs`:

- **Repository-relative reports:** `<repo>/…` URLs and relative folders in
  `summary.txt`.
- **Keyboard trace:** computed role and accessible name, a structural
  locator and the resolved, normalised href per stop. A first version that
  stored the raw href produced false "differences" in the deeper Standings
  pilot. It was fixed, and all configs were re-run.

**Step 44:**

- `tools/detail-common.mjs`: optional `queries`, `extraPages` and
  `extraRuns`, additive. The Driver, Team and Circuit run lists are
  unchanged: same counts.
- `tools/grand-prix-detail.config.mjs`.

`visual-compare.mjs` itself is unchanged since Step 43. No dependency or
tool version was installed or updated. Chrome updated itself between the
steps (157.0.8103.38 → .39). Baseline and pilot always run in the same
session, so comparisons are unaffected.

## 8. Remaining design and functional questions (unchanged)

- XS-03 / XS-04: reading order, label parity.
- XS-06 / XS-07: header budget, title policy, including the detail ellipsis
  now measured with long names.
- XS-11: the unknown / provisional chips and GP's grey "Status unknown"
  session text.
- XS-25: team-colour contrast.
- XS-27: 12° geometry.
- XS-22: notice icons.
- XS-12: points unit.
- XS-09: drift kept as local extensions; the pressed-state difference above.
- G-1 to G-9 and GP's nine Flutter differences; the sprint renderer vs the
  race-only release.
- PD-11 / DRV-01, PD-12 / TEAM-01 / TEAM-05, PD-13 / CIR-01.
- Circuit's absent-event vs incomplete-calendar distinction.
- The duplicate `gp-name` id in multi-band galleries (development galleries
  only).
- Fixture gaps: a long GP name, a 20-row race.
- Device, TalkBack and Android font scaling: no evidence for any screen.

Shared CSS closes none of them. No backlog ID was added; nothing was approved
or closed.

## 9. Ready for Flutter implementation planning?

**Ready for planning, not for implementation.** The four detail screens now
provably share one foundation:

- tokens, base, chips, notice and section title;
- a detail app bar, a detail-size empty state and a detail-page scaffold.

Everything else is a screen composition. This maps cleanly to planning work:

- **Shared widgets:** a `GvDetailAppBar`, a detail-scaffold padding rule, and
  a detail size for `GvEmptyState`.
- **Screen-level widgets:** each identity band.

Two kinds of work have to come before implementation.

**Owner decisions that change shared widgets:**

- the title policy (XS-07), which the stress test now informs;
- one pressed / hover vocabulary for rows, including GP's `.cl__hit:active`
  and the retry-button hover;
- the chip vocabulary (XS-11);
- 12° geometry (XS-27);
- team-colour contrast (XS-25);
- the reading-order and label policy (XS-03 / XS-04);
- the Flutter foundation tokens (XS-28, P0).

**Evidence that does not exist yet:** device and TalkBack checks, plus the
fixture gaps.

## 10. Recommended next consolidation target

**Settings** (root and preferences). It has its own detail-bar variant
(21px, wraps), a fifth `primer-core.css` copy, and information screens that
load from `../`. It should reuse tokens, base, notice and possibly
`detail-page.css`, and keep its bar variant local until XS-07 is decided.
**Home** (`refinement-01/`) comes last: it inlines the core rather than
loading it, so it needs the most careful cascade work.
