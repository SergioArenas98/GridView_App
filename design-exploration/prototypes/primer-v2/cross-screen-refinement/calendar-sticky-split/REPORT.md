# Calendar sticky-header split experiment (Step 48C)

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a cross-screen experiment of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../README.md#validation-output).

**Status: experiment, 2026-11-10.** In Step 48D the owner provisionally
approved it visually as the preferred direction (`DESIGN-DECISIONS.md`
CT-02). **Superseded 2026-11-11 (Step 48F, CT-03):** Calendar Stage 1
(`../calendar-stage1/`) is the preferred visual and interaction direction;
this Stage 2 experiment (dynamic title release) is retained as an
alternative, not the preferred direction. Flutter implementation and
real-device validation stay outstanding.
It is not a final approved design, a fixture or a Flutter contract. Open
decisions and recommendations: [`DECISIONS-48D.md`](DECISIONS-48D.md). The
measurements below are unchanged from Step 48C.

- **Starts from:** the title-fit variant (`../calendar-title-fit/`, Step
  48B), whose 34px adaptive title the owner visually approved for the
  experimental direction (`DESIGN-DECISIONS.md` CT-01). That variant is the
  comparison reference ("before") throughout.
- **Unchanged:** the approved `../../calendar/`, the Calendar consolidation
  pilot, the title-fit experiment, every other screen, Flutter, ARB files.
- **Open, not closed by this experiment:** XS-06 (header budget), XS-07
  (title fit), every accessibility item.

## 1. What changed

One structural change, three regions.

| Region | Contents | Behaviour |
|---|---|---|
| A. Title row | Title, Refresh, Settings | Pinned, as approved. Released (scrolls away) only when keeping it would stop the tallest race row from fitting whole between the pinned chrome and the navigation. Re-pinned while keyboard focus is on Refresh or Settings |
| B. Season row | "2026 season" / "Temporada 2026", `id="season"` (still labels the race list) | Always pinned. Never released, whatever a notice does |
| C. Status | Last-check caption, refresh-failed notice, stale notice | Moved, unchanged and in the same order, to the start of `<main>`. Scroll with the content |

How, in the smallest form found:

- **Markup:** the three status paragraphs move out of `<header>` into
  `<main>`, before the prototype note. Nothing else moves. Copy, conditions
  (`calendar-states.js`, verbatim), `role="status"` and failure-over-stale
  precedence are unchanged.
- **Sticky offset, not a wrapper:** the header stays one sticky block. Its
  `top` is `0` (both rows pinned) or minus the title row's height (the title
  row scrolls off, the season row sticks). No `display: contents`, no second
  sticky element. On a device, the subtracted height excludes the header's
  top padding (the safe-area inset), so the season row would stop below the
  status bar.
- **Scroll padding:** `scroll-padding` on `<html>` = the measured pinned
  header height (top) and the measured navigation height (bottom). Keyboard
  focus and anchor scrolling stop clear of both.
- **`calendar-header.js`** measures and publishes those values. It reruns on
  text-scale changes, viewport changes, font loading and on load. It has two
  focus rules:
  - Refresh or Settings focused while the title row is released: the title
    row is pinned again until focus leaves it.
  - Text-scale or viewport change: a keyboard-focused race row is brought
    back between the pinned chrome and the navigation. Ordinary layout
    changes (a notice appearing) never move the scroll position.
- **CSS:** three rules changed or added, each marked "Step 48C"
  (`calendar.css`). The caption and notices keep their components; only
  their margins change (gutter, 10px / 12px below).
- **Release rule, not a threshold:** the 25% header budget is not used.
  The rule compares measured heights. In portrait the title row never
  releases at the tested sizes (§2). It releases in landscape at 200%.

Files: `build.py` derives everything from `../calendar-title-fit/` through
asserted substitutions (`python build.py --check` verifies);
`calendar-sticky-split.config.mjs` (screenshots, accessibility, focus);
`dynamic-checks.mjs` (geometry and dynamic behaviour, same Chrome flags).

