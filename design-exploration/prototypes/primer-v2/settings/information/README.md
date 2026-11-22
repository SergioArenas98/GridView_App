# GridView — Primer V2: Settings information screens (part 2 of 2)

<!-- primer-v2-status-notice -->
> **Historical record.** This document describes an early per-screen prototype that the approved Dark and Light references replaced. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../README.md#validation-output).

Hand-built HTML/CSS prototype of the four read-only Settings destinations:
**Data and updates**, **Acknowledgements**, **Privacy and legal** and **App
information**. Dark-first, English and Spanish. Not a Flutter implementation.
Delivered 2026-11-08. **Owner review, 2026-11-08: visual compositions
provisionally approved** (`../../DESIGN-DECISIONS.md` SI-01 to SI-04; the
complete Spanish 390×844 Acknowledgements in a second review). Not
production-ready: 320×693 and 200% text have automated evidence only
(backlog SETT-17); uncovered differences stay pending (PD-19, SETT-10). The
English "Source notice" on Spanish pages is provider-derived and deliberately
untranslated (SETT-20). The rest of this README is the delivery as built. Part 1 (`../`, root and preferences, provisionally
approved as SP-01) was not modified.

## Files

| File | Scenario (all EN + `.es.html`) |
|---|---|
| `data.html` | **D1** production, GridView service, season 2026 stored |
| `data-sample.html` | **D2** development, bundled sample data |
| `data-frozen.html` | **D3** development, frozen provider capture of 2026-10-07 |
| `data-unverified.html` | **D4** development, descriptor unreadable: unverified origin |
| `data-season-unavailable.html` | **D5** production, GridView service, no season stored yet |
| `acknowledgements.html` | **A1** production: bundled record loaded, media credits known empty |
| `acknowledgements-frozen.html` | **A2** development, frozen capture overrides the source status |
| `privacy.html` | **P1** production, policy configured, session **Active** |
| `privacy-starting.html` | **P2** production, policy configured, session **Starting** |
| `privacy-unconfirmed.html` | **P3** production, no policy configured, session **Not confirmed** |
| `privacy-non-production.html` | **P4** development: no diagnostics policy, missing-policy explanation |
| `about.html` | **I1** metadata resolved (1.2.1, build 7) |
| `about-unresolved.html` | **I2** metadata unreadable: GridView only |
| `states.html` | **Development-only gallery** (11 frames) and the scenario hub |
| `information.css` | New components only; loads after `../primer-core.css` and `../settings.css` (reused, not copied) |
| `information.js` | Presentation-only: external-link hand-off and failure message; app-bar title fit (S-2) |
| `build.py` | Generator (stdlib). Edit it, not the HTML: `python -B build.py` |
| `validation-20261108-211707/` | Screenshots, metrics, reports and the scripts that produced them (`bash run.sh`) |

`?openfail=1` on any page is the **development-only failure scenario**: every
external open fails and the existing message appears (labelled on the page).

## Flutter behaviour inspected

`lib/features/settings/presentation/information_screens.dart`,
`acknowledgements_screen.dart`, `widgets/data_source_attribution_card.dart`,
`widgets/settings_rows.dart`, `widgets/fixture_data_label.dart`;
`application/app_info.dart`, `data_source_attributions.dart`,
`external_links.dart`; `domain/data_source_attribution.dart`;
`lib/features/shared/application/providers.dart` (`usesMockDataProvider`,
`currentSeasonProvider`, `mediaAttributionsProvider`),
`fixture_data_identity.dart` (`captureDateLabel`), `domain_status.dart`
(`mediaCategoryLabel`), `entities/media.dart`;
`lib/core/observability/diagnostics_policy.dart`,
`observability_activation.dart`, `observability.dart`;
`lib/core/network/api_config.dart`, `data_source_config.dart`;
`lib/app/environment/app_environment.dart`, `lib/app/router/route_paths.dart`;
`lib/core/widgets/gv_skeleton.dart`; `content/attribution/data-sources.json`;
both ARB files; `test/settings/settings_widget_test.dart`,
`settings_golden_test.dart` (and its 20 goldens), `test/support/router_harness.dart`;
audit §3.11–3.12 (DA, AB, PR, AC).

