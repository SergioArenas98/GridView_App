# Primer V2: Calendar visual prototype

The first screen to test whether the approved Primer V2 Home
(`../refinement-01/`) works as a design system. Home, its baseline and all
earlier validation folders are unchanged.

| File | Role |
|---|---|
| `index.html` / `index.es.html` | English / Spanish prototype |
| `primer-core.css` | Shared foundation copied **unchanged** from `../refinement-01/styles.css`: tokens, base, icons, app bar, section title, chips, livery tag, text link, bottom navigation |
| `calendar.css` | Calendar-only additions. Loads after the core file and does not override it, except for the sticky app bar and the screen-title cap described below |
| `nav-inset.js` | Unchanged copy of Home's adaptive navigation and bottom-inset script |
| `calendar-states.js` | Presentation-only preview of the header's conditional states (see "States") |
| `validation-20261107-221517-pass2/` | **Current** screenshots, metrics and touch targets |
| `validation-20261107-221213-pass1/` | First pass, kept (shows the title collision fixed in pass 2) |

## Sources read

- `lib/features/calendar/presentation/calendar_screen.dart`,
  `widgets/calendar_event_card.dart`, `widgets/calendar_scroll_anchor.dart`,
  `features/shared/presentation/domain_status.dart`
- Audit §2.4 (navigation), §3.4 C01–C16, §4.1–4.6
- `lib/l10n/app_en.arb`, `app_es.arb`

## Scenario (frozen staging values)

| Round | Grand Prix | Circuit | API status | Client relevance |
|---|---|---|---|---|
| 20 | São Paulo Grand Prix | Autódromo José Carlos Pace | Unknown | none |
| 21 | Las Vegas Grand Prix | Las Vegas Strip Circuit | Unknown | none |
| 22 | Qatar Grand Prix | Lusail International Circuit | Unknown | none |
| 23 | Abu Dhabi Grand Prix | Yas Marina Circuit | Unknown | **Next** |

These four rows are a visible sample, not the whole season. A dashed
prototype note says so on the page ("Prototype sample: rounds 20–23 only").
The note is not app UI and its text is not an app string.

Not in the frozen data, so not shown: locality, country, weekend dates,
sprint format, and a Calendar last-check time. The "4:22" check time on Home
belongs to the Home resource. The audit forbids presenting it as the Calendar
resource's time (§4.3). Rounds 20–22 are not marked completed or past; their
status stays "Status unknown" (§4.4).

## Information checkpoints

| ID | Element | In the prototype |
|---|---|---|
| C01 | Season heading | "2026 season" / "Temporada 2026", fixed header, own row |
| C02 | Round number | Leading figure, from the round field, never the list index |
| C03 | GP name | Main row text, delivered name in both languages |
| C04 | Circuit name | Subtitle line |
| C05–C07 | Locality, country, dates | Accommodated in CSS (`.ev__meta`: "Locality, Country · dates", missing parts dropped with their separator). Not rendered: unconfirmed |
| C08 | Event status | Required chip in every row, including "Status unknown" |
| C09 | Sprint chip | Accommodated (`.chip--context`). Not rendered: unconfirmed |
| C10 | Next designation | Round 23: Ember "Next" / "Siguiente" label, band, oxide round block |
| C11 | Current emphasis | Accommodated (`.ev--current`: band and block, no extra label, as in Flutter). Not rendered |
| C12 | Completed dimming | Accommodated (`.ev--completed`: 0.72 opacity, text kept). Not rendered |
| C13 | Last successful check | Conditional. Hidden in the base state (no Calendar time in the data) |
| C14 | Refresh progress | `?state=refreshing` shows "Last successful check: …" / "Comprobado: …" |
| C15 | Stale / failed notice | `?state=stale`, `?state=failed`. Failure wording wins if both apply |
| C16 | Empty / error copy | Not rendered (ready state only). See open issues |

Actions: Refresh ("Refresh calendar" / "Actualizar el calendario"), Settings
("Open settings" / "Abrir ajustes"), each row opens `/calendar/2026/:round`
(static `#calendar/2026/:round` links), four destinations with Calendar
selected (`aria-current="page"`). The Home tab links to the refined Home
prototype. Pull-to-refresh is native behaviour and is not simulated.

## Scroll behaviour (documented, not simulated)

- **First open:** `CalendarScrollAnchor` positions the relevant event once,
  immediately (no animation), at 15% from the top of the list viewport
  (`kCalendarAnchorAlignment = 0.15`). The position is clamped to the end of
  the list. Round 23 is the season's last round in this data, so on first open
  the real app shows the **end** of the list: round 23 at the bottom, earlier
  rounds above. The prototype's four-row sample already fits on one 390×844
  screen, so it does not script the jump. The anchored row is marked
  `id="anchor"`.
- **Afterwards:** the anchor never runs again during that screen's lifetime.
  Later data updates, refreshes and returns from Grand Prix detail keep the
  user's own scroll position. Switching tabs restores the Calendar branch's
  scroll position. Re-selecting the Calendar tab returns to the branch root.
