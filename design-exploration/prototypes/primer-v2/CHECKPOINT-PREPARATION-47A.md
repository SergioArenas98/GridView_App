# Checkpoint preparation: Step 47A (consolidation first pass)

Prepared 2026-11-10 (Step 47A). This is a **follow-up manifest**. The Step 42
record ([`CHECKPOINT-PREPARATION.md`](CHECKPOINT-PREPARATION.md), committed
in `753c5c7`) stays as it was, apart from its §13 status note dated
2026-11-09 (Step 43), which is part of this checkpoint.

**Status:** files staged with explicit paths. **No commit was created.**
The commit waits for owner authorisation.

## 1. Branch and worktree

| Item | Value |
|---|---|
| Branch | `design/ui-redesign`, in the `wt-ui-redesign` worktree (the main checkout is on `master`) |
| HEAD | `753c5c7` (docs(design): checkpoint Primer V2 Settings, Explore B and shared-foundation pilots) |
| Index before staging | empty |

**Working tree since `753c5c7`:** 7 modified tracked files and 450
untracked candidate files, all under `design-exploration/prototypes/primer-v2/`
or `design-exploration/.gitignore`. Nothing changed elsewhere in the
repository: no Flutter, backend, ARB, API-contract or content-registry
file, and no approved prototype.

## 2. Proposed committed files (464 entries, 14.8 MB uncompressed, about 1 MB compressed)

All paths are relative to `design-exploration/prototypes/primer-v2/`.

| Group | Files | Size | Contents |
|---|---:|---:|---|
| `../../.gitignore` (modified) | 1 | 25 KB | +24 narrow rules: each new pilot `sw-pilot/screens/` folder. No PNG-wide pattern |
| `CHECKPOINT-PREPARATION.md` (modified) | 1 | — | Step 43 status note in §13 only |
| `CHECKPOINT-PREPARATION-47A.md` (new) | 1 | — | This manifest |
| `DESIGN-BACKLOG.md` (modified) | 1 | — | Extensions to XS-02, XS-09 and SETT-17 (pilot findings); no new ID, no status change |
| `shared/` | 5 | 15 KB | New `components/detail-app-bar.css`, `detail-page.css` and `empty-state-detail.css`; `README.md`; a comment-only header in `components/notice.css` |
| `consolidation-pilot/tools/` | 12 | 126 KB | `visual-compare.mjs` (opt-in options: `outLabel`, `sharedRoots`, page `maxShots`, scroll coverage, arrow / Home / End keys, repository-relative report paths); README; 8 new configs (Driver, Team, Circuit, GP, Settings ×3, Home) and 2 shared modules (`detail-common.mjs`, `settings-common.mjs`) |
| `consolidation-pilot/*-SUMMARY.md` | 3 | 40 KB | `DETAIL-GROUP-SUMMARY.md`, `SETTINGS-GROUP-SUMMARY.md`, `CONSOLIDATION-SUMMARY.md` |
| Pilot sources | 106 | 0.82 MB | Per pilot: `build.py`, the generated pages, the local stylesheets and scripts, `REPORT.md` (see the next table) |
| Validation evidence | 334 | 13.7 MB | `results.json` (50), `summary.txt` (50), accessibility trees (234) for 25 folders × pilot and control |

| Pilot sources | Files |
|---|---:|
| `driver-detail/` | 10 |
| `team-detail/` | 12 |
| `circuit-detail/` | 12 |
| `grand-prix-detail/`, including the development-only `stress-title/` pages and their baseline copies | 15 |
| `settings/`, including `information/` | 52 |
| `home/` | 5 |

**Counts:** 464 entries, all text. **0 PNG files**, no binary, no font file.
The 1.6 MB of accessibility trees, 0.7 MB of summaries and 11.1 MB of
`results.json` are highly repetitive: all candidates together gzip to about 1.0 MB.

**Largest files:**
- `settings/information/validation-20261110-094550-regression/sw-{pilot,control}/results.json`: 603 KB each;
- `grand-prix-detail/validation-20261110-093100-recheck/sw-{pilot,control}/results.json`: 484 KB each.

### Validation folders included (machine-readable results only)

