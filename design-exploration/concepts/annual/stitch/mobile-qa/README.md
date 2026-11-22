# Annual home-light-v1 — mobile rendering QA

<!-- primer-v2-status-notice -->
> **Historical record.** This document records an exploration that preceded Primer V2. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../../../prototypes/primer-v2/DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../../../prototypes/primer-v2/DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../../../prototypes/primer-v2/README.md#validation-output).

Source: `../home-light-v1.html`, unmodified. Captured 2026-11-07 with the same
method as Primer (`../../../primer/stitch/mobile-qa/README.md`): Chrome 157
headless via the DevTools Protocol, `mobile: true`, DPR 2, viewport-only
captures.

| File | Viewport (CSS px) | Scroll |
|---|---|---|
| `annual-home-light-v1-390x844-top.png` | 390×844 @2x | 0 |
| `annual-home-light-v1-390x844-middle.png` | 390×844 @2x | championship top − 16 (587) |
| `annual-home-light-v1-390x844-bottom.png` | 390×844 @2x | end (801) |
| `annual-home-light-v1-320x693-top.png` | 320×693 @2x | 0 |
| `annual-home-light-v1-320x693-middle.png` | 320×693 @2x | championship top − 16 (621) |
| `annual-home-light-v1-320x693-bottom.png` | 320×693 @2x | end (1024) |

| | 390×844 | 320×693 |
|---|---|---|
| Document width | 390 (no overflow) | 320 (no overflow) |
| Elements outside viewport horizontally | 0 | 0 |
| Document height | 1645 | 1717 |
| Bottom nav | fixed, 64 px, flush to bottom | same |
| Gap between Explore and nav at end of scroll | 48 px | 48 px |
| Fonts loaded | Schibsted Grotesk, Atkinson Hyperlegible Next, Material Symbols | same |
