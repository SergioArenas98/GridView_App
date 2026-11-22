# home-dark-v1 — generation record

<!-- primer-v2-status-notice -->
> **Historical record.** This document records an exploration that preceded Primer V2. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../../prototypes/primer-v2/DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../../prototypes/primer-v2/DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../../prototypes/primer-v2/README.md#validation-output).

- Stitch project: "GridView - Primer (Design Exploration)" — `projects/13910713182584603656`
- Design system used: `assets/5f4a391d473348398a1849089073d18f` (display name
  "GridView"), from `../DESIGN.md` (4,886 bytes) via `upload_design_md`
  (screen `16835026254723335810`) → `create_design_system_from_design_md`.
- Superseded, unused design system in the same project:
  `assets/fc5d59965a4943759411fcc0637eae3e` (first upload, screen
  `14461196404292104316`). Stitch failed to parse its front matter (likely
  `fontVariation`, 8-digit hex or integer line height) and replaced the prose
  with generated "telemetry"/"paddock dashboard" text. Not deletable via MCP.
- Screen: "GridView Home Screen" — `projects/13910713182584603656/screens/6e26ba03f7414bce91e717568bfd9163`
- Requested MOBILE, dark, GEMINI_3_8_FLASH. Stitch returned deviceType
  **DESKTOP**, canvas 2560×3180 px; the layout is a 430 CSS px mobile column
  centred on the desktop canvas. Completed in one call (no timeout).
- Fonts loaded by the HTML: **Archivo** variable (wdth 62–125, wght 100–900)
  from Google Fonts; numerals use `font-variation-settings: 'wdth' 125`
  (times 112) and `tnum`. Icons: inline SVG (no icon font).
- Colours in the HTML: #141518 ground, #1F2125 tray, #2A2D32 raised, #ECEAE5
  text/Chalk, #A9ABB1 secondary, #A03E2B Red Oxide, #7A2E21 oxide-deep, #F08A6C
  Ember, #4F525A on-Chalk secondary, plus off-token #1B1D21 for the graphite
  field of the livery panel. No teal or other extra accents.
- Data: `../../../shared-reference-data.md`.
- Files: `home-dark-v1.png` (project public thumbnail URL, full size),
  `home-dark-v1.html` (via `download_file`).

## Stitch's own description (verbatim summary)

Masthead with wordmark, "2026 season", circular Refresh/Settings, "Last
successful check: 4:22"; livery panel with graphite and Red Oxide fields split
by the 12° seam, Chalk text, "23 Round", "Starts in 2 days", Abu Dhabi Grand
Prix, Yas Marina Circuit, dashed "Status unknown"; gunmetal schedule tray with
Ember "Next session", 17:00 GMT, Race, dashed status, time-zone caption; Chalk
leader band divided by the 12° seam; latest-result ribbon with Ember "22
Round", Final check chip, winner, View Grand Prix; upcoming empty state with
calendar icon and View Calendar; three Explore buttons; gunmetal bottom bar
with active Red Oxide Home block.

Suggestions offered by Stitch (not acted on): "View the Calendar screen",
"View the Standings screen", "Switch to light theme (White Primer)".

## Prompt (structure and content only)

Complete scrollable dark Home; palette discipline (no teal/blue accents);
strict content rule, sentence case, no telemetry/dashboard/workshop/decal
imagery. Modules: 1 masthead on ground; 2 livery panel (graphite + Red Oxide
fields split by a 12° seam, Chalk text, "Next Grand Prix", "Starts in 2 days",
huge "23" + "Round", "Abu Dhabi Grand Prix", "Yas Marina Circuit", dashed
"Status unknown"); 3 gunmetal schedule tray (Ember "Next session", Race, dashed
status, large "17:00" + "GMT", "Monday, November 9, 2026", "Your time zone:
GMT"); 4 Chalk leader band split by the same cut (Lando Norris · McLaren · 120
pts · View drivers' standings | McLaren · 150 pts · View constructors'
standings); 5 result ribbon on ground (Ember "22" + "Round", Qatar Grand Prix,
Lusail International Circuit, filled "Final" with check, Winner Lando Norris
McLaren, View Grand Prix); 6 upcoming known-empty state + View Calendar; 7
Explore buttons Drivers/Teams/Circuits; 8 gunmetal bottom nav, Home active as
Red Oxide block. Livery cut only in modules 2 and 4.
