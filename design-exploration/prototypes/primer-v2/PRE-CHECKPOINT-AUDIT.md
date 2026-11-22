# Pre-checkpoint repository audit (Step 50A)

**Status: read-only audit, 2026-11-12. Nothing staged, committed, pushed or
deleted.** Before the audit, Step 50A made one set of edits: the Step 49
closure was recorded in `DESIGN-DECISIONS.md`, `DESIGN-BACKLOG.md` and
`STATUS-LOCALIZATION-ACCESSIBILITY-REVIEW.md` §12. Apart from this report, no
other repository file was changed. Git configuration was only read.

## 1. Actual repository status

| | |
|---|---|
| Worktree | `wt-ui-redesign`, a linked worktree of the GridView repository |
| Branch | `design/ui-redesign` |
| HEAD | `e3e9f88` docs(design): checkpoint Primer V2 shared-foundation consolidation pilots |
| Staged | none |
| Modified (tracked) | 13 files, all under `design-exploration/` |
| Untracked | 254 files, all under `design-exploration/prototypes/primer-v2/` |
| Outside `design-exploration/` | **no change** (Flutter `lib/`, `test/`, ARB files, `services/`, configuration, docs: untouched) |
| Ignored under `design-exploration/` | 6,222 files, 839.5 MB (5,956 PNG). Pre-existing rules plus the narrow Step 48–49 rules; every ignored file in the new experiments is a PNG |
| Line endings | `core.autocrlf=true`. `.md`, `.js`, `.mjs` and `.json` are `eol=lf`; `.py`, `.html` and `.css` are `text=auto` and stored as LF. Git warns that it would convert those to CRLF on checkout; the index stays LF. No CRLF in any proposed file |

## 2. Change inventory (proposed checkpoint)

| Class | Files | Size | Content |
|---|---|---|---|
| **A. Design decisions and documentation** | 10 + `.gitignore` | 0.44 MB | **Modified:** `DESIGN-DECISIONS.md`, `DESIGN-BACKLOG.md`, `DESIGN-SYSTEM-CONSOLIDATION.md`, `design-exploration/.gitignore` (+130 lines, additions only). **New:** `HEADER-AND-HEADING-DECISIONS.md` (48A), the six `STATUS-*.md` (49A–49F), and this report |
| **B. Isolated experiments** | 163 | 9.54 MB | `cross-screen-refinement/`: 89 source files (HTML, CSS, JS, MJS, Python generators, configs), 6 reports, 68 machine-readable results (`results.json`, `summary.txt`, accessibility trees) |
| **C. Consolidation-pilot changes (Step 48B)** | 8 modified + 24 new | 1.13 MB | Explore and Standings pilots load `shared/title-fit.js` (`build.py`, two pages each, `explore.js`, `standings.js`); title-fit recheck results (JSON and text only) |
| **D. Shared experimental utilities** | 2 | 0.01 MB | `shared/title-fit.js` (new; the S-2 title fit moved verbatim out of the two pilots), `shared/README.md` (documents it and the Calendar experiments) |
| **E. Selected screenshot evidence** | 59 PNG | 6.63 MB | The owner-reviewed sets kept visible by the narrow re-include rules, listed in §5 |
| **F. Generated or local only (excluded)** | 6,222 ignored | 839.5 MB | Screenshot collections, diff masks, older validation runs, concept assets. All stay on disk |
| **G. Unexpected or unrelated** | **0** | — | No file of unclear origin. Every file maps to Steps 48A–50A |

**Experiments (class B and E):**

| Experiment | Step | Files | Visible PNG |
|---|---|---|---|
| `calendar-title-fit/` | 48B | 32 | 12 diffs |
| `calendar-sticky-split/` (Stage 2, historical) | 48C/D | 31 | 4 |
| `calendar-stage1/` (preferred, CT-03) | 48E/F | 40 | 6 |
| `home-upcoming-omit/` | 49B | 11 | 2 |
| `circuit-absence/` | 49B | 19 | 4 |
| `notice-coexistence/` | 49D | 40 | 16 |
| `status-visual-consistency/` | 49E | 45 | 15 |
| `caption-localization/` | 49F.1 | 3 | 0 (measurement only) |
| `EVIDENCE-RETENTION.md` | 48G | 1 | — |

