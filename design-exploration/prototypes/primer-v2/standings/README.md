# Primer V2: Standings visual prototype

The third screen to test whether Primer V2 works as a design system, after
Home (`../refinement-01/`) and Calendar (`../calendar/`). Neither of those
was modified.

| File | Role |
|---|---|
| `index.html` / `index.es.html` | English / Spanish prototype: Drivers and Constructors (frozen staging data) |
| `states.html` / `states.es.html` | **Development-only** state fixtures, copied from Flutter tests. Not app UI, not championship data |
| `build.py` | Generates the four pages from one data set (Python 3 stdlib only): `python build.py`. Edit the generator, not the HTML |
| `primer-core.css` | Byte-identical copy of `../calendar/primer-core.css` (the shared foundation) |
| `standings.css` | Standings additions. The header and notice rules are copied from `calendar.css` and marked as such |
| `states.css` | Styles for the fixture gallery only |
| `nav-inset.js` | Byte-identical copy of Home's adaptive navigation script |
| `standings.js` | Presentation only: selector switching, independent scroll offsets, selector fit, title fit, header budget |
| `validation-20261107-225756-final2/` | **Current** screenshots, metrics, touch targets, selector behaviour |
| `validation-…-pass1`, `-pass2`, `-pass3`, `-final` | Earlier passes, kept |

## Sources read

- `lib/features/standings/presentation/standings_screen.dart`,
  `standings_row_view.dart`
- `lib/features/standings/application/standings_ui_state.dart`,
  `standings_state.dart` (`summariseProvisional`)
- `lib/core/widgets/gv_rows.dart` (`GvStandingsRow`, `_RowScaffold`),
  `gv_segmented_control.dart`
- `test/screens/standings_widget_test.dart`, `test/database/standings_dao_test.dart`
- Audit §2.4 and §3.6 (ST01–ST19), §4.1–4.5
- `shared-reference-data.md`
- `lib/l10n/app_en.arb`, `app_es.arb`

## Data

### Main pages: frozen staging values (not real-world results)

| Pos | Driver | Team (from the standing) | Points | Wins |
|---|---|---|---|---|
| 1 | Lando Norris | McLaren | 120 | 3 |
| 2 | Alexander Albon | not established, so omitted | 64 | 1 |
| 3 | Fernando Alonso | Mercedes | 40 | 0 |
| 4 | Andrea Kimi Antonelli | Alpine | 7 | 0 |
| 5 | Paul Aron | Alpine | 7 | 0 |

Constructors: **1 · McLaren · 150 points**. Wins were not confirmed, so they
are omitted.

**Coverage limits (documented here, not in the UI):**
- The Constructors table has only the one confirmed row; no constructor
  names, points or positions were added to fill it.
- The Drivers table shows the five rows the staging screenshot confirmed. It
  is not a claim that the championship has five drivers.
- Neither table has a confirmed last-check time, provisional flag or team
  colour. Their status area is therefore empty, as in Flutter when nothing
  applies.

Positions 4 and 5 both have 7 points. They keep their own positions and
neither is treated as tied, because ties are read only from duplicate
`position == 1`.

### State fixtures (`states.html`)

Every row there is copied from an existing Flutter test fixture:

| # | State | Source |
|---|---|---|
| 1 | Leader only from a confirmed position 1; unranked row "—" ("Unranked Top" 999 pts, "Real Leader" 10 pts) | `standings_widget_test.dart` |
| 2 | Tied leaders ("Tied A", "Tied B", both P1, 100 pts) | `standings_widget_test.dart` |
| 3 | Delivered order kept (P9 delivered before P1) | `standings_widget_test.dart` |
| 4 | Unresolved name, shown as "Name unavailable" | `standings_widget_test.dart` |
| 5 | Unresolved team, so no team line ("Known Driver", 1 win) | `standings_widget_test.dart` |
| 6 | Decimal points: 0.5 / 0,5 (constructor `team-a`; no name in the fixture) | `standings_dao_test.dart` |
| 7 | Provisional, all rows agree: one notice, no row markers | `standings_widget_test.dart` |
| 8 | Provisional, rows disagree: only the provisional row is marked | `standings_widget_test.dart` |
| 9–11 | Background refresh, stale data, failed refresh (failure wording wins) | Status block only. 09:05 is the test's 09:05 UTC |
| 12–15 | Valid empty table, first-load error, season unavailable, loading skeleton (6 × 56px, as Flutter) | ARB copy |

