---
version: alpha
name: GridView — Primer
description: Motorsport identity through paint, material and numerals. Dark-first, native Android.
colors:
  background: "#141518"
  tray: "#1F2125"
  raised: "#2A2D32"
  text: "#ECEAE5"
  text-secondary: "#A9ABB1"
  oxide: "#A03E2B"
  oxide-deep: "#7A2E21"
  ember: "#F08A6C"
  chalk: "#ECEAE5"
  on-chalk: "#141518"
  on-chalk-secondary: "#4F525A"
  critical: "#FF8A7A"
  light-background: "#E8E9EB"
  light-tray: "#F5F5F6"
  light-text: "#141518"
  light-text-secondary: "#4F525A"
  light-ember: "#8E3524"
typography:
  numeral-xl: {fontFamily: Archivo, fontSize: 72px, fontWeight: 800, lineHeight: 0.9, fontFeature: "tnum"}
  numeral-lg: {fontFamily: Archivo, fontSize: 40px, fontWeight: 800, lineHeight: 1.0, fontFeature: "tnum"}
  time: {fontFamily: Archivo, fontSize: 28px, fontWeight: 700, lineHeight: 1.1, fontFeature: "tnum"}
  headline: {fontFamily: Archivo, fontSize: 26px, fontWeight: 800, lineHeight: 1.1}
  title: {fontFamily: Archivo, fontSize: 17px, fontWeight: 700, lineHeight: 1.3}
  body-md: {fontFamily: Archivo, fontSize: 15px, fontWeight: 400, lineHeight: 1.45}
  body-sm: {fontFamily: Archivo, fontSize: 13px, fontWeight: 400, lineHeight: 1.4}
  label: {fontFamily: Archivo, fontSize: 13px, fontWeight: 700, lineHeight: 1.2}
rounded:
  chip: 8px
  control: 12px
  panel: 20px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
components:
  livery-panel: {backgroundColor: "{colors.oxide}", textColor: "{colors.chalk}", rounded: "{rounded.panel}", padding: 20px}
  tray: {backgroundColor: "{colors.tray}", textColor: "{colors.text}", rounded: "{rounded.panel}", padding: 16px}
  leader-band: {backgroundColor: "{colors.chalk}", textColor: "{colors.on-chalk}", rounded: "{rounded.panel}", padding: 16px}
  chip-status: {backgroundColor: "{colors.raised}", textColor: "{colors.text}", rounded: "{rounded.chip}"}
  button: {backgroundColor: "{colors.raised}", textColor: "{colors.text}", rounded: "{rounded.control}", height: 48px}
  nav-active: {backgroundColor: "{colors.oxide}", textColor: "{colors.chalk}", rounded: "{rounded.control}"}
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

Bold, controlled, contemporary. A graphite primer ground carries two paint
fields, Red Oxide and Chalk. Identity comes from paint, material and big
numerals, not team colours or photos. No workshop or dashboard costume.

## Colors

Graphite Primer (#141518) ground; Gunmetal trays and raised layers. **Red Oxide
(#A03E2B)** is a surface paint only: the featured Grand Prix panel and the active
navigation block, always carrying Chalk text (5.4:1). It is never text, icon or
thin line on graphite (2.8:1). **Chalk (#ECEAE5)** is the second paint, for the
leader band, so dark and light masses alternate. **Ember (#F08A6C)** is the
accent for text and numerals on graphite (7.4:1). Light theme: White Primer
ground, graphite leader band, Light Ember (#8E3524, 6.4:1) for accent text.
Team colours: a 4px stripe only when supplied; absent means no stripe.

## Typography

Archivo throughout, sentence case, never uppercase labels. Width carries
meaning: expanded heavy numerals for round, points and times; normal width for
text. Tabular figures for every number. Numerals use the width axis at 125 (times 112).

## Layout

16px margins, 4px rhythm, 48px touch targets. One narrative column, each module
with its own treatment. Only the livery panel, schedule tray and leader band are
panels; result, upcoming and explore sit on the ground. No equal-tile grids. At
200% text the leader band stacks and numerals wrap; nothing truncates.

## Elevation & Depth

Layered tones with a 1px top sheen edge (white at 8%) on raised layers. Paint panels carry a
single-hue clear-coat gradient (oxide to oxide-deep). Soft shadow only under
paint panels. No glass, glow or neon.

## Shapes

20px panel corners, 12px controls, 8px chips. Signature **livery cut**: one
straight 12° seam between two paint fields, used only in the livery panel and
the leader band; text crossing it keeps 4.5:1 or more on both fields.

## Components

- **Livery panel:** featured Grand Prix; huge round numeral across the cut.
- **Schedule tray:** session rows with large expanded times.
- **Leader band:** chalk band split by the livery cut, drivers | teams.
- **Result ribbon:** big Ember round numeral beside event, status and winner.
- **Status:** data status = filled chip with glyph; app-computed context = Ember
  label without container; unknown = dashed chip "Status unknown".
- **Navigation:** gunmetal bar; active item = oxide block, filled icon, bold
  Chalk label; inactive = outline icon, secondary label.

## Do's and Don'ts

- Do keep every Home field and state; omit absent values cleanly.
- Do write every status in words.
- Don't invent data, numbers, team colours or photos.
- Don't use neon, bento grids, carbon fibre, checkered flags or F1 branding.
