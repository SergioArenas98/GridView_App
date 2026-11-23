# Notice coexistence and Calendar first-open cue (Steps 49D.1, 49D.2)

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a cross-screen experiment of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../README.md#validation-output).

**Closed as an exploration (Step 49D.3):** final decisions in [Step 49D.3](#step-49d3-closure).

**Step 49D.2 update (owner review, final copy, non-overlay opening):** see
[Step 49D.2](#step-49d2-final-copy-and-calendar-initial-positioning) at the
end. The 49D.1 bottom toast is **not approved** at 200% text, and no overlay
is approved in 693×320 landscape. The sections below are the 49D.1 record,
unchanged.

**EXPERIMENT, not an approved design. 2026-11-11.** Isolated pages built by
`build.py` from Calendar Stage 1 (`../calendar-stage1/`, CT-03) and the
approved Driver Detail pilot (`../../consolidation-pilot/driver-detail/`),
which are only read. Nothing changed in Flutter, the tests, ARB files, domain,
synchronization, shared CSS/JS, approved prototypes, pilots or the Calendar
experiments. Evidence: `validation-20261111-214632-experiment/` (`results.json`,
`summary.txt`, 37 screenshots, 4.7 MB). Chrome emulation only (software
raster, DPR 2, safe-area insets 0). **No TalkBack or Android validation.**

## 1. Decisions N-1 to N-7 (recorded in DESIGN-DECISIONS and STATUS-NOTICE-DECISIONS §9)

| | Decision |
|---|---|
| N-1 | Approved: failure, stale and incomplete stay independently representable; order failure → stale → incomplete; one of each; a failure never conceals an incomplete profile; finality stays in classification indicators |
| N-2 | Combined failure + stale notice for the same content, for visual testing: EN "Couldn't refresh — this data may be out of date." / ES "No se pudo actualizar — estos datos pueden estar desactualizados." (copy candidates, not ARB) |
| N-3 | Approved: Home keeps module-specific unavailable information in the module |
| N-4 | Approved direction: the failure notice stays during a retry until the outcome is known |
| N-5 | Candidate only: a transient notification for a user-initiated refresh outcome while its notice is off-screen |
| N-6 | Do not silently hide a notice present at first open; keep the next-race positioning; compare cues (this experiment) |
| N-7 | Not addressed; per-table Home failures stay unpresented provisionally (owner to confirm) |

## 2. Combined notice vs stacked notices (Calendar, top of the list)

Notice height in CSS px (the "block" in `summary.txt` also includes the
prototype's "rounds 20–23" note).

| Viewport | EN stacked | EN combined | ES stacked | ES combined |
|---|---|---|---|---|
| 390×844 @100% | 100.8 | **41.0** | 119.6 | **59.8** |
| 320×693 @200% | 308.6 | **135.4** | 422.0 | **211.0** |
| 693×320 @200% | 157.4 | **59.8** | 195.2 | **97.6** |

- **Combined is visually better.** It is 44–59% of the stacked height. It
  removes the repeated "saved" / "guardados" (stacked: 2×, combined: 0×) and
  leaves one live region instead of two.
- **At 320 @200% stacked, nothing of the race list is visible** at the top of
  the page in either language. With the combined notice the first race starts
  on screen (EN 164px visible, ES 52px).
- Screens: `cal-stacked-*` vs `cal-combined-*`.

## 3. Detail-screen coexistence (Driver Detail visual language)

| Variant | Notices (N-1 order) | EN 320 @200% block | ES 320 @200% block | EN 693×320 @200% block (% of viewport below the app bar) |
|---|---|---|---|---|
| failed | Update failed | 84 px | 122 px | 84 px (32%) |
| partial | Some profile information is unavailable | 159 px | 197 px | 84 px (32%) |
| **failed-partial** | Update failed → partial | 231 px | 307 px | 156 px (59%) |
| **combined-partial** (hypothetical) | combined → partial | 307 px | 420 px | 156 px (59%) |
| stacked-partial (hypothetical, comparison) | Update failed → Details may be outdated → partial | 341 px | 454 px | 227 px (86%) |

- **Failure no longer hides the partial profile.** In `failed-partial`, both
  facts are visible, in N-1 order and in reading order (notice, notice, then
  the driver's name). This is the case that matters (N1 in
  STATUS-NOTICE-DECISIONS).
- **failure + stale + partial is not reachable today:** a partial profile has
  no freshness, and a 404 clears the failure. It is rendered as a layout test
  only and labelled in the page.
- **On details the combined notice saves little** against the three stacked
  notices: 34px at 320 @200% (EN and ES), 53px (EN) at 390 @100% and 72px
  (EN) in landscape. The detail strings are already short.
  It still removes one live region and one repeated icon. It costs 75px (EN)
  to 113px (ES) more than "Update failed" alone, which is the price of stating
  staleness.
- **Landscape at 200%:** with two notices the driver's name starts below the
  first screen (name top 344px in a 320px viewport). The notices scroll away
  with the content, so it is reachable, but the first screen is notices only.
- **Icons:** two identical cloud-off icons for two different causes (XS-22).
  Not redesigned here.
- Screens: `detail-failed-partial-*`, `detail-combined-partial-*`,
  `detail-stacked-partial-*`, `detail-failed-*`, `detail-partial-*`.

## 4. Calendar first-open cue alternatives

**Setup.** `?anchor=1` simulates Flutter's one-time positioning: the "Next"
race (round 23) is scrolled to the top of the list band, and the page clamps
it, as `CalendarScrollAnchor` would. The cue is decided **once**, after that
positioning, and shown only if a visible notice is not fully inside the band
between the pinned rows and the navigation. It is a fixed, non-focusable
overlay that never takes layout space. It dismisses itself after 6 s, or as
soon as the full notice scrolls into view.

| Variant | What it is | Copy |
|---|---|---|
| none | Stage 1 today: the notice is above the anchored row, off-screen | — |
| **toast** | Bottom, above the floating navigation, short text | Failure and failure + stale: "Update failed" / "No se pudo actualizar" (existing wording). Stale only: "Calendar may be out of date" / "El calendario puede estar desactualizado" (**EXPERIMENTAL**, needs ARB) |
| toast-long | As toast; failure + stale states both | "Update failed · calendar may be out of date" (**EXPERIMENTAL**) |
| toast-full | As toast with the full notice text | Existing strings and the N-2 candidate |
| edge | Just below the pinned season row, existing chevron turned upwards | Same as toast |

**When the cue appears** (78 measured runs):
- **390×844 @100%:** never. With the prototype's four rounds the page does
  not scroll (anchorY 0), so the notice stays visible. A full season would
  trigger it, but no rows were invented (XS-13).
- **320×693 @200% and 693×320 @200%:** every cue variant appears; "none"
  leaves the notice off-screen.

**Cue height and occlusion at 320×693 @200%** (band = 426px; next row 317px):

| State | Variant | EN cue | ES cue | Next race covered (EN / ES) |
|---|---|---|---|---|
| failure + stale | **toast** | **60 px (14%)** | **98 px (23%)** | 40 / 78 px |
| failure + stale | toast-long | 135 px | 211 px | 115 / 191 px |
| failure + stale | toast-full | 135 px | 211 px | 115 / 191 px |
| failure + stale | edge | 60 px | 98 px | 0 / 25 px (row 22 left 16.9 / 8.5 px) |
| stale only | toast | 98 px | 135 px | 77 / 115 px |
| stale only | toast-full | 173 px | 249 px (58% of the band) | 153 / 229 px |

- **Long strings do not suit a transient cue**, as the owner suspected.
  `toast-full` reaches 58% of the band (ES, stale), and the both-facts short
  text (`toast-long`) measures exactly as tall as the full notice, so it was
  dropped as the default.
- **Edge vs toast:** the edge cue covers the top of the band. It leaves row
  22 only 8.5–16.9px clear, and in Spanish it covers the start of the
  anchored row, including its round marker (screen
  `cal-open-combined-edge-es-320x693-200`). Here the page clamps the anchor
  (round 23 is the last row). In a full season it is not clamped, so the next
  race sits at the **top** of the band, directly under an edge cue. **Edge is
  not recommended.**

**Rules met by the toast, both languages, every run:**
- the scroll position never changes when the cue appears or leaves;
- no race row is fully concealed, and no focused row is entirely obscured
  (rounds 22 and 23 focused);
- no second cue after rotation and return;
- the cue leaves when the notice scrolls into view, and after 6 s.

**Retry (N-4, N-5) simulation** at 320 @200%, failure state, user taps
Refresh while the notice is off-screen:
- the failure notice is unchanged throughout (0 DOM mutations), and the
  existing "…" caption shows progress;
- the failed outcome shows the cue once more ("user-refresh"); a background
  condition never re-shows it.
- **Caveat:** the "…" caption appears above the list only during the refresh,
  because the frozen data has no check time. Chrome's scroll anchoring kept
  the anchored row still (−0.3px; scrollY +48). **Flutter has no scroll
  anchoring.** There the caption always exists and only its text changes, but
  any height change above the viewport would move the rows (48D §4).

**Landscape 693×320 @200%: no tested cue is acceptable.** The list band is
127px:
- the shortest cue (60px, one line) covers 47% of it;
- the long variants (ES) cover 77%;
- the toast hides the anchored race's **name** while it is shown ("23 ·
  Siguiente" stays visible; screen `cal-open-combined-toast-es-693x320-200`);
- the edge cue covers the same rows.

Nothing is fully concealed, so the WCAG 2.4.11 minimum is met for focus. But
for up to 6 s the next race cannot be identified. Reported as unresolved
rather than forced.

## 5. Measurements at large text (summary)

| | 390×844 @100% | 320×693 @200% | 693×320 @200% |
|---|---|---|---|
| Calendar list band | 685 px | 426 px | 127 px |
| Combined notice (EN / ES) | 41 / 60 | 135 / 211 | 60 / 98 |
| Toast cue, failure wording (EN / ES) | not triggered | 60 / 98 (14% / 23% of the band) | 60 / 60 (47%) |
| Detail failed + partial block (EN / ES) | 118 / 137 | 231 / 307 | 156 / 193 (59% / 74%) |

The full matrix (EN and ES × 3 viewports × every variant) is in `summary.txt`.

## 6. Accessibility limitations (explicit)

- **Placeholder semantics.** Notices and the cue are HTML `role="status"`
  live regions. With a cue showing, two live regions hold text (the
  off-screen notice and the cue). In the HTML model only the cue's inserted
  text is a change, so one announcement is expected. In Flutter, a notice
  inside the cache extent but off-screen could also announce. The Flutter
  implementation must silence the notice while the cue speaks (48D rule 4).
  **Not verified.**
- **No TalkBack, no Android.** No system bars, system font scaling or real
  `SnackBar` placement with the app's nested Scaffolds.
- **Timing.** The 6 s timeout is a placeholder. Android's accessibility
  timeout setting ("Time to take action") can lengthen transient messages,
  which would extend the landscape occlusion.
- **Focus geometry** was measured with programmatic focus without scrolling,
  not a keyboard or switch walk.
- **Reading order:** detail notices come before the content in N-1 order.
  Calendar notices come after the pinned rows and before round 20. The cue
  is last in the DOM and not focusable.

## 7. Preferred option and tradeoffs

**Notices:** adopt N-1 with the **combined notice** for failure + stale of
the same content on Calendar and Grand Prix (clear gain). On details, use it
too for consistency, although the space gain there is small. Keep the partial
notice separate.

**Calendar first open:** the **bottom toast with short text**:
- shown once after the first positioning, only when the full notice is not
  visible;
- non-focusable, no action, 6 s, removed when the notice comes into view;
- the same component serves N-5 (a user-initiated refresh outcome);
- failure states use the existing "Update failed" wording; stale-only needs
  the experimental "Calendar may be out of date" (ARB approval).

Tradeoffs:
- **Portrait 200%:** acceptable. 14–32% of the band for up to 6 s; the next
  race stays identifiable.
- **Landscape 200%:** not acceptable as tested: it hides the next race's name
  while shown.
- The failure + stale cue does not mention staleness. The full combined
  notice is one scroll away and states it.
- It needs a new transient component in Flutter (or a `SnackBar` used under
  the 48D rules) and device validation.

## 8. Remaining owner decisions

1. **Combined copy:** approve the N-2 candidate for a future ARB review (EN
   and ES), and whether details use it too (recommended for consistency).
2. **Calendar cue, portrait:** accept the bottom toast with short text
   (recommended), or prefer no cue.
3. **Calendar cue, landscape at large text:** choose one, or ask for another
   experiment. None of the tested variants is acceptable there.
   - (a) accept the transient occlusion of the next race for ≤ 6 s;
   - (b) no cue when it would exceed a share of the band (the notice stays
     hidden in that case, against N-6);
   - (c) in that case only, skip the one-time anchor so the notice is visible
     (against the anchoring preference);
4. **Cue copy:** the stale-only text "Calendar may be out of date" / "El
   calendario puede estar desactualizado" for ARB review; the failure cue
   reuses "Update failed" / "No se pudo actualizar".
5. **N-7:** confirm that per-table Home failures stay unpresented.
6. **Evidence retention:** after review, keep the reviewed screenshots
   Git-visible and the rest local (as in Step 49B.2). The folder is currently
   untracked and not ignored.

Backlog statuses are unchanged.

## Reproduce

```text
python build.py            # regenerate the 12 pages (--check verifies them)
node checks.mjs            # measurements + screenshots into validation-<stamp>-experiment/
```

Page parameters are listed at the top of `calendar-notices.js`; for example
`calendar.html?state=failed,stale&anchor=1&cue=toast&scale=200`.

---

## Step 49D.2: final copy and Calendar initial positioning

**2026-11-11. Focused comparison, not a regression sweep.**
- **Evidence:** `validation-20261111-223633-49d2/` (`results.json`,
  `summary.txt`, 14 screenshots, 1.8 MB), produced by `checks-49d2.mjs`.
- **New page parameters:** `?copy=b`, `?open=notice` and `?inline=1` in
  `calendar-notices.js`, plus `detail-combined-b-partial[.es].html`.
- **Fixture:** the four-round fixture is kept; no race was invented.
- **Scope of the measurements:** Chrome emulation only (software raster,
  DPR 2, no Android system bars). **Android and TalkBack behaviour is
  unverified.**

### Owner review recorded (STATUS-NOTICE-DECISIONS §11, DESIGN-DECISIONS)

- **Provisionally visually approved:**
  - one notice for failure + stale of the same content;
  - the separate incomplete-profile notice;
  - the existing notice layout.
- **N-2:** provisionally approved, final wording pending (this section).
- **Not approved:** the 49D.1 bottom toast at 200% text (it also covers
  meaningful race-card content in portrait), and any overlay in 693×320
  landscape. Not to be implemented.
- **N-5 and N-6:** open.
- **N-7:** approved with conditions. No global Home notice for every
  standings-table failure, and no module may misleadingly imply freshness.
- **Accessibility items:** none closed.

### 1. Combined-copy comparison (failure + stale)

| | Candidate A (49D.1) | Candidate B (49D.2) |
|---|---|---|
| EN | "Couldn’t refresh — this data may be out of date." | "Couldn't refresh. Saved data may be out of date." |
| ES | "No se pudo actualizar — estos datos pueden estar desactualizados." | "No se pudo actualizar. Los datos guardados pueden estar desactualizados." |

Measured line breaks:

| View | A | B |
|---|---|---|
| Calendar EN 320×693 @200% | 135.4 px, 3 lines: "Couldn’t refresh — / this data may be / out of date." | 135.4 px, 3 lines: "Couldn't refresh. / Saved data may / be out of date." |
| Calendar ES 320×693 @200% | 211.0 px, 5 lines: "No se pudo / actualizar — estos / datos pueden / estar / desactualizados." | 211.0 px, 5 lines: "No se pudo / actualizar. Los / datos guardados / pueden estar / desactualizados." |
| First race visible below it (EN / ES) | 164 / 52 px | 164 / 52 px |
| Detail (combined + partial) EN / ES 320 @200% | block 307 / 420 px; name visible | identical |
| 693×320 @200% EN / ES | 1 line (60 px) / 2 lines (98 px) | identical |

**Recommendation: candidate B**, as the exact pair EN "Couldn't refresh.
Saved data may be out of date." / ES "No se pudo actualizar. Los datos
guardados pueden estar desactualizados."
- It costs nothing: same height and same line count everywhere tested.
- It keeps the saved-data meaning of both existing notices
  (`refreshFailedNotice`, `offlineStaleNotice`).
- Two sentences replace the em dash, which reads more clearly aloud.
- **Minor:** Spanish at 320 @200% ends a line on "Los". Acceptable; no
  wording change proposed.
- **Typography:** the straight apostrophe matches the existing ARB strings.
- **Not ARB copy yet:** both candidates are copy candidates, and the ARB
  files are unchanged.

Screens:
- `copy-calendar-{A,B}-{en,es}-320x693-200.png`;
- `copy-detail-B-{en,es}-320x693-200.png`. Detail candidate A is in
  `../validation-20261111-214632-experiment/screens/detail-combined-partial-{en,es}-320x693-200.png`.

### 2. Calendar first-open comparison (failure or stale notice present)

| Option | What it does |
|---|---|
| Reference (49D.1) | Anchored to the next race, no cue: the notice is off-screen. Already not acceptable (N-6). The toast references stay in the 49D.1 folder |
| **A, notice first** (`?open=notice`) | When a notice exists at the first positioning, the one-time anchor is skipped. The page opens at the top: full notice, then the races. No overlay; the "Next" card is unchanged |
| **B, inline line** (`?inline=1`) | Anchor kept. If the notice is off-screen afterwards, a one-line status in caption type with the notice icon appears directly above the next race, and that line is positioned at the top of the list band. Existing wording: "Update failed" / "No se pudo actualizar"; stale: "Some information may be outdated" / "Parte de la información puede estar desactualizada" (`homeSomeInformationOutdated`). Visual only (`aria-hidden`), so the full notice stays the accessible source |

**Measured at open** (320×693 @200%: list band 426 px, next race 317 px;
693×320 @200%: band 127 px, next race 214 px):

| | Reference | A, notice first | B, inline line |
|---|---|---|---|
| Full notice visible | No | **Yes** (all 8 cases) | No (still at the top of the content) |
| Next race visible, 320 portrait | Fully | **No**: 1,116–1,265 px of scrolling | Fully when failed; 265 of 317 px when stale |
| Next race visible, 693 landscape | 126 of 214 px | **No**: 655–693 px of scrolling | Only 36–71 of 214 px |
| Added height | — | — | Failed: 51 px (EN), 86 px (ES). Stale: **156 px** (EN and ES, 4 lines in the name column) |
| Scroll stable 1.5 s after open | Yes | Yes | Yes |
| Tab stops to the next race | 6 | 6 | 6 |
| Accessible order | notice → rounds 20–23 | notice → rounds 20–23 | notice → rounds 20–23 (inline line hidden from AT) |
| Live regions with text | 1 | 1 | 1 |

**Keyboard and scrolling (Chrome):**
- **Option A:** Tab goes Refresh → Settings → round 20 → 21 → 22 → 23. Each
  step scrolls downwards only, and every focused row in portrait is clear of
  the pinned rows and the navigation. From the visible notice the user
  scrolls or tabs straight down to the next race.
- **Reference and option B:** the first Tab onto Refresh, then Settings,
  each moved the page up by 289 px (portrait) or 140 px (landscape). This is
  Chrome scrolling the page when focus lands on the sticky header's buttons.
  It also happens in the reference, so it does not come from either option,
  and Flutter's app bar is not expected to do this (unverified). Tab then
  continues to round 20, far above the anchored race.
- **Landscape, all options:** round 23 (214 px) is taller than the 127 px
  band, so it can never be fully clear of the pinned rows. This is the known
  Stage 1 L1 case (oversized row aligned to its top), and neither option
  causes it.

**Why option B is rejected:**
- **Confusing attribution.** Directly above "23 · Next · Abu Dhabi Grand
  Prix", "Some information may be outdated" reads as a statement about that
  race, not about the whole calendar (screen
  `open-B-stale-es-320x693-200.png`).
- **Excessive height.** The stale line is 156 px at 320 @200%. In landscape
  it pushes the next race down to 36–71 px visible, which defeats the reason
  for keeping the anchor.
- **Duplication.** When the user scrolls up, both the notice and the line
  state the same condition.
- **Accessibility asymmetry.** If the line is hidden from assistive
  technology, it is a sighted-only cue. If it is exposed, it duplicates the
  notice for screen readers and becomes an extra list item.
- **Not tested:** a full-width line would be shorter, but the attribution and
  duplication problems would remain.

**Least harmful option: A, notice first.**
- It never hides the notice, adds no element, overlay or copy, and causes no
  scroll jumps or duplicate announcements.
- **Its cost is the owner's anchoring preference:** while a stale or failure
  notice exists at first opening, the Calendar opens at the top. The next race
  stays one scroll (or six Tab stops) away and keeps its "Next" emphasis.
- With a full season the scroll to the next race would be longer than in
  this four-round fixture. That could not be measured without inventing
  races.

**Conditions if A is adopted:**
1. It applies only at the one-time first positioning, and only when a
   failure or stale notice exists at that moment.
2. A notice that appears later never scrolls the list.
3. Without a notice, the next-race anchoring is unchanged.
4. Return navigation and scroll restoration are unchanged (XS-19).

Screens:
- `open-A-failed-en-*` and `open-A-stale-es-*` at 320×693 and 693×320
  @200%;
- `open-B-failed-en-*` and `open-B-stale-es-*` at the same sizes;
- references in `../validation-20261111-214632-experiment/screens/`:
  `cal-open-combined-none-en-320x693-200.png`,
  `cal-open-combined-toast-en-320x693-200.png`,
  `cal-open-combined-toast-es-693x320-200.png`.

### 3. Rejected alternatives (all steps)

- **Bottom toast with short text (49D.1):** not approved at 200%; it covers
  race-card content.
- **Top-edge cue:** covers the next race in a full season.
- **Toast with the full notice text:** up to 58% of the band.
- **Toast stating both facts:** as tall as the full notice.
- **Any overlay in 693×320 landscape:** not approved.
- **Option B, inline line:** attribution, height, duplication.
- **Stacked failure + stale notices:** replaced by the combined notice.

### 4. Recommended final direction

1. **Combined notice, candidate B wording.** EN "Couldn't refresh. Saved data
   may be out of date." / ES "No se pudo actualizar. Los datos guardados
   pueden estar desactualizados." Used for failure + stale of the same
   content on Calendar, Grand Prix and details. It goes to a future ARB
   review.
2. **Detail screens:** the incomplete-profile notice stays separate, after
   the combined or failure notice (N-1).
3. **Calendar first open:** option A, notice first, with the conditions
   above. No overlay, no inline duplicate.
4. **N-5:** stays a candidate. The 49D.1 toast is not approved, so no
   transient notification is recommended; a user-initiated refresh outcome
   while scrolled away would rely on the persistent notice.

### 5. Remaining Android and accessibility tests (unverified here)

**TalkBack:**
- the notice is announced once on open (notice first, Calendar and details);
- no announcement from an off-screen notice;
- the combined notice is read as two sentences;
- failure + incomplete on details is read in N-1 order;
- a retry that keeps the failure notice produces no re-announcement (N-4).

**Device rendering:**
- notice heights with system font scaling at 200%, against these Chrome
  values;
- Android system bars and gesture navigation in 693×320 landscape;
- the oversized next-race row in landscape (L1);
- Calendar first-positioning logic in `CalendarScrollAnchor` with a full
  season;
- that focusing app-bar actions does not scroll the list (the Chrome 289 px
  effect);
- scroll restoration on return (XS-19).

**Owner decisions still open:**
- adopt candidate B and option A;
- N-5 (whether any transient feedback remains a candidate);
- evidence retention for both validation folders (still untracked, not
  ignored).

Backlog statuses are unchanged.

---

## Step 49D.3: closure

**2026-11-11. Documentation and evidence retention only; no new screenshot or
experiment.**

### Owner-approved semantic policy
- **N-1:** failure, stale and incomplete independently representable; order
  failure → stale → incomplete; one of each; a failure never conceals an
  incomplete profile.
- **N-2:** combined notice for failure + stale of the same content, worded
  EN "Couldn't refresh. Saved data may be out of date." / ES "No se pudo actualizar. Los datos guardados pueden estar desactualizados.". Same measured height as the earlier candidate. Preferred
  wording for future implementation; no ARB implementation authorised.
- **N-3:** Home keeps module-specific unavailable information in the module.
- **N-4:** the failure notice stays during a retry until the outcome is known.
- **N-7:** no global Home notice per standings-table failure; no module may
  misleadingly imply freshness.

### Preferred but conditionally approved presentation
- **N-6 (provisional, not production-ready):** when a relevant failure or
  stale notice exists at the first positioning, Calendar opens with that
  notice visible. Otherwise it jumps to the next race as today. A notice that
  appears later never moves the scroll.
- **Condition:** the distance to the next race with a real, complete season.
  The four-round fixture already needs 1,116–1,265px at 320 @200%. If
  unreasonable, investigate a direct navigation affordance during Flutter
  planning.
- **Rejected:**
  - **N-5:** the first-open toast and every tested overlay;
  - **the inline line before the next race:** reads as about that race, 156px
    when stale, duplicates the notice, sighted-only;
  - **stacked failure + stale notices:** replaced by the combined notice.

### Unresolved Flutter and device requirements
- **Full-season navigation** to the next race under N-6.
- **Feedback after a user-initiated refresh** whose notice is off-screen. No
  snackbar design is approved.
- **Android:** system insets and system font scaling (Chrome heights only
  here).
- **TalkBack:**
  - one announcement per change, and an off-screen notice silent;
  - reading order (notice before content; details failure → incomplete);
  - the accessibility timeout.
- **Flutter scroll anchoring** (none) and the **N-4 retry-state** change.
- **Chrome artifact:** Tab onto the sticky header's buttons scrolls the page;
  check this does not happen with Flutter's app bar.

### Evidence retention

The rules are in `design-exploration/.gitignore`:
- **Git-visible:** sources, generators, scripts, reports, HTML, CSS,
  JavaScript, `results.json` and `summary.txt`.
- **Owner-review screenshots, also Git-visible:**
  - **Step 49D.1:** the nine files presented in the 49D.1 report:
    - `cal-stacked-es-320x693-200`, `cal-combined-es-320x693-200`;
    - `cal-open-combined-none-en-320x693-200`,
      `cal-open-combined-toast-en-320x693-200`,
      `cal-open-combined-edge-es-320x693-200`,
      `cal-open-combined-toast-es-693x320-200`;
    - `detail-failed-partial-es-320x693-200`,
      `detail-combined-partial-en-320x693-200`,
      `detail-stacked-partial-en-320x693-200`.

    The owner referred to seven; all nine presented files are kept, and two
    can be returned to local-only on request.
  - **Step 49D.2:** the seven representative files:
    - `copy-calendar-A-es-320x693-200`, `copy-calendar-B-es-320x693-200`,
      `copy-detail-B-en-320x693-200`;
    - `open-A-failed-en-320x693-200`, `open-A-stale-es-693x320-200`;
    - `open-B-stale-es-320x693-200`, `open-B-failed-en-693x320-200`.
- **Local only:** every other PNG in both `screens/` folders, kept on disk.
