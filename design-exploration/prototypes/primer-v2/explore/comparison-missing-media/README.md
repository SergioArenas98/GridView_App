# Explore: missing-media comparison (2026-11-08)

<!-- primer-v2-status-notice -->
> **Historical record.** This document describes an early per-screen prototype that the approved Dark and Light references replaced. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../README.md#validation-output).

> **Owner decision, 2026-11-08 (`../../DESIGN-DECISIONS.md`, EX-02):
> Alternative B (`cue.html` / `cue.es.html`) is the preferred visual
> reference for Explore**, provisionally approved. The owner reviewed its
> three Spanish categories; English and the responsive configurations have
> the automated evidence below only (backlog EXP-06). The baseline
> (`../index.html`) and Alternative A (`index.html` here) are kept unchanged
> for reference; no generator or source file was changed by the decision.
> The per-list media rule in `media-states.html` is **not** approved (PD-16,
> backlog EXP-04). The rest of this README is the comparison as delivered.

A targeted visual comparison, **not a redesign**. Explore is provisionally
approved (see `../../DESIGN-DECISIONS.md`, EX-01). This folder answers the two
questions left open by the owner's review: the repeated missing-media
placeholders (EXP-04) and the discoverability of row navigation (EXP-05).

**The approved baseline is untouched.** `../index.html`, `../build.py`,
`../explore.css`, `../explore.js` and the other baseline files have the same
SHA-256 as before this work (11 of 11 checked). Nothing here is
production-ready; nothing authorises a Flutter change.

## Files

| File | What it is |
|---|---|
| `index.html` / `index.es.html` | **Alternative A**: a collection with no media reference renders no image column |
| `cue.html` / `cue.es.html` | **Alternative B**: A plus the row chevron Standings and Calendar already use. Kept separate so the two variables can be judged apart |
| `media-states.html` / `.es.html` | Development-only gallery: how A coexists with images (no reference, loading, failed, loaded) without layout shift. Interactive: section 3 switches every slot |
| `comparison.css` | Overrides only, loaded after `../primer-core.css` and `../explore.css` |
| `media-states.js` | Gallery state switcher (presentation only, no request, no image) |
| `build.py` | Generator. It **imports `../build.py` read-only** and reuses the baseline's own page and row output, then removes the slot (and, for B, adds the chevron). It writes nothing outside this folder (bytecode disabled) |
| `validation-20261108-202406/` | Screenshots (separate files, no composites), metrics and the scripts that produced them |

Category is selected with `?category=teams|circuits`, exactly as on the
baseline page.

## Why this is a controlled comparison

Because the pages are produced from the baseline generator's own output:

- **Same fixtures:** `test/support/entity_fixtures.dart` via `../build.py`
  (`seasonDriverCardsFixture`, `seasonTeamCardsFixture`,
  `seasonCircuitCardsFixture`). Not merged with the frozen staging Standings
  data.
- **Same rows, order, visible text, accessible labels, links and accent
  colours.** Checked: `data-check.txt` (47/47) compares every row with
  `../index[.es].html`; `accessibility-tree.txt` shows the reading order of
  baseline, A and B identical for all three categories in both languages.
- **Same scripts:** `../explore.js` (category selector, independent offsets,
  header budget) and `../nav-inset.js`, unchanged.
- **Same tokens:** `comparison.css` contains no colour value at all (checked),
  and no new family, size step or weight.

What differs (A): the image column is gone; a 16px accent lane holds the team
tick; names run 46px wider and relax from `wdth` 86 to 94 (both already used
in Primer); at large text on a narrow screen the figure takes its own line,
set inline ("43 COL" above a driver's name, "5.793 km" after a circuit's
details). B adds one 16px chevron per row.

## Fixture edge cases (all preserved; `data-check.txt`)

Unresolved team (Unaffiliated Entrant: no team text) · no number and no
standing (Reserve Entrant) · unranked with a genuine 0 (Colapinto, "Points 0",
no position) · missing race number · missing power unit (Red Bull) ·
mid-season line-up (Alpine GAS · DOO · COL) · circuit lengths (5.793 /
7.004 km; 5,793 / 7,004 km) · circuit-event relationships · roster, stable-name
and calendar order · per-category scroll restoration (`behaviour.txt`:
Drivers 400 → Teams 0 → Drivers 400 → Circuits 0, identical on baseline, A, B).
No search, sort or filter.

