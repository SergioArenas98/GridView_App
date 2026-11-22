# Exploration B — Primer Racing Editorial — home-dark-v1 (NOT DELIVERED)

<!-- primer-v2-status-notice -->
> **Historical record.** This document records an exploration that preceded Primer V2. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../../prototypes/primer-v2/DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../../prototypes/primer-v2/DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../../prototypes/primer-v2/README.md#validation-output).

- Stitch project: "GridView - Primer Visual Lab" — `projects/12213569932890775637`
- One `generate_screen_from_text` call (MOBILE, GEMINI_3_8_FLASH, `designSystem`
  empty) was sent on 2026-11-07. It timed out client-side and was **not resent**.
- Stitch did create an automatic design system for it:
  `assets/b004b1f469154bae9a351c91bdb02f11` "Primer Racing Editorial" —
  Space Grotesk (headline), Hanken Grotesk (body), JetBrains Mono (label),
  primary #FF3B30, tertiary #E10600, neutral #12141A, 4px roundness, dark.
  Its prose again describes telemetry, sector deltas and live positions.
- **No screen appeared** in `list_screens` after ~38 minutes of polling
  (polls at roughly 2, 5, 9, 14, 20, 30 and 38 minutes). No HTML or screenshot
  exists, so no mobile QA was possible.
- References: 01, 04, 05 (see `../reference-analysis.md`).

## Prompt (verbatim intent, concise)

Separate direction from earlier screens. Art direction "Primer Racing
Editorial": typography is the image; bold condensed/technical display face set
huge with tight leading; confident asymmetry and deliberate jumps in scale;
depth in planes (oversized faint watermark numerals such as the round number,
content in front, small label/value grid); slash and 22 / 23 sequence as
graphic devices; near-black ground, one hot racing red/ember used sparingly,
off-white; each section composed differently like spreads in a race programme,
yet a usable app, not a magazine or landing page; designed navigation with bold
selected state. Same information priority and the same frozen content block as
Exploration A; points are the star numbers; long names wrap, never truncate.
