# Primer V2: Grand Prix Detail visual prototype

The first Primer V2 detail screen. Home, Calendar, Standings and Explore were
not modified. No Flutter code was changed.

| File | Role |
|---|---|
| `index.html` / `index.es.html` | **Scenario A**: upcoming Grand Prix (English / Spanish) |
| `results.html` / `results.es.html` | **Scenario B**: completed Grand Prix with a race classification |
| `states.html` / `states.es.html` | **Development-only** state fixtures (26 frames). Not app UI, not race data |
| `build.py` | Generates the six pages from one data set (Python 3 stdlib only): `python build.py`. Edit the generator, not the HTML |
| `primer-core.css` | Byte-identical copy of the shared foundation (md5 `0d78851e…`, same as Calendar, Standings, Explore) |
| `gpd.css` | Grand Prix Detail additions. The notice rule is copied from Standings and marked as such |
| `states.css` | Fixture-gallery styles (copied from Standings, plus a few frame rules) |
| `gpd.js` | Presentation only: `?time=device\|event\|both` stands in for the existing time-display preference |
| `validation-20261108-112100-final/` | **Current** screenshots, metrics, touch targets, and the capture script |
| `validation-20261108-111757-pass2/` | Earlier gallery-only pass, kept |

Query aids (screenshot aids, not features): `index.html?time=event`,
`index.html?time=both`. Device is the default, as in Flutter.

## Sources read

- `lib/features/calendar/presentation/grand_prix_detail_screen.dart`,
  `widgets/grand_prix_hero.dart`, `grand_prix_event_info.dart`,
  `grand_prix_results_section.dart`
- `lib/features/shared/presentation/widgets/session_list.dart`,
  `screen_scaffold.dart`, `domain_status.dart`, `result_formatting.dart`
- `lib/core/widgets/gv_rows.dart` (`GvSessionRow`, `GvResultRow`)
- `lib/core/time/session_time.dart` (presenter, date range, Hm)
- `lib/features/home/domain/home_race_winner.dart` (winner rule)
- `lib/app/router/app_router.dart` (GP detail is on the **root navigator**:
  no bottom navigation)
- `test/screens/grand_prix_widget_test.dart`, `screen_golden_test.dart`,
  `test/time/session_time_test.dart`, `test/support/domain_fixtures.dart`,
  `router_harness.dart`
- `assets/dev_fixtures/grand-prix-2026-12.json`, `-13.json`, `home.json`
- Audit §2.4, §3.3 (S01–S05), §3.5 (GP01–GP17, R01–R15), §4.1–4.6, §5.6,
  §6.6, §8.1–8.4; `shared-reference-data.md`; `lib/l10n/app_en.arb`, `app_es.arb`
- intl 0.20.2 `es`/`en` date patterns (`E`, `MMMd`, `MMMEd`, `Hm`)

## Fixture provenance

**Why not the staging examples.** Abu Dhabi (R23, Yas Marina, status
unknown, a Race session) and Qatar (R22, Lusail, Norris winner) confirm only
Home-level fields. A detail page would need a full session list, format,
dates, time zone, and every classification row with points and timing. None
of that is confirmed, so building a detail page from them would invent most of
it. They are **not rendered**.

**Why not the bundled dev fixtures alone.** `grand-prix-2026-12/13.json` are
complete for the event, but the fixture build bundles no circuit locality or
race-result fixture (results would come back as not found). Rendering them
with results would need data from another source.

**What the pages use instead:** two internally consistent Flutter test
fixtures. Each is one test's whole input, never merged with another:

| Scenario | Source | Values (verbatim) |
|---|---|---|
| A, upcoming | `grand_prix_widget_test.dart` 'shows identity, status, format, location and dates': `_detail(officialName: …)` + `belgianSprintSessions()` + `circuitSpa()` | Belgian Grand Prix · Round 13 · 2026 · Upcoming · Sprint weekend · official name "Formula 1 Mock Belgian Grand Prix 2026" · 2026-07-24 → 07-26 · Europe/Brussels · Circuit de Spa-Francorchamps, Spa, Belgium · 5 sessions (Practice 1, Sprint Qualifying, Sprint, Qualifying, Race), all Scheduled · no classification → "Results not available yet" |
| B, results | `screen_golden_test.dart` 'completed grand prix with results': `_completedWeekend()` + `_raceDocument()` | Italian Grand Prix · Round 12 · 2026 · Completed · Standard weekend · no official name · 2026-07-10 → 07-12 · Europe/Rome · Autodromo Nazionale Monza, Monza, Italy · Qualifying, Race (Completed) · **Final** race classification: 1 Max Verstappen, Red Bull Racing, 25, 1:15:12.345 · 2 Lando Norris, McLaren, 18, +3.210 · — Charles Leclerc, Ferrari, DNF (no points, no timing) |

