# Settings consolidation pilots: group summary

<!-- primer-v2-status-notice -->
> **Historical record.** This document records a consolidation pilot of the Primer V2 design process. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../README.md#validation-output).

**Status: technical experiment, Step 45 (2026-11-10).** No decision is made
or changed here. The provisional owner approvals (SP-01, SI-01 to SI-04)
stand as recorded in `../DESIGN-DECISIONS.md`. A visually approved prototype
is not a Flutter implementation contract.

| Subgroup | Pilot folder | Report |
|---|---|---|
| Root | `settings/` | [`settings/REPORT-root.md`](settings/REPORT-root.md) |
| Preferences (Language, Theme, Time display) | `settings/` (same folder, see below) | [`settings/REPORT-preferences.md`](settings/REPORT-preferences.md) |
| Information screens (Data and updates, Acknowledgements, Privacy and legal, App information) | `settings/information/` | [`settings/information/REPORT.md`](settings/information/REPORT.md) |

- The approved prototypes `../settings/` and `../settings/information/` are
  unmodified.
- Home was not consolidated, and no light theme was designed.
- Nothing outside `design-exploration/` changed.

**Folder structure.** The pilot mirrors the approved structure.
- `settings.js` builds the root ↔ preference links as same-folder names, so
  Root and Preferences share `settings/`. Separate folders would have
  required a JavaScript change.
- The information screens sit one level down and load `../settings.css`.
- The subgroups are separated by config (`tools/settings-root`,
  `-preferences`, `-information.config.mjs`), evidence folder and report.
  They were validated in that order.

## Result

Final evidence on Chrome 157.0.8103.39 (software raster, DPR 2, mobile
emulation with touch), each with a baseline-vs-baseline control of 0:

| Subgroup | Runs | Screenshot pairs | Differing pixels | DOM / style / box / metric diffs | A11y-tree diffs | Assertions true in both versions | Folder |
|---|---|---|---|---|---|---|---|
| Root | 114 | 282 | **0** | 0 | 0 | 176 / 176 | `settings/validation-20261110-094550-root/` |
| Preferences | 129 | 159 | **0** | 0 | 0 | 167 / 167 | `settings/validation-20261110-094550-preferences/` |
| Information | 206 | 392 | **0** | 0 | 0 | 296 / 296 | `settings/information/validation-20261110-094550-regression/` |
| **Settings** | **449** | **833** | **0** | 0 | 0 | **639 / 639** | |

All 226 scroll captures reached the end of their document (coverage
recorded per run). In every run, in both versions:
- no horizontal scroll;
- 0 clipped, spilled or outside-viewport text;
- no target under 48×48.

Every subgroup covers:
- EN and ES; 390×844 and 320×693; 100% and 200% text;
- every approved scenario page;
- the URL-parameter scenarios `settings.js` supports;
- the development-only galleries;
- pixels, text, computed styles, boxes, accessibility trees, touch targets
  and quality metrics;
- keyboard walks with role, accessible name, structural locator and
  resolved target;
- forced `:hover` / `:active`;
- reduced motion;
- data and behaviour assertions read from the ARB files and the attribution
  record, true in both versions.

## 1. Components reused

| Shared file | Root + preferences | Information |
|---|---|---|
| `tokens.css`, `base.css` (incl. `[hidden]` guard) | ✓ | ✓ |
| `components/app-bar.css` (`.icon-btn` Back) | ✓ | ✓ |
| `components/notice.css` | — (no notice) | ✓ plus the local reading-width extension |

The fifth `primer-core.css` copy is no longer loaded by the pilot. The
other shared components were inspected and do not apply:

- **Detail app bar, detail page:** Settings variants (§3).
- **Empty state, section title:** no matching Settings element. The kicker
  is used instead (XS-29).
- **Chip, tag, text link, navigation, selector:** not used.

## 2. Components newly extracted

None. Candidates inspected:

- **Rows and the external-link row:** Settings only. Other screens' rows
  and chevrons use other classes and rules (DESIGN-SYSTEM-CONSOLIDATION
  §5.10).
- **Selection mark, option list, snackbar, environment strip, kicker,
  facts:** Settings only.
- **Focus treatment:** already the base rule, plus a Settings inset
  (`outline-offset: -3px`) on rows and options.

