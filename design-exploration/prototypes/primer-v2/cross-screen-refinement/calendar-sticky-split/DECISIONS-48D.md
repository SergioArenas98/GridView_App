# Calendar sticky split: status notifications and extreme viewports (Step 48D)

**Status: decision report, 2026-11-10.** Recommendations only. Nothing here
is implemented, and nothing changes the experiment, the approved
`../../calendar/`, Flutter or ARB files.

The owner provisionally approved the split as the preferred visual direction
(`../../DESIGN-DECISIONS.md` CT-02). The basis was two comparisons at 320×693
with 200% text:

- Spanish stale-data, mid-list;
- English refresh-failure, round 22 focused.

Device and functional validation are still outstanding. XS-06, XS-07 and the
accessibility items stay open.

How sure each finding is:

- **[P]** Measured in the prototype (headless Chrome emulation, software
  raster, safe-area insets 0).
- **[F]** Read from the current Flutter code (read-only).
- **[A]** An assumption about future Flutter or Android behaviour. It must be
  tested before it is relied on.

Evidence:

- [`validation-20261110-211120-step48d/`](validation-20261110-211120-step48d/),
  produced by [`step48d-checks.mjs`](step48d-checks.mjs). A second run was
  byte-identical.
- The Step 48C evidence ([`REPORT.md`](REPORT.md)), kept unchanged.

## 1. Recommended notification behaviour

### 1.1 Current Flutter behaviour [F]

Source: `calendar_screen.dart`, `calendar_state.dart`, `calendar_providers.dart`
and `gv_states.dart`.

The caption and the notice sit in `_CalendarHeader`, outside the `ListView`,
so they are always on screen. There is one notice slot: a failure takes
precedence over stale. It is a `GvOfflineNotice`, which is
`Semantics(liveRegion: true, label)` wrapped around `ExcludeSemantics`, so it
speaks once. Calendar has no snackbar. `ScaffoldMessenger` snackbars appear
only in the two Settings screens, with `settingsSaveFailed` and
`settingsOpenFailed`.

| Event | What Flutter does today |
|---|---|
| Refresh fails while scrolled | The coordinator's outcome for `calendar:<season>` sets `refreshError`, and the notice appears in the fixed header. The list viewport shrinks from the top by the notice's height, so the row being read moves down by that amount. Today's notice is a live region and is always built. Whether TalkBack announces it is not verified on a device |
| Cached data becomes stale | Freshness is computed with `now` only when `calendarStateProvider` recomputes, after a sync-state, Drift, metadata or season change. There is no periodic timer in `lib/`. Data that goes stale while the screen sits idle shows the notice only at the next recompute, such as a foreground sync |
| Refresh succeeds after a failure | `refreshError` is cleared when the refresh starts, because the provider returns `null` while it is running. The caption shows "…" and then the new time. There is no success message or announcement, and none exists in the ARB files |
| TalkBack user | One live-region node. The caption is not a live region |
| Several changes close together | Taps on Refresh while a run is in progress are ignored, and the coordinator also coalesces runs. A failed retry removes the failure notice at the start and adds it back at the end. If the data is stale, the stale notice shows in between. Each time the notice comes back it is a new live-region appearance |

### 1.2 What the split changes

- **Visible notice [P]:** at 320 @200%, a notice that arrives while the user
  is mid-list stays 0px on screen until the user scrolls to the top. The row
  being read moves less than 1px (Step 48C §5). In the prototype the notice
  is always in the DOM with `role="status"`.
- **Announcement [A]:** in Flutter the status section would be a leading
  sliver. Once it is scrolled beyond the cache extent it is not built, so it
  has no semantics node and its live region cannot announce. **Today's
  announcement would be lost**, not just the visible notice. That is why a
  cue is needed.

### 1.3 Recommendation: one transient snackbar with existing copy

Use the existing `ScaffoldMessenger` snackbar mechanism. It is already used
in Settings, and no new component is needed. Rules:

1. **When it shows.** The notice changes from absent to present, or from
   stale to failed, *and* the notice's position is outside the visible band.
   It never shows while the notice is on screen, because the notice itself
   speaks then.
2. **Copy.** Exactly the notice's string: `refreshFailedNotice` or
   `offlineStaleNotice`, in English and Spanish. **No action button.** "Show"
   or "Back to top" do not exist in the ARB files, and the cue must not
   scroll the list. Nothing is shown for refreshing or for success; today
   shows nothing for those either.
3. **No repeats.** At most once per status episode. An episode ends when the
   status clears: a successful refresh clears a failure, and fresh data clears
   stale. A failure that returns after a **user-initiated** retry is new
   feedback and may show again. A failure that returns after an automatic
   (coordinator) run in the same episode does not. A new snackbar replaces
   the current one rather than queuing, and a successful refresh removes a
   visible failure snackbar.
4. **One announcement per change.** Either the in-list notice's live region
   speaks (notice visible) or the snackbar speaks (notice not visible), never
   both. In practice the notice's `liveRegion` stays on only while the notice
   is visible. This needs a TalkBack test. A built but off-screen notice
   inside the cache extent could otherwise announce as well [A].
5. **No jump, no persistent space.** It never changes scroll position or
   focus, and it disappears on its default timeout. The race list keeps its
   space, and the notice stays where it is in the content.
6. **Focus.** The snackbar must not hide a focused race row entirely (WCAG 2.2
   2.4.11). It must be measured above the floating navigation at 320 @200% on
   a device. The app has two nested Scaffolds, the shell with the navigation
   and `GvScreenScaffold`, so where the snackbar lands must be checked [A].

**Alternatives rejected:**

- A status icon in the pinned season row: a new visual treatment and new
  semantics.
- A badge on Refresh: the title row can be released in landscape, and it is
  also a new treatment.
- A persistent banner: it costs list space.
- Auto-scrolling to the top: excluded by the brief.

**Not addressed:** data that goes stale while the screen sits idle has no
re-evaluation trigger today [F]. The cue inherits that limit. Changing it
would be a separate decision about synchronization behaviour.

## 2. Landscape accessibility acceptance criteria

The case: 693×320 at 200% text, title row released. Round 23 (the "Next"
row) is **213.56px** tall. The band between the pinned season row (68.5) and
the navigation is **170.61px**. The row is 42.95px taller than the band in
English and Spanish, in the default and failed states [P].

| Question | Finding [P] |
|---|---|
| Whole row visible at once | **Impossible** while the season row stays pinned and text stays at 200%. Releasing the season row would make it fit, but the direction rules that out |
| Every part reachable by scrolling | **Yes**, 4/4. Top at the band edge: 0–0.38px hidden (whole-pixel scrolling). Bottom at the navigation: 0–0.38px hidden. The last row's bottom clears the navigation at the maximum scroll |
| Keyboard focus, current experiment | Chrome centres the oversized row. **21.17–21.78px of its top** sits under the season row, and as much of its bottom sits under the navigation. The focus ring is partly visible, which meets WCAG 2.4.11 (AA) but not 2.4.12 (AAA) |
| Keyboard focus, candidate rule (injected at test time only) | An oversized focused row aligned to its top edge: **0px hidden at the top** in 4/4. Its bottom 43.17–43.58px is then reachable by scrolling |
| Screen-reader access | Not measured in Chrome. Today's Flutter row is one semantics node (`calendarEventSemantics`: name, round, status), so reading it does not depend on what is visible [F]. TalkBack's focus rectangle and its scroll-to-reveal on a partly visible node need a device test [A] |

**Proposed criteria** (they replace "a focused row must be fully visible",
which is impossible here):

- **L1 Start visible.** When a focused row is taller than the band, its top
  edge (round number, Grand Prix name, status) sits at the bottom of the
  pinned season row, with nothing hidden. A row that fits must be fully
  visible, as today.