Rules the prototype reproduces exactly:

- **Data source** (`_dataSource`): mock data → frozen label with date,
  unverified label, or Sample data; otherwise remote → GridView service;
  fixture mode without mock data (production misconfiguration) → Not
  configured.
- **Explanation** (`_explanation`): only remote without mock data promises
  downloads; a frozen mock build states its capture date and that it does
  not update; everything else gets the bundled "does not download" text.
- **Capture date**: `captureDateLabel`, UTC `YYYY-MM-DD`, never localized.
- **Environment**: `AppEnvironment.label` (PRODUCTION / DEV / STAGING), not
  localized in Flutter.
- **Attribution**: read at build time from the record (`data-sources-v3`,
  one source today, rendered as a list so any number works). Status string by
  record status (`dormant`, `active`, `automatic`); a frozen build whose
  capture credits the source overrides it with the frozen string. Null
  creator, copyright and warranty notices render nothing. Terms row only when
  `termsUrl` is present. Provider values are shown as published, never
  translated.
- **Record states**: loading → skeleton with "Loading"; unreadable → the
  existing "Data source details could not be loaded." (never an empty list);
  a record with zero sources → no section at all.
- **Media credits**: known empty → "No attributions are stored yet." only
  after the read answers; not yet answered **or stream error** → skeleton
  (Flutter does not distinguish them, AC18); populated → category label +
  `attribution · licence`.
- **Privacy**: crash and performance rows state the **build policy**
  (Configured in production, Disabled otherwise); Advertising is always
  Disabled; the session line appears only with the production policy and an
  activation other than `notConfigured` (Starting / Active / Not confirmed);
  policy action only when configured; the missing-policy explanation only
  outside production; production with no policy shows nothing.
- **App information**: name falls back to GridView; an empty version or
  build is omitted (`GvSettingsField`).
- **Navigation**: root-navigator destinations, back action only, no bottom
  navigation; Back goes to `../index.html` (production) or
  `../non-production.html` (development) so the matching root is shown. The
  DEV/STAGING strip sits above the app bar, never over the title.
- **No unsupported functionality**: no refresh, sync, cache, endpoint,
  provider selector, progress, privacy switch or permission toggle; no URL
  except the record's three links (and Google Fonts).

## Visual design

Reading screens, not sports screens: no hero, figure, board or diagonal
panel. They reuse Settings' composition (open rows on graphite, inset
hairlines, kicker `h2` with trailing rule, detail app bar, Chalk snackbar)
and add five restrained components:

1. **Facts group** (`.facts`, `<dl>`): label 14px secondary above value 17px
   600. Quieter values than the preference rows (19px 750), which answers the
   SP-01 note on label/value balance for read-only data. "Not available yet"
   is set in secondary weight: an answer about missing data, not a value.
2. **Long-form text** (`.lede`, `.prose`, `.explain`, `.note`): 16px, 1.55
   line height, 36em measure (~65–70 characters). Nothing truncated or
   clamped; Spanish paragraphs keep their full length.
3. **Source block** (`.source`): provider name as `h3` (22px, the strongest
   text after the title), then status, modification, licence and
   non-endorsement notices as paragraphs, supplied notices as labelled prose,
   then the link rows. Repeats per record entry with 40px between sources.
4. **External-link row** (`.xrow`): the Settings row with Flutter's own
   open-in-new glyph at the end **instead of** the in-app chevron, so a row
   that leaves GridView never looks like one that navigates inside it.
   Displayed address in secondary text and allowed to break anywhere (paths
   have no word boundaries); licence tokens such as "BY-NC-SA" never split at
   their hyphens.
5. **States** (`.istate`, `.skel`, `.notice`): a static 20px skeleton bar;
   the Primer notice (tray, hairline border, Ember alert icon) for the
   unreadable record; plain secondary text for the known-empty media result.

**Privacy: policy vs session.** The three fixed build statements come first;
"App reporting this session" follows under a **dashed** rule (Primer's
"not fixed / not confirmed" line) and the diagnostics note sits directly
under it. So "the line above" in the note is literally the session line,
which in Flutter it is not (Advertising sits between them). No new copy.

