# Checkpoint preparation: Step 42A

Prepared 2026-11-09 (Step 42A). **Step 42B, same day:** the owner approved
Option A. The Appendix A block was then appended to
`design-exploration/.gitignore` and the checkpoint was staged with explicit
paths. §12 lists evidence that committed documents cite but that stays local;
§13 records the follow-up for the comparison utility.

**Step 42C, same day:** the owner made two decisions, and the figures below
are final.
- **Four owner-reviewed screenshots added.** These are the information-screen
  views cited in DESIGN-DECISIONS SI-01 and SI-02, each with its own
  `.gitignore` exception.
- **Two whitespace defects stripped** in committed evidence:
  - a trailing space after the final `>` of the Settings root tab-order line in `interaction.txt`;
  - a blank line at the end of the comparison folder's `accessibility-tree.txt`.

  No recorded result changed. The tab-order trace's empty ninth entry is
  explained in `settings/README.md`.

## 1. Branch and worktree

- Branch: `design/ui-redesign`, in the `wt-ui-redesign` worktree (a sibling of
  the main checkout, which is on `master`).
- HEAD: `a7ec736`.
- Working tree: 1,141 changed entries, all under
  `design-exploration/prototypes/primer-v2/`. That is 2 modified tracked files
  and 1,139 untracked files. There are no changes elsewhere in the repository.

## 2. Last checkpoint

`a7ec736 docs(design): add Primer V2 Driver, Team and Circuit Detail prototypes`
(preceded by `566b5c6`). Both commits touch only `design-exploration/`:
`git diff 83dc28f HEAD -- . ':!design-exploration'` is empty.

## 3. Included paths (454 files plus manifest and `.gitignore`, about 8.0 MB)

All paths are relative to `design-exploration/prototypes/primer-v2/`.

| Path | Files | Size | Contents |
|---|---:|---:|---|
| `DESIGN-DECISIONS.md`, `DESIGN-BACKLOG.md` (modified) | 2 | 112 KB | +399 / −27 lines: Settings, Explore B and pilot entries. No status was changed in this step |
| `CORE-DESIGN-DECISIONS.md`, `DESIGN-SYSTEM-CONSOLIDATION.md` | 2 | 53 KB | New decision documents |
| `shared/` | 13 | 21 KB | Shared CSS foundation: tokens, base, 9 components, `nav-inset.js`, README |
| `explore/comparison-missing-media/` | 110 | 1.6 MB | Original Explore alternatives A and B (B was owner reviewed), generator, README, validation reports and scripts, 10 screenshots |
| `settings/` (root and preferences) | 98 | 1.2 MB | 20 source files including the generator, plus `validation-20261108-194048-final` reports and scripts and 11 screenshots |
| `settings/information/` | 168 | 2.6 MB | 32 source files including the generator, plus `validation-20261108-211707` reports and scripts and 14 screenshots (4 of them the owner-reviewed views cited in SI-01 and SI-02) |
| `consolidation-pilot/` | 61 | 2.4 MB | Calendar, Standings and Explore pilots; `tools/` (`visual-compare.mjs`, 3 configs, README); 3 REPORTs; every `results.json`; the original Calendar `compare.mjs`; 1 GPU diff pair |
| `CHECKPOINT-PREPARATION.md` (this file) | 1 | — | Manifest |
| `../../.gitignore` (proposed block, Appendix A) | 1 | — | Keeps the excluded evidence out of Git |

That gives 456 staged entries in total: 417 text files (3.3 MB), 37 PNGs
(4.7 MB), this manifest and `.gitignore`.

## 4. Excluded paths (687 files, 89.2 MB, kept on disk)

- **641 screenshots (89.0 MB)**:
  - Every pilot screenshot. The pilots match their approved baselines pixel for pixel, and representative views of those baselines are already tracked. The excluded folders are `sw-pilot/pilot-screens/` (130), `standings/…/sw-pilot/screens/` (24), `explore/…/sw-pilot/screens/` (40) and `gpu-control/diffs/` (8).
  - The non-representative screenshots of the three screen validations: 156 from comparison-missing-media, 107 from settings and 176 from information.
- **46 report files (214 KB)** that embed the local checkout's absolute path
  (see §7). Their results are also in each run's tracked `results.json`.

No source, generator, configuration, README or REPORT is excluded.

## 5. Counts and sizes

| | Files | Size |
|---|---:|---:|
| Working-tree changes | 1,141 | 97.1 MB |
| Checkpoint | 454 (+ manifest and `.gitignore`) = 456 entries | 8.0 MB |
| Stays local | 687 | 89.2 MB |