Within Settings these are already shared, because the information screens
load the root's `settings.css`. No token was added.

## 3. Intentional Settings-specific variants

- **App bar (kept local; not `detail-app-bar.css`).**
  - Equal to the detail bar: six `.dbar` declarations (grid, columns,
    alignment, gap, minimum height, padding) and the title's weight 800,
    `wdth` 88 and line height 1.25.
  - Different: sticky position, background and border sit on `.chrome`,
    which carries the environment strip. The title is the page `h1`, 21px,
    uncapped and wrapping, where the detail bar is 18px, capped at 26px and
    ellipsized.
  - The information screens add the S-2 single-word fit (`information.js`).
  - The approved multi-line title behaviour is preserved, and no
    sports-screen title rule is applied (title table below).
- **`.page`:** 4px / 40px plus the safe area, where the detail page is
  0 / 32px.
- **Notice:** the reading-width variant (SI-01 to SI-04), now a local
  extension of the shared notice.
- **Send feedback** keeps the external arrow (SETT-04 open). The mail icon
  was not applied.

**Title behaviour, from the static runs** (identical in both versions):

| Title | 390 / 100% | 390 / 200% | 320 / 100% | 320 / 200% |
|---|---|---|---|---|
| Settings / Ajustes; Language, Theme, Time display, Idioma, Tema | 1 line, 21px | 1 line, 42px | 1 line | 1 line |
| Horario mostrado | 1 line | **2 lines** (chrome 114px) | 1 line | **2 lines** (114px) |
| Data and updates / Datos y actualizaciones | 1 line | 2 lines | 1 line | 2 lines (ES with `wdth` 66) |
| Privacy and legal / Privacidad y aviso legal | 1 line | 2 lines | 1 line | 2 lines |
| App information | 1 line | 1 line | 1 line | 2 lines |
| Información de la aplicación | 1 line | 2 lines | 2 lines | **3 lines** (166.5px) |
| Acknowledgements | 1 line | 1 line, S-2 `wdth` 66 | 1 line | 1 line, S-2 last-resort scale to 36.63px |
| Agradecimientos | 1 line | 1 line, `wdth` 76 | 1 line | 1 line, `wdth` 62 |

- Multi-word titles wrap and single long words narrow, as approved; none is
  truncated.
- With the DEV / STAGING strip the chrome grows by about 31–48px; the
  largest is 161.8px (two-line title at 200%).

## 4. Regression results per subgroup

See the Result table.

- **Order of work:** the root and preference pages were generated and
  checked first, then the information pages. Each subgroup has its own
  config and evidence folder.
- **Runs were concurrent.** The final comparisons ran at the same time, in
  separate Chrome sessions, because they are independent. Each was judged
  on its own, and none needed a fix before the next.
- **Interaction-only dry runs** of all three found three problems in the
  checks, not in the pilots:
  - a keyboard walk past the last control (§6);
  - gallery walks whose default stop count included the inert frames'
    links;
  - a link check of mine that included the hidden spoken comma.

  Both were corrected before the final runs. No pilot file was changed
  because of a comparison.

## 5. Data and localization checks

- **Root:**
  - section and row order, values, glyphs, the feedback rules, the
    Developer section and the environment strip, for production with and
    without contact, development without contact, staging and development
    with contact;
  - a pinned language re-renders the page.
- **Preferences:**
  - options, defaults, explanations and own-language `lang`;
  - immediate selection, stored value, failure rollback with the message,
    superseded write;
  - in-place language re-render, System default resolution, the
    provisional light label.
- **Information:**
  - the ARB copy and **the attribution record verbatim**: provider,
    status, licence name, title and URL, project and terms URLs, the
    warranty notice;
  - the provider notice stays English on Spanish pages (SETT-20,
    unchanged);
  - every data-source mode, the session and policy conditions, the missing
    metadata behaviour.
- **All:** 0 clipped, spilled or outside-viewport text in either version.

## 6. Accessibility and interaction findings

- **Focus order** is recorded with Chrome's computed role and name at every
  stop. No unnamed interactive element exists on any Settings page.
