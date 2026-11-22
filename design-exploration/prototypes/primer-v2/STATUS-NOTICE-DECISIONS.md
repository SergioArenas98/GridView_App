# Concurrent status notices (Step 49D)

**Status: decision document, closed as an exploration 2026-11-11 (Step 49D.3,
§12).** N-1, N-3 approved; N-2 wording approved for future implementation (no
ARB change yet); N-4 approved direction; N-5 rejected; N-6 provisionally
preferred and conditional (not production-ready); N-7 approved with
conditions. Nothing implemented: Flutter, the tests, ARB files, domain
models, synchronization, the prototypes, the consolidation pilots and the
Calendar and absence experiments are unchanged. Experiment:
`cross-screen-refinement/notice-coexistence/`.

- **Continues:** `STATUS-SEMANTICS-AUDIT.md` C5, C6, D3 and decision D3;
  the CT-03 open list; `cross-screen-refinement/calendar-sticky-split/DECISIONS-48D.md`
  §1 (the conditional snackbar: never approved; Calendar overlays rejected in
  Step 49D.3, N-5); XS-22 (notice icon).
- **Code read at `e3e9f88`.** Paths are relative to `lib/` unless stated.
- **Screens:** Calendar (today and Stage 1), Grand Prix Detail, Driver, Team
  and Circuit Detail, Home where relevant. Standings and Explore use the same
  one-slot pattern but are out of scope.
- **Android and TalkBack behaviour is unverified** throughout. No screenshot
  was taken.

## Summary

| # | Finding | Misleading? | Smallest correction | New copy |
|---|---|---|---|---|
| N1 | **Details: a refresh failure hides the partial-profile notice.** "Update failed" replaces "Some profile information is unavailable", while the detail-owned sections are simply absent | **Yes, high.** The page reads as a complete saved profile. Typical case: a driver opened from Explore for the first time while the request fails | Show both existing notices | No |
| N2 | **Failure hides staleness** on Calendar, Grand Prix, details and Home | **Partly.** "showing saved data" hints at age but does not say the data may be out of date | Show both. Calendar and Grand Prix pair two long sentences that both say "saved": stacked existing strings, or one combined string (owner choice) | Optional |
| N3 | **Grand Prix (remote builds): an event refresh failure hides stale results.** The results section defers staleness to the top notice, which shows only the failure | Partly (as N2) | Covered by N2: the top notice keeps the stale fact | No |
| N4 | **A retry removes and re-adds the failure notice.** `refreshError` is `null` while refreshing on every screen; the stale or partial notice flashes in between | Not false, but noisy: each return is a new live-region announcement, and in Calendar Stage 1 a change above the viewport moves the rows (no scroll anchoring in Flutter) | Keep the failure notice until an outcome replaces it (functional change, owner decision) | No |
| N5 | **Calendar Stage 1 at first open:** the one-time anchor scrolls to the relevant round, so a notice that is present **at open** starts off-screen. The 48D cue only fires on a change, so it never fires here | **Yes, for a stale calendar** (dates may have moved). Today's fixed header always shows it | Owner decision (§8 N-6) | No |
| N6 | **Changes while scrolled away** (Stage 1, Grand Prix, details, Home): the notice is at the top of the scrolling content; off-screen beyond the cache extent it has no semantics node and cannot announce | No false fact (the content does not change). Missing feedback only for a **user-initiated** Refresh | No automatic cue; at most the 48D candidate, narrowed to a user-initiated Refresh outcome | No |

**No combination makes a success imply completeness.** A successful refresh
clears only the notices it resolves: a 404 keeps the partial notice, Home's
unavailable modules stay unavailable, and composed sections that depend on
other resources stay omitted without any claim.

---

## 1. Existing notice behaviour by screen

All notices use `GvOfflineNotice` (`core/widgets/gv_states.dart` line 82:
`Semantics(liveRegion: true)` around `ExcludeSemantics`, cloud-off icon,
text wraps). One live-region node per notice. "Slot" means the screen shows
at most one such notice in that place.