## Media behaviour in the application (what A must respect)

Read from `lib/features/explore/presentation/explore_cards.dart`,
`lib/core/widgets/gv_remote_image.dart`, `gv_image_placeholder.dart`,
`lib/features/shared/presentation/media_slot.dart` and
`content/media/media-rights.json`.

| State | Flutter today | Distinguishable in code | Drawn as |
|---|---|---|---|
| **No media reference** (`card.media` has no preferred asset, or no size-appropriate variant: `resolveMediaSlot` returns `null`) | Slot reserved (40px), placeholder | key `gv-remote-image-none` | Placeholder (surfaceElevatedAlt + category icon) |
| **Loading** (request exists, not cached, not yet loaded) | Same slot, placeholder | key `gv-remote-image-pending` | Same placeholder |
| **Failed** (`MediaLoadFailed`, or `Image.file` decode error) | Same slot, placeholder | key `gv-remote-image-failed` | Same placeholder |
| **Loaded** | Image in the slot, `ClipRRect`; fades in only when freshly downloaded and motion is allowed (`_FadeIn`); no fade when cached or under reduced motion | — | Image |

So the app already reserves the slot in every state (no layout shift) and
already *knows* the three non-image states apart; it just draws them the same.
Today every row is "no reference": `media-rights.json` is empty and fails
closed, so no Formula 1 media can exist in a build.

**Proposal (A plus its media rule, shown in `media-states.html`):**

1. **The image column is decided per collection, from the read model, before
   anything loads.** No row has a reference → no column (Alternative A). Any
   row has a reference → the 48px column is reserved for every row. Reference
   presence is synchronous data, so loading, failing or arriving never moves
   text; only a data change (a refresh that adds the first reference) reflows
   the list once.
2. **Loading:** a quiet tray square, no icon. The image replaces it in place.
3. **Failed:** the square keeps its size and shows the category icon (the
   baseline placeholder), so a slot that will not fill reads as settled, not
   as perpetually loading. The image stays decorative; the row text still
   names the entity.
4. **No reference, in a collection that has references:** the reserved cell
   stays empty. No tile.
5. **Loaded:** the image fills the same square; Flutter's fade rules stay.

Verified in the gallery (`behaviour.txt`): switching every slot through
loading → loaded → failed → none → loading → loaded moves no element (rects
identical) and records a layout-shift score of 0, EN and ES, at 390 and at
320 @200%. The "loaded" slot is a tonal block standing in for geometry; no
image was generated, downloaded or drawn.

Trade-offs of the rule, stated plainly:
- A single approved portrait would bring the column back for the whole
  collection, with empty cells on every other row. That is honest but
  visually uneven; a mixed collection may look worse than today until
  coverage is broad.
- It needs a collection-level check in Flutter (any row with a resolvable
  reference), which `explore_collection_view.dart` does not do today.
- Rule 1 uses "has a reference", not "has a size-appropriate variant"; if a
  reference resolves to no variant, that row behaves as "no reference". This
  needs confirming at implementation.

## Navigation discoverability (EXP-05)

**Finding that changes the question:** Standings rows (`.st__go`) and Calendar
rows (`.ev__go`), both provisionally approved, already end every row with a
16px secondary chevron. **Explore is the only list screen without one.** The
baseline's image tiles gave its rows an "item" look; Alternative A removes
that, so its rows read more like a printed index and less like buttons.

Alternative B uses the *same* chevron as Standings, with the same size,
stroke, colour, `-4px` edge, hover colour and top alignment at large text. It
is a 16px secondary glyph (7.95:1 non-text) after the figure, so it does not
compete with the 28px Chalk race number or the length; but it moves the
figure rail 28px inward and adds a third element at the right edge of driver
rows.

