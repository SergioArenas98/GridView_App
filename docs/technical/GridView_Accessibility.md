# GridView - Accessibility

## Document information

- Product: GridView
- Document type: Accessibility evidence and status (implementation)
- Status: **Phase 8C-3 automated hardening implemented; one populated TalkBack
  review executed; further manual screen-reader polish deferred by product
  decision.** No accessibility certification is claimed.
- Related documents:
  - `GridView_TRD.md` §28 (accessibility requirements)
  - `GridView_Design_System.md` (component-level semantics)
  - `GridView_Implementation_Plan.md` §13.7 (Phase 8 accessibility tasks)
  - `../testing/README.md` (the automated suites themselves)
- Document date: 2026-08-17

---

## 1. Status and scope

Phase 8C-3 accessibility hardening is **implemented**, and the automated
baseline it produced is **retained** as part of the ordinary quality suite. It
is not a one-off audit: every assertion below runs on every change.

One **populated** Android TalkBack review was performed, on the dedicated
`gv_phase8c2_verify` emulator against public staging data, with a person
listening to real spoken output. It found several screen-reader polish issues,
which are recorded in §4 and are **not fixed**.

After that review, further manual accessibility polish is **deferred**. This is
a change in project prioritisation, not a claim that the findings were resolved
or that they never existed. Manual TalkBack validation is **no longer a Phase 8
engineering exit criterion** (§5).

**No accessibility certification is claimed**, and none has been sought.

### 1.1 The three evidence levels

These are kept apart everywhere in this document, because conflating them is how
an accessibility claim becomes untrue:

| Level | What it is | What it can prove |
|---|---|---|
| **1 — Flutter semantics** | `flutter_test` assertions over the rendered semantics tree | What the framework exposes, and how widgets respond to input. **Never** what a screen reader says. |
| **2 — Android platform** | The accessibility node tree and events observed through the platform bridge on a device | What a screen reader is *given*. **Never** what it spoke. |
| **3 — Human-heard** | A person listening to TalkBack and reporting what they heard | What was actually spoken. Nothing else establishes this. |

A clean Level 1 or Level 2 result is not evidence of Level 3, and no statement
in this repository may be upgraded across these boundaries.

---

## 2. Implemented automated baseline (retained)

The suites are described in `../testing/README.md`; this is what they cover, not
a restatement of each test.

**State and announcement semantics**

- Loading: one live region and one localized announcement per loading frame,
  however many skeleton shapes it wraps; the shapes themselves contribute no
  semantics and the wrapper changes no size.
- Error and empty states: one text-carrying live region and a heading title
  each.
- Offline/stale notice: the message carried on exactly **one** semantics node
  per notice instance, asserted by an occurrence counter that counts repeats
  *within* a merged label as well as across nodes.
- Home module states: the `resolving`, `unavailable` and `available-empty`
  distinctions are asserted separately, so a neutral in-flight state is never
  announced as an assertion about stored data.

**Interaction**

- Touch targets: primary destinations at least 48 dp, re-asserted under 200%
  text.
- Keyboard-capable bottom navigation and segmented controls: traversal, Enter,
  Space and the standard `ActivateIntent` / `ButtonActivateIntent`; pointer
  behaviour preserved; a focus ring present only while focus is.
- Reduced motion: the segmented control completing its selection change in the
  first frame under `MediaQuery.disableAnimationsOf`, with a non-vacuity guard
  proving it still animates without the flag; and reduced motion delivered to
  the live screens that own a segmented control.

**Naming and structure**

- Settings rows: label and current value composed into one focus stop.
- Loading buttons: a localized state name at every reachable loading call site.
- Screen-level semantics and reading order for **19 screen families**, read
  through `debugListChildrenInOrder(traversalOrder)` rather than a naive tree
  walk, as ordered landmarks rather than a whole-tree snapshot.
- Semantic flags: button, selected, checked-in-a-mutually-exclusive-group,
  heading, live region, informative image and decorative image.
- Identifier suppression: sentinel identifiers and URLs injected into Home,
  Calendar, Standings, Settings and the three detail screens, asserted to reach
  neither rendered text nor an accessibility label.

