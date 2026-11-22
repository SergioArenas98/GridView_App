# Checkpoint preparation: Primer V2 Light and cross-theme specification (Step 54C)

**Status: approved and applied in Step 54D (2026-11-13): the §5 rules are in
`design-exploration/.gitignore` and the checkpoint is one local commit on
`design/ui-redesign` (not pushed).** Written as the Step 54C proposal; §7
records the actual result. No evidence deleted. It audits the uncommitted work since
`1cab91e` ("design: freeze Primer V2 Dark visual roles") on
`design/ui-redesign`: Steps 53A–53F (Primer V2 Light, LT-1 to LT-18), 54A
(Light coverage gaps) and 54B–54C (cross-theme specification, XT-1 to XT-6).
The commit needs the owner's approval.

## 1. Audit result

| Check | Result |
|---|---|
| Working tree | 472 entries (4 tracked files modified, 468 untracked) + this document = **473** |
| Size | 22.19 MB raw; about 7.0 MB as zlib-compressed Git objects |
| Ignored today | none of these files (`git check-ignore`) |
| Line endings | LF in every text file (no CR found) |
| Trailing whitespace | none in any text file (`.md`, `.py`, `.mjs`, `.css`, `.html`, `.txt`, `.js`); `git diff --check` clean on tracked files |
| Unintended files | none (no `__pycache__`, `.pyc`, logs, temporary or OS files) |
| Longest path | 166 characters from the repository root (`…/light-coverage-gaps/validation-20261113-220312-54a-explore/screens/hm01-focus-explore-teams-en-390.png`); about 238 from the main checkout `…\GridView\Gridview_project\`; under 260, no short-name copies needed (the Step 50A workaround) |
| Build checks | `build.py --check` reports current for `light-foundations`, `light-rollout-b1`, `light-rollout-b2`, `light-coverage-gaps`, `cross-theme-54b`, and the read-only sources `status-visual-consistency`, `notice-coexistence`, `home-upcoming-omit` |
| Local paths in reports | none (`results.json` / `summary.txt` checked for `C:/Users`, the user name, `file:///`) |
| Forbidden areas | no change to `lib/`, `test/`, ARB, backend, approved prototypes, consolidation pilots, historical experiments or shared CSS/JS |

## 2. Manifest

| Category | Files | Raw size | Notes |
|---|---|---|---|
| **Documentation, modified (tracked)** | 4 | 0.26 MB | `DESIGN-DECISIONS.md` (LT, XT rows and sections; TM-03, LT-6, LT-14, N-2 cross-notes), `DESIGN-BACKLOG.md` (XS notes, statuses unchanged), `DARK-THEME-ROLES.md` (Step 54C cross-reference), `DARK-THEME-READINESS.md` (§13) |
| **Documentation, new** | 9 | 0.24 MB | `LIGHT-THEME-FOUNDATIONS.md`, `LIGHT-ROLLOUT-BATCH-1.md`, `LIGHT-ROLLOUT-BATCH-2.md`, `LIGHT-READINESS.md`, `LIGHT-THEME-ROLES.md`, `CROSS-THEME-CONSOLIDATION.md`, `CROSS-THEME-TOKEN-MAP.md`, `cross-screen-refinement/LIGHT-EVIDENCE-RETENTION.md`, this file |
| **Experiment sources** | 29 | 0.35 MB | 5 `build.py`, 5 check scripts (`checks.mjs`, `checks-b1.mjs`, `checks-b2.mjs`, `checks-gaps.mjs`, `checks-54b.mjs`), 19 CSS (Light roles, comparison files that record reviewed or rejected options, Step 54B stylesheets) |
| **Generated HTML** | 298 | 3.49 MB | `light-foundations` 46, `light-rollout-b1` 44, `light-rollout-b2` 154, `light-coverage-gaps` 28, `cross-theme-54b` 26. Every page is required by its folder's `build.py --check` |
| **Measurement results** | 38 | 12.35 MB | 19 `results.json` (11.74 MB raw, **about 0.62 MB compressed**) and 19 `summary.txt` (0.61 MB) |
| **Screenshots** | 95 | 5.53 MB | Classified in §3 |
| **Total** | **473** | **22.19 MB** | |

Folders: `light-foundations/` 90 files (4.77 MB), `light-rollout-b1/` 75
(3.24 MB), `light-rollout-b2/` 202 (9.66 MB), `light-coverage-gaps/` 45
(2.04 MB), `cross-theme-54b/` 48 (2.01 MB).

## 3. Screenshot classification (95 PNG)