- **L2 Fully reachable.** Ordinary scrolling brings every part of every row
  into the band, including the last row's bottom above the navigation.
- **L3 Focus never entirely hidden.** This is WCAG 2.4.11 (AA). Whole-row
  visibility (2.4.12, AAA) is not required for rows taller than the band.
- **L4 Complete accessible name.** The row's full content is in its accessible
  name or reading order, whatever is visible. With TalkBack, moving focus to
  the row brings at least its start into view.
- **L5 No compensation.** Text scaling, the navigation and the pinned season
  row are not changed to meet L1–L4.

The candidate rule behind L1 is one listener. It runs only when focus is
from the keyboard and the row is taller than the band. It was not added to
the experiment; adding it is an owner decision (§6).

## 3. Recommended title-row release rule

The current rule releases the title row only when keeping it pinned would stop
the tallest race row from fitting between the pinned header and the
navigation.

### Stability [P]

These were checked in English and Spanish:

- **Text-size sweeps.** 100 → 200 → 100% in steps of 10, at 693×320 and
  320×693. Up and down gave identical decisions, so no hysteresis is needed.
  Landscape releases between 120% and 130%. Portrait never releases.
- **Viewport-height sweep.** 320 wide at 200%: the title row releases between
  593 and 568px high.
- **Rotation.** Three round trips: pinned in portrait and released in
  landscape every time.
- **Notices while released and scrolled.** The decision and the header height
  (112.5) were unchanged in all 7 states.
- **No feedback loop.** Across 88 settling samples, 1 second each, there were
  0 extra writes. The rule's inputs (full header height, navigation, rows,
  viewport) do not depend on its output, because the sticky offset does not
  change layout.

These are fragile:

- **Content changes the decision.** At 320×593 @200% the margin is 8.97px.
  One extra line on the tallest row (316.75 → 403.13) releases the title row
  without any change to the environment. A synced data change could do the
  same while someone is reading.
- **Thin margins.** At landscape 120% the margin is 2.06px. Device font
  metrics could flip the decision.
- **Focus jump.** With the title row released, Shift+Tab from round 20 to
  Settings scrolls the page by **162px** (English 192 → 30, Spanish 230 → 68).
  Round 20 slides 160px under the navigation. Tab back returns it, off by
  1px. The "before" variant does not move. A candidate keep-scroll rule
  (restore the scroll position when focus enters a released header) removed
  the jump: 0px in both languages.
- **Flutter cannot measure every row.** A lazy list does not lay out rows that
  are not built [A].

A simpler share-of-viewport rule was checked against the same data and is
worse. "Release when the band is under 50% of the viewport" releases at
landscape 110%, where the row still fits by 13.16px. It also keeps the title
row at 320×568, where the row does not fit (−16.03px).

### Recommendation: adjust, do not replace

Keep the measured principle, with three changes:

1. **Evaluate only on environment changes:** first layout, text scale,
   viewport size, orientation. Content and notice changes never flip the
   decision while the screen is open.
2. **Keep the scroll position** when keyboard focus enters a released title
   row. This fixes the measured 162px jump.
3. **Reference row = the tallest laid-out row** when the decision is made. In
   Flutter that means the rows built in the viewport and cache extent, so the
   rule never depends on unbuilt rows.

The rule stays specific to Calendar and is not generalised.

## 4. Flutter implementation considerations (no implementation)

**Recommended staging.**

- **Stage 1:** move only the caption and notice into the scroll view. The
  title row stays a fixed `GvAppBar`, and the season row stays outside the
  scroll view in the existing `Column`.
  - This delivers the measured portrait gain: the title row never releases
    in portrait at the tested sizes.
  - It also moves landscape @200% from 56.81 / 19.02px of list
    (English / Spanish failed, before) to **126.61px** [P].
  - It needs no persistent header.
- **Stage 2:** release the title row (+44px, to 170.61 in landscape @200%).
  This is an optional, separate change, because it needs a sliver app bar or
  a persistent header and the rule in §3.