- **The Step 42 "empty ninth entry" was a trace artefact, not a control.**
  The ninth Tab after Back goes past the last row. In headless Chrome that
  Tab alternates between leaving the document and wrapping to Back, the
  icon-only link with no id or text, which is why `id || textContent` was
  empty. The next page then loads with a different root focus state.
  Walking past the last control was tried during this step and dropped for
  that reason; the tool README now warns about it.
- **The galleries** expose only their hub links to the keyboard; frames are
  inert.
- **Preserved, not validated:**
  - radio semantics with one tab stop and arrows moving focus only
    (SETT-02);
  - links on the root vs Flutter buttons;
  - no spoken "opens outside GridView" cue (SETT-11);
  - the diagnostics note's positional wording (SETT-12).

  An identical accessibility tree is not evidence that the baseline is
  accessible. TalkBack, D-pad and Android font scaling remain required
  (XS-05, XS-16).
- **Baseline observation:** at 320 wide, "2026-10-07" breaks across lines at
  its own hyphens, and "Attribution-NonCommercial-ShareAlike" does so at every
  size, in both versions. The approved rules allow it. It was added to
  SETT-17, the existing evidence item.

## 7. Differences from Flutter that remain open

- **Root and preferences:** the README's differences 1–14 (SETT-01 /
  PD-18), SETT-02 to SETT-09.
- **Information:** the README's differences 1–20 (SETT-10 / PD-19),
  SETT-11 to SETT-20, including the open licensing question (SETT-18) and
  the Spanish provider notice (SETT-20).
- **Light theme:** XS-01.

None is resolved or closed by this pilot.

## 8. Prior-pilot regression confirmation

The comparison tool gained opt-in options (`outLabel`, `sharedRoots`, page
`maxShots`, scroll coverage, arrow/Home/End keys), and the shared CSS gained
two comment-only header changes (`notice.css`, `detail-app-bar.css`). The
seven earlier pilots were re-run with the final tool, without overwriting
earlier evidence:

| Pilot | Runs | Screenshot pairs | Differing pixels | DOM / style / box / metric diffs | A11y-tree diffs | Control | Folder |
|---|---|---|---|---|---|---|---|
| Calendar | 39 | 119 | **0** | 0 | 0 | 0 | `validation-20261110-093100-calendar-recheck/` |
| Standings | 39 | 168 | **0** | 0 | 0 | 0 | `standings/validation-20261110-093100-recheck/` |
| Explore | 66 | 285 | **0** | 0 | 0 | 0 | `explore/validation-20261110-093100-recheck/` |
| Driver Detail | 56 | 146 | **0** | 0 | 0 | 0 | `driver-detail/validation-20261110-093100-recheck/` |
| Team Detail | 74 | 187 | **0** | 0 | 0 | 0 | `team-detail/validation-20261110-093100-recheck/` |
| Circuit Detail | 74 | 152 | **0** | 0 | 0 | 0 | `circuit-detail/validation-20261110-093100-recheck/` |
| Grand Prix Detail | 105 | 385 | **0** | 0 | 0 | 0 | `grand-prix-detail/validation-20261110-093100-recheck/` |

- Run and pair counts equal each pilot's earlier evidence. The earlier
  configs use none of the new options, so they exercise the same checks.
- "Control" is the baseline-vs-baseline run in the same folder.

## 9. Readiness

**Ready for implementation planning, not for implementation.**

- The Settings group needs only the core foundation and the shared notice.
  Its variants are now explicit: the Settings bar, rows, option list, mark,
  snackbar, facts and source block.
- **Before implementation:**
  - owner decisions on the pending differences (SETT-01, SETT-04, SETT-10
    and the copy items SETT-06, 11, 12, 16, 20);
  - the licensing question (SETT-18);
  - TalkBack, keyboard and D-pad validation of the radio and link
    semantics (SETT-02);
  - real persistence on Android (SETT-05);
  - device and OLED evidence for the unreviewed captures (SETT-17);
  - a Flutter width-axis strategy (SETT-09);
  - the light theme (XS-01).

## Recommended next target

**Home.** It is the only screen family not yet on the shared foundation, and
it inlines its own copy of the core (`refinement-01/styles.css`). Its
wordmark app bar, refresh state and navigation are the most shared and the
most sensitive, so plan it as its own step, with a control run and no visual
change. An alternative is to first decide one or two open drift items that
block real extraction (XS-07 titles, XS-29 headings).