## 2. Measured usable space (portrait)

Chrome device emulation, software raster, DPR 2. Every value is read in the
page; nothing is estimated. Emulation has no Android status or navigation
bars (safe-area insets 0), so a phone has less height than these figures.

"List viewport" is the band between the pinned header and the navigation,
measured while scrolled through the list. "Rows" counts how many race rows
fit in that band (fractions summed), mid-list.

**320×693 @200%.** Viewport 693px. Navigation 154.78px (stacked, two rows),
identical before and after. Season row 37.69px tall, pinned in both.

| State | Lang | Pinned before | Pinned after | List viewport before → after | Rows mid-list before → after | Last row reachable before → after |
|---|---|---|---|---|---|---|
| default | EN, ES | 112.5 | 112.5 | 425.72 (61.4%) → 425.72 | 1.52 → 1.52 | 100% → 100% |
| refreshing | EN, ES | 152.19 | 112.5 | 386.03 (55.7%) → 425.72 (61.4%) | 1.37 → 1.51 (EN), 1.37 → 1.50 (ES) | 100% → 100% |
| failed | EN | 257.89 | 112.5 | 280.33 (40.5%) → 425.72 (61.4%) | 1.00 → 1.48 | **80% → 100%** |
| stale | EN | 295.69 | 112.5 | 242.53 (35.0%) → 425.72 (61.4%) | 0.85 → 1.47 | **68% → 100%** |
| failed | ES | 295.69 | 112.5 | 242.53 (35.0%) → 425.72 (61.4%) | 0.84 → 1.46 | **68% → 100%** |
| stale | ES | 371.28 | 112.5 | 166.94 (24.1%) → 425.72 (61.4%) | 0.57 → 1.44 | **44% → 100%** |

- **Notice heights** at 320 @200%: caption 37.69px; failed notice 135.39px
  (EN) / 173.19px (ES); stale notice 173.19px (EN) / 248.78px (ES).
- **Before**, the pinned notice made the **final race (round 23)
  unreachable in full**: at maximum scroll only 44–80% of it cleared the
  header. After: 100% in every state and language.
- **At the top of the page** the notice is now in the content, so the first
  screen shows about as much of the list as before (for example ES stale:
  0.05 rows before, 0.05 after). The gain appears as soon as the user
  scrolls. The prototype-only note ("Prototype sample") takes another
  ≈100px there; the app has no such note.
- **Title row:** stays pinned at 320 @200%. The tallest row (round 23,
  316.75px) fits the 425.72px band, so the rule keeps it. The title row is
  44px; releasing it would add 44px.
- **Header height stays 112.5px in every state**; the 25% diagnostic
  (173px here) is never reached in portrait.

**320×693 @100%.** Pinned 90.75px after, in every state (before: 90.75
default, 111.59 refreshing, 160.53 failed and EN stale, 179.42 ES stale).
Navigation 68px. List viewport 534.25px (77.1%) after, in every state
(before as little as 445.58px, ES stale).

**390×844 @200%.** Pinned 112.5px after, in every state. List viewport
650.61px EN (navigation 80.89px, one row) and 576.72px ES (navigation
154.78px, stacked) after; before as little as 505.22px (EN stale) and
393.53px (ES stale).

**390×844 @100%.** Pinned 90.75px after, in every state. The page does not
scroll in any state (maximum scroll 0 before and after), so the change there
is visual only: the notice sits at the top of the content instead of making
the header taller.

Per-run values: `validation-20261110-191209-dynamic/dynamic.json` (`static`; focus, anchor, back, notice, text scale and rotation runs in the other keys).

## 3. Landscape and short viewports

693×320 (rotated 320×693) with 200% text, refresh failed, measured.