**Localization, scale and theme**

- English and Spanish throughout.
- 200% text across the complete `{320, 390} × {EN, ES} × {dark, light}` product
  for Home, Standings, Settings and driver detail, plus a documented pairwise
  set covering every width, locale and theme for the other fifteen families.
  Per cell: no overflow, important labels still present, primary destinations
  still at least 48 dp, content still scrollable.
- Contrast: every semantic colour pair asserted for both themes.

### 2.1 Retained counts

| Suite | Passing |
|---|---|
| `test/a11y` | **111** |
| Full suite | **1977** |
| Golden suites (five) | **71**, zero drift |

These prove the Flutter semantics and interaction layer. **They do not prove
spoken behaviour**, and no count above should be cited as evidence that a screen
reader behaves correctly.

---

## 3. Device and TalkBack evidence

One populated review, 2026-08-17.

| Aspect | Detail |
|---|---|
| Device | Dedicated `gv_phase8c2_verify` emulator, Android 16 / API 36, x86_64 |
| Isolation | Zero accounts, zero third-party packages before and after |
| Application | Staging **debug** build, application ID `com.sejuma.gridview.staging` |
| Data | Public staging API over ordinary `GET` synchronization; no administrative route, no Worker write |
| Screen reader | Real TalkBack, bound with spoken feedback |
| Coverage | Home, Calendar, Grand Prix detail, both Standings tables, all three Explore collections, the driver/team/circuit details, Settings and its seven sub-screens, bottom navigation and segmented controls |
| Locales | English and Spanish |
| Scale | Font scale 1.0 / 1.3 / 2.0; native display density and one larger display size |
| Motion | All three Android animation scales at zero |
| Human evidence | A person listened to TalkBack and reported what was spoken |
| Restoration | Every changed setting restored; settings snapshot compared identical; staging package uninstalled; AVD powered off without saving a snapshot |

The physical reference handset was **not** used for any accessibility check, and
no accessibility setting was changed on it.

Raw device identifiers, dumps, screenshots, logs and temporary scripts were kept
outside the repository and are **not** retained here. This document keeps the
conclusions, not the evidence files.

### 3.1 What the populated review established positively

Confirmed at Level 3 unless noted:

- Heading navigation works: TalkBack's heading jump reaches section headers,
  confirming the Level 1 `header: true` evidence carries through to the platform.
- Numbers read naturally in both locales, including the decimal comma in Spanish
  (`210.5 points` / `210,5 puntos`).
- The stale notice is **not** re-announced on scroll, and the loading state does
  **not** chatter.
- Roles and states are correct at Level 2: preference options are radio buttons
  with the checked state set; navigating rows are buttons; the current bottom-nav
  destination and the current segment both expose `selected`.
- Reading order matches visual order on every screen inspected.
- No identifier, slug or URL leaked into any label.
- At 1.3× and 2.0× text, and at a larger display size, every expected node
  survived with no zero-size and no off-screen geometry; content that no longer
  fits stays reachable by scrolling.
- Reduced motion does not prevent navigation or leave an intermediate state.
- State transitions behave correctly at Level 2: a first-load error offers a
  labelled recoverable retry, retry reaches populated content leaving no stale
  error node, and an offline relaunch renders cached content with exactly one
  notice on Home.

---

## 4. Known non-blocking accessibility limitations

**None of the following is fixed.** They are recorded as known product debt
under the priority decision in §5. No document may describe them as fixed,
passed or not reproduced.

Common rationale for "not a Phase 8 blocker": each affects only how a screen
reader narrates an already-correct screen. None changes what is displayed,
none affects the ordinary touchscreen flow, and none touches application
stability, data integrity, security or release configuration.

### 4.1 Selected Settings options can announce the selected state twice

- **Observed.** A selected preference option carries the state in the semantics
  flags (`checked` and `selected`) **and** as a `", Selected"` suffix composed
  into its label, so the platform's own announcement and the suffix can both be
  spoken. Affects Language, Theme and Time display, in English and Spanish
  (`", Seleccionado"`).
- **Evidence level.** Level 2 (both the flags and the suffix present on the same
  node) and **Level 3** (heard twice).