| Topic | Consideration |
|---|---|
| Scrollable status section | `CustomScrollView`: a leading sliver (caption, mock-data banner, notice, in today's order), then the events sliver with the same separators and padding. The same `CalendarState` drives it, so offline-first and synchronization behaviour are untouched: no new requests, no provider changes |
| Race-index positioning | Event indexes stay positions within the events sliver, so the "index = position in the season" contract holds inside that sliver. `CalendarScrollAnchor`'s first estimate (`maxScrollExtent × index / (n−1)`) moves by at most the status height and still converges through `ensureVisible`, but its pass budget must be re-tested [A] |
| Anchoring when notices change | Flutter has no browser-style scroll anchoring. Notices change above the viewport (today's retry removes and re-adds the failure notice), so without compensation the rows jump by the notice's height. Options: (a) add the extent change to the scroll offset while the status section is above the viewport, or (b) a `center` events sliver so that leading slivers grow upward. Choose with a spike [A] |
| Focus visibility | In stage 1 the viewport is exactly the band: the pinned chrome is outside the scroll view and the navigation reserves layout space [F]. Focus traversal's `ensureVisible` then cannot hide a row behind chrome [A]. Oversized rows need L1: reveal with alignment 0, not keep-visible-at-end. After a text-scale or orientation change, bring a keyboard-focused row back after the frame, as the prototype's rule does. Stage 2 adds pinned-header-aware reveal [A] |
| Season context | Stage 1: unchanged position, outside the scroll view, so it is always visible. Stage 2: a pinned `SliverPersistentHeader`. Its semantics (season as the list's label) must survive in both stages |
| Notification (§1) | `ref.listen` on `calendarStateProvider` transitions in the screen. Visibility comes from the scroll offset and the status sliver's extent. `liveRegion` stays on the notice only while it is visible. Existing ARB strings only |

## 5. Unresolved device tests

All Android, at 200% system font and with gesture and button navigation:

1. TalkBack announcements:
   - notice visible, failure arrives: one announcement;
   - scrolled away, failure arrives: the snackbar is announced once and the
     notice is silent;
   - a retry cycle while scrolled: no repeats beyond §1.3 rule 3.
2. Snackbar placement with the nested Scaffolds: above the floating
   navigation, never covering a focused row entirely.
3. Rows staying still when a notice is added or removed above the viewport,
   for the anchoring option chosen.
4. First-open positioning on the next event with the status sliver present,
   including the convergence passes.
5. Landscape at 200%: L1–L4 with a keyboard and with TalkBack (focus
   rectangle, scroll-to-reveal on the oversized row).
6. Text-scale and rotation changes with keyboard focus on a row.
7. Edge-to-edge and system-bar insets (Chrome measured 0) and real navigation
   heights.
8. Stage 2 only: the release decision at the device's real heights and font
   metrics, the keep-scroll rule, and focus entering and leaving the title
   row.

## 6. Exact remaining owner decisions

1. **Off-screen notification:** accept the transient snackbar with the
   existing notice copy and no action (§1.3), or choose no cue.
2. **Contract change:** accept that the caption and notices are no longer
   always visible. This changes C13/C15 in the approved Calendar README.
3. **Landscape criteria:** accept L1–L5 in place of whole-row visibility.
   Decide whether the L1 top-alignment rule may be added to the experiment
   (prototype only).
4. **Title-row release:** stage 1 only (title row always pinned), or stage 2
   with the adjusted rule (§3). If stage 2, whether the keep-scroll rule may
   be added to the experiment.
5. **Flutter:** when to authorise a Flutter spike for stage 1, including the
   anchoring choice in §4. This report does not authorise one.

## Reproduce

```
node step48d-checks.mjs            # writes validation-<stamp>-step48d/
```

The candidate rules (L1 top alignment, keep-scroll) are injected by the
script at test time and are not in the experiment's files.