**App-bar title.** Wraps between words, uncapped. A single word wider than
the column ("Agradecimientos" at 320 @200%) narrows the width axis
88 → 76 → 66 → 62 and is scaled down only if still too wide: the approved
S-2 rule. Part 1's `../settings.css` lets such a word break mid-word; it was
not changed (XS-07, XS-09).

## Accessibility

| Topic | Prototype |
|---|---|
| Headings | One `h1` (title) → `h2` sections → `h3` provider name. Each section is a labelled region; each source an `article` named by its provider |
| Reading order | Visual order = DOM order = Tab order (checked). Privacy: policy rows, then the session line, then the note that qualifies it |
| Facts | `<dt>`/`<dd>` pairs ("term: Crash reporting", then "Configured"). Flutter speaks one merged node "Crash reporting, Configured" (difference 3) |
| Link labels | One stop per row; name = title, value, description in visual order: "License, CC BY-NC-SA 4.0, Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International". Attribution rows are links (`target=_blank`, `noopener noreferrer`); the privacy policy is a button (no URL exists in the prototype) |
| Leaving GridView | Visual: open-in-new glyph, no chevron, displayed host. Spoken: role "link" only. **No existing ARB string says "opens outside GridView"**, so no spoken cue was invented (SETT-11) |
| Targets | Every interactive element ≥48px in all 108 runs (`touch-targets` in the JSON files) |
| Contrast | Chalk 15.19:1, secondary 7.95:1 on graphite; Ember icon 7.44:1; skeleton bar is decorative |
| Loading / error | Loading = `role="status"` with the localized "Loading" text; unreadable record = `role="status"` notice; open failure = polite status region with a fresh text node per failure; focus never moves |
| Focus | 2px Ember ring on every stop; `scroll-padding-top` keeps focused rows clear of the sticky chrome (checked by tabbing every stop at 320 @200%) |
| Language | Provider-supplied English values (warranty notice, licence title) carry `lang="en"` on Spanish pages |
| Motion | None. The skeleton is static (Flutter's pulses unless animations are disabled); snackbar and row transitions compute to 0s under reduced motion |
| Text scaling | Nothing capped except the S-2 last resort for a single overlong title word. 200% at 320 wide: no clipping, no horizontal scroll, no mid-word split |

## Validation (`validation-20261108-211707/`)

Chrome headless over CDP, mobile emulation, DPR 2, Archivo loaded in every
run; 200% = root font size. Scripts copied from part 1 and extended
(`capture.mjs`, `layout.mjs`, `a11y.mjs`) plus `interact.mjs` and
`data-check.py` written here. `bash run.sh` re-runs everything.

| Check | Result |
|---|---|
| Captures: 4 primary screens × EN/ES × 390×844, 320×693 × 100%, 200% (32 runs, screenshots); 9 other scenarios × EN/ES at 390×844 and 320 @200% (36, screenshots) and at 320×693 and 390 @200% (36, measured only); gallery × EN/ES × 390 and 320 @200% (4) — **108 runs, 190 screenshots** | Width exactly as requested; outside-viewport, clipped, spill, text < 12.5px, content under the app bar: **0** in every run (`summary.txt`). Screenshots step through the whole page (top → bottom), so the full source-credit block and the long Spanish notices are covered: e.g. `es-acknowledgements-320x693-text200-01…08.png` (4,700px) |
| Touch targets < 48px | **0** in all 108 runs |
| Layout (`layout-check.txt`, 108 configurations = all 26 pages × 4 + gallery) | **0 problems**: no mid-word split (URLs exempt), no text colliding with the glyph, text inside its row, every row ≥48px, measure ≤36em, badge strip clear of the app bar |
| Interaction (`interaction.txt`) | **126 / 126**: recorded links only and in order, new context + noopener, glyph not chevron, displayed host/path, failure message (EN/ES) with no URL, focus kept, re-announced, hides after 4 s; policy button without URL; Back target per environment on all 26 pages; no toggle/input/radio/bottom nav; one `h1`; Tab order = DOM order and nothing hidden under the chrome at 320 @200%; reduced motion; no animation |
| Data fidelity (`data-check.txt`, reads the HTML, not the generator) | **300 / 300**: every keyed string equals its ARB value; every DA/AB/PR/AC rule per scenario; attribution values equal the record; frozen date unlocalized; only the right explanation per mode; test fixtures only in the gallery; no technical strings; four rules re-read from the Dart source |
| Accessibility tree (`accessibility-tree.txt`) | All 28 pages: headings with levels, regions, terms, link names |
| Impeccable `detect` (installed 4.8.0, engine 0.1.18, **not updated**) | Source (28 pages, CSS, JS): **0 findings** (`impeccable-detect.txt`). Rendered over a local server, 30 URLs incl. failure scenarios, at 390×844 and 320×693: **0 findings, 0 advisories** (`impeccable-detect-rendered.txt`) |

**Defects found and corrected during validation:**
1. "Agradecimientos" split mid-word in the app bar at 320 @200% (part 1's
   title style allows it). Fixed with the S-2 title fit; text size untouched
   unless a single word still overflows.
2. "CC BY-NC-SA 4.0" broke at its internal hyphens. Tokens kept whole.
3. Gallery: mini app-bar titles and captions split words at 320 @200%; the
   title fit now covers frames and captions narrow their cut.
4. The layout checker paired one frame's badge with another frame's app bar
   (false positive); now it checks only the page's own chrome.
5. Impeccable advisories: "2026-10-07" alone on the last line of the Spanish
   frozen data source, and a straggler in a prototype annotation. Fixed with
   `text-wrap: pretty`.
6. The data checker joined text nodes with spaces and broke "CC BY-NC-SA" at
   the new spans (checker bug, not a page defect).

**Screenshots to review first** (validation folder):
`en-data-390x844-01.png`, `es-data-frozen-390x844-01.png`,
`en-data-season-unavailable-390x844-01.png`,
`en-acknowledgements-390x844-0[12].png`, `es-acknowledgements-390x844-0[12].png`,
`es-acknowledgements-320x693-text200-01…08.png`,
`en-acknowledgements-frozen-390x844-0[12].png`,
`en-privacy-390x844-01.png`, `es-privacy-starting-390x844-01.png`,
`en-privacy-unconfirmed-390x844-01.png`, `en-privacy-non-production-390x844-01.png`,
`es-privacy-320x693-text200-0*.png`, `en-about-390x844-01.png`,
`es-about-unresolved-390x844-01.png`, `int-en-ack-open-failed.png`,
`int-es-privacy-open-failed.png`, `en-states-390x844-0[1-4].png`.

## Coverage of the audit checkpoints

| ID | Coverage |
|---|---|
| DA01 Environment | **Covered**: PRODUCTION (D1, D5), DEV (D2–D4); STAGING via the gallery strip |
| DA02 Data source | **Covered**: GridView service, Sample data, frozen with date, unverified origin; Not configured in gallery frame 10 |
| DA03 API version | **Covered**: `1` from `kGridViewApiVersion` |
| DA04 Current season | **Covered**: 2026; "Not available yet" (D5) |
| DA05 Explanation | **Covered**: offline (D1, D5), bundled (D2, D4, frame 10), frozen (D3). Bundled and frozen never promise downloads |
| DA06 Frozen date | **Covered**: `2026-10-07`, UTC, unlocalized, in source and explanation |
| AB01 App name | **Covered**: metadata (I1) and fallback (I2) |
| AB02 / AB03 Version, build | **Covered**: shown (I1), both omitted (I2). Version-only or build-only: rule reproduced, **no fixture** (SETT-15) |
| AB04 Independence | **Covered** |
| PR01 Independence | **Covered** |
| PR02 / PR03 Policy | **Covered**: Configured (P1–P3, frame 9), Disabled (P4) |
| PR04 Session | **Covered**: Starting (P2), Active (P1), Not confirmed (P3), omitted for no policy (P4) and `notConfigured` (frame 9). Moved below Advertising (difference 10) |
| PR05 Advertising | **Covered**: always Disabled, never inferred |
| PR06 Diagnostics note | **Covered**, full text, directly under the session line |
| PR07 Policy action | **Covered**: configured (P1, P2), absent (P3, P4); URL never printed (the Flutter test fixture `https://example.org/privacy` is not used) |
| PR08 Missing-policy explanation | **Covered**: non-production only (P4); production omits it (P3) |
| PR09 Open failure | **Covered**: `?openfail=1` and gallery frame 8 |
| AC01 Independence | **Covered** |
| AC02 Active data source | **Covered**: GridView service (A1), frozen label (A2) |
| AC03 Provider name | **Covered**: from the record, `h3` |
| AC04 Status | **Covered**: automatic (record), frozen override (A2), active and dormant (gallery 6, 7, test fixtures) |
| AC05–AC07 Notices | **Covered**, full text |
| AC08 / AC09 Creator, copyright | **Covered**: null in the record → omitted; present in gallery frame 6 (test fixture) |
| AC10 Warranty | **Covered**, verbatim, `lang="en"` on Spanish pages |
| AC11 / AC12 Project, terms | **Covered**: host + path text, full recorded URL opened; terms omitted when null (frame 6) |
| AC13 Licence | **Covered**: name as value, full title as description |
| AC14–AC16 Media credits | **Covered** in gallery frame 5 (golden fixture): localized category, attribution, licence appended only when supplied |
| AC17 Record states | **Covered**: loading (frame 1), unreadable (frame 2), empty record (frame 3) |
| AC18 Media states | **Covered**: loading (frame 1), known empty (A1), not answered / stream error (frame 4, indistinguishable by design) |

## Fixture and configuration provenance

No production data is shown. Values come from:

| Value | Source |
|---|---|
| All copy | `lib/l10n/app_en.arb`, `app_es.arb` (`data-k` kept on elements) |
| Jolpica F1 attribution | `content/attribution/data-sources.json` (`data-sources-v3`), read at build time |
| Season 2026 | `router_harness.dart` default `currentSeason = 2026`; `null` for D5 |
| Frozen capture 2026-10-07T22:41:45.852Z | `settings_golden_test.dart` `_frozenCapture` |
| App metadata 1.2.1 / 7 | `settings_golden_test.dart` `_appInfo`; `AppInfo.unknown` for I2 |
| Session states | `ObservabilityActivation` values (exercised in `bootstrap_orchestration_test.dart`; no Settings screen test renders them, SETT-15) |
| Policy configured | `ExternalLinkConfig.privacyPolicy` present; the address is never shown or used |
| Media credits (gallery only) | Golden 'acknowledgements populated' |
| Example Source active / dormant (gallery only) | `settings_widget_test.dart` fixtures |

Non-ARB strings: "Back" / "Atrás" (Material); PRODUCTION / DEV / STAGING and
"Build environment: …" (hard-coded in Flutter); prototype annotations and
gallery captions (prototype chrome).

## Differences from Flutter (require approval)

| # | Difference | Flutter | Prototype |
|---|---|---|---|
| 1 | Cards removed | Fields and rows in `GvInfoCard` | Open rows on graphite, inset hairlines (as SP-01 aspect 2) |
| 2 | Section headings | `GvScreenSection` titles | Kicker `h2` with trailing rule (as part 1) |
| 3 | Field semantics | One merged node "label, value" | `<dt>` / `<dd>` pair |
| 4 | Provider name | `cardTitle` header inside the card | `h3`, 22px, outside any card |
| 5 | Notice text | `bodyM`, card width | 16px / 1.55, 36em measure |
| 6 | Supplied notices | Label + `bodyL` value | Label + regular-weight prose |
| 7 | External rows | Leading `open_in_new` icon **and** trailing chevron | One trailing open-in-new glyph, no chevron |
| 8 | Licence tokens | May break at hyphens | "BY-NC-SA" kept whole |
| 9 | Privacy section heading | `settingsPrivacyAndLegal`, repeating the screen title | `settingsPrivacy` ("Privacy" / "Privacidad"): an existing ARB string, currently unused in `lib/` |
| 10 | Privacy row order | Crash, Performance, **Session**, Advertising | Crash, Performance, Advertising, then **Session** above the note |
| 11 | Session separation | Same style as the policy rows | Dashed rule above the session line |
| 12 | Diagnostics note | `caption` | 15px secondary, 1.5 line height |
| 13 | Missing-policy explanation | `bodyM` paragraph | Static row in the action position (as part 1's feedback explanation) |
| 14 | Unreadable record | Text in a card | Primer notice with alert icon, `role="status"` |
| 15 | Media empty / loading | Text or skeleton in a card | Plain secondary text / skeleton without card |
| 16 | Skeleton | Pulses (unless animations are disabled) | Static |
| 17 | `lang="en"` | No per-span locale | On provider-supplied English values in Spanish pages |
| 18 | App-bar title | Single line, ellipsis | Wraps, uncapped; S-2 width-axis fit for one overlong word |
| 19 | "Not available yet" | Same style as values | Secondary weight |
| 20 | Rows as links / button | `GvSettingsRow` buttons | Attribution rows are `<a target=_blank>`; policy row is a button |

No difference adds a setting, route, action, copy or data. Route paths are
unchanged.

## Design-system assessment

| Candidate | Verdict |
|---|---|
| Read-only information row (`.fact`) | **New, reusable.** The Settings row without interaction; same hairline and gutter rules. Also fits Driver/Team "profile facts" if consolidation wants one fact pattern |
| Long-form disclosure text (`.lede`, `.prose`, `.note`) | **New token set, not a component**: 16px/1.55/36em for reading, 15px/1.5 secondary for qualifiers. Belongs in the type scale |
| Attribution source block (`.source`) | **Composition** of `h3` + prose + facts + link rows; no new primitives. Keep as a Settings pattern, not a shared component |
| External-link row (`.xrow`) | **Variant of the Settings row** (trailing glyph swap). Part 1's feedback row should use the same mechanism with the mail icon the owner prefers (SETT-04) |
| Metadata group (`.facts`) | Same as the information row, grouped |
| Loading / unavailable (`.skel`, `.notice`) | **Reused**: the Primer notice (Standings/Explore) and a skeleton bar; both belong in the shared empty/error set (XS-09) |
| Separate legal design system | **Not needed and not created** |

## Critical assessment

| | Assessment |
|---|---|
| Consistency with Primer V2 and part 1 | **Strong.** Same chrome, kicker, rows, hairlines, snackbar; nothing borrowed from the sports boards |
| Trust and restraint | **Strong.** No decoration competes with the legal text; the provider name and section kickers do the structuring |
| Readability of long passages | **Good.** 36em measure, 1.55 leading, full Chalk for notices. At 320 @200% the Spanish Acknowledgements is 4,700px (about 7 screens): long, but that is the content |
| Policy vs session distinction | **Good**, by order and the dashed rule, without new copy. It still relies on the reader noticing a dashed line; the note does the real work |
| External links | **Good visually, weak for screen readers**: no spoken "opens outside GridView" exists in the ARB files (SETT-11) |
| Data and updates | **Adequate.** Four facts and one paragraph; correct, but the screen is sparse and the mode difference is carried by words alone (by design) |
| App information | **Plain.** Three facts and the statement. Faithful; nothing more is supported |

What still looks weak:
1. The diagnostics note says "the line above" even where no session line
   exists (P4, frame 9): existing copy (SETT-12).
2. "Not configured" pairs with the bundled-data explanation, and
   Acknowledgements says "GridView service" for that same misconfigured build
   (SETT-13).
3. A failed media-credit stream shows a skeleton indefinitely (SETT-14).
4. The sticky chrome reaches 167px (24% of 693px) on development pages with
   a two-line Spanish title at 320 @200%: inside the 25% header budget, but
   close (XS-06).

## Remaining issues

Tracked in `../../DESIGN-BACKLOG.md`: SETT-10 (review and differences above),
SETT-11 (spoken external cue), SETT-12 (note copy), SETT-13 (Not configured
pairing), SETT-14 (media error state), SETT-15 (fixture coverage; the
Privacy heading string is difference 9 under SETT-10); and cross-screen XS-01 (light theme: these pages
have no light preview at all), XS-02, XS-05, XS-09, XS-16.

Not done, as instructed: no Flutter, backend, persistence, API or model
change; part 1 (`../`) and Explore's prototypes unchanged; nothing installed;
Impeccable not updated; no commit.