| Screen | Where | Slot rule today (first true wins) | Refreshing shown as | Prototype |
|---|---|---|---|---|
| **Calendar (Flutter)** | Fixed header outside the list (`calendar/presentation/calendar_screen.dart` `_CalendarHeader`, line 149) | failure `refreshFailedNotice` → stale `offlineStaleNotice` | Caption "Last successful check: …" ("Comprobado: …") with an ellipsis in place of the time | `calendar/` same; one notice per state |
| **Calendar Stage 1 (CT-03)** | Caption and notice **scroll with the content**, above round 1; title and season rows pinned | Same strings, same precedence | Same | `calendar-stage1/`: stale and failure rendered separately. Off-screen cue = 48D candidate |
| **Grand Prix Detail** | Top of the scroll content (`grand_prix_detail_screen.dart` lines 110–131), plus a results-scoped notice (line 245) | Top: event failure → stale (event, or results in remote builds). Results: own failure → own stale (fixture builds only) | Nothing | `grand-prix-detail/states.html` frames 4, 5 ("failure wording wins"), 17, 18, 19 |
| **Driver, Team, Circuit Detail** | Top of the scroll content (`shared/presentation/widgets/entity_detail_scaffold.dart` lines 87–96) | failure `detailUpdateFailed` → partial `detailPartialNotice` → stale `detailCachedNotice` | Nothing (no manual refresh) | Driver frames 5, 6, 7; Team 5, 6; Circuit 5, 6 and `partial.html`; one notice each |
| **Home** | Top of the scroll content (`home/presentation/home_screen.dart` line 466) | failure `homeUpdateFailed` → any stale section `homeSomeInformationOutdated` → any unavailable module `homeSomeInformationUnavailable` | Caption "Refreshing…" in place of "Updated {time}" | HOME-04: these states are not rendered |

**State facts that shape the combinations**
- **Failure is hidden while refreshing everywhere:**
  `refreshError = refreshing ? null : lastFailure` (`calendar_state.dart`
  line 170, `grand_prix_detail_state.dart`, `grand_prix_results_state.dart`,
  `entity_detail_state.dart`, `home_state.dart` line 454).
- **Details cannot be partial and stale together:** `freshness` is `null`
  unless the detail resource is materialized (`entity_detail_state.dart`).
- **Grand Prix has no partial state.** A detail cached only indirectly (for
  example from the Home snapshot, with no record) is treated as **stale**
  (`grand_prix_detail_state.dart`; test `grand_prix_detail_state_test.dart`
  line 84). The stale wording is true, so this is accepted as is.
- **Home's partial modules speak for themselves:** "Leader unavailable",
  "Upcoming events unavailable" and similar stay inside their modules, so a
  completeness fact survives even when the notice slot shows something else.
- **Home computes per-standings-table failures** (`driverStandingsFailed`,
  `constructorStandingsFailed` → `HomeLeaderModule.failed`) but **never
  presents them**.
- **Staleness has no timer** (audit C6, 48D §1.1): it is re-evaluated only
  when a provider recomputes.