## 6. Largest items

**Included:** `settings/information/…/en-states-390x844-01.png` (467 KB);
`explore/comparison-missing-media/…/gallery-en-390x844-01.png` (467 KB);
`settings/information/…/en-states-390x844-02.png` (399 KB);
`consolidation-pilot/explore/…/sw-{control,pilot}/results.json` (252 KB each).

**Excluded folders:** `settings/information/validation-20261108-211707` (25.6 MB);
`explore/comparison-missing-media/validation-20261108-202406` (18.7 MB);
`consolidation-pilot/validation-20261108-224601-regression/sw-pilot/pilot-screens` (17.5 MB);
`consolidation-pilot/explore/…/sw-pilot/screens` (9.5 MB);
`settings/validation-20261108-194048-final` (9.2 MB);
`consolidation-pilot/standings/…/sw-pilot/screens` (8.0 MB).

## 7. Public-repository safety findings

**Scan method.** I pattern-scanned all 463 new or changed text files:
- API keys (Google, OpenAI-style, GitHub, Slack), private keys, bearer tokens, `api_key`, `client_secret`, passwords, Cloudflare tokens and AdMob IDs
- e-mail addresses
- absolute and personal paths
- temporary profiles and external URLs

No local secret scanner is installed. CI runs gitleaks on pull requests
(`pull_request.yml`, `secret-scan`).

| Check | Result |
|---|---|
| Keys, tokens, credentials, private configuration | None found |
| E-mail addresses | None |
| MCP or agent tooling files, hidden files, browser profiles | None in the proposed paths. Each harness creates its Chrome profile in the OS temp directory, outside the repository |
| **Local absolute paths** | **Found in 46 report files.** They contain `file:///` URLs of the nav links in the accessibility trees, the baseline and pilot paths on lines 3–4 of the pilot `summary.txt` files, and the file paths in `impeccable-detect.{json,txt}` of comparison-missing-media. Each path includes the Windows profile name and personal folder names. No tracked file has this today, so the files are excluded (Appendix A). `results.json` has no such paths |
| Photographs, Pinterest references, unclear media | None. The prototypes reference no image files (0 `<img>`, 0 `data:image`, no image `url()`). The "loaded" media state is a CSS tonal block. I opened three of the selected screenshots: they show UI with fixture data only |
| Fonts | No font binaries. Archivo (SIL OFL) loads from Google Fonts, as in the tracked prototypes |
| Other worktrees and unrelated user changes | None. Every changed entry belongs to the Primer V2 design work |

## 8. Licensing and attribution

There is no unresolved concern for the proposed files.
- The screenshots show only prototype UI: real driver and team names as factual fixture data, plus team colours. The tracked screenshots are of the same kind.
- The Settings information screens reproduce the project's existing Jolpica F1 CC BY-NC-SA 4.0 attribution and the non-affiliation statement.

**Owner decision on the 46 path-bearing reports.**
- **A (recommended, applied in this plan):** keep them local.
  - Side effect: `consolidation-pilot/REPORT.md` §4 then cites `sw-pilot/accessibility-tree-{en,es}.txt` as local-only evidence. Earlier READMEs already cite local-only screenshots the same way.
- **B:** you authorise redacted copies, with the checkout prefix replaced by a placeholder.
- **C:** you accept publishing the paths.

The harness will keep writing these paths on future runs. A later tool change
should normalise nav-link URLs and the summary header to repository-relative
paths. That change is not made here.

## 9. Reproducibility

- **Generators reproduce the committed HTML byte for byte.** I ran all 5 `build.py` files on a copy in a temporary directory, not in the worktree, and compared the output.
  - The 5 generators: `settings/`, `settings/information/`, `explore/comparison-missing-media/`, `consolidation-pilot/standings/` and `consolidation-pilot/explore/`.
  - The Calendar pilot has no generator; its HTML is hand-authored.
- **Settings generators read tracked repository files** (read-only): `lib/l10n/app_{en,es}.arb`, plus `content/attribution/data-sources.json` for the information screens. If those files change, a rebuild produces different HTML. This coupling is intended.
- **Every relative reference resolves inside the repository.**
  - 104 targets were checked from 102 HTML, CSS, JS and MD files.
  - None of them is ignored, outside the repository, or a binary file.
  - The one unresolved reference, `screen.css` in `shared/README.md`, is inside a code example.
- **`visual-compare.mjs` resolves paths relative to its config file.**
  - Requirements: Node 22+ and Chrome at the Windows default path (configs can override it with `chrome`).
  - The approved baselines are tracked. The excluded screenshots are outputs, not inputs.
  - Both versions need network access for Archivo on first load, as REPORT.md already notes.
  - A re-run writes a new timestamped folder and does not overwrite evidence.