| Pilot | Folders |
|---|---|
| Calendar (rechecks) | `validation-20261109-220615-calendar-recheck`, `validation-20261110-070509-calendar-recheck`, `validation-20261110-093100-calendar-recheck` |
| Standings, Explore (rechecks) | `*/validation-20261109-220615-recheck`, `*/validation-20261110-070509-recheck`, `*/validation-20261110-093100-recheck` |
| Driver, Team, Circuit | `*/validation-20261109-220615-regression`, `*/validation-20261110-070509-recheck`, `*/validation-20261110-093100-recheck` |
| Grand Prix Detail | `validation-20261110-073121-regression`, `validation-20261110-093100-recheck` |
| Settings | `settings/validation-20261110-094550-root`, `-preferences`, `settings/information/validation-20261110-094550-regression` |
| Home | `home/validation-20261110-111848-regression`, and `home/validation-20261110-114914-recheck` (Step 47A, after the whitespace fix in §5a; no screenshots) |

- **Superseded runs are included on purpose.** The earlier rechecks
  (220615, 070509) are superseded by 093100 but cited by the group reports
  (17 references).
- **Precedent and convention:** Step 42 committed every `results.json`,
  and `tools/README.md` ("Evidence in Git") commits reports that hold no
  local path.
- **The lean alternative:** commit only the latest folder per pilot,
  140 files fewer. It would leave those citations pointing at local-only
  evidence. It was not chosen.

## 3. Included screenshots

**None.**
- Every pilot screenshot is pixel-identical to its approved baseline
  (0 differing pixels in every run).
- Representative views of those baselines are already tracked in the
  approved prototype folders.
- A pilot screenshot would add no new evidence. This follows the Step 42
  rule for the Calendar, Standings and Explore pilots.

## 4. Excluded local evidence (kept on disk, not deleted)

| Folder (`consolidation-pilot/…/sw-pilot/screens/`) | Files | Size |
|---|---:|---:|
| `driver-detail/` × 3 (220615, 070509, 093100) | 72 | 18.3 MB |
| `team-detail/` × 3 | 96 | 17.6 MB |
| `circuit-detail/` × 3 | 96 | 19.2 MB |
| `grand-prix-detail/` × 2 (073121, 093100) | 128 | 25.2 MB |
| `standings/` × 3 rechecks | 72 | 23.9 MB |
| `explore/` × 3 rechecks | 120 | 28.5 MB |
| `settings/` root and preferences (094550) | 128 | 11.5 MB |
| `settings/information/` (094550) | 112 | 13.9 MB |
| `home/` (111848) | 8 | 1.8 MB |
| **Total** | **832** | **159.9 MB** |

- **How they are excluded:** by the folder rules in `../../.gitignore`.
- **What they contain:** the first screenshot of each static run, in the
  pilot version only. Controls ran with `--shots none`.
- **Calendar rechecks:** none, because the Calendar config saves no shots.
- **What is still committed:** every committed report that cites these
  runs also has the pixel counts, per-shot RGBA hashes and coverage in the
  tracked `results.json`.
- **Regenerate** with the commands in each report's "Reproduce" section. A
  re-run writes a new timestamped folder.

**Unchanged:** the 46 path-bearing reports from before 2026-11-09, listed
in the Step 42 Appendix A, stay excluded. No new report carries a local
path (§6), so no new report needed excluding.

## 5. Reproducibility

- **All 9 pilot generators reproduce the committed pages byte for byte.**
  - The 9: Driver, Team, Circuit, GP, Explore, Standings, Home, Settings
    root, Settings information. The Calendar pilot is hand-authored.
  - Method: a copy of `primer-v2/` (without validation folders and
    screenshots), `lib/l10n/` and `content/attribution/` was made in a
    temporary directory; each `build.py` ran there and the output was
    compared with the worktree. 0 differences.
  - `--check` passes for all 8 generators that have it: the approved
    generators still reproduce every approved page, and the local copies of
    `settings.js`, `strings.js`, `information.js` and `nav-inset.js` are
    identical.
- **Configs:** all 11 load in Node. Each resolves every baseline and pilot
  page to an existing committed file, and every run names a declared page.
- **Syntax:** `node --check` passes for `visual-compare.mjs`, the pilots'
  scripts and `shared/nav-inset.js`. Every `build.py` compiles.
