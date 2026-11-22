# Settings root: consolidation pilot report

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a consolidation pilot of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../README.md#validation-output).

**Status: technical experiment, 2026-11-10 (Step 45).** No decision is made
or changed here. The approved prototype `../../settings/` is unmodified.
Group summary: [`../SETTINGS-GROUP-SUMMARY.md`](../SETTINGS-GROUP-SUMMARY.md).

## Scope

- Pages: Scenario A `index[.es].html` (production, support contact configured),
  A2 `production-no-contact[.es].html` (production, feedback omitted),
  B `non-production[.es].html` (development, no contact: DEV strip,
  explanation row, Developer section).
- The URL-parameter scenarios `settings.js` supports, on `index`:
  - staging with contact;
  - development with contact;
  - non-default values (English / System / Event time);
  - Español / Light / Both, with the labelled provisional light preview.
- The development-only gallery `states[.es].html`: five frames plus the
  scenario hub.

## How the pilot is built

- `build.py` imports the approved generator `../../settings/build.py`
  read-only and writes its own output.
- One change per page: the `primer-core.css` link becomes
  `../../shared/tokens.css`, `base.css` and `components/app-bar.css`.
- `--check` confirms the approved generator still reproduces every approved
  page and `strings.js` byte for byte, and that the local `settings.js` and
  `strings.js` copies are identical.
- **Root and Preferences share this folder**, as approved. `settings.js`
  builds their links as same-folder names (`index{sfx}.html`,
  `{page}{sfx}.html`), so separate folders would need a JavaScript change.
  The subgroups are separated by config, evidence folder and report instead.
- `settings.css` is the approved file minus one rule: the `[hidden]` guard,
  identical in `../../shared/base.css`. A rule-by-rule comparison (comments
  and whitespace removed) confirms that is the only difference.

## 1. Components reused

| Shared file | What Settings uses | Evidence of identity |
|---|---|---|
| `tokens.css` | palette, cut, gutter, radii, font | core rules, verbatim |
| `base.css` | reset, type, focus ring, `.sprite`, `.sr-only`, `.icon`, `[hidden]` guard, reduced motion | core verbatim; `[hidden]` identical in `settings.css` |
| `components/app-bar.css` | `.icon-btn` (the Back action) | core verbatim |

The approved core's other rules (`.appbar`, chip, tag, text link, section
title, navigation) match no Settings element, so they are not linked.

## 2. Components newly extracted

None. Every candidate is used by Settings only, so none is a shared
component yet:
- the kicker with its trailing rule;
- the rows (`.srow`);
- the selection mark;
- the snackbar;
- the environment strip;
- the annotations.

Within Settings they are already shared: the information screens load this
`settings.css`.

## 3. Intentional Settings-specific variants (kept local)

- **App bar.** The Settings bar is a variant of the detail bar, not a copy.
  - Six `.dbar` declarations are equal: grid, 48px + `minmax(0, 1fr)`,
    centred, 4px gap, `min-height` 56px, padding.
  - Sticky position, background and bottom border sit on `.chrome`, which
    also holds the environment strip, not on `.dbar`.
  - The title is the page `h1`: 21px, uncapped, wrapping (`overflow-wrap`,
    `text-wrap: balance`). The detail bar's title is 18px, capped at 26px,
    one line, ellipsized.
  - `detail-app-bar.css` is therefore not loaded. Loading it would make
    `.dbar` sticky with its own background and border inside `.chrome`. Its
    header now says so. No sports-screen title behaviour is applied.
- **`.page`:** 4px top, 40px plus the safe area at the bottom.
  `detail-page.css` has 0 / 32px, so it is not loaded.
- **Send feedback glyph:** the external arrow is unchanged. The owner prefers
  the mail icon (SETT-04, difference 4 not approved). The difference stays
  open, and a data check asserts the arrow is still there.

## 4. Regression results

Final evidence: `validation-20261110-094550-root/` (`sw-pilot`,
`sw-control`), Chrome 157.0.8103.39, software raster, DPR 2, mobile
emulation with touch.

| Version | Runs | Screenshot pairs | Differing pixels | DOM / style / box / metric diffs | A11y-tree diffs | Assertions true in both versions | Scroll coverage complete |
|---|---|---|---|---|---|---|---|
| Pilot vs baseline | 114 | 282 | **0** | 0 | 0 | 176 / 176 | 57 / 57 |
| Control (baseline vs baseline) | 114 | 282 | 0 | 0 | 0 | 176 / 176 | 57 / 57 |