- **Older per-screen capture scripts** take `protoDir` and `outDir` arguments and assume the same Chrome path. `settings/information/…/run.sh` runs relative to its own folder.
- **Dry run.** I added the Appendix A block through a temporary `core.excludesFile`; the real `.gitignore` was not changed. With it, `git add --dry-run design-exploration/prototypes/primer-v2` lists exactly the 450 intended files.

## 10. Recommended staging commands (do not run before approval)

```sh
# 1. Append Appendix A to design-exploration/.gitignore (after approval).

# 2. Stage explicit paths only.
git add -- \
  design-exploration/.gitignore \
  design-exploration/prototypes/primer-v2/CHECKPOINT-PREPARATION.md \
  design-exploration/prototypes/primer-v2/CORE-DESIGN-DECISIONS.md \
  design-exploration/prototypes/primer-v2/DESIGN-BACKLOG.md \
  design-exploration/prototypes/primer-v2/DESIGN-DECISIONS.md \
  design-exploration/prototypes/primer-v2/DESIGN-SYSTEM-CONSOLIDATION.md \
  design-exploration/prototypes/primer-v2/shared \
  design-exploration/prototypes/primer-v2/settings \
  design-exploration/prototypes/primer-v2/explore/comparison-missing-media \
  design-exploration/prototypes/primer-v2/consolidation-pilot

# 3. Verify before committing.
git diff --cached --name-only | wc -l                 # expect 456 (after Step 42C)
git diff --cached --name-only -- '*.png' | wc -l      # expect 37
git diff --cached --check                             # expect no output
git diff --cached --name-only -- . ':!design-exploration' | wc -l   # expect 0
git grep --cached -lIE -e 'file:///' -e ':.{1,2}Users.{1,2}' -- design-exploration \
  ':!design-exploration/prototypes/primer-v2/CHECKPOINT-PREPARATION.md'   # expect no output
# (the regex matches C:/Users/, C:\Users\ and JSON-escaped forms; it flags all
#  46 excluded reports on disk and none of the 450 included files)
git status --short | grep -v '^[AM] '                 # expect no output
```

## 11. Suggested commit message

```
docs(design): checkpoint Primer V2 Settings, Explore B and shared-foundation pilots

- Settings root, preferences and information prototypes with generators
- Explore missing-media comparison; owner-reviewed Alternative B
- Shared CSS foundation (tokens, base, components)
- Calendar, Standings and Explore consolidation pilots: 0 differing
  pixels across 119, 168 and 285 screenshot pairs
- visual-compare.mjs regression harness and per-screen configs
- Core decisions, consolidation plan, decision log and backlog updates
- Validation reports; representative screenshots only, the rest and
  reports embedding local paths stay on disk (design-exploration/.gitignore)
```

## 12. Local-only evidence cited by committed documents

These files are kept on disk and out of Git (Appendix A). Every committed
report or README that cites them also has the machine-readable results in
Git: `results.json`, plus `summary.txt` wherever the summary holds no local
path. Anyone with a checkout can regenerate the files with the committed
tools. A re-run writes a new timestamped folder.

| Cited in | Local-only files | Regenerate with |
|---|---|---|
| `consolidation-pilot/REPORT.md` §4 | `sw-pilot/accessibility-tree-{en,es}.txt`, `gpu-pilot/accessibility-tree-{en,es}.txt`, `sw-pilot/pilot-screens/`, `gpu-control/diffs/` (only the `gpu-pilot/diffs/` pair is committed) | From `consolidation-pilot/tools/`: `node visual-compare.mjs calendar.config.mjs --shots all` (and `--gpu`, `--control`). This writes a new timestamped folder. The original `compare.mjs` writes into its own folder and would overwrite this evidence, so copy it into a new folder at the same depth before running `node compare.mjs [control] [sw]` |
| `consolidation-pilot/standings/REPORT.md` | The `summary.txt` files and 4 of the 6 accessibility trees in each `sw-pilot/`; `sw-pilot/screens/` | From `consolidation-pilot/tools/`: `node visual-compare.mjs standings.config.mjs` (add `--control` for the noise floor) |
| `consolidation-pilot/explore/REPORT.md` | The `summary.txt` files and 6 of the 10 accessibility trees in `sw-pilot/`; `sw-pilot/screens/` | `node visual-compare.mjs explore.config.mjs` (add `--control`) |
| The Calendar rechecks (`validation-20261109-*-calendar-recheck/`) | The `summary.txt` files and all 8 accessibility trees | `node visual-compare.mjs calendar.config.mjs` (add `--control`) |
| `explore/comparison-missing-media/README.md` "Screenshots to compare" | 156 of the 166 screenshots; `impeccable-detect.{json,txt}` | `capture.mjs`, `layout.mjs`, `a11y.mjs` and `behaviour.mjs` in its validation folder, each run with that folder's `protoDir` and `outDir` arguments; `impeccable detect` for the detector files |
| `settings/README.md`, `settings/information/README.md` "Screenshots to review first" | Every listed screenshot outside the committed selection | `settings/information/validation-20261108-211707/run.sh`; for the root, `capture.mjs` and the sibling scripts in `settings/validation-20261108-194048-final/` |