- **Relative references:** 827 references were checked, from the HTML
  `href` / `src`, CSS `url()`, Markdown links and config paths. All resolve
  to tracked or staged files. Four config `file` paths look unresolved only
  because they resolve against the baseline and pilot folders; the config
  check above verifies them.
- **No committed file needs excluded evidence to build or run.** The
  screenshots are outputs. The Settings and Home data checks read
  `lib/l10n/app_*.arb`, and the information screens read
  `content/attribution/data-sources.json`, both tracked and read only.
- **Requirements for a re-run:**
  - Node 22+;
  - Chrome at the default path;
  - network access for Archivo (Google Fonts), in both versions.
- **The summary's figures are verified.** Recomputed from the 22 cited
  `results.json` files (pilot and control), they match
  `CONSOLIDATION-SUMMARY.md` §4 exactly:
  - 931 runs and 2,485 pairs;
  - 0 differing pixels, 0 DOM / style / box / metric diffs and 0
    accessibility-tree diffs, in pilot and in control.
- **Not re-run:** the 931 validation runs. Their recorded results are
  unchanged. The only source change after they ran is the `home.css`
  whitespace fix (§5a), so only Home was re-run.

## 5a. Whitespace check (`git diff --cached --check`)

The first staging run reported four whitespace defects.

| File | Defect | Action |
|---|---|---|
| `consolidation-pilot/grand-prix-detail/REPORT.md:130` | a line of two spaces | **Stripped.** Documentation only |
| `consolidation-pilot/home/home.css` | an extra blank line at the end of the file | **Removed.** `build.py --check` still passes (117 = 49 + 68 rules). Home re-run in `home/validation-20261110-114914-recheck/`: 29 runs, 210 pairs, 0 differing pixels, 0 other diffs, 52 / 52 checks, control 0. The first evidence (`111848`) is unchanged |
| `consolidation-pilot/grand-prix-detail/states.html:267`, `states.es.html:267` | a whitespace-only line | **Kept.** The approved GP generator emits it, and the approved `grand-prix-detail/states{,.es}.html` (committed in `566b5c6`, line 257) have it. The pilot must reproduce the approved page byte for byte, so changing it would break `build.py --check` and the comparison |

After the fixes, `git diff --cached --check` reports only the two kept GP
gallery lines. **Accepting them is an owner decision before committing.**
The alternative is to fix the approved GP generator and its pages, which
this step may not do.

## 6. Public-repository safety

Pattern scan of all 457 candidate files, plus this manifest after it was
written:

| Check | Result |
|---|---|
| Personal paths (Windows profile folders, user and folder names, local-profile and temp folders, local file URLs) | No path in any file. The only hits are documentation text describing the path rule (`.gitignore` comment, `CHECKPOINT-PREPARATION.md` §7, §10, §13) |
| API keys, tokens, private keys, bearer tokens, AdMob IDs | None |
| "secret / token / password / api key" words | 108 files, all CSS design tokens (`tokens.css`, `GvColorsLight` tokens), not credentials |
| E-mail addresses | None |
| Claude session links, AI co-author or session trailers | None |
| MCP or agent configuration, browser profiles, temporary data | None. Chrome profiles live in the OS temp directory |
| Media | No image, video or font file. The pages reference no image (Archivo loads from Google Fonts, SIL OFL) |
| Generated clutter | None. `__pycache__` folders created by a compile check in this step were removed before staging |

No local secret scanner is installed. CI runs gitleaks on pull requests.

## 7. Open limitations

- **Not a final design.** The pilots prove consolidation without visual
  change only.
  - The design is not final and not production-ready.
  - The approvals stay provisional.
  - All backlog items stay open: XS-01, 02, 05, 07–09, 11, 16, 21, 22,
    26–29; HOME-01..07; SETT-01..20, including the SETT-18 licensing
    question.
- **Evidence limits:**
  - All evidence is Chrome headless emulation on Windows. No device,
    TalkBack or D-pad evidence exists.
  - Archivo loads from the network, so a re-run without network access
    fails the font checks in both versions.
- **Approved prototypes are not migrated.** They still load their own CSS
  copies (CONSOLIDATION-SUMMARY §8).
- **Old reports:** the 46 path-bearing reports from before Step 43 remain
  local.
