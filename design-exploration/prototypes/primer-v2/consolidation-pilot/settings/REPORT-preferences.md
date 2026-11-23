# Settings preferences: consolidation pilot report

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

The three selection screens, `language`, `theme` and `time` (`[.es].html`).
They are built by the same `build.py`, use the same `settings.css` and the
unchanged `settings.js`, and sit in the same folder as the root (see
[`REPORT-root.md`](REPORT-root.md), "How the pilot is built"). Static
scenarios:

- default values;
- `device=es` and `language=english` on Language;
- the provisional light preview (`theme=light`) on Theme;
- `time=both` and the development failure scenario (`fail=1`) on Time
  display.

## 1–3. Components

- **Reused:** the same as the root (tokens, base, app-bar for Back) and
  nothing else.
- **Newly extracted:** none. The option list, the 12° selection mark and the
  snackbar have no second consumer.
- **Kept local:** the option list, mark and snackbar. In particular, the
  **checked parallelogram stays a single-choice radio**:
  - `role="radiogroup"` labelled by the `h1`;
  - `role="radio"` with `aria-checked`;
  - one tab stop.

  It is not turned into a multi-select control. Its final Flutter radio
  semantics stay subject to accessibility validation (SETT-02).
- **Not implemented:** the unresolved light theme. The Light option still
  shows only the labelled provisional `GvColorsLight` preview (XS-01).

## 4. Regression results

Final evidence: `validation-20261110-094550-preferences/` (`sw-pilot`,
`sw-control`), Chrome 157.0.8103.39, software raster.

| Version | Runs | Screenshot pairs | Differing pixels | DOM / style / box / metric diffs | A11y-tree diffs | Assertions true in both versions | Scroll coverage complete |
|---|---|---|---|---|---|---|---|
| Pilot vs baseline | 129 | 159 | **0** | 0 | 0 | 167 / 167 | 64 / 64 |
| Control (baseline vs baseline) | 129 | 159 | 0 | 0 | 0 | 167 / 167 | 64 / 64 |

In every run, in both versions:
- no horizontal scroll;
- 0 clipped, spilled or outside-viewport text, and 0 words broken;
- no target under 48×48;
- lowest contrast 5.77:1 (provisional light preview).

## 5. Data and localization checks

ARB values, in both versions, EN and ES, at 390×844 / 100% and 320×693 /
200%:

- **Options, in enum order, with explanations:**
  - Language: System default (with its explanation), English, Español;
  - Theme: System (with its explanation), Dark, Light;
  - Time display: Device, Event, Both, each with its explanation.
- **Defaults:** System default, Dark, Device time.
- **Own-language labels:** English and Español carry `lang="en"` /
  `lang="es"`.
- **Group label:** the group is labelled by the screen title, and the
  document title follows it.
- **Selected state:**
  - exactly one checked option;
  - the selected label is set at 800 weight, the others are not;
  - one Ember fill.
- **Title:** the `h1` wraps and never truncates, with no ellipsis.

## 6. Interaction and accessibility checks

All in both versions, EN and ES, on all three screens unless noted:

| Behaviour | Check |
|---|---|
| Immediate visual selection | The tapped option is checked 40 ms after the tap, before the simulated 280 ms write |
| Simulated persistence | After the write, the query holds the new value; the screen stays open; no message |
| Focus | Stays on the tapped option |
| Failure rollback (`fail=1`) | Selected at once, then the previous value is restored, `settingsSaveFailed` is shown in the polite status region, and the failure annotation is visible |
| Superseded write (Theme, `fail=1`) | Light then System quickly: only the latest write reports |
| Language re-render | Selecting the other language re-renders the screen in place (options, title, Back label, `html lang`); focus stays on the option |
| Language failure | Shown in the new language at once, then back to the page language with the message in it |
| System default resolution | `device=es` on the English page shows Spanish; `device=en` on the Spanish page shows English |
| Keyboard model | Tab: Back, then **one** stop on the checked option; arrows, Home and End move focus without selecting (wrap included); Space and Enter select the focused option |
| Back to Settings | The root shows the new value and focus returns to the originating row |
| Pointer | Forced `:hover` / `:active` on an option, on the checked option and on Back are identical |
| Reduced motion | The failure snackbar appears with 0s transitions |
| Touch targets | Back 48×48; options at least 64px high |

- **Keyboard trace:** "Back", then radio "<checked option>". Every stop is
  named, and no unnamed control was found.
- **Deliberate keyboard model:** the arrows-move-focus-only model (README
  difference 8) differs from the ARIA radio pattern on purpose, and it is
  preserved, not validated (SETT-02).

## 7. Differences from Flutter that remain open

Unchanged by this pilot:
- 6: selected state without ", Selected" (SETT-07);
- 7: explanation as the accessible description;
- 8: keyboard model;
- 12: `lang`;
- 13: width axis (SETT-09);
- SETT-05: real persistence and Android behaviour;
- SETT-06: Event time without a declared zone.

## Reproduce

```sh
cd consolidation-pilot/tools
node visual-compare.mjs settings-preferences.config.mjs --out ../settings/validation-<stamp>-preferences/sw-pilot
node visual-compare.mjs settings-preferences.config.mjs --control --shots none --out ../settings/validation-<stamp>-preferences/sw-control
```
