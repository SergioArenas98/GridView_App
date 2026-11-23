# home-light-v1 — generation record

<!-- primer-v2-status-notice -->
> **Historical record.** This document records an exploration that preceded Primer V2. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../../prototypes/primer-v2/DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../../prototypes/primer-v2/DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../../prototypes/primer-v2/README.md#validation-output).

- Stitch project: "GridView - Timetable (Design Exploration)" — `projects/10039175628687157556`
- Design system: "GridView — Timetable" — `assets/7014041323d44f7298c7d96b18e46361`
  (from `../DESIGN.md`, 4,414 bytes, via `upload_design_md` →
  `create_design_system_from_design_md`; upload screen `10765688726888577073`)
- Screen: "GridView — Home Screen" — `projects/10039175628687157556/screens/d1882b2abb534f27a3579d3d18545ae1`
- Device MOBILE, light, model GEMINI_3_8_FLASH, 780×2936 px (390×1468 CSS px, 2×)
- Generated 2026-11-07. The MCP call timed out client-side; the screen appeared
  about 12 minutes later (found by polling `list_screens`). Stitch's text
  description and suggestions were therefore not returned.
- Fonts actually loaded by the HTML: **Overpass** (400–900) and **Overpass Mono**
  (400–700) from Google Fonts; icons: Material Symbols Outlined. No substitutes
  used.
- Data: `../../../shared-reference-data.md` (frozen staging screenshots).
- Files: `home-light-v1.png` (from the project's public thumbnail URL, full
  size), `home-light-v1.html` (via `download_file`).

## Prompt (structure and content only; no colour or type tokens)

Home screen of GridView, an independent Formula 1 season companion app for
Android phones. Complete scrollable Home as one tall screen; light theme; use
the project design system. Strict content rule: only the listed text; no
invented data, photos, logos, flags, team colours; no railway/transit wording.
Sections: 1 header sign (GridView, 2026 season, refresh, settings) + "Last
successful check: 4:22"; 2 now-board (outlined "Next Grand Prix", largest "Starts
in 2 days", "Round 23", "Abu Dhabi Grand Prix", "Yas Marina Circuit", dashed
"Status unknown"); 3 weekend sessions on a left-gutter route line with one dashed
node + amber focus marker ("Next session", "Race", dashed "Status unknown",
"Monday, November 9, 2026", "17:00 GMT" monospaced right) and "Your time zone:
GMT"; 4 two leader signs (Lando Norris · McLaren · 120 pts · "View drivers'
standings" | McLaren · 150 pts · "View constructors' standings"); 5 latest result
("Round 22", "Qatar Grand Prix", "Lusail International Circuit", filled "Final",
Winner Lando Norris McLaren, "View Grand Prix"); 6 upcoming events known-empty
"No upcoming events" + "View Calendar"; 7 Explore rows Drivers / Teams /
Circuits; 8 bottom strip of four square plates (Home selected with amber top
edge, Calendar, Standings, Explore). 2px rules, no rounded cards or shadows,
statuses in words, 48px targets.
