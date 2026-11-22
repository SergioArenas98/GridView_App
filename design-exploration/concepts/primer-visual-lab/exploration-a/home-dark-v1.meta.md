# Exploration A — Primer Evolution — home-dark-v1

- Stitch project: "GridView - Primer Visual Lab" — `projects/12213569932890775637`
- **No design system uploaded.** `generate_screen_from_text` was called with
  `designSystem` empty, which the tool documents as "Stitch automatically
  generates a design system that fits the prompt". Stitch created a project
  theme named **"Primer Evolution"**: Space Grotesk (display), JetBrains Mono
  (figures/labels), Inter (body), primary #FF5745, neutrals #0D0F12–#283040,
  4px radii. Its generated prose describes leaderboards, sector colours, tyre
  compounds and live deltas — none of which exist in GridView (prose only; the
  screen does not render them).
- Screen: "GridView - Home" — `projects/12213569932890775637/screens/2dff0ba2faa746db8d62f5f586b88ca3`
  MOBILE, dark, GEMINI_3_8_FLASH, 780×3078 px (390 CSS px, 2×).
- Side effect: a second screen `b906903234f94d2e95f4f28f26113072`
  ("GridView - Home", 390×884, **no screenshot**) appeared in the project from the
  same single request. Not requested, not used, left untouched.
- The MCP call timed out client-side; the screen appeared ~12 minutes later via
  `list_screens`. Not resent. Stitch's description/suggestions were therefore not
  returned.
- Fonts loaded (rendered page): Space Grotesk, JetBrains Mono, Inter, Material
  Symbols Outlined.
- References used: 01, 02, 03 (see `../reference-analysis.md`).
- Data: `../../../shared-reference-data.md`.
- Files: `home-dark-v1.png` (project public thumbnail, full size),
  `home-dark-v1.html` (via `download_file`, unmodified), `mobile-qa/`.

## Prompt (verbatim intent, concise)

Art direction "Primer Evolution": premium night-paddock feel; graphite and
blue-slate surfaces with real depth (tonal gradients, layered panels, faint glow
behind the hero); one warm red-oxide/ember accent for focus and primary actions;
instrument-like readouts (tabular numerals in outlined capsules or rings);
technical condensed type for figures with a clean grotesk for text; typographic
hero (round number and countdown staged large); every section with the same
craft and a confident rhythm of scale, not identical cards; floating bottom bar
with highlighted Home. Information priority 1–5 (next GP, next session time,
championship leaders, latest result, upcoming + explore). Content block = the
frozen dataset exactly ("use exactly this, nothing more"). "Status unknown"
neutral and honest; "Final" settled; readable sizes, 48px targets, nothing
behind the nav.

## Invented or altered content in the output

| Where | Output | Problem |
|---|---|---|
| Hero readout | "T-48:00:00" | Invented countdown value (only "Starts in 2 days" is confirmed) |
| Hero readout | "STG_R23 // LIVE_FEED" | Invented telemetry string; implies a live feed |
| Hero readout | "UTC+04:00" | Invented venue offset; contradicts "Your time zone: GMT" context |
| Hero readout | "Countdown" label | Not an app label |
| Sessions header | "Session 5 of 5" | Invented; implies four other sessions (only Race confirmed) |
| Sessions row labels | "Date & Time", "Timezone" | Not app labels (tolerable) |
| Championship header | "Championship Standings", "Post-R22" | "Post-R22" is an inference not in the data |
| Leader labels | "Drivers' Leader", "Teams' Leader", "PTS" | Shortened from "Drivers'/Teams' Championship leader" |
| Teams leader | "Constructor" subtitle | Not in the data |
| Latest result | "Previous Round" | Not an app label |
| Latest result | emerald-green "Final" badge | Off-palette colour; reads as success semantics |
| Nav | Home icon = timer; labels uppercase 9px | Non-standard Home icon; illegible size |

Nothing confirmed is missing: all H-values in the dataset appear.
