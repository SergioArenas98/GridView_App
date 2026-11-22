# Step 49 closing review: localization, accessibility and decision consistency (Step 49F)

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a step of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](README.md#validation-output).

**Status: closed, 2026-11-12.** Step 49 formally closed with conditions
(Step 50A, §12); owner review recorded in Step 49F.1 (§11).
- O-1 is provisionally approved (DD L1, XS-30); O-2 is approved; O-3 is
  confirmed (V1 stays open).
- The four documentation gaps in §5 are corrected.
- The Spanish caption was measured (§11.2).
- §1–§10 are the Step 49F record. Where Step 49F.1 changes them, a pointer to
  §11 marks it.
- No Flutter file, test, ARB resource, contract, domain model, prototype,
  pilot, shared CSS/JS or `.gitignore` was changed.
- `DESIGN-DECISIONS.md` and `DESIGN-BACKLOG.md` stay authoritative.

**Scope.** Steps 49A to 49E:
- `STATUS-SEMANTICS-AUDIT.md` (49A; decisions D1–D4, V1–V3, L1);
- `STATUS-ABSENCE-DECISIONS.md` (49B; HM-01, CR-04);
- `STATUS-RANKING-DECISIONS.md` (49C; RK-1 to RK-5);
- `STATUS-NOTICE-DECISIONS.md` (49D; N-1 to N-7);
- `STATUS-VISUAL-DECISIONS.md` (49E; VS-1 to VS-7).

Calendar Stage 1 (CT-03) is covered where the notice policy depends on it.
Those documents are not repeated here; sections are cited.

**Sources read at `e3e9f88`** (`lib/`, `test/` and `services/` unchanged
since then):
- `lib/l10n/app_en.arb`, `app_es.arb` (359 keys each);
- `core/widgets/gv_states.dart` (`GvOfflineNotice`),
  `core/widgets/gv_status_chip.dart`;
- `features/shared/presentation/domain_status.dart`,
  `widgets/entity_detail_scaffold.dart`,
  `application/entity_detail_state.dart`;
- `features/standings/presentation/standings_row_view.dart`,
  `standings_screen.dart`;
- `features/calendar/presentation/calendar_screen.dart`,
  `widgets/calendar_event_card.dart`, `widgets/calendar_scroll_anchor.dart`;
- `features/home/presentation/home_screen.dart`;
- `services/edge-api/src/providers/jolpica/standings-normalizer.ts`,
  `results-normalizer.ts`;
- `test/l10n/freshness_label_wording_test.dart`,
  `test/design_system/state_semantics_test.dart`, plus a string search of
  `test/`;
- `docs/technical/GridView_Synchronization.md`.

**Evidence scope.** Every visual and semantic measurement in Steps 49B–49E
is Chrome emulation (software raster, DPR 2). **Nothing here claims TalkBack
behaviour, WCAG conformance or production readiness.**

---

## 1. Executive summary

- **No contradiction between approved decisions.** The 19 accepted
  decisions (HM-01, CR-04, RK-1–RK-5, N-1–N-7 and VS-1–VS-7, minus the
  rejected N-5 and VS-2) are compatible with each other and with the domain
  axes in audit §1. No design choice depends on a state the model cannot
  represent.
- **Four documentation inconsistencies** (§5). None changes an approved
  design:
  1. the help-icon evidence shows an unreachable notice combination without
     saying so;
  2. VS-6 cites audit V1 as a decision, but V1 was never decided;
  3. some solid-outline contrast wording reads as resolved, contrary to the
     owner's position;
  4. CT-03 still describes a "conditional snackbar candidate" that N-5 has
     since narrowed.
- **One Spanish wording error confirmed.** `homeUpdated` / `lastUpdatedLabel`
  "Comprobado: {time}" drops "successful" and "last" (§2.1). It had **no
  backlog item** (now XS-30, §11).
- **One new ARB key is unavoidable:** the approved N-2 combined
  failure + stale notice (§6). Every other decision uses existing strings.
- **Model-supported states the current provider never produces.** The
  Jolpica importer always sends `provisional: false` (standings), `final`
  (results), and no ties or unranked rows (49C importer note). VS-3,
  "Provisional", RK-1 and RK-4 are therefore testable only with fixtures
  today. This is not a contradiction, but it decides how they are tested
  (§7).
- **Recommendation:** close the Step 49 design review **with conditions**
  (§10). The conditions are three small owner confirmations (§9) and
  documentation follow-ups. Every implementation and device item stays open.

---

## 2. EN/ES consistency findings

### 2.1 "Last successful check" vs "Comprobado"

| | |
|---|---|
| Keys | `homeUpdated` (Home), `lastUpdatedLabel` (Calendar, Standings) |
| EN | "Last successful check: {time}" |
| ES | "Comprobado: {time}" |
| ARB description (both) | "when this device last checked … with the server successfully (a 200 or a 304)" |

**Finding: the Spanish does not preserve the meaning.** "Comprobado"
("checked") says nothing about success. After a failed check it still reads
as a check at that time.
- **Refreshing state.** Calendar renders this caption with "…" in place of
  the time while refreshing (`calendar_screen.dart` line 135). Any Spanish
  wording built on a past participle of success ("Comprobado
  correctamente: …") would claim a success that has not happened yet.
  A noun phrase ("the last successful check") avoids that.
- **The test pins the wrong copy.** `freshness_label_wording_test.dart` is
  titled `says "last successful check"` but approves `'Comprobado: 12:00'`
  for `es`.

**Recommendation (smallest faithful correction):** ES **"Última comprobación
correcta: {time}"**.
- Same keys, same `{time}` placeholder (String, already locale-formatted).
- No new key. The test's "never 'Actualizado'" guard still passes.
- **Length:** +18 characters. Measure Home's caption and Calendar Stage 1's
  caption at 320×693 @200% before approval; the caption already wraps.
  Fallback only if the measurement fails: "Comprobación correcta: {time}"
  (+11).
- Details in §6, P1.

### 2.2 Strings audited (no change needed unless stated)

| Condition | Key(s) | EN | ES | Finding |
|---|---|---|---|---|
| Unknown event / session status | `eventStateUnknown`, `sessionStateUnknown` | Status unknown | Estado desconocido | Consistent. "Estado" is masculine, so XS-20's session-gender issue does not apply here |
| Unknown weekend format | `weekendFormatUnknown` | Format unknown | Formato desconocido | Consistent. Two lines at 320 @200% approved (VS-5). Calendar and Home show a format chip only for Sprint, so this string appears only on the GP hero and Circuit |
| Unknown result / finish | `resultStatusUnknown`, `finishStatusUnknown` | Status unknown | Estado desconocido | Consistent |
| Final / Provisional | `resultStatusFinal`, `resultStatusProvisional`, `standingsProvisionalBadge`, `standingsProvisionalNotice` | Final; Provisional; "These standings are provisional and may still change." | Definitivo; Provisional; "Esta clasificación es provisional y todavía puede cambiar." | Consistent. "Definitivo" is the right non-calque for "Final" |
| Unranked (spoken) | `standingsUnrankedSemantics` (used today) / `positionUnranked` (RK-1) | Position unavailable / Unranked | Posición no disponible / Sin clasificar | Both locales mis-state unranked as unavailable today (RK-1). Fix by key selection, no copy change. `standingsUnrankedSemantics` then becomes unused (§6, P4) |
| Unranked (visible) | `standingsUnrankedPosition` | — | — | Language-neutral; spoken text carries the meaning |
| Missing statistic | `standingsValueUnavailable` | Not available | No disponible | **Unused in `lib/`.** Flutter omits unsupplied statistics (audit D2), so this is consistent; a clean-up candidate only |
| Competitor name missing | `standingsNameUnavailable`, `driverNameUnavailable`, `constructorNameUnavailable` | Name unavailable / Driver name unavailable / Team name unavailable | Nombre no disponible / Nombre del piloto … / Nombre del equipo … | Consistent; never an identifier |
| Missing leader | `homeLeaderUnavailable`, `homeNoLeaderYet`, `homeTiedLeaders` | Leader unavailable; No leader yet; Tied leaders | Líder no disponible; Aún no hay líder; Líderes empatados | Copy correct. `homeLeaderUnavailable`'s **description** is too narrow for RK-3 ("no materialized local representation" only) (§6, P3) |
| Confirmed absence vs unknown association | `circuitNoRelatedGrandPrix` | No Grand Prix this season | Sin Gran Premio esta temporada | Correct for confirmed absence (CR-04 state B). The unknown association has **no string by decision** (CD-1: the block is omitted). Season-relative wording on historical seasons stays CIR-04 in both locales |
| Home upcoming empty | `homeNoUpcomingEvents` | No upcoming events | No hay próximos eventos | Unchanged by HM-01 (the section is omitted in the contradictory state) |
| Refresh failure | `refreshFailedNotice`; `detailUpdateFailed`, `homeUpdateFailed`, `exploreUpdateFailed` | "Couldn't refresh — showing saved data."; "Update failed" | "No se pudo actualizar — mostrando datos guardados."; "No se pudo actualizar" | Consistent per locale. Two existing wording families (long on Calendar, GP and Standings; short on details, Home and Explore) are pre-existing and not in scope |
| Stale cached data | `offlineStaleNotice`, `detailCachedNotice`, `homeSomeInformationOutdated` | "This data may be out of date — showing the last saved version."; "Details may be outdated"; "Some information may be outdated" | "Estos datos pueden estar desactualizados — mostrando la última versión guardada."; "Los detalles pueden estar desactualizados"; "Parte de la información puede estar desactualizada" | Consistent |
| Incomplete profile | `detailPartialNotice`; Home `homeSomeInformationUnavailable` | "Some profile information is unavailable"; "Some information is unavailable" | "Parte de la información del perfil no está disponible"; "Parte de la información no está disponible" | Consistent |
| Combined failure + stale (N-2) | **none** | "Couldn't refresh. Saved data may be out of date." | "No se pudo actualizar. Los datos guardados pueden estar desactualizados." | Approved wording; **needs a new key** (§6, P2). The two sentences match the existing failure and stale meanings in both locales |

**Not affected by the review:** "Status unknown" in Calendar row names is
repeated on every row (audit V1, §5.2). The words are identical in both
locales.

---

## 3. Accessibility semantics findings

**Classes:**
- **A:** demonstrable today, in current Flutter code or the HTML experiments;
- **B:** needs a Flutter implementation;
- **C:** can only be validated on Android with TalkBack or real system font
  scaling.

| Topic | Intended semantics | Flutter today | Class |
|---|---|---|---|
| Ranked competitor | "Position {n}" then name, points, leader/tied, provisional (`StandingsFormatter`) | As intended | A |
| Unranked competitor | Visible "—"; spoken "Unranked" / "Sin clasificar", once, where the position would be read; never "unavailable" (RK-1) | Spoken "Position unavailable" (`standings_row_view.dart` line 79) | B (one-line change, test update); TalkBack C |
| Known zero points | "0" shown, "0 points" spoken; never omitted | As intended (tests listed in 49C §7) | A |
| Missing numerical value | No standing: datum or section omitted, no claim. Points absent on result rows: omitted, never 0. Unsupplied statistic: omitted | As intended. `standingsValueUnavailable` is unused, so nothing says "Not available" for a statistic | A |
| Tied leaders | Standings: "Tied for the championship lead" on every tied row. Home: plural title "Tied leaders" in the module label; one visible name never reads as the sole leader (RK-4) | As intended. Real data cannot produce ties today (importer) | A (fixtures); C (TalkBack) |
| Missing leader name | "Leader unavailable" for an unnamed position 1; "No leader yet" only without a confirmed position 1 (RK-3) | "No leader yet" for both (HOME-09) | B |
| Unknown race / session / event status, unknown format | The word is always printed and spoken ("Status unknown", "Format unknown"). The dashed outline is visual only and adds no semantics (VS-1) | Words present; neutral-tone chip with a decorative dot inside `ExcludeSemantics` | A (words); B (dashed); C (TalkBack) |
| Provisional | The word "Provisional" is in the row or chip name. No dagger in Flutter (VS-2, VS-3); the prototypes' dagger is `aria-hidden` and superseded | As intended; Flutter has no dagger. **VS-3 needs no Flutter removal**, only that the dagger is not ported from the prototypes | A |
| Decorative status icons | Notice icons silent; the text alone identifies the notice (VS-4) | `GvOfflineNotice` wraps the whole row in `ExcludeSemantics` under a labelled live region, so the icon is already silent; the icon is cloud-off for every cause | A (silence); B (icon per cause) |
| Incomplete-profile notice | Always shown when the profile is partial, even with a failure, after it (N-1) | **Hidden by a failure** (`entity_detail_scaffold.dart` `_notices`, `if / else if`) | B |
| Multiple independent notices | One live region per notice; order failure → stale → incomplete; at most one per dimension (N-1, N-3) | One notice slot per scope | B; whether two same-frame live regions give one or two announcements is C |
| Combined failure + stale | One notice, one live region, read as two sentences (N-2) | Failure only (stale fact dropped) | B; C (reading) |
| Calendar initial positioning | Current Flutter: fixed header, so the notice is always visible; one-time anchor (`CalendarScrollAnchor`). With Stage 1 only: notice-first when a notice exists at first positioning (N-6, provisional) | Fixed header | A (today); B (N-6, only if Stage 1 is implemented); full-season distance E/C |
| Off-screen notices | A notice beyond the cache extent has no semantics node and stays silent; no automatic cue (N-5) | Same on GP, details and Home today | B (Stage 1 extends it to Calendar); C |
| Retry | The failure notice persists during a retry; an unchanged repeated failure is not re-announced (N-4) | `refreshError` is nulled while refreshing in all five derivations, so each retry churns up to three live-region changes | B; C |
| Large-text wrapping | Status words and notices wrap, never truncate; the Spanish format chip may take two lines (VS-5) | Notice text wraps (`Expanded` `Text`); chips not measured in Flutter | A (HTML); C (system font scaling) |
| Focus visibility | A focused row is never hidden by a pinned element (CT-02, CT-03); Tab onto pinned buttons must not scroll the page (49D.3 Chrome artifact) | Fixed header today | B; C |

**Not covered by an acceptance criterion so far:**
- **Icon for Home's aggregate "Some information is unavailable."** VS-4 names
  the help icon for an *incomplete profile*. Home's aggregate notice is the
  same cause (completeness), so help is the consistent choice, but nothing
  states it (§9, O-2).
- **The caption during refresh.** "Last successful check: …" with an
  ellipsis is read literally by TalkBack. This is pre-existing; check it
  under XS-02.

---

## 4. Cross-document decision matrix

**Key:**
- Flutter "today" = `e3e9f88`.
- "Exp." = the experiment under `cross-screen-refinement/`.
- Validation tags: **T** = widget or unit test, **TB** = TalkBack,
  **D** = device.

| ID | Approved behaviour | Flutter today | Prototype / experiment | Future change | Validation | Blocker |
|---|---|---|---|---|---|---|
| HM-01 / HOME-08 | Omit "Upcoming events" when the hero is "Next Grand Prix" and the list is available but empty | Section shown with "No upcoming events" | Exp. `home-upcoming-omit/` | One condition in `home_screen.dart` | T (49B §2.7) | None |
| CR-04 / CIR-02 | "No Grand Prix this season" only when that season's calendar is materialized; otherwise omit the block | Absence claimed from missing rows | Exp. `circuit-absence/` | Association provider (linked / none / unknown / resolving) | T (49B §1.8) | CD-2 (stale calendar), CD-3 (persist the association) open |
| RK-1 / XS-11 | Unranked spoken "Unranked" / "Sin clasificar" | "Position unavailable" | Standings pilot frame 1 (old label, superseded) | `positionSemantics(null)` → `positionUnranked` | T (EN, ES, no "unavailable", constructors row); TB | None (fixture-only state) |
| RK-2 / EXP-01 | Labelled Position / Points; unranked position omitted | Bare numbers | Explore Alternative B | Labelled data line (EX-01 difference 1) | T (49C §9); TB | EXP-01 implementation |
| RK-3 / HOME-09 | "Leader unavailable" for an unnamed position 1 | "No leader yet" | — | Read-model reason | T | ARB description (§6, P3) |
| RK-4 | Tie stated; no invented name | Meets the conditions | Standings frame 2 | None | TB | Importer refuses ties (fixtures only) |
| RK-5 | Tracking in XS-11, EXP-01, HOME-09, TEAM-06 | — | — | — | Tests must pass to close | — |
| N-1 | Failure, stale and incomplete independent; order failure → stale → incomplete | `if / else if` slots | Exp. `notice-coexistence/` | Notice list (F1) on details, Calendar, GP, Home | T; TB | None |
| N-2 | Combined notice for failure + stale of the same content | Failure only | Same exp. | New key; "same content" per screen (49D §9) | T; TB (two sentences) | **New ARB key** (§6, P2) |
| N-3 | Home completeness stays in its modules | As intended | — | None | T | — |
| N-4 | Failure persists during a retry | Nulled while refreshing | Same exp. (simulated) | Five state derivations (F2) | T (unchanged label, no new live-region event); TB | Scroll anchoring (Stage 1 only) |
| N-5 | Toast and overlays rejected; manual-refresh feedback unresolved | No cue | Same exp. (rejected variants) | Nothing approved | D, TB | **Unresolved by design** (XS-19) |
| N-6 / XS-19 | Notice-first first open (Stage 1 only), provisional | Fixed header | Exp. `notice-coexistence/` option A | `CalendarScrollAnchor` + Stage 1 sliver | T; D (full season) | Stage 1 not authorised for Flutter; full-season distance |
| N-7 | No per-table Home failure notice; no module implies freshness | Per-table failures computed, not shown | — | Check the leader modules' freshness wording | T | — |
| VS-1 / XS-11, XS-28 | Dashed outline for unknown event, format, session, finish | Neutral tone chip with dot | Exp. `status-visual-consistency/` | Dashed chip variant | T (labels); D (rendering, scaling) | **XS-28** token decision; no built-in dashed border |
| VS-3 / STD-04 | Standings marker without the dagger; caption kept | No dagger (badge label "Provisional") | Same exp. (`st-states`) | None in Flutter; do not port the dagger | T (label) | Real data never provisional (S-8) |
| VS-4 / XS-22 | Alert, clock, help icons; decorative | Cloud-off for all | Same exp. | Icon per cause in the notice component | T (icon excluded from semantics); D (20px legibility) | O-2 (Home aggregate icon) |
| VS-5 | Two-line ES format chip | — | Same exp. | Chip wraps | D (system font scaling) | — |
| VS-6 | Calendar repetition unchanged | Chip on every row | Calendar Stage 1 | None | TB (verbosity, XS-13) | Audit V1 never decided (§5.2) |
| VS-7 | 15 screenshots Git-visible | — | — | — | — | — |

**Audit (49A) decisions and where they ended**

| Audit | Resolved by | Status |
|---|---|---|
| D1 Circuit absence | CR-04 (CD-1) | Decided |
| D2 Home upcoming | HM-01 | Decided |
| D3 Notice precedence | N-1 | Decided |
| D4 Unranked | RK-1, RK-2 | Decided |
| V1 Calendar repeated unknown | — | **Open**; VS-6 keeps today's behaviour |
| V2 One provisional look | VS-2 rejected, VS-3 approved | Decided (word-led outline everywhere) |
| V3 Dashed = unknown | VS-1 (widened to every unknown value) | Decided |
| L1 Spanish caption | — | **Open, untracked** (§2.1) |

**Intentionally superseded historical conventions** (kept unchanged on
purpose):
- **Dagger + word:** `shared/components/chip.css`, `README.md` (Home status
  vocabulary), `standings/README.md` ST15 and the component table, the
  `standings/` prototype and its pilot. Superseded by VS-2 and VS-3.
- **Audit "Provisional always with its dagger":** `STATUS-SEMANTICS-AUDIT.md`
  §5 principle 1 and §8 step 2.
- **Cloud-off on every notice:** `STATUS-NOTICE-DECISIONS.md` §4 rule 8
  ("No new … icons"). Superseded by VS-4.
- **Unranked label:** "Position unavailable" in Standings pilot frame 1.
  Superseded by RK-1.
- **Grand Prix frame 5** ("failure wording wins"). Superseded by N-1 and N-2.
- **"Comprobado" in prototype copy:** `calendar/README.md` C14 and
  `refinement-01/README.md`. Would be superseded if P1 is approved.

---

## 5. Remaining contradictions and inconsistencies

None of these contradicts another approved decision; each is a documentation
or specification gap. **Items 1–4 were corrected in Step 49F.1 (§11.4).**

1. **Help-icon evidence shows an unreachable state.**
   - The retained VS-4 screenshots `C-combined-partial-{current,proposed}-es-320x693-200.png`
     show combined failure + stale **plus** partial.
   - On detail screens, partial means `materialized == false`, so
     `freshness` is `null` (`entity_detail_state.dart` line 162). A 404
     clears `refreshError` (line 165). Failure + stale + partial is
     therefore unreachable.
   - The 49D report calls it "hypothetical"; `STATUS-VISUAL-DECISIONS.md` §5,
     §8 and §15 do not.
   - The icon decision is unaffected: failure + partial, which is reachable,
     shows the same icons in `C-failed-partial-*`.
   - **Proposed:** annotate STATUS-VISUAL §8 and §15 "(hypothetical
     combination, unreachable today)". Not edited here.
2. **VS-6 cites "their existing separate decision (audit V1)".**
   - V1 was an open owner question, never decided.
   - The effect is unambiguous (today's behaviour stays), but the record
     implies a decision exists.
   - **Proposed:** reword the VS-6 entries as "unchanged; audit V1 remains
     open (XS-11, CAL-02, XS-13)" (§9, O-3).
3. **Solid-outline contrast reads as resolved in places.**
   - `STATUS-VISUAL-DECISIONS.md` §13 says "This is not a failure as long as
     the word identifies the state".
   - `DESIGN-DECISIONS.md` (Status visual section) and XS-11 say "acceptable
     only while the word identifies the state".
   - The owner's position (Step 49F) is that the 1.88:1 and 2.2:1 outlines
     stay an **open accessibility concern**, not resolved by the presence of
     text.
   - **Proposed:** reword those three places as "open: not resolved by the
     text label; review in XS-11". Not edited here.
4. **CT-03 still says "conditional snackbar is a candidate only."**
   - After N-5, no snackbar or toast is a candidate design. Manual-refresh
     feedback is an unresolved Flutter/device requirement (XS-19).
     `calendar-sticky-split/DECISIONS-48D.md` §6 has the same older wording.
   - **Proposed:** add "superseded by N-5" to the CT-03 entry.

**Minor documentation imprecision (no action needed):**
`STATUS-NOTICE-DECISIONS.md` §1 calls Home's caption "Updated {time}". The
key is `homeUpdated`; its text is "Last successful check: {time}".

**Checked and clean:**
- no approved decision has a contradictory status across the decision log,
  the backlog and the step documents;
- no item is wrongly marked closed;
- no duplicate backlog entry. XS-11, CAL-02 and XS-13 overlap on Calendar
  repetition but cover different facets (vocabulary, density, data);
- the RK-1 note on the unranked label sits in XS-11 deliberately (RK-5).

---

## 6. Required ARB proposals (not applied)

| # | Key | Current EN | Current ES | Recommended | Placeholders | New key? | Screens | Tests and docs |
|---|---|---|---|---|---|---|---|---|
| **P1** | `homeUpdated`, `lastUpdatedLabel` | Last successful check: {time} | Comprobado: {time} | ES **"Última comprobación correcta: {time}"**; EN unchanged | `{time}` String (already formatted; Calendar passes "…" while refreshing) | No | Home, Calendar, Standings | `test/l10n/freshness_label_wording_test.dart` (`approved['es']`); no other test asserts the ES caption. Docs: `docs/technical/GridView_Synchronization.md` line 192. Prototype READMEs stay historical. Tracked in XS-30; provisionally approved as DD L1 (§11) |
| **P2** | new, e.g. `refreshFailedStaleNotice` | — | — | EN "Couldn't refresh. Saved data may be out of date." / ES "No se pudo actualizar. Los datos guardados pueden estar desactualizados." (N-2, approved) | None | **Yes**, unavoidable: changing `refreshFailedNotice` would wrongly claim staleness after a failure over fresh data | Calendar; Grand Prix (only when the event itself is stale); Driver, Team, Circuit detail (failure + stale of the detail resource) | `calendar_widget_test.dart`, `grand_prix_widget_test.dart`, `expired_freshness_notice_test.dart`, `entity_detail_widget_test.dart` (new cases, §7). Single-condition tests stay |
| **P3** | `homeLeaderUnavailable` | Leader unavailable | Líder no disponible | Text unchanged. **Description only:** "…not materialized, or the confirmed leader's identity is not stored" (RK-3) | None | No | Home | `home_widget_test.dart` (new HOME-09 case) |
| **P4** | `standingsUnrankedSemantics`, `standingsValueUnavailable` | Position unavailable; Not available | Posición no disponible; No disponible | No value change. After RK-1 the first is unused; the second is unused today. Remove at a later ARB clean-up; **never repurpose** "Position unavailable" for unranked | — | No | — | — |

**Not proposed:**
- C-R2 / H-R2 copy (not adopted);
- CIR-04 historical-season wording (open, would need new copy);
- an RK-4 tie count (not requested);
- XS-20 session gender (P3, existing item).

---

## 7. Flutter acceptance criteria and required tests

The tests already listed per item in 49B §1.8 and §2.7, 49C §7 and §9, and
49D §6 stand; they are not repeated here. Below are the criteria that were
missing or scattered.

**Notices (N-1, N-2, N-4, VS-4)**
1. **Details:**
   - failure + partial renders two notices, "Update failed" first, then
     "Some profile information is unavailable";
   - two live regions;
   - each icon excluded from semantics.
2. **Details:** failure + stale renders the P2 combined notice, one live
   region. Partial + stale is not constructed (unreachable).
3. **Calendar:** failure + stale renders the combined notice; failure alone
   `refreshFailedNotice`; stale alone `offlineStaleNotice`.
4. **Grand Prix:** an event failure over **results-only** staleness renders
   two notices (`refreshFailedNotice`, then `offlineStaleNotice`), never the
   combined one.
5. **Home:** failure + stale renders two notices (`homeUpdateFailed`, then
   `homeSomeInformationOutdated`). Unavailable modules keep their own
   messages, and the aggregate unavailable notice shows only when no other
   notice does.
6. **Retry (N-4):**
   - while refreshing after a failure, the failure notice's semantics label
     is unchanged, and no live region is added or removed;
   - a repeated failure leaves the tree identical;
   - success removes only the facts it resolves; a 404 shows the partial
     notice.
7. **Success never implies completeness:** after a successful refresh of a
   partial profile, the partial notice stays until the detail materializes.
8. **Icon map:** alert (failure, combined), clock (stale), help (partial; and
   Home's aggregate unavailable if O-2 is confirmed). Cloud-off appears on no
   notice.

**Status vocabulary (VS-1, VS-3, RK-1, RK-3)**
9. **Unknown values:**
   - every unknown event, session, format, result and finish renders its
     word in EN and ES;
   - the chip's semantics label equals the word, with no extra "dashed" or
     "unknown style" text.
10. **No dagger:** no Flutter widget renders "†" or a dagger glyph.
    Standings provisional rows keep "…, Provisional" in their label.
11. **Unranked:** spoken "Unranked" / "Sin clasificar"; no "unavailable" /
    "no disponible" in an unranked row label.
12. **HOME-09:** an unnamed position 1 renders "Leader unavailable", never
    "No leader yet".

**Localization**
13. **P1:** `freshness_label_wording_test.dart` approves the new ES caption
    and keeps the "no 'Actualizado'" guard.
14. **P2:** both locales have the key; no placeholder.

**Data reachability (fixtures required)**
15. The provisional, unranked and tied states need fixtures: Jolpica sends
    `provisional: false` (standings-normalizer S-8), `final` results, and no
    ties or unranked rows. TEAM-06 already records the Team fixture gap.

**Large text and focus (Flutter test level)**
16. At `textScaler` 2.0 and a 320dp width, status chips and notices are not
    truncated (`TextOverflow` none, no `maxLines: 1` on status words).
    Measured heights are informative only; device checks in §8.

---

## 8. Device-only validation requirements

| Requirement | Item |
|---|---|
| One announcement per notice change; two notices in one frame announced as two (or confirm otherwise) | XS-02 |
| Combined notice read as two sentences; details read failure → incomplete | XS-02 |
| No re-announcement during an unchanged retry failure | XS-02 |
| An off-screen notice stays silent; manual-refresh feedback for a user-initiated refresh: needs a design decision after device evidence (no snackbar or toast approved) | XS-02, XS-19 |
| Accessibility timeout ("Time to take action") respected by any future transient feedback | XS-02 |
| Calendar Stage 1 first positioning with a full season; Flutter scroll anchoring when a notice or caption height changes above the viewport | XS-19, XS-13 |
| Android system bars and insets (portrait, gesture bar, landscape 693×320 @200%) | XS-16 |
| System font scaling: two-line Spanish format chip, notices, captions with P1's longer Spanish string | XS-16 |
| Dashed border rendering and legibility; 20px alert, clock and help icons on OLED | XS-16, XS-28 |
| Solid-outline contrast (1.88:1, 2.2:1) re-measured on the implemented tokens; owner decision on whether outlines need 3:1 | XS-11 |
| Calendar row verbosity with "Status unknown" on every row (audit V1) | XS-02, XS-13 |
| Tab or D-pad focus onto the pinned app bar does not scroll the list (Chrome artifact, 49D.3) | XS-16 |

---

## 9. Open owner decisions

**Resolved in Step 49F.1 (§11.1).** The list below is the Step 49F record.

- **O-1 (copy):**
  - approve P1, the Spanish caption "Última comprobación correcta: {time}",
    for a future ARB change, subject to the length measurement;
  - choose where to track it. No item exists: a new XS item, or a note on
    STD-01, which already concerns this caption.
- **O-2 (icon scope):** confirm that Home's aggregate "Some information is
  unavailable" uses the help icon, as an incompleteness notice under VS-4.
- **O-3 (record):** confirm that audit V1 (Calendar repetition) stays an
  open question rather than a made decision, and allow the VS-6 wording
  correction (§5.2).
- **Documentation corrections (no design change):** §5 items 1, 3 and 4,
  which touch STATUS-VISUAL §8, §13 and §15, the decision-log VS section,
  XS-11 and CT-03. They are listed for the owner because Step 49F forbids
  editing existing visual decisions.

**Still open and unchanged** (not decided by this review):
- **Circuit:** CD-2 (complete but stale calendar), CD-3 (persist the
  association), CIR-04 (historical season).
- **Calendar Stage 1:** full-season navigation, scroll anchoring, retry
  behaviour, manual-refresh feedback (XS-19, XS-06, XS-07).
- **Visual foundation:** dashed-outline rendering and tokens (XS-28),
  solid-outline contrast (XS-11).
- **Android and TalkBack:** XS-16, XS-02.
- **Domain and provider limits:** RK-4's importer note; S-8 provisional
  policy; GPD-02, GPD-03, HOME-02.

---

## 10. Recommended readiness status

**Recommendation: close the Step 49 design review with conditions.** The
semantic and visual policy is complete, internally consistent and traceable.
What remains is implementation, validation and three small owner
confirmations (O-1 to O-3). None of them reopens an approved design.

**Implementation-readiness checklist** (dependencies only; no full redesign
plan)

| Group | Ready now | Bundle together | Prerequisite | Deferred |
|---|---|---|---|---|
| **Localization and copy** | P2 (approved wording), P3 (description), RK-1 key selection | One ARB change set: P1 (after O-1), P2, P3, plus the freshness test update | O-1 for P1 | P4 clean-up; CIR-04 copy |
| **Shared visual components** | Notice icon per cause (VS-4): an icon parameter on `GvOfflineNotice` (consolidation: `GvNotice`) | **Notice component once:** icon per cause + notice list (N-1) + combined key (N-2). **Chip once:** dashed unknown variant (VS-1) + outline tokens + the contrast decision | XS-28 token decision before the chip; contrast decision with it | — |
| **Screen-specific presentation** | HM-01; RK-1; RK-3 (HOME-09); CR-04 (C-R1, no schema change) | Standings row semantics (RK-1) with any Standings badge work. VS-3 needs no Flutter change | CR-04: none for C-R1 | CD-3 persistence; RK-4 count; V1 |
| **State and scrolling** | N-4 failure persistence (five derivations), with N-1 since it touches the same notice inputs | N-1 + N-4 in one change per screen | — | N-6 (only with a Flutter Stage 1, not authorised); manual-refresh feedback (device) |
| **Accessibility and tests** | All T criteria in §7; fixtures for provisional, unranked and ties | Notice tests with the notice change; status tests with the chip change | — | TalkBack and device checks (§8) after implementation |

**Genuine prerequisites:** the XS-28 token decision (dashed chip, outline
tokens) before any status-chip work; O-1 before the Spanish caption. The
semantic corrections HM-01, CR-04, RK-1, RK-3, N-1, N-2 and N-4 do not
depend on the Primer V2 visuals and could land on today's components.

**Deferred without risk:** V1, CIR-04, CD-3, RK-4, P4, N-6 and the
manual-refresh feedback, until Stage 1 is authorised and device evidence
exists.

---

## 11. Owner review and closure (Step 49F.1, 2026-11-12)

### 11.1 Owner decisions recorded

| Decision | Outcome | Recorded in |
|---|---|---|
| **O-1** | **Provisionally approved:** ES "Última comprobación correcta: {time}" for `homeUpdated` and `lastUpdatedLabel`; `{time}` placeholder contract unchanged; no ARB change. Final wording after the measurement below. An unknown or unfinished check is never labelled successful | DD **L1**; backlog **XS-30** (new) |
| **O-2** | **Approved:** the existing help (?) icon also marks Home's "Some information is unavailable". Decorative and non-interactive; the visible and accessible text stays authoritative | DD VS-4 (row and section), STATUS-VISUAL §15, XS-22 |
| **O-3** | **Confirmed:** audit V1 (Calendar's repeated unknown-status labels) stays an **open design question**. Keeping today's presentation is not an approval | DD VS-6 (row and section), STATUS-VISUAL §15 |

**Backlog tracking for O-1.** STD-01 does not match: it asks whether
Standings shows the caption and how tall the pinned area is with it, not what
the Spanish says. The wording, plus Calendar's refreshing semantics, is
tracked in the new **XS-30** (P2, Accepted pending validation). STD-01 is
unchanged.

### 11.2 Spanish caption measurement (320×693, 200% text)

- **Script:** `cross-screen-refinement/caption-localization/checks.mjs`.
- **Output:** `validation-20261112-090530-caption/` (`results.json`,
  `summary.txt`, no screenshots, so no `.gitignore` change).
- **Method:** existing pages loaded read-only, with only the caption text
  swapped in the browser. The pages are the Home pilot, the Calendar pilot
  (pinned header, like today's Flutter) and Calendar Stage 1 (caption
  scrolls, CT-03).
- **Fonts:** caption 13px (26px at 200%), line height 37.7px; Archivo
  loaded.
- **The time "4:22"** is Home's existing fixture time. On Calendar it is a
  **layout probe only**, never a Calendar check time. "…" is Calendar's
  refreshing state today.

| Page | Text | Lines | Height | Adjacent content (ES proposed vs ES current) |
|---|---|---|---|---|
| Home | EN "Last successful check: 4:22" | 2 | 75.4px | — |
| Home | ES "Comprobado: 4:22" | 1 | 37.7px | — |
| Home | ES "Última comprobación correcta: 4:22" | 2 | 75.4px | Hero starts **+37.7px** lower |
| Calendar pilot (pinned) | EN with 4:22 / ES current / ES proposed | 2 / 1 / 2 | 75.4 / 37.7 / 75.4px | Pinned header **152.2 → 189.9px (22.0% → 27.4% of 693px)**; EN with a time is already 27.4% |
| Calendar pilot (pinned) | with "…": EN / ES current / ES proposed | 1 / 1 / 2 | 37.7 / 37.7 / 75.4px | Pinned header +37.7px (refreshing only) |
| Calendar Stage 1 (scrolls) | EN with 4:22 / ES current / ES proposed | 2 / 1 / 2 | 75.4 / 37.7 / 75.4px | Pinned area unchanged (112.5px, 16.2%); first round **+37.7px** lower |
| Calendar Stage 1 (scrolls) | with "…": EN / ES current / ES proposed | 1 / 1 / 2 | 37.7 / 37.7 / 75.4px | First round +37.7px lower |

**Result**
- The proposed Spanish caption adds exactly **one caption line (37.7px)**
  everywhere. It is **the same height as the English caption with a time**,
  which already wraps to two lines.
- No horizontal overflow and no clipping anywhere.
- **No significant new issue.** The wording is kept unchanged and not
  shortened.

**Two effects to weigh at owner finalization**
- **Calendar with today's pinned header:** the pinned area reaches 27.4% of
  the viewport, above the 25% header-budget heuristic (XS-06). English
  already does the same whenever a time is shown, so this is a header-budget
  question rather than a Spanish one. Stage 1 avoids it because the caption
  scrolls.
- **Stage 1:** the first round starts 37.7px lower, adding a little to the
  N-6 distance to the next race.

All values are Chrome emulation; real system font scaling stays a device
check (§8, XS-16).

### 11.3 Refresh-state semantics

**Actual Flutter behaviour (`e3e9f88`)**

| State | Home (`home_screen.dart`) | Standings (`standings_screen.dart`) | Calendar (`_CalendarHeader`) |
|---|---|---|---|
| Known successful check, idle | `homeUpdated(time)` | `lastUpdatedLabel(time)` | `lastUpdatedLabel(time)` |
| Refresh in progress | "Refreshing…" / "Actualizando…" (`standingsRefreshingLabel`) | Same | **`lastUpdatedLabel('…')`**: "Last successful check: …" / "Comprobado: …" |
| No known successful check, idle | No caption | No caption | No caption |
| No known successful check, refreshing | "Refreshing…" | "Refreshing…" | **"Last successful check: …"**, because the condition is `refreshing \|\| updated != null` |

**Finding.**
- Calendar labels an **unfinished** check with the "successful check" label.
  It does so even on a screen with **no known successful check**, and it
  hides the previous known time while refreshing.
- Home and Standings already keep the three states apart. The text "…" also
  gives TalkBack nothing meaningful to read ("ellipsis" or nothing;
  unverified).

**Future implementation requirement (XS-30).** Calendar follows the Home and
Standings pattern with existing keys:
- **known time, idle:** the caption with the time;
- **refresh in progress:** `standingsRefreshingLabel`, whose ARB
  description should be widened from Standings to every screen at the ARB
  change (Home already reuses it);
- **no known check:** no caption.

No string says "successful" without a known time.

**Calendar-specific acceptance criteria** (additions to §7; the 16 criteria
stay as written):
- refreshing with `lastSuccessAt == null` shows "Refreshing…" /
  "Actualizando…" and no "successful";
- refreshing with a known time shows "Refreshing…", not "…" under the
  caption label;
- idle with a known time shows the caption in both locales.

**Prototypes.** The "Comprobado: …" / "Last successful check: …"
refreshing state in `calendar/`, the Calendar pilot, Stage 1 and the other
Calendar experiments is historical and intentionally left unchanged.

### 11.4 Documentation corrections applied (smallest edits)

1. **Hypothetical evidence:** `C-combined-partial-*` is labelled
   hypothetical and unreachable on detail screens in STATUS-VISUAL §5, §8,
   §11, §14 and §15. `C-failed-partial-*` is named as the reachable pair.
2. **V1:** the VS-6 entries (DD row and section, STATUS-VISUAL §15) say V1
   remains an open design question.
3. **Contrast:** the "acceptable while the word identifies the state" and
   "not a failure as long as …" wording is replaced with "open accessibility
   concern, not resolved by the text label". Changed in STATUS-VISUAL §13
   and §15, the DD Status visual section and XS-11. The review stays open in
   XS-11.
4. **CT-03:** the DD row and the Calendar Stage 1 section now cite N-5 (the
   first-open toast and every tested Calendar overlay rejected). Manual-
   refresh feedback stays unresolved (XS-19).
   `calendar-sticky-split/DECISIONS-48D.md` is a historical experiment record
   and is unchanged; `STATUS-NOTICE-DECISIONS.md` already notes the
   supersession.

### 11.5 Final classification

**Approved semantic and visual design decisions** (prototype scope; not
implemented):
- HM-01, CR-04;
- RK-1, RK-2, RK-3, RK-5;
- N-1, N-2 (wording), N-3, N-4 (direction), N-7;
- VS-1, VS-3, VS-4 (with O-2), VS-5, VS-7.

**Rejected:** N-5, VS-2.

**Implementation-ready future changes** (no open design question):
- HM-01, CR-04 (C-R1);
- RK-1, RK-3 (with the ARB description, P3);
- N-1 + N-2 (new key, P2) + N-4;
- VS-4 icon per cause.

All of these land on today's components. VS-3 needs no Flutter change.

**Conditionally approved behaviour:**
- **L1:** the Spanish caption, provisional until owner finalization.
- **RK-4:** tied leaders, with conditions.
- **N-6:** notice-first opening; Stage 1 only; full-season distance.
- **CT-03:** Calendar Stage 1; prototype only.
- **N-7:** approved with conditions.

**Unresolved owner or design questions:**
- audit V1;
- CD-2, CD-3;
- CIR-04;
- manual-refresh feedback (XS-19);
- the solid-outline contrast decision (XS-11);
- the XS-28 token decision before VS-1 can be implemented.

**Android and TalkBack validation:** the 12 requirements in §8, unchanged,
plus TalkBack reading of the refreshing caption (XS-30, XS-02).

**Still open** until implementation and testing: XS-11, XS-22, XS-28,
XS-30, XS-02, XS-16, XS-19, HOME-08, HOME-09, CIR-02, EXP-01 and TEAM-06.
None is closed by this review.

### 11.6 Recommendation

**Step 49 can be formally closed with conditions.**
- The semantic and visual design review is complete and consistent.
- The documentation gaps are corrected.
- The one remaining localization question has been measured with no
  significant issue.

The conditions are all tracked:
- owner finalization of L1 (XS-30);
- the XS-28 token decision before status-chip work;
- the open questions in §11.5;
- the Android and TalkBack requirements.

No Flutter implementation or checkpoint is started by this closure.

## 12. Formal closure (Step 50A, 2026-11-12)

- **Step 49 is formally closed with conditions.** No approved decision is
  reopened.
- **L1 approved (final wording):** ES "Última comprobación correcta:
  {time}" for `homeUpdated` and `lastUpdatedLabel`, with the existing
  `{time}` placeholder. Not yet in the ARB files.
- **Future Calendar caption behaviour (XS-30):**
  - known last successful check: the caption with its time;
  - refresh in progress: `standingsRefreshingLabel`;
  - no known successful check: no caption;
  - a failed refresh: the previous successful time stays, and the failure
    notice states the failure. Today's Flutter already keeps `lastSuccessAt`
    after a failure.
- **XS-30 stays Open** until the Flutter implementation and its tests pass.
- **Conditions still open:**
  - Android insets and system font scaling (XS-16);
  - TalkBack (XS-02);
  - solid-outline contrast (XS-11);
  - dashed outline and tokens (XS-28);
  - notice icons (XS-22);
  - Calendar first positioning and manual-refresh feedback (XS-19);
  - audit V1, CD-2, CD-3, CIR-04.