Unchanged on baseline, A and B (`behaviour.txt`, `touch-targets` in the JSON):
whole-row links with Flutter's labels, rows at least 76px tall (baseline 77–360px, A 76–302px, B 76–342px across all 72 runs),
Tab reaches the first row after the selector with a visible 2px Ember ring,
tab order equals row order, pressed rows fill with tray (#1F2125).

**Recommendation:** if A is adopted, adopt B with it. The chevron restores
the affordance the tiles used to imply, and it makes Explore consistent with
Standings and Calendar rather than adding a new element. If the baseline (with
tiles) is kept, adding the chevron is still a consistency gain but less
urgent. Either way, keep it out of the approved baseline until the owner
decides.

## Validation (`validation-20261108-202406/`)

Chrome headless over CDP, mobile emulation with touch, DPR 2; 200% = root font
size; no dependencies. Scripts: `capture.mjs` (copied from the Settings
prototype), `behaviour.mjs`, `layout.mjs`, `a11y.mjs`, `data-check.py`.

| Check | Result |
|---|---|
| Captures: baseline, A and B × EN/ES × Drivers/Teams/Circuits × 390×844, 320×693, 390 @200%, 320 @200% (72 runs), plus the gallery at 390 and 320 @200% in both languages (4) | **76 / 76 clean**: width exactly as requested; elements outside the viewport, clipped text, spill and text under 12.5px: 0 (`summary.txt`) |
| Touch targets < 48px | **0** in all 76 runs (one gallery annotation link was 24px, inherited from the baseline gallery style; raised to 48px here) |
| Layout (`layout-check.txt`, 72 configurations) | **0 problems**: no mid-word split (a real hyphen break is allowed), no text colliding with the figure, chevron, slot or accent tick, no text outside its row, last row clear of the navigation. Accent tick to name: **8.7px** in A and B (baseline 64.7px; the first A capture had 4px, see defects) |
| Behaviour (`behaviour.txt`) | **34 / 34**: selector and offsets, row order per category, keyboard focus and order, pressed state, row heights, zero shift across media states (EN/ES, 390 and 320 @200%), reduced motion |
| Accessibility tree (`accessibility-tree.txt`) | A and B **identical to the baseline** for all 6 page/category pairs |
| Data (`data-check.txt`) | **47 / 47** |
| Contrast | No colour added. Chevron = Standings' `text-2` on graphite, 7.95:1. Names, sub-lines and data unchanged. The "loaded" stand-in is gallery-only |
| Reduced motion | Rows, chevron, slot and figures carry no transition or animation. The only motion on the page is the baseline's refresh line (shown only while refreshing; static under reduced motion) |
| Impeccable `detect` (installed 4.8.0, not updated) | Source (6 pages, `comparison.css`, `media-states.js`): **only "marquee"**, from `../explore.css` `.progress::after`, the baseline's own finding (`../index.html` reports the same; backlog EXP-02). Rendered over a local server at 390×844 and 320×693 (14 URLs): **0 findings** |

**Defects found and fixed during this work:**
1. In A's first capture the team-accent tick sat 4px from the name and read as
   a "/" before it ("/Max Verstappen"). Fixed with the 16px accent lane and
   the tick on the gutter line; the layout check now measures the gap.
2. The gallery's "loaded" stand-in used a repeating stripe (Impeccable
   advisory); now a plain tonal block.
3. Gallery annotation stragglers (advisories) and a 24px annotation link.
4. Importing `../build.py` wrote `__pycache__/` into `explore/`; removed, and
   bytecode is disabled in the generator.

### Height comparison (`density.txt`, sum of row heights)

| | 390×844 | 320×693 | 320 @200% |
|---|---|---|---|
| Drivers EN | 436 → A 434 → B 434 | 493 → 434 → 472 | 1072 → 987 → 1028 |
| Teams EN | 285 → 285 → 285 | 323 → 304 → 323 | 824 → 725 → 838 |
| Circuits EN | 203 → 182 → 203 | 260 → 260 → 260 | 620 → 548 → 588 |
| Drivers ES | 436 → 434 → 434 | 493 → 434 → 472 | 1146 → 987 → 1028 |
| Teams ES | 323 → 304 → 323 | 323 → 323 → 323 | 970 → 796 → 873 |
| Circuits ES | 203 → 182 → 203 | 260 → 242 → 260 | 620 → 548 → 588 |

A is never taller than the baseline and is up to 174px shorter (Spanish Teams
at 320 @200%). B gives part of that back; in one case (English Teams at
320 @200%) it is 14px taller than the baseline.

