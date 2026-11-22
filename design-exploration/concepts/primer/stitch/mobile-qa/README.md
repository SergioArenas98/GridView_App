# Primer home-dark-v1 — mobile rendering QA

<!-- primer-v2-status-notice -->
> **Historical record.** This document records an exploration that preceded Primer V2. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../../../prototypes/primer-v2/DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../../../prototypes/primer-v2/DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../../../prototypes/primer-v2/README.md#validation-output).

Source: `../home-dark-v1.html`, unmodified. Captured 2026-11-07.

## Method

Google Chrome 157 (already installed), headless, driven through the Chrome
DevTools Protocol from Node 24's built-in WebSocket (no new dependencies).
`Emulation.setDeviceMetricsOverride` with `mobile: true`, device pixel ratio 2;
the page opened directly by file URL; Tailwind CDN and Google Fonts loaded over
the network; scrolled with `window.scrollTo`; captured with
`Page.captureScreenshot` (viewport only).

| File | Viewport (CSS px) | Scroll position |
|---|---|---|
| `primer-home-dark-v1-390x844-top.png` | 390×844 @2x | 0 |
| `primer-home-dark-v1-390x844-middle.png` | 390×844 @2x | leader band top − 16 (641) |
| `primer-home-dark-v1-390x844-bottom.png` | 390×844 @2x | end (758) |
| `primer-home-dark-v1-320x693-top.png` | 320×693 @2x | 0 |
| `primer-home-dark-v1-320x693-middle.png` | 320×693 @2x | leader band top − 16 (650) |
| `primer-home-dark-v1-320x693-bottom.png` | 320×693 @2x | end (952) |

## Measurements

| | 390×844 | 320×693 |
|---|---|---|
| Document width (scrollWidth) | 390 (no overflow) | 320 (no overflow) |
| Elements outside viewport horizontally | 0 | 0 |
| Document height | 1602 | 1645 |
| Bottom nav | `position: fixed`, 65 px, flush to viewport bottom | same |
| Gap between Explore and nav at end of scroll | 71 px | 71 px |
| Archivo loaded | yes | yes |