Harness context from `router_harness.dart`: device time zone **UTC**, clock
2026-07-18 12:10Z (fresh, so no stale notice), English/Spanish locale.

**Coverage limits (documented here, not in the UI):**
- Scenario B has three classification rows because the fixture has three. It
  is not a claim about field size. A 20-row race was not invented; density is
  judged from the 6-row fixture on the states page (frame 22).
- Scenario A's sprint sessions are **schedule rows** delivered by the fixture.
  No sprint classification is shown anywhere (see "Release scope").
- Leclerc's `dnfReason: 'Power unit'` is stored but not rendered, as in Flutter.
- `_raceDocument()` uses the shared `raceResultFixture` default id
  (`2026-belgian-grand-prix-race`) under round 12. The id is internal and
  never displayed.
- No fixture has a long Grand Prix name. Long text is tested through the
  official name, the circuit names, Spanish copy ("Resultados de la carrera",
  "Fin de semana al sprint", "Nombre del piloto no disponible") and 200% text.
- No fixture has media (`media: []`, and `content/media/media-rights.json` is
  empty). Every page is typographic; no photo, logo or circuit map was
  generated, borrowed or drawn.
- Proper names and API text (country names, session names, IANA ids) stay in
  English on the Spanish pages, as delivered.
- The fixture-build sample-data banner is omitted from the main pages (as in
  Explore) and shown on the states page, frame 26.

## Information preservation (audit §3.5, §3.3)

| ID | Element | Prototype |
|---|---|---|
| GP01 | App-bar event identity | Back + trimmed event name, always shown (sticky). "Grand Prix" while loading / not found / failed (states 1–3). One line + ellipsis like Flutter's AppBar; the full name is the hero heading |
| GP02 | GP name | Hero `h1`, condensed 32px, wraps, never truncated |
| GP03 | Official name | Under the name, only when present and different (A shows it, B has none) |
| GP04 | Round | Expanded 88px figure with "Round"/"Ronda" label; screen readers get "Round 13" |
| GP05 | Season | "2026 season" / "Temporada 2026" above the name |
| GP06 | Locality, country | Hero fact rail "Location", joined, missing parts dropped (state 6) |
| GP07 | Weekend dates | Hero fact rail "Dates", `MMMd – MMMEd` ("Jul 24 – Sun, Jul 26" / "24 jul – dom, 26 jul"), no conversion |
| GP08 | Event status | Required chip incl. "Status unknown" (state 8) |
| GP09 | Weekend format | Chip, incl. "Format unknown" |
| GP10 | Event/circuit image | No image area when absent, as Flutter. The band is complete without one; a future image would sit behind the band without changing its height |
| GP11 | Circuit name | Circuit row; omitted when unresolved (state 7) |
| GP12 | Event time zone | Raw IANA id under "Sessions", only when present (absent in state 6) |
| GP13 | Device time zone | Always shown under "Sessions" |
| GP14 | Full schedule | Every delivered session, delivered order, S01–S05 |
| GP15 | No sessions | "Schedule not available" + message (state 11) |
| GP16 | Freshness notices | Screen-level stale / refresh-failed notice (states 4, 5, 19); results refresh failure scoped to its section (state 18) |
| GP17 | Circuit navigation | "View circuit" row opens `/circuits/:circuitId` with the event's season; works with no circuit name (state 7) |
| S01 | Session name | Supplied name; humanised type; "Session"/"Sesión" for unknown (state 9) |
| S02 | Session status | Text under the name; Live / Cancelled / Postponed as chips with icon |
| S03 | Primary date | Day group header from the primary clock ("Fri Jul 24" / "vie 24 jul") |
| S04 | Primary clock + zone | 22px tabular time + zone ("10:30 UTC"; Spanish `H:mm`) |
| S05 | Secondary clock | Both mode: second line, only when it differs; carries its own day when it crosses a date (state 14) |
| R01 | Section title | "Race results"; generic "Results" for other types (see Release scope) |
| R02 | Classification status | Final (Chalk + check), Provisional, Not available (outline), Status unknown (dashed) (states 20, 25) |
| R03 | Position | Value or "—"; duplicates kept (state 23); never the list index |
| R04/R05 | Driver / team | As delivered, or "Driver/Team name unavailable" in italic (states 23, 24) |
| R06 | Points | Locale decimal ("18.5" / "18,5"), with "pts"; missing points omitted, never 0 (states 22–23) |
| R07 | Finish status | Lapped / DNF / DNS / DSQ / DNQ / unknown as outline chips; "Finished" hidden visually, kept in the row label |
| R08–R11 | Timing | Elapsed → gap → laps behind (>0) → supplied text; nothing when all absent |
| R12 | Fastest lap | Chip with stopwatch; no lap time or number (state 21) |
| R13 | Driver action | Whole row opens `/drivers/:id` with the classification season |
| R14 | Team action | Separate 48px team link, "Open team {name}" or "Open team" |
| R15 | Results loading / unavailable / error | Scoped to the results section; the weekend stays (states 15–17) |

