# GridView — Primer V2: Settings and preferences (part 1 of 2)

<!-- primer-v2-status-notice -->
> **Historical record.** This document describes an early per-screen prototype that the approved Dark and Light references replaced. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../README.md#validation-output).

Hand-built HTML/CSS prototype of the **Settings root** and the three
**preference selection screens** (Language, Theme, Time display), dark-first,
English and Spanish. Not a Flutter implementation. Delivered 2026-11-08,
**awaiting owner review**. The information pages (Data and updates,
Acknowledgements, Privacy and legal, App information) are **not designed
here** (part 2); their rows link to placeholder anchors.

## Files

| File | What it is |
|---|---|
| `index.html` / `index.es.html` | **Scenario A**: production build, support contact configured (the build default), default values |
| `production-no-contact[.es].html` | **Scenario A2**: production build, no contact configured: feedback omitted |
| `non-production[.es].html` | **Scenario B**: development build, no contact configured: DEV strip, feedback explanation, Developer section |
| `language[.es].html`, `theme[.es].html`, `time[.es].html` | The three selection screens |
| `states[.es].html` | Development-only gallery (5 static frames) and the hub of interactive scenarios |
| `settings.css` | Settings styles; loads after `primer-core.css` |
| `primer-core.css` | Byte-identical copy of `../circuit-detail/primer-core.css` (backlog XS-09) |
| `settings.js` | Minimal **presentation-only** behaviour (see "Persistence in the prototype") |
| `strings.js` | Generated: the EN/ES strings, read from `lib/l10n/app_en.arb` and `app_es.arb` |
| `build.py` | Generator (Python stdlib). Edit it, not the HTML: `python build.py` |
| `validation-20261108-194048-final/` | Screenshots, metrics and reports, plus the five scripts that produced them |

**Interactive scenarios** (also linked from `states.html`), applied with URL
parameters on any page:

| Parameter | Values | Meaning |
|---|---|---|
| `language`, `theme`, `time` | wire tokens (`system`/`english`/`spanish`, `system`/`dark`/`light`, `device`/`event`/`both`) | Current preference; an unknown token falls back to the documented default, as `fromWire` does |
| `env` | `production`, `development`, `staging` | Build environment (`AppEnvironment`) |
| `contact` | `configured`, `none` | Whether a support contact is configured (`ExternalLinkConfig.supportContact`) |
| `device` | `en`, `es` | Simulated device language that **System default** resolves to |
| `fail` | `1` | **Development-only failure scenario**: every save fails |

## Flutter behaviour inspected

`lib/features/settings/presentation/settings_screen.dart`,
`preference_choice_screen.dart`, `preference_screens.dart`,
`widgets/settings_rows.dart`; `lib/features/settings/domain/preference_labels.dart`;
`lib/features/settings/application/external_links.dart`;
`lib/core/preferences/preference_values.dart`, `preferences_repository.dart`,
`locale_resolution.dart`; `lib/app/environment/app_environment.dart`;
`lib/app/router/route_paths.dart`;
`lib/features/shared/presentation/widgets/environment_badge.dart`,
`screen_scaffold.dart`; `lib/core/theme/tokens/gv_colors_light.dart`;
`test/settings/settings_widget_test.dart`, `settings_golden_test.dart` and its
goldens; `docs/technical/GridView_Accessibility.md` §4.1, §4.5, §4.6, §4.11;
audit §3.11, §4.6, §4.7, §5.8.

Facts the prototype reproduces:

- **Grouping is not "Preferences / Information / Feedback".** Flutter has four
  sections: *Preferences* (Language, Theme, Time display); *Data and
  application* (Data and updates, Acknowledgements, App information); *Privacy
  and support* (Privacy and legal, Send feedback); *Developer* (Component
  catalogue, non-production only). The prototype keeps exactly this.
- Each preference row shows its localized current value; destination rows
  have no value.
- **Feedback:** a configured contact gives a tappable row (an external action,
  not a route). No contact: production omits the row entirely; development and
  staging show a non-tappable row with "No contact address is configured."
  (`showsConfigurationStatus`). **In a normal production build the contact is
  configured** (`SUPPORT_CONTACT` has a default), so Scenario A shows the row.
  The address is never displayed, by Flutter or the prototype.