| | Before EN | Before ES | After EN, ES |
|---|---|---|---|
| Pinned header | 182.3px | 220.09px | 68.5px (title row released) |
| Navigation | 80.89px | 80.89px | 80.89px |
| List viewport | 56.81px (17.8%) | 19.02px (5.9%) | 170.61px (53.3%) |
| Season visible | yes | yes | yes |

At 100% in landscape the title row stays pinned (90.75px pinned, list
viewport 161.25px, 50.4%; before 110.25px, 34.5%).

## 4. Focus, navigation and accessibility

Keyboard focus is checked against the band between the visible pinned
header and the navigation, for race rows. Refresh, Settings and the tabs
count as clear when fully on screen (and, for the header, above the
navigation).

| Check | Before | After |
|---|---|---|
| Tab walk, 10 stops, then Shift+Tab back, 320 @200%, EN and ES, four states (16 walks) | race rows obscured in 16 of 16 walks: up to 155.27px under the navigation, up to 370.89px under the header | **0 obscured** |
| Same, 390 @100% (16 walks) | 0 obscured | 0 obscured |
| Same, landscape 693×320 @200% (16 walks) | 16 of 16 walks: all four rows partly obscured, up to 220.45px under the header | round 23 only: top 20.4–20.8px under the season row (§6) |
| Round 22 focused, 320 @200%, eight state/language pairs (critical frame 3) | obscured in 8 of 8 | clear in 8 of 8 |
| Shift+Tab to Settings with the title row released (landscape, scrolled) | n/a (header always pinned) | fully visible (title row re-pinned) |
| Text 200 → 100 → 200% with round 22 reached by Tab, EN and ES, default and failed | back at 200% the row is 393–429px under the navigation in 4 of 4 | row clear at every step in 4 of 4 |
| Rotate portrait → landscape → portrait with round 22 reached by Tab, failed, 100% and 200% | row obscured in landscape (up to 308px under the navigation) | row clear at every step |
| Open a Grand Prix and go back (hash route), failed, 320 @200% | scroll and focus restored; focused row 39 (EN) / 77px (ES) under the header | scroll and focus restored; row clear |
| First open: relevant event (round 23) scrolled to the top | stale/failed 320 @200%: only 44–80% visible; landscape @200%: 0–47% | portrait: 100% in every case; landscape @200%: 80% (the row is taller than the band), top edge clear |

Accessibility (comparison tool, 53 runs, against the before variant):

- **Accessible names, link targets, focus order:** identical. 80 of 80
  focus stops have the same role, name, locator and resolved href.
- **Accessibility tree:** 39 runs differ, all states with a caption or
  notice. In all 39 the tree has the **same nodes** and the **same reading
  order**; the only difference is that the caption and the `status` live
  regions now sit in `main` instead of `banner`. The season paragraph stays
  in `banner` and still names the list ("2026 season").
- **Status announcements:** same `role="status"` (polite, atomic) elements
  with the same text. No duplicate live region, no new focusable element.
- **Touch targets:** identical in all 53 runs; Refresh and Settings 48×48,
  every row and tab at least 48px.
- **Visible text:** identical node for node.
- **Quality checks:** identical to the before variant in all 53 runs. No
  horizontal overflow, clipping, broken words or text under 12.5px. One
  pre-existing finding in both: in landscape @200% the round number "23"
  spills its column.
- **Reduced motion:** no motion added; the reduced-motion run passes with
  the same results as before.
- **Bottom navigation:** identical layout, labels, fit mode (stacked at
  320 @200% and ES 390 @200%) and touch targets. No new scrolling region:
  the document is still the only scroller.

## 5. Dynamic notices (measured while scrolled mid-list, 320 @200%)

The status of the page changes while the user reads round 21 mid-list.
"Row shift" is how far round 21 moves on screen.

