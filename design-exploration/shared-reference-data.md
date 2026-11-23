# Shared Reference Data — Design Concepts

One frozen dataset, reused unchanged by every concept (Timetable, Primer,
Annual) for fair comparison. IDs refer to `GridView_Pre_Redesign_UI_UX_Audit.md` §3.

## Provenance and rules

- **Source:** owner-provided screenshots of the GridView **staging** app
  (supplied 2026-11-07). Frozen staging values, **not** verified real-world
  Formula 1 results. Never correct or replace them with external F1 data.
- **Frozen:** "Starts in 2 days" is a captured label; do not recalculate it.
- **Nothing is invented.** Anything not listed is unconfirmed and follows the
  audit's conditional rule (usually: omitted). Mockups must not present
  unconfirmed information as confirmed.
- Language for first renders: English (`lib/l10n/app_en.arb` strings).

## Confirmed values (staging screenshots)

| ID | Element | Value |
|---|---|---|
| H01 | App name | GridView |
| H02 | Season | 2026 → "2026 season" |
| H03 | Featured meaning (client-derived) | "Next Grand Prix" |
| H04 | GP name | Abu Dhabi Grand Prix |
| H05 | Round | 23 → "Round 23" |
| H06 | Circuit | Yas Marina Circuit |
| H10 | Event status (API) | Unknown → chip "Status unknown" |
| H13 | Relative start (client-derived) | "Starts in 2 days" |
| H15 | Focused-session heading | "Next session" |
| H16 | Focused session | Race |
| H17 | Session status (API) | Unknown → "Status unknown" |
| H18 | Session date / time / zone | Monday, November 9, 2026 · 17:00 GMT |
| H20 | Compact schedule | This single Race session only |
| H21 | Device timezone label | GMT |
| H23–H25 | Drivers' leader | Lando Norris · McLaren · 120 pts |
| H28–H29 | Teams' leader | McLaren · 150 pts |
| H35 | Latest event | Qatar Grand Prix · Round 22 · Lusail International Circuit |
| H36 | Classification status (API) | Final |
| H37–H38 | Race winner | Lando Norris · McLaren |
| H41 | Upcoming module | Known-empty → "No upcoming events" |
| H42 | Last successful check | "Last successful check: 4:22" (as displayed) |

## Unconfirmed — omit in this dataset (design must still accommodate)

| ID | Element | Rule |
|---|---|---|
| H07–H08 | Abu Dhabi locality, country | Omitted; joined location drops missing parts |
| H09 | Abu Dhabi weekend date range | Omitted when no endpoint is known |
| H11 | "Race weekend" chip | Not confirmed → not shown |
| H12 | Sprint chip | Not confirmed → not shown |
| H14 | Event/circuit image | Not assumed → absent |
| H19 | Session relative label | Not confirmed → not shown |
| Other sessions | Practice, qualifying, sprint | Not confirmed → not shown |
| H26, H30 | Provisional leader flags | Not confirmed → no chip |
| H27, H30 | Team accent colours | Not confirmed → no accent |
| H35 | Latest-event locality, country, dates, event status | Omitted |
| H31–H33 | Tied leaders | Not active (single confirmed leaders) |
| H43–H44 | Refreshing label, stale/failed notices | Not active in base state |

## Labels (English, from app strings)

"Next Grand Prix", "Weekend sessions", "Next session", "Drivers' Championship
leader", "Teams' Championship leader", "Latest result", "Winner", "Upcoming
events", "No upcoming events", "View Calendar", "View Grand Prix", "Explore",
"Refresh Home"; navigation: Home · Calendar · Standings · Explore, plus Settings.

## Later state captures (same base values)

Tied leaders · leader unavailable / no leader yet · unresolved vs unavailable
upcoming · stale and refresh-failed notices · missing session times · Both-clock
day crossing · Spanish · large text at 320 dp · dark theme.