Each fixture is its own mini table, so no snapshots are merged. The dashed
captions are prototype annotations. Everything inside the frames is app copy.

## Information preservation (ST01–ST19)

| ID | Element | Prototype |
|---|---|---|
| ST01 | Season heading | "2026 season" / "Temporada 2026", own row in the fixed header |
| ST02 | Championship selector | Drivers / Constructors. Selection shown visually (oxide 12° slab, Chalk bold label) and semantically (`aria-pressed`, group labelled "Championship" / "Campeonato") |
| ST03 / ST09 | Position | Contract value. "—" plus "Position unavailable" when unranked. Never a zero, never the list index. Duplicates kept |
| ST04 / ST10 | Name | As delivered, or "Name unavailable" |
| ST05 | Driver's team | From the standing only. Omitted for Albon |
| ST06 / ST11 | Points | Required. Locale decimal ("0.5" / "0,5"), trailing zeros dropped, zero kept |
| ST07 / ST12 | Wins | "3 wins" / "3 victorias". Zero shown ("0 wins"). Missing value omitted (McLaren). Never wraps between count and noun |
| ST08 / ST13 | Team accent | Supported in CSS (`.st--accent`, a 12° tick in the gutter) but not rendered: no team colour in the staging data or test fixtures |
| ST14 | Confirmed leader | Every `position == 1`. Ties use the tied wording |
| ST15 | Provisional | Uniform table: one caption notice. Mixed table: a "† Provisional" marker on provisional rows only. A missing flag claims nothing |
| ST16 | Last successful check | Selected table only. Fixture 10 |
| ST17 | Refreshing | "Refreshing…" replaces the time. Fixture 9 |
| ST18 | Stale / failure notice | Cached rows kept; failure wording takes precedence. Fixtures 10–11 |
| ST19 | Loading / empty / error | Scoped to the selected table. Fixtures 12–15 |

**Reading order.** Each row's accessible name is Flutter's exact
`semanticLabel`: position, name, team, points, wins, leader or tied status,
provisional. For example, "Position 1, Lando Norris, McLaren, 120 points,
3 wins, Championship leader".

