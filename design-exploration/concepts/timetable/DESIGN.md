---
version: alpha
name: GridView — Timetable
description: The Formula 1 season as a line through time. Native Android.
colors:
  background: "#F3F4F1"
  text: "#15181C"
  text-secondary: "#4A5058"
  rule: "#C9CDD2"
  enamel: "#1B3F73"
  on-enamel: "#FFFFFF"
  amber: "#F0B400"
  critical: "#A3261B"
  notice: "#FFF1BF"
  dark-background: "#0E1115"
  dark-text: "#ECEFF3"
  dark-text-secondary: "#A7AFBA"
  dark-board: "#1F3A63"
  dark-line: "#8FA9D4"
  dark-amber: "#F5C542"
  dark-critical: "#F08A7E"
  dark-notice: "#3A2F0B"
typography:
  relative-start: {fontFamily: Overpass, fontSize: 32px, fontWeight: 700, lineHeight: 1.1}
  gp-name: {fontFamily: Overpass, fontSize: 24px, fontWeight: 700, lineHeight: 1.2}
  section: {fontFamily: Overpass, fontSize: 15px, fontWeight: 700, lineHeight: 1.3}
  body-md: {fontFamily: Overpass, fontSize: 15px, fontWeight: 400, lineHeight: 1.45}
  body-sm: {fontFamily: Overpass, fontSize: 13px, fontWeight: 400, lineHeight: 1.4}
  plate: {fontFamily: Overpass, fontSize: 12px, fontWeight: 700, lineHeight: 1.2}
  figure: {fontFamily: Overpass, fontSize: 22px, fontWeight: 700, lineHeight: 1.1, fontFeature: "tnum"}
  clock: {fontFamily: Overpass Mono, fontSize: 15px, fontWeight: 500, lineHeight: 1.3, fontFeature: "tnum"}
rounded:
  none: 0px
  sm: 2px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  row: 48px
components:
  header-sign: {backgroundColor: "{colors.enamel}", textColor: "{colors.on-enamel}", rounded: "{rounded.none}"}
  now-board: {backgroundColor: "{colors.enamel}", textColor: "{colors.on-enamel}", rounded: "{rounded.none}", padding: 16px}
  plate-supplied: {backgroundColor: "{colors.text}", textColor: "{colors.background}", rounded: "{rounded.sm}"}
  plate-computed: {backgroundColor: "{colors.background}", textColor: "{colors.text}", rounded: "{rounded.sm}"}
  nav-plate: {backgroundColor: "{colors.enamel}", textColor: "{colors.on-enamel}", height: 64px}
  nav-plate-selected: {backgroundColor: "{colors.background}", textColor: "{colors.enamel}", height: 64px}
---

<!-- primer-v2-status-notice -->
> **Historical record.** This document records an exploration that preceded Primer V2. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../../../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](../../prototypes/primer-v2/DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](../../prototypes/primer-v2/DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](../../prototypes/primer-v2/README.md#validation-output).

## Overview

Wayfinding clarity for a Formula 1 season: every screen answers "when, and where
am I in it?". Calm, exact, light-first with an equally strong dark theme.
Expression comes from structure, never ornament.

## Colors

Platform White ground, Graphite Ink text, Slate secondary text, Rule Grey 2px
dividers. **Enamel Blue (#1B3F73)** owns the header, now-board, route line, round
plates and navigation. **Amber (#F0B400)** means "now" only: focused marker and
4px edge, outlined in ink on light grounds, never text there. **Critical** marks
cancelled and update-failed, always with words. Dark tokens mirror these roles.
Team colours: 3px ticks only.

## Typography

Overpass for all text, sentence case, no tracked capitals. Overpass Mono with
tabular figures for every clock. The relative start is the largest text on Home.

## Layout

4px rhythm, 16px margins, 48px minimum rows and touch targets. A vertical **route
line** in a 40px left gutter organises time; content aligns to it. Node spacing
is uniform, never proportional to time. Clocks right-align in fixed columns. At
narrow width or 200% text the second clock wraps below; nothing truncates.

## Elevation & Depth

Flat: no shadows, blur or gradients. Hierarchy comes from the solid enamel board
and 2px rules.

## Shapes

0px corners for header, board and navigation; 2px for plates; nothing
pill-shaped. 12px circular node markers on a 3px line.

## Components

- **Header sign:** enamel band, wordmark, season, square refresh and Settings.
- **Now-board:** solid enamel slab for the featured Grand Prix.
- **Plates:** filled = status from data; outlined = meaning computed by the app
  (Next, Race weekend); dashed = "Status unknown".
- **Nodes:** filled completed, amber ring live, hollow scheduled, crossed
  cancelled, dashed unknown; focused node labelled "Next session".
- **Leader signs:** two rectangles side by side, stacked when narrow.
- **Navigation:** four square enamel plates, icon above label; selected inverts
  with a 4px amber top edge.

## Do's and Don'ts

- Do keep every Home field and state; omit absent values cleanly.
- Do label every status in words, never colour or shape alone.
- Don't use cards, pills, gradients, glass, photos, stripes, checkered flags,
  fake telemetry, transit wording or split-flap effects.
- Don't invent data; don't imitate F1 branding.