In every run, in both versions:
- no horizontal scroll;
- 0 elements outside the viewport, and 0 clipped, spilled or sub-12.5px
  text;
- no touch target under 48×48;
- lowest text contrast 5.77:1 (the provisional light preview's secondary
  text); 7.95:1 on the dark pages.

Words broken across lines occur only at real hyphens ("design-system",
"Development-only" at 320) or in the Spanish gallery's prototype captions
(`hyphens: auto`). Both are identical in both versions.

## 5. Data and localization checks

Expected values are read from `lib/l10n/app_*.arb` (never retyped) and
checked in both versions, at 390×844 / 100% and 320×693 / 200%:

- **Sections and rows, in order:**
  - Preferences;
  - Data and application;
  - Privacy and support;
  - Developer: non-production only, with its dashed rule.
- **Root values:** default System default / Dark / Device time, each with
  the small filled mark.
- **Feedback row:**
  - a link with the arrow when a contact is configured;
  - omitted in production without one;
  - a non-interactive explanation in development or staging without one.
- **Environment strip:** none in production. `DEV` / `STAGING`, with its
  "Build environment: …" label, elsewhere. Not localized, as in Flutter
  (SETT-08).
- **Pinned language:** English on the Spanish page, or Español on the
  English one, re-renders the whole page, including the title and the
  Back label.
- **Preference links:** each carries the full state query.
- **Destination rows:** the information rows link to the approved
  placeholder hashes (`#settings/data`, …), unchanged from part 1, which
  does not navigate to the information screens.
- **Navigation:** the Time display row opens `time[.es].html` with the
  state. Back returns to the root with focus on the Time display row.

## 6. Accessibility and interaction findings

- **Keyboard order (Scenario A, EN and ES):** nine stops, every one named.
  1. link "Back"
  2. "Language, System default"
  3. "Theme, Dark"
  4. "Time display, Device time"
  5. "Data and updates"
  6. "Acknowledgements"
  7. "App information"
  8. "Privacy and legal"
  9. "Send feedback"

  Scenario B ends with "Component catalogue, Development-only design-system
  gallery" in place of Send feedback; the explanation row is not
  focusable. **No unnamed interactive element** was found in any trace.
- **The Step 42 trace's empty ninth entry is explained.** That trace started
  on Back and pressed Tab nine times, so its ninth press went past the last
  row. The tool's first attempt at one Tab past the last control alternated
  between baseline and pilot loads. Focus either left the document (`body`)
  or wrapped to Back, the icon-only link with no id and no text content.
  The old `id || textContent` label is empty in both cases. It is a property
  of the browser, not an unnamed control. Such stops are no longer recorded.
- **An identical tree is not proof of accessibility.** TalkBack wording,
  link vs button semantics (SETT-02, difference 14) and real D-pad
  behaviour are untested.
- **Pointer states:** forced `:hover` / `:active` on a preference row, a
  destination row, the feedback row and Back are identical. The
  non-interactive row shows no state.
- **Touch targets:** none under 48×48 in any run. Rows are at least 60px;
  Back is 48×48.
- **Reduced motion:** identical, with transitions at 0s (base rule).
- **Title:** the multi-line rule is preserved. The `h1` wraps and is never
  truncated (see the title table in the group summary).

## 7. Differences from Flutter that remain open

Unchanged by this pilot:
- the README's differences 1–14;
- SETT-01 / PD-18: differences not covered by SP-01;
- SETT-02: TalkBack, keyboard and D-pad;
- SETT-03: label vs value prominence;
- SETT-04: feedback mail icon;
- SETT-08: environment labels not localized;
- SETT-09: width axis in Flutter;
- XS-01: light theme. Only the labelled provisional preview exists.

The prototype simulates persistence (SETT-05).

## Reproduce

```sh
cd consolidation-pilot/settings && python build.py --check && python build.py
cd ../tools
node visual-compare.mjs settings-root.config.mjs --out ../settings/validation-<stamp>-root/sw-pilot
node visual-compare.mjs settings-root.config.mjs --control --shots none --out ../settings/validation-<stamp>-root/sw-control
```
