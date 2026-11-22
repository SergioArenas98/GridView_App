# Primer V2 — refinement 01 (Home)

<!-- primer-v2-status-notice -->
> **Historical record.** This document describes an early per-screen prototype that the approved Dark and Light references replaced. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../README.md#validation-output).

Focused refinement of the approved Primer V2 baseline (`../index.html`,
`../styles.css`, unchanged; baseline validation folders untouched).

- `index.html` — English · `index.es.html` — Spanish
- `styles.css` — refined stylesheet (started as a copy of the baseline)
- `nav-inset.js` — presentation-only script: adaptive navigation fit and
  bottom inset (what Flutter's layout and Scaffold do natively)
- `validation-20261107-215432-final2/` — **current** screenshots, metrics, touch targets
- `validation-20261107-215035-final/`, `validation-20261107-214614-pass1/` — earlier passes (kept)

## Before / after (390×844, English unless noted)

| | Baseline | Refinement 01 |
|---|---|---|
| Featured GP height | 300px | 255px (−15%); ES 263px (−12%); 320: 353 → 314px (−11%) |
| Round | "23" with "Round" under it, 92px | "Round" above "23", so it reads "Round 23" / "Ronda 23" in both languages; 84px |
| Relative start | 26px, two lines | 22px, one line in EN (wraps naturally in ES) |
| Championship height | 361px | 301px (−17%); 320: 442 → 398px |
| Driver name beside points | wrapped "Lando / Norris" | one line (points 68 → 60px, tighter seam) |
| Latest-result watermark | crossed the event and circuit lines | moved to lower right, behind the winner block's empty side; 170px max |
| Explore separators | slanted 12° (decorative) | straight hairlines |
| Navigation at large text | labels capped at ~130% | uncapped; regular → condensed → 2 × 2 grid |
| Settings button name | "Settings" | app string "Open settings" / "Abrir ajustes" |
| Document height | 1720px | 1617px |

Unchanged: palette, Archivo, sessions band, Chalk band, result composition,
upcoming row, status vocabulary, contrast pairs.

## 12° motif review

| Use | Verdict |
|---|---|
| Hero round block | Kept — the identity anchor; marks the featured event |
| Championship seam | Kept — divides the value (points) from its holder |
| Winner tag | Kept — flags the single key fact of the result |
| Selected tab slab | Kept — the selection indicator, with bold label and `aria-current` |
| Explore separators | Straightened — they only repeated the motif for consistency |

## Adaptive navigation

`nav-inset.js` tries each layout in order and keeps the first one where
every label fits. No truncation; labels always follow the text size.

| Mode | Layout | When it was chosen in testing |
|---|---|---|
| regular | 4 columns, icon above label (baseline identity) | EN 390, EN 320, ES 390 |
| condensed | same, labels on Archivo wdth 72 | ES 320 ("Clasificaciones"), EN 390 @200% |
| stacked | 2 × 2 grid, icon above label, hyphenation allowed | EN/ES 320 @200%, ES 390 @200% |

Selected state = oxide slab + Chalk bold label + `aria-current="page"` in
every mode. Tabs measure 78–191 × 61–74px. The main content reserves the
nav's measured height plus 24px.

## Localization

All UI strings come from `lib/l10n/app_en.arb` / `app_es.arb`:
Temporada 2026 · Comprobado: 4:22 · Próximo Gran Premio · Empieza en 2 días ·
Estado desconocido · Ronda 23 · Ver Gran Premio · Sesiones del fin de semana ·
Próxima sesión · Tu zona horaria: GMT · Líder del Campeonato de Pilotos /
Constructores · Ver clasificación de pilotos / constructores · pts · Último
resultado · Definitivo · Ganador · Ronda 22 · Próximos eventos · No hay
próximos eventos · Ver calendario · Explorar · Pilotos · Equipos · Circuitos ·
Inicio · Calendario · Clasificaciones · Actualizar Inicio · Abrir ajustes.

API-delivered values stay as delivered in both languages: Abu Dhabi Grand
Prix, Yas Marina Circuit, Qatar Grand Prix, Lusail International Circuit,
Lando Norris, McLaren, and the session name "Race" (S01: a supplied name
wins over the localized type).

Date: Spanish uses the app's real formatter: `DateFormat.E` + `DateFormat.MMMd`
(es) gives **"lun 9 nov"**, and `Hm` gives "17:00", verified against the intl
0.20.2 locale data. English keeps the frozen dataset string "Monday,
November 9, 2026". **Discrepancy to resolve:** the same formatter in English
would produce "Mon Nov 9", so either the dataset transcription or the
deployed build differs from current code.

## Validation (Chrome 157 headless, DevTools Protocol, DPR 2; 200% = root font size)

| Run | Width | Overflow | Small text | Content → nav | Nav |
|---|---|---|---|---|---|
| EN 390×844 | 390 | 0 | 0 | 752 → 776 | regular |
| EN 320×693 | 320 | 0 | 0 | 601 → 625 | regular |
| EN 390 @200% | 390 | 0 | 0 | 739 → 763 | condensed |
| EN 320 @200% | 320 | 0 | 0 | 514 → 538 | stacked |
| ES 390×844 | 390 | 0 | 0 | 752 → 776 | regular |
| ES 320×693 | 320 | 0 | 0 | 601 → 625 | condensed |
| ES 390 @200% | 390 | 0 | 0 | 665 → 689 | stacked |
| ES 320 @200% | 320 | 0 | 0 | 514 → 538 | stacked |

- Touch targets at 320 (EN and ES): all ≥48×48 (`*-touch-targets-320.txt`).
- Text-overflow flags left after review: the Winner/Ganador tag (the skewed
  shape behind it extends its scroll box; text not clipped) and "Next session"
  / "Próxima sesión" at 320 (deliberately set on one line; it runs into the empty
  space beside the status chip and does not overlap it).
- Contrast pairs unchanged from baseline (lowest 4.6:1).
- Pass 1 found "Estado desconocido" clipped at 320 @200%; chips now wrap.
- Impeccable: the end-of-session hook flagged `cramped-padding` on both pages.
  The detector (`impeccable detect --json`, cached engine) located it on the
  Upcoming row: the link sat flush against the top rule. The row's top padding
  went from 2px to 8px (the empty text from 12px to 6px vertical padding).
  The detector now returns no findings for `index.html`, `index.es.html` and
  `styles.css`; validation re-run in `validation-20261107-215432-final2/`
  with identical results.

## Tradeoffs and remaining issues

- **Stacked navigation is tall.** At 200% text the 2 × 2 nav takes about 155px
  (22% of a 693px screen; 18% of 844px). It is the price of uncapped, untruncated
  labels. Alternatives (selected-only labels, a navigation drawer) would hide
  destination names, so they were not used.
- The hero switches to its top-strip layout when the panel is narrower than
  21em (all 320 runs, any phone under ~368dp, and large text).
- Date-format discrepancy above (dataset vs formatter).
- Spanish 320: the upcoming row wraps to two lines ("No hay próximos eventos"
  above "Ver calendario"), which is acceptable but less compact.
- The watermark still touches the end of the winner's name and the link arrow at
  11% opacity; this is decorative and needs checking on a device.
- Conditional states, light theme and device testing remain out of scope.

## Information preserved

Every confirmed value from `shared-reference-data.md` is present in both
languages (H01–H06, H10, H13, H15–H18, H20–H21, H23–H25, H28–H29, H35–H38,
H41–H42, Explore shortcuts, four destinations, Refresh and Settings actions).
Nothing was added, removed or invented. The only English text changes are
the Settings button's accessible name (now the app string) and the removal
of two invented accessible labels ("Event status", "Primary").