## 3. Validation and consistency results

- **Approved prototypes:** none modified. The only tracked changes under
  `primer-v2/` are the decision documents, the Explore and Standings pilots
  and `shared/README.md`.
- **Pilots:**
  - only the expected Step 48B change (title fit moved to
    `shared/title-fit.js`; script tag added; generator updated);
  - recheck `validation-20261110-130945-title-fit-recheck/`: Explore 66 runs
    and 285 pairs, Standings 39 runs and 168 pairs; **0 differing pixels, 0
    DOM, style or accessibility-tree differences**, controls 0.
- **Generators match their pages (read-only):**
  - `build.py --check` exit 0 for the Explore pilot and all seven experiment
    generators;
  - the Standings pilot generator has no `--check`; its four pages were
    compared in memory and match exactly.
- **Calendar direction:**
  - `calendar-stage1/REPORT.md` and DD CT-03 state Stage 1 is preferred and
    Stage 2 historical;
  - DD CT-02 records the title release as not preferred;
  - see §6 for two stale headers elsewhere.
- **Step 49 consistency:** checked in `STATUS-LOCALIZATION-ACCESSIBILITY-REVIEW.md`
  §4–§5 and corrected in §11.4; closure recorded in §12.
  - L1 approved;
  - XS-30 Open;
  - XS-11, XS-22 and XS-28 stay open.
- **References:** 585 backtick file references in the proposed Markdown were
  checked. All resolve, except filename patterns, proposed future files
  (`primer-tokens.css`) and Jolpica's external `TERMS.md` (cited since
  HEAD).
- **Not run:** Flutter tests and analysis (no Flutter, ARB or backend file
  changed), and screenshot suites (not needed).

## 4. Security and licensing findings

Scope: all 208 proposed non-PNG files, counts only.

| Check | Result |
|---|---|
| Absolute Windows or user paths, `file:///` URLs, user name, machine temp paths | **None.** Two matches are text describing the earlier scan, and the `.gitignore` comment explaining why some reports stay local |
| E-mail addresses, personal names | None |
| Session URLs | None |
| Secrets, API keys, tokens, private keys | None |
| Fonts | None bundled. Pages load Archivo from Google Fonts (OFL), as at HEAD |
| Media | No photos or new assets. 59 PNG renders of the prototypes. Race and driver names come from existing fixtures, under the attribution already recorded (Jolpica, CC BY-NC-SA 4.0); unchanged |
| Binary files | Only the 59 PNGs |
| Largest files | Results JSON: 1.8, 1.35, 1.34 and 0.83 MB (all JSON 9.7 MB). Tracked per the established "machine-readable results tracked" rule |
| Temporary or debug output | None found (`__pycache__`, `.pyc`, logs, temp files: none) |

## 5. Proposed manifest

**Include (268 files, about 17.8 MB):**
1. **Decisions and docs (11):**
   - `DESIGN-DECISIONS.md`, `DESIGN-BACKLOG.md`, `DESIGN-SYSTEM-CONSOLIDATION.md`;
   - `HEADER-AND-HEADING-DECISIONS.md`;
   - `STATUS-SEMANTICS-AUDIT.md`, `STATUS-ABSENCE-DECISIONS.md`,
     `STATUS-RANKING-DECISIONS.md`, `STATUS-NOTICE-DECISIONS.md`,
     `STATUS-VISUAL-DECISIONS.md`, `STATUS-LOCALIZATION-ACCESSIBILITY-REVIEW.md`;
   - `PRE-CHECKPOINT-AUDIT.md`.
2. **`design-exploration/.gitignore`:** the narrow Step 48–49 rules.
3. **Shared (2):** `shared/title-fit.js`, `shared/README.md`.
4. **Pilots (32):** the 8 Explore and Standings source changes and the two
   title-fit recheck folders (JSON and text).
5. **Experiments (163):** every source, report and machine-readable result
   in the eight `cross-screen-refinement/` folders, plus
   `EVIDENCE-RETENTION.md`.
6. **Screenshots (59):**
   - `calendar-title-fit` 12;
   - `calendar-sticky-split` 4;
   - `calendar-stage1` 4 + 2;
   - `home-upcoming-omit` 2;
   - `circuit-absence` 4;
   - `notice-coexistence` 9 + 7;
   - `status-visual-consistency` 13 + 2.

