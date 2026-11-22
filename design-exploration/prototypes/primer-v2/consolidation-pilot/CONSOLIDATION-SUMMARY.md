# Primer V2 shared-foundation consolidation: first-pass summary

**Status: technical experiment, Steps 37–46 (2026-11-08 to 2026-11-10).**
No decision is made or changed here.

- **Every approved screen family** now has an isolated pilot that loads one
  shared foundation (`../shared/`). Each pilot renders identically to its
  approved prototype.
- **The approved prototypes are unchanged.** They still load their own
  `primer-core.css` copy, or Home's own `styles.css`.
- **Not final.** The visual design is not final, not production-ready, and
  not a Flutter implementation contract. The screen approvals stay
  provisional (`../DESIGN-DECISIONS.md`), and the core policies stay pending
  (`../CORE-DESIGN-DECISIONS.md`).

## 1. Consolidated screen families

| Family | Approved prototype | Pilot | Report |
|---|---|---|---|
| Home | `../refinement-01/` | `home/` | [`home/REPORT.md`](home/REPORT.md) |
| Calendar | `../calendar/` | this folder | [`REPORT.md`](REPORT.md) |
| Standings | `../standings/` | `standings/` | [`standings/REPORT.md`](standings/REPORT.md) |
| Explore Alternative B | `../explore/` | `explore/` | [`explore/REPORT.md`](explore/REPORT.md) |
| Grand Prix Detail | `../grand-prix-detail/` | `grand-prix-detail/` | [`DETAIL-GROUP-SUMMARY.md`](DETAIL-GROUP-SUMMARY.md) |
| Driver Detail | `../driver-detail/` | `driver-detail/` | same |
| Team Detail | `../team-detail/` | `team-detail/` | same |
| Circuit Detail | `../circuit-detail/` | `circuit-detail/` | same |
| Settings root and preferences | `../settings/` | `settings/` | [`SETTINGS-GROUP-SUMMARY.md`](SETTINGS-GROUP-SUMMARY.md) |
| Settings information screens | `../settings/information/` | `settings/information/` | same |

**What every pilot differs in, and nothing else:**
- its stylesheet and script references, with their relative paths;
- CSS ownership: rules that moved verbatim to `../shared/`.

**How the pages are made:**
- **Generated families** (Settings, the details): the pilot imports the
  approved generator read-only, and `--check` proves that generator still
  reproduces every approved page byte for byte.
- **Home and Calendar:** the pages are copies of the approved markup with
  the link block swapped. For Home, `build.py --check` verifies this.

## 2. Shared styles and components now available

| File | Contents | Consumers (pilots) |
|---|---|---|
| `tokens.css` | palette, 12° cut, gutter, radii, nav height, font | all |
| `base.css` | reset, body type, focus ring, selection, utilities, icons, `[hidden]` guard, reduced motion | all |
| `components/app-bar.css` | wordmark / title bar, season, actions, `.icon-btn`, freshness | all; Settings and the details use only `.icon-btn` |
| `components/section-title.css` | 20px `h2` | Home, Driver, Team, Circuit, GP |
| `components/chip.css` | status chip vocabulary | Home, Calendar, Standings, Explore, details |
| `components/tag.css` | 12° livery tag | Home |
| `components/text-link.css` | text link (+ Ember) | Home |
| `components/nav.css` + `nav-inset.js` | adaptive bottom navigation (regular → condensed → stacked) | Home, Calendar, Standings, Explore |
| `components/notice.css` | the common notice subset | Calendar, Standings, Explore, details, Settings information |
| `components/selector.css` | segmented selector without column count or padding | Standings, Explore |
| `components/empty-state.css` | empty / error block | Standings, Explore, details |
| `components/empty-state-detail.css` | opt-in detail-size variant | details |
| `components/detail-app-bar.css` | back plus a one-line title | details |
| `components/detail-page.css` | `.page`, `.sec`, `.sec__title` | details |

- **No new tokens.** No token value changed.
- **Load order** is documented in [`../shared/README.md`](../shared/README.md).
  It keeps the core's cascade order. Home's report (§2) shows that its
  interleaved rules have no order dependency.

## 3. Screen-specific patterns intentionally retained

These are compositions or unresolved variants. Each stays in its screen
stylesheet, or as a **local extension** that loads after the shared
component it extends.

- **Home:**
  - the Graphite hero with the 12° Red Oxide round block and its top-strip
    form;
  - the full-bleed sessions band;
  - the Chalk championship band with its 12° seam;
  - the latest result with the "22" watermark;
  - the known-empty upcoming row;
  - the Explore strip.
- **Calendar:** sticky app bar with the `14cqi` title cap; the next-event
  block; the compact list chip.
- **Standings and Explore:**
  - pinned header, title fit and header budget;
  - the nav selected-label fallback;
  - selector columns and padding (12px vs 10px);
  - `.notice { text-wrap: pretty; }`;
  - list-size empty state;
  - Explore's entity rows and the Alternative B overrides.