- **Coexistence precedent:** in remote builds Grand Prix already shows **two
  notices** when the screen is stale and the results refresh fails
  (`test/screens/expired_freshness_notice_test.dart` line 240, "a result
  refresh failure keeps its own scoped notice").
- **Confidence never uses the notice slot.** Result finality and provisional
  chips live with the classification, so no notice suppresses them, and they
  suppress none.

## 2. Matrix of simultaneous conditions

"Shown" / "Suppressed" describe Flutter today. "Proto" is the approved
prototype. "Kind" is the recommended presentation (§4).

| ID | Combination | App knows | Shown | Suppressed | Proto | Misleading? | Reusable strings | Kind |
|---|---|---|---|---|---|---|---|---|
| M1 | Failure + stale (Calendar) | Both | "Couldn't refresh — showing saved data." | "This data may be out of date…" | Not rendered (single states only) | Partly (N2) | `refreshFailedNotice`, `offlineStaleNotice` | Persistent, both facts |
| M2 | Failure + stale (Grand Prix event) | Both | Failure | Stale | Frame 5 "failure wording wins" | Partly (N2) | Same | Persistent, both |
| M3 | Event failure + results stale (Grand Prix, remote) | Both | Failure at top | Results staleness (deferred to the top) | Not rendered | Partly (N3) | Same | Persistent, both at top |
| M4 | Event stale + results failure (Grand Prix, remote) | Both | Stale at top + failure in results | — | Frame 19 covers stale + stale only | No (already coexists) | Same | Keep |
| M5 | Failure + stale (details) | Both | "Update failed" | "Details may be outdated" | Separate frames | Partly (N2) | `detailUpdateFailed`, `detailCachedNotice` | Persistent, both |
| M6 | **Failure + partial (details)** | Both | "Update failed" | "Some profile information is unavailable" | Separate frames | **Yes (N1)** | `detailUpdateFailed`, `detailPartialNotice` | Persistent, both |
| M7 | Stale + partial (details) | Cannot occur (partial ⇒ no freshness) | — | — | — | — | — | — |
| M8 | Failure + stale (Home) | Both | "Update failed" | "Some information may be outdated" | HOME-04 | Partly (N2) | `homeUpdateFailed`, `homeSomeInformationOutdated` | Persistent, both |
| M9 | Failure or stale + partial (Home) | Both | Failure or stale notice | Aggregate "Some information is unavailable" | HOME-04 | No: each unavailable module shows its own message | `homeSomeInformationUnavailable` | No extra notice (Home exception) |
| M10 | Refreshing + stale (Calendar, Home, details) | Both | Stale notice stays; caption "…" / "Refreshing…" (details: nothing) | Last-success time while refreshing (Calendar) | Calendar caption | No | `lastUpdatedLabel`, `standingsRefreshingLabel` | Keep |
| M11 | Refreshing after a failure (all) | Failure from the last attempt | The failure disappears; stale or partial (if any) appears, then the failure returns | Failure during the retry | Not rendered | Noisy (N4) | Same | Persistent failure until an outcome (owner, N-4) |
| M12 | Success that leaves information missing | Detail 404, unmaterialized Home modules, composed sections from other resources | Partial notice kept (404); Home modules unavailable; composed sections omitted | — | `partial.html` | No | — | Keep |
| M13 | Status changes while the notice is off-screen (Stage 1, Grand Prix, details, Home) | The change | Notice updates in place, unseen; no announcement beyond the cache extent | The change itself | 48D candidate cue (Calendar only) | No false fact; no feedback for a user-initiated Refresh (N6) | Notice strings | No automatic cue; candidate only for user-initiated Refresh |
| M14 | **Notice present at first open, Calendar Stage 1** | Stale or failed | Notice above round 1, off-screen after the anchor | The fact at open | Not covered by 48D (change-triggered) | **Yes for stale (N5)** | Notice strings | Owner decision (N-6) |
| M15 | Repeated retries that keep failing | Same failure | Notice removed and re-added on each attempt | — | — | Noisy; Stage 1 row jumps (N4) | `refreshFailedNotice` | As M11; no snackbar repeat (48D rule 3) |
| M16 | Provisional or final results + any notice | Both | Chip with the classification + notice | — | Frames 16, 20, 25 | No | `resultStatus*` | Keep (data-level) |
| M17 | Home standings table failed, Home resource fine | Failure flag | Nothing (flag unused) | Per-table failure | — | No (the stale aggregate still applies) | — | Keep; owner N-7 |

## 3. Misleading suppressed information (ranked)

1. **M6 (N1), details: failure over a partial profile.** The partial notice
   is the **only** signal that the page is a summary: the detail-owned
   sections (Profile, About, facts) are omitted, not shown as missing
   (`entity_detail_widget_test.dart` line 53). With "Update failed" alone, a
   sighted or screen-reader user reasonably reads the page as the complete
   saved profile. This is completeness suppressed by an outcome notice, two
   independent dimensions.
2. **M14 (N5), Calendar Stage 1, stale at open.** It is a consequence of the
   approved Stage 1 move combined with today's first-open anchor. Flutter
   today never hides it. It applies only when Stage 1 is implemented.
3. **M1, M2, M3, M5, M8 (N2, N3), failure over staleness.** The failure
   string's "showing saved data" is true, but it does not say the saved data
   may be out of date, which is the fact that matters for dates and results.
   The Home and detail strings ("Update failed") say even less.
4. **M11, M15 (N4), retry churn.** No false fact, but the stale or partial
   notice flashes, each return is re-announced, and in Stage 1 the rows jump.

## 4. Proposed precedence and coexistence rules

**Four independent dimensions, four channels**

| Dimension | Values used today | Channel |
|---|---|---|
| Request outcome | failed (refreshing = in progress) | Screen notice; refreshing only in an existing caption |
| Freshness | stale (unknown is never presented) | Screen notice |
| Completeness | partial or detail unavailable (details); unavailable modules (Home) | Screen notice (details); module messages (Home) |
| Confidence | provisional, final, unavailable, unknown | With the data (chips, section notice); never the screen notice |

**Rules**

1. **Append, don't replace.** A notice never suppresses a notice of another
   dimension. At most **one notice per dimension per scope**.
2. **Fixed order:** outcome → freshness → completeness. The first notice is
   therefore exactly today's notice; the suppressed fact is added below it.
3. **One scope per fact.** A section-scoped notice exists only when its scope
   differs (Grand Prix results). A screen notice that already states a
   dimension for the section removes the duplicate in the section (today's
   Grand Prix rule, kept). It never removes a different dimension.
4. **Home exception (completeness).** Home's completeness is already carried
   by each unavailable module's own message, so the aggregate "Some
   information is unavailable" is shown only when no other notice is shown
   (today's behaviour). Home therefore shows at most two notices: outcome
   and freshness.
5. **A failure persists until an outcome replaces it** (owner N-4). A retry
   in progress does not clear it; success clears it; a repeated failure
   keeps it unchanged, with no new announcement. The existing caption ("…",
   "Refreshing…") signals the retry where a caption exists.
6. **Success shows nothing** and clears only the facts it resolves. It never
   clears completeness on its own.
7. **No automatic transient notification.** A status change while the notice
   is off-screen updates the persistent notice only. The only candidate
   exception is the 48D snackbar, narrowed to the **outcome of a
   user-initiated Refresh** while the notice is off-screen. Calendar and Home
   have a Refresh button in the pinned title row. Pull-to-refresh starts at
   the top, where the notice is visible. Still a candidate (owner N-5).
8. **No new colours, icons, categories or sticky notices.** Every notice
   stays a `GvOfflineNotice` in the content. XS-22 (cloud-off icon on a
   partial notice) stays separate, but stacking makes it more visible: two
   identical icons for two different causes.

**Screen-specific exceptions**
- **Calendar before Stage 1** (today's fixed header): a second notice would
  shrink the pinned area and reduce list space at 320 @200%. If the policy
  ships before Stage 1, the failure-plus-stale pair should use one combined
  notice (§6, option B) to stay one notice high.
- **Grand Prix:** the top notice keeps both outcome and freshness (M2, M3);
  the results section keeps only its own failure (M4 unchanged).
- **Details:** at most two notices (outcome + completeness, or outcome +
  freshness), because partial and stale cannot coexist.

## 5. Existing strings that can be reused

| Fact | Calendar, Grand Prix | Details | Home |
|---|---|---|---|
| Failed | `refreshFailedNotice` "Couldn't refresh — showing saved data." / "No se pudo actualizar — mostrando datos guardados." | `detailUpdateFailed` "Update failed" / "No se pudo actualizar" | `homeUpdateFailed` "Update failed" / "No se pudo actualizar" |
| Stale | `offlineStaleNotice` "This data may be out of date — showing the last saved version." / "Estos datos pueden estar desactualizados — mostrando la última versión guardada." | `detailCachedNotice` "Details may be outdated" / "Los detalles pueden estar desactualizados" | `homeSomeInformationOutdated` "Some information may be outdated" / "Parte de la información puede estar desactualizada" |
| Partial | — | `detailPartialNotice` "Some profile information is unavailable" / "Parte de la información del perfil no está disponible" | Module messages; `homeSomeInformationUnavailable` |
| Refreshing | `lastUpdatedLabel` with "…" | — | `standingsRefreshingLabel` "Refreshing…" / "Actualizando…" |
| Off-screen cue (candidate) | The notice's own string, no action (48D §1.3) | — | Same |

Every recommended combination can be stated with these strings.

## 6. Cases requiring new copy or functional changes

**Copy: none is unavoidable.** One pair reads redundantly when stacked:

- **Calendar and Grand Prix, failure + stale (M1, M2, M3).**
  - **Option A (no new copy):** stack the two existing sentences. Both are
    true, but "saved data" / "last saved version" repeats, and at 320 @200%
    the two long sentences wrap to several lines each.
  - **Option B (one new string, recommended if an ARB review is acceptable):**
    one notice. EN "Couldn't refresh — this data may be out of date." / ES
    "No se pudo actualizar — estos datos pueden estar desactualizados." It
    gives one live region and one notice height, and it is required if the
    policy ships before Calendar Stage 1 (§4).
- **Details and Home pairs** are short and not redundant, so no new copy is
  needed: "Update failed" + "Some profile information is unavailable",
  "Update failed" + "Details may be outdated", and "Update failed" + "Some
  information may be outdated".

**Functional changes (not implemented; each needs owner approval)**

| # | Change | Where | Kind |
|---|---|---|---|
| F1 | Notices as a list per rules 1–2 instead of `if / else if` | `entity_detail_scaffold.dart` `_notices`; `_CalendarHeader` (or the Stage 1 status sliver); `grand_prix_detail_screen.dart` top notice; `home_screen.dart` `_HomeNotices` | Presentation only |
| F2 | The failure persists through a retry (rule 5): stop nulling `refreshError` while refreshing, replace it on the outcome | The five state derivations in §1 | State derivation; changes 48D §1.1's "removed at the start" behaviour and its Stage 1 anchoring concern |
| F3 | User-initiated Refresh outcome cue while off-screen (rule 7), if the candidate is approved | Calendar, possibly Home | New use of the existing `ScaffoldMessenger`; 48D rules 3–6 apply |
| F4 | Calendar Stage 1 first-open behaviour (N-6) | `CalendarScrollAnchor` and the Stage 1 status sliver | Depends on the decision |

**Tests to adjust or add (when implemented)**
- **Prototype:** `grand-prix-detail/states[.es].html` frame 5 ("failure
  wording wins") would change for failure + stale; update it only after
  approval.
- **Single-condition tests stay valid:**
  - `calendar_widget_test.dart` lines 302 and 344;
  - the `expired_freshness_notice_test.dart` "one stale notice" cases;
  - `screen_semantics_test.dart` line 426.
- **New, details:** failure + partial shows both strings, failure first; a
  failure + stale profile shows both.
- **New, Calendar and Grand Prix:** failure + stale shows both facts (option
  A) or the combined string (option B). In a remote build, an event failure
  over stale results still states the staleness.
- **New, Home:** failure + stale shows two notices; failure + an unavailable
  module shows the failure notice, and the module keeps its own message.
- **New, accessibility:** one live region per notice. With F2, a failed retry
  keeps the label unchanged (no re-announcement).

## 7. Accessibility and large-text concerns

- **Live regions:** each notice is its own live region. Two notices
  appearing in the same frame may produce two announcements or one;
  **TalkBack behaviour is unverified**. Option B avoids the question for the
  longest pair.
- **Off-screen notices:** in Flutter, a notice scrolled beyond the cache
  extent has no semantics node and cannot announce (48D §1.2). This already
  applies today to Grand Prix, details and Home; Stage 1 extends it to
  Calendar.
- **Retry churn (N4):** today a failed retry produces up to three live-region
  changes (failure → stale or partial → failure). F2 removes them.
- **Reading order:** notices precede the content on every screen. In Stage
  1 they come after the pinned title and season rows and before round 1. In
  stacked form, the outcome is read first and the suppressed fact next.
- **200% text:** notices wrap. On details, Grand Prix, Home and Stage 1 they
  scroll with the content, so a second notice costs one more notice height
  at the top of the page but no pinned space. In today's fixed Calendar
  header it costs pinned space, hence the §4 exception. Heights were **not
  measured** in this step (no screenshots); measure before visual approval.
- **Icons:** two cloud-off icons for "Update failed" and "Some profile
  information is unavailable" would suggest one cause twice (XS-22).
- **Focus:** a candidate snackbar must not hide a focused row (48D rule 6);
  unchanged here.

## 8. Owner decisions required before visual refinement

- **N-1:** adopt rules 1–3: append, don't replace; one notice per dimension;
  order outcome → freshness → completeness. This closes audit decision D3.
- **N-2:** Calendar and Grand Prix failure + stale: option A (stack the
  existing strings) or option B (one new combined EN/ES string, needed if
  shipped before Stage 1).
- **N-3:** accept the Home exception (rule 4): completeness stays in the
  modules when another notice shows.
- **N-4:** keep a failure notice through a retry until an outcome replaces
  it (F2). This is a functional state change, recommended.
- **N-5:** off-screen changes: no automatic cue (recommended), with the 48D
  snackbar candidate narrowed to a user-initiated Refresh outcome, or no cue
  at all.
- **N-6:** Calendar Stage 1, notice present at first open:
  - (a) accept that it starts off-screen;
  - (b) skip the one-time anchor when a notice is present, so the status
    stays in view;
  - (c) show the candidate cue once at first positioning.

  No recommendation is final until device testing. (b) is the only one that
  adds no component.
- **N-7:** Home per-standings-table failures. Keep them unpresented
  (recommended: the stale aggregate and the module messages already cover
  the user-relevant fact), or include them in the outcome notice.

**Before any visual refinement:** decide N-1, N-2 and N-6. Then render the
combinations from existing fixtures in an isolated experiment (failure +
partial details, failure + stale Calendar Stage 1 at 320 @200%). Android and
TalkBack validation stays required (XS-02, XS-16).

## 9. Owner decisions recorded (Step 49D.1, 2026-11-11)

| Decision | Outcome |
|---|---|
| **N-1** | **Approved.** Failure, stale and incomplete stay independently representable. Order when separate notices are needed: failure → stale → incomplete; at most one of each; a failure never conceals an incomplete profile. Results finality stays in classification indicators. No domain or synchronization change |
| **N-2** | **Combined notice for visual testing.** When failure and stale data concern the **same content**: EN "Couldn't refresh — this data may be out of date." / ES "No se pudo actualizar — estos datos pueden estar desactualizados." Copy candidates, not ARB changes. Conditions stay separate internally; an incomplete profile keeps its own notice; unrelated failures and unrelated stale conditions are never combined |
| **N-3** | **Approved.** Home keeps module-specific unavailable information in the module |
| **N-4** | **Approved functional direction** (transitions below) |
| **N-5** | **Candidate only:** a transient notification for the outcome of a user-initiated refresh while the corresponding notice is off-screen. No general automatic snackbar |
| **N-6** | **Do not silently hide** a notice present at first open; keep the next-race positioning; compare small non-persistent cues (experiment) |
| **N-7** | **Not addressed** in Step 49D.1. The recommendation (keep per-table Home failures unpresented) stands provisionally; owner to confirm |

**"Same content" (N-2) per screen**
- **Calendar:** one resource (`calendar:<season>`), so failure + stale combine.
- **Driver, Team, Circuit Detail:** the detail resource; failure + stale
  combine; the partial notice stays separate (N-1).
- **Grand Prix (remote builds):** the top notice states the event's failure
  but its staleness can come from the event **or** the results. Combine only
  when the event itself is stale. Event failure + results-only staleness are
  unrelated: two notices (`refreshFailedNotice`, then `offlineStaleNotice`).
  The results section keeps its own failure (M4 unchanged).
- **Home:** the failure is the Home resource's; staleness is an aggregate
  across modules ("Some information may be outdated"), so they are not the
  same content. Two notices (`homeUpdateFailed`, then
  `homeSomeInformationOutdated`), unless the owner prefers otherwise.

**Retry transitions (N-4; documentation only)**

| From | Event | To (notices) | Announcement |
|---|---|---|---|
| failed (± stale, ± partial) | retry starts | Same notices; progress shown in the existing caption ("…" / "Refreshing…"); details show no progress, as today | None (labels unchanged) |
| failed, retry running | success | Failure removed; stale removed if the new data is fresh; partial removed only if the detail materialized | One change in the notice region (removal; TalkBack behaviour unverified) |
| failed, retry running | failure again | Unchanged | None, unless N-5's user-initiated cue applies while the notice is off-screen |
| failed, retry running | 404 (details) | Failure removed; partial ("detail unavailable") shown | One change |
| stale only | retry starts | Unchanged | None |
| stale only | failure | Combined notice (same content) | One change |

Today the failure is nulled while `refreshing` (§1); N-4 replaces that with
"keep until the outcome". Each derivation in §1 changes accordingly; the
controllers' outcomes and the coordinator are unchanged.

## 10. Experiment results (Step 49D.1)

Details in `cross-screen-refinement/notice-coexistence/REPORT.md`; evidence in
`validation-20261111-214632-experiment/` (Chrome emulation only; no TalkBack).

- **Combined vs stacked (Calendar):** the combined notice is 44–59% of the
  stacked height (320 @200%: EN 135 vs 309px, ES 211 vs 422px) and repeats
  nothing. Stacked leaves no race visible at the top at 320 @200%.
- **Details:** failure and partial now coexist in N-1 order. The combined
  notice saves only 34px at 320 @200% against three stacked notices (short
  detail strings). Failure + stale + partial is not reachable today and was
  rendered as a layout test only.
- **Calendar first open:** the preferred cue is a bottom toast with short
  text. At 320 @200% it is 60px (EN) / 98px (ES); it never moves the list,
  never fully conceals a row or a focused row, and does not repeat on
  rotation. **In landscape 693×320 @200% no tested cue is acceptable**: the
  127px band leaves the toast covering the next race's name while shown.
  Long strings (full notice, both-facts cue) are unsuitable for a cue.
- **Retry (N-4):** the failure notice stays unchanged during a simulated
  retry; a user-initiated failure re-shows the cue once (N-5).

## 11. Owner visual review (Step 49D.2, 2026-11-11)

The owner reviewed the seven Step 49D.1 screenshots.

| Item | Outcome |
|---|---|
| Failure + stale for the same content as one notice | **Provisionally visually approved.** N-2 stays provisionally approved pending final wording (second candidate compared in Step 49D.2) |
| Independent incomplete-profile notice on details | **Provisionally visually approved** |
| Existing Primer V2 notice layout | **Kept** (provisionally visually approved) |
| Calendar first-open bottom toast at 200% text | **Not approved.** It also covers meaningful race-card content in portrait, even though no row is fully hidden. Not to be implemented |
| Any overlay toast in 693×320 landscape | **Not approved** |
| N-5 (user-initiated refresh outcome cue) | **Open** |
| N-6 (first-open visibility) | **Open**; non-overlay alternatives compared in Step 49D.2 |
| N-7 | **Approved with conditions:** Home shows no global notice for every standings-table refresh failure, but individual modules must not misleadingly imply freshness |

No accessibility item is closed (XS-02, XS-16 and the TalkBack checks stand).

**Step 49D.2 comparison** (`cross-screen-refinement/notice-coexistence/REPORT.md`,
Step 49D.2 section):
- **Copy:** candidate B (EN "Couldn't refresh. Saved data may be out of
  date." / ES "No se pudo actualizar. Los datos guardados pueden estar
  desactualizados.") measures exactly like candidate A (EN 3 lines, ES 5
  lines at 320 @200%) and keeps the saved-data meaning. **Recommended.**
- **Calendar first open:** option A (notice first: skip the one-time anchor
  only when a notice exists at that moment) is the least harmful: full notice
  visible, no overlay, no duplicate, no scroll jump. Cost: the next race is
  one scroll away. Option B (inline line before the next race) is
  **rejected**: it reads as a statement about that race, the stale line is
  156px at 320 @200%, it duplicates the notice and it is sighted-only.
- **Still open:** N-2 wording approval, N-5, N-6; no accessibility item is
  closed.

## 12. Final decisions and findings (Step 49D.3, 2026-11-11)

### 12.1 Final statuses

| Decision | Status | Content |
|---|---|---|
| N-1 | **Approved** (semantic policy) | Failure, stale and incomplete independently representable; order failure → stale → incomplete; one of each; a failure never conceals an incomplete profile; finality stays in classification indicators |
| N-2 | **Approved wording** for future implementation (no ARB yet) | EN "Couldn't refresh. Saved data may be out of date." / ES "No se pudo actualizar. Los datos guardados pueden estar desactualizados." for failure + stale of the same content |
| N-3 | **Approved** | Home keeps module-specific unavailable information in the module |
| N-4 | **Approved direction** (not implemented) | Failure notice kept during a retry until the outcome is known (transitions §9) |
| N-5 | **Rejected** | First-open toast and every tested overlay. Feedback after a user-initiated refresh stays an unresolved Flutter/device requirement, not an approved snackbar |
| N-6 | **Provisionally preferred, conditional; not production-ready** | Open with the existing notice visible when a relevant failure or stale notice exists at the first positioning; otherwise jump to the next race; a later notice never moves the scroll |
| N-7 | **Approved with conditions** | No global Home notice per standings-table failure; no module may misleadingly imply freshness |

### 12.2 Findings preserved

- **Same height:** the approved wording measured exactly like the previous
  candidate. At 320×693 @200% that is EN 135px in 3 lines and ES 211px in 5
  lines; at 693×320 @200%, EN 1 line and ES 2 lines. It keeps the saved-data
  meaning.
- **Overlays rejected:** a bottom toast covers meaningful race-card content in
  portrait at 200%. In 693×320 @200% the list band is 127px, so any overlay
  covers 47–77% of it and hides the next race's name. Full-text and
  both-facts cues are as tall as the notice. A top-edge cue covers the next
  race in a full season.
- **Inline duplication rejected:** a status line directly above the next race
  reads as a statement about that race. When stale it is 156px at 320
  @200%, it repeats the notice, and it is either sighted-only or a duplicate
  announcement.
- **Option A scrolling distance:**
  - 1,116–1,265px to the next race at 320 @200%, and 655–693px at 693×320
    @200%, with only four rounds;
  - a complete season (about 24 rounds, with the next race possibly far down
    the list) could require far more;
  - Tab reaches the next race in 6 stops in the fixture, more in a full
    season.
- **Fixture limitation:** the prototype holds rounds 20–23 only. No race was
  invented (XS-13), so the full-season distance was not measured.
- **Unresolved full-season navigation:** check the real distance in Flutter;
  if unreasonable, investigate a direct navigation affordance during Flutter
  planning (not designed now).
- **Manual-refresh feedback:** the outcome of a user-initiated refresh while
  its notice is off-screen needs a Flutter/device decision. No snackbar
  design is approved.
- **Android:** system insets (status and gesture bars, landscape) and system
  font scaling. All heights here are Chrome emulation.
- **TalkBack:**
  - one announcement per notice change;
  - an off-screen notice stays silent;
  - the combined notice is read as two sentences;
  - details are read in failure → incomplete order;
  - no re-announcement when a retry keeps the failure notice;
  - the accessibility timeout ("Time to take action") for any transient
    feedback.
- **Flutter scroll anchoring:** Flutter has none, so a caption or notice
  height change above the viewport moves the rows. Chrome's anchoring hid
  this in the experiment (scrollY +48px during the simulated retry).
- **Retry state:** the failure is nulled while refreshing in every
  derivation today (§1). N-4 changes that.
- **Chrome artifact:** Tab onto the sticky header's buttons scrolled the page
  (289px portrait). Check that Flutter's app bar does not.

### 12.3 Tracking

These decisions clarify acceptance criteria in existing backlog items; none
is closed and none is duplicated:
- **XS-02:** TalkBack notice checks.
- **XS-16:** Android insets and font scaling for notices.
- **XS-19:** Calendar first positioning (N-6), full-season distance and
  manual-refresh feedback.
- **XS-22:** stacked notices show two identical icons.

The evidence-retention rules are in `design-exploration/.gitignore`.