- **Why not a blocker.** The option, its name and its state are all conveyed;
  the state is simply conveyed twice.
- **Suggested correction.** The state flags already satisfy the original
  requirement that selection is never conveyed by the radio glyph alone, so the
  composed suffix is redundant. Removing it touches one shared widget, one call
  site, and the assertion in `test/settings/settings_widget_test.dart` that
  currently requires the label to contain the state word — which must be changed
  first, as a failing test.

### 4.2 Grand Prix detail can announce the same stale sentence twice

- **Observed.** The screen renders two freshness notices — one for the Grand
  Prix detail resource, one for the race-results resource. Each is structurally
  correct and carries its message on exactly one node, and the two scopes are
  deliberate because the resources synchronize independently. But when **both**
  are stale at once they render the **same** sentence, so the identical text is
  announced twice with nothing distinguishing which resource it refers to. When
  the resources *fail* rather than go stale, the copy already differs and reads
  correctly.
- **Evidence level.** Level 2 (two nodes, identical text, reproduced
  deterministically) and **Level 3** (heard twice).
- **Why not a blocker.** Both notices are true; the wording is ambiguous rather
  than wrong, and the state itself is correctly surfaced.
- **Suggested correction.** Scope the copy, so the results-section notice names
  what is stale. This is copy and localization, not structure; the two-scope
  design should be preserved. A test asserting that no two live-region notices
  on one screen carry the same string would pin it.

### 4.3 Home championship-leader cards repeat the section title

- **Observed.** The section header and the card's own composed label both emit
  the championship title, and they merge into a single node whose label states it
  twice in succession, before the driver or team name and points.
- **Evidence level.** Level 2 (doubled inside one node) and **Level 3** (heard
  twice in one announcement).
- **Why not a blocker.** All the information is present and correctly ordered.
- **Suggested correction.** Let the section header own the title and drop it from
  the card's label composition. The existing Home widget-test assertion that one
  label contains the title *and* the name *and* the points must be re-expressed
  first, as a failing test.

### 4.4 Privacy and legal announces the screen title twice consecutively

- **Observed.** The screen title and the leading text of its first content group
  are the same string, and they are announced one after the other during ordinary
  traversal.
- **Evidence level.** Level 2 (same string on two nodes) and **Level 3** (heard
  twice, consecutively).
- **Why not a blocker.** Redundant narration of a correct screen.
- **Suggested correction.** Semantics and copy only: either drop the inner
  section title, since the screen title already names the screen, or give the
  section a distinct name describing what it actually lists.

### 4.5 Focus is not restored to the originating row after back

- **Observed.** Opening a Settings sub-screen from its row and returning with
  Android back places accessibility focus at the **top of Settings** rather than
  back on the row that was opened. The screen itself restores correctly — the
  platform node list after returning is identical to before.
- **Evidence level.** Level 2 for the screen restoration; **Level 3** for the
  focus placement.
- **Why not a blocker.** Navigation and state are correct; this costs a
  screen-reader user extra traversal, and touchscreen users are unaffected.
- **Suggested correction.** Restore accessibility focus to the originating row on
  pop, for the navigation patterns where the design expects restoration.

### 4.6 Enter did not activate the focused control in one human test

- **Observed.** With a keyboard, **Space** activated the focused control and
  **Enter** did not, in a single human test. This **conflicts with the automated
  widget evidence**, which asserts that both Enter and Space activate the bottom
  navigation and the segmented control.
- **Evidence level.** **Level 3, once, not repeated.** Level 2 could not
  corroborate it: accessibility focus location is not observable through the
  tooling used, so it is not certain which control was focused at the time.
- **Why not a blocker.** Pointer activation — the ordinary interaction — works,
  and the automated coverage for both keys remains green.
- **Suggested correction.** Repeat the check once with the focused control
  visually confirmed, before treating it as settled. If it reproduces, it is a
  real platform-level divergence from the widget tests and worth investigating;
  if it does not, this entry should be closed as a mis-scoped observation.

### 4.7 Explore rows expose terse numerical copy

- **Observed.** An Explore row announces position and points as bare numbers
  joined by a separator, for example `1 · 210.5`, while the equivalent Standings
  row spells them out as `Position 1, …, 210.5 points`.
