# Evidence retention proposal (Steps 48B–48F)

**Status: proposal, 2026-11-11. Not applied.** `design-exploration/.gitignore`
is unchanged, and nothing has been deleted, staged or committed.

> **Update 2026-11-11:** the rules below are now in
> `design-exploration/.gitignore`. Step 49B.2 extended the same approach to
> the Home and Circuit Detail absence experiments (last section).

## Why

Steps 48B–48F left screenshot collections untracked: **274.7 MB in 2,628
files**. The largest are `calendar-stage1/` against the title fit (129 MB),
`calendar-sticky-split/` (76 MB) and `calendar-stage1/` against Stage 2
(29 MB).

## Existing convention (followed here)

`design-exploration/.gitignore` already:
- names each validation folder explicitly, with no broad `*.png` rule;
- tracks every machine-readable report: `results.json`, `summary.txt`,
  accessibility trees, `*.json` and capture scripts;
- keeps screenshot collections local, except a representative selection
  re-included with `!` rules;
- for consolidation pilots, keeps the whole `sw-pilot/screens/` folder local;
- keeps reports local only when they embed absolute local paths. None of the
  Step 48 reports do: checked for `C:/Users`, `file:///` and the user name.

One pattern detail: a file can only be re-included when its parent folder is
not excluded. So `diffs/*` is used wherever a pair is kept, and `screens/`
(the whole folder) where nothing is kept.

## Proposed rules (to append to `design-exploration/.gitignore`)

```gitignore
# ---------------------------------------------------------------------------
# Steps 48B-48F (2026-11-10/11): Calendar cross-screen experiments (title fit,
# Stage 2 sticky split, Stage 1) and the Step 48B Standings / Explore title-fit
# rechecks. Same rule as above: every machine-readable report (results.json,
# summary.txt, accessibility trees, *.json) is tracked; the screenshot
# collections stay local except the owner-reviewed before/after pairs cited
# in each REPORT.md. Diff masks stay local.

# Step 48B title-fit rechecks: pilot screenshots, pixel-identical to the pilots
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261110-130945-title-fit-recheck/sw-pilot/screens/
/prototypes/primer-v2/consolidation-pilot/explore/validation-20261110-130945-title-fit-recheck/sw-pilot/screens/

# Calendar title fit (Step 48B; owner reviewed EN/ES 320x693 @200%, default,
# stale and failed, CT-01)
/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/screens/
/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/*
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/en-default-320x693-200-01-baseline.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/en-default-320x693-200-01-pilot.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/es-default-320x693-200-01-baseline.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/es-default-320x693-200-01-pilot.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/en-stale-320x693-200-01-baseline.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/en-stale-320x693-200-01-pilot.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/en-failed-320x693-200-01-baseline.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/en-failed-320x693-200-01-pilot.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/es-stale-320x693-200-01-baseline.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/es-stale-320x693-200-01-pilot.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/es-failed-320x693-200-01-baseline.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-title-fit/validation-20261110-132548-experiment/sw-pilot/diffs/es-failed-320x693-200-01-pilot.png

# Calendar Stage 2 sticky split (Step 48C; historical alternative; owner
# reviewed the two pairs below, CT-02)
/prototypes/primer-v2/cross-screen-refinement/calendar-sticky-split/validation-20261110-190115-experiment/sw-pilot/screens/
/prototypes/primer-v2/cross-screen-refinement/calendar-sticky-split/validation-20261110-190115-experiment/sw-pilot/diffs/*
!/prototypes/primer-v2/cross-screen-refinement/calendar-sticky-split/validation-20261110-190115-experiment/sw-pilot/diffs/es-stale-320-200-mid-base.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-sticky-split/validation-20261110-190115-experiment/sw-pilot/diffs/es-stale-320-200-mid-pilot.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-sticky-split/validation-20261110-190115-experiment/sw-pilot/diffs/en-failed-320-200-r22-base.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-sticky-split/validation-20261110-190115-experiment/sw-pilot/diffs/en-failed-320-200-r22-pilot.png

# Calendar Stage 1 (Step 48E; preferred direction, CT-03): the six screenshots
# the owner reviewed in Step 48F
/prototypes/primer-v2/cross-screen-refinement/calendar-stage1/validation-20261110-212520-stage1-vs-title-fit/sw-pilot/screens/
/prototypes/primer-v2/cross-screen-refinement/calendar-stage1/validation-20261110-212520-stage1-vs-title-fit/sw-pilot/diffs/*
!/prototypes/primer-v2/cross-screen-refinement/calendar-stage1/validation-20261110-212520-stage1-vs-title-fit/sw-pilot/diffs/es-stale-320-200-mid-base.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-stage1/validation-20261110-212520-stage1-vs-title-fit/sw-pilot/diffs/es-stale-320-200-mid-pilot.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-stage1/validation-20261110-212520-stage1-vs-title-fit/sw-pilot/diffs/en-failed-320-200-r22-base.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-stage1/validation-20261110-212520-stage1-vs-title-fit/sw-pilot/diffs/en-failed-320-200-r22-pilot.png
/prototypes/primer-v2/cross-screen-refinement/calendar-stage1/validation-20261110-212520-stage1-vs-stage2/sw-pilot/screens/
/prototypes/primer-v2/cross-screen-refinement/calendar-stage1/validation-20261110-212520-stage1-vs-stage2/sw-pilot/diffs/*
!/prototypes/primer-v2/cross-screen-refinement/calendar-stage1/validation-20261110-212520-stage1-vs-stage2/sw-pilot/diffs/en-failed-693-200-r23-base.png
!/prototypes/primer-v2/cross-screen-refinement/calendar-stage1/validation-20261110-212520-stage1-vs-stage2/sw-pilot/diffs/en-failed-693-200-r23-pilot.png
```