- **Line endings:** Git warns that `.gitignore` and `shared/components/notice.css`
  would be checked out with CRLF (`core.autocrlf=true`). The index holds LF,
  as before, so this is a local warning only.

## 8. Staging commands (run in Step 47A)

```sh
git add -- \
  design-exploration/.gitignore \
  design-exploration/prototypes/primer-v2/CHECKPOINT-PREPARATION.md \
  design-exploration/prototypes/primer-v2/CHECKPOINT-PREPARATION-47A.md \
  design-exploration/prototypes/primer-v2/DESIGN-BACKLOG.md \
  design-exploration/prototypes/primer-v2/shared \
  design-exploration/prototypes/primer-v2/consolidation-pilot/tools \
  design-exploration/prototypes/primer-v2/consolidation-pilot/CONSOLIDATION-SUMMARY.md \
  design-exploration/prototypes/primer-v2/consolidation-pilot/DETAIL-GROUP-SUMMARY.md \
  design-exploration/prototypes/primer-v2/consolidation-pilot/SETTINGS-GROUP-SUMMARY.md \
  design-exploration/prototypes/primer-v2/consolidation-pilot/driver-detail \
  design-exploration/prototypes/primer-v2/consolidation-pilot/team-detail \
  design-exploration/prototypes/primer-v2/consolidation-pilot/circuit-detail \
  design-exploration/prototypes/primer-v2/consolidation-pilot/grand-prix-detail \
  design-exploration/prototypes/primer-v2/consolidation-pilot/settings \
  design-exploration/prototypes/primer-v2/consolidation-pilot/home \
  design-exploration/prototypes/primer-v2/consolidation-pilot/validation-20261109-220615-calendar-recheck \
  design-exploration/prototypes/primer-v2/consolidation-pilot/validation-20261110-070509-calendar-recheck \
  design-exploration/prototypes/primer-v2/consolidation-pilot/validation-20261110-093100-calendar-recheck \
  design-exploration/prototypes/primer-v2/consolidation-pilot/standings/validation-20261109-220615-recheck \
  design-exploration/prototypes/primer-v2/consolidation-pilot/standings/validation-20261110-070509-recheck \
  design-exploration/prototypes/primer-v2/consolidation-pilot/standings/validation-20261110-093100-recheck \
  design-exploration/prototypes/primer-v2/consolidation-pilot/explore/validation-20261109-220615-recheck \
  design-exploration/prototypes/primer-v2/consolidation-pilot/explore/validation-20261110-070509-recheck \
  design-exploration/prototypes/primer-v2/consolidation-pilot/explore/validation-20261110-093100-recheck

# Verification
git diff --cached --name-only | wc -l                                  # expect 464
git diff --cached --name-only -- '*.png' | wc -l                       # expect 0
git diff --cached --check                                              # expect only the two GP gallery lines (§5a)
git diff --cached --name-only -- . ':!design-exploration' | wc -l      # expect 0
git grep --cached -lIE -e 'file:///[A-Za-z]' -e '[A-Za-z]:.{1,2}Users.{1,2}[A-Za-z]' -- design-exploration \
  ':!design-exploration/prototypes/primer-v2/CHECKPOINT-PREPARATION.md'   # expect no output
git status --short | grep -v '^[AM] ' | grep -v '^??' | wc -l           # expect 0
```

## 9. Proposed commit message

No AI co-author trailer and no session link.

```
docs(design): checkpoint Primer V2 shared-foundation consolidation pilots

- Driver, Team, Circuit and Grand Prix Detail pilots on the shared
  foundation; new shared detail app bar, detail page and detail-size
  empty state
- Settings root, preferences and information pilots; shared notice
  reused with a local reading-width extension
- Home pilot: the 49 core rules load from shared/, 68 composition rules
  stay local
- All 11 pilots match their approved prototypes: 931 runs, 2,485
  screenshot pairs, 0 differing pixels, controls 0
- visual-compare.mjs opt-in options and repository-relative report
  paths; per-pilot configs and shared run modules
- Group summaries, first-pass consolidation summary and backlog
  extensions (no status changed)
- Machine-readable results only; pilot screenshots stay local
  (design-exploration/.gitignore)
```
