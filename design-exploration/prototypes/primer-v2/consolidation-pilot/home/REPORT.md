# Home: consolidation pilot report

**Status: technical experiment, 2026-11-10 (Step 46).** No decision is made
or changed here. The approved Home is `../../refinement-01/` (provisionally
approved, `../../DESIGN-DECISIONS.md`), **not** the earlier baseline
`../../index.html` / `../../styles.css`. It is unmodified. First-pass summary:
[`../CONSOLIDATION-SUMMARY.md`](../CONSOLIDATION-SUMMARY.md).

**Result:** the pilot is pixel-identical to the approved Home, and so is the
control:

- 29 runs and 210 screenshot pairs, with 0 differing pixels;
- 0 DOM, style, box, metric or accessibility-tree differences;
- 52 / 52 checks true in both versions.

## Scope

- **Pages:** `index.html` (English) and `index.es.html` (Spanish). These two
  hand-written pages are the whole approved Home.
- **One rendered state per language:** the frozen staging scenario. It shows:
  - the next Grand Prix, with its status unknown;
  - one focused session;
  - both championship leaders;
  - a final latest result;
  - the known-empty upcoming row;
  - the Explore shortcuts.
- **No other states exist:** Home has no URL parameters and no state script.
  Its conditional states (tied or unavailable leaders, stale, partial and
  failed notices, refreshing, missing times) were never rendered (HOME-04).
  None was invented here, and no fixture from another prototype was used.

## How the pilot is built

- **`build.py` copies the approved pages read-only.** Home has no generator,
  so the script copies both pages and swaps one block: the `styles.css` and
  `nav-inset.js` references become the shared files plus `home.css`. It
  never writes to `refinement-01/`.
- **`python build.py --check` verifies:**
  - both pages equal the approved markup plus that swap;
  - `shared/nav-inset.js` is byte-identical to `refinement-01/nav-inset.js`;
  - the CSS split adds up (below).
- **`home.css`** is `refinement-01/styles.css` with its 49 core rules
  removed. The 68 Home rules keep their order, text and comments, under a
  pilot header.
- **Unchanged:** copy, data, markup, hierarchy, the Archivo link, the page
  title, every `href` and every ARIA attribute.

## 1. Shared rules reused

Comparing normalised rules (comments and whitespace removed):

- the approved stylesheet has 117 rules;
- 49 of them equal the shared files rule for rule, and none is missing;
- the shared files add exactly one rule, the `[hidden]` guard. Home has no
  `hidden` attribute and no script sets one, so it has no effect here.

| Shared file | Home rules it now provides |
|---|---|
| `tokens.css` | `:root`: palette, cut, gutter, radii, `--nav-min`, font |
| `base.css` | reset, body type, element defaults, selection, `:focus-visible` ring, `.sprite`, `.sr-only`, `.num`, `.icon`, `.icon--sm`, reduced motion |
| `components/app-bar.css` | `.appbar`, brand, wordmark, season, actions, `.icon-btn` with hover / active, freshness |
| `components/section-title.css` | `.section-title` (20px `h2`) |
| `components/chip.css` | the chip vocabulary (`--unknown` dashed, `--final` Chalk, plus three accommodated variants) |
| `components/tag.css` | the 12° Winner tag |
| `components/text-link.css` | `.text-link`, `--ember` |
| `components/nav.css` | bottom navigation, selected 12° slab, adaptive modes |
| `nav-inset.js` | nav fit mode and `--nav-space` |

Load order follows `../../shared/README.md`: tokens, base, app bar, section
title, chips, tag, text link, navigation, then `home.css`.

**Not used, because Home has no such element:**
- `notice.css`: no notice is rendered;
- `selector.css`, `empty-state*.css`;
- `detail-app-bar.css`, `detail-page.css`.

## 2. Cascade and specificity

In the approved stylesheet, core and Home rules are interleaved. For
example, the chips sit between `.home` and the hero, and the tag and text
link sit inside the result section. Loading every shared rule first moves
some Home rules after core rules they used to precede. That changes nothing,
because no moved Home rule sets the same property, on the same element, at
equal specificity, as a core rule:

- **`.session__status` on a `.chip`:** sets only `grid-area`,
  `justify-self`, `align-self` and, in its container query, `margin-top`.
  `.chip` sets none of them.
- **`.session__time .num` and `.leader__points .num`:** set the type;
  `.num` sets only `font-variant-numeric`.
- **`.explore__strip .icon`:** sets `color`, which `.icon` does not set.
- **Focus overrides:** `.hero__action:focus-visible`, `.champ :focus-visible`
  and `.hero:has(…)` already outrank the base `:focus-visible` (0,1,0) by
  specificity.
- **Reduced motion:** its `transition: none` is `!important`, so it wins
  over the hero, leader and text-link transitions whatever the order.
- **No Home rule targets** `.tag`, `.text-link`, `.section-title`, `.tabbar`
  or `.tab`.