## Effect (checked without editing any ignore file)

The check ran `git -c core.excludesFile=<temporary copy of the rules above,
rooted at the repository> ls-files --others --exclude-standard`.

| | Untracked under `design-exploration/` |
|---|---|
| Today | 2,628 files, 274.7 MB |
| With the proposed rules | 130 files, 10.3 MB (including this document) |

- **No non-PNG file is newly excluded.** Every source, generator, script,
  report and document stays visible to Git.
- **22 screenshots stay tracked (2.5 MB):**
  - the six reviewed in Step 48F;
  - the two Step 48C pairs reviewed for CT-02;
  - the Step 48B English and Spanish 320 @200% pairs (default, stale,
    failed) reviewed for CT-01.
- **Largest remaining files:** the `results.json` reports (up to 1.8 MB each,
  because they include both accessibility trees for every differing run).
  Under the convention, they stay tracked.
- **Stays local:** all `screens/` folders, all other `diffs/` frames and every
  `-diff.png` mask. The files remain on disk, and each folder's `REPORT.md`
  and `results.json` record what they showed.

## Extension: Step 49B.2 event-absence experiments (applied)

**Applied 2026-11-11** to `design-exploration/.gitignore`, using the same
narrow, folder-specific pattern. Nothing has been deleted, staged or
committed.

| Folder | On disk | Visible to Git |
|---|---|---|
| `home-upcoming-omit/` (`validation-20261111-201457-experiment/`) | 560 files, 83.3 MB | 11 files, 1.3 MB |
| `circuit-absence/` (`validation-20261111-194301-experiment/`) | 250 files, 22.1 MB | 19 files, 0.9 MB |

- **Local only:** `sw-control/screens/`, `sw-pilot/screens/` and the other
  `sw-pilot/diffs/` files, including every `-diff.png` mask.
- **Tracked (visible):** sources and generators (`build.py`, `*.config.mjs`,
  HTML, CSS) and both `results.json` / `summary.txt` reports per folder.
  None of them embeds an absolute local path (checked for `C:/Users`,
  `file:///` and the user name).
- **Six owner-reviewed screenshots stay tracked** (0.6 MB;
  `STATUS-ABSENCE-DECISIONS.md` §7):
  - `home-upcoming-omit`: `es-320x693-200-capture-bottom-{baseline,pilot}.png`;
  - `circuit-absence`:
    `es-partial-unknown-320x693-200-capture-top-{baseline,pilot}.png` and
    `en-unknown-association-390x844-100-capture-bottom-{baseline,pilot}.png`
    (Git-visible copies: see "Short Git-visible names" below).
- **No non-PNG file is ignored** in either folder, and no tracked file
  matches an ignore rule.
- **Untracked under `design-exploration/`:** 942 files (116.3 MB) before,
  162 files (13.1 MB) after.

## Short Git-visible names (Step 50B, 2026-11-12)

Sixteen owner-reviewed screenshots had repository paths long enough to exceed
the Windows 260-character limit once a checkout folder is added. Fifteen were
over the limit in at least one checkout; the sixteenth is the partner of a
Circuit before/after pair, renamed so the pair keeps matching names.
- Each one is now committed as a **byte-identical copy** with a short name in
  the same folder (SHA-256 identical; no recompression).
- The `.gitignore` re-include rules name the short copy.
- The long-named original stays on disk as local, ignored evidence.
- `results.json` and `summary.txt` keep the original names, because they
  record what the run generated.