Earlier checkpoints follow the same convention: their READMEs cite
screenshots that stay local.

## 13. Follow-up: comparison utility writes absolute local paths

`consolidation-pilot/tools/visual-compare.mjs`, the original Calendar
`compare.mjs` and the `impeccable detect` output write the checkout's absolute
path into their reports:
- `file:///` URLs of nav links that point outside the page folder, in the accessibility trees (only the document URL is normalised);
- the baseline and pilot paths on lines 3–4 of `summary.txt`;
- file paths in the detector JSON and text output.

This is why 46 reports stay local. **Task:** make the harness emit
repository-relative paths, normalising every link URL against the repository
root and printing relative baseline and pilot folders. Then re-check the
detector output before committing future evidence. Not fixed in this
checkpoint; until it is, any new validation folder needs the §10 path check
before staging.

**Status 2026-11-09 (Step 43):** done for `visual-compare.mjs` only. New
reports write `<repo>/…` for file URLs outside the page folder and
repository-relative baseline and pilot folders (`tools/README.md`). The
original Calendar `compare.mjs` (kept as evidence) and the `impeccable
detect` output are unchanged, and the 46 older reports keep their paths. The
§10 path check still applies before staging.

## Appendix A: `design-exploration/.gitignore` block (applied in Step 42B)

Appended at the end of the file. It follows the existing convention: narrow
per-folder rules and explicit file names, with no global PNG rule.