- **Developer:** only when `!environment.isProduction`. An unknown `APP_ENV`
  parses as development, never production.
- Selection applies immediately; the screen stays open; there is no Save or
  Apply. A failed write reverts only that preference to the last stored value
  and shows `settingsSaveFailed`; a superseded write (a newer selection for the
  same key) is a success and shows nothing.
- Defaults: Language **System default**, Theme **Dark**, Time display
  **Device time**. Options follow enum order.
- **System default** follows the first device locale GridView supports,
  otherwise English. English and Español are always written in their own
  language.
- Theme and language changes keep the router and the open screen (Flutter
  re-renders the selection screen in the new language in place).
- Settings and its sub-screens are root-navigator routes (`/settings`,
  `/settings/language`, `/settings/theme`, `/settings/time`): back action only,
  no bottom navigation; back returns to the origin with its scroll position.
- The environment badge (`DEV` / `STAGING`) sits in its own strip above every
  app bar (`EnvironmentBadgeOverlay`), never over a title. Its text and its
  label "Build environment: …" are not localized in Flutter.

## Visual design

Settings is a functional screen. It reuses Primer V2's tokens, Archivo and
interaction affordances, and deliberately has **no board, band, hero, number
or diagonal panel**. Identity comes from four restrained moves:

1. **Width axis as hierarchy.** Section kickers at normal width (13px, bold,
   secondary); destination titles at normal width (17px, 600); the **current
   value** heavier and slightly condensed (19px, 750, `wdth` 92). The value is
   the thing a reader scans for, so it is the strongest text in a preference
   row; the preference name sits above it as a label.
2. **Kicker with trailing rule**, from Circuit Detail's sheet. The Developer
   kicker's rule is **dashed**, Primer's "not confirmed / not production"
   pattern (also used for the DEV badge and prototype annotations).
3. **One selection mark: the livery cut.** A 12° parallelogram, the shape of
   the selected navigation slab. Not selected: 2px outline in secondary
   (7.95:1). Selected: **Ember fill + graphite check** (7.44:1) and the label
   steps from 550 to 800 weight. Selection therefore changes shape, fill,
   glyph and weight; colour is never the only signal.
4. **The same mark, small and filled, precedes each current value on the
   root.** Root and option screens read as one system: the mark you see beside
   "Dark" on the root is the mark that sits beside Dark on the Theme screen.

Rows are **open on graphite** (no cards): hairlines inset to the 16px gutter,
full-bleed press fill, ≥60px rows (options ≥64px). Only meaningful glyphs: a
chevron for in-app destinations, an **up-right arrow for Send feedback**
(it leaves the app), none on the non-interactive explanation row. No icon per
setting.

The **snackbar** is an inverted Chalk surface with a 12° oxide seam (oxide is
allowed as a surface detail on Chalk), above the bottom safe area.

**App bar:** Primer's detail bar (back + title) with three Settings-specific
changes: the title is the page `h1`; it **wraps instead of truncating**; and
it is 21px and **uncapped** (detail bar: 18px, capped at 26px), because
Settings has no hero and the title carries the screen. At 320 @200% Spanish
"Horario mostrado" takes two lines; the sticky chrome is then 114px (16% of
693px, inside the 25% header budget of S-1).

**Large text:** nothing is capped or scaled down. On a narrow list the width
axis narrows first (the approved title rule S-2), via a container query in em
of the list, so it responds to text size and screen width alike: values
`wdth` 92 → 76 → 66, titles → 88 → 70, option labels → 88 → 78. Words never
split mid-word (a break at a real hyphen, "design-/system", is allowed).

### Provisional light theme (not approved)

The Primer V2 light system is not consolidated (backlog XS-01), so **no
Primer V2 light palette is proposed here.** Choosing Light (or System on a
light device) re-tones the page with a **provisional** mapping taken
one-to-one from Flutter's `GvColorsLight`, only so the Theme choice can be
seen working:

| Primer role | Flutter light token | Value | Contrast |
|---|---|---|---|
| ground | background | #F1F4F9 | — |
| tray / raised | surfaceElevated / surfaceElevatedAlt | #FFFFFF / #E5EAF2 | — |
| text | textPrimary | #0F131A | 16.88:1 |
| secondary text | textMuted | #566070 | 5.77:1 |
| Ember (accent, mark fill) | accentPrimary | #C62719 | 5.14:1 on ground |
| check on mark | onAccentPrimary | #FFFFFF | 5.67:1 |
| hairline | divider | #C7D0DE | decorative |

A dashed "Prototype only: provisional light preview…" annotation appears
whenever it is active, and gallery frame 5 is captioned the same way. It must
not be read as a light-theme design.

## Persistence in the prototype (limitations)

`settings.js` only **imitates** Flutter's visible behaviour. It is not the
application's persistence and implies nothing about it.

- State lives in the URL query (carried on every in-prototype link) and in
  page memory. **Nothing is written to storage.** Reloading the bare file
  shows the defaults again; Flutter would show the stored value.
- A write is simulated with a 280 ms timer. With `fail=1` every write fails:
  the previous value is restored (radio state, language, theme) and
  `settingsSaveFailed` appears for 4 s (Material's default) in a polite
  `role="status"` region. A newer selection during a pending write supersedes
  it, as the repository's per-key generation does.
- Selecting the already-selected option does nothing in the prototype;
  Flutter re-writes the same token (invisible unless that write fails).
- The DEV/STAGING strip, the contact and the device language are URL
  parameters here; in Flutter they are build-time configuration and the
  platform locale.
- The failure scenario exists only for review. It is labelled on the page.

## Accessibility

| Topic | Prototype |
|---|---|
| Root rows | One focus stop each (a link), name = title, value or description in visual order: "Language, System default", "Component catalogue, Development-only design-system gallery". The comma is an inline clipped span, so there is no stray space and nothing visible |
| Non-interactive feedback explanation | Plain text, not focusable, no chevron |
| Selection screens | `role="radiogroup"` labelled by the screen `h1`; each option `role="radio"` with `aria-checked`, named by its label, **described** by its explanation (`aria-describedby`) |
| Duplicate "Selected" (report §4.1) | **Not reproduced**: state comes only from `aria-checked`; no ", Selected" suffix. 0 radios with the state word in their name (`accessibility-tree.txt`) |
| Keyboard / D-pad (report §4.6) | One tab stop for the group (roving tabindex, entering on the checked option); arrows, Home and End **move focus only**; **Space and Enter both select**. Arrows do not select because every selection applies at once: arrowing through Language would re-render the app at each keystroke. This deviates from the ARIA radio pattern (arrow = select) on purpose; needs TalkBack/keyboard validation |
| Focus restoration (report §4.5) | Back from a selection screen returns focus to the row that opened it (`from=` on the back link). Verified for Theme and Language |
| Focus after selecting | Stays on the tapped option, also when the language changes or a write fails |
| Own-language labels | English and Español carry `lang="en"` / `lang="es"`, so a screen reader pronounces them correctly |
| Contrast | Chalk 15.19:1, secondary 7.95:1 on graphite; unselected mark outline 7.95:1, selected Ember mark 7.44:1, check 7.44:1 on Ember; snackbar 15.19:1. Unlike the Flutter segmented control (report §4.11), no small text sits on a red fill |
| Touch targets | All ≥48px in all 52 runs; rows 60–64px+, Back 48×48 (`touch-targets.txt`) |
| Hover | Only under `(hover: hover)`, so a tapped option never keeps a second "selected-looking" fill on a phone (defect found and fixed) |
| Reduced motion | Snackbar slide and row fills compute to 0s |
| Live region | The snackbar region is always in the tree, empty until a failure; a fresh text node is inserted so repeated failures are announced again |

## Validation (`validation-20261108-194048-final/`)

Chrome headless over CDP, mobile emulation with touch, no dependencies.
Scripts: `capture.mjs` (copied from Circuit Detail: radios added to the
target list, chrome height read from strip + bar), `interact.mjs`, `a11y.mjs`
(copied, with checked state and the duplicate-state check), `layout.mjs`,
`data-check.py`. Archivo loaded in every run.

| Check | Result |
|---|---|
| Captures: EN/ES × 6 pages × 390×844 and 320×693 × 100% and 200%, plus the gallery (390, and 320 @200%) — **52 runs** | Width exactly as requested; elements outside the viewport, clipped text, spill and text under 12.5px: **0 / 0 / 0 / 0** in all runs (`summary.txt`) |
| Touch targets < 48px | **0** in all 52 runs |
| Layout (`layout-check.txt`, 51 configurations incl. staging, non-default values, light) | **0 problems**: no mid-word break, no collision of text with the mark or the chevron, text inside its row, every row ≥48px, badge strip never over the app bar |
| Interaction (`interaction.txt`) | **62 / 62 pass**: immediate apply, screen stays open, root value updates, focus restoration, failure revert + message (EN and ES), language re-render in place, System default resolution, unknown-token fallback, superseded writes, keyboard model, environment/contact rules, strip on sub-screens, no hover residue, reduced motion |
| Data fidelity (`data-check.txt`, against ARB and Dart, not the generator) | **55 / 55 pass**: every keyed string equals its ARB value; enum order and defaults read from `preference_values.dart`; row and section order read from `settings_screen.dart`; environment/contact rules; no e-mail address, no URL except Google Fonts, no Save/Apply, no extra preference, no "Selected" in page text |
| Accessibility tree (`accessibility-tree.txt`) | Roles, names, checked states and descriptions as tabled above |
| Impeccable `detect` (installed 4.8.0, not updated) | **0 findings** on the 14 pages, `settings.css`, `primer-core.css`, `settings.js` (`impeccable-detect.json`); **0** on 17 rendered pages at 390×844 over a local server, incl. light, staging and failure (`impeccable-detect-rendered.json`) |

**Defects found and fixed during validation:**
1. At 320 @200% "Predeterminado" and "Acknowledgements" broke mid-word. Fixed
   with the width-axis container rule; text size untouched.
2. Accessible names read "Language , System default" (the visually hidden
   comma was blockified). Now an inline clipped span.
3. A tapped option kept its hover fill on touch. Hover now only under
   `(hover: hover)`; the test taps with touch events.
4. A Spanish gallery caption spilled at 320 @200% (page 327px wide).
5. Impeccable: gallery frames flush against their rules (warning); snackbar
   straggler and unbalanced gallery heading (advisories); flat type hierarchy
   (advisory: 13 / 15 / 18px) resolved by the 21px uncapped title.

**Note on the root tab-order trace** (`interaction.txt`, "root tab order").
The trace starts on the app bar's Back link, presses Tab nine times and
records each stop as `id || textContent`. It lists the eight rows and then an
**empty ninth entry** (the line ends in `>`). The ninth stop has no id and no
text content. On this page the only focusable element like that is the
icon-only Back link (`aria-label="Back"`); the Developer section is `hidden`
in the default production scenario. So the ninth Tab most likely wrapped focus
back to Back. The accessibility tree (`accessibility-tree.txt`, index.html)
names every link, Back included, and has no unnamed control. The empty entry
therefore shows a limit of the trace's text-based labelling. It is not a
confirmed unnamed control. This was not re-run; a future trace should record
each stop's accessible name. (In Step 42C a trailing space after the final
`>` was removed for Git's whitespace check; the recorded stops are unchanged.)

Screenshots to review first (in the validation folder):
`en-index-390x844-01.png`, `es-index-390x844-01.png`,
`en-non-production-390x844-0[12].png`, `es-production-no-contact-390x844-01.png`,
`en-language-390x844-01.png`, `en-theme-390x844-01.png`,
`en-time-390x844-01.png`, `es-time-320x693-text200-0[12].png`,
`int-theme-save-failed.png`, `int-language-es-save-failed.png`,
`int-root-after-theme-focus-restored.png`, `int-time-keyboard-focus.png`,
`int-staging-language.png`, `int-theme-light-provisional.png`,
`en-states-390x844-0[12].png`.

## SE01–SE13 coverage

| ID | Element | Coverage |
|---|---|---|
| SE01 | Preference section and row names | **Covered.** "Preferences"; Language, Theme, Time display, as labels above their values |
| SE02 | Current language | **Covered.** System default / English / Español from `PreferenceLabels`; updates after a change |
| SE03 | Current theme | **Covered.** System / Dark / Light |
| SE04 | Current time display | **Covered.** Device time / Event time / Both |
| SE05 | Data/application destinations | **Covered** (rows and order). Destination pages not designed (part 2) |
| SE06 | Privacy/support destinations | **Covered.** Privacy and legal; Send feedback when configured (Scenario A; external-arrow glyph) |
| SE07 | Absent contact explanation | **Covered.** Non-production only (Scenario B); production omits it (A2) |
| SE08 | Developer destination | **Covered.** "Developer" + Component catalogue with its description, non-production only; nothing added |
| SE09 | Language choices | **Covered.** Three options; System fallback explanation; own-language names with `lang` |
| SE10 | Theme choices | **Covered.** Three options; System explanation; Dark default. Light shown only as the provisional preview |
| SE11 | Time choices | **Covered.** Three options, each with its explanation |
| SE12 | Selected state | **Covered, changed:** mark shape/fill/check + weight; radio semantics; **no composed "Selected" suffix** (difference 6) |
| SE13 | Save failure | **Covered** (simulated): previous value restored, localized message, screen stays open |

## Fixture and configuration provenance

No production data is shown or needed. Every visible product string comes
from the ARB files (`data-k` keys kept on the elements). Scenario
configurations come from the code and tests:

| Scenario | Source |
|---|---|
| A: production, contact configured | `AppEnvironment.production`; `ExternalLinkConfig.fromEnvironment()` (`SUPPORT_CONTACT` default) |
| A2: production, no contact | golden "settings root production with nothing configured" |
| B: development, no contact | golden harness default (`AppEnvironment.development`, `ExternalLinkConfig()`) |
| B2: staging, contact configured (gallery link) | `AppEnvironment.staging`; badge text `STAGING` |
| Defaults | `AppPreferences.defaults` (system / dark / device) |
| Failure | `PreferenceWriteOutcome.failed` path; message `settingsSaveFailed` |
| Light preview | `GvColorsLight` |

Non-ARB strings: "Back" / "Atrás" (Material back tooltip, as in every Primer
V2 prototype); the badge text and its "Build environment: …" label
(hard-coded in Flutter); prototype annotations and gallery captions
(prototype chrome, English and Spanish written for the gallery only).

## Differences from Flutter (require approval)

| # | Difference | Flutter | Prototype |
|---|---|---|---|
| 1 | Rows open on graphite with inset hairlines | Sections in `GvInfoCard` cards | No cards; full-bleed press fill |
| 2 | Section headings as kickers with trailing rule (Developer dashed) | `GvScreenSection` titles | Same text, quieter style, `h2` kept |
| 3 | Preference rows lead with the value | Title (bodyL) then value (label style) | Name as a small label, value as the prominent 19px line with a small filled mark |
| 4 | Send feedback glyph | Mail icon at the start + chevron | No leading icon; up-right "external" arrow instead of the chevron |
| 5 | Component catalogue icon | `widgets_outlined` icon | No icon (description kept) |
| 6 | Selected state | Radio glyph (red), `checked` + `selected` flags **and** ", Selected" in the label | 12° mark (outline vs Ember fill + check) + weight; `aria-checked` only; no suffix (report §4.1 recommendation; `settingsSelected` becomes unused; the widget test asserting the word would change first) |
| 7 | Option description | Composed into one label with the name | Name as the accessible name, explanation as the accessible description |
| 8 | Keyboard model in the option list | Each option its own focus stop; Enter/Space activate | One tab stop, arrows move focus (no selection), Enter/Space select |
| 9 | Focus after Back | Returns to the top of Settings (report §4.5) | Returns to the originating row |
| 10 | App-bar title | Single line (GvAppBar) | Page `h1`, wraps, 21px, uncapped |
| 11 | Environment badge style | Elevated pill, informational-blue border | Pill with dashed secondary border (no blue in Primer). Placement unchanged |
| 12 | `lang` on English/Español | No per-label locale | `lang="en"` / `lang="es"` |
| 13 | Large-text strategy | Text grows; Flutter has no width axis | Width-axis narrowing before wrapping (S-2 rule); needs a Flutter equivalent (variable font axis) |
| 14 | Root rows are links | `Semantics(button: true)` | `<a>` (web navigation semantics); Flutter would stay a button |

No difference adds a setting, a route, copy or data. Route paths and
navigation contracts are unchanged.

## Critical assessment

| | Assessment |
|---|---|
| 1. Consistency with Primer V2 | **Strong.** Tokens, Archivo axes, detail app bar, kicker, 12° cut, Ember-as-accent, Chalk snackbar. Nothing borrowed from the sports boards |
| 2. Simplicity and clarity | **Strong.** Three groups of rows, one glyph per row at most, no decoration beyond the mark |
| 3. Preference discoverability | **Good.** Names are secondary-coloured 14px labels: readable (7.95:1) but quieter than the values. A reader hunting for the word "Theme" scans small text; worth checking in review |
| 4. Selected-value readability | **Strong.** The value is the strongest text in its row on the root, and the selected option is unmistakable by shape, fill, check and weight |
| 5. Navigation | **Good.** Clear back, chevrons, external arrow for feedback; focus restoration. Placeholder targets for part-2 pages |
| 6. Information hierarchy | **Good.** Title → kicker → value/title → label/description. Kickers are deliberately quiet; they could read as too faint on a dim OLED (device check) |
| 7. Accessibility | **Good in emulation.** Radio semantics, single announcement of state, 48px+ targets, AA contrast, focus restoration. No TalkBack run; the arrow-moves-focus-only model is a judgement call |
| 8. Localization | **Good.** Spanish values and titles are the longest strings; they wrap or narrow, never split or truncate |
| 9. Functional fidelity | **Strong** on rules and copy (55 data checks, 62 behaviour checks). Persistence is simulated |
| 10. Longer explanatory text | **Good.** Descriptions wrap at a 34em measure under the label; the Spanish System explanation reaches five lines at 320 @200% without crowding |

What still looks weak:
1. The three Ember marks on the root are the only colour on the screen; at a
   glance they can read as bullets rather than "current value". The
   connection to the option mark is only learned after opening a screen.
2. At 320 @200% the narrowest width cut (`wdth` 66–70) makes long values
   ("Predeterminado del sistema") dense. Legible in the screenshots, but it is
   the limit of the technique.
3. The root is long for what it is in Scenario B at 200% (1,429px EN /
   1,695px ES at 320), as any settings list at that size.
4. The selection screens are visually sparse (2–3 rows on an empty page);
   correct for the content, but the top padding and row rhythm could be
   tuned on a device.

## Remaining issues (not fixed; for review)

| ID | Issue | Notes |
|---|---|---|
| SET-01 | **Light theme** not designed; only the labelled provisional mapping from `GvColorsLight` | Backlog XS-01. Final tokens at consolidation |
| SET-02 | **Event time and the missing-zone fallback**: an event with no declared IANA zone shows device time, but the Event time explanation does not say so | Flutter copy unchanged; any clarification needs new ARB copy (owner and translator). Nothing written |
| SET-03 | `settingsSelected` would become unused with difference 6 | Remove, or keep for another use; test first (report §4.1) |
| SET-04 | Environment badge and its "Build environment: …" label are not localized | Existing Flutter behaviour; non-production only |
| SET-05 | Root rows: link (web) vs button (Flutter) semantics | Difference 14; TalkBack wording differs |
| SET-06 | Keyboard model (difference 8) not validated with TalkBack, a hardware keyboard or a D-pad | XS-02; report §4.6 still open in Flutter |
| SET-07 | Width-axis narrowing has no direct Flutter equivalent yet | Needs Archivo variable `wdth` in Flutter (`FontVariation`) or a fallback rule |
| SET-08 | Information pages and their rows' destinations not designed | Part 2 |
| SET-09 | All evidence is Chrome emulation; no device, OLED, Android font scaling | XS-05, XS-16 |
| SET-10 | `primer-core.css` copied into a fifth folder; detail app bar copied again with changes | XS-09 |
| SET-11 | The prototype does not show persistence across launches | By design; behaviour is Flutter's |

Not started, as instructed: Data and updates, Acknowledgements, Privacy and
legal, App information, any Flutter change, and any update to
`../DESIGN-DECISIONS.md` or `../DESIGN-BACKLOG.md`.
