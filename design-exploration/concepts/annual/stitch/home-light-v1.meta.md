# home-light-v1 — generation record

- Stitch project: "GridView - Annual (Design Exploration)" — `projects/8853593937266561908`
- Design system used: "GridView — Annual" — `assets/65c84be4325b451ebc51d05503c30948`
  (second upload of `../DESIGN.md`, 4,828 bytes; upload screen `8177606996976366775`).
  Fonts and colour tokens kept; the prose sections were dropped and replaced by
  Stitch-generated guidelines that mention minimalism, "race telemetry", lap
  times, starting grids and data tables (none exist in GridView).
- Superseded, unused design system: `assets/76f9273aa62a4d3eb9564e3f953b96eb`
  (first upload, screen `8676414182233718045`): prose dropped, Schibsted Grotesk
  replaced by Atkinson everywhere, guidelines rewritten as "a premium broadsheet
  newspaper translated to glass" with live-timing feeds. Not deletable via MCP.
- Screen: "GridView Home" — `projects/8853593937266561908/screens/9941a735c2b84b3d84b4c932c81c77f9`
- MOBILE, light, GEMINI_3_8_FLASH, 780×3290 px (390 CSS px wide, 2×). The MCP
  call timed out client-side; the screen appeared about 3 minutes later via
  `list_screens`. Stitch's description and suggestions were therefore not returned.
- Fonts loaded (verified in the rendered page): **Schibsted Grotesk** (headlines,
  labels, figures), **Atkinson Hyperlegible Next** (body), Material Symbols
  Outlined (icons). No substitute needed.
- Colours in the HTML: #F6F7F8 paper, #111417 ink, #4C535A secondary, #C9D1CD
  rules, #1D5641 green, #E2ECE6 green tint, #B9DCCB on-green secondary, white.
  No extra accents.
- Data: `../../../shared-reference-data.md`.
- Files: `home-light-v1.png` (project public thumbnail URL, full size),
  `home-light-v1.html` (via `download_file`), mobile captures in `mobile-qa/`.

## Prompt (structure and content only)

Contemporary sports publication; light; 390px mobile; whole Home in one screen;
two-ink palette; strict content rule, sentence case, no italics, no telemetry,
lap times, standings tables, commentary, numbers, team colours or photos.
Sections: 1 compact green masthead band (GridView, "2026" + "season", "Last
successful check: 4:22", refresh/settings); 2 lead story on paper (label "Next
Grand Prix · Round 23", headline Abu Dhabi Grand Prix, deck Yas Marina Circuit,
standfirst "Starts in 2 days", "? Status unknown", "View Grand Prix"); 3 green-
tint fact box "Weekend sessions" (Next session, Race, 17:00 GMT, Monday,
November 9, 2026, Status unknown, Your time zone: GMT); 4 Championship as two
stacked pull-figure rows (120 pts Lando Norris McLaren View drivers' standings;
150 pts McLaren View constructors' standings); 5 report teaser "Latest result ·
Round 22" (Qatar Grand Prix, Lusail International Circuit, ✓ Final, Winner Lando
Norris McLaren, View Grand Prix); 6 "Upcoming events": one line "No upcoming
events" + "View Calendar"; 7 Explore contents list with dot leaders (Drivers,
Teams, Circuits); 8 fixed bottom nav, icon above full label, Home selected bold
green with 3px underline, safe-area padding.