- **Details:**
  - identity band, plate, banner and sheet;
  - championship figures;
  - fact rails and timetables;
  - the GP classification with its 12° winner cell;
  - chip additions (`--outline`, `--done`, `--alert`, `--fastest`, `--sm`);
  - `.page-notice`;
  - `.btn:hover` (Driver, Team and Circuit only).
- **Settings:**
  - the Settings bar, a variant of the detail bar with sticky chrome, the
    environment strip and a wrapping `h1`;
  - rows, option list, selection mark, snackbar and kicker;
  - facts and the source block;
  - the notice's reading-width extension;
  - the S-2 single-word title fit.

None was turned into a generic card, hero or title component.

## 4. Regression results

Conditions for every final run: Chrome 157 (157.0.8103.39 since
2026-11-10), software raster, DPR 2, mobile emulation with touch.
Coverage for every run:
- EN and ES; 390×844 and 320×693; 100% and 200% text;
- every approved scenario and gallery;
- full scroll capture;
- keyboard, pointer and reduced motion.

| Family | Runs | Screenshot pairs | Differing pixels | Other diffs | Control | First evidence | Latest evidence |
|---|---|---|---|---|---|---|---|
| Home | 29 | 210 | **0** | 0 | 0 | `home/validation-20261110-111848-regression/` | `home/validation-20261110-114914-recheck/` (after a trailing-blank-line fix in `home.css`) |
| Calendar | 39 | 119 | **0** | 0 | 0 | `validation-20261108-224601-regression/` | `validation-20261110-093100-calendar-recheck/` |
| Standings | 39 | 168 | **0** | 0 | 0 | `standings/validation-20261109-172944-regression/` | `standings/validation-20261110-093100-recheck/` |
| Explore Alternative B | 66 | 285 | **0** | 0 | 0 | `explore/validation-20261109-183220-regression/` | `explore/validation-20261110-093100-recheck/` |
| Grand Prix Detail | 105 | 385 | **0** | 0 | 0 | `grand-prix-detail/validation-20261110-073121-regression/` | `grand-prix-detail/validation-20261110-093100-recheck/` |
| Driver Detail | 56 | 146 | **0** | 0 | 0 | `driver-detail/validation-20261109-220615-regression/` | `driver-detail/validation-20261110-093100-recheck/` |
| Team Detail | 74 | 187 | **0** | 0 | 0 | `team-detail/validation-20261109-220615-regression/` | `team-detail/validation-20261110-093100-recheck/` |
| Circuit Detail | 74 | 152 | **0** | 0 | 0 | `circuit-detail/validation-20261109-220615-regression/` | `circuit-detail/validation-20261110-093100-recheck/` |
| Settings root | 114 | 282 | **0** | 0 | 0 | `settings/validation-20261110-094550-root/` | same |
| Settings preferences | 129 | 159 | **0** | 0 | 0 | `settings/validation-20261110-094550-preferences/` | same |
| Settings information | 206 | 392 | **0** | 0 | 0 | `settings/information/validation-20261110-094550-regression/` | same |
| **All** | **931** | **2,485** | **0** | 0 | 0 | | |

- **"Other diffs"** covers text, computed styles including `::before` /
  `::after`, boxes, quality metrics, accessibility trees, keyboard order
  with role and name, and resolved link targets.
- **Recheck policy:** after every change to a shared file or to the
  comparison tool, all earlier pilots were re-run, each with a control.
  Earlier evidence was never overwritten.
- **Step 46 changed neither:** no shared CSS, no `nav-inset.js` and no tool
  change. `home.config.mjs` is new, and only documentation and comments
  changed. The 093100 rechecks therefore stand.
- **Not proven:** an identical page is not proof that the approved page is
  accessible or correct. TalkBack, D-pad, Android font scaling and
  real-device checks are still outstanding (XS-02, XS-05, XS-16).

## 5. Known unresolved cross-screen inconsistencies

Recorded, not decided. Each is kept exactly as approved per screen.

| Item | Inconsistency |
|---|---|
| XS-07 / §5.1 | Title fit: Calendar caps at `14cqi`; Standings and Explore narrow the width axis, then scale; the detail bars ellipsize; Settings and information wrap uncapped, plus the S-2 fit; Home's wordmark has the same latent limit |
| XS-29 / §5.9 | Two visual levels for `h2`: the 20px section title vs the 13px kicker with rule (Calendar, Standings, Settings, Circuit) |
| XS-11 / §5.7 | Unknown status: a dashed chip (Home, Calendar, GP event) vs plain grey text (GP session); the GP chip additions are copied into three details |
| XS-08 | Nav selected-label fallback (`wdth` 62, 700) only on Standings and Explore |
| XS-09 drift | Notice `text-wrap: pretty` everywhere but Calendar; empty state 32/20px (lists) vs 28/18px (details); selector padding 12px vs 10px; `.btn:hover` only on Driver, Team and Circuit; row pressed state is a tray fill vs GP's 6% Chalk overlay; Driver `.ch__link` and Team `.dest` identical under different classes; the Settings bar shares six declarations with the detail bar |
| XS-22 | The partial notice uses the offline icon (Driver, Team, Circuit) |
| XS-26 | Selected fill: gradient (selector slabs, Calendar block, Driver plate) vs flat oxide (navigation slab, Winner tag) |
| XS-27 | Three implementations of the 12° edge (`skewX`, `clip-path` with a fixed run, thin skewed seams) |
| XS-12 | Points unit "pts": Standings leader and GP rows only |
| XS-21 | Sample / frozen-data banner across Home, Calendar, Standings and Explore |
| XS-02 (Home, new) | Two links named "View Grand Prix" open different events; the session link's name is its whole row |
| XS-01 | Light theme: only a labelled provisional preview exists (Settings) |
| XS-28 | Flutter's current tokens are a different visual system |