Not rendered, as in Flutter: session end time or duration, countdown,
lap-by-lap data, grid positions, fastest-lap time, any identifier.

## Behaviour preserved

- **Navigation structure:** root-navigator detail screen. App bar with back
  only; no bottom navigation, no refresh action, no pull-to-refresh (GP detail
  only offers retry on first-load errors). The only page bottom space is the
  safe area + 32px.
- **Loops:** the circuit link and team/driver links use `openEntity()`, which
  collapses an immediate A → B → A return into `pop()`. The prototype links
  are static anchors (`#circuits/…`, `#drivers/…`, `#constructors/…`).
- **Independent resources:** detail and results each have their own loading /
  failure presentation. A results failure never blanks the weekend; a detail
  first-load failure shows no results area (the results area mounts inside
  ready detail, audit §4.1).
- **Stale aggregation:** remote builds show one stale notice at the top for
  stale detail or stale results; the result section then adds only its own
  refresh-failure notice (states 18–19). No timestamp is displayed (audit §4.3).
- **No countdown or relative time:** the detail screen has none.

## Visual decisions

**A race-control sheet, not Home's hero.** Home's featured GP is a lit,
rounded panel with an oxide round block on the right and a "View" row. Here:

1. **Identity band (full-bleed, square).** Round figure | 12° Red Oxide seam |
   season, name and official name. The seam is Primer's "figure | holder"
   grammar (Home's championship band, Standings' leader row), now at hero
   scale. Status and format chips sit above; a darker **fact rail** under the
   band carries Dates and Location. At 390 the band including the rail is
   about 290px (scenario A, with an official name), the circuit row ends at
   ~440px and the schedule starts by ~470px, all inside the first screen.