```gitignore
# ---------------------------------------------------------------------------
# Step 42A checkpoint (2026-11-09). Same rule as above: reports and capture
# scripts tracked, screenshots local except a representative selection.

# Explore missing-media comparison (owner reviewed Alternative B)
/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/*.png
!/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/before-en-drivers-390x844-01.png
!/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/after-a-en-drivers-390x844-01.png
!/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/after-b-en-drivers-390x844-01.png
!/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/after-b-en-teams-390x844-01.png
!/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/after-b-en-circuits-390x844-01.png
!/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/after-b-es-drivers-390x844-01.png
!/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/after-b-en-drivers-320x693-01.png
!/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/after-b-es-teams-320x693-text200-01.png
!/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/gallery-en-390x844-01.png
!/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/gallery-en-390x844-02.png

# Settings root and preferences
/prototypes/primer-v2/settings/validation-20261108-194048-final/*.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/en-index-390x844-01.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/es-index-390x844-01.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/en-index-320x693-01.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/en-index-320x693-text200-01.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/en-theme-390x844-01.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/en-language-390x844-01.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/en-time-390x844-01.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/en-non-production-390x844-01.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/en-production-no-contact-390x844-01.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/en-states-390x844-01.png
!/prototypes/primer-v2/settings/validation-20261108-194048-final/en-states-390x844-02.png

# Settings information screens
/prototypes/primer-v2/settings/information/validation-20261108-211707/*.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/en-data-390x844-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/en-acknowledgements-390x844-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/en-privacy-390x844-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/en-about-390x844-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/es-data-390x844-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/es-acknowledgements-390x844-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/en-privacy-320x693-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/en-acknowledgements-320x693-text200-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/en-states-390x844-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/en-states-390x844-02.png
# Owner-reviewed views cited in DESIGN-DECISIONS (SI-01, SI-02)
!/prototypes/primer-v2/settings/information/validation-20261108-211707/en-data-season-unavailable-390x844-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/es-data-sample-390x844-01.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/en-acknowledgements-390x844-02.png
!/prototypes/primer-v2/settings/information/validation-20261108-211707/es-acknowledgements-390x844-02.png

# Consolidation pilots: pilot screenshots are pixel-identical to the approved
# baselines (0 differing pixels), whose representative views are tracked
# above. Only the one GPU-mode pilot diff pair cited in REPORT.md is tracked.
/prototypes/primer-v2/consolidation-pilot/validation-20261108-224601-regression/sw-pilot/pilot-screens/
/prototypes/primer-v2/consolidation-pilot/validation-20261108-224601-regression/gpu-control/diffs/
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-172944-regression/sw-pilot/screens/
/prototypes/primer-v2/consolidation-pilot/explore/validation-20261109-183220-regression/sw-pilot/screens/

# Reports that embed the local checkout's absolute path (file:/// URLs in
# accessibility trees, baseline/pilot paths in summaries, file paths in
# detector output). Kept on disk; results.json carries the same results.
/prototypes/primer-v2/consolidation-pilot/explore/validation-20261109-183220-regression/sw-control/summary.txt
/prototypes/primer-v2/consolidation-pilot/explore/validation-20261109-183220-regression/sw-pilot/accessibility-tree-en-category_circuits.txt
/prototypes/primer-v2/consolidation-pilot/explore/validation-20261109-183220-regression/sw-pilot/accessibility-tree-en-category_teams.txt
/prototypes/primer-v2/consolidation-pilot/explore/validation-20261109-183220-regression/sw-pilot/accessibility-tree-en.txt
/prototypes/primer-v2/consolidation-pilot/explore/validation-20261109-183220-regression/sw-pilot/accessibility-tree-es-category_circuits.txt
/prototypes/primer-v2/consolidation-pilot/explore/validation-20261109-183220-regression/sw-pilot/accessibility-tree-es-category_teams.txt
/prototypes/primer-v2/consolidation-pilot/explore/validation-20261109-183220-regression/sw-pilot/accessibility-tree-es.txt
/prototypes/primer-v2/consolidation-pilot/explore/validation-20261109-183220-regression/sw-pilot/summary.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-172944-regression/sw-control/summary.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-172944-regression/sw-pilot/accessibility-tree-en-championship_constructors.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-172944-regression/sw-pilot/accessibility-tree-en.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-172944-regression/sw-pilot/accessibility-tree-es-championship_constructors.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-172944-regression/sw-pilot/accessibility-tree-es.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-172944-regression/sw-pilot/summary.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-183220-recheck/sw-control/summary.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-183220-recheck/sw-pilot/accessibility-tree-en-championship_constructors.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-183220-recheck/sw-pilot/accessibility-tree-en.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-183220-recheck/sw-pilot/accessibility-tree-es-championship_constructors.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-183220-recheck/sw-pilot/accessibility-tree-es.txt
/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-183220-recheck/sw-pilot/summary.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261108-224601-regression/gpu-pilot/accessibility-tree-en.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261108-224601-regression/gpu-pilot/accessibility-tree-es.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261108-224601-regression/sw-pilot/accessibility-tree-en.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261108-224601-regression/sw-pilot/accessibility-tree-es.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-172944-calendar-recheck/sw-control/summary.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-172944-calendar-recheck/sw-pilot/accessibility-tree-en-state_failed.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-172944-calendar-recheck/sw-pilot/accessibility-tree-en-state_refreshing.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-172944-calendar-recheck/sw-pilot/accessibility-tree-en-state_stale.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-172944-calendar-recheck/sw-pilot/accessibility-tree-en.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-172944-calendar-recheck/sw-pilot/accessibility-tree-es-state_failed.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-172944-calendar-recheck/sw-pilot/accessibility-tree-es-state_refreshing.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-172944-calendar-recheck/sw-pilot/accessibility-tree-es-state_stale.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-172944-calendar-recheck/sw-pilot/accessibility-tree-es.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-172944-calendar-recheck/sw-pilot/summary.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-183220-calendar-recheck/sw-control/summary.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-183220-calendar-recheck/sw-pilot/accessibility-tree-en-state_failed.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-183220-calendar-recheck/sw-pilot/accessibility-tree-en-state_refreshing.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-183220-calendar-recheck/sw-pilot/accessibility-tree-en-state_stale.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-183220-calendar-recheck/sw-pilot/accessibility-tree-en.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-183220-calendar-recheck/sw-pilot/accessibility-tree-es-state_failed.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-183220-calendar-recheck/sw-pilot/accessibility-tree-es-state_refreshing.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-183220-calendar-recheck/sw-pilot/accessibility-tree-es-state_stale.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-183220-calendar-recheck/sw-pilot/accessibility-tree-es.txt
/prototypes/primer-v2/consolidation-pilot/validation-20261109-183220-calendar-recheck/sw-pilot/summary.txt
/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/impeccable-detect.json
/prototypes/primer-v2/explore/comparison-missing-media/validation-20261108-202406/impeccable-detect.txt
```
