# Primer V2: design decisions log

Owner review decisions across the Primer V2 prototypes. The prototypes stay
as they were reviewed. This log records what was decided about them and what
is still open for the final design-system consolidation.

**This file is the authoritative record of design decisions.** Unresolved
work (issues, validation gaps, polish) is tracked in
[`DESIGN-BACKLOG.md`](DESIGN-BACKLOG.md); backlog IDs are cited below.
Screen-title and heading decision preparation:
[`HEADER-AND-HEADING-DECISIONS.md`](HEADER-AND-HEADING-DECISIONS.md).
Screenshot evidence-retention rules for the cross-screen experiments:
[`cross-screen-refinement/EVIDENCE-RETENTION.md`](cross-screen-refinement/EVIDENCE-RETENTION.md).
Dark-theme readiness and the frozen dark visual roles:
[`DARK-THEME-READINESS.md`](DARK-THEME-READINESS.md),
[`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md).

**Scope of every approval here:** the visual prototypes only. No entry
authorises a Flutter, backend or API change; implementation differences are
collected in backlog XS-18.

## Status legend

| Status | Meaning |
|---|---|
| **Approved** | Accepted by the owner for the visual prototype, without conditions |
| **Approved with conditions** | Accepted only while the stated conditions hold; re-check them at implementation |
| **Provisionally approved** | Accepted for now, not final. Must not be read as final approval; can still change at consolidation |
| **Rejected** | Declined by the owner |
| **Pending decision** | Delivered or raised, no owner decision yet |

## Status

| Screen | Folder | Status |
|---|---|---|
| Home | `refinement-01/` | **Provisionally approved** |
| Calendar | `calendar/` | **Provisionally approved** |
| Standings | `standings/` | **Provisionally approved** (visual direction, 2026-11-07 review) |
| Explore | `explore/` | **Provisionally approved** (visual, 2026-11-08 review of Drivers, Teams and Circuits in English and Spanish; EX-01): structure, information hierarchy and category navigation. **Not production-ready.** Flutter differences not covered by EX-01 or EX-02 stay **Pending decision** (PD-04, backlog EXP-01) |
| Explore: preferred visual reference | `explore/comparison-missing-media/cue[.es].html` (**Alternative B**) | **Provisionally approved** as the preferred Explore visual reference (EX-02, 2026-11-08): no repeated placeholder tiles when a list has no media reference, plus the row chevron. The owner reviewed Alternative B's three Spanish categories; English and the responsive configurations have automated evidence only (backlog EXP-06). The original baseline (`explore/`) and Alternative A stay unchanged as reference. The per-list media-column policy stays **Pending decision** (PD-16, backlog EXP-04) |
| Settings root and preferences | `settings/` (root, Language, Theme, Time display) | **Provisionally approved** (visual, 2026-11-08; SP-01). Uncovered differences stay **Pending decision** (PD-18, backlog SETT-01). Light theme unapproved (XS-01) |
| Settings information screens | `settings/information/` (Data and updates, Acknowledgements, Privacy and legal, App information) | **Provisionally approved** (visual, 2026-11-08 reviews of English screenshots and Spanish screenshots at 390×844; SI-01 to SI-04). Acknowledgements: the **complete Spanish 390×844 composition** is now owner-reviewed and provisionally approved (second review, 2026-11-08). **Not production-ready.** 320×693, 200% text (including Spanish Acknowledgements at 320×693 @200%) and the states gallery have automated evidence only (backlog SETT-17). Uncovered differences stay **Pending decision** (PD-19, backlog SETT-10) |
| Grand Prix Detail: upcoming scenario | `grand-prix-detail/index*.html` | **Provisionally approved** (visual, 2026-11-08 review) |
| Grand Prix Detail: results scenario | `grand-prix-detail/results*.html` | **Provisionally approved** (visual composition, 2026-11-08: owner reviewed the Italian GP results screenshots in English and Spanish; backlog GPD-01 closed) |
| Grand Prix Detail: overall | `grand-prix-detail/` | **Provisionally approved**, not finally approved. Independent open items remain: GPD-04, GPD-05, XS-13, XS-02, XS-16 |
| Team Detail | `team-detail/` | **Production Flutter visually approved, Dark and Light (Step 55C.10F, 2026-11-15; TF-1 to TF-4)** (Foundation §6k; TalkBack XS-03 / XS-04 and device XS-25 stay open). Prototype: **Provisionally approved** (visual direction, 2026-11-08 review; TM-01). Refinement (line-up order, stable-name term, dark-colour edge) **Provisionally approved** (TM-02, TM-03; refinement screenshots not yet visually inspected). Uncovered differences stay open (PD-12, backlog TEAM-01) |
| Driver Detail | `driver-detail/` | **Production Flutter visually approved, Dark and Light (Step 55C.9F, 2026-11-15; DF-1 to DF-6).** Prototype: **Provisionally approved** (visual direction, 2026-11-08 review; DR-01). The targeted refinement requested in that review (season line, number-source label) is **Provisionally approved** (DR-02, DR-03; refinement screenshots not yet visually inspected). Unreviewed Flutter differences stay open (PD-11, backlog DRV-01) |
| Circuit Detail | `circuit-detail/` | **Production Flutter visually approved, Dark and Light (Step 55C.11 / 55C.11R, 2026-11-15; CF-1 to CF-7, with the CF-7 Light tick correction); CR-04 implemented and visually reviewed (Steps 55C.11C / 55C.11F, CF-8); final validation and canonical goldens Step 55C.11F, checkpoint awaiting commit approval** (Foundation §6l). Visual migration only: CR-04 / PD-14 / CIR-02 is **not** implemented and must be resolved before formal closure; PD-15, PD-07 / XS-04 and XS-29 stay open. Prototype: **Provisionally approved** (visual direction, 2026-11-08 review; CR-01). The owner reviewed the English complete, partial and no-event screenshots only; Spanish and large-text variants have automated evidence only (backlog CIR-03). Five of the ten Flutter differences are covered or approved with conditions, two are partly covered, three are pending (PD-13, backlog CIR-01) |
| **Primer V2 Dark (theme)** | Roles: `DARK-THEME-ROLES.md` | **Formally visually closed** (DK-5, approved 2026-11-12, Step 51E): the visual design reference for Flutter implementation, Primer V2 Light and cross-theme token consolidation. Visual approval only: not Android accessibility certification or production readiness; XS-11, XS-26, XS-28, XS-31, XS-32, XS-02, XS-05 and XS-16 stay open |
| **Primer V2 Light (theme)** | `LIGHT-THEME-ROLES.md` (frozen roles); `LIGHT-READINESS.md`; `LIGHT-THEME-FOUNDATIONS.md`; `LIGHT-ROLLOUT-BATCH-1.md`, `LIGHT-ROLLOUT-BATCH-2.md`; experiments `cross-screen-refinement/light-foundations/`, `light-rollout-b1/`, `light-rollout-b2/` | **Formally approved at the visual-design level (LT-18, Step 53F, 2026-11-13).** B Motorsport is the authoritative Light direction; roles frozen in `LIGHT-THEME-ROLES.md`; every approved screen family has a Light adaptation. Not Flutter implementation approval, Android accessibility certification or proof of WCAG compliance; LT-7 Live contextual validation and the XS implementation items stay open |

## Decision index

| ID | Decision | Screen | Status | Date | Conditions / notes | Section |
|---|---|---|---|---|---|---|
| D-01 | Primer V2 is the leading visual direction | All | **Approved** (as the direction; each screen has its own status above) | Stated in the owner's 2026-11-08 brief (earlier date not recorded here) | Not a final approval of any screen | — |
| P-01 | GridView 2.0.0 shows race results only | GP Detail | **Approved** (product requirement) | 2026-10-21 | PRD §9.3; the full weekend schedule, including Sprint sessions, stays | Sprint-results scope |
| S-1 | Adaptive large-text header (header budget) | Standings (Calendar, Explore candidates) | **Approved with conditions** | 2026-11-07 | Validate before any Flutter change; Flutter's fixed header unchanged until then (XS-06) **Step 55C.5.1 (2026-11-14):** still open pending Android device validation; production Standings keeps its whole header pinned and does not implement the title-row release. Measured pinned share 33.9% at 320dp/200% (flutter_tester, insets 0; SF-2) | Standings review |
| S-2 | Long screen titles narrow the width axis before scaling | Shared app bar | **Provisionally approved** | 2026-11-07 | Candidate to replace Calendar's `14cqi` cap (XS-07) | Standings review |
| S-3 | Adaptive bottom-navigation labels, no scaling cap | Navigation | **Provisionally approved** | 2026-11-07 | Selected-label fallback proposed, not applied to Home/Calendar (XS-08) | Standings review |
| S-4 | Long driver/constructor names wrap | Standings | **Provisionally approved** | 2026-11-07 | Flutter `maxLines: 1` would change on implementation; Calendar/Explore not yet covered (XS-10) | Standings review |
| S-5 | Visible "Championship leader" / tied label kept | Standings | **Provisionally approved** | 2026-11-07 | Existing ranking interpretation and ARB copy only | Standings review |
| G-1 | Dates and location shown once | GP Detail | **Approved** | 2026-11-08 | Visual prototype only | GP review |
| G-2 | Time zones in the Sessions section | GP Detail | **Approved with conditions** | 2026-11-08 | GP12/GP13 visibility must hold with an empty session list (verified, frame 11) | GP review |
| G-3 | Circuit card becomes a navigation row | GP Detail | **Approved with conditions** | 2026-11-08 | Keep circuit name and `openEntity()` navigation, also when the name is unresolved | GP review |
| G-4 | Sessions grouped by day, time first | GP Detail | **Approved with conditions** | 2026-11-08 | Delivered order and accessible descriptions preserved; reading order open (XS-03) | GP review |
| G-5 | Visible "Winner" label | GP Detail | **Approved with conditions** | 2026-11-08 | Only when classification semantics establish a winner (`home_race_winner.dart`) | GP review |
| G-6 | Points with the localized "pts" unit | GP Detail | **Approved** | 2026-11-08 | Missing points stay omitted (consistency: XS-12) | GP review |
| G-7 | Finish status and fastest lap as chips | GP Detail | **Approved with conditions** | 2026-11-08 | All values and conditional rules preserved | GP review |
| G-8 | Driver and constructor navigation share a row | GP Detail | **Approved with conditions** | 2026-11-08 | Must remain separate, accessible destinations (GPD-04, GPD-05) | GP review |
| G-9 | Long names wrap | GP Detail | **Approved** | 2026-11-08 | Visual prototype only | GP review |
| V-01 | Blank GP name: app-bar fallback | GP Detail | Verified, closed (not a design decision) | 2026-11-08 | PR #103 present on the branch | Blank name |
| PD-01 | Sprint renderer vs race-only release | GP Detail | **Decided (GF-1, Step 55C.12):** keep the existing renderer with the same Primer rows, never the race "Winner" treatment; 2.0.0 stays race-only; no Sprint-specific design or contract | 2026-11-16 | GPD-02 | Grand Prix Detail Flutter decisions |
| PD-02 | Blank GP name in the hero heading | GP Detail | **Decided (GF-2, Step 55C.12):** `grandPrixNameUnavailable` in the approved secondary style, still the heading; app-bar policy unchanged | 2026-11-16 | GPD-03 | Grand Prix Detail Flutter decisions |
| PD-03 | Standings last-successful-check caption | Standings | **Pending decision** | — | STD-01 **Step 55C.5.1 (2026-11-14):** still open for the remaining caption verification; the production resource-scoped timestamp logic is accepted (SF-2); no timestamp is invented for the staging reference | Outstanding: Standings caption |
| PD-04 | Explore's seven differences from Flutter | Explore | **Pending decision** (partly covered: differences 1, 2, 3 by EX-01; 6 by EX-02) | — | EXP-01; 4 under PD-07, 5 under PD-16, 7 under XS-06 | `explore/README.md`; Explore review |
| PD-05 | Explore progress line: sweep or static pulse | Explore | **Pending decision** | — | EXP-02 | `explore/README.md` |
| PD-06 | One reading-order policy for rows | Calendar, GP Detail, Driver Detail | **Pending decision** | — | XS-03 | `calendar/README.md`; G-4; Driver Detail difference 7 |
| PD-07 | Semantic labels that include all visible values | Calendar, Explore, GP Detail, Team Detail, Circuit Detail | **Pending decision** | — | XS-04 | `calendar/README.md`, `explore/README.md`; Circuit Detail difference 8 |
| PD-08 | Name wrapping for Calendar and Explore | Calendar, Explore | **Pending decision** for Calendar. Explore covered by EX-02 (visual prototype) | — | XS-10 | S-4, G-9, EX-02 |
| PD-09 | "Next session" wording on a past fallback session | Home | **Pending decision** | — | HOME-02 (audit §8.2) | — |
| PD-10 | Home English date format (dataset vs formatter) | Home | **Pending decision** | — | HOME-01 | `refinement-01/README.md` |
| DR-01 | Driver Detail visual direction | Driver Detail | **Provisionally approved** | 2026-11-08 | Seven approved aspects listed in the section; visual prototype only; differences not named stay open (PD-11) | Driver Detail review |
| DR-02 | Season line on the identity plate (`seasonLabel`, ready-state season) | Driver Detail | **Provisionally approved** (visual prototype; owner confirmation 2026-11-08; refinement screenshots not yet visually inspected) | 2026-11-08 | DRV-02; Flutter prints no year (Driver difference 10). Final visual validation outstanding; no Flutter change authorised. Applies to Driver and Team Detail; Circuit Detail difference 6 (year in the related section) is not covered and stays in PD-13 | Driver Detail review |
| DR-03 | Number-source label on the number board (existing field labels) | Driver Detail | **Provisionally approved** (visual prototype; owner confirmation 2026-11-08; refinement screenshots not yet visually inspected) | 2026-11-08 | DRV-03; Driver difference 11. Final visual validation outstanding; no Flutter change authorised | Driver Detail review |
| TM-01 | Team Detail visual direction, including the existing section order (Championship before Drivers) | Team Detail | **Provisionally approved** | 2026-11-08 | Nine accepted aspects listed in the section; visual prototype only; media support retained | Team Detail review |
| TM-02 | Stable constructor name exposed as term "Team" (`fieldTeam`) for screen readers; no visible label | Team Detail | **Provisionally approved** (visual prototype; owner confirmation 2026-11-08; refinement screenshots not yet visually inspected) | 2026-11-08 | TEAM-02. Final visual validation outstanding; no Flutter change authorised | Team Detail review |
| TM-03 | Chalk edge on team-colour rail and seams below 3:1 (supplied colour unchanged) | Team Detail | **Geometry superseded by XT-3 (Step 54C, 2026-11-13); the contrast-supporting principle is retained.** Originally **Provisionally approved** (visual prototype; owner confirmation 2026-11-08; refinement screenshots not yet visually inspected) | 2026-11-08 | TEAM-03. Final visual validation and device check outstanding; no Flutter change authorised | Team Detail review |
| V-02 | Team line-up order follows `competitor_dao.dart` `_byRosterOrder` | Team Detail | Verified, closed (prototype fidelity fix, not a design decision) | 2026-11-08 | `team-detail/validation-20261108-152827-refinement/data-check.txt` | Team Detail review |
| PD-12 | Team Detail differences not covered by TM-01 (nationality once, About without card, skeleton) | Team Detail | **Pending decision** | — | TEAM-01; reading order PD-06, semantics PD-07, season line DR-02 | `team-detail/README.md` |
| PD-11 | Driver Detail differences not covered by DR-01 (nationality once, section order, hidden participation labels, skeleton) | Driver Detail | **Pending decision** | — | DRV-01; reading order under PD-06 | `driver-detail/README.md` |
| CR-01 | Circuit Detail visual direction | Circuit Detail | **Provisionally approved** | 2026-11-08 | Nine accepted aspects listed in the section; visual prototype only; English A/B/C screenshots reviewed | Circuit Detail review |
| CR-02 | Typography-based composition without circuit imagery | Circuit Detail | **Provisionally approved** (with conditions) | 2026-11-08 | Approved layouts and photographs stay supported; informative diagrams keep a meaningful description; no generated, downloaded or invented imagery (XS-15) | Circuit Detail review |
| CR-03 | Length shown as a dimension line | Circuit Detail | **Provisionally approved** | 2026-11-08 | Kept as is; may be read as a proportional scale: visual validation issue for consolidation (CIR-05), not redesigned | Circuit Detail review |
| PD-13 | Circuit Detail differences not covered by CR-01 (unavailable-holder style, part of 4; year in the related section, part of 6; unnamed-event style, 9; skeleton, 10) | Circuit Detail | **Approved: Option A for all three** (PD-13a secondary style for the unavailable holder and Grand Prix name; PD-13b season line under the related heading in both states; PD-13c Circuit skeleton) | 2026-11-15 | Step 55C.11 owner decision; implemented as prototyped (CF-1). Link description (8) stays under PD-07 / XS-04 | `circuit-detail/README.md`; Circuit Detail Flutter decisions |
| PD-14 | "No Grand Prix this season" when the season's calendar is not stored locally | Circuit Detail (Flutter behaviour) | **Resolved by CR-04, implemented and visually reviewed** (Steps 55C.11C / 55C.11F) | 2026-11-15 | CIR-02; CF-8 | Circuit Detail Flutter decisions |
| PD-15 | Season-relative headings ("This season's Grand Prix") on a historical season | Circuit Detail | **Pending decision** | — | CIR-04; no new copy written | Circuit Detail review |
| EX-01 | Explore visual direction: structure, information hierarchy, category navigation | Explore | **Provisionally approved** | 2026-11-08 | Ten accepted aspects listed in the section; visual prototype only; not production-ready | Explore review |
| PD-16 | Explore missing-media presentation (placeholder tiles vs no image column vs the collection-level media rule) | Explore | **Partly decided.** No repeated tiles when a list has no media reference: **Provisionally approved** (EX-02). The per-list media-column policy (mixed lists, loading, failed, reflow after synchronization, slot size, informative-image semantics) stays **Pending decision** | — **Step 55C.7.1 (2026-11-15):** the temporary production policy is accepted (EF-3: no column without media, uniform 40dp slot with media); PD-16 stays open for the real-media layout | EXP-04; comparison `explore/comparison-missing-media/` (`media-states.html` gallery); XS-15 | Explore review |
| PD-17 | Explore entity-row navigation discoverability (add the Standings/Calendar row chevron or not) | Explore | **Decided by EX-02** (chevron adopted, provisionally approved). Validation open (EXP-05) | 2026-11-08 | EXP-05; related GPD-04 | Explore review |
| EX-02 | Explore Alternative B (`explore/comparison-missing-media/cue[.es].html`) is the preferred visual reference | Explore | **Provisionally approved** (visual prototype) | 2026-11-08 | Eleven approved elements listed in the section. The owner reviewed the three Spanish categories; English and responsive configurations have automated evidence only (EXP-06). Media policy stays open (PD-16). Baseline and Alternative A kept unchanged | Explore review: Alternative B |
| SP-01 | Settings root and the three preference screens (Language, Theme, Time display) | Settings | **Provisionally approved** (visual prototype) | 2026-11-08 | Nine approved aspects and six outstanding considerations listed in the section; light theme not approved (XS-01); persistence and Android untested (SETT-05) | Settings review |
| PD-18 | Settings differences not covered by SP-01 | Settings | **Pending decision** | — | SETT-01; Send feedback glyph SETT-04 (owner prefers the mail icon); keyboard and semantics SETT-02 | `settings/README.md` "Differences from Flutter"; Settings review |
| PD-19 | Settings information screens' differences from Flutter not covered by SI-01 to SI-04 (3, 13, 14, part of 15, 16, 17, the single-word title fit in 18, 20) | Settings | **Pending decision** (visual compositions provisionally approved 2026-11-08; these differences were not visible in, or not confirmed by, the reviewed screenshots) | — | SETT-10; review gaps SETT-17 | `settings/information/README.md`; Settings information review |
| SI-01 | Data and updates visual composition | Settings | **Provisionally approved** (visual prototype) | 2026-11-08 | Reviewed: English D1 (remote production) and D5 (season unavailable), Spanish D2 (DEV bundled sample), 390×844. The four data modes stay distinct; the offline explanation with no local season stays under review (SETT-16) | Settings information review |
| SI-02 | Acknowledgements typography, spacing, hierarchy and visual direction; complete Spanish 390×844 composition | Settings | **Provisionally approved** (visual prototype) | 2026-11-08 | First review: Spanish opening section, English upper and lower sections. Second review (same day): Spanish lower section; the complete Spanish 390×844 composition provisionally approved, with the legal links, licence presentation and empty media-attribution state accepted. **Not** visually verified: 320×693 and 200% text, including Spanish 320×693 @200% (SETT-17). Legal text, attribution and links preserved. English "Source notice" value on Spanish pages: provider-derived, investigated, not translated (SETT-20). CC BY-NC-SA 4.0 commercial use unresolved (SETT-18). Heading hierarchy may be revisited at consolidation (SETT-19) | Settings information review |
| SI-03 | Privacy and legal visual composition, the "Privacy" section heading, and the visual separation of configured diagnostics, advertising and current-session reporting | Settings | **Provisionally approved** (visual prototype; heading and separation approved as part of it) | 2026-11-08 | English and Spanish, 390×844; scenarios not individually named. Conditional states preserved. Positional wording "the line above" / "la línea anterior" open for a bilingual content correction (SETT-12); no copy changed without checking the ARB strings and behaviour | Settings information review |
| SI-04 | App information visual composition | Settings | **Provisionally approved without changes** (visual prototype) | 2026-11-08 | English and Spanish, 390×844. Condition: version and build keep resolving from package metadata at runtime; the prototype's 1.2.1 / 7 (golden fixture) must never be hardcoded | Settings information review |
| CT-01 | Calendar's screen title uses the shared adaptive title fit (S-2: width axis 118 → 100 → 84 → 72, then a last-resort scale) instead of the `14cqi` cap; 34px at 320 @200% | Calendar | **Visually approved for the experimental design direction** (visual prototype only) | 2026-11-10 | Owner reviewed English and Spanish at 320×693 @200% (Step 48B screenshots). **Not** a Flutter approval: Android and TalkBack validation pending; XS-07 stays open; the approved `calendar/` and the consolidation pilot are unchanged. The shared `shared/title-fit.js` is retained | Calendar title-fit review |
| CT-02 | Calendar sticky-header split: season row pinned; last-check caption, stale notice and refresh-failure notice scroll with the content; adaptive title kept; focused rows never hidden by fixed elements | Calendar | **Provisionally visually approved as the preferred direction** (visual prototype only); its dynamic title release (Stage 2) is **not preferred** since 2026-11-11 (CT-03) and is kept as a historical alternative | 2026-11-10 | Owner reviewed Spanish stale mid-list and English refresh-failure with round 22 focused, both 320×693 @200% (Step 48C). The pinned season, scrolling status and focus requirement carry into CT-03; the experiment `calendar-sticky-split/` is kept unchanged as historical exploration. **Not** a Flutter approval: device, TalkBack and functional validation pending; off-screen cue, landscape criteria, release rule and C13/C15 contract change open (`calendar-sticky-split/DECISIONS-48D.md` §6); XS-06, XS-07 open | Calendar sticky-header split review |
| CT-03 | Calendar Stage 1: title row (title, Refresh, Settings) and season row pinned; last-check caption and stale/failure notices scroll with the content, as an intentional change from Flutter's fixed header; full messages and existing localization kept; dynamic title release only an optional future refinement | Calendar | **Provisionally approved as the preferred Calendar visual and interaction direction** (visual prototype only); Stage 1 is the preferred reference | 2026-11-11 | Recommended 2026-11-10 (Step 48E); owner approval 2026-11-11 (Step 48F) after reviewing the six critical screenshots: ES stale 320×693 @200%, EN refresh failure with round 22 focused 320×693 @200%, and landscape 693×320 @200% Stage 1 vs Stage 2. Stage 2's extra 44px in landscape does not justify the partly hidden title and more complex scrolling. **Not** production-ready and no Flutter work authorised; not promoted into `calendar/`; the earlier conditional snackbar is superseded by N-5 (first-open toast and every tested Calendar overlay rejected, 2026-11-11); manual-refresh feedback stays unresolved (XS-19); all Android and TalkBack validation requirements stand (`DECISIONS-48D.md` §5); experiment `cross-screen-refinement/calendar-stage1/`; XS-06, XS-07 open | Calendar Stage 1 direction |
| CR-04 | Circuit Detail claims "No Grand Prix this season" only when the selected season's calendar is confirmed complete (materialized); otherwise the unsupported absence block is omitted and every other circuit fact stays | Circuit Detail | **Implemented and visually reviewed** (Step 55C.11C implementation; owner final visual approval of confirmed absence and unknown association, Step 55C.11F, 2026-11-15; CF-8) (CD-2 approved: stale stays materialized; CD-3 deferred) | 2026-11-11 | Step 49B.1, owner review of `STATUS-ABSENCE-DECISIONS.md`. Visual approval Step 49B.2 (2026-11-11) after the owner reviewed, before and after: Spanish partial profile 320×693 @200% and English unknown event association 390×844 @100% (`STATUS-ABSENCE-DECISIONS.md` §7). Linked event shown when stored. Completeness = `hasMaterializedCalendar` for that exact season (own `calendar:<season>` record or an accepted bootstrap for that season); never inferred from stored event rows, never from another season. No new copy; no database, backend or API change. Not implemented. CIR-02 stays open (stale-calendar rule CD-2 and persisting the contract's association CD-3 undecided). Experiment `cross-screen-refinement/circuit-absence/` | Event-absence decisions |
| HM-01 | Home omits the secondary "Upcoming events" section when the hero is "Next Grand Prix" (pre-event) and the upcoming list is available but empty | Home | **Approved with conditions; visually approved for future implementation** (visual prototype only; Flutter behaviour and tests not validated) | 2026-11-11 | Step 49B.1. Visual approval Step 49B.2 (2026-11-11) after the owner reviewed Spanish Home 320×693 @200%, before and after (`STATUS-ABSENCE-DECISIONS.md` §7). Only that combination; an empty list alone never hides the section. Current and Latest Grand Prix phases, the unavailable-calendar state, all strings and the Calendar navigation destination unchanged. The section's "View Calendar" link is lost in that state (accepted: Calendar stays in the bottom navigation). No new copy. Not implemented. HOME-08 open. Experiment `cross-screen-refinement/home-upcoming-omit/` | Event-absence decisions |
| RK-1 | An explicitly unranked Standings row is announced "Unranked" / "Sin clasificar" (existing `positionUnranked`); the visible "—" stays; "Position unavailable" is never a synonym for unranked | Standings | **Approved** (semantic; screen-reader text only) | 2026-11-11 | Step 49C, owner review of `STATUS-RANKING-DECISIONS.md` (R1). No new copy, no visual change, no new experiment. Future Flutter and accessibility-test correction; not implemented. Tracked in XS-11 | Ranking decisions |
| RK-2 | Explore keeps the labelled "Position" / "Points" data of Alternative B; an unranked position is omitted; known points, including 0, are kept; no isolated number that could read as a position | Explore | **Approved** (semantic; confirms EX-01 difference 1) | 2026-11-11 | Step 49C (R2). No new Explore redesign. Tracked in EXP-01 | Ranking decisions |
| RK-3 | Home shows the existing "Leader unavailable" when a first-place standing exists but its competitor name is not stored; "No leader yet" only when the available standings establish no leader | Home | **Approved** (semantic) | 2026-11-11 | Step 49C (R3). Existing EN/ES strings; ARB description to widen later. Presentation read model only. Tracked in HOME-09 (new) | Ranking decisions |
| RK-4 | Tied leaders: current handling of known names kept | Home, Standings | **Provisionally approved with conditions** | 2026-11-11 | Step 49C (R4). The tie is always stated; missing names are never invented; a single visible name never reads as the sole leader. Current presentation meets these (`STATUS-RANKING-DECISIONS.md` §9). The importer still refuses repeated positions and unranked rows, although the model represents them; importer unchanged | Ranking decisions |
| RK-5 | Ranking tracking: XS-11 (RK-1), EXP-01 (RK-2), HOME-09 (RK-3), TEAM-06 (Team Detail unranked test fixture); implementation stays open until Flutter tests pass | All | **Approved** | 2026-11-11 | Step 49C. HOME-04 checked: it covers prototype rendering only, so HOME-09 is not a duplicate | Ranking decisions |
| N-1 | Refresh failure, stale cached data and incomplete information stay independently representable; when separate notices are needed the order is failure → stale → incomplete, at most one of each; a failure never conceals an incomplete profile; results finality stays in classification indicators | Calendar, GP, Driver, Team, Circuit, Home | **Approved** (semantic policy) | 2026-11-11 | Step 49D.1, owner review of `STATUS-NOTICE-DECISIONS.md`. Closes audit decision D3. No domain or synchronization change. Not implemented | Notice coexistence |
| N-2 | One combined notice when refresh failure and stale data concern the **same content**. Preferred wording: EN "Couldn't refresh. Saved data may be out of date." / ES "No se pudo actualizar. Los datos guardados pueden estar desactualizados." | Calendar, GP, details | **Step 54C (D8): wording preserved; ARB implementation required (no ARB edited; see `CROSS-THEME-CONSOLIDATION.md` §8).** **Approved** as the preferred wording for future implementation (no ARB implementation authorised yet) | 2026-11-11 | Step 49D.3, after the Step 49D.2 comparison: same measured height as the earlier candidate (EN 3 lines, ES 5 lines at 320×693 @200%) and keeps the saved-data meaning. Combining provisionally visually approved in Step 49D.2. Conditions stay separate internally; an incomplete profile keeps its own notice; unrelated failure and stale conditions are never combined. Experiment `cross-screen-refinement/notice-coexistence/` | Notice coexistence |
| N-3 | Home exception: module-specific unavailable information stays in the affected module, not a global incomplete notice | Home | **Approved** | 2026-11-11 | Step 49D.1 | Notice coexistence |
| N-4 | A previous failure notice stays visible while a retry runs; it is replaced or removed only when the outcome is known; the existing progress indication stays | All with notices | **Approved functional direction** (not implemented) | 2026-11-11 | Step 49D.1. Avoids layout shifts and repeated announcements. Transitions in `STATUS-NOTICE-DECISIONS.md` §9 | Notice coexistence |
| N-5 | Calendar first-open toast and every tested overlay notification | Calendar | **Rejected** | 2026-11-11 | Step 49D.3 (bottom toast not approved at 200% text in Step 49D.2; no overlay approved in 693×320 landscape; top-edge, full-text and both-facts variants rejected in Step 49D.1). Feedback after a **user-initiated** refresh whose notice is off-screen stays an **unresolved Flutter/device-validation requirement**, not an approved snackbar design (XS-19) | Notice coexistence |
| N-6 | Calendar initial entry (Calendar only; not a rule for other screens), in the Stage 1 scrolling layout (CT-03), which is unchanged: (a) with a failure or stale notice at the one-time initial positioning, the first relevant notice is made fully visible below the pinned header; (b) without a notice, the list is positioned near the relevant current or next race; (c) a target row taller than the scroll viewport is aligned by its top rather than having its beginning clipped; (d) an existing or restored scroll position always takes precedence; (e) user scrolling cancels a pending initial positioning; (f) later refreshes and changes in notice state never force another jump | Calendar | **Approved** (production, narrowly scoped; Step 55C.2.1) | 2026-11-14 | Step 49D.3 provisional preference (option A, 2026-11-11), implemented in Flutter in Step 55C.2.1 and approved by the owner on 2026-11-14 with both reported extensions: the decision waits deterministically, with no timer, for the Calendar sync record, the bootstrap freshness record and the stored season record to resolve; and oversized rows are top-aligned. Implementation: `docs/technical/GridView_Primer_V2_Theme_Foundation.md` §6f. This is the one entry here that authorises Flutter behaviour, for Calendar only. **Still open:** native Android and TalkBack validation; real-device scrolling and system-inset validation; keyboard scroll commands during an already-running multi-step anchor adjustment; a freshness dependency that never resolves (the list then stays at its start); owner visual review of Home and Calendar. The Step 49D.3 full-season question (distance to the next race when the notice comes first) was not part of this approval. It was measured on 2026-11-14 and is answered by a separate, user-initiated action ("Go to next / current Grand Prix", Step 55C.2.2), recorded under backlog XS-19. That action is not part of N-6, and N-6 is unchanged. Inline line (option B) and overlays stay rejected (N-5) | Notice coexistence |
| N-7 | Home shows no global notice for every standings-table refresh failure, but no module may misleadingly imply freshness | Home | **Approved with conditions** | 2026-11-11 | Step 49D.2. Condition: a leader module whose table failed or is stale must not read as current (the aggregate stale notice and module messages stay; no module claims a fresh time it does not have) | Notice coexistence |
| VS-1 | Dashed outline = unknown value, from the existing vocabulary, for unknown event status, unknown weekend format, unknown session status and unknown race-result finish; each keeps its own existing wording | Calendar, GP, Circuit, Home | **Approved** (visual prototype only) | 2026-11-12 | Steps 49E to 49E.2. Owner reviewed the format and session pairs (Step 49E.1) and the unknown-finish pair (Step 49E.2). An unknown status and an unknown format stay different domain facts. Dashed border 6.1:1 in Chrome. Widens audit decision V3. Flutter has no dashed border (XS-28); not implemented. XS-11 | Status visual decisions |
| VS-2 | Dagger added to every "Provisional" indicator | GP, Driver, Team | **Rejected** | 2026-11-12 | Step 49E.1. GP results, Driver and Team keep the outline chip with the word. "Provisional" and "Not available" keep the same outline in GP results; only the words separate them (known overlap, not redesigned). Closes audit decision V2 | Status visual decisions |
| VS-3 | Standings provisional row marker without the dagger in the future implementation; compact size, outline, word, accessible name and the whole-table caption kept | Standings | **Approved** (visual prototype only) | 2026-11-12 | Step 49E.2, after the Step 49E.1 comparison (only the chip width changes; accessible text, row label, tab order and caption unchanged). The `standings/` prototype, the pilot and `shared/components/chip.css` keep the dagger as reviewed; this entry supersedes their "dagger + word" description. Caption weight stays STD-04 | Status visual decisions |
| VS-4 | Notice icons from the existing vocabulary: alert for refresh failure and the combined failure + stale notice; clock for stale data; help (?) for incomplete profile information and for Home's "Some information is unavailable" (O-2, Step 49F.1). Icons decorative and non-interactive; the text alone identifies each notice | Driver, Team, Circuit, GP, Calendar, Standings, Explore | **Approved** (visual prototype only) | 2026-11-12 | Steps 49E.1 (direction, alert) and 49E.2 (clock, help). No information icon exists in the vocabulary and none was added. Cloud-off no longer marks these causes. Flutter semantics and device legibility open (XS-22, XS-02, XS-16) | Status visual decisions |
| VS-5 | Spanish "Formato desconocido" may wrap to two lines at 320px and 200% text | GP, Circuit | **Approved** | 2026-11-12 | Step 49E.1. No copy change. System font scaling on a device open (XS-16) | Status visual decisions |
| VS-6 | Calendar's repeated per-row unknown-status labels | Calendar | **Unchanged** presentation. Audit V1 (quieter list marker or not) remains an **open design question**, not an approved decision (O-3, Step 49F.1) | 2026-11-12 | Steps 49E.1 and 49E.2 | Status visual decisions |
| VS-7 | Owner-reviewed status-visual evidence kept Git-visible with narrow experiment-specific ignore rules; other screenshots local, all kept on disk | — | **Approved** | 2026-11-12 | Step 49E.2. 15 screenshots visible (`STATUS-VISUAL-DECISIONS.md` §15) | Status visual decisions |
| L1 | Spanish freshness caption "Última comprobación correcta: {time}" (keys `homeUpdated`, `lastUpdatedLabel`; `{time}` unchanged) replacing "Comprobado: {time}", which drops "last" and "successful"; English unchanged. An unknown or unfinished check is never labelled successful | Home, Calendar, Standings | **Approved** (final wording, Step 50A; no ARB change yet) | 2026-11-12 | Step 49F.1 (O-1, provisional); final approval Step 50A. Measured at 320×693 @200% in Chrome: 2 lines (+37.7px), the same height as English with a time; no overflow (`STATUS-LOCALIZATION-ACCESSIBILITY-REVIEW.md` §11). Device font scaling stays a validation item. Future Calendar behaviour: known last successful check → caption with its time; refresh in progress → `standingsRefreshingLabel`; no known successful check → no caption; a failed refresh keeps the previous successful time (the failure notice states the failure). XS-30 open until implemented and tested | Step 49 closing review |
| DK-1 | **A1 solid status outlines:** Chalk at 45% on dark surfaces; `on-chalk` at 55% on Chalk surfaces (Standings provisional marker); the dashed unknown outline (60%, VS-1) stays the stronger treatment | Calendar, GP, Circuit, Driver, Team, Standings, Home | **Approved** (visual prototype; token direction) | 2026-11-12 | Steps 51C and 51C.1. Rendered 3.71–3.96 on graphite (was 1.85–1.89), 3.74 on Chalk (was 2.18). Chip sizes, words and accessible names unchanged. Not implemented: XS-11, XS-28. Chrome only | Dark visual closure |
| DK-2 | **A2 selection:** flat existing `--oxide` replaces the `#B04633` gradient; existing diagonal selected shape, bold selected label (600 → 800, `text-2` → Chalk) and selected semantics kept; **no** selected-label underline (rejected: may read as a link); **no** extra 12° selection tick (not adopted: reads as a stray "/") | Standings, Explore (selector); Calendar next-event block | **Approved** (visual prototype) | 2026-11-12 | Steps 51C and 51C.1. **The flat slab measures 2.47:1 against the selector background** (tray), below 3:1. Its pairing with weight, label colour, diagonal shape and semantics is the recorded rationale; it does **not** by itself establish WCAG compliance. XS-26 stays open | Dark visual closure |
| DK-3 | **A3 focus:** Chalk ring on selected **and** unselected selector buttons; Chalk ring where it crosses oxide in Calendar (next-event) and GP results (winner row); focus painted above decorative fills so the whole intended perimeter stays visible; Ember ring outside the Chalk Standings leader row, against graphite | Standings, Explore, Calendar, GP Detail | **Approved** (visual prototype) | 2026-11-12 | Steps 51C and 51C.1. Selector 2.27–2.66 → 5.43 (13.41 on tray); Calendar ring drawn 0.85 → 1.00; every GP row ring drawn 0.82 → 1.00, winner min 4.63; leader row 2.80 → 7.44. Not implemented: XS-31. Keyboard focus visibility not complete (XS-32) | Dark visual closure |
| DK-4 | Home championship band: the existing oxide focus ring inside the Chalk band is kept; no correction | Home | **Technically verified** (Chrome emulation, Step 51D; accepted by the owner, Step 51E); existing approved treatment kept | 2026-11-12 | Ring drawn on Chalk only, 4.90–5.43 (min 3.82 crossing the hairline divider); drawn 1.00 at EN 390 @100% and EN/ES 320 @200%; no decorative layer hides it (the oxide name seam only touches its top edge). Same surface rule as DK-3. The two Step 51D Home crops are technical evidence, not owner-reviewed visual approvals. No further Home experiment is required for dark closure. Tab can leave it under the bottom navigation: XS-32 | Dark visual closure |
| DK-5 | **Formal Primer V2 Dark visual closure:** Primer V2 Dark is the visual design reference for Flutter implementation, the Primer V2 Light design and cross-theme token consolidation, with roles frozen in `DARK-THEME-ROLES.md` | All | **Approved** (Step 51E, after the Step 51D assessment) | 2026-11-12 | Visual design approval, not Android accessibility certification or production readiness. All Flutter, Android, TalkBack, contrast, scrolling and responsive requirements preserved. Implementation and device items stay open: XS-11, XS-26, XS-28, XS-31, XS-32, XS-02, XS-05, XS-16, XS-01 | Dark visual closure |
| DK-6 | **Retain the existing decorative gradients** on the Home hero round block, the Driver identity plate and the GP winner position cell. Flat oxide (DK-2) applies to selected controls and the DK-2 components only, never automatically to editorial decoration | Home, Driver Detail, GP Detail | **Approved** (retain as approved; Step 51E) | 2026-11-12 | `linear-gradient(165deg, #B04633 0%, oxide 45% (Home) or 55% (Driver, GP), oxide-deep 100%)`, unchanged. `#B04633` is an existing contextual decorative value: not a shared token and not retired. No gradient created or modified. Step 51D's flattening recommendation was declined | Dark visual closure |
| LT-1 | **Primer V2 Light visual direction: B Motorsport.** Direction B (Neutral Contrast) with two refinements: the Home Grand Prix hero keeps its white card with a Graphite action strip, and Grand Prix Detail gets a Graphite heading band. Every other component keeps the original B treatment (GP results, Standings, Explore and the rest) | All (Light) | **Approved** (visual direction; Step 53B, after the owner reviewed the seven Step 53A.1 comparisons) | 2026-11-12 | `LIGHT-THEME-FOUNDATIONS.md` §11–§12. Direction A and the original B stay as historical references. Visual direction only: not Flutter implementation, not WCAG certification | Light-theme direction |
| LT-2 | **Light neutral palette baseline:** the Direction B neutrals (page `#EBECEE`, band `#F7F7F8`, raised `#DCDDE1`, white only for the elevated editorial card) with Graphite text, `on-chalk-2` secondary text, Red Oxide accent and Graphite-alpha lines | All (Light) | **Approved with conditions** (baseline, pending wider component validation) | 2026-11-12 | `LIGHT-THEME-FOUNDATIONS.md` §3. Condition: re-check on the remaining components and screens before a Light role freeze | Light-theme direction |
| LT-3 | **Graphite editorial panels in Light,** only in the reviewed contexts: Home championship band, Standings leader row, Home hero action strip, GP Detail heading band. Not a mandatory treatment for every screen | Home, Standings, GP Detail (Light) | **Approved with conditions** (reviewed contexts only) | 2026-11-12 | `LIGHT-THEME-FOUNDATIONS.md` §3.4, §11. Any further Graphite panel needs its own review | Light-theme direction |
| LT-4 | **Contextual focus-ring backing, unselected segmented option:** while an unselected option is focused, a 5px inset band of the selector surface sits under its Graphite ring, covering the tip of the neighbouring selected slab locally | Standings, Explore (Light) | **Approved** (visual; Step 53C, after the owner reviewed the ten Step 53B comparisons) | 2026-11-13 | `LIGHT-THEME-FOUNDATIONS.md` §12.2; `light-53b.css` 1. Focus-only; selected option unchanged (Chalk ring on oxide). Chrome evidence only | Light-theme direction |
| LT-5 | **Contextual focus-ring backing, GP winner row:** a 5px inset band of the page colour under the winner row's Graphite ring while focused; the DK-6 gradient is unchanged at rest | GP Detail (Light) | **Approved** (visual; Step 53C) | 2026-11-13 | `light-53b.css` 2. Ordinary and non-finisher rows unchanged | Light-theme direction |
| LT-6 | **Team-colour edge rule (preferred shared visual rule):** a team colour below 3:1 against the surface it actually sits on gets a 1px edge in that surface's primary text colour (Graphite on Light, Chalk on Dark); the supplied colour never changes | Team-colour accents (Light; proposed for Dark under XS-25) | **Geometry finalised by XT-3 (shared, Step 54C).** **Approved as the preferred visual rule** (Step 53C), **subject to validation** in the other team-colour contexts and to Flutter/Android implementation | 2026-11-13 | `light-53b.css` 5 (Explore tick); Batch 1 applies it to the Team Detail rail and line-up seam (`LIGHT-ROLLOUT-BATCH-1.md` §4). XS-25 stays open | Light-theme direction |
| LT-7 | **Status fills in Light. Final:** filled inverse chip, Graphite fill with Chalk text and the check icon. **Live:** Ember fill with Graphite text | Final: GP Detail results (Light). Live: every status chip (Light) | **Final approved** (Step 53E). **Live: Ember approved as the preferred visual direction; the Red Oxide substitution is rejected** (Step 53F). **Contextual validation pending** until an authoritative app screen presents Live: validated as an isolated component specimen only (text 7.44; fill 2.08 page, 6.10–6.18 GP band) | 2026-11-13 | `LIGHT-THEME-ROLES.md` §3.4; `LIGHT-READINESS.md` §3. No race data invented | Light-theme direction |
| LT-8 | **Light notice border stays Graphite 26%** (`--hair-strong`), a supporting decorative boundary. The notice's meaning is carried by its text, cause icon, fill and position, never by the border alone (as in Dark, 2.13:1). The 55% status-outline candidate (3.58:1) is not adopted | Notices on every screen (Light) | **Approved** (visual; Step 53E) | 2026-11-13 | `LIGHT-ROLLOUT-BATCH-2.md` §7; comparison `light-rollout-b2/lt8-notice.css` kept as the record | Light-theme direction |
| LT-9 | **Light bottom navigation as approved:** flat oxide slab (6.09 vs bar), selected icon Chalk on the slab (5.43) with a Graphite label (17.05), unselected `text-2` (7.30), Graphite focus ring; the large-text responsive layout unchanged | Bottom navigation (Light) | **Approved** (visual; Step 53F) | 2026-11-13 | `LIGHT-THEME-ROLES.md` §3.3, §3.9; `LIGHT-READINESS.md` §4. Native focus visibility, system insets and scrolling stay open under XS-31 and XS-32 | Light-theme direction |
| LT-10 | **The three approved decorative gradients (DK-6) stay unchanged in Light** (Home hero round block, Driver identity plate, GP winner cell), with only their shadows taking the Light alpha | Home, Driver Detail, GP Detail (Light) | **Approved** (visual; Step 53E) | 2026-11-13 | Verified in Light: Step 53A (Home), Batch 1 (Driver plate), Batch 2 (winner cell 7.65–8.3 against its row) | Light-theme direction |
| LT-11 | **GP Detail back-button focus ring 1px from the button** (offset 3px to 1px), so the ring no longer ends on the Graphite band's edge | GP Detail and, through the shared detail app bar, Driver and Team Detail (Light) | **Approved** (visual; Step 53C) | 2026-11-13 | `light-53b.css` 3. Ring colour, width and shape unchanged | Light-theme direction |
| LT-12 | **Square Graphite action-strip corners while the Home hero is focused** (the global 6px focus radius no longer cuts notches into the strip) | Home (Light) | **Approved** (visual; Step 53C) | 2026-11-13 | `light-53b.css` 4. Correction of an unintended change to the approved strip | Light-theme direction |
| LT-13 | **Driver Detail and Team Detail keep the Light heading band** (the plate and the banner on the light band). The Graphite heading alternative is not adopted. The approved decorative driver plate (DK-6 number board) and the original team colours are preserved | Driver Detail, Team Detail (Light) | **Approved** (visual; Step 53C.1, after the owner reviewed the Batch 1 screenshots) | 2026-11-13 | `light-b1.css` 4; `LIGHT-ROLLOUT-BATCH-1.md` §3, §4, §6. `light-b1-alt.css` stays only as the record of the rejected alternative | Light-theme direction |
| LT-14 | **Completed Calendar rows in Light keep 100% opacity** (no completed-row dimming). Completion stays communicated by the existing label, check icon and solid status boundary of the "Completed" chip, never by opacity. The 0.85 alternative is rejected (negligible visual benefit, insufficient contrast margin: 4.71 and 3.04 against 4.5 and 3) | Calendar (Light) | **Extended to Dark by XT-2 (Step 54C).** **Approved** (visual; Step 53D, after the owner reviewed the Step 53C.1 A/B comparison) | 2026-11-13 | `LIGHT-ROLLOUT-BATCH-1.md` §8; treatment = `lt14-a.css`. The Italian Grand Prix row on the `lt14-*.html` pages is experimental comparison evidence only, taken from the GP Detail results fixture; no approved Calendar data or fixture was changed. Dark keeps its approved 0.72; its completed-chip outline then measures 2.65:1 (tracked under CAL-01 and XS-11) | Light-theme direction |
| LT-15 | **Calendar next-event focus backing:** the Graphite ring on the next-event row with the approved 5px band backing (LT-4/LT-5 rule) instead of Dark's Chalk ring; nothing changes at rest | Calendar (Light) | **Approved** (visual; Step 53C.1; the owner reviewed the Spanish 320dp, 200% comparison) | 2026-11-13 | `light-b1.css` 3. Flutter and Android focus validation stays open under XS-31 | Light-theme direction |
| LT-16 | **Light loading placeholders kept** for GP Detail and Circuit Detail (static `band`→`raised` blocks, hero 1.15 vs page). The Graphite GP placeholder candidate (11.69 vs page) is **rejected** | GP Detail, Circuit Detail (Light) | **Approved** (visual; Step 53F) | 2026-11-13 | `LIGHT-READINESS.md` §2; comparison `light-rollout-b2/lt16-skeleton.css` kept as the record. Loading semantics and geometry unchanged; no added animation | Light-theme direction |
| LT-17 | **Shared Dark/Light rule: the GP classification team-link focus ring is drawn 2px inside the link** (`outline-offset: -2px`) instead of 3px outside, so it no longer crosses the driver name or the status chip nearby. Light 100%, min 15.45; Dark 100% on every link, min 7.44 (was 98% on the winner row) | GP Detail (both themes) | **Approved as a shared rule** (Step 53F; Light in Step 53E; the owner reviewed the Dark English winner and Spanish multiline comparisons) | 2026-11-13 | **Flutter implementation requirement for both themes (XS-31).** Layout, accessible names, targets and Tab order unchanged. In `light-b2.css` 4; the frozen Dark prototypes and pilots are not modified (`LIGHT-THEME-ROLES.md` §6) | Light-theme direction |
| LT-18 | **Formal Primer V2 Light visual closure:** Primer V2 Light in the B Motorsport direction is the Light visual design reference for Flutter implementation and cross-theme token consolidation, with roles frozen in `LIGHT-THEME-ROLES.md` (B neutrals, Graphite typography, Red Oxide selection, Graphite panels only in approved contexts, Home Graphite action strip, GP Graphite heading, light Driver/Team/Circuit headings, approved chips and notices, DK-6 gradients, contextual team-colour edges, approved focus treatments, full-opacity completed Calendar rows, light loading placeholders) | All (Light) | **Approved** (Step 53F, after the owner reviewed the six Step 53E screenshots) | 2026-11-13 | Visual design approval, not Flutter implementation approval, Android accessibility certification or WCAG compliance. Open: LT-7 Live contextual validation; XS-02, XS-05, XS-07, XS-11, XS-16, XS-25, XS-26, XS-28, XS-31, XS-32 | Light-theme direction |
| XT-1 | **Home Explore links: focus ring 4px inside the link** (D1). Same 2px ring and per-surface colour (Ember on Dark, Graphite on Light), fully visible inside the strip's rounded, clipping container; labels, icons, separators, geometry, Tab order and targets unchanged. Applies to the three Home Explore links only, not globally; LT-17 (2px inside, GP team links) stays a separate rule | Home (both themes) | **Approved** (visual; Step 54C, after the owner reviewed the Step 54B comparisons) | 2026-11-13 | `CROSS-THEME-CONSOLIDATION.md` §6.1; experiment `cross-screen-refinement/cross-theme-54b/` (`explore-focus.css`): ring 100% visible in both themes and sizes (today 20–82%), min 6.30 Dark / 16.42 Light; −2px and −3px clip the strip's corners or touch the separators. Flutter and Android validation open (XS-31) | Cross-theme consolidation |
| XT-2 | **Calendar completed rows at 100% opacity in Dark and Light** (D2). No whole-row dimming; completion is carried by the existing "Completed" label, check icon and solid status boundary; unknown states keep the stronger dashed treatment. Supersedes the inherited Dark 0.72 | Calendar (both themes) | **Approved** (visual; Step 54C) | 2026-11-13 | `CROSS-THEME-CONSOLIDATION.md` §6.2. Dark measured on the LT-14 specimen (experimental evidence only; no Calendar fixture or approved prototype changed): completed outline 2.65 → 3.96, secondary text 4.68 → 7.95, name and chip label 8.26 → 15.19, the row's focus ring 4.38 → 7.44 (the dimming also dimmed the ring). XS-11 and CAL-01 open until implementation and native validation | Cross-theme consolidation |
| XT-3 | **Shared team-colour geometry, both themes** (D3): Explore tick 3px; Team Detail line-up seam 2px; main team banner bar 12px; pinstripe 3px; all with the 12° cut and the same size whether or not an edge is drawn. **Contextual boundary:** 1px outside the coloured shape, taking no layout space, only when the supplied colour is below 3:1 against the surface it actually sits on, in that surface's text colour (Chalk on Dark, Graphite on Light). The supplied team colour is never replaced, narrowed or recoloured | Explore, Team Detail (and every team-colour shape) | **Approved** (visual; Step 54C) | 2026-11-13 | `CROSS-THEME-CONSOLIDATION.md` §6.3; `cross-theme-54b/` (`seam-dark.css`, `seam-light.css`). Supersedes the Dark widened 4px seam column, the Dark inner Chalk frame and Chalk pinstripe (TM-03 geometry), the Light inner 2px Graphite frame and Graphite pinstripe, and Dark Explore ticks without an edge (`#1E41FF` 2.83 → boundary 15.19). Dark and Light geometry identical. XS-25 open (runtime test, Flutter, devices) | Cross-theme consolidation |
| XT-4 | **Back-button focus offsets stay per theme** (D4): Light 1px (LT-11), Dark 3px (approved). Both implement the same principle (the ring contrasts with, and stays visible against, what it is drawn on) with context-specific geometry; no shared inset is forced without evidence | Detail app bar (both themes) | **Approved** (Step 54C) | 2026-11-13 | `CROSS-THEME-CONSOLIDATION.md` §8; XS-31 | Cross-theme consolidation |
| XT-5 | **Pressed state: shared semantics, theme values** (D5): transient feedback on the whole target while pressed; no geometry, focus, selection or semantic change; no new animation, gesture, colour or state. Roles from the approved values: pressed row = `tray` (Dark) / Graphite 6% (Light); pressed control (icon button, Settings row and option, GP team link) = `raised` (both). GP classification rows (Dark Chalk 6%, drift XS-09) and every pressed appearance on a device stay **pending implementation validation** | All (both themes) | **Approved** (semantics; Step 54C) | 2026-11-13 | Inventory in `CROSS-THEME-CONSOLIDATION.md` §3.1 | Cross-theme consolidation |
| XT-6 | **Cross-theme visual specification frozen for implementation** (D6): `CROSS-THEME-CONSOLIDATION.md` and `CROSS-THEME-TOKEN-MAP.md`, consistent with `DARK-THEME-ROLES.md` and `LIGHT-THEME-ROLES.md` (cross-referenced from both) | All | **Approved** (Step 54C) | 2026-11-13 | Visual specification only: not Flutter implementation (XS-28 open), not Android accessibility certification or WCAG compliance. Open: LT-7 Live in context; XS-02, XS-05, XS-07, XS-11, XS-16, XS-25, XS-26, XS-28, XS-31, XS-32 | Cross-theme consolidation |
| SF-1 | **Production Standings status placement** (Standings only): title, season and the Drivers/Constructors selector stay pinned; the last-successful-check caption and the notices are the first item of the selected table's scrolling list, before the ranking rows in reading order. Independent table scroll positions kept; a background refresh never moves the user's position. Supersedes, for production Standings, the prototype's pinned status area (measured up to 78.5% of the viewport at 320dp/200%). Calendar's N-6 automatic positioning does **not** apply to Standings | Standings (Flutter) | **Approved** (Step 55C.5.1) | 2026-11-14 | Owner review of the Step 55C.5 report. Not a rule for other screens. Standings still awaits owner visual review | Standings Flutter decisions |
| SF-2 | **Freshness caption and header budget status:** the production resource-scoped timestamp logic is accepted (each table's own `lastSuccessAt`; "Refreshing…" while refreshing; nothing for a bootstrap-materialized table; never Home's or the other championship's time). PD-03 / STD-01 stay open for the remaining caption verification; no timestamp is invented for the staging reference. S-1 stays open pending Android device validation; the title-row release is not implemented. Measured pinned header 235px = 33.9% at 320dp/200% (flutter_tester, insets 0), pending real-device evaluation | Standings (Flutter) | **Approved** (Step 55C.5.1; PD-03, STD-01, S-1 and XS-06 remain open) | 2026-11-14 | `build/primer-review/55c5/metrics.md` | Standings Flutter decisions |
| SF-3 | **Fixed 40dp team-colour tick in production Standings:** XT-3 tick geometry (3px, 12°) at the prototype's position (6px into the link, 16px from its top) with Explore's fixed 40dp length instead of the prototype's row-stretching tick, which could overlap the position number or extend beyond the screen at large text. Original team colour kept; XT-3 conditional contrast boundary kept | Standings (Flutter) | **Approved** (Step 55C.5.1) | 2026-11-14 | Other team-mark variants (seam, bar, pinstripe, Explore tick) unchanged. STD-06 device and real-colour validation stays open | Standings Flutter decisions |
| EF-1 | **Production Explore status placement** (Explore only): title, season, the Settings action and the Drivers/Teams/Circuits selector stay pinned; the selected collection's last-successful-check caption, refresh progress line and failure / stale / combined N-2 notices are the first part of that collection's own scrolling list, before its rows in reading order. Independent, season-scoped category offsets kept; a refresh that starts, succeeds or fails never moves the rows on screen; switching categories, tabs or returning from Detail never resets a restored offset. Supersedes, for production Explore, the prototype's status under the selector (measured up to 73.4% of the viewport at 320dp/200%). The same usability principle as SF-1, recorded separately; N-6 does **not** apply to Explore; the S-1 / XS-06 title and selector scroll-away is not implemented | Explore (Flutter) | **Approved** (Step 55C.7.1) | 2026-11-15 | Owner review of the Step 55C.7 report. Measured after implementation: pinned header 287px = 41.4% at 320dp/200% and 160px = 19.0% at 390dp/100% in every status state (`build/primer-review/55c7/metrics.md`, flutter_tester, insets 0). Explore still awaits owner visual review | Explore Flutter decisions |
| EF-2 | **Explore stale-data wording:** staleness of the selected collection alone uses the established out-of-date notice `offlineStaleNotice` (Calendar, Standings) instead of `exploreCachedNotice`; refresh failure alone keeps `exploreUpdateFailed`; failure plus staleness of the same collection is the one N-2 notice (`refreshFailedStaleNotice`); unrelated resource failures never reach an Explore collection | Explore (Flutter) | **Approved** (Step 55C.7.1) | 2026-11-15 | Existing localized strings only; no ARB change. `exploreCachedNotice` stays defined and unused, as before Step 55C.7 | Explore Flutter decisions |
| EF-3 | **Temporary Explore media-column policy:** Alternative B kept. A collection with no authorized media reference renders no image column; a collection with at least one reserves the existing uniform 40dp slot on every row (decided from the read model before anything loads), with the existing stable placeholder for unavailable or failed images | Explore (Flutter) | **Approved for the present implementation** (Step 55C.7.1); **PD-16 remains open** for the eventual real-media layout | 2026-11-15 | Media pipeline, rights inventory, loader, cache, attribution and network behaviour unchanged; no real or generated F1 media | Explore Flutter decisions |
| EF-4 | **Explore loading skeleton follows the row layout:** two lines at the rows' text column (gutter + 16px accent lane), 76px rows, no image squares; with a media column, the 40dp slot at the gutter. While loading no card, and so no media reference, is known, so the deterministic policy gives no column; no speculative fetch or new state | Explore (Flutter) | **Approved** (Step 55C.7.1) | 2026-11-15 | Supersedes the states gallery's 48px squares (frame 8) for production Explore. Limitation: a future collection whose loaded rows have media would show no slot while loading (one reflow when it loads); the inventory is empty today | Explore Flutter decisions |

**Rejected by the owner:** N-5 (Calendar first-open toast and overlays,
2026-11-11), VS-2 (dagger on every Provisional indicator, 2026-11-12) and the
selected-label underline (DK-2, Step 51C review, 2026-11-12).
Design alternatives the designer considered and did not use (for example
selected-only nav labels, a navigation drawer, slanted Explore separators) are
recorded in the screen READMEs. They are not owner rejections.

## Settings information screens review (2026-11-08)

Status: the four visual compositions **Provisionally approved** (SI-01 to
SI-04). Differences not covered **Pending decision** (PD-19). Not a final
approval; no Flutter, copy or data change authorised. The prototype was not
changed by the review.

- **Evidence:** `settings/information/validation-20261108-211707/`. The owner
  reviewed the English screenshots and the Spanish screenshots at 390×844.
  Where the owner named what was seen, the record below says so; nothing
  else is counted as owner-reviewed.

| Screen | Owner-reviewed (390×844) | Automated evidence only |
|---|---|---|
| Data and updates | English D1 remote production (`en-data-390x844-01.png`), English D5 season unavailable (`en-data-season-unavailable-390x844-01.png`), Spanish D2 DEV bundled sample (`es-data-sample-390x844-01.png`) | D3 frozen and D4 unverified in both languages; Spanish D1 and D5; English D2; gallery frame 10 (Not configured); 320×693; 200% text |
| Acknowledgements | Spanish opening section (`es-acknowledgements-390x844-01.png`); English upper and lower sections (`en-acknowledgements-390x844-01.png`, `-02.png`); **Spanish lower section (`es-acknowledgements-390x844-02.png`), second review**: the complete Spanish 390×844 composition is provisionally approved | A2 frozen; 320×693; **320×693 at 200%** in both languages (`*-acknowledgements-320x693-text200-*`); gallery frames 1–8 (loading, unreadable record, empty record, media states, test-fixture sources, open failure). Not production-ready |
| Privacy and legal | English and Spanish compositions; the owner did not name scenarios | Any scenario not among the reviewed screenshots; 320×693; 200% text; gallery frame 9; the open-failure captures |
| App information | English and Spanish compositions | 320×693; 200% text |

**SI-01 Data and updates.** Visual composition provisionally approved in
English and Spanish. Keep the four data modes distinct: remote (GridView
service, offline explanation), bundled (sample or unverified, "does not
download updates"), frozen (capture date, "does not update") and unconfigured
("Not configured"). **Under review:** the offline explanation ("GridView keeps
the season on your device, so it opens and works without a connection") is
also shown when no local season is stored (D5), where it may not yet be true.
Flutter's `_explanation` checks only the data mode, not the season. Existing
behaviour, reported only (backlog SETT-16).

**SI-02 Acknowledgements.** Typography, spacing, hierarchy and overall visual
direction provisionally approved. All legal text, the provider attribution
and the three external links stay as they are. **Still open:**
- Commercial-use compatibility with CC BY-NC-SA 4.0 is an unresolved
  licensing and compliance issue, not a design decision. ADR 0019 conditions
  C2–C4 (free, no monetisation; any monetisation needs written permission or
  another provider and reopens the decision) and PRD §22.1 apply. Nothing in
  this approval clears commercial use (backlog SETT-18). The "automatic"
  status text describes operations, not licensing.
- The Data / Data source / Data sources heading hierarchy may be reviewed at
  design-system consolidation. No redesign requested (SETT-19).

**Second review, Spanish lower section (2026-11-08).** The owner reviewed
`es-acknowledgements-390x844-02.png` and provisionally approves the complete
Spanish 390×844 composition. Accepted: the legal links (Source project, Terms
of use, License), the licence presentation (name as value, full title as
description) and the empty media-attribution state ("Todavía no hay
atribuciones guardadas."). Spanish 320×693 at 200% remains automated evidence
only. The screen is **not** production-ready.

**"Source notice" stays in English on the Spanish screen: finding (SETT-20).**
The owner noticed that the value under "Aviso de la fuente" is English.
Investigated; nothing was translated or changed.
- The value is `warrantyDisclaimerNotice` in
  `content/attribution/data-sources.json`: "Jolpica F1 does not guarantee
  uptime, availability or correctness of the data." Only the label
  (`settingsSourceNotice`) is localized.
- Flutter renders it untranslated **by design**: `DataSourceAttributionCard`
  ("The source's own values — name, licence name and notices — are shown as
  published, never translated"), the record has no language variant, and ADR
  0019 holds attribution "as per-source data, not hard-coded strings". The
  schema describes the field as "a notice referring to the licensor's
  disclaimer of warranties (§3(a)(1)(A)(iv))".
- **It is not a verbatim quotation.** Jolpica's `TERMS.md` (the record's
  `termsUrl`, read 2026-11-08) says: "While we aim for stability and accuracy,
  we do not guarantee uptime, availability, or correctness of the data." and
  "Use is entirely at your own risk." The record's sentence is a third-person
  adaptation written when the record was created (commit `5d26ce5`,
  2026-09-28, "Jolpica's own warranty-disclaimer notice"). `TERMS.md` states no
  required attribution or notice text and offers no Spanish version.
- **Conclusion:** provider-derived legal text that GridView deliberately keeps
  as one published string, so it must not be translated in the client or the
  prototype. Whether a Spanish rendering, a verbatim quotation, or the current
  adaptation best satisfies the licence is a legal and content decision for
  the owner, outside this design work. `lang="en"` on the value (prototype
  difference 17) keeps screen-reader pronunciation correct meanwhile.

**SI-03 Privacy and legal.** English and Spanish compositions provisionally
approved, including:
- the existing "Privacy" / "Privacidad" section heading (`settingsPrivacy`,
  an existing ARB string; difference 9);
- the visual separation of the configured diagnostics policy, advertising and
  current-session reporting (session line after Advertising under a dashed
  rule; differences 10 and 11).

Conditional states stay as Flutter defines them: policy values by
`DiagnosticsPolicy`; session line only for the production policy and an
activation other than `notConfigured`; policy action only when configured;
missing-policy explanation only outside production; Advertising always
Disabled. **Still open:** the note's positional wording, "The line above…" /
"La línea anterior…", needs a bilingual content correction (it also appears
when no session line is shown). No legal or diagnostic copy may change without
examining the ARB strings (`settingsPrivacyDiagnosticsNote` in both files) and
the behavioural requirements behind them (backlog SETT-12).

**SI-04 App information.** English and Spanish compositions provisionally
approved without changes. Version and build continue to resolve dynamically
from package metadata (`appInfoProvider`, `PackageAppInfoReader`), omitted
when empty. The prototype's 1.2.1 / build 7 is the golden-test fixture and
must never be hardcoded.

### Flutter differences (`settings/information/README.md`)

| # | Difference | Classification | Rationale |
|---|---|---|---|
| 1 | Cards removed | **Covered** | SI-01 to SI-04 |
| 2 | Kicker section headings | **Covered** | SI-02, SI-03 |
| 3 | `dt` / `dd` field semantics | **Pending decision** | Not visible; XS-02 |
| 4 | Provider name as `h3` | **Covered** | SI-02 hierarchy |
| 5 | Notice text measure and leading | **Covered** | SI-02 typography and spacing |
| 6 | Supplied notices as prose | **Covered** | Source notice visible in the English lower section |
| 7 | One open-in-new glyph, no chevron | **Covered** (visual) | English lower section. The spoken cue stays open (SETT-11) |
| 8 | Licence tokens kept whole | **Covered** | English sections |
| 9 | "Privacy" section heading (`settingsPrivacy`) | **Approved** | SI-03 |
| 10 | Session line after Advertising | **Approved** | SI-03 separation; copy condition SETT-12 |
| 11 | Dashed rule above the session line | **Approved** | SI-03 separation |
| 12 | Diagnostics note style | **Covered** | SI-03 composition |
| 13 | Missing-policy explanation as a static row | **Pending decision** | Appears only in P4; the owner did not name the reviewed Privacy scenarios |
| 14 | Unreadable record as a Primer notice | **Pending decision** | Gallery only, not reviewed |
| 15 | Media empty text / loading without card | **Partly covered** | Known-empty text visible and accepted in the English and Spanish lower sections (second review); loading only in the gallery |
| 16 | Static skeleton | **Pending decision** | Gallery only |
| 17 | `lang="en"` on provider values | **Pending decision** | Not visible |
| 18 | Wrapping, uncapped app-bar title; S-2 single-word fit | **Partly covered** | Wrapping at 390 reviewed; the single-word fit appears only at 320 @200% (automated) |
| 19 | "Not available yet" in secondary weight | **Covered** | English D5 reviewed |
| 20 | Attribution links as `<a>`, policy as button | **Pending decision** | Semantics; SETT-02 |

## Settings review (2026-11-08)

Status: Settings root and the three preference screens **Provisionally
approved** (SP-01). Uncovered differences **Pending decision** (PD-18). The
information screens are a separate delivery (`settings/information/`,
PD-19), not covered by this approval. No Flutter change authorised.

- **Evidence:** `settings/validation-20261108-194048-final/` (the owner did
  not name individual files). The prototype was not changed by the review.
- **Approved for the visual prototype (provisional, SP-01):**
  1. The existing Flutter section grouping (Preferences; Data and
     application; Privacy and support; Developer outside production).
  2. Flat rows instead of cards.
  3. Clear current preference values.
  4. A reusable option-selection component (one component for the three
     screens).
  5. A selected state that does not depend only on colour (12° mark: shape,
     fill, check and weight).
  6. Immediate selection behaviour (no Save or Apply; the screen stays
     open).
  7. Restoration of the previous value after a failed save, with the
     existing message.
  8. Returning focus to the originating row after Back.
  9. Responsive headings (the wrapping, uncapped app-bar title).
- **Outstanding considerations (not approved, not changed in the
  prototype):**
  - Balance the prominence of preference labels and current values (SETT-03).
  - Validate selection semantics and keyboard behaviour with TalkBack, and
    avoid duplicate selected-state announcements (SETT-02).
  - **Owner preference:** keep the existing mail icon for Send feedback
    rather than the generic external-link arrow (difference 4 is therefore
    not approved; SETT-04).
  - The Primer V2 light theme remains unapproved and needs separate
    consolidation. The prototype's light preview is a labelled provisional
    mapping of `GvColorsLight` (XS-01).
  - Real persistence and Android behaviour are untested (SETT-05).
- **These approvals apply to the visual prototype only.** Approval of a
  visual direction closes no backlog item by itself.

### Flutter differences (`settings/README.md`, "Differences from Flutter")

| # | Difference | Classification | Rationale |
|---|---|---|---|
| 1 | Rows open on graphite, inset hairlines, no cards | **Covered** | Aspect 2 |
| 2 | Section headings as kickers with trailing rule (Developer dashed); `h2` kept | **Covered** | Aspect 1 (grouping and order unchanged) |
| 3 | Preference rows lead with the value | **Partly covered** | Aspect 3; the label/value balance stays open (SETT-03) |
| 4 | Send feedback: no leading mail icon, external arrow instead of the chevron | **Not approved** | Owner prefers retaining the mail icon (SETT-04). The prototype was not changed |
| 5 | Component catalogue icon removed | **Pending decision** | Not addressed in the review |
| 6 | Selected state: 12° mark + weight; `aria-checked` only, no ", Selected" suffix | **Partly covered** | Visual state is aspect 5; the single announcement needs TalkBack validation (SETT-02); `settingsSelected` would become unused (SETT-07) |
| 7 | Option explanation as accessible description | **Pending decision** | Not visible; SETT-02 |
| 8 | Keyboard model (one tab stop, arrows move focus only) | **Pending decision** | SETT-02 |
| 9 | Focus returns to the originating row | **Covered** | Aspect 8 |
| 10 | App-bar title is the page `h1`, wraps, 21px, uncapped | **Covered** | Aspect 9 |
| 11 | Environment badge style (dashed pill) | **Pending decision** | Not addressed |
| 12 | `lang` on English / Español | **Pending decision** | Not visible |
| 13 | Width-axis narrowing before wrapping | **Pending decision** | No Flutter equivalent yet (SETT-09) |
| 14 | Root rows as links (web) vs buttons (Flutter) | **Pending decision** | Semantics; SETT-02 |

## Explore review (2026-11-08)

Status: visual direction **Provisionally approved** (EX-01). Alternative B
**Provisionally approved** as the preferred visual reference (EX-02, below);
it settles PD-17 and part of PD-16. The per-list media-column policy stays
**Pending decision** (PD-16). **Not production-ready**; no Flutter change
authorised.

- **Evidence reviewed by the owner:** the Explore Drivers, Teams and Circuits
  screens in English and Spanish (current run
  `explore/validation-20261107-233303-final/`; the owner did not name
  individual files). The prototype was not changed by the review.
- **Accepted for the visual prototype (provisional, EX-01):**
  1. Season-aware header.
  2. Three-category selector.
  3. Driver identity hierarchy.
  4. Race numbers and short codes.
  5. Explicit Position and Points labels.
  6. Team line-up codes.
  7. Team-colour accents.
  8. Circuit names, locations and lengths.
  9. Existing conditional omission of missing values.
  10. English and Spanish layout.
- **These approvals apply to the visual prototype only.** They do not mark
  Explore as production-ready and do not authorise Flutter changes.

### Flutter differences (`explore/README.md`, "Differences from Flutter")

| # | Difference | Classification | Rationale |
|---|---|---|---|
| 1 | Labelled data line ("Position 2 · Points 402.5") | **Covered** | Aspect 5 |
| 2 | Team row: line-up codes on their own line, labelled data on another | **Covered** | Aspects 5 and 6 |
| 3 | Circuit row: length as the right-hand figure, location and event on their own lines | **Covered** | Aspect 8 |
| 4 | Fuller accessible names | **Pending decision** | Not visible in screenshots; PD-07 / XS-04 |
| 5 | 48px image slot (Flutter 40px) | **Pending decision** | Tied to the missing-media question (PD-16) |
| 6 | Wrapping instead of truncation | **Covered by EX-02** (visual prototype) | The owner approved natural name wrapping as an element of Alternative B. Caveat: the fixture names fit on one line at 390, so wrapped names appear only in the 320dp and 200% captures, which have automated evidence only (EXP-06). Flutter `maxLines: 1` would change on implementation (XS-18) |
| 7 | Second-level header budget | **Pending decision** | Large-text behaviour, not in the reviewed screens; XS-06 |

### Alternative B approval (EX-02, 2026-11-08)

Status: **Provisionally approved** as the preferred visual reference for
Explore. Not production-ready; no Flutter change authorised.

- **Reference files:** `explore/comparison-missing-media/cue.html` and
  `cue.es.html` (Alternative B), generated by
  `explore/comparison-missing-media/build.py` from the baseline generator's
  own output. Evidence: `explore/comparison-missing-media/validation-20261108-202406/`
  (`after-b-*`).
- **Evidence reviewed by the owner:** Alternative B's Drivers, Teams and
  Circuits in **Spanish**. **Not individually reviewed by screenshot:**
  English, 320dp and 200% text. They have automated validation only (76
  capture runs, layout, behaviour, data and Impeccable checks, 0 problems).
  That distinction is kept (backlog EXP-06).
- **Approved elements (provisional):**
  1. No repeated generic placeholder tiles when a list has no media
     references.
  2. Subtle navigation chevrons on Drivers, Teams and Circuits rows (the
     existing Standings/Calendar chevron).
  3. The existing category selector.
  4. The existing information hierarchy.
  5. Driver race numbers and short codes.
  6. Explicit Position and Points labels.
  7. Team identity and line-up information.
  8. Team-colour accents.
  9. Circuit lengths.
  10. Natural name wrapping.
  11. The existing conditional omission of missing values.
- **Kept unchanged, not overwritten:** the original baseline (`explore/`),
  Alternative A (`index[.es].html` in the comparison folder) and Alternative
  B. The generators and sources were not changed. Migration into shared
  Flutter components happens at implementation.
- **Still open, not approved by EX-02** (PD-16, backlog EXP-04): the proposed
  per-list media-column rule and everything it touches: mixed lists with and
  without media; loading and failed media; layout stability when references
  change after synchronization; final image-slot size (Flutter 40px,
  prototype 48px: EXP-01 difference 5); accessibility of informative images;
  approved media licensing (XS-15); real-device validation (XS-16). EXP-01
  differences 4, 5 and 7 stay open.
- **Shared design-system consideration (not a redesign of Explore):** Team
  Detail's TM-03 adds a Chalk edge when a team colour is below 3:1 against
  graphite. Explore's 12° accent tick renders the supplied colour with no
  edge; the fixture's `#1E41FF` is 2.83:1 on `#141518` (`#0093CC` 5.26:1,
  `#FF8000` 7.25:1). The tick is never the only identity carrier (the team
  name is text), so it is not a WCAG 1.4.11 failure, but the two screens
  treat the same colour differently. Whether one team-colour contrast rule
  applies to every accent (Explore tick, Standings tick, Driver and Team
  accents) is recorded for consolidation (backlog XS-25). Explore was not
  changed.

### Open design questions

**Missing media (PD-16, backlog EXP-04).** Partly settled by EX-02: a list
with no media reference shows no tiles. The proposed collection-level rule in
`explore/comparison-missing-media/README.md` (column decided per list from
the read model; quiet loading square; failed keeps its size and shows the
icon; empty cell for no reference) is **not** approved; the open points are
listed above.

**Row navigation (PD-17, backlog EXP-05).** Decided by EX-02: Explore rows end
with the Standings/Calendar chevron. Targets, focus, pressed state and
accessible labels are unchanged from the baseline; TalkBack and device
validation remain (EXP-05 stays open as Accepted pending validation).

## Circuit Detail review (2026-11-08)

Status: visual direction **Provisionally approved** (CR-01, CR-02, CR-03).
Uncovered differences **Pending decision** (PD-13, PD-14, PD-15).

- **Evidence reviewed by the owner:** the English complete, partial and
  no-event screenshots in `circuit-detail/validation-20261108-171413-final/`
  (`en-a-*`, `en-b-*`, `en-c-*`). The folder and the prototype were not
  changed by the review.
- **Not visually reviewed:** the Spanish pages, 320dp, 200% text and the
  states gallery. They have automated evidence only (28 capture runs, layout,
  data and Impeccable checks, 0 problems). Final visual and device review
  remains open (backlog CIR-03, XS-05, XS-16).
- **Approved for the visual prototype (provisional, CR-01):**
  1. An editorial circuit identity header.
  2. A prominent circuit name and location.
  3. A technical presentation of circuit length.
  4. Grouped physical circuit facts.
  5. A distinctive lap-record presentation.
  6. A season-scoped related Grand Prix section.
  7. A compact related-event navigation row.
  8. A valid no-related-event presentation.
  9. An image-free composition that can take approved media later.
- **These approvals apply to the visual prototype only. They do not
  authorise changes to Flutter behaviour or data contracts.**

### Flutter differences (README "Differences from Flutter")

Covered 7; approved with conditions 1, 2, 3, 5; partly covered 4, 6;
pending 8, 9, 10. Nothing was approved by default; only what is visible in
the reviewed English screenshots counts as reviewed.

| # | Difference | Classification | Rationale |
|---|---|---|---|
| 1 | Hero card → circuit sheet; no hero or route icon without an asset; slot below the location when an asset exists | **Approved with conditions** | Covered by aspects 1 and 9 and CR-02. Conditions: approved layouts and photographs stay supported (available, loading, failed); the 16:9 slot is reserved whenever an asset is selected (no layout shift); a layout diagram keeps its informative label. The slot was shown only in the states gallery (frames 15, 16, geometry only), which was not reviewed |
| 2 | Circuit facts inside the sheet under a kicker `h2`; `GvInfoCard` and section-title styling replaced | **Approved with conditions** | Grouping visible in the reviewed Scenario A (aspects 1, 4). Conditions: the `h2` semantics and the section order (facts → lap record → related Grand Prix) stay. The kicker reads a visual level below the other `h2`s; that hierarchy point stays open for polish (CIR-06) |
| 3 | Length as a dimension line; other facts as a figure row; decorative rotate glyph | **Approved with conditions** | Aspects 3 and 4, CR-03. Conditions: words and values unchanged; the glyph stays decorative and appears only for the two known directions; a null direction stays omitted. Scale ambiguity (CIR-05) and the 320dp wrap (CIR-06) stay open |
| 4 | Lap record as a timing readout; unavailable holder in secondary style | **Partly covered** | The readout is aspect 5 (reviewed in A and C). The secondary "Driver unavailable" style appears only in states frames 9 and 10, not reviewed (CIR-01). The gates (time or year; holder row only with an id; no link) are unchanged |
| 5 | Related event card → row link (round figure, oxide seam, Chalk disc); "Round N · date" split | **Approved with conditions** | Aspect 7. Conditions: destination stays `openEntity(/calendar/{season}/{round})` with the event's own season; the unnamed fallback keeps the link; loop collapse unchanged (XS-19). The narrow-layout reflow at 200% was validated by automation only (CIR-03) |
| 6 | Season line in the related state as well (Flutter: no-event state only); no year in the header | **Partly covered** | The placement inside the season-scoped section (aspect 6) is visible in the reviewed A and C screenshots. Printing the year where Flutter does not is a content difference. DR-02 (provisionally approved for Driver and Team, header placement) does not decide it for this placement; it stays open in CIR-01. Historical wording: CIR-04 |
| 7 | No-event card → season line + statement row | **Covered** | Aspect 8, reviewed in B and C. Copy unchanged. Whether the statement is true when the calendar is not stored locally is Flutter behaviour, tracked separately (PD-14, CIR-02) |
| 8 | Event link keeps "Open {name}" and adds a description (round, date, status, format) that Flutter excludes | **Pending decision** | Screen-reader change, not visible in screenshots. Part of PD-07 / XS-04 |
| 9 | Unnamed event name in secondary style | **Pending decision** | Conditional state shown only in states frame 11, not reviewed (CIR-01) |
| 10 | Skeleton shape (sheet block, labels, rows) | **Pending decision** | Not reviewed; same open item as Driver 9 and Team 11 (CIR-01) |

### Outstanding questions

**Technical length indicator (CR-03).** The dimension line is provisionally
accepted and kept unchanged. It could be read as a proportional scale: the
arms always fill the width, whatever the length. Recorded as a visual
validation issue for final consolidation (CIR-05). Not redesigned.

**Historical season wording (PD-15, CIR-04).** "This season's Grand Prix" /
"El Gran Premio de esta temporada" and "No Grand Prix this season" / "Sin
Gran Premio esta temporada" are relative to the season shown. Grand Prix
Detail hands over the event's own season, so they appear on a past season
whenever a past-season event is the origin. Whether any 2.0.0 entry point
opens a past-season event was not verified.
- Existing strings checked (`app_en.arb`, `app_es.arb`): the only one that
  names a season is `seasonLabel` ("{season} season" / "Temporada
  {season}"). `grandPrixTitle` ("Grand Prix" / "Gran Premio") is the only
  season-neutral Grand Prix label. No existing string states "no Grand Prix
  in {season}".
- **Recommendation:** use `grandPrixTitle` as the section heading with the
  `seasonLabel` line under it, in both states (the prototype already shows
  the line). The heading then names no relative season, and the line names
  the exact one. Caveat: `grandPrixTitle` is described in the ARB as a
  screen title, so reusing it as a section heading needs the owner's
  agreement.
- The no-event statement keeps "this season". Directly under the season line
  it reads as that season. A fully explicit statement would need new copy
  (owner and translator); none was written. Flutter copy unchanged.

**No related Grand Prix (PD-14, CIR-02).** Checked against the code:
`calendar_dao.dart` `circuitProfile`, `circuit_detail_screen.dart`
`_relatedGrandPrix`, `circuit_detail_providers.dart`,
`circuit_repository_impl.dart` `refreshCircuit`, `detail_dto.dart`
`CircuitDetailDto`, contract `CircuitDetail`.

| Case | Flutter domain and state | Flutter UI | Prototype |
|---|---|---|---|
| Confirmed absence: the season's calendar is stored and has no event at this circuit | `relatedGrandPrix == null` (earliest local `grandPrixEvents` row for season + circuit) | Season field + "No Grand Prix this season" | Scenario C: season line + statement, no card, no link. **Preserved** |
| Unavailable or insufficient data: the season's calendar is missing or incomplete locally | Also `relatedGrandPrix == null`. The profile reads only local calendar rows. `refreshCircuit` parses the contract's `grandPrix` field but stores only `circuit`. Freshness and the partial notice come only from `circuit:<id>:<season>`, never from the Calendar | The same statement. Indistinguishable from a confirmed absence | Same as Flutter (Scenario B shows the partial notice plus the statement, as the golden does). The prototype **cannot** make a distinction the domain does not provide, and it does not invent one |
| Season cannot be resolved: no origin season and no local current season | `EntityDetailSeasonUnavailable`; no profile is requested | "Season unavailable" + retry | States frame 2. **Preserved, separate** |

Also separate and preserved: circuit not found (missing row or unresolved
stub, frame 3) and first-load error (frame 4). The middle row is reachable by
construction (separate Calendar and circuit resources); it was not
reproduced on a device. It is existing Flutter behaviour, reported only.

**Missing circuit images (CR-02).** The typography-based fallback is
provisionally approved. The implementation must keep support for approved
circuit layouts and photographs (`MediaSlotPolicy.circuitLayout`: layout,
then hero, then thumbnail). An informative diagram keeps a meaningful
description (`circuitLayoutImage`, "Track layout of {circuit}"); a photograph
stays decorative. No imagery was or may be generated, downloaded or
invented. Media is validated by geometry only (XS-15). The unused
`circuitLayoutPlaceholder` string is CIR-08.

## Team Detail review (2026-11-08)

Status: visual direction **Provisionally approved** (TM-01); refinement
**Provisionally approved** (TM-02, TM-03; owner confirmation 2026-11-08).
The owner has not yet visually inspected the refinement screenshots, so final
visual validation remains outstanding. Not a final approval; no Flutter change
authorised.

- **Evidence reviewed:** `team-detail/validation-20261108-150419-final/`
  (kept unchanged).
- **Approved for the visual prototype (provisional):** season-aware
  typographic team banner; stable constructor identity when distinct;
  optional team-colour accents; three-figure championship; compact driver
  line-up rows; one row per participation span; spec sheet; image-free
  composition with future media support; existing section order
  (Championship before Drivers).
- **These approvals apply to the visual prototype only. They do not
  authorise Flutter changes.**
- **Differences:** covered 4, 5, 6; approved with conditions 1 (media support
  retained) and 8 (never the only identity carrier, non-text contrast met);
  partially covered 2 (season line shares DR-02) and 9 (About); still
  requiring a decision 3, 7, 10, 11. Table in `team-detail/README.md`.
- **Refinement** (`team-detail/validation-20261108-152827-refinement/`):
  line-up order now reproduces `_byRosterOrder` (numbered first, race number,
  name, start round; V-02); observed spans in Ember so a hand-over reads as a
  pair when rows are not adjacent; stable name announced as "Team: Alpine"
  (TM-02); Chalk edge for colours below 3:1 (TM-03). Null/null entries
  verified: the row stays, with no span (Team Detail's `hasObservedBoundary`
  rule); the partial banner has no fixed height.

## Driver Detail review (2026-11-08)

Status: visual direction **Provisionally approved** (DR-01). Targeted
refinement **Provisionally approved** (DR-02, DR-03; owner confirmation
2026-11-08). The owner has not yet visually inspected the refinement
screenshots, so final visual validation remains outstanding. Not a final
approval; no Flutter change authorised.

- **Evidence reviewed:** `driver-detail/validation-20261108-124338-final/`
  (Scenario A complete and Scenario B partial, English and Spanish). That
  folder is kept unchanged as the reviewed version.
- **Approved for the visual prototype (provisional):**
  1. Expressive driver identity plate.
  2. Large competition-number treatment.
  3. Current constructor within Season participation.
  4. Championship statistics using the existing numerical hierarchy.
  5. Compact personal information and biography sections.
  6. A typography-based composition that works without a portrait.
  7. Partial-data presentation without invented values.
- **To be preserved:** graphite and Chalk surfaces, Red Oxide identity board,
  Archivo, the 12° diagonal, constructor accent, championship hierarchy, team
  and standings navigation, profile facts and biography, image-free fallback.
- **These approvals apply to the visual prototype only. They do not
  authorise Flutter changes.**
- **Conditions:** approved driver portraits must still be supported where
  available (available, loading, missing, failed). Only geometry is validated
  (backlog XS-15).
- **Flutter differences:** of the nine delivered, 1, 3 (team merge), 5, 6 and
  8 are covered by this approval; 4 is partly covered (layout yes, visually
  hidden labels no); 2, 7, 9 and the section order in 3 were not reviewed and
  stay **Pending decision** (PD-11, PD-06). Per-item table in
  `driver-detail/README.md`. Nothing was approved by default.
- **Refinement requested in the review and delivered** (2026-11-08,
  `driver-detail/validation-20261108-141921-refinement/`):
  - **DR-02 season line:** "2026 season" / "Temporada 2026" above the name,
    from the existing `seasonLabel` string and the ready state's season
    (origin season or locally resolved; never hardcoded or inferred from the
    date). Visually secondary (Grand Prix Detail's season-line type). Season
    unavailable unchanged.
  - **DR-03 number source:** the board is labelled "Race number" / "Dorsal de
    la temporada" for the season number, or "Permanent number" / "Dorsal
    permanente" when Flutter falls back to the permanent number. Screen
    readers hear the same label. Nothing replaced, removed or invented.
  - Both are new differences from Flutter (10 and 11). Their provisional
    approval covers the visual prototype only; the implementation delta stays
    in backlog XS-18.
- **Localization finding:** the English nationality, birthplace and biography
  on the Spanish pages are API-provided free text (the contract has no
  language variant). Flutter renders them the same way; the prototype
  translates nothing. The remaining gap is backlog XS-23.

## Grand Prix Detail: results scenario review (2026-11-08)

- **Evidence:** the owner reviewed the Italian Grand Prix results screenshots
  in English and Spanish (`grand-prix-detail/validation-20261108-112100-final/`
  `en-b-*.png`, `es-b-*.png`).
- **Outcome:** the visual composition of the results scenario is
  **provisionally approved**. The prototype was not modified.
- **Not closed by this review:**
  - Driver-link discoverability (GPD-04).
  - Independent driver and constructor actions (GPD-05).
  - Full-classification density (XS-13).
  - Accessibility and TalkBack (XS-02).
  - Real-device validation (XS-16).

## Grand Prix Detail review: approved for the visual prototype (2026-11-08)

Status per item (index G-1 to G-9): 1, 6, 9 **Approved**; 2, 3, 4, 5, 7, 8
**Approved with conditions** (the conditions are part of each item).

These approvals apply to the visual prototype only. **They do not authorize
Flutter implementation changes.** The prototype was not modified as a result
of this review.

1. **Dates and location once.** They may appear once (the header's fact rail)
   instead of in both the header meta line and the factual card (audit GP06,
   GP07).
2. **Time zones in the Sessions section.** Allowed provided the original
   conditional visibility still holds when the session list is empty: the
   event time zone appears only when present (GP12), and the device time zone
   always (GP13).
   - Verified in the prototype: `states.html` frame 11 ("Weekend with no
     sessions") shows both time-zone fields above "Schedule not available".
   - Frame 6 shows the event zone omitted when absent.
3. **Circuit card → compact navigation row.** Keeps the circuit name (GP11)
   and the existing navigation:
   - `openEntity()` to `/circuits/:circuitId` with the event's season.
   - Available when the name is unresolved (GP17; frame 7).
4. **Sessions grouped by day, time first.** Delivered session order must be
   preserved. Grouping is run-length only: consecutive sessions sharing a
   primary day label share one header, and nothing is re-sorted. Accessible
   descriptions must be preserved: every session still exposes its name,
   status, primary time and zone, and any secondary time. The prototype's
   reading order is time → name → status. Flutter's is name → day · status →
   time; confirm at implementation.
5. **Visible "Winner" label** only when the existing classification semantics
   establish a winner:
   - The `home_race_winner.dart` rule: a race document with exactly one
     `position == 1` entry whose driver name is resolved.
   - Never for sprint documents, tied P1s, or an unresolved P1 (frame 24).
6. **Points with the localized "pts" unit** (`homePointsValue`). Missing
   points stay omitted, never shown as 0.
7. **Finish status and fastest lap as accessible chips:**
   - Every existing value is preserved: Lapped, DNF, DNS, DSQ, DNQ, Status
     unknown, and the fastest-lap badge.
   - The conditional rules are preserved: "Finished" stays hidden visually
     but remains in the row label. The fastest lap comes from
     `entry.fastestLap` or the document's fastest-lap driver. Timing
     precedence is elapsed → gap → laps behind > 0 → supplied text.
8. **Driver and constructor navigation in one row.** The two must remain
   separate, accessible interactive destinations:
   - The row opens the driver with Flutter's row label.
   - The team link is its own ≥48px target labelled "Open team {name}", or
     "Open team" when the name is unresolved.
9. **Long names wrap** instead of being routinely truncated (same as
   Standings decision 4).

## Grand Prix Detail: sprint-results scope discrepancy (open, resolve before implementation)

Status: race-only scope **Approved** (P-01); renderer discrepancy **Pending
decision** (PD-01, backlog GPD-02).

- **Accepted 2.0.0 requirement:** race results only (PRD §9.3 owner decision
  2026-10-21; audit §6.6).
- **The full weekend schedule stays available,** including Sprint and Sprint
  Qualifying *sessions* (Scenario A shows them as schedule rows).
- **Retained client renderer:** `grand_prix_results_section.dart` still
  renders sprint and other classification types as separate sections
  ("Sprint results" / generic "Results").
  `test/screens/grand_prix_widget_test.dart` ('sprint and race
  classifications coexist and stay separate') pins that behaviour.
- **This design exercise does not remove or modify that support,** and no
  Sprint results appear in the approved 2.0.0 visual scenarios or the states
  gallery.
- **Needs explicit resolution before implementation** (audit §8.1, §8.4
  item 1): either the renderer is retained but unreachable for 2.0.0 data, or
  the release scope is revisited. No decision is implied here.

## Grand Prix Detail: blank Grand Prix name (verified 2026-11-08)

Status: app bar verified and closed (V-01); hero heading **Pending decision**
(PD-02, backlog GPD-03).

- **App bar (GP01): confirmed, concern closed.** `grandPrixScreenTitle()` in
  `lib/features/calendar/presentation/grand_prix_detail_screen.dart` returns
  the trimmed event name when the detail is ready and the name is non-blank.
  Otherwise it returns `l10n.grandPrixTitle` ("Grand Prix" / "Gran Premio").
  - Introduced by PR #103: merge commit `46f621b`, 2026-11-04,
    `fix/grand-prix-title-names-race`. It is an ancestor of the current
    branch HEAD.
  - Tested by 'a blank stored name falls back to the localized label' and
    'a blank stored name falls back in Spanish'.
  - Documentation and implementation agree.
- **Hero heading (GP02): residual gap, reported only (Flutter not modified).**
  `grand_prix_hero.dart` renders `Text(view.grandPrix.name)` directly.
  - PR #103 did not touch the hero; its last change is `5ab1202`, 2026-08-12.
  - The API contract allows a blank name: `GrandPrix.name` is
    `type: string` with no `minLength` in `docs/api/gridview-api-v1.yaml`.
  - So a blank stored name would give the app bar "Grand Prix" while the
    hero shows an empty heading.
  - `grandPrixNameUnavailable` ("Grand Prix name unavailable") exists and is
    used by Circuit detail, but not here.
  - The prototype does not render this case. Decision needed before
    implementation.

## Grand Prix Detail: outstanding visual issues (for later review)

Tracked in the backlog as XS-14 (long official names), XS-13 (about 20
participants), XS-11 (unknown session status), GPD-06 (date range), XS-01
(light theme), XS-16 (device), XS-02 (TalkBack), GPD-05 (independent
actions). The driver-affordance review is GPD-04.

None of these may be addressed by creating new fictional production data;
each needs an existing fixture or real data.

- Long official Grand Prix names (no fixture has one beyond "Formula 1 Mock
  Belgian Grand Prix 2026").
- Race classifications with about 20 participants (Scenario B's fixture has 3
  rows; the largest existing fixture has 6).
- Visual differentiation of unknown session statuses ("Status unknown" is
  plain secondary text and reads much like "Scheduled").
- Date-range formatting consistency: Flutter's range is `MMMd – MMMEd`, so
  only the end carries a weekday ("Jul 24 – Sun, Jul 26"), while session day
  headers use `E MMMd` ("Fri Jul 24").
- Light theme.
- Real-device testing.
- TalkBack and accessibility semantics (reading order, row and team-link
  labels, the `aria-hidden` visual row content).
- Correct rendering of independent driver and constructor actions:
  - Overlay row link plus a separate team link in the prototype.
  - Hit areas, focus order and hover/pressed states need device
    verification.

## Standings review: accepted for design-system consideration (2026-11-07)

Status per item (index S-1 to S-5): 1 **Approved with conditions** (validation
before any Flutter change); 2–5 **Provisionally approved**. "Accepted for
design-system consideration" is not final approval.

1. **Adaptive large-text header** (`standings/standings.js`, header budget):
   - Accepted pending validation before Flutter changes.
   - Under it, the app bar row scrolls away when the pinned area would exceed
     25% of the viewport, and only the selector bar stays pinned.
   - Flutter's fixed header is unchanged until validated.
2. **Long screen titles:**
   - A single unbreakable word narrows Archivo's width axis (118 → 100 → 84 →
     72) before it is scaled down.
   - Candidate to replace Calendar's `14cqi` cap in the shared app bar.
3. **Adaptive bottom-navigation labels** without arbitrary text-scaling
   limits:
   - regular → condensed → stacked layouts.
   - When needed, the selected label falls back to `wdth` 62 at weight 700.
4. **Long driver and constructor names wrap** when necessary instead of being
   routinely truncated. Flutter's current `maxLines: 1` + ellipsis on
   standings rows would change on implementation.
5. **The visible "Championship leader" / "Tied for the championship lead"
   label is kept.** It shows an existing ranking interpretation (confirmed
   `position == 1`), using existing ARB copy. It adds no API data.

The Standings prototype was not modified as a result of these decisions.

## Outstanding: Standings last-successful-check caption

Status: **Pending decision** (PD-03, backlog STD-01).

**Step 55C.5.1 (2026-11-14):** still pending for the remaining verification.
Production Standings implements the per-table caption below in the
scrolling status block (SF-1) and the owner accepted its resource-scoped
timestamp logic (SF-2). The populated table with the caption and with
"Refreshing…" was captured from fixtures (`build/primer-review/55c5/`), and
the pinned header measured 33.9% at 320dp/200%. No staging timestamp is
invented.

**Question.** The original Standings screen shows the last successful check
time when available. The new Standings screenshots do not show it.

**Finding** (from `lib/features/standings/presentation/standings_screen.dart`
`_TableStatus`, `lib/features/standings/application/standings_state.dart`
`computeStandingsTableState`, and audit ST16/ST17 and §4.3):

1. **The caption exists and is per table.** It reads "Last successful check:
   HH:mm" (device-local `DateFormat.Hm`). It is shown only when the
   *selected* table's own resource metadata has `lastSuccessAt`. While
   refreshing, "Refreshing…" replaces it.
2. **Its source is strictly limited.** `lastSuccessAt` comes only from that
   table's own `ResourceSyncState`:
   - Never from the bootstrap record. A bootstrap-materialized table presents
     the bootstrap's *freshness* (stale or not) but "claims no update time".
   - Never from the other championship's record.
   - Never from Home.
3. **For the chosen data state, the omission is correct.** The frozen staging
   dataset (`shared-reference-data.md` and the values the owner supplied for
   Standings) has no Standings check time. The only confirmed time, "4:22",
   is H42, the Home resource's own check, so borrowing it would break the
   rule above.
4. **Presentation coverage exists, but only partly.**
   - `standings/states.html` fixtures 10–11 render the caption
     ("Last successful check: 09:05", the test fixture's 09:05 UTC) together
     with the stale/failed notices.
   - What no capture shows is the caption **together with populated rows** in
     the main screen layout, nor how much pinned height it adds under the
     selector.

**Open items for consolidation:**
- Confirm whether the original staging Standings screenshot showed a check
  time. If it did, add the value and its table to `shared-reference-data.md`
  with provenance. Only then render it on the main Standings page.
- Capture the populated table with the caption (and with "Refreshing…") to
  measure the pinned-header cost at 320 @200% under the header budget.

## Calendar title-fit review (2026-11-10)

Status: **visually approved for the experimental design direction** (CT-01).
Prototype approval only.

- **Reviewed:** the Step 48B experiment
  (`cross-screen-refinement/calendar-title-fit/`), English and Spanish at
  320×693 with 200% text, including the stale and refresh-failed states.
- **Approved:** the 34px adaptive title. English keeps the full width
  (`wdth` 118); Spanish narrows to `wdth` 100. Both stay on one line with at
  least 12px before the actions; header height unchanged.
- **Retained:** the shared title-fit implementation (`shared/title-fit.js`),
  which Standings and Explore pilots already load with zero differences.
- **Not approved, still open:**
  - Flutter implementation. The width axis needs Archivo `wdth` through
    `FontVariation` or a fallback (SETT-09); Flutter's AppBar ellipsizes.
  - Android device and TalkBack validation.
  - XS-07 (title fit) and XS-06 (header budget) keep their backlog
    statuses. The approved `calendar/` prototype and the Calendar
    consolidation pilot are unchanged.
- **Next:** the Calendar sticky-header split experiment
  (`cross-screen-refinement/calendar-sticky-split/`, Step 48C) starts from
  this variant. Owner-reviewed on 2026-11-10: see CT-02 below.

## Calendar sticky-header split review (2026-11-10)

Status: **provisionally visually approved as the preferred direction**
(CT-02). Prototype approval only. This does not authorise any Flutter change,
and the original approved Calendar prototype is not modified.

- **Reviewed** (`cross-screen-refinement/calendar-sticky-split/`, Step 48C,
  before/after against the title-fit variant):
  - Spanish stale data, mid-list, 320×693 @200%;
  - English refresh failure, round 22 focused, 320×693 @200%.
- **Approved direction:**
  - The season row stays pinned.
  - The last-check caption, the stale notice and the refresh-failure notice
    scroll with the content.
  - The adaptive title (CT-01) is retained.
  - Focused race rows must not be hidden by fixed interface elements.
- **Still outstanding:**
  - Android device and TalkBack validation, and functional validation in
    Flutter.
  - The off-screen status cue, the landscape acceptance criteria, the
    title-row release rule and the C13/C15 contract change. Recommendations
    for each are in `calendar-sticky-split/DECISIONS-48D.md` §6, as owner
    decisions.
  - XS-06, XS-07 and every accessibility item keep their backlog statuses.

## Calendar Stage 1 direction (2026-11-10, Step 48E; approved 2026-11-11, Step 48F)

Status: **provisionally approved as the preferred Calendar visual and
interaction direction** (CT-03, 2026-11-11). Stage 1
(`cross-screen-refinement/calendar-stage1/`) is the preferred reference.
Prototype approval only: the complete Calendar behaviour is **not**
production-ready, no Flutter work is authorised, and Stage 1 is **not**
promoted into the approved `calendar/` source.

- **Reviewed (Step 48F):** the six critical screenshots in
  `calendar-stage1/REPORT.md` §6:
  - Spanish stale-data notice, 320×693 @200%;
  - English refresh failure with round 22 focused by keyboard, 320×693 @200%;
  - landscape 693×320 @200%, Stage 1 against Stage 2.
- **Why Stage 1:** it keeps the complete title and the season context,
  substantially increases the list space (61.4% at 320 @200% in every state),
  and keeps focused race rows reachable by scrolling. Stage 2's extra 44px in
  landscape does not justify its partly hidden title and more complex
  scrolling.
- **Stage 2** (`calendar-sticky-split/`) stays as historical exploration,
  unchanged. So do the approved `calendar/` baseline, the pixel-identical
  consolidation pilot, the title-fit experiment and all evidence.

- **Title row:** the title, Refresh and Settings stay pinned. The adaptive
  title (CT-01) is kept.
- **Season row:** stays pinned.
- **Status:** the last-check caption and the stale and failure notices move
  into the scrollable content. This is an **intentional change** from the
  current Flutter presentation, where they sit in a fixed header (C13/C15).
- **Copy:** the full status messages and the existing English and Spanish
  strings are kept. No new copy.
- **Dynamic title release:** stays an optional future refinement (Stage 2,
  `calendar-sticky-split/`), not part of this direction.
- **Still open** (not closed by this approval):
  - Android system bars and system font scaling;
  - TalkBack reading order and dynamic announcements;
  - focus and scrolling on real devices;
  - Flutter scroll restoration and race-index mapping (`CalendarScrollAnchor`);
  - the cue for failures that occur while the notice is off-screen;
  - feedback after a user-initiated refresh whose notice is off-screen:
    **unresolved** (XS-19). The conditional snackbar named here is
    superseded by N-5: the first-open toast and every tested Calendar
    overlay were rejected, and no snackbar or toast is approved;
  - keeping known stale data and refresh failure clearly distinguished;
  - XS-06, XS-07 and every existing accessibility issue, which keep their
    backlog statuses.
  Device tests: `DECISIONS-48D.md` §5. The existing status strings are kept.

## Event-absence decisions (2026-11-11, Step 49B.1)

Status: two **accepted functional directions** (CR-04, HM-01), after the
owner's review of `STATUS-ABSENCE-DECISIONS.md`, both **visually approved for
future implementation** on 2026-11-11 (Step 49B.2). Neither is implemented in
Flutter; both are pending Flutter behaviour and test validation. The approved
Home and Circuit Detail prototypes and their consolidation pilots are
unchanged.

Owner-reviewed screenshots (before and after, Step 49B.2;
`STATUS-ABSENCE-DECISIONS.md` §7):
- Spanish Home, 320×693 @200%;
- Spanish Circuit Detail, partial profile, 320×693 @200%;
- English Circuit Detail, unknown event association, 390×844 @100%.

- **CR-04, Circuit Detail (CIR-02):**
  - a stored linked event is shown;
  - "No Grand Prix this season" is shown only when that exact season's
    calendar is confirmed complete;
  - when completeness is not established, only the absence block is omitted.
    No new copy;
  - completeness refers to the selected season only; an empty local event
    query is never evidence of absence.
  - Experiment: `cross-screen-refinement/circuit-absence/`.
- **HM-01, Home (HOME-08):**
  - the secondary upcoming section is omitted only when the hero is "Next
    Grand Prix" and the upcoming list is available but empty;
  - the rule needs both conditions; an empty upcoming list alone never hides
    the section;
  - everything else is unchanged. No new copy, empty-state card or
    decorative content.
  - Experiment: `cross-screen-refinement/home-upcoming-omit/`.
- **Still open:**
  - CIR-02 and HOME-08 (until Flutter behaviour and tests are validated);
  - CD-2 (whether a complete but stale calendar still supports the absence
    statement);
  - CD-3 (persisting the contract's association);
  - the remaining `STATUS-SEMANTICS-AUDIT.md` findings: unranked wording,
    stacked notices, the Spanish caption, unknown and provisional styling.

## Ranking decisions (2026-11-11, Step 49C)

Status: RK-1 to RK-5 accepted by the owner after reviewing
`STATUS-RANKING-DECISIONS.md`. Semantic decisions only: no new visual
experiment, no prototype change, nothing implemented in Flutter.

- **RK-1, Standings (XS-11):** an unranked row is announced "Unranked" /
  "Sin clasificar" by reusing `positionUnranked`; the visible dash stays;
  "Position unavailable" is not a synonym for unranked.
- **RK-2, Explore (EXP-01):** labelled "Position" / "Points" data (Alternative
  B); an unranked position is omitted; known points, including 0, are kept;
  no isolated number that could be mistaken for a position.
- **RK-3, Home (HOME-09):** a first-place standing whose name is not stored
  locally shows "Leader unavailable"; "No leader yet" only when the available
  standings establish no leader. Existing strings.
- **RK-4, tied leaders (provisional):** keep the known-names handling while
  the tie stays stated, no name is invented and no single visible name reads
  as the sole leader.
- **RK-5, tracking:** XS-11, EXP-01, HOME-09 (new) and TEAM-06; open until the
  Flutter tests in `STATUS-RANKING-DECISIONS.md` §7 and §9 pass.
- **Unchanged:** the importer (it refuses repeated positions and unranked
  rows), ranking rules, delivered order, the contract, ARB files.

## Notice coexistence decisions (2026-11-11, Steps 49D.1 to 49D.3)

Status: closed as an exploration in Step 49D.3. Nothing implemented in
Flutter or the ARB files. Details: `STATUS-NOTICE-DECISIONS.md` §12 and
`cross-screen-refinement/notice-coexistence/REPORT.md`.

**Owner-approved semantic policy**
- **N-1 (approved):** failure, stale and incomplete stay independently
  representable; order failure → stale → incomplete; at most one of each; a
  failure never conceals an incomplete profile; finality stays with the
  classification.
- **N-2 (approved wording):** one combined notice for failure + stale of the
  same content: EN "Couldn't refresh. Saved data may be out of date." / ES "No se pudo actualizar. Los datos guardados pueden estar desactualizados.". Preferred wording for future
  implementation; no ARB implementation authorised yet.
- **N-3 (approved):** Home keeps module-specific unavailable information in
  the module.
- **N-4 (approved direction):** the failure notice stays during a retry until
  the outcome is known; the progress indication stays.
- **N-7 (approved with conditions):** no global Home notice for every
  standings-table refresh failure; no module may misleadingly imply
  freshness.

**Rejected presentation**
- **N-5 (rejected):** the Calendar first-open toast and every tested overlay
  (bottom toast, top-edge cue, full-text toast, both-facts toast; any overlay
  in 693×320 landscape).
- **Inline status line before the next race (Step 49D.2 option B):** reads as
  a statement about that race, is too tall when stale (156px at 320 @200%),
  duplicates the notice and is sighted-only.

**Preferred, conditionally approved presentation** (superseded for
Calendar on 2026-11-14 by the narrowly scoped N-6 approval in the table
above, Step 55C.2.1)
- **N-6 (as recorded in Step 49D.3, provisional):** open Calendar with the
  existing notice visible when a relevant failure or stale notice exists at
  the first positioning. Otherwise keep the jump to the next race, and never
  move the scroll position when a notice appears later. Now **approved** for
  Calendar only, with the precise rules (a)–(f) in the table; not
  generalized to other screens.
- **Condition (still tracked, XS-19):** reaching the next race with a
  complete season. Option A measured 1,116–1,265px of scrolling at 320 @200%
  with only four rounds; a full season can be much longer. If unreasonable,
  investigate a direct navigation affordance. Not part of the Step 55C.2.1
  approval.

**Unresolved Flutter and device requirements** (backlog XS-02, XS-16, XS-19)
- **Feedback after a user-initiated refresh** whose notice is off-screen.
- **Android device rendering:** system insets and font scaling.
- **TalkBack:** announcements, reading order and the accessibility timeout.
- **Flutter behaviour:** no scroll anchoring, so a height change above the
  viewport moves the rows; the N-4 retry-state behaviour.
- **Calendar first positioning:** full-season distance to the next race.

**Unchanged:** domain, synchronization, Flutter, ARB files, approved
prototypes, pilots, Calendar experiments. No accessibility item is closed.

## Status visual decisions (2026-11-12, Steps 49E to 49E.2)

Status: closed as a visual exploration in Step 49E.2. Nothing implemented in
Flutter or the ARB files. Details: `STATUS-VISUAL-DECISIONS.md` §15;
experiment `cross-screen-refinement/status-visual-consistency/`.

**Approved visual vocabulary** (visual prototypes only)
- **VS-1:** dashed outline = unknown value, for unknown event status,
  weekend format, session status and race-result finish. Each keeps its own
  existing wording; an unknown status and an unknown format stay different
  facts.
- **VS-3:** the Standings provisional row marker loses the dagger in the
  future implementation. Compact size, outline, word, accessible name and the
  whole-table caption stay.
- **VS-4:** notice icons from the existing set: alert (refresh failure;
  combined failure + stale), clock (stale), help (incomplete profile; and
  Home's "Some information is unavailable", O-2, Step 49F.1). The
  icons are decorative; the text carries the meaning.
- **VS-5:** the two-line Spanish "Formato desconocido" at 320px @200%.

**Rejected:** VS-2, the dagger on every Provisional indicator.

**Unchanged:** VS-6, Calendar's per-row unknown labels. Audit V1 remains
an open design question (O-3, Step 49F.1; XS-11, CAL-02, XS-13).

**Correction to earlier documentation.** The dagger is **no longer** a shared
provisional convention. "Provisional" is one word-led outline chip
everywhere; Standings keeps only its compact size and its caption. The
"dagger + word" description in `shared/components/chip.css`, `README.md`
(Home status vocabulary) and `standings/README.md` (ST15 and the component
table) describes the prototypes as reviewed and is superseded by VS-2 and
VS-3. Those files are approved prototypes or shared components and stay
unchanged.

**Open requirements** (none closed by the visual approval)
- **Flutter:** a dashed border (XS-28, XS-11); the chip shape changes from
  the pill-with-dot `GvStatusChip`; decorative icons excluded from semantics
  (XS-22).
- **Contrast:** solid outlines measure 1.88:1 (`hair-strong`) and 2.2:1
  (Standings marker on the Chalk leader row), below the 3:1 non-text
  guideline. An **open accessibility concern**: the text label does not
  resolve it (corrected Step 49F.1). Review tracked in XS-11.
- **Android:** TalkBack (XS-02); device rendering, 20px icon legibility and
  system font scaling, including the two-line Spanish chip (XS-16).
- Chrome measurements only; no WCAG-compliance or production-readiness claim.

## Step 49 closing review (2026-11-12, Steps 49F and 49F.1)

**Step 49 is formally closed with conditions (owner, Step 50A).** The
conditions stay open in the backlog: XS-30 (caption implementation and
tests), XS-28 (tokens, dashed outline), XS-11 (solid-outline contrast),
XS-22, XS-19 (Calendar first positioning, manual-refresh feedback), XS-02
(TalkBack) and XS-16 (Android insets and font scaling), plus audit V1,
CD-2, CD-3 and CIR-04. No approved decision is reopened.

Details: `STATUS-LOCALIZATION-ACCESSIBILITY-REVIEW.md` (§11 for Step 49F.1,
§12 for the closure).
- **O-1 → L1 (approved, final wording, Step 50A):** Spanish caption "Última
  comprobación correcta: {time}". No ARB change yet. Measured in Chrome;
  device font scaling stays a validation item. Tracked in XS-30 (STD-01
  covers Standings caption presence and pinned height, not this wording).
- **O-2 (approved):** the help icon also marks Home's "Some information is
  unavailable" (decorative, non-interactive; the text stays authoritative).
- **O-3 (confirmed):** audit V1, Calendar's repeated unknown-status labels,
  stays an open design question. Keeping today's presentation is not an
  approval.
- **Corrections:** the help-icon evidence `C-combined-partial-*` is labelled
  hypothetical; VS-6 no longer presents V1 as decided; solid-outline
  contrast is an open concern, not resolved by the text label; CT-03 cites
  N-5 instead of the conditional snackbar.

## Dark-theme visual closure (2026-11-12, Steps 51A to 51E)

Details: [`DARK-THEME-READINESS.md`](DARK-THEME-READINESS.md) §11; roles:
[`DARK-THEME-ROLES.md`](DARK-THEME-ROLES.md); experiment
`cross-screen-refinement/dark-state-boundaries/` (REPORT §1–13). Visual
prototypes only. Nothing is implemented in Flutter or the ARB files. These
are approved visual directions, **not** proof of Android or WCAG
compliance.

**Approved (owner, after reviewing the Step 51C.1 screenshots):**
- **DK-1 (A1):** solid status outlines at Chalk 45% on dark surfaces and
  `on-chalk` 55% on Chalk. The dashed unknown outline stays stronger.
- **DK-2 (A2):** flat `--oxide` selection in the existing diagonal shape,
  with the bold selected label and selected semantics. No underline and no
  12° tick. **The flat slab is 2.47:1 against the selector background.** The
  combination with bold text and diagonal geometry is the recorded
  rationale and does not automatically establish WCAG compliance.
- **DK-3 (A3):** Chalk ring on every selector button. Chalk where the ring
  crosses oxide in Calendar and GP results. The ring is painted above
  decoration so its whole perimeter shows. Ember outside the Chalk
  Standings leader row.

**Technically verified (accepted, Step 51E):** DK-4, the Home
championship-band ring (oxide on Chalk), meets the intended requirements
without a correction. This is Chrome emulation. The two Home crops are
technical evidence, not owner-reviewed visual approvals.

**Formal closure (Step 51E, owner):**
- **DK-5 approved:** Primer V2 Dark is the visual design reference for
  Flutter implementation, Primer V2 Light and cross-theme token
  consolidation. This is visual design approval only, not Android
  accessibility certification or production readiness.
- **DK-6, retain:** the Home hero round block, Driver plate and GP winner
  cell keep their existing decorative gradient. `#B04633` remains there as
  a contextual decorative value, not a shared token. Flat oxide stays
  limited to DK-2.

Evidence retention for Steps 51C–51D is applied. 22 screenshots are
Git-visible: 20 owner-reviewed comparisons and 2 Home technical-evidence
crops (`cross-screen-refinement/EVIDENCE-RETENTION.md`).

**Kept open:**
- XS-11 (status-boundary and contrast validation);
- XS-26 (selected-state implementation and accessibility verification);
- XS-28 (Flutter shared tokens, dashed border);
- XS-31 (focus-ring implementation, Android validation);
- XS-32 (keyboard focus hidden behind the fixed bottom navigation, now also
  on Home and, partly, at 390 @100%);
- XS-02, XS-05 and XS-16 (TalkBack, font scaling, device).

Keyboard focus visibility is not complete until real scrolling and system
insets are verified in Flutter.

## Light-theme direction (2026-11-12 to 2026-11-13, Steps 53A to 53F)

Details: [`LIGHT-THEME-FOUNDATIONS.md`](LIGHT-THEME-FOUNDATIONS.md) (Step 53A
palette exploration §1–§10, Step 53A.1 B Motorsport §11, Step 53B component
roles and focus §12). Experiment: `cross-screen-refinement/light-foundations/`.
Visual prototypes only; nothing is implemented in Flutter or the ARB files.

**Approved by the owner (after reviewing the seven Step 53A.1 comparisons):**
- **LT-1:** B Motorsport is the Primer V2 Light visual direction.
- **LT-2:** the Direction B neutrals are the Light baseline, pending wider
  component validation.
- **LT-3:** Graphite editorial panels only in the reviewed contexts, not as a
  rule for every screen.

These approvals concern visual direction only. They are not Flutter
implementation, Android validation or WCAG certification.

**Approved by the owner after the ten Step 53B comparisons (2026-11-13,
Step 53C), visual level only:** LT-4 and LT-5 (contextual focus-ring backing
for unselected segmented options and GP winner rows), LT-11 (GP back-button
ring 1px from the button), LT-12 (square action-strip corners on Home hero
focus), LT-6 (contextual 1px team-colour edge as the preferred shared rule,
subject to validation in other team-colour contexts and to Flutter/Android
implementation). Not to be reopened without evidence of a regression.

**Step 53C, Light rollout Batch 1** (Calendar, Driver Detail, Team Detail):
[`LIGHT-ROLLOUT-BATCH-1.md`](LIGHT-ROLLOUT-BATCH-1.md), prototype
`cross-screen-refinement/light-rollout-b1/`. **Approved by the owner at the
Light visual-design level (Step 53C.1, 2026-11-13)** after reviewing ten
representative screenshots; no new visual blocker. With it: **LT-13** (Driver
and Team keep the Light heading band; the Graphite alternative is not
adopted) and **LT-15** (next-event focus backing; Flutter and Android focus
validation stays under XS-31). Not to be reopened. **LT-14 approved (Step
53D):** completed Calendar rows keep 100% opacity in Light; the 0.85
alternative is rejected; completion stays carried by the chip's label, icon
and boundary; the Italian Grand Prix comparison row is experimental evidence
only and no approved Calendar data or fixture changed. **Batch 1 is visually
closed.** This closes no Flutter, Android, TalkBack or accessibility
requirement. The Team line-up seam edge still needs one shared
implementation geometry for both themes before Flutter (LT-6 follow-up,
XS-25).

**Step 53D, Light rollout Batch 2** (Circuit Detail, Grand Prix Detail,
Settings): [`LIGHT-ROLLOUT-BATCH-2.md`](LIGHT-ROLLOUT-BATCH-2.md), prototype
`cross-screen-refinement/light-rollout-b2/`. **Approved by the owner at the
Light visual-design level (Step 53E, 2026-11-13)** after reviewing twelve
screenshots: Circuit Detail, GP Detail and Settings; the Batch 2 rollout is
accepted. With it: **LT-7 Final**, **LT-8** (keep the 26% notice border as a
supporting decorative boundary), **LT-10** (keep the three DK-6 gradients)
and **LT-17 for Light** (team-link ring 2px inside the link). Pending: LT-7
Live, LT-9, LT-16, and LT-17 as a shared Dark rule.

**Step 53E, Light readiness review:** [`LIGHT-READINESS.md`](LIGHT-READINESS.md).

**Step 53F, formal Primer V2 Light visual closure (LT-18, 2026-11-13).** After
reviewing the six Step 53E screenshots the owner approved Primer V2 Light,
B Motorsport, at the visual-design level, with no remaining visual blocker:
**LT-9** (bottom navigation), **LT-16** (light loading placeholders; the
Graphite GP placeholder rejected), **LT-17 as a shared Dark/Light rule** (a
Flutter requirement for both themes), and for **LT-7 Live** the Ember
direction (Red Oxide rejected) with contextual validation pending. Roles are
frozen in [`LIGHT-THEME-ROLES.md`](LIGHT-THEME-ROLES.md). This is not Flutter
implementation approval, Android accessibility certification or proof of
WCAG compliance. Earlier experiments, screenshots and rejected proposals are
kept as the record.

**Still open:** LT-7 Live contextual validation, XS-02, XS-05, XS-07, XS-11,
XS-16, XS-25, XS-26, XS-28, XS-31 (including LT-11 and LT-17), XS-32 and
every Android and TalkBack requirement.

**Step 54A, Light coverage gaps (2026-11-13).** The owner reviewed the nine
Step 54A screenshots and visually approved the Light renderings of HM-01,
N-2, VS-1, VS-3 and VS-4 (`LIGHT-READINESS.md` §14, §17; experiment
`cross-screen-refinement/light-coverage-gaps/`). Step 54A is closed; LT-18 is
unchanged. Cross-theme consolidation (Step 54B) is authorised; Flutter
implementation is not.

## Cross-theme consolidation (2026-11-13, Steps 54B and 54C)

**Step 54B:** [`CROSS-THEME-CONSOLIDATION.md`](CROSS-THEME-CONSOLIDATION.md)
and [`CROSS-THEME-TOKEN-MAP.md`](CROSS-THEME-TOKEN-MAP.md) consolidate the
frozen Dark and Light roles into one component and token specification;
three experiments in `cross-screen-refinement/cross-theme-54b/`.

**Step 54C:** after reviewing the nine Step 54B comparisons the owner approved
D1 (XT-1, Home Explore inward ring 4px), D2 (XT-2, completed Calendar rows at
100% in both themes) and D3 (XT-3, shared team-colour geometry; TM-03's
geometry superseded, its principle kept), and decided D4 (XT-4, back-button
offsets stay per theme), D5 (XT-5, pressed-state semantics with theme
values) and D6 (XT-6, the cross-theme visual specification frozen for
implementation). D7: Flutter migration not started (XS-28 open). D8: the
N-2 wording is kept and needs ARB implementation (no ARB edited).

This is visual design approval only. Still open: LT-7 Live in context,
XS-02, XS-05, XS-07, XS-11, XS-16, XS-25, XS-26, XS-28, XS-31, XS-32 and every
Android and TalkBack requirement.

## Standings Flutter decisions (2026-11-14, Step 55C.5.1)

The owner reviewed the Step 55C.5 technical report of the production
Standings migration (`docs/technical/GridView_Primer_V2_Theme_Foundation.md`
§6h) and approved three narrowly scoped decisions. They concern production
Standings only, record what the implementation already does, and do not
reopen the frozen cross-theme colours or typography (XT-6). Standings still
awaited owner visual review at that point (visually approved in Step 55C.6,
2026-11-15).

- **SF-1, status placement.** Title, season and selector pinned; caption and
  notices scroll as the first item of the selected table's list, before the
  rows in reading order; independent table offsets; no automatic repositioning
  after a background refresh. The prototype's pinned status area is
  superseded for production Standings: at 320dp/200% it would take 41–78.5%
  of the viewport (Spanish stale notice: 78.5%). N-6 stays Calendar-only.
- **SF-2, freshness caption and header budget.** The resource-scoped
  timestamp logic is accepted. PD-03 and STD-01 stay open for the remaining
  caption verification, with no invented staging timestamp. S-1 / XS-06 stay
  open pending Android device validation; the title-row release is not
  implemented. Measured: pinned header 235px = 33.9% at 320dp/200% (insets 0;
  list viewport 53.2% above the legacy navigation), to be re-evaluated on real
  devices with system insets.
- **SF-3, team tick.** Fixed 40dp tick (XT-3 geometry, Explore's length) at
  the prototype position; original colour and the XT-3 conditional boundary
  kept; no other team-mark variant changed.

Still open: STD-03, STD-04, STD-05, STD-07, STD-06 validation, XS-06, XS-30,
and native Android, TalkBack, D-pad and switch-access validation.

## Explore Flutter decisions (2026-11-15, Step 55C.7.1)

The owner reviewed the Step 55C.7 technical report of the production Explore
migration (`docs/technical/GridView_Primer_V2_Theme_Foundation.md` §6i) and
approved four narrowly scoped decisions for production Explore only. They do
not reopen the frozen colours or typography (XT-6) or the Alternative B row
hierarchy. Explore was **not** yet visually approved at that point. **Step
55C.8 (2026-11-15):** the owner visually approved production Explore in both
themes, with EF-1 to EF-4 as implemented and no further visual change; the
open items below are unchanged.

- **EF-1, status placement.** Title, season, Settings and selector pinned;
  caption, progress line and notices scroll before the rows. Rows on screen
  never move when the status changes height (a layout-time scroll-offset
  correction while the list is scrolled; at the top the new status is
  revealed). Pinned share at 320dp/200%: 41.4% in every state (was up to
  73.4%). N-6 stays Calendar-only; S-1 / XS-06 stay open.
- **EF-2, stale wording.** `offlineStaleNotice` for staleness alone;
  `exploreUpdateFailed` for failure alone; N-2 for both, same collection.
- **EF-3, media column.** No authorized media → no column; any → the uniform
  40dp slot with stable placeholders. Accepted for now; PD-16 open.
- **EF-4, loading skeleton.** Lines at the rows' text column, no squares
  without a media column; the 40dp slot when one applies.

The caption ("Last successful check: HH:mm") uses only the selected
collection's own `lastSuccessAt`, keeps the previous time while a refresh runs
(the progress line shows the check), and is absent for a bootstrap-materialized
collection, as SF-2 does for Standings.

Still open: PD-05 (EXP-02), PD-07 (XS-04), PD-16 (EXP-04), S-1, XS-06,
EXP-06, and native Android, TalkBack, D-pad and switch-access validation.

## Driver Detail Flutter decisions (2026-11-15, Steps 55C.9 to 55C.9F)

The owner reviewed the production Driver Detail migration
(`docs/technical/GridView_Primer_V2_Theme_Foundation.md` §6j; evidence
`build/primer-review/55c9/`, `55c9r/`) and **visually approved Driver Detail
in Dark and Light** as implemented (Step 55C.9R review, final in Step 55C.9F).
This does not reopen the frozen colours or typography (XT-6). The PD-11 /
DRV-01 and PD-06 / XS-03 records below are left for formal closure; they are
implemented as prototyped.

- **DF-1, long-word stacking (DD-06 Option B, approved and active).** The
  plate also stacks when the name's longest word, as rendered, is wider than
  the name column beside the board, so "Verstappen" / "Hulkenberg" are never
  split (346–360dp @100%). Content-aware, no width breakpoint; 375dp, 390dp
  and 320dp @200% keep their layouts.
- **DF-2, media placeholder (XS-15 correction approved).** Missing, pending
  and failed portraits leave the plate exactly as without media: no
  placeholder or person icon (opt-in `GvRemoteImage(showPlaceholder: false)`,
  default unchanged elsewhere). **Deferred:** in Dark, while a portrait is
  pending or failed, the scrim masks the 4.5% sheen on the left of the plate.
- **DF-3, Back focus ring (Driver Detail only).** Circular ring on the 48px
  round button (radius 24), keeping the XT-4 offsets (3px Dark, 1px Light)
  and colours. The shared back-button geometry is unchanged.
- **DF-4, team tick.** The shared 3px XT-3 tick is accepted in place of the
  prototype's 4px tick.
- **DF-5, font metrics.** Responsive differences from Flutter's Archivo
  metrics are accepted (for example the extra wrapped participation line at
  320dp @200%; no `text-wrap: balance`).
- **DF-6, Standings link (Step 55C.9N, functionally approved).** Driver and
  Team Detail open a Standings table by returning to the table they came
  from, otherwise by switching branch (`openBranchDestination`), never by
  pushing a shell destination above the detail.

Still open: native Android, TalkBack, D-pad, switch access and real font
scaling; XS-15 real-portrait validation; the DF-2 Dark sheen difference.

## Team Detail Flutter decisions (2026-11-15, Steps 55C.10 to 55C.10F)

The owner reviewed the production Team Detail migration
(`docs/technical/GridView_Primer_V2_Theme_Foundation.md` §6k; evidence
`build/primer-review/55c10/`, `55c10r/`) and **visually approved Team Detail
in Dark and Light** (Step 55C.10F). This does not reopen the frozen colours,
typography or XT-3 geometry (XT-6).

- **TF-1, composition.** Banner with season line, stable name only when it
  differs (read "Team: …", TM-02 as implemented) and nationality once;
  Championship before Drivers (TM-01); line-up rows with Ember spans; spec
  sheet; About without a card; Team skeleton. TEAM-01 items 3, 9 and 11 are
  implemented as prototyped.
- **TF-2, team colours.** XT-3 shapes with the contextual boundary measured
  against the surface each sits on, in both themes; original colours kept.
- **TF-3, content-aware stat strip (Step 55C.10R, approved and active).**
  Ordinary figures keep the approved row; when the measured content does not
  fit, Points and Wins move below Position, then one per line. Labels never
  split, values never clip; typography, seams, semantics and order
  unchanged. Opt-in on the shared strip (`fitContent`), enabled only in Team
  Detail. An intentional improvement over the frozen Chrome stress fixture.
- **TF-4, shared detail components and focus.** App bar (with the circular
  Back ring, now approved for Team as for Driver), notices, full-page
  message, skeleton base, heading sheen and About are shared between Driver
  and Team; Driver Detail is visually and functionally unchanged.

Still open: TalkBack (XS-03, XS-04), XS-25 device validation, native Android,
D-pad, switch access, real font scaling and real media; the Dark sheen under
the media scrim while media is pending or failed (as Driver DF-2).

## Circuit Detail Flutter decisions (2026-11-15, Step 55C.11)

The owner approved the Step 55C.11 preparation report and authorised the
production Circuit Detail migration
(`docs/technical/GridView_Primer_V2_Theme_Foundation.md` §6l; evidence
`build/primer-review/55c11/`). **Implemented; owner visual review pending.**
This does not reopen the frozen colours, typography or 12° geometry (XT-6).

- **CF-1, PD-13 (Option A ×3).** (a) Unavailable record holder and unnamed
  Grand Prix in the approved secondary style; (b) the resolved season below
  the related Grand Prix heading in both the event and the no-event state;
  (c) the Circuit-specific skeleton (232px sheet block, label + 88px row ×2).
- **CF-2, Back focus.** The circular 24px ring of Driver and Team Detail
  (3px Dark, 1px Light), through the shared `PrimerDetailAppBar`.
- **CF-3, `EntityDetailScaffold` retired.** Circuit was its last consumer
  (no production, test or tool reference remained); the file was removed.
  `GvScreenScaffold`, `GvErrorState`, `GvEmptyState` and the other legacy
  widgets stay for Grand Prix Detail and Settings.
- **CF-4, PD-15 kept open.** The existing wording ("This season's Grand
  Prix", "No Grand Prix this season") is unchanged on historical seasons.
- **CF-5, PD-07 / XS-04 and XS-29.** The related row keeps the current
  contract (one button "Open {name}"; round, date and chips not announced);
  the facts kicker keeps its `h2` semantics without changing the
  cross-screen hierarchy policy. Device validation stays open.
- **CF-6, CR-04 / PD-14 / CIR-02 deferred (not approved by this step).** The
  no-event statement is shown exactly as before: whenever the read model has
  no related event, including when the season's calendar is not
  materialized locally, where the claim can be unproven. No provider,
  repository or synchronisation change was made. **Visual migration
  complete does not mean the no-event statement is correct**; CR-04 must be
  resolved in a separate functional step before formal Circuit Detail
  closure.

**Step 55C.11R (2026-11-15).** The owner reviewed ten Chrome-versus-Flutter
screenshots and **visually approved the Circuit Detail composition in Dark
and Light**, including the related-event layout, unknown states, focus,
large-text wrapping (the accepted extra "Direction" line at EN 320 @200%)
and the partial-information notice, with one Light correction:

- **CF-7, Light dimension ticks (approved, implemented).** The two 12° end
  ticks of the length used Chalk in both themes, as the frozen Light
  reference, and measured 1.12:1 on the Light band. In Light they now use
  `line.status` (Graphite 55%, an existing role): **3.97:1** on the band,
  still lighter than the 7.30:1 secondary horizontal rule. Geometry, angle,
  thickness, placement and the horizontal rules are unchanged; no new token;
  no Red Oxide. Dark keeps Chalk and is pixel-identical (all 48 Dark review
  captures byte-identical); layout geometry is identical in all 96 captured
  configurations.
- **CR-04 re-verification (assessment only, not implemented).** The Step
  49B.1 analysis (`STATUS-ABSENCE-DECISIONS.md` §1, §6) still matches the
  code: `replaceCalendar` is the only authoritative writer of a season's
  events; Home and Grand Prix snapshots insert single events additively;
  `refreshCircuit` still discards the contract's `CircuitDetail.grandPrix`;
  Circuit Detail still reads no calendar or bootstrap metadata. The existing
  trustworthy signal is `hasMaterializedCalendar` (Calendar and Home already
  use it): the circuit has no related Grand Prix only when
  `relatedGrandPrix == null` **and** `hasMaterializedCalendar` for the
  detail's own season (`calendar:<season>` synchronised once, or an accepted
  bootstrap whose own season scope is that season); unknown otherwise. Recommended
  implementation: C-R1 as approved (omit the whole related section in the
  unknown and resolving states; no new copy, provider read only, no schema,
  API or ARB change). See `STATUS-ABSENCE-DECISIONS.md` §8.

**Step 55C.11C (2026-11-15): CR-04 implemented (owner-authorised).**

- **CF-8, related Grand Prix association (C-R1).** A stored related event
  for (resolved season, circuit) shows the section and its row (A), whatever
  the calendar; "No Grand Prix this season" only when that exact season's
  calendar is materialized (B); otherwise, and while any input resolves, the
  whole section is omitted — heading, season line and statement (C). The
  signal is the existing `hasMaterializedCalendar(season: resolved season, metadata: calendar:<season>, bootstrapMetadata: bootstrap)` (`calendar_state.dart` → `hasMaterializedCollection`), the
  rule Calendar and Home use: the season's own calendar record has
  synchronised successfully once, or an accepted bootstrap whose own season
  scope is that season. Never inferred from event counts, an empty list, the
  circuit's refresh, a single Home / Grand Prix snapshot or another season.
  `circuitEventAssociation` + `circuitEventAssociationProvider`
  (`lib/features/circuits/application/circuit_event_association.dart`); no
  calendar request is started; no schema, API, ARB or synchronisation change.
- **CD-2 approved.** A materialized calendar stays materialized after a
  failed refresh and when stale; its last authoritative snapshot supports B
  offline. **Limitation kept open:** Circuit Detail's notices describe only
  `circuit:<id>:<season>`; calendar staleness is not communicated next to the
  absence statement (no new copy in this step; see Foundation §6l).
- **CD-3 deferred.** The contract's per-season `CircuitDetail.grandPrix` is
  still not persisted; a possible future improvement for historical seasons
  without a calendar, not a CR-04 dependency.

**Step 55C.11F (2026-11-15): final approval and validation.** The owner
formally approved the Circuit Detail visual design in Dark and Light
(complete, partial and responsive layouts), the CR-04 confirmed-absence and
unknown-association presentations, the CF-7 Light strokes and the related
Grand Prix, lap record and circuit facts compositions. Exactly three goldens
were re-baselined on canonical Linux (`circuit_detail_complete`,
`circuit_detail_partial` — the related section now omitted, the fixture has
no calendar — and `light_circuit_detail` with the `line.status` strokes); the
other 73 are byte-identical to `3c6d527`. Linux (`ghcr.io/cirruslabs/flutter:3.44.0`): golden suite 76/76, a second full regeneration with zero drift, full suite 3,032 passed, 1 skipped, 0 failed, `flutter analyze` clean. Windows: 3,029 passed, 1 skipped, 3 failed (the accepted exceptions `primary_shell_nav`, `explore_drivers_no_media`, `explore_teams_media_dark`), `flutter analyze` clean. Not committed;
checkpoint awaits explicit commit approval.

Deferred / open: the calendar-specific stale notice next to the B statement
(limitation documented, no copy decided), CD-3, PD-15, PD-07 / XS-04, XS-29,
native Android, TalkBack, D-pad, switch access, real system font scaling,
real media (CD-12, no production asset exists) and the cross-screen
accessibility items. No production-readiness or Android accessibility
certification is claimed.

## Grand Prix Detail Flutter decisions (2026-11-16, Step 55C.12)

The owner approved the Step 55C.12 readiness assessment and authorised the
production Grand Prix Detail migration
(`docs/technical/GridView_Primer_V2_Theme_Foundation.md` §6m; evidence
`build/primer-review/55c12/`). **Implemented; visually approved in
Dark and Light (Step 55C.12F); canonical goldens re-baselined.** This does not reopen the frozen colours, typography or 12°
geometry (XT-6). No provider, model, database, API or ARB change.

- **GF-1, GPD-02 / PD-01 Sprint results.** The existing renderer is kept:
  each Sprint (or other) classification is its own titled section with the
  same Primer rows, never merged. The race "Winner" treatment is never
  applied to it (`resolveHomeRaceWinner` returns no winner for a sprint).
  Release scope stays race-only; no Sprint-specific design or contract.
- **GF-2, GPD-03 / PD-02 Missing name.** A null, empty or blank stored name
  is `grandPrixNameUnavailable` in the approved secondary style (650,
  `wdth` 96, `text.secondary`, as PD-13a), still the band's heading; the
  app bar keeps "Grand Prix"; no identifier is shown.
- **GF-3, GPD-04 Driver affordance.** The approved row interaction without a
  chevron on the driver row; focus, hover and press feedback retained.
  **GPD-04 stays open** for device review.
- **GF-4, GPD-05 Independent interactions.** `GvPrimerResultRow` with the
  row link and the separate team link: separate focus targets, order row
  then team, ≥ 48dp, independent activation and press, driver / team
  navigation with the classification season (widget tests). **Found:** the
  shared row's team link filled the name column, while the reference's
  shrinks to its text (GPD-12); corrected in Step 55C.12R (GF-9).
  TalkBack and device validation **open**.
- **GF-5, XS-13 Full-field density.** No staging data; a review-only
  synthetic 23-entry field (`test/support/grand_prix_review_fixtures.dart`,
  every name "Synthetic …") exercises positions, duplicates, missing
  positions and points, fractional points, timing fallbacks, every finish
  status, long names and unresolved names. Evidence
  `state-synthetic-full-field.png`. **XS-13 stays open.**
- **GF-6, GP10 / XS-15 Hero media.** Typographic band only; no image;
  media contracts unchanged; `EventHeroImage` kept (now unused) for XS-15.
- **GF-7, Back focus.** The shared circular 24px ring (3px Dark, 1px
  Light), as Driver, Team and Circuit Detail.
- **GF-8, PD-06 / XS-03 Session reading order.** Each session row is one
  node read time, name, status; a session without a start time reads name,
  status and invents none. The band reads chips, round, season, heading,
  official name, facts. **TalkBack validation open.**
- **Also implemented as approved:** VS-1 dashed unknowns (event status,
  format, session, classification, finish), VS-2 no dagger, VS-4 notice
  icons, N-1 / N-2 for two resources (combined only for the same resource;
  event failure + results-only staleness = two notices; the results notice
  under the first classification's title and chip), LT-17 team-link ring,
  DK-3 / DK-6 winner cell and focus, the Light focus corrections and the
  frozen roles (Graphite band in Light, LT-1). N-4 not implemented.
- **Accessibility contract kept.** The page and section empty / error
  titles remain headings and live regions (the legacy `GvEmptyState`
  contract), through the opt-in `GvPrimerEmptyState.announceTitle`.
- **Row label.** The winner row's label ends with ", Winner" so the
  visible kicker is announced (prototype label); XS-04 / PD-07 stay open.
- **GPD-10.** The winner cell's 12° edge is height-derived (`GvLiveryCut`),
  so taller rows at 200% keep 12°; device validation not claimed.
- **Kept open:** GPD-04, GPD-06, GPD-07, GPD-08, XS-13, PD-06 / XS-03,
  PD-07 / XS-04, XS-15, and Android device, TalkBack, D-pad, switch access
  and real font-scaling checks.

**Step 55C.12R (2026-11-16).** The owner accepted the migration for visual
review (final visual approval and golden regeneration still pending) and
approved one correction:

- **GF-9, GPD-12 team-link width (implemented; owner visual and device
  validation pending).** The independent team link of `GvPrimerResultRow`
  hugs its team name and chevron instead of filling the name column, so
  its LT-17 ring (2px inside) and its target follow the visible link; it
  keeps a 48dp minimum height and width. Taps beside the link reach the
  driver row; the link never activates the row; focus order, Enter /
  Space, labels and semantics unchanged. Widths at EN 390 @100% now match
  Chrome within 2px; a wrapped name hugs its longest line (Chrome's block
  spans the column once wrapped). Evidence
  `build/primer-review/55c12r/team-link-{dark,light}-{en-390-100,es-320-200}.png`.

**Step 55C.12F (2026-11-16).** The owner **visually approved Grand Prix
Detail in Dark and Light**: identity band and facts, circuit row, session
schedule, race results, winner presentation, the 320dp @200% layout, GPD-12
team-link sizing and focus, the combined N-2 notices and the synthetic
23-entry classification. Flutter's extra "Charles Leclerc" line at 320dp
@200% is accepted. No further visual refinement.

- **GF-10, team-link measurement (defect fix found in golden
  inspection).** The GPD-12 link measured its text without the ambient
  `DefaultTextStyle` that its `Text` renders with; under the test font
  "Red Bull Racing" re-wrapped and lost "Racing". It now measures in the
  rendered style: links 1–5px wider than at 55C.12R (the chevron no longer
  overlaps the last letter); bounds, ring, targets and semantics otherwise
  unchanged. Regression test under the test font.
- **Canonical goldens.** Exactly six re-baselined in the Linux container
  (`grand_prix_detail_loaded`, `grand_prix_detail_staging_badge_es`,
  `grand_prix_standard_upcoming`, `grand_prix_completed_results`,
  `grand_prix_result_error`, `light_grand_prix`); the other 70 unchanged
  (SHA-256); 76/76 pass; zero drift on a second full regeneration.
- **GPD-12** visually approved; real-device validation (touch targets,
  TalkBack, D-pad, switch access) still required.
- **Still open:** GPD-04, GPD-06, GPD-07, GPD-08, XS-03, XS-04, XS-13,
  XS-15, Android, TalkBack, D-pad, switch access and real system
  font-scaling validation, and the applicable cross-screen accessibility
  items (XS-02, XS-16). Not production readiness or Android accessibility
  certification.

## Settings Flutter decisions (2026-11-21, Step 55C.13A)

The owner reviewed the Step 55C.13 readiness assessment (2026-11-16) and
resolved its 19 numbered decisions. The Settings migration is approved and
split into two checkpoints: **Step 55C.13A** (root, Language, Theme, Time
display) and **Step 55C.13B** (Data and updates, Acknowledgements, Privacy
and legal, About). **Step 55C.13A implemented and visually approved
(Step 55C.13AF); canonical goldens re-baselined; Step 55C.13B implemented 2026-11-21 and visually approved in Step 55C.13BR; SF-10R (Step 55C.13BR2); final approval and canonical goldens Step 55C.13BF: all eight Settings routes visually migrated** (`docs/technical/GridView_Primer_V2_Theme_Foundation.md` §6n;
evidence `build/primer-review/55c13a/`). **Step 55C.13AR** (same day)
refines the root typography after the owner's screenshot review (SF-20;
evidence `build/primer-review/55c13ar/`), approved in Step 55C.13AF. No golden regenerated. Only four
of the eight Settings routes are migrated. This does not reopen the frozen
colours, typography or 12° geometry (XT-6). No provider, repository,
persistence, API or ARB change.

Numbering follows the readiness report's §8. "13A" = implemented in Step
55C.13A; "13B" = reserved for Step 55C.13B. Where the 55C.13A instruction
did not state a resolution, the item is recorded as reserved, not as
decided.

| # | Decision | Owner resolution | Step |
|---|---|---|---|
| SF-1 | Scope | Split: 55C.13A root + preferences; 55C.13B the four information screens | 13A / 13B |
| SF-2 | Light reference | `light-rollout-b2/set-*-{dark,light}[.es]` (LT-18) confirmed, with `settings/` for the Dark composition; the provisional `GvColorsLight` preview is not used | 13A (13B uses `info-*`) |
| SF-3 | Root row hierarchy (SETT-03) | As prototyped: 14px label above a 19px / 750 value with the small 12° mark; each preference keeps its current displayed value | 13A |
| SF-4 | Send feedback glyph (SETT-04) | A trailing mail glyph replaces the chevron; no leading icon; never two mail icons. The action exists only with a configured contact; with none, production omits the row and non-production shows the static status row (unchanged) | 13A |
| SF-5 | Catalogue row icon (difference 5) | Removed. The catalogue itself is not migrated | 13A |
| SF-6 | ", Selected" suffix (difference 6, a11y §4.1) | Removed from the spoken name; radio, `checked` and `selected` kept. `settingsSelected` stays in the ARB files, now unused (no ARB change in this step; SETT-07 open) | 13A |
| SF-7 | Option explanation (difference 7) | Kept in the accessible label, not moved to a hint | 13A |
| SF-8 | Keyboard model (difference 8) | One focus stop per option (Flutter); no arrow-key radio navigation | 13A |
| SF-9 | Focus after Back (SP-01 aspect 8, a11y §4.5) | Scoped keyboard focus restoration to the originating row; normal Back kept; no focus forced after touch; no global router change; widget tests | 13A |
| SF-10 | Single-word title fit (difference 18, S-2) | Bounded width-axis steps (88 → 76 → 66 → 62) with a readable fallback; no size reduction, no truncation or clipping | 13A (title rule); 13B screens |
| SF-10R | Bounded single-word title fallback (Step 55C.13BR2, 2026-11-21; narrow exception to SF-10) | After the 55C.13BR review the owner rejected the "Acknowledgeme" / "nts" split. SF-10 stays the general rule (no arbitrary size reduction, no truncation, natural wrapping, full semantics). Exception: a **single-word** Settings app-bar title that still does not fit its column at the narrowest width (`wdth` 62) takes the reference's last-resort S-2 scale, the smallest reduction that fits, **at most about 13%** of the system-scaled size, applied after system text scaling; the text, heading and accessible name are unchanged; Back keeps its 48dp target, ring and navigation; nothing overlaps or clips. Beyond the bound the approved size is kept and the word wraps. No title string, language or global compression rule; multi-word titles keep their approved wrapping; only the Settings app bar | 13BR2; approved 13BF |
| SF-11 | Width-axis narrowing (difference 13, SETT-09) | Selectively, only where needed for overlong titles, values or options; no universal compression rule; multi-word text wraps normally. **Revised for the root rows by SF-20 (Step 55C.13AR)**; still applies to the app-bar title (with SF-10) and the preference-choice options | 13A |
| SF-12 | Environment strip and badge (difference 11, SETT-08) | Out of scope: strip, badge, `MockDataBanner` and bottom navigation unchanged. **Step 55C.15:** strip and badge implemented from the Settings prototype (GI-4); **Step 55C.15R:** the badge outline is continuous, the dashed one rejected (GI-4R), awaiting visual review; SETT-08 (unlocalized labels) unchanged | 13A (unchanged); 55C.15 |
| SF-13 | PD-19 differences 3, 13, 14, 15/16, 17, 20 | **Step 55C.13B instruction:** keep the combined spoken label for read-only facts (3); the approved Primer static row for the missing-policy explanation, wording unchanged (13); the existing `GvPrimerNotice` for an unreadable record (14); flat layouts instead of legacy cards and static Primer skeletons instead of the pulsing placeholders (15/16); provider-supplied English marked English where its language is reliably known (17); external destinations as buttons with meaningful labels, never a raw URL as the label (20) | 13B; approved 13BR / 13BF |
| SF-14 | "BY-NC-SA" line breaks | **Step 55C.13B instruction:** natural line wrapping; no hyphen replaced, no character inserted, no legal string altered (the reference's `nowrap` is not reproduced) | 13B; approved 13BR / 13BF |
| SF-15 | Snackbar | Primer inverse snackbar **local to Settings**; the application-wide `SnackBarTheme` is not modified; messages, error conditions and live region preserved. Step 55C.13B extends it to every failed external hand-off of the information screens | 13A; 13B; approved 13BR / 13BF |
| SF-16 | Privacy: session line after Advertising, "Privacy" heading | **Step 55C.13B instruction:** the existing "Privacy" heading (`settingsPrivacy`); the current-session line after Advertising under the dashed separator; no duplicate heading; every conditional visibility preserved | 13B; approved 13BR / 13BF |
| SF-17 | Facts and mark values | Settings-specific components where `GvPrimerLinkRow` / `GvPrimerFact` typography does not match (no forced reuse); the Settings fact itself belongs to 13B. Dark unselected mark outline: implemented as the approved prototype draws it (`text.secondary`, 2px), not separately confirmed | 13A (rows, marks); 13B (fact: 14px label, 17px / 600 value; approved 13BR / 13BF) |
| SF-18 | Deletions | `settings_rows.dart` and `screen_sections.dart` kept while the information screens and tests use them; `GvScreenScaffold` kept (NotFoundScreen); legacy core widgets kept (catalogue). **Step 55C.13B audit:** no production consumer of either file remains; tests still use both (`settings_widget_test.dart` "GvSettingsRow speaks everything it shows"; `circuit_detail_primer_test.dart` asserts `GvInfoCard` is absent), so both are kept, as instructed | 13A (kept); 13B (kept, test consumers only); 13BR (both removed after their tests moved to Primer equivalents) |
| SF-19 | Order of the remaining surfaces | Not decided here; NotFound, app-shell navigation, environment strip / banner and the Material theme layer stay legacy. **Step 55C.15:** NotFound (55C.14), app-shell navigation, strip, badge and banner migrated (GI-1 to GI-5); the Material theme layer and the catalogue-only legacy widgets remain (GI-7; responsibilities listed in Step 55C.15F) **Step 55C.16R:** the system bars moved out of the theme layer to `GvPrimerSystemOverlay` (XS-35); the remainder is listed in Step 55C.16R | **Open** (remainder: GI-7, Step 55C.15F) |
| SF-20 | Root row width axis at large text (Step 55C.13AR, 2026-11-21; revises SF-11 for the root) | After reviewing the 55C.13A screenshots the owner replaced the per-text narrowing on the Settings root: per-text narrowing mixed widths between rows and wrapped far more than the reference at 320dp @200%. The root's row titles and values now take **one width-axis tier for the whole list**, reproducing the reference container query (`.srows`, `em` of the 15px list font under the system text size): list width <= 17em gives titles `wdth` 88 and values 76 with a 7px mark gap; <= 12.5em gives titles 70 and values 66 with -0.01em value tracking. A single word that still does not fit may narrow further only within the role's approved steps (readable fallback, SETT-09). Labels, descriptions, kickers, the app bar, the preference-choice options, the zero tracking elsewhere, icons, dividers, colours, padding, semantics and targets unchanged; no global width-axis policy, no other screen changed | 13A (13AR); approved 13AF |

- **Kept open:** TalkBack, D-pad, switch access and keyboard on a device
  (SETT-02, XS-02); real persistence and Android behaviour (SETT-05);
  real system font scaling (XS-05, XS-16); difference 12 (`lang` on
  English / Español) and difference 14 (rows as buttons) are unchanged
  Flutter behaviour, not decided; SETT-06, SETT-07, SETT-08. Not
  production readiness.

**Step 55C.13AF (2026-11-21).** The owner **visually approved** the
Settings root (Dark and Light, 390dp @100% and 320dp @200%), the SF-20
compact-list typography, the Language, Theme and Time display screens,
the option marks and their states, the Primer Settings snackbar, the
wrapping app bar, the long "Agradecimientos" title and the Send
feedback mail glyph (SF-4). No further visual refinement.

- **Canonical goldens.** Exactly nine re-baselined in
  `ghcr.io/cirruslabs/flutter:3.44.0` on a `git ls-files` copy: `settings_root_dark_en`, `settings_root_dark_es`, `settings_root_light`, `settings_root_production`, `settings_root_large_text_narrow`, `settings_language`, `settings_theme`, `settings_time`, `settings_time_large_text_narrow`. The other 67 committed goldens (the other 11 Settings,
  `acknowledgements_with_credits` and every screen, media and
  design-system golden) are byte-identical to `9576162` (SHA-256).
  The five golden suites pass 76/76 on Linux; two further full
  `--update-goldens` runs gave zero drift. The golden test font draws
  blocks and ignores `wdth`, so the goldens hold layout, colour, marks
  and wrapping; the SF-20 width values are asserted by the Archivo
  widget tests.
- **Validation.** Linux full suite 3,155 passed, 1 skipped, 0 failed;
  Windows full suite 3,152 passed, 1 skipped, 3 failed (the accepted
  Windows-only exceptions: `primary_shell_nav`, explore drivers with no
  media, explore teams with loaded marks); `flutter analyze` clean. The
  time-display propagation test now also covers Home (the Calendar
  list shows dates only, never converted; its session times are the
  Grand Prix route).
- **Still open:** XS-33; real Android font scaling; TalkBack, D-pad and
  switch access; persistence on a device; cross-screen accessibility
  items; the environment-strip redesign (SF-12); the information-screen
  decisions reserved for Step 55C.13B (SF-13, SF-14, SF-16); SF-19. Not
  production readiness or Android accessibility certification.

**Step 55C.13B (2026-11-21): information screens implemented, pending
owner visual review.** Data and updates, Acknowledgements, Privacy and
legal and App information are on Primer V2, Dark and Light
(`docs/technical/GridView_Primer_V2_Theme_Foundation.md` §6o; evidence
`build/primer-review/55c13b/`). SF-13, SF-14, SF-15 (extension), SF-16
and SF-17 (fact) implemented as instructed; SF-18 audited (both legacy
files kept: test consumers only). No golden regenerated, nothing
committed; the root and preference screens (13A) unchanged.

- **Data and attribution contracts.** Values, sources and conditions
  unchanged: environment, data source (sample, frozen with its UTC date,
  unverified, GridView service, Not configured), API version, season or
  "Not available yet", the mode's explanation; the record's sources with
  their status (frozen override), notices, optional credit / copyright /
  notice, project, terms (when recorded) and licence links; loading,
  unreadable and empty-record states; media credits loading, known empty
  or populated, and a failed read kept loading. Privacy keeps its build
  policies, Advertising Disabled, the session line's conditions, the
  policy action only when configured and the missing-policy explanation
  only outside production. About keeps the package metadata and omits an
  empty value. No network work, no ARB change.
- **For owner confirmation.** (1) The project and terms rows keep the
  recorded address (host and path, no scheme) as secondary text under a
  meaningful title, as in the approved SI-02 composition; the label is
  never the URL. (2) English marking relies on the repository-owned
  record being written in English (it has no language tag; SETT-20).
  (3) The English title "Acknowledgements" at 320dp @200% still breaks
  inside the word at `wdth` 62, because SF-10 forbids reducing the size.
- **Validation.** 71 new tests; Windows full suite: every failure is one
  of the 12 expected outdated goldens or the 3 accepted Windows-only
  exceptions; `flutter analyze` clean. Expected outdated goldens: the
  11 remaining `test/settings/goldens` (`settings_about`,
  `settings_acknowledgements_empty`, `settings_acknowledgements_populated`,
  `settings_acknowledgements_sources`,
  `settings_acknowledgements_staging_badge`, `settings_data`,
  `settings_data_frozen_en`, `settings_data_frozen_es`,
  `settings_privacy_configured`, `settings_privacy_production`,
  `settings_privacy_unconfigured`) and
  `test/media/goldens/acknowledgements_with_credits.png`.
- **Still open.** Owner visual review and canonical goldens; XS-33;
  SETT-07, SETT-09, SETT-11, SETT-18, SETT-20; SF-12; SF-19; TalkBack,
  D-pad, switch access, real Android font scaling, device persistence
  and cross-screen accessibility checks. Settings is not marked complete.
  Not production readiness or Android accessibility certification.

**Step 55C.13BR (2026-11-21): information screens visually approved;
English title pending; legacy widgets retired.** The owner reviewed the
twelve 55C.13B comparisons and **visually approved**: Data and updates
(including the unavailable season), About (including missing package
metadata), Privacy and legal (configured policy, Active and Not confirmed
sessions), Acknowledgements in Light and in Spanish at 320dp @200%, the
unreadable-attribution notice, the static loading skeletons, external-link
focus, the external-link failure snackbar, and natural wrapping of licence
identifiers and public addresses. No general refinement requested.

- **Pending final visual confirmation:** the English "Acknowledgements"
  title at 320dp @200%. At the approved 42px (21px x 200%) and the
  narrowest approved width (`wdth` 62) the single word does not fit its
  246px column and wraps as "Acknowledgeme" / "nts"; the reference's
  last-resort S-2 step scales it to 36.63px on one line instead, which
  SF-10 does not allow in Flutter. All characters shown, heading label
  unchanged, Back not overlapped, inside the viewport. Evidence:
  `build/primer-review/55c13b/cmp-title-en-{dark,light}-en-320-200.png`,
  `cmp-acknowledgements-{dark,light}-en-320-200.png`. No implementation
  change until the owner decides.
- **Confirmed by the owner:** the recorded public address stays as
  secondary text under meaningful link titles; licence identifiers and
  legal text unchanged; natural wrapping at hyphens and path separators;
  English semantics only for the bundled provider text known to be
  English, never assumed for future provider content (SETT-20 open).
- **Legacy retirement (SF-18).** `settings_rows.dart` and
  `screen_sections.dart` removed after their test consumers were replaced
  with equivalent Primer assertions (the five `GvSettingsRow`
  accessible-name tests now cover `SettingsNavigationRow`; the Circuit
  Detail "no legacy card" check now covers `GvContentCard`).
  `GvScreenScaffold`, NotFoundScreen and the catalogue's legacy widgets
  kept.
- **Still open.** The English title; canonical goldens (the same twelve);
  XS-33; SETT-07, SETT-09, SETT-11, SETT-14, SETT-18, SETT-20; SF-12;
  SF-19; TalkBack, D-pad, switch access, real font scaling and device
  persistence. Not production readiness.

**Step 55C.13BR2 (2026-11-21): SF-10R implemented, pending visual
review.** The owner approved the Step 55C.13BR legacy-widget cleanup
(`settings_rows.dart` and `screen_sections.dart` removed; the five
`GvSettingsRow` accessible-name tests replaced by six
`SettingsNavigationRow` tests, the Circuit Detail check moved from
`GvInfoCard` to `GvContentCard`; no functional reference remains) and
resolved the English title with SF-10R. Implemented in the Settings
title-fit helper only (`settingsSingleWordFitSize`, opted into by
`SettingsAppBar`): "Acknowledgements" at 320dp @200% now renders 36.60px
on one line at `wdth` 62 (Chrome 36.63px), Dark and Light identical; the
Spanish single word, all 390dp @100% titles and the multi-word titles are
unchanged; out-of-bound cases (300dp @200% / @250%, 320dp @250%) keep the
approved size and wrap. Evidence: `build/primer-review/55c13b/`
(`cmp-title-en-*`; before: `before-13br2/`; `title-measurements-13br2.txt`).
SF-13, SF-14, SF-16 and the four screens' approvals unchanged. Still
open: owner visual review of SF-10R, then the same twelve canonical
goldens; XS-33; SETT-07, SETT-09, SETT-11, SETT-14, SETT-18, SETT-20;
SF-12; SF-19; TalkBack, D-pad, switch access, real font scaling and
device persistence. Not production readiness.

**Step 55C.13BF (2026-11-21): final approval and canonical goldens.** The
owner formally approved SF-10R (Dark and Light, 320dp @200%: one line,
about 36.60px, matching the reference), all four information screens with
their reviewed states, and the legacy-widget retirement. **All eight
Settings routes are visually migrated to Primer V2.** Twelve goldens
re-baselined in `ghcr.io/cirruslabs/flutter:3.44.0`: `settings_about`, `settings_acknowledgements_empty`, `settings_acknowledgements_populated`, `settings_acknowledgements_sources`, `settings_acknowledgements_staging_badge`, `settings_data`, `settings_data_frozen_en`, `settings_data_frozen_es`, `settings_privacy_configured`, `settings_privacy_production`, `settings_privacy_unconfigured` (`test/settings/goldens/`) and `test/media/goldens/acknowledgements_with_credits.png`; the other
64 byte-identical to `08a1009`. Linux golden suites 76/76, second full
regeneration zero drift, Linux full suite 3,244 / 1 skipped / 0
failed; `flutter analyze` clean. **Step 55C.13BF2 (owner decision): 3x
capture-density correction** for `acknowledgements_with_credits`, a
test-stability fix, not a visual change: at 1x it differed by 2.99% on
Windows (platform anti-aliasing of text edges, over the 2% tolerance);
its test now captures the app root at the test view's 3x density
(1170 x 2532, same 390 x 844dp layout) like the Settings goldens, and the
golden was regenerated alone on Linux. Windows: 1.08%, passes; full suite
3,241 / 1 skipped / 3 failed (the three accepted exceptions only). No
fourth exception, no tolerance change. Not committed. Still open:
XS-33; SETT-07, SETT-09, SETT-11, SETT-14, SETT-18, SETT-20; SF-12; SF-19;
real Android font scaling; TalkBack, D-pad and switch access; device
persistence; cross-screen accessibility validation. Not production
readiness or Android accessibility certification.

## NotFoundScreen Flutter decisions (2026-11-21, Step 55C.14)

The readiness assessment (Step 55C.14, read-only at `4839d28`) found **no
NotFound prototype, Dark or Light**. The only references were general
rules: CROSS-THEME-CONSOLIDATION §3 (not-found uses the shared empty/error
state) and LT-16 (not-found states stay light in Light). The owner
resolved D1-D8:

| # | Decision | Owner resolution | Step |
|---|---|---|---|
| NF-1 (D1) | Visual reference | **Option A.** Compose from the approved Grand Prix Detail page-state precedent (Step 55C.12, `_PageMessage`, "Grand Prix not found" with "Go to Home") and the existing Primer roles. No dedicated Chrome prototype, no new design. The final composition still needs owner visual approval | 55C.14 |
| NF-2 (D2) | App bar | `PrimerDetailAppBar` with the localized app title "GridView" (`appTitle`); Back only when the route can pop; the approved circular ring (3px Dark, 1px Light) | 55C.14 |
| NF-3 (D3) | Size | `GvPrimerEmptyState` detail size for both `NotFoundKind` variants, the same inside the Standings shell | 55C.14 |
| NF-4 (D4) | Icons | The existing Material icons kept and distinct: `explore_off_outlined` (unknown route), `link_off_outlined` (invalid parameters), in `text.secondary`; no new assets | 55C.14 |
| NF-5 (D5) | Recovery button | `GvPrimerButton`, inverse pill, no hover as on Grand Prix Detail (XS-09); 48dp minimum; Enter and Space | 55C.14 |
| NF-6 (D6) | Heading semantics | App-bar "GridView" stays the route heading; the body title stays a heading and the screen's one live region; icon decorative; no extra announcement | 55C.14 |
| NF-7 (D7) | `GvScreenScaffold` | Remove it if the final audit finds no production, test or tooling consumer; replace the two Settings absence assertions meaningfully; keep every legacy widget the catalogue or design-system tests use | 55C.14 |
| NF-8 (D8) | Golden coverage | Four new canonical baselines **after** owner visual approval: `not_found_unknown_dark`, `not_found_unknown_light`, `not_found_invalid_dark`, `not_found_invalid_light_large_text`. Not generated in Step 55C.14; the 76 existing goldens unchanged | 55C.14F |

**Step 55C.14 (2026-11-21): implemented, pending owner visual review.**
`lib/features/shared/presentation/not_found_screen.dart`:

- A `Scaffold` on `surface.page` with `SafeArea(bottom: false)`, then
  `PrimerDetailAppBar(title: appTitle, backKey: not-found-back)`, then a
  private `_NotFoundBody`.
- `_NotFoundBody` is the GP `_PageMessage` composition: a `ListView` with
  bottom safe-area padding holding a detail-size
  `GvPrimerEmptyState(announceTitle: true)`, its action a left-aligned
  `GvPrimerButton` (`not-found-home`, `context.go(RoutePaths.home)`).
- `NotFoundKind`, the strings, the icons, the router, validation, route
  names, navigator ownership and shell construction are unchanged.

The legacy centred, non-scrollable `GvErrorState` and the Material
`GvAppBar` are gone from the screen. Light now uses the Primer Light roles
instead of the provisional legacy `GvColorsLight` palette.

- **One deliberate addition to the precedent (NF-6).** A list item merges
  all of its descendants into one semantics node. In the plain GP
  composition, the title's heading and live region therefore carry the
  title **and** the message as one label. Probed on Grand Prix Detail
  "Grand Prix not found": one node, `isHeader, isLiveRegion`, label
  "Grand Prix not found\nWe couldn't find this Grand Prix on the
  calendar."
  - NotFound wraps the block in `Semantics(explicitChildNodes: true)`.
    This keeps the legacy `GvErrorState` contract: the title alone is the
    heading and the live region, and the message is its own node. Nothing
    visual changes, and the shared `GvPrimerEmptyState` is untouched.
  - Grand Prix Detail is not reopened; its behaviour is recorded as
    GPD-13.
- **Routing preserved.**
  - Unmatched URLs (`errorBuilder`) and invalid driver, team or circuit
    ids render above the shell, without navigation.
  - An invalid Grand Prix season or round renders on the root navigator
    with Calendar below (Back returns to it).
  - An invalid Standings season stays inside the Standings branch (bottom
    navigation visible, no Back).
  - Back exists only when the route can pop (pushed or with Calendar
    below). "Go to Home" leaves exactly one shell with Home and nothing
    to pop.
- **Standings branch restoration (pre-existing, not changed; NF-02).**
  Measured with a temporary router probe, with an identical result on the
  `4839d28` screen:
  1. Open `/standings/drivers/abc` (or `go` to it from Standings).
  2. Tap "Go to Home": the location is `/`.
  3. Tap Standings: the branch restores `/standings/drivers/abc` and shows
     "Invalid link" again.
  4. A second tap resets it to `/standings`.

  You cannot get stuck, but the first tap is surprising. A separate fix
  needs owner approval; it is not encoded as a test contract.
- **`GvScreenScaffold` retired (NF-7).** Final audit (`git grep`, code
  only): no production, test or tool consumer once NotFound moved. The
  two Settings assertions (`settings_primer_test.dart` scenario A,
  `settings_information_primer_test.dart` `_expectPrimerChrome`) now
  assert the Primer chrome (`SettingsAppBar`) and the absence of
  `GvAppBar`, which the scaffold always drew. Strictly at least as strong;
  no test removed.
  `lib/features/shared/presentation/widgets/screen_scaffold.dart` is
  deleted. `GvErrorState`, `GvEmptyState`, `GvAppBar`, `GvIconButton`,
  `GvPrimaryButton`, `GvSecondaryButton` and the other legacy core
  widgets stay (dev catalogue, design-system tests). Historical mentions
  of the scaffold in earlier steps, READMEs and frozen prototypes are
  left as written.
- **Evidence.** `build/primer-review/55c14/`:
  - Flutter only; no Chrome reference exists.
  - `cmp-precedent-*` sets the approved GP "Grand Prix not found" beside
    NotFound for the component comparison (same icon box, title, message
    width, pill and spacing).
- **Still open.** Owner visual review; the four NF-8 goldens; SF-19 for
  the remaining global surfaces (app-shell navigation, environment strip
  and banner, Material theme layer); TalkBack, D-pad, switch access and
  real Android font scaling (XS-02, XS-05, XS-16). Not visually complete,
  not production readiness, not Android accessibility certification.

**Step 55C.14F (2026-11-21): final approval and canonical goldens.**
The owner **visually approved** NotFoundScreen in Dark and Light:
- both kinds;
- the Grand Prix Detail page-state composition;
- `PrimerDetailAppBar` with conditional Back;
- the distinct icons in `text.secondary`;
- the inverse "Go to Home";
- the keyboard focus rings;
- Spanish at 320dp @200%;
- root and in-shell placement;
- the removal of `GvScreenScaffold`.

No further visual change. The rest of the step:

- **Four new canonical goldens (NF-8),** made in
  `ghcr.io/cirruslabs/flutter:3.44.0` on a
  `git ls-files -co --exclude-standard` copy of the tree. Each is a
  `MaterialApp` capture through the real router at the test view's 3x
  density, with theme, language and platform brightness pinned:
  - `not_found_unknown_dark`: unknown route, English, 390 x 844 @100%,
    direct entry, no Back; 1170 x 2532.
  - `not_found_unknown_light`: the same in Light; 1170 x 2532.
  - `not_found_invalid_dark`: invalid Grand Prix season, deep link with
    Calendar below, **Back present**; 1170 x 2532.
  - `not_found_invalid_light_large_text`: invalid driver id, Spanish,
    320 x 693 @200%, no Back; 960 x 2079.
  - The Ahem test font draws text as blocks and Material icons as hollow
    squares; copy and icons are guarded by the widget tests.
- **Validation (Linux).**
  - Golden suites 80/80.
  - All 76 previously committed goldens byte-identical to `4839d28`
    (SHA-256).
  - A second full `--update-goldens` run gave zero drift across all 80.
  - Full suite 3,304 passed / 1 skipped / 0 failed; `flutter analyze`
    clean.
- **Validation (Windows).** 3,301 passed / 1 skipped / 3 failed: only the
  accepted exceptions (`primary_shell_nav`, `explore_drivers_no_media`,
  `explore_teams_media_dark`); the four NotFound goldens pass. No new
  exception, no tolerance change.
- **Linux exit-code audit (Step 55C.14G).** The background job that
  wrapped the canonical run reported exit 1. The cause was the
  wrapper's last command, a log display (`tail -3` over four
  logs), which GNU coreutils 8.32 rejects with "option used in
  invalid context -- 3"; the failure reproduces locally, while
  `tail -n 3` exits 0. Inside the container each validation
  command's status was captured right after it ran: goldens 0,
  analyze 0, full suite 0, regeneration 0, and the script reached
  its end. The validated copy matches the committed tree except the
  three Markdown documents, which no test reads, so the results
  stand without a rerun.
- **`GvScreenScaffold`.** Retirement confirmed: the file is absent, and
  there is no functional production, test or tool reference.
- **NF-02, owner decision (P1, required before release; confirmed in
  Step 55C.14G).** A confirmed functional defect (pre-existing
  go_router branch restoration). Its targeted correction is scheduled for
  the navigation work of Step 55C.15. Router behaviour is unchanged here,
  and the defect is not encoded as a test contract.
- **GPD-13, owner decision.** Investigating the same semantics-node
  separation for the Grand Prix Detail page states is approved as a
  separate, narrow accessibility correction. It must keep the visual
  output unchanged, avoid duplicate announcements and add semantics tests
  before closure. Grand Prix Detail is unchanged in Step 55C.14.
- **Still open.** NF-02 (Step 55C.15); GPD-13; SF-19 (app-shell
  navigation, environment strip and banner, Material theme layer);
  TalkBack, D-pad, switch access and real Android font scaling (XS-02,
  XS-05, XS-16). Not committed. Not production readiness or Android
  accessibility certification.

## Step 55C.15 global UI integration (2026-11-22)

Status: **visually approved (Step 55C.15F); canonical goldens validated;
awaiting commit approval.** GI-4, GI-5, GI-6 and GI-9 were decided by the
owner in Step 55C.15R (below).

**Sources used (frozen or approved).**

- Bottom navigation: the shared `shared/components/nav.css` and the approved
  Home pages `cross-screen-refinement/cross-theme-54b/home-{dark,light}`
  (XT-6; LT-9 for Light); the S-3 fallback in `standings/standings.css` and
  `explore/explore.css`; the Flutter component `GvPrimerBottomNav` (Steps
  55B.2 and 55B.2.1, approved in Step 55B.5).
- Environment strip and badge: `settings/settings.css` and
  `consolidation-pilot/settings/settings.css` (`.envstrip`, `.envbadge`).
  Their difference 11 was "pending decision", so this step's review is
  what approves them.
- Banner: Grand Prix states spec 26
  (`consolidation-pilot/grand-prix-detail/gpd.css`, `.banner`) and its
  Light page `cross-screen-refinement/light-rollout-b2/gp-states-light`.
- No prototype was modified.

| ID | Decision | Status |
|---|---|---|
| GI-1 | The app shell uses `GvPrimerBottomNav` with its geometry unchanged: 68 + inset, oxide 60 × 32 slab at 12°, labels 13px 800/600, inward focus ring, regular → condensed → 2 × 2. Destinations, order, labels, routes and branch behaviour are unchanged. Standings shows the Primer bar glyph in place of the trophy (Step 55B.2.1). The shell scaffold background is `surface.page`, the only thing the translucent bar can show | Awaiting owner review |
| GI-2 | Selected-label fallback (S-3): a new opt-in, `GvPrimerNavItem.selectedLabelFallback`. The shell turns it on for Standings and Explore only, as their prototypes do; Home and Calendar keep the regular selected label. It applies only in the condensed and 2 × 2 fits. Without it, the Spanish "Clasificaciones" broke between letters at 320 @200% | Awaiting owner review (S-3 was provisional) |
| GI-3 | NF-02 corrected (below) | **Closed** (Step 55C.15F canonical validation) |
| GI-4 | Environment strip: `surface.page`, badge centred, `max(6, top inset)` above, gutter at the sides, 6px below (the prototype's 2px plus the 4px it adds to the following app bar). Badge: 1.5px dashed `text.secondary` pill (the shared outline painter's 2.5 / 2.5 dash), 2 × 10 padding, Archivo 13/700, line height 1.3, letter spacing 0.02em, `text.primary`. DEV and STAGING differ by text only, as before | **Superseded by GI-4R** (dashed outline rejected) |
| GI-5 | Fixture banner (approved, GI-5R): 1.5px `text.accent` outline (Ember in Dark, Red Oxide in Light), radius 8, 8 × 12 padding, Archivo 14/700 at line height 1.45, centred, `text.accent`. No icon: the reference has none, so the legacy flask is gone. Wording and every screen's placement are unchanged | Awaiting owner review |
| GI-6 | **Large-text conflict.** The approved 2 × 2 bar is 155px at 320 @200% (the legacy pill was 89px), so the content area loses 66px (9.5% of 693). Eight approved-screen tests now fail at real Archivo metrics: the Standings list viewport is 303px = 43.7% (contract ≥ 50%); in Explore Spanish, the first row is no longer built under the status; in Explore Circuits, the last row (≈293px) is taller than the visible area (251px). Not changed and not re-baselined | **Resolved by GI-6R** |
| GI-7 | Legacy retirement. Removed: `GvBottomNav` / `GvBottomNavItem` (no consumer left), `GvLoadingSemantics` (tests only) and the unused `toneForEventStatus` / `toneForFinishStatus`. Kept: the catalogue-only legacy widgets (their catalogue sections and five design-system goldens); `GvRemoteImage` / `GvImagePlaceholder` (production media); `GvStatusTone` (`gv_rows`, catalogue); the Material theme layer (`gridview_theme.dart`: `MaterialApp` defaults, system overlay styles, and the legacy `GvRadii.sm` read by `GvPrimerStatusChip`) | Done; remainder recorded, SF-19 stays open |
| GI-8 | Badge semantics: the label "Build environment: DEV" never reached the semantics tree, before this step either. Every route's modal barrier carries a `BlockSemantics`, which dropped the strip. In non-production builds the app below the strip is now its own semantics container | Done |
| GI-9 | Golden strategy: with the test font every label is too wide, so the bar takes its 2 × 2 layout in every shell golden, even at 390 @100% where the app shows one row | **Resolved by GI-9R** (Ahem kept) |

**NF-02: root cause.**

- `StatefulShellRoute` stores each branch's last route-match list, and
  `goBranch` restores it.
- An invalid Standings season renders the not-found screen *inside* the
  Standings branch. "Go to Home" (`go('/')`) therefore left
  `/standings/drivers/abc` stored, and the next Standings selection
  restored it.
- go_router has no public API that rewrites a stored branch location
  without navigating to it.

**NF-02: correction.**

- `ShellBranchResets` (`lib/app/router/shell_branch_resets.dart`), one per
  router.
- For the invalid Standings routes, the router passes `NotFoundScreen` an
  `onGoHome`. It records a reset for the branch the screen is shown in
  (read from the shell, not a hard-coded index), then goes Home.
- `AppShell` consumes the reset on the next selection of that branch with
  `goBranch(index, initialLocation: true)`, exactly as re-selecting the
  active branch already does. It drops the reset when any other navigation
  activates that branch.
- No route, parameter rule or presentation changed.

**NF-02: tests.** The twelve tests in
`test/navigation/nf02_branch_recovery_test.dart` pass. They cover direct
entry; `go` and `push` from Standings; repeated selection; a spent reset; a
deep link after recovery; other branches' nested state; valid restoration
without recovery; and Back and system Back. With the fix disabled, five of
them fail.

**NF-02: related cases, unchanged.**

- An invalid Grand Prix route (above the shell) does not show the defect.
  Calendar renders correctly afterwards, although go_router keeps
  reporting the stale URI.
- Leaving an invalid Standings route through the bar (not through "Go to
  Home") and coming back restores the "Invalid link" screen, which is
  normal branch restoration. That screen offers "Go to Home".

### Step 55C.15R owner decisions and corrections (2026-11-22)

Status: **visually approved in Step 55C.15F.**

| ID | Decision or correction | Status |
|---|---|---|
| GI-6R (D1) | **The two-row large-text navigation is approved** at 320 @200%. The navigation keeps its approved composition, text size and targets. The eight legacy-geometry tests were examined one by one. None was a clipped, overlapped or unreachable UI; each assumed the legacy pill's height. They now check real-content reachability (below) instead of viewport shares or above-the-fold positions | **Approved** (owner) |
| GI-9R (D2) | **Canonical goldens keep the Ahem test font.** Ahem draws every glyph as a 1em square, so each navigation label measures much wider than in Archivo. The fit rule (regular → condensed → 2 × 2) therefore picks the 2 × 2 layout in every shell golden, even at 390 @100% where the app shows one row. This is a test-font limitation and does not reflect the production layout mode. Real-font layout is covered by the Archivo layout tests and the Archivo review captures. No golden infrastructure, tolerance or font changed | **Approved** (owner) |
| GI-4R (D3) | **Environment badge: continuous outline.** The dashed outline is rejected because dashes mean "unknown value" (VS-1). The pill shape, 1.5px width, `text.secondary` colour, padding, type, DEV / STAGING text and behaviour are unchanged; only the dash pattern is removed (`GvPrimerOutline(dashed: false)`). No new colour, token or badge variant | Corrected; awaiting visual review |
| GI-5R (D4) | **The icon-free Primer banner is approved.** Text, visibility rules and layout are unchanged | **Approved** (owner) |
| GI-10 | **Short-viewport overflow fixed.** The 11px overflow at 320 × 480 @200% with STAGING, the banner and the 2 × 2 navigation came from the selected Spanish "Clasificaciones" wrapping onto a second line, which made the bar 185px. The S-3 fallback (GI-2) had already removed it: the bar is 155px with the fallback, and the overflow returns at 185px when the fallback is turned off. A probe of 324 configurations found the underlying cause: the pinned Standings (235px) and Explore (287px) headers do not fit a 480px viewport once the strip and the navigation are present. Explore overflowed by up to 42px, and by 10px in production with a 24dp bottom system inset; Standings overflowed by up to 29px. Correction: the shared `PrimerPinnedHeaderLayout` (Standings and Explore). It is identical to `Column(header, Expanded(body))` while the header leaves the list at least two 48dp targets. Below that, the header scrolls away with the page and the list gets the whole viewport. The header and the body are separate focus traversal groups, so Tab never returns to a header control scrolled above the viewport. No type, target or visibility rule changed. Calendar and Home have enough room in the same matrix and are unchanged | Done; 324-configuration probe clean |
| GI-11 | **Remaining large-text compromise.** At 320 @200% three blocks are taller than the visible list (header to navigation): the Standings leader card (316px in English, 352px in Spanish, against a 303px list); a Spanish Explore status block (≈279px against 251px); and an Explore circuit row (≈293px against 251px). None is clipped. Every line can be scrolled whole into view and each block takes a tap. Real-device evaluation is open (XS-08, S-1) | Recorded |

**The eight Step 55C.15 failures and their replacements.**

| Test (file) | Previous assertion | Actual behaviour | All content reachable? | Clipping, overlap or scroll failure? | Replacement |
|---|---|---|---|---|---|
| Standings large text EN and ES (`standings_primer_test.dart`) | list viewport ≥ 50% of 693 | 303px = 43.7%. Leader card 316 / 352px, taller than the list; standard rows fit | Yes | None | List top ≥ header bottom and list bottom ≤ navigation top. Every driver row is scrolled to, whole in the visible area, and takes a tap there; the leader card is checked line by line. Each standard row fits whole. The last row ends above the navigation. No exception |
| Explore status placement ES dark and light (`explore_primer_test.dart`) | first row built directly under the status on opening | Status ≈279px against a 251px list, so the first row is beyond the build extent | Yes | None. The status scrolls with the rows (EF-1) and nothing is drawn behind the navigation | The status block is reachable (every line). The first row is reached, whole and tappable, after the status. The last row is reached and ends above the navigation |
| Explore Circuits matrix EN / ES × dark / light at 320 @200% (`explore_primer_test.dart`) | the last row's top is below the header at maximum scroll | Circuit row ≈293px against a 251px list | Yes | None | Whole-row check kept where the row fits. Otherwise every text line and the media slot (when present) can be scrolled whole into view, and the row (its one action) takes a tap |

Shared helper: `test/support/reachability.dart` (`visibleListArea`,
`expectReachable`, `receivesPointer`, `scrollToEnd`).

**NF-02 status.** The targeted correction is provisionally accepted by the
owner. Its twelve regression tests pass. The branch index is now read from
the shell when "Go to Home" is selected, instead of a hard-coded constant.

**Separate observed behaviours.** These are not part of NF-02 and are not
changed. They are recorded so they are not mistaken for correct behaviour:

- **NF-03.** Leaving an invalid Standings page through another tab, then
  selecting Standings, shows "Invalid link" again. Normal branch
  restoration keeps the stored location.
  - Assessment: a minor user-facing defect. The user returns to a state
    with no content, although it offers "Go to Home" and a second
    Standings tap resets the branch.
  - Proposed future correction (owner decision): re-entering a branch
    through the bar opens the branch root when its stored location is a
    not-found state.
- **NF-04.** After "Go to Home" from an invalid Grand Prix route (above
  the shell), Calendar renders correctly, but go_router keeps reporting
  `/calendar/notyear/3` as the current URI.
  - Assessment: not visible on Android, which has no address bar. It
    could affect anything that reads the URI, such as route logging,
    state restoration or a future web build.
  - Investigation needed; no routing change was made.

### Step 55C.15F final approval and canonical validation (2026-11-22)

**Owner visual approval.** The owner approved the combined Steps 55C.15 and 55C.15R:

- the bottom navigation in Dark and Light (one row at normal text, two rows at 320 @200%), with its selected states and focus rings;
- the responsive Standings and Explore layouts and `PrimerPinnedHeaderLayout`;
- the continuous environment badge (GI-4R) and the environment strip;
- the icon-free fixture banner (GI-5R);
- the NF-02 recovery;
- the safe legacy cleanup.

No further design change.

**Fixture-banner reachability (Step 55C.15F check).**

- In the 320 × 480 @200% STAGING captures, the fixture data is enabled (`usesMockData` true) and `MockDataBanner` is built.
- It sits where its contract puts it: inside the scrolling status block at the top of the list (Standings `StandingsStatusBlock`, Explore `ExploreStatusSliver`).
- On opening, the unpinned header fills the visible area, so the banner starts at y 361 (Standings) or 413 (Explore). That is below the navigation top at 325, inside the list viewport that ends there; nothing covers it.
- Scrolled to, it lies whole between the strip and the navigation (y 71–213) and receives a tap.
- The reviewed frames were the opening state and the list end, so the banner was simply off both.
- Evidence: `combo-staging-banner-{standings,explore}-at-banner-*` captures; `test/app/short_viewport_primer_test.dart` asserts the banner's reachability.
- No defect; visibility conditions unchanged.

**Canonical goldens: 90.**

- **38 re-baselined** (shared navigation or strip):
  - `test/screens/goldens/`:
    - Calendar: `calendar_empty`, `calendar_populated`, `calendar_stale`.
    - Explore: `explore_circuits_populated`, `explore_drivers_populated`, `explore_empty`, `explore_teams_populated`.
    - Grand Prix Detail: `grand_prix_detail_staging_badge_es`.
    - Home: `home_cached_stale`, `home_large_text_narrow`, `home_partial`, `home_post_race`, `home_pre_event`, `home_race_weekend`, `home_season_empty`, `home_season_finale`, `home_tied_leaders`.
    - Light theme: `light_calendar`, `light_explore`, `light_explore_first_load`, `light_home`, `light_standings`, `light_standings_stale`.
    - Shell: `primary_shell_nav`.
    - Standings: `standings_constructors_populated`, `standings_drivers_populated`, `standings_empty`, `standings_fractional_tied`, `standings_loading`, `standings_refresh_failure`, `standings_stale`.
  - `test/media/goldens/`: `explore_circuits_media_dark`, `explore_drivers_media_dark`, `explore_drivers_media_failed`, `explore_drivers_media_light`, `explore_drivers_no_media`, `explore_teams_media_dark`.
  - `test/settings/goldens/`: `settings_acknowledgements_staging_badge`.
- **10 added** in `test/screens/goldens/` by `test/screens/global_ui_golden_test.dart`. Each is cropped to the surface, pinned to English, sample fixture data and no animations, and uses the Ahem test font:
  - `shell_nav_dark` and `shell_nav_light`: 390 × 844 @100%, Standings selected, 1170 × 375.
  - `shell_nav_dark_large_text` and `shell_nav_light_large_text`: 320 × 693 @200%, 960 × 645.
  - `env_strip_dev_dark`, `env_strip_dev_light`, `env_strip_staging_dark`, `env_strip_staging_light`: Home, status-bar inset 24, 1170 × 162.
  - `mock_data_banner_dark` and `mock_data_banner_light`: Home, 1074 × 177.
- **42 byte-identical** to `4b5a6d5` (SHA-256).
- The navigation crops are the bar itself. Its outer shadow falls on the page and is left out, so these goldens do not depend on the content behind the bar.

**Validation.** All runs are on the working tree.

- **Linux** (`ghcr.io/cirruslabs/flutter:3.44.0`, on a `git ls-files -co --exclude-standard` copy):
  - Golden suites: 90 / 90.
  - The 42 unaffected goldens are byte-identical to `4b5a6d5`.
  - A second full `--update-goldens` run gave zero drift across all 90.
  - `flutter analyze` is clean.
  - Full suite: 3,400 passed / 1 skipped / 0 failed.
- **Windows:** 3,397 passed / 1 skipped / 3 failed. The failures are only the three accepted exceptions: `explore_drivers_no_media` (2.10%), `explore_teams_media_dark` (2.16%) and `primary_shell_nav` (2.26%). All ten new goldens pass. No new exception and no tolerance change.
- **Overflow probe:** 324 configurations, clean. The probe covered 6 screens; 320 × 480 @200%, 320 × 693 @200% and 390 × 844 @100%; EN and ES; DEV, STAGING and production; bottom insets 0, 24 and 48.

**NF-02 closed.** Its twelve regression tests pass on Linux and Windows. NF-03 and NF-04 stay open as separate issues.

**Material theme layer (SF-19 remainder, still open).** `gridview_theme.dart` still provides:

- the `MaterialApp` theme and `appBarTheme.systemOverlayStyle`: status-bar icon brightness, and the system navigation bar colour, which is still the legacy background colour;
- the ambient text theme, including the 0.25px letter spacing behind XS-33;
- the defaults that already-approved screens rely on (scaffold, dialog and snackbar fallbacks).

`GvPrimerStatusChip` reads `GvRadii.sm` (8px, the same value as `GvPrimerLayout.radiusSm`). Retiring the layer would change approved rendering, so it stays.

**Still open.** NF-03, NF-04, XS-34, GPD-13, XS-33; the Settings items (SETT-02, SETT-07, SETT-08 and the others); TalkBack and real Android accessibility, D-pad and switch access, real Android font scaling, device preference persistence; the cross-screen accessibility validation. Not release readiness or Android accessibility certification.

**Still open (as of Step 55C.15R; see Step 55C.15F above).**

- NF-03 and NF-04 (assessment above; owner decision).
- The SF-19 remainder (GI-7) and GPD-13.
- XS-08, XS-31 and XS-32 on a device.
- TalkBack, D-pad, switch access, real Android font scaling and device
  persistence.
- XS-33, SETT-08 and the other Settings items.

This is not production readiness or Android accessibility certification.

## Step 55C.16R cross-screen corrective pass (2026-11-22)

The Step 55C.16 read-only audit (at `200d07a`) confirmed four issues. The
owner approved one coordinated correction of all four, with no change to
any approved composition. Implementation: Theme Foundation §6r.

| ID | Decision | Status |
|---|---|---|
| CP-1 (GPD-13) | Grand Prix Detail page states (not found, first-load failure) get the NotFound semantics boundary (`Semantics(explicitChildNodes: true)` around the block, DD NF-6). The title alone is the heading and the one live region; the message is its own node; the button keeps its label. Section states unchanged | **Done**; GPD-13 resolved |
| CP-2 (NF-03) | A branch that still shows an invalid page opens at its initial location when re-entered through the bar. The invalid page reports itself while mounted (`ShellBranchInvalidPage`, counted per branch in `ShellBranchResets`); the shell reuses `goBranch(initialLocation: true)`. No route, validation range, string or NotFound presentation change. The NF-02 "Go to Home" request is kept | **Done**; NF-03 resolved |
| CP-3 (XS-35) | The system bars follow the Primer theme in every environment through one application-level `AnnotatedRegion` (`GvPrimerSystemOverlay`): transparent status bar, inverse icons, navigation bar = `surface.nav` over `surface.page`. The environment strip sets no style of its own. No new colour, token or platform configuration | **Done** (flutter_tester); device rendering open |
| CP-4 (XS-34) | Keyboard traversal in `PrimerPinnedHeaderLayout` (Standings, Explore) brings the top of a target taller than its scroll viewport, with its focus ring, into view; targets that fit keep Flutter's default; not a global focus change | **Done** (flutter_tester); device keyboard / D-pad open |

**XS-35 background.** Before the migration each screen's Material `AppBar`
applied `appBarTheme.systemOverlayStyle`. Primer screens have no `AppBar`, so
from Step 55C.1 onward production asked the platform for Flutter's
`MaterialApp` fallback (correct status-bar icons, a black navigation bar in
both themes), while development and staging builds took the legacy style
from the environment strip. Staging devices therefore never showed the
production behaviour. The Step 55C.15F note that the theme layer "still
provides" the system bars was wrong for production; it is corrected here.

**Measured (flutter_tester, Archivo, 320 × 693 @200%).**

| Focused block | Before (hidden top) | After |
|---|---|---|
| Standings leader card, EN (305.9px; list 303px) | 2.9px under the header | top at y 239, list top 235 (ring 4px visible) |
| Standings leader card, ES (341.9px) | 38.9px | top at y 239 |
| Explore circuit row (309.7px; list 251px), EN and ES | 58.7px | top at y 287 = list top (ring inside the row) |

**Deferred, unchanged.**

- **NF-04 (P3).** After an above-shell Grand Prix route is left with `go`
  (an invalid one, a not-found one, or a valid deep link), go_router 17.3.0
  keeps the Calendar branch's matches without the Grand Prix but with its old
  URI, so `GoRouterState.uri` reports `/calendar/notyear/3` while Calendar
  renders. Checked consequences: Back, Settings push / pop, the A → B → A
  collapse and `openSettings` behave correctly; re-selecting Calendar clears
  it. The app has no `refresh()`, `refreshListenable`, state restoration,
  route observers or analytics. A `router.refresh()` would re-parse the URI
  and show the invalid page again, so **reopen NF-04** if any of those, or a
  web build, is introduced. No router change.
- **XS-33.** The inherited Material `bodyMedium` 0.25px letter spacing stays;
  removing it would shift every Ahem golden and was not approved.
- **SF-19 remainder.** Kept for legitimate Material responsibilities:
  `MaterialApp`, `Scaffold`, page transitions, the snackbar queue (Settings'
  own Primer snackbar sits on it), Tooltip defaults on the app-bar buttons'
  long press, the development catalogue (including `GvAppBar`, the only
  remaining consumer of `appBarTheme.systemOverlayStyle`), and the
  production media placeholder `GvImagePlaceholder` (legacy colours; shown
  only when media exists and is loading or failed, so not in production
  today).
- **SETT-18.** Unresolved licensing gate before any monetised release; no
  licence wording, attribution record or provider contract changed.

**Validation (working tree on `200d07a`, nothing committed).**

- New tests: GPD-13 6, NF-03 15, XS-35 11, XS-34 13 (45). Each fix was
  reverted temporarily to confirm its tests fail without it: GPD-13 4 of 6
  (the two section-state controls pass both ways), NF-03 10 of 15, XS-35 the
  7 app-level tests, XS-34 12 of 13 (the fitting-row control passes).
- The twelve NF-02 tests pass unchanged.
- `flutter analyze`: no issues (Windows and Linux). `dart format`: clean.
- **Linux** (`ghcr.io/cirruslabs/flutter:3.44.0`, on a
  `git ls-files -co --exclude-standard` copy): full suite 3,445 passed /
  1 skipped / 0 failed. All six golden suites regenerated **in the copy
  only**: the 90 goldens are byte-identical (SHA-256) to `200d07a`. No
  repository golden regenerated, no tolerance changed.
- **Windows:** 3,442 passed / 1 skipped / 3 failed, the accepted exceptions
  only, at their known values (`explore_drivers_no_media` 2.10%,
  `explore_teams_media_dark` 2.16%, `primary_shell_nav` 2.26%).
- Visual neutrality: the four corrections add a semantics boundary, a
  lifecycle-only widget, an `AnnotatedRegion` (no paint) and a traversal
  callback; the unchanged 90 goldens and the unchanged screen tests are the
  evidence.
- Integration note (not changed, CI out of scope): the CI "Canonical golden
  freshness" job regenerates five golden files and omits
  `test/screens/global_ui_golden_test.dart` (ten goldens added in Step
  55C.15F). Those ten are still compared by the ordinary `flutter test`
  step, but their zero-drift gate does not cover them.

**Still open.** TalkBack on the Grand Prix page states; system-bar rendering
on Android 14 or earlier (three-button and gesture navigation) and Android 15+,
Dark and Light, production build; keyboard, D-pad and switch access on the
oversized blocks (XS-32, XS-34); real font scaling and insets (XS-05, XS-16);
preference persistence after a process restart (SETT-05). Not production or
release readiness.

## Cross-screen items for the final consolidation

Kept as originally recorded. Now tracked in the backlog: shared core and
components XS-09, title fit XS-07, header budget XS-06, Home touch-target
labels XS-17.

- One shared `primer-core.css`. It is currently copied byte-identical into
  `calendar/`, `standings/` and `explore/`.
- Shared pinned header, notice, segmented control and empty/error block.
  Today Standings and Explore each carry copies.
- Calendar should adopt the title-fit rule and, if validated, the header
  budget.
- Home's touch-target evidence files have garbled labels (a validation-script
  escaping bug fixed since then). The measured sizes are unaffected.