**Exclude:** the 6,222 ignored files (screenshot collections, diff masks,
earlier validation runs). They stay on disk and are not force-added.
Nothing outside `design-exploration/` is included.

## 6. Remaining risks and concerns (none blocks a commit)

1. **Whitespace:** `STATUS-NOTICE-DECISIONS.md` line 281 is whitespace-only.
   `git diff --cached --check` will flag it. Fix it (one-line edit) or
   accept it.
2. **Stale status headers (historical files):**
   - `shared/README.md` lists the sticky-split and Stage 1 experiments as
     "not approved";
   - `calendar-sticky-split/REPORT.md` still calls Stage 2 the preferred
     direction (CT-02).

   DD CT-02 and CT-03 are authoritative and correct. Recommended: a one-line
   status note in each, or accept them as historical.
3. **Discoverability:** `HEADER-AND-HEADING-DECISIONS.md` is linked only
   from `calendar-title-fit/REPORT.md`, and `cross-screen-refinement/EVIDENCE-RETENTION.md`
   is not linked (its header still says "proposal, not applied" above its
   update note). Optional.
4. **Generated JSON:** 24 files lack a final newline. Harmless.
5. **Size:** about 17.8 MB, of which 9.7 MB is JSON. That is smaller than the
   previous checkpoint (464 files), and the policy is unchanged.
6. **Content limits:** experiments are Chrome-only evidence. Android,
   TalkBack and Flutter validation stay open (XS-02, XS-16, XS-19, XS-28,
   XS-30).

## 7. Commit recommendation

**One cohesive checkpoint commit.** `DESIGN-DECISIONS.md`,
`DESIGN-BACKLOG.md` and `.gitignore` interleave Step 48 and Step 49 changes.
Splitting would need partial staging of the same files and would leave a
Step 48 commit whose experiments cite decisions absent from it. The commit
body lists both steps for traceability, matching `e3e9f88` and `753c5c7`.

**Proposed message** (no trailer, as in the previous checkpoints; confirm):

```
docs(design): checkpoint Primer V2 Step 48 Calendar header and Step 49 status semantics

- Step 48: title-fit rule moved to shared/title-fit.js (Explore and
  Standings pilots: 0 differing pixels across 285 and 168 pairs);
  Calendar title-fit, sticky-split (historical) and Stage 1 (preferred,
  CT-03) experiments; header and heading decisions
- Step 49: status semantics audit; event absence (HM-01, CR-04),
  ranking (RK-1..RK-5), notice coexistence (N-1..N-7), status visuals
  (VS-1..VS-7) and the localization/accessibility review (L1, XS-30);
  Step 49 closed with conditions
- Isolated experiments with generators (all --check current) and
  machine-readable results; 59 owner-reviewed screenshots kept, the
  rest local (design-exploration/.gitignore)
- No Flutter, ARB, backend or approved-prototype change
```

## 8. Owner approval needed before committing

1. **Approve the manifest** in §5: 268 files, about 17.8 MB, everything
   under `design-exploration/`.
2. **Decide on §6 items 1–3:** fix them first (small documentation edits) or
   commit as is.
3. **Approve one cohesive commit and the message,** including whether to add
   a session trailer (previous checkpoints had none).
4. **Confirm that pushing is out of scope** unless separately authorised.

## 9. Step 50B updates (2026-11-12)

- **Owner-approved fixes:**
  - the three items in §6, items 1–3;
  - five whitespace findings that the §6 check had missed: three blank lines
    at the end of files, and the inherited spaces-only line in
    `status-visual-consistency/gp-states[.es].html`. That line is now
    normalized by the experiment generator, with identical pixels and
    accessibility tree.
- **Windows paths:** `git add` failed with "Filename too long". The fix is
  byte-identical short-named copies of 16 screenshots, made instead of a Git
  configuration change:
  - 15 were over the limit in this worktree or in the main checkout;
  - the 16th is the partner of a before/after pair.
- **Effect on the manifest:** the long-named originals stay on disk and
  ignored. Each `.gitignore` re-include now names the short copy. The
  mapping and hashes are in
  `cross-screen-refinement/EVIDENCE-RETENTION.md` ("Short Git-visible
  names").
- **Counts unchanged:** 268 files, 59 PNG.