### Screenshots to compare (same conditions, separate files)

`before-…` = baseline, `after-a-…` = Alternative A, `after-b-…` = Alternative
B, each with `-01.png` (and `-02.png`… when the page scrolls):

- Drivers, Teams, Circuits, English, 390×844:
  `{before,after-a,after-b}-en-{drivers,teams,circuits}-390x844-01.png`
- Same in Spanish: `{…}-es-{drivers,teams,circuits}-390x844-01.png`
- Narrow and 200%: `…-320x693-*.png`, `…-390x844-text200-*.png`,
  `…-320x693-text200-*.png`
- Gallery: `gallery-{en,es}-390x844-*.png`, `gallery-{en,es}-320x693-text200-*.png`

## Critical comparison

| | Baseline (tiles) | Alternative A (no tiles) | Alternative B (A + chevron) |
|---|---|---|---|
| 1. Motorsport personality | **Weakest point of the baseline**: three grey icon squares per screen make it read as a contacts directory | **Better.** Names, livery ticks and the race-number rail carry the screen; reads like an entry list or programme index. Teams in particular improve: livery tick + name + codes. Still restrained: no new device was added, so it is "cleaner", not "more exciting" | Same as A; the chevrons make it slightly more "app list", slightly less "printed index" |
| 2. Information density | 48px slot costs width, not height, at 390; at 320 it forces more wraps | Same information in equal or less height; up to −174px at 320 @200% | Between the two |
| 3. Long-name readability | Names condensed (`wdth` 86) to fit beside the slot; the fixture names fit on one line at 390 and 320, but sub-lines and data wrap sooner (e.g. "Unidad de potencia Renault / Mercedes" drops to its own line at 390 in Spanish) | Wider measure and a less condensed cut (`wdth` 94): easier to read; fewer wrapped sub-lines and data lines (the height table) | Slightly narrower than A (−28px), still wider than the baseline |
| 4. Visual consistency | Left column consistent but empty of meaning | Consistent lane; hairlines start at the names. The left edge is now ragged-looking where rows have no team colour (Colapinto, the two entrants): the empty lane is correct but visible | Consistent with Standings and Calendar row endings |
| 5. Missing-media behaviour | Honest and stable, but the placeholder repeats a "no image" message on every row | No message for something the app never had. **Risk:** nothing tells the reader that portraits or marks could exist; when media arrives, the column appears (once, at data time) | Same as A |
| 6. Navigation discoverability | Tiles imply "item"; no chevron, unlike Standings/Calendar | **Weaker than the baseline**: rows read as reference text | **Best of the three**, and consistent with the rest of the app |
| 7. Responsiveness | Good; slot and figure share a line at large text | Good; the figure gets its own line at large text, which costs one line per driver but no truncation | Good; chevron top-aligned at large text, as Standings |
| 8. Accessibility | Identical tree, labels, targets, focus and contrast across all three. No version is better for a screen reader | Same | Same |
| 9. Future approved images | Ready (slot always reserved) | Needs the collection-level rule; mixed collections look uneven; one reflow when the first reference appears | Same as A |

**Where A is weaker, plainly:** without tiles, the rows of entrants without a
team colour start with nothing and can look under-designed, and taps are less
suggested. A alone trades a visual problem (repetition) for an affordance
problem. Only A + B fixes both, at the cost of the right-edge chevron. If the
owner expects approved portraits soon, the baseline's always-reserved slot is
the simpler implementation and the media rule above is extra work for a
short-lived state.

## Outstanding decisions (owner)

1. **EXP-04 (PD-16):** keep the baseline tiles, adopt A, or adopt A with the
   media rule above (collection-level column; distinct loading/failed;
   empty cell for no reference).
2. **EXP-05 (PD-17):** add the Standings/Calendar chevron to Explore rows
   (B), with or without A.
3. Confirm at implementation: whether "has a reference" or "has a usable
   variant" decides the column; Flutter's slot is 40px, the prototypes' 48px
   (EXP-01 difference 5).

Not done, as instructed: no change to the approved Explore files, Flutter,
Settings information pages, or anything outside this folder and the two
design documents.