**Leader label.** Flutter announces leadership only through semantics. The
prototype also shows the existing string ("Championship leader" / "Tied for
the championship lead") as visible text on the leader row. No new copy was
added.

Not rendered, as in Flutter: driver podiums and short codes.

## Behaviour

- **Default selection:** Drivers on the first visit of an app session.
  `StandingsUiState` keeps the selection across tab switches and detail round
  trips, and resets to Drivers on a fresh launch. The prototype opens on
  Drivers. `?championship=constructors` stands in for the explicit route
  `/standings/constructors/2026` (a screenshot aid, not a feature).
- **Independent scroll offsets:** each table remembers its own offset.
  Switching restores the other table's offset; a repeated tap changes nothing.
  This was verified in `selector-behaviour.txt`: Drivers scrolled to 400 →
  Constructors at 0 → back to Drivers at 400.
  - In the app, offsets live for the session and are scoped by season (a new
    season starts at the top).
  - Returning from driver or team detail does not reset the list (the state
    outlives the route).
- **Season scoping:**
  - Rows open `/drivers/:id` or `/constructors/:id` with the table's season as
    navigation origin (`#drivers/<id>` links here).
  - On an explicit season route, switching uses `go()` to the sibling route,
    so routes never stack.
- **Refresh:** the app-bar action and pull-to-refresh refresh the selected
  championship only. Selecting a championship never makes a request.

## Visual decisions

**A ranking you read straight across, not cards.**
- Positions and points form two numeric columns, positions on the left and
  points on the right, with names between them. All three share one baseline.
- Hairlines run gutter to gutter. Calendar's start at the name column, so the
  two lists are related but not identical.

**Numerical hierarchy.**
- Points: 24px Chalk, 800 weight, `wdth` 112, tabular figures.
- Positions: 28px `--text-2` (7.95:1), so they act as the index and the points
  are the value.
- Leader: the position grows to 36px in Red Oxide and the points to 32px,
  with "pts" set under the figure so the points column stays aligned.

**The leader is a Chalk row, not a hero.**
- Chalk is the colour Home gives the championship. Here it is one ranked row
  (108px at 390, against 74px for ordinary rows), not Home's leader block.
- A 12° Red Oxide seam separates position from holder (on Home it separates
  points from holder).
- An oxide kicker carries the existing leader wording.
- Tied leaders each get the strip with the tied wording.

**Selector.** The selected segment uses a Red Oxide slab cut at 12°, the same
selection vocabulary as the bottom navigation's selected tab. It is the
screen's second and last 12° use.

**12° audit.**
- Leader seam: marks the holder of the lead.
- Selected segment: marks the selection.
- Dividers, positions, points and ordinary rows stay straight. The unrendered
  team-accent tick would be the third use.

**Large text / narrow container (under 20em).**
- Points move under the name block, so names keep the full width.
- Names and teams wrap; nothing is truncated. Flutter's `maxLines: 1` +
  ellipsis is deliberately not reproduced.

## Design-system extensions

Proposals. None are applied to Home or Calendar.

| Extension | Why | Where |
|---|---|---|
| Ranked-row primitive: index column, value column, full-width hairline | Standings needs a value column. Calendar's row has none | `.st`, `.table` |
| Chalk leader row | "Chalk = championship leadership", carried from Home's leader band to a compact row | `.st--leader` |
| Segmented control with oxide 12° slab and adaptive fit (regular → condensed → stacked, measured in bold so it never jumps when the selection changes) | Home and Calendar had no selector | `.seg`, `standings.js` |
| Provisional marker (outline + "†" + word) | Home's chip vocabulary only mentioned it | `.chip--provisional` |
| Statistic no-wrap (`.st__stat`) | "0 victorias" split across lines at 200% | `standings.css` |
| **Title fit:** one unbreakable word narrows the width axis 118 → 100 → 84 → 72, then scales | "Clasificaciones" (15 letters) hit the actions even at 320 / 100%. Calendar's `14cqi` cap assumed about 10 letters. **Should replace that cap in the shared app bar** | `standings.js` |
| **Header budget:** when app bar + selector exceed 25% of the viewport, the app bar row scrolls away and only the selector bar stays pinned | At 320 @200% the fully fixed header plus the 2×2 nav left about 44% of the screen for the list (pass 1); with the budget it is 58%. **This departs from Flutter's fully fixed header at large text only. Owner decision needed. Calendar would benefit too** | `standings.js`, `.pinbar` |
| **Long selected nav label:** in condensed/stacked modes the selected label uses `wdth` 62 and weight 700 | Bold "Clasificaciones" pushed the Spanish nav to the tall 2×2 layout at 320 / 100%, and overflowed at 200%. Selection is still shown by the slab, the Chalk colour and `aria-current` | `standings.css` (end) |
| Empty / error block and pill button | First rendering of ST19 in Primer | `.empty`, `.btn` |

## Validation (Chrome 157 headless, DevTools Protocol, `mobile: true`, DPR 2; 200% = root font size)

Current run: `validation-20261107-225756-final2/`. Each row below is
Drivers / Constructors.

| Run | Overflow · text overflow · <12px | Title gap | Header | Selector | Nav | Clearance above nav (D / C) |
|---|---|---|---|---|---|---|
| EN 390×844 | 0 · 0 · 0 | 125 | pinned 82+77 | regular | regular | 196 / 510 |
| EN 320×693 | 0 · 0 · 0 | 55 | pinned | regular | regular | 26 / 341 |
| EN 390 @200% | 0 · 0 · 0 | 68 | pinned 104+81 | condensed | condensed | 24 / 400 |
| EN 320 @200% | 0 · 0 · 0 | 25 | app bar scrolls | stacked | stacked | 24 / 86 |
| ES 390×844 | 0 · 0 · 0 | 53 | pinned | regular | condensed | 196 / 510 |
| ES 320×693 | 0 · 0 · 0 | 13 (title `wdth` 100) | pinned | regular | condensed | 24 / 341 |
| ES 390 @200% | 0 · 0 · 0 | 9 | app bar scrolls | stacked | stacked | 24 / 237 |
| ES 320 @200% | 0 · 0 · 0 | 8 (title scaled) | app bar scrolls | stacked | stacked | 24 / 86 |
| States EN/ES 390, 320 @200% | 0 · 0 · 0 | – | – | – | – | – |

- **Touch targets at 320**, EN and ES, both views:
  - Actions 48×48, segments 140×48, tabs 78×61
  - Ordinary rows 320×74, leader 304×128–146, constructor leader 304×108
  - All OK. The 0×0 rows listed are the hidden table.
- **Contrast** (new pairs):
  - Oxide on Chalk: 5.43 (4.90 on the lower gradient stop)
  - Leader's team line on Chalk: 5.87
  - Chalk on the selector slab: 4.63–7.80
  - Unselected segment: 7.02
  - Positions: 7.95
- **Impeccable** (`impeccable detect`, engine 4.8.0):
  - The app pages had 0 findings in every pass, for both views, EN/ES, at
    390×844 and 320×693.
  - The fixture pages initially raised advisories:
    - "straggler" and "unbalanced heading" on the empty-state text, the status
      caption and my captions
    - "em-dash overuse" from my captions
  - Fixed with `text-wrap: pretty` / `balance` on those components and by
    rewriting the captions. Em-dashes in ARB copy were kept.
  - Final: 0 findings for all files and all rendered pages.
- **Defects found and fixed during validation:**
  1. "Clasificaciones" title collision (pass 1, negative title gap)
  2. Spanish nav stacking at 320 / 100% because of the bold selected label
  3. The stacked nav label overflowing at 200%
  4. Leader "pts" breaking the points column
  5. Selector layout depending on which segment was selected
  6. "0 / victorias" split across lines at 200%
  7. Fixed header taking 56% of the screen at 320 @200%

## Critical comparison with Home and Calendar

| | Assessment |
|---|---|
| Visual consistency | **Strong.** Same tokens, app bar, notices and nav. Chalk keeps its Home meaning (championship), Red Oxide keeps marking selection and key facts, and the 12° cut is used only on those |
| Information density | **Good.** 74px ordinary rows: at 390, about 8 rows fit under the fixed header, about 1,500px for 20 drivers. Denser than Calendar (119px rows) because the status chip line is gone |
| Numerical hierarchy | **Strong.** The two numeric columns, oxide leader position and the "pts" unit only on the leader make the scale readable at a glance |
| Scannability | **Good at 100%. Weaker at 200% / narrow,** where points move under the name and the right-hand points column disappears |
| Motorsport personality | **Moderate–good.** The timing-sheet columns and the livery seam work. Ordinary rows are still a familiar ranking list; the character is concentrated in the leader row and the selector |
| Accessibility | **Good.** AA contrast, 48px targets, Flutter's exact row labels, `aria-pressed` selector, no clipping, nothing hidden behind the nav. Not tested: TalkBack, real Android font scaling |
| Localization | **Good.** All copy from the ARB files, decimal comma, plural wins. The 15-letter Spanish title needed a new fit rule |
| Functional fidelity | **Good.** ST01–ST19 present or supported. Ranking semantics match Flutter (leader only from position 1; ties only from duplicate P1; delivered order; unranked "—"; uniform vs mixed provisional) |
| Repetitive patterns | All non-leader rows look the same; that is right for a ranking. The leader strip's large seam looks heavy when it wraps tall at 200% |
| Longer rankings | Suits 20+ rows. Nothing repeats per row except name, team · wins and points. Not tested: long constructor names, three-digit points with decimals ("232.5" is wider than "64") |

What still feels weak:

1. **Constructors looks empty.** One confirmed row under a full header looks
   like a broken screen. That is a data gap, not a design gap, but reviewers
   should not judge density from it.
2. **The tied-leader layout is heavy.** Two stacked Chalk strips spend about
   190px before position 2 starts.
3. **The uniform provisional notice is quiet.** It is a 13px grey caption,
   like Flutter's. It may deserve the notice component's weight; that is a
   product decision.
4. **Decimal points are right-aligned, not aligned on the decimal point.**
   "120" and "232.5" end at the same edge, so their units digits don't line
   up.

## Open issues

- **Header budget** (owner decision). If accepted, Calendar should adopt it
  and the rule moves into the shared core.
- **Title fit** should replace Calendar's `14cqi` cap in the shared app bar.
- **Selected nav label fallback:** the core change is proposed, not applied.
- **Flutter ellipsizes** names and teams (`maxLines: 1`); the prototype wraps
  them. Decide which the implementation follows.
- **Visible leader text:** the prototype shows the leader wording, which
  Flutter only announces. Confirm.
- **Team accent** is supported but not shown, because no fixture has a team
  colour.
- **Not covered:** light theme, device testing, TalkBack, and real
  Android non-linear font scaling (the prototype scales root rem; display
  figures are capped with `min()`).
- **No capture of state 9–11 with cached rows below.** The fixture page shows
  the status blocks on their own so that it never merges snapshots.