| Step | Before EN: pinned / list | After EN: pinned / list | Row shift after |
|---|---|---|---|
| Scrolled, no notice | 112.5 / 425.72 | 112.5 / 425.72 | — |
| Refresh starts (caption) | 152.19 / 386.03 | 112.5 / 425.72 | −0.31px |
| Refresh fails (caption + notice) | 297.58 / 240.64 | 112.5 / 425.72 | +0.08px |
| Failure shown (notice only) | 257.89 / 280.33 | 112.5 / 425.72 | −0.61px |
| Refresh succeeds (notice gone) | 112.5 / 425.72 | 112.5 / 425.72 | 0 |
| Data goes stale | 295.69 / 242.53 | 112.5 / 425.72 | +0.19px |

Spanish: same pattern; before, the pinned area reached 335.38px (list
202.84px) during "refresh fails"; after, 112.5px throughout, row shift
under 1px.

- **Scroll stability:** Chrome's scroll anchoring adjusts the offset by the
  notice height (for example 444 → 492 → 639 → 592 → 444 in EN), so the row
  being read does not move. Before, the row did not move either, but the
  growing header covered it.
- **Visibility:** a notice that appears while scrolled is **off-screen** (0px
  visible) until the user scrolls back to the top, where it is fully visible.
  Before, it was always visible because it covered the list.
- **Announcement:** unchanged in the prototype. The `role="status"`
  elements stay in the DOM wherever they sit.

## 6. Remaining limitations

