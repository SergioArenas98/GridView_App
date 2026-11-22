# Primer Visual Lab — reference analysis

References: `../../references/01–05` (user-supplied Pinterest images; study
material only, no assets reused). Functional truth stays with
`../../GridView_Pre_Redesign_UI_UX_Audit.md` and `../../shared-reference-data.md`.

## What makes each reference work

| # | Distinctive principle | Why it works | GridView adaptation |
|---|---|---|---|
| 01 Sports progress | **One hero figure owns the screen.** "48 / min trained" in a tall condensed face, staged against a circular backdrop; a large plain title above. Saturated colour blocks (red, blue, orange) each code one category. Floating pill navigation with a filled circle for the active item. | Scale contrast is extreme (≈90px figure vs 12px labels), so the hierarchy reads instantly; colour encodes meaning instead of decorating. | The *subject* of Home is typographic: round number, countdown or session time staged like a hero object. Colour blocks only where they encode a real state or section. Floating nav with a strong active marker. |
| 02 Motorcycle marketplace | **Restraint around a single focal object.** Navy/charcoal ground, ambient glow behind the hero, one warm orange for the primary action only. | Low-chroma surfaces make one accent feel premium and make the call to action unambiguous. | Graphite/slate ground with a soft glow behind the hero; Primer's ember used only for focus and the primary action. |
| 03 Motorsport data | **Data rendered as instruments.** Times inside outlined capsules, ring gauges, labelled readouts, track-line graphics, blue-slate panels with soft depth, coral nav bar. | Numbers feel measured and technical; outlines give hierarchy without heavy fills. | Session time and points in capsule/ring readouts. Line graphics only as abstract motifs, **never a real circuit map** (no circuit geometry exists in the data). |
| 04 Racing editorial | **Typography as image.** Giant tight-leading display type, monospaced/technical faces, words breaking past the margin, the slash as a graphic device, small label/value pairs in strict columns, a checkered micro-motif, one red dot. | Asymmetry and scale make a text-only layout feel designed; the grid of tiny labels keeps it legible. | Grand Prix name and round as display type; label/value column pairs for facts; slash/sequence devices for rounds (22 → 23). Must stay an app, not a poster. |
| 05 Athlete detail | **Layered depth.** A huge faint watermark behind the subject, the subject breaking out of the frame, stat tiles with the label top-left and the figure bottom-right, blue-black gradient. | Three planes (watermark, subject, data) give depth with no photography needed in the watermark plane. | Oversized faint numeral (e.g. "23") as a watermark plane behind the hero; championship points as label-top / figure-bottom tiles. |

## Shared lessons

- Distinctiveness comes from **scale contrast and one owned move**, not from more
  components. Every reference has one element that is 5–8× larger than body text.
- Accent colour is **semantic** (category, action, focus), never ambient.
- Depth is **planar** (watermark → subject → data), not shadows everywhere.
- Navigation is treated as a designed object, not a default bar.
- Usability survives because the small type is disciplined: consistent label
  style, clear grouping, generous touch targets.

## Risks to avoid when adapting

- Photography is load-bearing in 01, 02, 05; GridView has none (H14 absent), so
  the hero must be typographic or graphic.
- 04 is a portfolio/poster concept; copied literally it becomes a magazine mockup.
- Colour-coded blocks (01) could read as team colours, which are unconfirmed (H27).
- Track drawings (03) would imply circuit data GridView does not have.

## Mapping to the two explorations

- **A — Primer Evolution (01, 02, 03):** dark graphite/slate depth, ember accent,
  instrument readouts, typographic hero with glow, floating nav.
- **B — Primer Racing Editorial (01, 04, 05):** display-type-led composition,
  asymmetric scale, watermark numerals, label/value columns, slash and sequence
  devices, bold rhythm.