2. **Circuit row.** One ruled row: "Circuit" kicker, condensed circuit name,
   Ember "View circuit", Chalk arrow disc (Home's "opens an entity" affordance).
3. **Timetable.** Time first in a fixed column, so a weekend scans downward;
   day headers with a hairline rule. Consecutive sessions on the same primary
   day share one header (run-length grouping, never re-sorted). The time-zone
   facts sit with the schedule they explain.
4. **Timing tower.** Classification positions sit in a continuous tray rail at
   the screen edge. The confirmed winner's cell is the only Red Oxide block,
   with a 12° livery edge, plus an Ember "Winner" kicker. Points are the
   right-hand value column, as in Standings, with "pts" on every row (a race
   classification has a points column and a timing column, so the unit
   disambiguates). The rail, the per-row unit, the timing line and the team
   links make it read as a classification, not a championship table.

**Type.** Archivo only. Expanded figures (round 88px, times 22px, points
22px, positions 24px), condensed names (GP 32px `wdth` 78, sessions and
drivers 17px `wdth` 86), labels 13px, nothing under 13px.

**Colour roles unchanged.** Red Oxide only as surfaces (seam, winner cell);
Ember only as accent text on graphite (View circuit, Winner) and the notice
icon; Chalk for the Final chip and the arrow disc. No other hues.

**12° audit.** Hero seam (identity), winner cell (key fact). Nothing else is
slanted. The livery edge is clipped inside the rail (17px run over the 80px
row = 12°); taller rows at 200% make it steeper.

**Large text / narrow.** Container queries, no viewport hacks:
- Band under 20em: figure shrinks to 64–72px with the round/season labels
  beside it; the name takes the full width below.
- Schedule under 22em: time above the name.
- Classification under 21em: points, timing and chips move under the name.
- Team names wrap; the chevron is bound to the last word.

## Design-system extensions (proposals; nothing applied to other screens)

| Extension | Why | Where |
|---|---|---|
| Detail app bar: back + one-line title, sticky, hairline | First detail screen in Primer; primary screens use the wordmark bar | `.dbar` |
| Grand Prix identity band (figure \| seam \| name, fact rail) | Event identity without a decorative hero; adaptive at 20em | `.gp` |
| Labelled fact rail (`dl`) | Dates / Location as labelled facts, two columns → one | `.gp__facts` |
| Entity navigation row | Kicker + name + action + Chalk disc; reusable for "View team/driver" | `.cx` |
| Schedule session row + day header | Timetable with fixed time column, Both-clock second line | `.sess`, `.day__label` |
| Time-zone caption | Event + device zone with the schedule | `.zones` |
| Classification row with position rail | Timing tower; separate team action above the row link | `.cl`, `.cls` |
| Winner cell | Oxide block with 12° edge, only from the Home winner rule | `.cl--winner` |
| Result/finish chips | `chip--done`, `--alert` (with icon), `--outline`, `--fastest`, `--sm` | `gpd.css` |
| Inline empty/error block | `.empty--inline` for section-scoped states | `gpd.css` |
| Detail skeleton | Band-shaped block + label + 3 × 48px, as `_DetailSkeleton` | `.skel` |

## Validation (Chrome 157 headless, DevTools Protocol, `mobile: true`, DPR 2; 200% = root font size)

Run: `validation-20261108-112100-final/` (script `capture.mjs` included, no
dependencies). 24 runs: EN/ES × A/B × 390×844, 320×693, each at 100% and
200%, plus Event-clock (320) and Both-clock (390) captures, plus the states
gallery at 390 and 320 @200%.

| Check | Result (all 24 runs) |
|---|---|
| Width client / scroll / visual viewport | exactly the requested width |
| Elements outside the viewport | 0 |
| Clipped text (overflow hidden) | 0; the app-bar title never needed its ellipsis |
| Text spilling out of its box | 0 |
| Text under 12.5px | 0 |
| Touch targets < 48×48 | 0 (`*-touch-targets-320.txt`: Back 48×48, circuit row 320×114, driver rows 320×81–100, team links 76–136×48) |
| Archivo loaded | yes |

Document heights (EN / ES): A 1127 / 1148 at 390, 2314 / 2345 at 320 @200%;
B 1037 / 1059 at 390, 2049 / 2117 at 320 @200%.

**Contrast (new pairs):** Chalk on the lit band 11.8; secondary on the band
6.18; secondary / Chalk on the fact rail 7.44 / 14.2; Ember on ground 7.44;
Chalk on the winner cell 4.63 (light stop) to 7.80; Chalk on the rail 13.4;
Chalk on raised chips 11.5. All other pairs as in earlier screens.

**Reading order:** app bar (Back, title) → notices → chips → "Round 13" →
season → name → official name → dates, location → circuit link → Sessions,
time zones, day headings, rows (time, name, status) → results heading, status,
rows. Each classification row is one link with Flutter's label (plus
", Winner" on the winner row), followed by its "Open team …" link; the visual
row content is `aria-hidden` so it is not read twice.

**Reduced motion:** the only motion is the 3px arrow nudge on hover; the core
`prefers-reduced-motion` rule removes it. No animation anywhere.

**Impeccable** (`impeccable detect`, engine 4.8.0):
- Source files: 0 findings for all six pages. One advisory on the states pages
  ("flat type hierarchy": 15px gallery captions against 15px body). Fixed by
  raising the caption titles to 19px; re-scan: 0 findings, 0 advisories.
- Rendered pages over a local server (A, B, Both-clock, states, EN/ES): 0.

**Defects found and fixed during validation:**
1. The winner cell's 12° extension overlapped "Winner" and the driver name.
   Now clipped inside the rail.
2. The second session of a day group was indented differently (hairline
   layout hack). Rebuilt with one grid and a positioned hairline.
3. Double rule between the app bar and the band. The band now sits flush.
4. At 200% the team chevron wrapped onto its own line. Bound to the last word.
5. Gallery links were 24px tall. Now 48px.
6. At 320 @200% a gallery caption ("Classification") spilled out of its box
   and widened the page to 372px. The old check missed it because the element
   had `overflow: visible`; the script now also reports **spill**, and every
   run was re-captured with it.