- **Evidence level.** Level 2. Not heard.
- **Why not a blocker.** The entity name and team are announced correctly; only
  the trailing statistics are terse.
- **Suggested correction.** Compose the Explore row's semantic label from the
  same spelled-out position and points helpers Standings already uses, so the two
  surfaces narrate consistently.

### 4.8 Empty-state spoken behaviour rests on automated evidence

- **Observed.** No naturally populated empty-state transition was reachable:
  staging exposes no empty collection, and manufacturing one would have required
  altering Worker data or adding a fixture, neither of which was permitted or
  appropriate.
- **Evidence level.** Level 1 only.
- **Why not a blocker.** The empty state's semantics are asserted automatically
  (one live region, one heading title), and an empty collection is a rare state.
- **Suggested correction.** Re-check when a naturally empty response exists, or
  during a dedicated accessibility-hardening pass.

### 4.9 Heading metadata is not observable at the platform level

- **Observed.** `uiautomator`'s dump format carries **no** heading attribute at
  all, so heading exposure can never be evidenced from it. This is a tooling
  limit, not a finding — an early reading that suggested headings were missing
  was a tool artifact and is corrected here.
- **Evidence level.** Heading behaviour rests on **source** (`header: true` on
  the section header, the error and empty states, the three detail screens and
  Home), **Level 1** (`test/a11y/screen_semantics_test.dart`) and the **Level 3**
  heading-navigation observation in §3.1.
- **Why not a blocker.** Headings are set and were confirmed reachable by ear.
- **Suggested correction.** None required. Any future platform-level heading
  evidence needs an accessibility service or an equivalent tool, not
  `uiautomator`.

### 4.10 Development-only catalogue semantics are inconsistent

- **Observed.** The build-environment badge announces its label and its visible
  text as a duplicate pair and is not localized, and the Developer section header
  is folded into its row's label instead of being its own node.
- **Evidence level.** Level 2.
- **Why not a blocker.** Both surfaces are development-only and are **not
  reachable in a production build**.
- **Suggested correction.** Fold into any future development-catalogue tidy-up.
  Not worth a dedicated change.

---

## 5. Deferred manual work

The following are **no longer required for Phase 8 engineering closure**. They
are retained as optional later work, not deleted:

- Repeating the entire TalkBack screen inventory after every semantics
  adjustment.
- Manual Switch Access certification.
- Exhaustive keyboard testing across every screen.
- A second human-heard validation pass for the known duplicate announcements in
  §4.
- Formal accessibility certification.

### 5.1 The product-priority decision, recorded

GridView retains a strong **automated** accessibility baseline for v1. The
semantic labels, touch-target checks, contrast checks, text-scale matrices,
reduced-motion behaviour and screen-level semantics tests all remain part of the
quality suite and must not be removed, weakened or disabled.

The populated TalkBack review did its job: it found several genuine
screen-reader polish issues that no automated test could have found. Those
issues do not affect ordinary touchscreen flows, application stability, data
integrity, security or release configuration.

Further manual screen-reader refinement is **deferred because it is not a current
product priority**, and development continues elsewhere. The findings remain
visible in §4 and may be addressed before a later major release, in a dedicated
accessibility-hardening pass, or in response to user feedback.

### 5.2 When manual accessibility testing should be reopened

- A user reports an accessibility problem.
- Navigation or semantic architecture changes materially.
- A major release is being prepared.
- Google Play's pre-launch report identifies a severe issue (§6).

---

## 6. Release interpretation

Google Play's pre-launch report may still surface accessibility warnings. They
**should be reviewed during release preparation**.

They are **not** treated as automatic engineering blockers. A pre-launch
accessibility warning is escalated when it:

- prevents a core flow from completing;
- hides content the user needs;
- creates an unusable touchscreen interaction; or
- reveals a broader functional regression.

The known findings in §4 do **not** meet that threshold: each affects narration
of a screen that is otherwise complete, correctly ordered and fully operable by
touch.

Nothing here should be read as Google Play having reviewed or approved
GridView's accessibility state, and **no accessibility certification is
claimed**.