| Folder (under `cross-screen-refinement/`) | Original (local, ignored) | Git-visible copy | SHA-256 (prefix) |
|---|---|---|---|
| `calendar-stage1/validation-20261110-212520-stage1-vs-title-fit/sw-pilot/diffs/` | `es-stale-320x693-200-keyboard-mid-list-baseline.png` | `es-stale-320-200-mid-base.png` | `bce02b17cbc5ac77…` |
| `calendar-stage1/validation-20261110-212520-stage1-vs-title-fit/sw-pilot/diffs/` | `es-stale-320x693-200-keyboard-mid-list-pilot.png` | `es-stale-320-200-mid-pilot.png` | `b9b665a6f816bb20…` |
| `calendar-stage1/validation-20261110-212520-stage1-vs-title-fit/sw-pilot/diffs/` | `en-failed-320x693-200-keyboard-focused-round-22-baseline.png` | `en-failed-320-200-r22-base.png` | `9bb6bd76de18b453…` |
| `calendar-stage1/validation-20261110-212520-stage1-vs-title-fit/sw-pilot/diffs/` | `en-failed-320x693-200-keyboard-focused-round-22-pilot.png` | `en-failed-320-200-r22-pilot.png` | `2c59fcfa2dafc2bf…` |
| `calendar-stage1/validation-20261110-212520-stage1-vs-stage2/sw-pilot/diffs/` | `en-failed-693x320-200-keyboard-focused-round-23-baseline.png` | `en-failed-693-200-r23-base.png` | `4adb59fdf67fcd1f…` |
| `calendar-stage1/validation-20261110-212520-stage1-vs-stage2/sw-pilot/diffs/` | `en-failed-693x320-200-keyboard-focused-round-23-pilot.png` | `en-failed-693-200-r23-pilot.png` | `fe19601f31cd82b2…` |
| `calendar-sticky-split/validation-20261110-190115-experiment/sw-pilot/diffs/` | `es-stale-320x693-200-critical-mid-list-baseline.png` | `es-stale-320-200-mid-base.png` | `bce02b17cbc5ac77…` |
| `calendar-sticky-split/validation-20261110-190115-experiment/sw-pilot/diffs/` | `es-stale-320x693-200-critical-mid-list-pilot.png` | `es-stale-320-200-mid-pilot.png` | `b9b665a6f816bb20…` |
| `calendar-sticky-split/validation-20261110-190115-experiment/sw-pilot/diffs/` | `en-failed-320x693-200-critical-focused-round-22-baseline.png` | `en-failed-320-200-r22-base.png` | `64903e626e19fbc2…` |
| `calendar-sticky-split/validation-20261110-190115-experiment/sw-pilot/diffs/` | `en-failed-320x693-200-critical-focused-round-22-pilot.png` | `en-failed-320-200-r22-pilot.png` | `d34f4e642ce2b6c5…` |
| `circuit-absence/validation-20261111-194301-experiment/sw-pilot/diffs/` | `es-partial-unknown-320x693-200-capture-top-baseline.png` | `es-partial-320-200-top-base.png` | `a854ee5e717491be…` |
| `circuit-absence/validation-20261111-194301-experiment/sw-pilot/diffs/` | `es-partial-unknown-320x693-200-capture-top-pilot.png` | `es-partial-320-200-top-pilot.png` | `35353b2f1c39acf6…` |
| `circuit-absence/validation-20261111-194301-experiment/sw-pilot/diffs/` | `en-unknown-association-390x844-100-capture-bottom-baseline.png` | `en-unknown-assoc-390-100-bottom-base.png` | `c0e4c4db2d10d5a8…` |
| `circuit-absence/validation-20261111-194301-experiment/sw-pilot/diffs/` | `en-unknown-association-390x844-100-capture-bottom-pilot.png` | `en-unknown-assoc-390-100-bottom-pilot.png` | `36c8c8b24cc0c89c…` |
| `status-visual-consistency/validation-20261111-233337-experiment/screens/` | `B2-gp-certainty-vocabulary-current-en-390x844-100.png` | `B2-certainty-current-en-390.png` | `45faf38a8582cd35…` |
| `status-visual-consistency/validation-20261111-233337-experiment/screens/` | `B2-gp-certainty-vocabulary-proposed-en-390x844-100.png` | `B2-certainty-proposed-en-390.png` | `66cf90c1315e407d…` |

## Extension: Step 51C–51D dark state boundaries (applied 2026-11-12, Step 51E)

**Status: applied** to `design-exploration/.gitignore` after owner approval
(Step 51E). Nothing is deleted, staged or committed. All 44 screenshots stay
on disk.

The folder is `dark-state-boundaries/`, with three validation runs: `-51c`,
`-51c1` and `-51d`. Before the rules, none of its files was ignored: 81
untracked files, 4.2 MB, including 44 screenshots.

- **Same pattern as above:**
  - `screens/*` is ignored per run, with `!` re-includes;
  - every source, generator, script, HTML/CSS page, `results.json` and
    `summary.txt` stays tracked;
  - the reports contain no local paths.
- **Kept Git-visible: 22 screenshots (1.2 MB).**
  - 51C: 11 owner-reviewed comparisons;
  - 51C.1: 9 owner-reviewed comparisons;
  - 51D: 2 Home focus crops, kept as **technical evidence**. The owner did
    not review them directly (DK-4).
- **With the rules:** 59 files, 2.8 MB visible in the folder. No non-PNG
  file is excluded. Checked with `git -c core.excludesFile=<temporary copy
  rooted at the repository> ls-files --others --exclude-standard`.
- **Path length:** the longest kept path is 175 characters from the
  repository root.
  - redesign worktree: 247 characters;
  - main checkout (`Gridview_project`): 249;
  - every registered worktree: at most 255.

  All are under the 260 limit, so no short names are needed and
  `core.longpaths` is not enabled.

The exact file list and rules are in
`dark-state-boundaries/REPORT.md` §13.5.