## Critical assessment

| | Assessment |
|---|---|
| Consistency with Primer V2 | **Strong.** Same tokens, chips, notices, figures and seam grammar. Chalk keeps its meanings (confirmed/Final, entity action), Red Oxide stays a surface |
| Motorsport personality | **Good.** The round figure + seam, the timetable and the timing-tower rail give it more character than Calendar or Standings, using only real values |
| Event hierarchy | **Good.** Name, round, status and when/where fit in the first screen at 390; the circuit link follows |
| Schedule readability | **Good.** Times scan down one column; day headers break the weekend into three. Repeating "Scheduled" on every row is noise inherited from S02 |
| Results density | **Adequate.** 81px rows (100px winner) against Standings' 74px: the 48px team action costs height. 20 rows ≈ 1,640px |
| Navigation clarity | **Good.** One arrow-disc row for the circuit; driver rows and underlined team links are distinct targets |
| Accessibility | **Good** in emulation: AA contrast, 48px targets, no clipping at 200%, explicit labels. Not tested with TalkBack |
| Localization | **Good.** Spanish dates and `H:mm`, decimal comma, long Spanish headings wrap |
| Data fidelity | **Strong.** Fixture values only; absent fields omitted by Flutter's rules |
| Unavailable media | **Strong.** The page is designed typographically; no placeholder slot to look empty |

What still feels weak or generic:
1. **Scenario B looks thin** (three rows). Fixture gap, not design gap.
2. **The fact rail duplicates nothing but costs ~70px.** On a completed event
   the dates matter less; a one-line form could be tighter.
3. **The completed weekend still shows its full schedule above the results**
   (Flutter order). Users opening a finished race scroll past it.
4. **The "Status unknown" session state is plain grey text**, quieter than
   Home's dashed chip; consistent with Flutter's neutral tone, but it reads
   like "Scheduled".
5. **The winner cell at 200%** gets a steep edge on tall rows (clip-path uses
   a fixed run).

## Differences from Flutter that need approval

1. **Dates and location once.** Flutter repeats them in the hero meta line and
   the factual card; the prototype shows them once in the fact rail.
2. **Time zones moved** from the factual card to the Sessions header.
3. **Circuit card → one navigation row.** The "Circuit" section title becomes
   the row's kicker; the link's accessible name adds the circuit name
   ("View circuit, Circuit de Spa-Francorchamps").
4. **Schedule grouped by day** (run-length of the primary day label), with time
   first; Flutter shows "day · status" per row with the time trailing. Reading
   order becomes time, name, status.
5. **Visible "Winner"** on the race winner (Home's `homeWinnerLabel` and
   `home_race_winner.dart` rule), added to the row label. Flutter's GP detail
   shows no winner. Same kind of decision as Standings decision 5.
6. **"pts" unit** on classification points (Home's `homePointsValue`).
7. **Finish status and fastest lap** move from the subtitle into the value
   column as chips.
8. **Team action layout:** a 48px team link inside the row instead of a
   separate 48px row below; driver row is an overlay link.
9. **Name wrapping:** names and teams wrap instead of `maxLines: 1` +
   ellipsis (Standings decision 4).

## Release scope (sprint results)

The 2.0.0 decision is race-only (audit §6.6, §8.4 item 1), while the Flutter
renderer still draws sprint and other classifications as separate sections.
The prototype shows **only race classifications**. The section component
would handle another type the same way (its own titled section, never
merged), but no sprint frame is rendered, so nothing here authorises sprint
results. This discrepancy still needs the owner decision listed in §8.4.

## Open issues

- Owner approval for the nine differences above.
- Sprint renderer vs race-only release (above).
- A long Grand Prix name and a 20-row classification need real fixtures to
  judge.
- Blank stored name, verified 2026-11-08 (see `../DESIGN-DECISIONS.md`):
  - **Closed for the app bar:** the "Grand Prix" / "Gran Premio" fallback is
    PR #103 (`46f621b`, 2026-11-04) and is present on this branch.
  - **Open for the hero heading only:** `grand_prix_hero.dart` still renders
    the raw name, and the contract allows a blank one. Reported, not
    rendered, Flutter not modified.
- `_raceDocument()` id inconsistency in the golden fixture (internal only).
- Not covered: light theme, TalkBack, device testing, real Android non-linear
  font scaling (the prototype scales root rem; figures are capped with `min()`).