The comparison confirms it: the computed style, including `::before` /
`::after`, of every element is identical in every run.

## 3. Home-specific rules retained (`home.css`, 68 rules)

| Area | What stays local |
|---|---|
| Page rhythm | `.home`: 16px top, the 32px section gap, bottom space of `--nav-space` + 24px |
| Featured Grand Prix | the Graphite hero panel: radial and linear gradients, the shadow and its depth plane; a stretched link with an outline drawn by `:has()`; the Red Oxide round block cut at 12° (`skewX(var(--cut))`) with "Round" above "23"; the editorial type: 84px round, 30px name, 22px Ember countdown; the top-strip container query under 21em |
| Weekend sessions | the full-bleed tray band; the session grid with the 44px time; the Ember "Next session"; the time-zone rule; the single-column container query |
| Championship | the Chalk band, the 60px points, the 12° oxide seam, the `on-chalk` selection, the oxide focus ring on Chalk |
| Latest result | the open composition; the "22" watermark plane (outline only, `aria-hidden`); event and driver type |
| Upcoming | the known-empty row with its rule |
| Explore | the segmented strip, its straight seams, and the list form at large text |

**Not extracted:** none of these compositions has a second consumer.
- The hero, Chalk band and watermark are compositions by design
  (DESIGN-SYSTEM-CONSOLIDATION §4).
- Calendar's next-event block and the Driver plate use the 12° motif with
  other rules (XS-27).
- No generic card or hero component was created, and the unified title
  policy was not applied.

## 4. Regression results

Evidence: `validation-20261110-111848-regression/` (`sw-pilot`,
`sw-control`). Conditions: Chrome 157.0.8103.39, software raster, DPR 2,
mobile emulation with touch. Coverage: EN and ES; 390×844 and 320×693; 100%
and 200% text.

| Version | Runs | Screenshot pairs | Differing pixels | DOM / style / box / metric diffs | A11y-tree diffs | Checks true in both versions | Scroll coverage complete |
|---|---|---|---|---|---|---|---|
| Pilot vs baseline | 29 | 210 | **0** | 0 | 0 | 52 / 52 | 11 / 11 |
| Control (baseline vs baseline) | 29 | 210 | 0 | 0 | 0 | 52 / 52 | 11 / 11 |

**Runs:**
- **Scroll captures (11):** 8 static pages, plus 3 with reduced motion.
- **Keyboard walks (8):** every size, in both languages.
- **Forced pointer states (4):** 17 states at 390 / 100% and 4 at 320 / 200%,
  per language.
- **Navigation (2):** every hash route, Enter on a tab and on the hero link.
- **Data (4).**

**Compared:** pixels, text, computed styles, boxes, accessibility trees,
keyboard order, resolved link targets, touch targets and the quality metrics.

**Layout switches, identical in both versions:**

| Run | Navigation | Hero | Sessions | Explore | Document |
|---|---|---|---|---|---|
| EN 390 | regular | side block, 255px | two columns | 3 columns | 1617px |
| EN 390 @200% | condensed | top strip | one column | list | 2858px |
| EN 320 | regular | top strip | two columns | 3 columns | 1773px |
| EN 320 @200% | stacked, 155px | top strip | one column | list | 3222px |
| ES 390 | regular | side block, 263px | two columns | 3 columns | 1625px |
| ES 390 @200% | stacked | top strip | one column | list | 2968px |
| ES 320 | condensed | top strip | two columns | 3 columns | 1829px |
| ES 320 @200% | stacked | top strip | one column | list | 3461px |

These match the approved README's navigation table. The longest page,
ES 320 at 200%, was captured in 6 viewport steps to its end.

**Quality, in every run and in both versions:**
- no horizontal scroll;
- no element outside the viewport;
- no clipped text, and no text under 12.5px;
- no target under 48×48;
- no word broken across lines.

Four "spill" flags are the ones the approved README already accepts:
- the Winner / Ganador tag (its skewed slab widens its box);
- "Next session" / "Próxima sesión" at 320 (set on one line on purpose).

**The 1.00 contrast reading is a measuring artefact.** It comes from the
"22" watermark, which has a transparent fill and only an 11% outline, so
the tool reads its text colour as equal to the background. It is decorative
and `aria-hidden` (HOME-05). The README's lowest real text pair (4.6:1) was
not re-measured here.

**Recheck after a whitespace fix (Step 47A).** The extra blank line at the
end of `home.css` was removed before the checkpoint. That cannot change how
CSS parses, and `build.py --check` still passes. Both versions were run
again anyway, without screenshots, in
`validation-20261110-114914-recheck/`: 29 runs, 210 pairs, 0 differing
pixels, 0 other diffs, 52 / 52 checks; the control is also 0. The first
evidence folder is unchanged.

## 5. Content and data

The checks read every UI string from `lib/l10n/app_*.arb`, never retyped.
They hold in both versions, in EN and ES, at 390×844 / 100% and
320×693 / 200%:

- **App bar:**
  - the wordmark;
  - "2026 season" (`seasonLabel`);
  - "Last successful check: 4:22" (`homeUpdated`);
  - the buttons "Refresh Home" and "Open settings".
- **Hero:**
  - "Next Grand Prix", which also labels the section;
  - "Starts in 2 days" (the plural);
  - the round reads `roundLabel` 23 ("Round 23" / "Ronda 23");
  - "View Grand Prix" → `#grand-prix`.
- **Unknown stays unknown:** exactly one event chip, `chip chip--unknown`
  with "Status unknown". The session chip is also unknown.
- **API names stay as delivered:** Abu Dhabi Grand Prix, Yas Marina
  Circuit and Qatar Grand Prix, in both languages.
- **Sessions:**
  - one focused session, "Next session" (`homeNextSession`; HOME-02 open);
  - it links to `#grand-prix`;
  - the time-zone line starts with `fieldDeviceTimeZone`.
- **Leaders:**
  - the two titles;
  - the drivers' and constructors' standings links;
  - the teams' leader has no team line.
- **Latest result:**
  - "Final" is the Chalk `chip--final`;
  - the Winner tag;
  - "Round 22 · …";
  - the watermark "22" is `aria-hidden`;
  - "View Grand Prix" → `#grand-prix-qatar`.
- **Upcoming:** known-empty, with no list items and "No upcoming events",
  plus "View Calendar" → `#calendar`.
- **Explore:** Drivers, Teams and Circuits → `#drivers`, `#teams`,
  `#circuits`.
- **Navigation:** only Home carries `aria-current="page"` and the selected
  class.
- **No notice or live region is rendered:** the approved page has none.

The fixture values themselves (dates, times, points, names) are proven
unchanged by the per-element text comparison.
- **Dates:** the English date stays the frozen dataset string, and the
  Spanish date stays "lun 9 nov" (HOME-01 open).

## 6. Keyboard, pointer and accessibility

- **Keyboard order (EN, every size):** 15 stops, all named, in both
  versions:
  1. button "Refresh Home"
  2. button "Open settings"
  3. "View Grand Prix"
  4. the session row
  5. "View drivers' standings"
  6. "View constructors' standings"
  7. "View Grand Prix"
  8. "View Calendar"
  9. "Drivers"
  10. "Teams"
  11. "Circuits"
  12. "Home"
  13. "Calendar"
  14. "Standings"
  15. "Explore"

  Spanish matches. **No unnamed control.**
- **Focus treatment:**
  - the hero draws its Ember outline on the whole panel (`:has()`);
  - on the Chalk band the ring turns oxide;
  - both are captured and identical.
- **Activation:**
  - all 13 hash links open their own route, and none leaves the page;
  - Enter on the Calendar tab opens `#calendar`;
  - Enter on the hero link opens `#grand-prix`.
- **Pointer states** (forced `:hover` / `:active`), all identical:
  - icon buttons;
  - the hero arrow shift;
  - the session underline;
  - leader and text-link arrows;
  - the Explore cell fill;
  - selected and unselected tabs.
- **Reduced motion:** identical, with transitions at 0s.
- **Baseline observations (both versions, not regressions):** two links
  are named "View Grand Prix" / "Ver Gran Premio" but open different events,
  and the session link's name is its whole row. Both were added to XS-02
  (screen-reader testing). An identical accessibility tree does not show
  that Home is accessible. TalkBack, D-pad and Android font scaling remain
  required (XS-02, XS-05, XS-16).

## 7. Font loading and rendering

- **Same font conditions:** both versions load the same Google Fonts
  Archivo stylesheet (variable `wdth` 62–125, `wght` 100–900). Each run waits
  for `document.fonts.ready`.
- **Font faces:** both versions report the same three loaded faces and
  Archivo available in every run.
- **Rendering noise:** none observed. The control is 0 in every run, so
  there was nothing to separate from CSS effects.
- **Not changed:** no font file was added or changed, and no typography was
  adjusted. Bundling the font for offline use remains part of Flutter
  planning.

## 8. Open items, unchanged by this pilot

- HOME-01: English date format;
- HOME-02: "Next session" on a past fallback session;
- HOME-03: session destination;
- HOME-04: conditional states not rendered;
- HOME-05: watermark touch;
- HOME-06: hero strip on devices;
- HOME-07: Spanish 320 upcoming row;
- XS-07: the wordmark bar has the same latent title limit;
- XS-08, XS-01, XS-05, XS-16, XS-21, XS-27, XS-28.

## Reproduce

```sh
cd consolidation-pilot/home && python build.py --check && python build.py
cd ../tools
node visual-compare.mjs home.config.mjs --out ../home/validation-<stamp>-regression/sw-pilot
node visual-compare.mjs home.config.mjs --control --shots none --out ../home/validation-<stamp>-regression/sw-control
```