- **Fixed header:** Flutter keeps the season heading, last check and notices
  outside the scroll view so the season stays visible. The prototype does
  the same with one sticky header block.

## Visual decisions

**A running order, not cards.** Rows sit flat on the ground, separated by
hairlines. The hairlines start at the name column, so the round numbers hang
in an open column on the left, like the numbers on a timing sheet. Nothing
repeats a card surface four times.

**Numerals as the index.** Round numbers use Archivo 800, wdth 112, 38px in
`--text-2` (7.95:1). They are large enough to scan by number, but quieter than
the Chalk GP names, so name > number > circuit. Each number sits on the
baseline of its name's first line.

**One emphasized row.** The relevant event is the only row with a surface
(the tray gradient of Home's sessions band) and the only use of the 12° cut.
Its round sits on a Red Oxide block, flush with the band's top-left edge and
cut at 12° on its right edge. This mirrors Home's hero, where the round block
is flush with the top-right corner. The Next row uses the Chalk circular arrow
of Home's hero action. The other rows use a plain chevron.

**Two vocabularies, kept apart.**
- API status uses the core chip unchanged (dashed outline = unknown).
- Client-derived relevance uses Ember text: "Next" uses the same treatment
  as Home's "Next session".

The status chip on the Next row is the same as on every other row. Relevance
never changes how the status looks.

**12° audit.** One new use: the Next round block. It is the same object as
Home's hero round block, and it marks the same thing, the featured event. The
selected tab keeps its slab. Dividers, chips and ordinary rows stay straight.

**Large text / narrow container.** When the list is narrower than 19em
(every 200% run), the number moves onto its own line above the name, so the
name and circuit get the full width. The oxide block becomes a top-left tab.
Names and circuits wrap. They are never truncated. The Flutter card's
`maxLines: 2` + ellipsis is deliberately not reproduced.

## Design-system extensions required by Calendar

| Extension | Why | Where |
|---|---|---|
| Sticky, opaque app bar with a season row | Home's app bar scrolls away. Calendar must keep C01/C13/C15 visible (Flutter contract). A 0.97 alpha let rows show through at large text, so it is opaque | `.appbar--sticky` |
| Screen-title width cap `min(1.5rem, 34px, 14cqi)` | "Calendario" is one word that cannot wrap. At 320 @200% it ran into the refresh button (pass 1). The wordmark style alone has no width limit | `.appbar--sticky .wordmark` |
| Compact chip (26px, 4/10px padding) | The chip appears in every row. Same words, colours and patterns; it is not a touch target | `.ev .chip` |
| Notice component | Home never rendered C15. Tray surface, full hairline border, cloud-off icon in Ember, `role="status"` (Flutter: live region) | `.notice` |
| List-row primitive (number column + inset hairline) | Home has no repeated list. Standings and Explore will need the same primitive | `.ev`, `.rounds` |
| `[hidden]` guard | Component `display` rules beat the `hidden` attribute | `calendar.css` top |

No new fonts, colours or motifs were added. To make the core truly shared,
`primer-core.css` should become the single source for Home and Calendar.
That would mean changing Home's files, so it was not done.

## States (`calendar-states.js`, presentation only)

These states use app copy only, with no invented values:

- `index.html?state=refreshing`
- `?state=stale`
- `?state=failed`
- `?state=refreshing,failed`

The `*-390x844-states-01.png` captures show `refreshing,failed`. Event-level
variants are not rendered: Current, Completed, Sprint, Postponed/Cancelled,
location and dates. Showing them would need invented statuses or dates on
real rounds.

## Validation (Chrome 157 headless, DevTools Protocol, `mobile: true`, DPR 2; 200% = root font size)

| Run | Width | Overflow | Text overflow | Small text (<12px) | Title gap | Content → nav | Nav |
|---|---|---|---|---|---|---|---|
| EN 390×844 | 390 | 0 | 0 | 0 | 139 | 651 → 776 | regular |
| EN 320×693 | 320 | 0 | 0 | 0 | 69 | 596 → 625 | regular |
| EN 390 @200% | 390 | 0 | 0 | 0 | 87 | 734 → 763 | condensed |
| EN 320 @200% | 320 | 0 | 0 | 0 | 60 | 509 → 538 | stacked |
| ES 390×844 | 390 | 0 | 0 | 0 | 114 | 651 → 776 | regular |
| ES 320×693 | 320 | 0 | 0 | 0 | 44 | 596 → 625 | condensed |
| ES 390 @200% | 390 | 0 | 0 | 0 | 53 | 660 → 689 | stacked |
| ES 320 @200% | 320 | 0 | 0 | 0 | 34 | 509 → 538 | stacked |

- **Title gap** is the distance from the end of the title text to the action
  buttons. It was added after pass 1, where "Calendario" collided with the
  refresh button at ES 320 @200%. The overflow and text-overflow checks
  missed that collision, because the title overflows visibly from a flex item
  and does not scroll.
- **Content → nav** is measured at the end of the scroll: the bottom of the
  last content, then the top of the fixed navigation. It is ≥ 29px in every
  run.
- **Touch targets at 320** (`*-touch-targets-320.txt`): actions 48×48, rows
  320×119–160, tabs 78×61, all OK in both languages. The listed accessible
  names read "Round 23 Next Abu Dhabi Grand Prix Yas Marina Circuit Status
  unknown", which is a meaningful order.
- **Contrast** (new pairs):
  - Ember on the band: 6.57
  - Circuit text-2 on the band: 7.02
  - Round number text-2 on the ground: 7.95
  - Chalk numeral on the lightest oxide stop: 4.63 (as on Home's hero)
  - Notice text: 13.41
- **Impeccable** (`impeccable detect`, engine 4.8.0):
  - No findings for `index.html`, `index.es.html`, `primer-core.css` and
    `calendar.css`.
  - No findings for both pages rendered at `--viewport 390x844` and
    `320x693`.
  - The edit hooks reported nothing for any file.
  - The detector notes that CSS and JS files get regex rules only.
- The tools flagged nothing that was then suppressed.

## Critical comparison with Home

| | Assessment |
|---|---|
| Visual consistency | **Strong.** Same palette, type axes, app bar, chips and nav. The Next band reads as Home's hero round block turned into a list row. Ember means relevance on both screens. It looks like the same app |
| Originality | **Moderate.** The hanging number column and the flush oxide block are distinctive. Ordinary rows are still a familiar list pattern. The screen gets its character from one row; the other rows are plain |
| Information density | **Adequate, not high.** Ordinary rows are about 119px at 390 (141px when a circuit wraps at 320), so about 23 rounds ≈ 2,700px. The status chip on its own line costs about 34px per row. The four identical dashed "Status unknown" chips are the most repetitive element. The data requires them, but they are visually heavy |
| Scannability | **Good.** Numbers, names and circuits each have one fixed position and one style. The Next row is found at a glance without dominating |
| Typography | **Good.** Same scale steps as Home: 38px numbers, 18px names (22px on Next), 15px circuits. Baseline alignment of number and name holds at 100%. At 200% the stacked layout drops it, deliberately |
| Status clarity | **Good.** Every row says its status in words. Next is a word, not just colour or position. Status and relevance never share a style |
| Interaction affordances | **Good.** Each whole row is a link with a chevron; the Next row has Home's Chalk arrow. Hover and press states exist; focus uses an inset Ember outline. Weak point: nothing on screen hints at pull-to-refresh (native, same as Home) |
| Mobile usability | **Good with a cost.** The sticky header is about 92px at 390 and about 113px at 320 @200%. Add the 155px stacked nav, and at 320 @200% the list keeps only about 425px of a 693px screen. That follows from two contracts: the fixed season header and untruncated nav labels |
| Accessibility | **Good.** AA contrast, 48px targets, no clipping, readable order, `aria-current`, labelled list, live-region notices. Real TalkBack and system-font testing have not been done |
| Functional fidelity | **Good.** C01–C15 are present or accommodated, with nothing invented. Navigation contracts are unchanged. The scroll anchor is documented, not simulated |

What feels weak or generic:

1. Ordinary rows have little Primer character beyond the number column. A
   fifth or tenth identical row will feel like a stock list.
2. The repeated dashed chips are noisy when every status is unknown, which is
   the case for this staging data.
3. The prototype note takes space at the top. It is a prototype artefact, but
   it pushes the list down on every screenshot.

Home should not change to match Calendar. One thing Calendar exposed: Home's
app bar would hit the same one-word title limit if it ever showed a long
screen title. That is a core concern, recorded here and not applied to Home.

## Open issues

- **Flutter semantics omit the circuit.** `calendarEventSemantics` reads
  name, round, Next, status, location and dates, but not `circuitName`, even
  though the circuit is visible. The prototype exposes the circuit through
  natural reading order. Recommend adding it in the implementation.
- **Reading-order difference.** Flutter's label starts with the name
  ("Abu Dhabi Grand Prix, round 23, …"). The prototype's DOM follows the
  visual order (round first). Both are meaningful; decide one for the
  implementation.
- **Not rendered:**
  - Empty, season-unavailable, first-load error and loading skeleton (C16)
  - Event-level variants: Current, Completed, Sprint, Postponed/Cancelled,
    dates, location
  - Mock and frozen data banners
  - Light theme
- **Density.** Putting the chip on the circuit line when it fits would save
  about 34px per row, but rows would then differ in height and alignment.
  Worth testing on the full 23-round list.
- **The sticky header plus stacked nav at 320 @200%** leaves about 61% of the
  screen for the list. It is a consequence of the Flutter contracts and should
  be checked on a device.
- **Validation tooling.** The touch-target script reused from the Home
  sessions dropped every "s" from labels (`\s` inside a template literal). It
  was fixed for this run. Home's existing `*-touch-targets-320.txt` files have
  the same garbled labels; their sizes are unaffected.
- Device testing, TalkBack and the full-season scroll anchor remain outside
  this prototype.