Screen items stay open as recorded: HOME-01..07, CAL, STD, EXP, GPD, DR,
TM, CR, SETT-01..20, including the SETT-18 licensing question.

## 6. Prototype consolidation is not Flutter implementation

- **What the pilots prove.** The approved HTML / CSS can share one
  foundation without any visible or structural change. That makes the
  component boundaries explicit (§2, §3), and the drift items concrete
  (§5).
- **What they do not do:**
  - change or specify a Flutter widget, theme, token, ARB string, domain
    model or API contract;
  - map the CSS tokens to Flutter (XS-28);
  - decide how Archivo is bundled offline (the prototypes load it from
    Google Fonts);
  - validate Android's non-linear font scaling, TalkBack or D-pad;
  - replace simulated behaviour (hash routes, simulated persistence and
    refresh) with real behaviour.
- **What Flutter will need:** Primer V2 would be reproduced with native
  equivalents, not by translating this CSS (`CORE-DESIGN-DECISIONS.md` §1).
  The pilots are a reference for what is shared and what is a composition,
  not code to port.
- **What the approvals are.** They are visual and provisional. Each
  README's list of differences from Flutter remains the record of what an
  implementation must decide.

## 7. Recommended next steps for visual-system refinement

1. **Decide the drift items, one at a time,** before any visual correction,
   starting with those that block extraction:
   - XS-29: one `h2` style plus one kicker;
   - XS-07: the unified title policy, already proposed;
   - XS-11: the unknown-status treatment;
   - XS-08: the nav fallback;
   - the notice wrap and the empty-state size.

   Apply each decision once in `../shared/`. Then re-run every pilot and
   review the **expected** differences; the unexpected ones must still be
   0.
2. **Then the light theme (XS-01)** on the decided foundation. Prototype it
   on three screens first (Home, Standings, Settings), as the consolidation
   document proposes.
3. **Device evidence** on the decided foundation (XS-16, XS-05, XS-02):
   OLED, safe areas, scrolling, TalkBack, D-pad.
4. **Flutter token mapping (XS-28) and implementation planning,** with the
   per-screen difference lists. Only after explicit authorisation.

## 8. Should the source prototypes be migrated to the shared styles?

**Recommendation: not yet.** Keep the approved prototypes frozen as the
reference, and keep the pilots as the consolidated copies, until the §5
drift decisions are made. Then migrate one family at a time, or promote the
pilots in their place, against a fixed baseline.

**Why wait:**

- **The baseline would disappear.** Every zero-difference result compares
  a pilot with an approved folder that has never changed. Migrating the
  approved folders removes that reference. Before any migration, freeze
  the baseline (a commit or tag such as the 42A–C checkpoint `753c5c7`, or
  an archived copy) and compare against it.
- **The approvals point at specific files.** `DESIGN-DECISIONS.md` and the
  READMEs cite these folders and their validation evidence. A migration
  must keep those citations true, or record what replaced them.
- **The generators write the old links.** The Settings and detail
  generators emit `primer-core.css` links. Migrating means changing
  approved generators, and every page must then be re-verified.
- **Cascade order.** The shared files load before the screen stylesheet.
  Home's interleaved rules were shown to be independent of order (Home
  report §2), and the other screens were already ordered core-first. A
  hand migration that reorders links or rules could still change computed
  styles silently. The comparison must run after each family.
- **Double change.** Migrating before the drift decisions means every
  later decision touches both the pilots and the sources. Deciding first
  means one migration with intended differences, reviewed once.
- **Folder depth and paths.** Shared references (`../shared/` vs
  `../../shared/`) and the Settings information screens' links to the root
  differ by depth. Each needs the same path normalisation the tool already
  applies.

**What a migration would gain:**
- one copy of the core instead of nine (eight `primer-core.css` copies plus
  Home's own stylesheet);
- one place to apply decisions;
- no further copy drift (XS-09).

## Reproduce

Each report lists its build check and its two commands (pilot and control).
All configs are in `tools/`; see [`tools/README.md`](tools/README.md).
