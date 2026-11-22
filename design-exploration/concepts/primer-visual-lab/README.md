# Primer Visual Lab

Reference-driven, low-prescription experiment (2026-11-07). Stitch project
"GridView - Primer Visual Lab" — `projects/12213569932890775637`. Original
Primer artifacts in `../primer/` are untouched; no other Stitch project was
modified.

## Workflow

- No DESIGN.md uploaded. `generate_screen_from_text` with `designSystem` empty
  makes Stitch generate its own design system from the prompt. One automatic
  system per exploration was created.
- Prompts: art direction, information priority, the exact frozen dataset,
  three state/usability sentences. No layout, radius or spacing values.
- Analysis of the five references: `reference-analysis.md`.

## Status

| Exploration | Screen | Files |
|---|---|---|
| A — Primer Evolution (refs 01, 02, 03) | `2dff0ba2faa746db8d62f5f586b88ca3` | `exploration-a/` (PNG, HTML, meta, mobile-qa) |
| B — Primer Racing Editorial (refs 01, 04, 05) | **not delivered** (design system created, no screen after ~38 min) | `exploration-b/home-dark-v1.meta.md` |

Unrequested side effect: screen `b906903234f94d2e95f4f28f26113072` (390×884,
no screenshot) appeared alongside A. Left untouched.

## Exploration A vs original Primer (first read)

| | Original Primer (`../primer/stitch/home-dark-v1`) | Exploration A |
|---|---|---|
| Personality | Owned move: 12° livery cut, huge "23", Red Oxide field | Competent but generic dark "telemetry dashboard"; no owned move |
| Typography | Archivo wide/condensed, big numerals carry the hero | Space Grotesk + JetBrains Mono + Inter; hero is "Starts in 2 days" at 32px; mono uppercase labels at 9–10px |
| Colour | Graphite + Red Oxide surfaces + Chalk band; oxide used as a field | Near-black + one coral #FF5745 button and dots; off-palette emerald "Final" |
| Hierarchy | Strong first viewport, weaker lower half | Even, card-after-card; championship points are the only large figures |
| Originality | Distinct | Closest of all concepts to the default AI sports dashboard |
| Mobile usability | Good sizes; 320px crowding | No overflow, nav clear by 40px; 32 text elements under 12px |
| Consistency | Lower half drifts | Very consistent — because every section is the same bordered card |
| Data fidelity | Exact (one "23 Round" ordering issue) | Five invented items: "T-48:00:00", "STG_R23 // LIVE_FEED", "UTC+04:00", "Session 5 of 5", "Post-R22" |

Design-hook findings on A's raw HTML (left standing, artifact unchanged):
`flat-type-hierarchy`, `nested-cards` (countdown readout inside the hero card).
