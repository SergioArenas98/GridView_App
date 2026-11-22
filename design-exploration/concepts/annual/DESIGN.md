---
version: alpha
name: GridView — Annual
description: The Formula 1 season as a contemporary sports publication. Light-first, native Android.
colors:
  paper: "#F6F7F8"
  ink: "#111417"
  ink-secondary: "#4C535A"
  rule: "#C9D1CD"
  green: "#1D5641"
  green-tint: "#E2ECE6"
  on-green: "#FFFFFF"
  on-green-secondary: "#B9DCCB"
  critical: "#A32A1F"
  dark-paper: "#0F1513"
  dark-ink: "#E8EEEA"
  dark-ink-secondary: "#A6B1AC"
  dark-green-text: "#7CC4A3"
  dark-tint: "#18241F"
  dark-critical: "#F0907F"
typography:
  masthead: {fontFamily: Schibsted Grotesk, fontSize: 26px, fontWeight: 800, lineHeight: 1.0}
  season: {fontFamily: Schibsted Grotesk, fontSize: 40px, fontWeight: 800, lineHeight: 1.0, fontFeature: "tnum"}
  headline: {fontFamily: Schibsted Grotesk, fontSize: 32px, fontWeight: 800, lineHeight: 1.05}
  title: {fontFamily: Schibsted Grotesk, fontSize: 20px, fontWeight: 700, lineHeight: 1.2}
  kicker: {fontFamily: Schibsted Grotesk, fontSize: 13px, fontWeight: 700, lineHeight: 1.2}
  pull-figure: {fontFamily: Schibsted Grotesk, fontSize: 56px, fontWeight: 800, lineHeight: 1.0, fontFeature: "tnum"}
  time: {fontFamily: Schibsted Grotesk, fontSize: 28px, fontWeight: 700, lineHeight: 1.1, fontFeature: "tnum"}
  deck: {fontFamily: Atkinson Hyperlegible Next, fontSize: 17px, fontWeight: 400, lineHeight: 1.4}
  body-md: {fontFamily: Atkinson Hyperlegible Next, fontSize: 15px, fontWeight: 400, lineHeight: 1.5}
  body-sm: {fontFamily: Atkinson Hyperlegible Next, fontSize: 13px, fontWeight: 400, lineHeight: 1.45}
rounded:
  none: 0px
  sm: 2px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
components:
  masthead-band: {backgroundColor: "{colors.green}", textColor: "{colors.on-green}", rounded: "{rounded.none}", padding: 16px}
  fact-box: {backgroundColor: "{colors.green-tint}", textColor: "{colors.ink}", rounded: "{rounded.none}", padding: 16px}
  footer-nav: {backgroundColor: "{colors.paper}", textColor: "{colors.ink}", height: 56px}
  footer-nav-selected: {backgroundColor: "{colors.paper}", textColor: "{colors.green}", height: 56px}
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

A season annual reimagined as a fast mobile app. Identity comes from
typography, grid and rhythm, printed in two inks: black and Bookcloth Green.
Every editorial device does a data job; nothing is decorative. It is an app
first, never a newspaper or a landing page.

## Colors

**Two-ink rule:** Ink (#111417) and **Bookcloth Green (#1D5641)**, plus green
tints. Green owns the masthead band, kickers, links and the selected footer
item. **Green Tint (#E2ECE6)** grounds the weekend fact box, so the page is
never just white. Critical red is a third ink only for failures and cancelled
events. Dark theme: green-black paper, Light Green (#7CC4A3) for kickers and
links; the masthead band stays green.

## Typography

Schibsted Grotesk for masthead, headlines, kickers and numerals (tabular).
Atkinson Hyperlegible Next for decks and body. Sentence case; no italics, no
tracked capitals, no serif. Big type is reserved for real figures: season,
points, time. Headlines wrap to three lines; never truncate names.

## Layout

4-column phone grid, 16px margins, 48px targets. Sections differ in span and
form: full-width lead story, boxed fact box, stacked pull figures, report
teaser, contents list. Section openers are a kicker plus a 2px ink rule. The
masthead stays compact; the featured story targets about 220px but grows
rather than truncating. Single column at 320px and at large text.

## Elevation & Depth

Flat, like print. Depth comes from the green band, the tinted fact box and
rule weight (1px hairline inside sections, 2px between). No shadows.

## Shapes

Square corners (0 to 2px). The only box is the fact box; everything else sits on
paper.

## Components

- **Masthead band:** full-bleed green; "GridView", season figure, folio line
  with last check; refresh and Settings icons.
- **Lead story:** kicker, headline, deck, standfirst (relative start), status.
- **Fact box:** "Weekend sessions" with large tabular times.
- **Pull figures:** one row per championship: huge points beside name, team
  and link. Provisional is marked with a dagger plus the word.
- **Report teaser:** latest result, winner as secondary headline.
- **Contents list:** dot leaders for upcoming events and Explore.
- **Status:** a small glyph plus the word (Live, Scheduled, Final, Cancelled,
  Status unknown); app-computed context appears only in kickers.
- **Footer navigation:** small icons above full labels, never truncated;
  selected bold green with 3px underline; respects the gesture inset.

## Do's and Don'ts

- Do keep every Home field and state; omit absent values cleanly.
- Don't use cards, pills, photos, gradients or decorative rules.
- Don't invent data or team colours; don't imitate F1 branding.