1. **Off-screen notice (unresolved by design here).** A failure or stale
   state that arrives while the user is scrolled down is announced but not
   seen. No snackbar was added (per instructions).
   - **Existing Flutter behaviour:** `calendar_screen.dart` keeps season,
     caption and `GvOfflineNotice` in a `Column` outside the `ListView`
     ("Kept outside the scroll view so the season a user is looking at is
     always visible"), i.e. the "before" layout. `GvOfflineNotice` is
     `Semantics(liveRegion: true)` with `ExcludeSemantics` on its visual
     row (one announcement). Calendar shows no snackbar for refresh
     failures; the app uses snackbars only in Settings.
   - **Requirement, to decide:** whether a status change while scrolled
     needs a visible cue. Options to compare later (none recommended yet):
     keep the notice in content only (cheapest, relies on the live region);
     a transient snackbar for refresh failure only (manual refresh is a user
     action, so feedback is expected); a compact pinned indicator in the
     season row (re-introduces pinned height).
2. **Landscape @200%: the "Next" row is taller than the band.** Round 23
   needs more than the 170.61px band, so its top 20–21px stays under the
   season row when focused. Unavoidable without releasing the season row,
   which the owner direction excludes.
3. **Title-row release is rare.** With the notices moved, the measured
   rule never releases the title row in portrait at 320 or 390, at 100% or
   200%. Whether "the tallest row fits" is the right test, or whether the
   release should require more room (for example two rows), is an owner
   decision. The rule is measured, never a viewport share.
4. **First open (C10 anchoring)** is not implemented in the prototype (as
   in the approved Calendar). The check above uses `scrollIntoView`; the
   Flutter anchor uses `Scrollable.ensureVisible` at alignment 0.15.
5. **Grand Prix navigation** is a hash link in the prototype; the
   back-navigation check shows the browser keeps scroll and focus, not what
   go_router does.
6. **No device evidence.** Chrome emulation only: no status bar, gesture
   bar, Android font scaling, TalkBack or real keyboard.

## 7. Flutter implementation risks

- **The list index contract.** The Flutter header sits outside the list so
  that "the list index of an event is exactly its position in the season".
  `CalendarScrollAnchor` relies on it. Moving the notices into the scroll
  view needs a `CustomScrollView` with the status as its own sliver before
  the event sliver, so event indices stay intact, and the one-time anchor
  must account for the status height.
- **Live region in a lazy list.** A status sliver scrolled off-screen
  beyond the cache extent may be dropped from the semantics tree, so the
  `liveRegion` might **not announce** at all. This must be verified with
  TalkBack before adoption; the prototype cannot show it.
- **Scroll anchoring.** Browsers keep the visible row stable when content
  is inserted above it; Flutter does not by default. Inserting a 135–249px
  notice above the viewport would jump the list unless offsets are
  corrected.
- **Pinned season row.** Needs a `SliverPersistentHeader` (pinned) for the
  season and a non-pinned app bar part for the title row, or an equivalent;
  the current `GvScreenScaffold` app bar is always fixed.
- **Focus and scroll padding.** Flutter's `ensureVisible` on focus does not
  know about pinned headers; the equivalent of `scroll-padding` must be
  supplied for keyboard and switch access.
- **The fixed-header contract.** The approved Calendar README treats
  "keep C01/C13/C15 visible" as a Flutter contract. This experiment keeps
  C01 pinned but moves C13/C15 into the content: a contract change the
  owner must accept explicitly.

## 8. Representative screenshots

All under `validation-20261110-190115-experiment/sw-pilot/`. Before and
after are `…-baseline.png` and `…-pilot.png`, with a `…-diff.png` mask.

- Critical frames, 320×693 @200%, every state, EN and ES:
  `diffs/{en,es}-{refreshing,stale,failed}-320x693-200-critical-{initial,mid-list,focused-round-22,bottom}-{baseline,pilot,diff}.png`
  - for example `diffs/es-stale-320x693-200-critical-mid-list-baseline.png`
    vs `…-pilot.png` (Git-visible copy: `diffs/es-stale-320-200-mid-{base,pilot}.png`) (before: 0.57 rows under a 249px notice; after: the
    season pinned and round 21 whole);
  - `diffs/en-failed-320x693-200-critical-focused-round-22-{baseline,pilot}.png` (Git-visible copy: `diffs/en-failed-320-200-r22-{base,pilot}.png`)
    (the known focus failure, fixed).
- Default state: `screens/{en,es}-default-320x693-200-critical-*.png`. The
  initial, mid-list and bottom frames are pixel-identical before and after;
  only the focused frame differs (`diffs/…-default-…-focused-round-22-*`).
- Landscape @200%: `screens/{en,es}-failed-693x320-200-landscape-*.png` and
  the matching `diffs/`.
- Full-page captures for every state × size × language:
  `screens/{en,es}-{state}-{390x844,320x693}-{100,200}-NN.png`.

## 9. Regression summary

- **Control** (before vs before): 53 runs, 201 screenshot pairs, 0 differing
  pixels, 0 DOM or accessibility differences.
- **Before vs after:** every difference is in the caption/notice placement
  or the geometry it causes. Default state: 16 of 16 full-page frames
  pixel-identical at every size. Title row and season row: identical
  pixels where the header is not taller. Text, names, targets, focus order,
  quality checks: identical (§4).
- **Expected structural differences:** status elements moved from `header`
  to `main`; `--cal-pin-top`, `--cal-pinned-h` and `data-title-row` on
  `<html>`; `scroll-padding` on `<html>`; the header's `top` reads a
  variable.

## 10. Recommendation

**Adopt the structure as the experimental direction for owner visual
review**, not yet for Flutter.

- It removes the measured problem: at 320 @200% the list band goes from as
  little as 24% to 61% of the screen in every notice state, the final race
  becomes fully reachable, and focused race rows are never obscured in
  portrait.
- Context is kept: the season row never leaves the screen; the title row
  stays pinned wherever the list still fits a whole row.
- Nothing else changes: default-state pixels, text, names, targets and
  reading order are identical.

Before any Flutter work: decide the off-screen notice cue (§6.1), confirm the
title-row release test (§6.3), accept the C13/C15 contract change (§7), and
validate the live region and scroll behaviour on Android with TalkBack.

## Reproduce

From this folder:

```
python build.py --check
node ../../consolidation-pilot/tools/visual-compare.mjs calendar-sticky-split.config.mjs --control
node ../../consolidation-pilot/tools/visual-compare.mjs calendar-sticky-split.config.mjs
node dynamic-checks.mjs
```