| Class | PNG | Contents | Proposal |
|---|---|---|---|
| **A. Directly owner-reviewed** (files identifiable in the record) | **42** | Light 24: Step 53A.1 all 7 (LT-1), Step 53B all 10 (LT-4), `b1-cal-focus-next-es-320-200.png` (LT-15), the six Step 53E images (LT-18: `lt16-gp-en-390`, `lt16-cd-en-390`, `live-chip-en-390`, `live-chip-es-320-200`, `dtl-winner-en-390`, `dtl-multiline-es-320-200`). Step 54A: all 9 (8 in `validation-20261113-213543-54a/screens/`, 1 in `-220312-54a-explore/screens/`). Step 54B: all 9 (`cross-theme-54b/`, approved in Step 54C) | Git-visible |
| **B. Presented in a reviewed set, files not individually identified** | **37** | Batch 1, the other 16 of 17 `b1` (record: "ten representative screenshots"); LT-14, all 3 `lt14` ("the A/B comparison"); Batch 2, 18 presented (`b2` 14, `lt8` 2, `tl` 2; record: "twelve screenshots") | Git-visible, labelled "presented for owner review (batch approval)" |
| **C. Owner-reviewed, superseded** | **14** | Step 53A palette exploration (`light-foundations/validation-20261112-220528-53a/screens/`) | Local (its `summary.txt` and `results.json` stay tracked) |
| **D. Supplementary technical evidence, never presented** | **2** | `dtl-ordinary-en-390.png`, `lt16-gp-es-320-200.png` | Local |

**Proposed Git-visible PNG:** 79 (about 3.97 MB). **Local:** 16 (1.56 MB).
Only class A is ever described as owner-reviewed.

## 4. Size and reductions

- **`results.json` (19 files, 11.74 MB raw): keep all.** In Git they compress
  to about 0.62 MB (repetitive JSON), so excluding even the largest
  (`light-rollout-b2/validation-20261113-180746-b2/results.json`, 3.27 MB raw)
  saves well under 0.3 MB of history while losing the per-stop
  measurements behind every `summary.txt` figure. Rerunning a check
  regenerates the data but not bit for bit (timestamps, browser version), so
  the files are the record. No reduction proposed.
- **Generated HTML (298, 3.49 MB raw, about 0.81 MB compressed): keep all.**
  Removing or ignoring any breaks `build.py --check`, which treats a missing
  page as stale; restoring that would mean editing historical generators.
- **Screenshots dominate the stored size** (about 5.25 MB compressed; PNG
  barely compresses). Keeping classes C and D local (1.56 MB) is the only
  reduction with no loss of reviewed evidence.
- **Proposed tracked checkpoint: 457 files** (453 new, 4 modified), about
  20.6 MB raw, about 5.6 MB compressed.

## 5. Proposed `.gitignore` rules (not applied; owner approval required)

The Step 53F proposal, unchanged; Steps 54A–54C need no rule (all of their
PNG are class A):

```gitignore
# ---------------------------------------------------------------------------
# Steps 53A-54C (2026-11-12/13): Primer V2 Light and the cross-theme
# specification. Every report (results.json, summary.txt), source and
# generated page is tracked; screenshots are tracked except the superseded
# Step 53A palette exploration and two technical captures that were never
# presented for review (CHECKPOINT-PREPARATION-54C.md §3).
/prototypes/primer-v2/cross-screen-refinement/light-foundations/validation-20261112-220528-53a/screens/
/prototypes/primer-v2/cross-screen-refinement/light-rollout-b2/validation-20261113-200413-dtl/screens/dtl-ordinary-en-390.png
/prototypes/primer-v2/cross-screen-refinement/light-rollout-b2/validation-20261113-203330-lt16/screens/lt16-gp-es-320-200.png
```

(Paths are relative to `design-exploration/`, where the existing rules
live.)

## 6. Proposed commit (after approval)

One local commit on `design/ui-redesign`, not pushed:

```
design: freeze Primer V2 Light and the cross-theme visual specification

Light (Steps 53A-53F, LT-1 to LT-18): B Motorsport roles frozen in
LIGHT-THEME-ROLES.md; rollout batches and readiness; evidence retention
proposal audited. Step 54A: HM-01, N-2, VS-1, VS-3 and VS-4 rendered and
validated in Light. Steps 54B-54C: CROSS-THEME-CONSOLIDATION.md and
CROSS-THEME-TOKEN-MAP.md frozen (XT-1 Home Explore inward ring, XT-2
completed rows at full opacity, XT-3 shared team-colour geometry, XT-4,
XT-5, XT-6). Visual specification only; no Flutter, ARB or prototype change.
```

Splitting into two commits (Light 53A–54A; cross-theme 54B–54C) is possible
but the decision log, backlog and Light readiness files carry both, so one
commit keeps each file consistent. The attribution trailer follows the
owner's preference at commit time.

**Before committing:** apply the `.gitignore` rules if approved; rerun every
`build.py --check`; stage the paths explicitly (no `git add -A`); confirm
the staged count and that the 16 local PNG stay untracked;
`git diff --cached --check`.

## 7. Step 54D result

- **Count reconciled: 458 staged paths, not 457.** The Step 54C estimate
  (473 − 16 = 457) did not include `design-exploration/.gitignore`, which
  becomes a 5th modified tracked file when the rules are added: 453 new + 5
  modified = 458.
- **Ignored exactly 16 PNG** (14 Step 53A, `dtl-ordinary-en-390.png`,
  `lt16-gp-es-320-200.png`); **79 PNG committed**; all 95 still on disk; no
  HTML, CSS, script, report or JSON ignored; no broad PNG rule.
- References to the local-only images now say so
  (`LIGHT-THEME-FOUNDATIONS.md` §10, `LIGHT-EVIDENCE-RETENTION.md`).
