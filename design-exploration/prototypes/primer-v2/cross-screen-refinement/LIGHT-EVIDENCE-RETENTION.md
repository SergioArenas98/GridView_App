# Evidence retention proposal: Primer V2 Light (Steps 53A to 53F)

<!-- primer-v2-status-notice -->
> **Historical record.** This document records which validation evidence
> was kept in Git during the design process. Since the 2026-11 history
> consolidation no validation output folder (`validation-*/`) is part of
> the published repository, so the retention rules below no longer
> describe what is tracked; the historical runs are retained in the
> owner's backup of the original development history. See
> [Validation output](../README.md#validation-output). Current guidance:
> [GridView_Design_System.md](../../../../docs/technical/GridView_Design_System.md).

**Status: applied in Step 54D (2026-11-13)** as the "Steps 53A-54C" block
of `design-exploration/.gitignore`; the 16 local PNG are not in Git and are
absent from a fresh checkout. Originally a proposal, 2026-11-13. `design-exploration/.gitignore`
is unchanged; nothing has been deleted, staged or committed. It follows the
convention of [`EVIDENCE-RETENTION.md`](EVIDENCE-RETENTION.md) and the Dark
checkpoint: every source, generated prototype page and machine-readable
report stays Git-visible; screenshot collections stay local except the
owner-reviewed images cited in the reports.

## Size

The Light work is small compared with the Step 48 collections (274.7 MB):

| Folder | Files | Size | PNG |
|---|---|---|---|
| `light-foundations/` (Steps 53A, 53A.1, 53B) | 90 | 4.8 MB | 31 |
| `light-rollout-b1/` (Batch 1, LT-14) | 75 | 3.3 MB | 20 |
| `light-rollout-b2/` (Batch 2, Step 53E) | 202 | 9.8 MB | 26 |
| **Total** | **367** | **17.7 MB** | **77 (4.7 MB)** |

By type: 244 generated HTML pages (2.6 MB), 16 CSS, 3 build scripts, 3 check
scripts, 12 `summary.txt` (0.5 MB), 12 `results.json` (9.7 MB), 77 PNG.
Plus six documents in `primer-v2/` (`LIGHT-THEME-ROLES.md`,
`LIGHT-READINESS.md`, `LIGHT-THEME-FOUNDATIONS.md`, `LIGHT-ROLLOUT-BATCH-1.md`,
`LIGHT-ROLLOUT-BATCH-2.md`, this file) and the tracked edits to
`DESIGN-DECISIONS.md` and `DESIGN-BACKLOG.md`.

## Must stay Git-visible

- **Documents:** the six above, `DESIGN-DECISIONS.md`, `DESIGN-BACKLOG.md`.
- **Sources:** every `*.css` (Light roles and the comparison files that
  record rejected or reviewed options: `light-a.css`, `light-b1-alt.css`,
  `lt8-notice.css`, `lt-team-ring.css`, `lt16-skeleton.css`,
  `lt7-live-*.css`, `lt14-*.css`), the three `build.py` and the three check
  scripts.
- **Generated pages:** all 244 HTML pages (each `build.py --check` verifies
  them; they are the prototypes the reports cite).
- **Reports:** every `summary.txt` and `results.json` (none embeds an
  absolute local path or the user name: checked for `C:/Users`, `file:///`).

## Screenshots to retain (presented for owner review, cited in the reports): 61 PNG, 3.1 MB

Only 24 of these are directly owner-reviewed; see "Step 54A audit" below.

| Folder | Kept |
|---|---|
| `light-foundations/validation-20261112-224333-53a1/screens/` | all 7 (Step 53A.1, LT-1 decision) |
| `light-foundations/validation-20261112-232123-53b/screens/` | all 10 (Step 53B, LT-4/5/6/11/12) |
| `light-rollout-b1/validation-20261113-071945-b1/screens/` | all 17 (Batch 1 and LT-13) |
| `light-rollout-b1/validation-20261113-174306-lt14/screens/` | all 3 (LT-14) |
| `light-rollout-b2/validation-20261113-180746-b2/screens/` | all 14 (Batch 2) |
| `light-rollout-b2/validation-20261113-191838-lt8/screens/` | both (LT-8) |
| `light-rollout-b2/validation-20261113-194111-tl/screens/` | both (LT-17 Light) |
| `light-rollout-b2/validation-20261113-200413-dtl/screens/` | `dtl-winner-en-390.png`, `dtl-multiline-es-320-200.png` (LT-17 Dark) |
| `light-rollout-b2/validation-20261113-200522-live/screens/` | both (LT-7 Live) |
| `light-rollout-b2/validation-20261113-203330-lt16/screens/` | `lt16-gp-en-390.png`, `lt16-cd-en-390.png` (LT-16) |

## Screenshots that can stay local: 16 PNG, 1.6 MB

- `light-foundations/validation-20261112-220528-53a/screens/` (14): the
  first A-versus-B palette exploration, superseded by Step 53A.1 and the
  frozen roles; its `summary.txt` and `results.json` stay tracked.
- `validation-20261113-200413-dtl/screens/dtl-ordinary-en-390.png` and
  `validation-20261113-203330-lt16/screens/lt16-gp-es-320-200.png`:
  generated, not in the owner's review set.

The coverage run `validation-20261113-203116-cov/` has no screenshots.

**Candidate Git-visible total:** 351 files in the three folders (16.1 MB)
plus the documents. Optional, if size matters more than precedent: keep the
largest report, `light-rollout-b2/validation-20261113-180746-b2/results.json`
(3.3 MB), local; its `summary.txt` carries every reported figure.

## Proposed rules (to append to `design-exploration/.gitignore`; not applied)

```gitignore
# ---------------------------------------------------------------------------
# Steps 53A-53F (2026-11-12/13): Primer V2 Light. Every report (results.json,
# summary.txt), source and generated page is tracked; screenshots are tracked
# except the superseded Step 53A palette exploration and two captures that
# were not part of the owner's review set (LIGHT-EVIDENCE-RETENTION.md).
/prototypes/primer-v2/cross-screen-refinement/light-foundations/validation-20261112-220528-53a/screens/
/prototypes/primer-v2/cross-screen-refinement/light-rollout-b2/validation-20261113-200413-dtl/screens/dtl-ordinary-en-390.png
/prototypes/primer-v2/cross-screen-refinement/light-rollout-b2/validation-20261113-203330-lt16/screens/lt16-gp-es-320-200.png
```

## Windows paths and line endings

- Longest new path: 163 characters from the repository root
  (`…/light-rollout-b2/validation-20261113-194111-tl/screens/tl-gp-results-focus-team-es-320-200.png`),
  about 235 from the main checkout (`…\GridView\Gridview_project\`). Under
  the 260-character limit with a margin of about 25; no short-name copies are
  needed (the Step 50A workaround). A deeper checkout path would need
  `core.longpaths`.
- Every file is LF in the working tree. The repository uses `* text=auto`
  (`.md` and `.mjs` resolve to `eol=lf`), so Git stores LF; with
  `core.autocrlf=true` a fresh Windows checkout may show CRLF for HTML, CSS
  and Python. The build scripts read with universal newlines, so
  `build.py --check` still reports current.

## Step 54A audit (2026-11-13)

Reviewed against `DESIGN-DECISIONS.md` (rows LT-1 to LT-18 and the Light
sections) and the "Screenshots for owner review" tables. Nothing deleted,
staged or committed; `.gitignore` unchanged.

### Correction: "owner-reviewed" was overstated

The 61 PNG above were all **presented** for review, but the record only
identifies some of them as individually reviewed. Corrected classification
of the 77 Light PNG:

| Class | PNG | Basis in the record |
|---|---|---|
| **A. Directly owner-reviewed** (files identifiable) | **24** | 53A.1 all 7 (LT-1: "the seven Step 53A.1 comparisons"); 53B all 10 (LT-4: "the ten Step 53B comparisons"); `b1-cal-focus-next-es-320-200.png` (LT-15: "the Spanish 320dp, 200% comparison"); the six Step 53E screenshots (LT-18): `lt16-gp-en-390`, `lt16-cd-en-390`, `live-chip-en-390`, `live-chip-es-320-200`, `dtl-winner-en-390`, `dtl-multiline-es-320-200` (the two `dtl` also named in LT-17) |
| **B. Presented in a reviewed set, files not individually identified** | **37** | Batch 1, the other 16 of 17 (`b1`): the record says the owner reviewed "ten representative screenshots"; LT-14, all 3 (`lt14`): "the Step 53C.1 A/B comparison", no count; Batch 2, 18 presented (`b2` 14, `lt8` 2, `tl` 2): the record says "twelve screenshots" |
| **C. Owner-reviewed, superseded** | **14** | Step 53A (`53a`): "the owner reviewed the Step 53A comparisons"; superseded by 53A.1 and the frozen roles |
| **D. Technical, never presented** | **2** | `dtl-ordinary-en-390.png`, `lt16-gp-es-320-200.png` |

**Recommendation.** Keep the retention outcome (A and B Git-visible, C and D
local, as proposed) but label B as **"presented for owner review (batch
approval)"**, not "owner-reviewed". Which ten of the 17 Batch 1 images and
which twelve of the 18 Batch 2 images the owner looked at is not recorded;
only the owner can narrow that. No file needs to move for this correction.

### Generated HTML (244 pages): keep all

- **Reproducibility does not require them** (each folder's `build.py`
  regenerates every page from tracked sources), but **removing or ignoring
  any of them breaks `build.py --check`**, which treats a missing page as
  stale. Making that pass again would mean editing the three historical
  generators, which these steps do not allow.
- **Size is small:** 2.6 MB in total. Of the 244, 50 are comparison-only or
  superseded variants (about 0.5 MB): `light-a` 12, `light-b` 12,
  `light-bm` 8, `light-alt` 4, `light-n8` 6, `light-tl` 2, `light-s16` 2,
  `light-live-oxide` 2, `dark-tl` 2. They are what the decision records
  (LT-1, LT-8, LT-13, LT-14, LT-16, LT-17, LT-7) point at, and they open in
  a browser without Python.
- **The larger lever is the reports:** 12 `results.json` hold about 9.5 MB
  (the Batch 2 one alone 3.3 MB); every figure the documents cite is in the
  matching `summary.txt`. Keeping only the largest `results.json` local (as
  already offered above) is the one reduction worth the owner's decision.
  None is proposed as a rule here.

### Step 54A additions (`light-coverage-gaps/`)

45 files, 2.1 MB: `build.py`, `checks-gaps.mjs`, 28 generated pages, three
report folders (`results.json` and `summary.txt` each; none contains a local
path or user name) and 9 PNG (0.4 MB). **The owner reviewed all 9 PNG
(class A, directly owner-reviewed; Step 54A closed)** (`LIGHT-READINESS.md`
§17). Proposed: all
Git-visible; no ignore rule needed (none of them is ignored today). Longest
path 166 characters from the repository root, about 238 from the main
checkout: still under 260, margin about 22, so no short-name copies. Every
new file is LF.

## Step 54C

Superseded as the checkpoint plan by
[`../CHECKPOINT-PREPARATION-54C.md`](../CHECKPOINT-PREPARATION-54C.md), which
covers Steps 53A–54C (473 files, 95 PNG: 42 directly owner-reviewed, 37
presented in reviewed sets, 14 superseded, 2 technical) with the same three
proposed ignore rules. **Applied in Step 54D** (see the status line).
