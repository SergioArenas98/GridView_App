# GridView - UI/UX Design

## Document information

- Product: GridView
- Document type: UI/UX Design
- Version: 0.1
- Status: Draft
- Platform: Android
- Client technology: Flutter
- Related documents:
  - `GridView_PRD.md`
  - `GridView_App_Flow.md`
- Product phase: Complete reconstruction of the existing application

---

## 1. Purpose

This document defines the design direction, user-experience principles, visual language and screen-level design guidance for the reconstructed version of GridView.

It translates product requirements and navigation structure into a coherent interface system that is:

- Clear.
- Fast to understand.
- Visually engaging.
- Appropriate for a motorsport product.
- Scalable for future growth.

This document does not define implementation details such as widget architecture, API integration or persistence strategy.

---

## 2. Design objective

The goal of the new GridView design is to make following a Formula 1 season feel exciting, effortless and premium.

The UI should help users answer their questions quickly while still feeling emotionally connected to the sport.

The design must work for both:

- Casual users who need quick answers.
- Habitual followers who repeatedly navigate between races, standings, drivers, teams and circuits.

The design should not feel like a generic sports app, but it also should not depend on copying the official Formula 1 visual identity.

---

## 3. Design direction derived from the references

The provided references suggest several strong and useful patterns.

### 3.1 What the references do well

The references consistently use:

- Dark, premium interfaces.
- Strong visual hierarchy.
- Large hero sections.
- Bold display typography.
- Rounded cards and modular layouts.
- Accent colors used sparingly for emphasis.
- Data panels inspired by telemetry or performance dashboards.
- Large subject imagery.
- Bottom navigation with clear active-state indication.
- Good contrast between primary content and supporting content.

### 3.2 Main takeaways for GridView

GridView should borrow the following ideas conceptually:

- A dark-first visual environment.
- A dashboard-like feeling on high-value screens such as Home and Grand Prix detail.
- Strong section headers with concise labels.
- Modular information blocks instead of long text-heavy pages.
- Large image-led hero areas for drivers, teams and circuits.
- Visual "motorsport instrumentation" cues without overloading the screen.
- Limited but high-impact accent colors.
- A balance between emotional visuals and utility.

### 3.3 What GridView should avoid

GridView should avoid:

- Overly decorative layouts with poor information density.
- Excessive use of neon or gradients.
- Styling that makes every screen feel different from the others.
- Tiny telemetry-style labels that hurt readability.
- Decorative effects that slow the interface down.
- Excessive mimicry of the Formula 1 official brand system.
- Unlicensed visual assets or fonts.

---

## 4. Experience principles

### 4.1 Fast comprehension

The most important information on every screen must be recognizable in a few seconds.

### 4.2 Emotion with discipline

The UI should feel passionate and sporting, but data and navigation must remain easy to read and predictable.

### 4.3 Visual consistency

The entire application should feel like one system rather than a collection of unrelated pages.

### 4.4 Progressive depth

Each screen should provide a quick overview first, with detail available after one interaction.

### 4.5 Calm complexity

Formula 1 contains a lot of information. The interface should present it in a calm, controlled way rather than trying to display everything at once.

### 4.6 Content-led design

The design should elevate races, standings, drivers, teams and circuits rather than competing with them.

---

## 5. Brand personality

GridView should visually express the following characteristics:

- Dynamic.
- Premium.
- Focused.
- Modern.
- Confident.
- Technical.
- Clean.
- Sport-driven.

It should feel closer to a refined race dashboard than to a generic news feed.

---

## 6. Visual style recommendation

## 6.1 Overall look

Recommended direction:

- Dark-first interface.
- Soft charcoal or midnight surfaces.
- High-contrast white or off-white typography.
- One primary red accent inspired by motorsport intensity.
- One secondary cool accent such as electric blue for alternate highlights.
- Selective use of warm warning colors such as amber or orange.
- Rounded cards with smooth but not exaggerated corners.
- Generous padding and breathing room.
- Soft depth through elevation and tonal layering rather than heavy shadows.

This approach aligns with the references while remaining original and appropriate for a sports information product.

---

## 7. Color system

The color palette should be restrained and purposeful.

## 7.1 Core palette

### Primary background tones

- `#0B0D12` - App background / deepest surface
- `#11151C` - Main page surface
- `#171C24` - Elevated card surface
- `#202734` - Secondary elevated surface

### Neutral tones

- `#F5F7FA` - Primary text
- `#D9DEE7` - Secondary text
- `#A1AAB8` - Muted text
- `#697386` - Disabled / tertiary text
- `#2D3645` - Dividers / subtle outlines

### Primary accent

- `#FF3B30` - Main action accent / race energy red

### Secondary accent

- `#3B82F6` - Informational accent / alternate emphasis

### Supporting accent colors

- `#F59E0B` - Warning / timing / caution
- `#22C55E` - Success / completed / positive state
- `#8B5CF6` - Optional tertiary accent for special highlights if needed

## 7.2 Usage strategy

- Red is the main interaction and emphasis color.
- Blue is used more sparingly for informational or alternate-highlight content.
- Green and amber are semantic, not decorative.
- Team colors may appear in controlled accents such as chips, bars or header details, but should not dominate the global palette.

## 7.3 Background recommendation

The product should use a dark default appearance as its primary visual identity.

A light theme may still be supported, but the design system should be created dark-first.

---

## 8. Typography system

The typography should feel modern and sporty without becoming hard to read.

## 8.1 Recommended font pairing

### Headings and section emphasis

**Sora** or **Space Grotesk**

Reasons:

- Contemporary.
- Geometric.
- Strong visual identity.
- Good for bold section titles and short labels.
- Available through Google Fonts, easy to integrate.

### Body text and data-heavy content

**Inter**

Reasons:

- Extremely readable.
- Excellent for dense information.
- Works well on Android.
- Highly flexible across sizes and weights.

## 8.2 Recommended choice

Preferred option:

- **Headings:** Sora
- **Body and UI text:** Inter

This pairing creates personality without sacrificing usability.

## 8.3 Type scale

Suggested scale:

- Display XL: 40-44
- Display L: 32-36
- Heading 1: 28
- Heading 2: 24
- Heading 3: 20
- Title: 18
- Body L: 16
- Body M: 14
- Label: 12
- Caption: 11

## 8.4 Weight guidance

- Bold / SemiBold for section titles and key numbers.
- Medium for navigation and labels.
- Regular for body text.
- Avoid using too many weights within the same screen.

## 8.5 Numeric styling

Large statistics such as points, ranking position, countdowns or lap data should use:

- Bold or SemiBold weight.
- Clear spacing.
- Consistent alignment.
- Tabular figure support if possible.

---

## 9. Shape, spacing and layout system

## 9.1 Corner radius

Suggested radius system:

- Small: 8
- Medium: 12
- Large: 20
- XL: 28

Use cases:

- Chips and pills: 999 / full rounded
- Standard cards: 16-20
- Hero containers: 24-28
- Bottom navigation container: 24-28

## 9.2 Spacing system

Base spacing scale:

- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40

Recommended default screen padding:

- Horizontal: 20
- Vertical section spacing: 20-24

## 9.3 Grid

Use a simple mobile-first layout:

- Single-column primary layout.
- Cards grouped vertically.
- Horizontal carousels only where they provide real value.
- Avoid complicated multi-column structures on phones.

---

## 10. Elevation and depth

Depth should come mainly from:

- Tonal contrast.
- Layered surfaces.
- Large content blocks.
- Controlled shadows.

Recommended approach:

- Use subtle shadows sparingly.
- Prefer tonal elevation on dark surfaces.
- Keep the UI crisp and technical.
- Avoid overly blurred or soft visual language.

---

## 11. Iconography

Icons should be:

- Simple.
- Rounded or slightly softened.
- Consistent in stroke weight.
- Easy to parse at small sizes.

Recommended style:

- Material Symbols Rounded or a consistent custom icon set.

Icon usage examples:

- Home.
- Calendar.
- Trophy / standings.
- Search / explore.
- Settings.
- Circuit / track.
- Driver / team.
- Session type markers.

Icons should support recognition, not become decorative clutter.

---

## 12. Imagery strategy

## 12.1 Content imagery

GridView may include:

- Driver portraits.
- Team imagery or logos.
- Circuit photos or circuit layout graphics.
- Race-event hero images where licensing allows.

## 12.2 Visual treatment

Imagery should be presented with one of the following treatments:

- Clean cutout on dark background.
- Hero image with subtle dark overlay.
- Image within a rounded card.
- Faded background watermark behind key content.

## 12.3 Recommended behavior by content type

- **Drivers:** portrait-led hero section.
- **Teams:** logo + car or team image, less portrait-driven than drivers.
- **Circuits:** circuit layout graphic and/or environmental image.
- **Grand Prix:** circuit or event image with timing and state overlay.

## 12.4 Fallbacks

When images are unavailable:

- Use placeholders.
- Preserve layout dimensions.
- Show initials, logo fallback or circuit-outline fallback where appropriate.

---

## 13. Motion and transitions

Motion should feel smooth, precise and light.

### 13.1 Principles

- Use motion to support orientation.
- Avoid long or flashy animations.
- Keep transitions short and confident.
- Use micro-feedback on taps, refresh and state changes.

### 13.2 Recommended transitions

- Horizontal slide for detail navigation.
- Fade or scale-in for cards and hero content.
- Subtle cross-fade for image loading.
- Animated segmented controls or tabs.
- Countdown or timing updates should be smooth but not attention-seeking.

### 13.3 Performance note

Animations must never compromise scroll performance.

---

## 14. Navigation design guidance

GridView will follow the App Flow structure.

## 14.1 Bottom navigation

Primary destinations:

1. Home
2. Calendar
3. Standings
4. Explore

### Bottom navigation style recommendation

- Floating or elevated pill-style container.
- Darker surface than the page background.
- Clear active-state highlight using red.
- Icons with short labels.
- Generous spacing.

This aligns well with the references and suits a premium sports app.

## 14.2 Settings access

Settings should not occupy a bottom-navigation slot.

Recommended placements:

- Top-right icon in Home.
- Overflow menu.
- Shared secondary action in top app bars.

---

## 15. Component system

The design system should be built around reusable components.

### 15.1 Core components

- App bar.
- Bottom navigation bar.
- Section header.
- Pill tabs / segmented control.
- Primary button.
- Secondary button.
- Filter chip.
- Status chip.
- Data card.
- Hero card.
- Countdown card.
- Session row.
- Standings row.
- Driver row.
- Team row.
- Circuit row.
- Result row.
- Empty state block.
- Error state block.
- Skeleton loader.
- Banner ad container.

### 15.2 Component philosophy

Components should be:

- Reusable.
- Flexible.
- Content-aware.
- Visually consistent.
- Lightweight in decoration.

---

## 16. Screen-level UX guidance

## 16.1 Home

### Purpose

Give users the fastest possible understanding of the current Formula 1 season state.

### Content hierarchy

1. Current or next Grand Prix hero.
2. Current weekend or session timing.
3. Championship snapshot.
4. Latest result summary.
5. Upcoming races.
6. Quick-entry shortcuts where useful.

### Recommended structure

- Top bar with app identity and Settings shortcut.
- Main hero card for the next Grand Prix.
- Session timing block.
- Two compact highlight cards:
  - Drivers' Championship leader.
  - Constructors' Championship leader.
- "Latest Result" card or summary section.
- "Upcoming" horizontal or vertical list.

### Visual direction

- Hero-led.
- Dynamic.
- High-contrast.
- Strong emphasis on timing and urgency.

### Notes

This should be the most visually rich screen in the app, but also the clearest.

---

## 16.2 Calendar

### Purpose

Let users understand the entire season at a glance and open any race weekend.

### Recommended structure

- Clean section title.
- Optional season selector if supported later.
- Chronological vertical list.
- Event cards showing:
  - Round number.
  - Grand Prix name.
  - Country.
  - Circuit.
  - Date.
  - Event state.
- Strong visual differentiation for:
  - Past.
  - Current.
  - Upcoming.

### Visual direction

- Structured.
- Scannable.
- Slightly more utilitarian than Home.
- Cards should be dense but easy to read.

### Notes

The next Grand Prix should be visually elevated from the rest of the list.

---

## 16.3 Grand Prix detail

### Purpose

Provide complete race-weekend information in one place.

### Recommended structure

- Hero header with Grand Prix name, country and event state.
- Main info row:
  - Circuit.
  - Weekend dates.
  - Local timezone info if relevant.
- Session schedule card.
- Result section when available.
- Circuit preview card with quick navigation to full circuit detail.

### Visual direction

- Dashboard-like.
- Clear temporal structure.
- Rich but disciplined.

### Notes

This is one of the best places to use a slightly more technical visual tone inspired by race dashboards.

---

## 16.4 Standings

### Purpose

Make championship comparisons immediate and easy.

### Recommended structure

- Title + last-updated info.
- Segmented control:
  - Drivers.
  - Constructors.
- Clear standings rows with:
  - Position.
  - Name.
  - Team or constructor.
  - Points.
  - Optional wins.
- Leader row may receive subtle emphasis.

### Visual direction

- Clean.
- Dense.
- Fast to scan.
- Less decorative than Home.

### Notes

This screen must prioritize clarity over style.

---

## 16.5 Explore

### Purpose

Group discovery-oriented content into a single well-organized area.

### Recommended structure

- Explore title.
- Top segmented selector or pill tabs:
  - Drivers.
  - Teams.
  - Circuits.
- Optional search.
- Content list below.

### Visual direction

- Flexible.
- Slightly calmer than Home.
- Same card language as the rest of the app.

### Notes

Explore should feel like a content hub, not like a miscellaneous leftovers section.

---

## 16.6 Driver detail

### Purpose

Present a driver as a hero subject while also showing practical season data.

### Recommended structure

- Hero header with large portrait.
- Driver name.
- Team association and nationality.
- Championship position and points.
- Stats row or cards.
- About section.
- Optional career stats section.

### Visual direction

- Bold and image-led.
- Premium.
- Strong subject focus.

### Notes

This screen can take inspiration from the player-profile reference, adapted to Formula 1. The large subject image can help the app feel premium and memorable.

---

## 16.7 Team detail

### Purpose

Provide key current-season team information and quick access to drivers.

### Recommended structure

- Team hero header.
- Team logo and/or car image.
- Standing summary.
- Driver line-up.
- Team facts:
  - Base.
  - Team principal.
  - Power unit.
  - Historical highlights where appropriate.

### Visual direction

- More structured than Driver detail.
- Identity-led through color and branding cues.
- Slightly less portrait-driven.

### Notes

Use team color carefully, mainly as an accent rather than as a dominant full-screen color.

---

## 16.8 Circuit detail

### Purpose

Make circuit content informative and visually distinctive.

### Recommended structure

- Circuit name and location.
- Circuit layout image.
- Core facts card:
  - Length.
  - Laps.
  - Race distance.
- Related Grand Prix.
- Optional historical fact.

### Visual direction

- Technical.
- Clean.
- Diagram-friendly.

### Notes

This is the ideal place to use line graphics, outlines and structured data styling.

---

## 16.9 Settings

### Purpose

Provide configuration and legal information without distracting from the main product.

### Recommended structure

- Language.
- Theme.
- Time display preferences if required.
- Data and update information.
- Privacy policy.
- App version.
- Feedback / contact.

### Visual direction

- Simple.
- Low decoration.
- Consistent with the rest of the app.

---

## 17. Status and semantic design patterns

## 17.1 Event states

Suggested event-state treatment:

- Upcoming -> neutral or blue-highlighted chip
- Current -> red-accented or live-emphasis chip
- Completed -> muted or green-complete state
- Postponed / Cancelled -> amber or warning treatment

## 17.2 Loading states

Use:

- Skeleton cards.
- Placeholder blocks for images.
- Small inline progress indicators for background refresh.

Avoid:

- Long blocking splash experiences.
- Replacing already-visible content with loaders.

## 17.3 Error states

Error states should be:

- Calm.
- Clear.
- Actionable.

Recommended elements:

- Short message.
- Retry button.
- Secondary explanatory text when useful.
- Optional icon or illustration.

## 17.4 Empty states

Use empty states to explain:

- Results not available yet.
- No connection and no cached data.
- Search with no matches.
- Missing optional details.

---

## 18. Accessibility guidance

GridView should establish a strong accessibility baseline.

### Requirements

- Strong contrast on all text and important icons.
- Touch targets at least around 44x44 logical pixels.
- Content should never rely solely on color.
- Hierarchy must remain readable at larger font sizes.
- Screen-reader labels should be available for key controls.
- Numerical content should remain legible.
- Chips, tabs and filters should have clear selected states.

### Caution areas

- Red on dark surfaces must be tested carefully for contrast.
- Team colors may not always meet accessibility standards, so they should not be used as the sole indicator.
- Small telemetry-like labels must not become too small.

---

## 19. Advertisement design guidance

Advertising remains part of the product, but must be handled carefully.

### Rules

- Ads must not block startup.
- Ads must not break key information flow.
- Ads must not dominate the first visible area on high-value screens.
- Ad containers should be stable and reserved to avoid layout shift.
- The visual integration should be clean and controlled.

### Recommended placement

- Bottom banner areas on list-heavy screens.
- Possibly less intrusive ad placement on Home.
- No full-screen ad interruptions during core navigation.

---

## 20. Light theme guidance

Although GridView should be designed dark-first, a light theme may still be supported.

### Light-theme recommendation

- Keep structure identical.
- Use cool white and light gray surfaces.
- Preserve red as the main accent.
- Ensure the identity still feels premium.
- Avoid stark white large areas when a softer neutral background would work better.

The dark theme should remain the flagship experience.

---

## 21. Do and don't list

## Do

- Use large, confident section titles.
- Use modular cards.
- Keep screens clean and layered.
- Make the next race the visual star of Home.
- Use images with control and intention.
- Use accent colors to guide focus.
- Preserve strong hierarchy on every page.
- Keep the design system reusable.

## Don't

- Copy official Formula 1 branding too closely.
- Use too many colors at once.
- Overload the interface with gradients or glows.
- Make every card look visually different.
- Place style above readability.
- Depend on giant images for every screen to work.
- Make data-heavy pages feel cluttered.
- Turn every page into a poster.

---

## 22. Suggested screen mood by section

| Section | Mood |
|---|---|
| Home | Exciting, premium, dynamic |
| Calendar | Structured, confident, season-focused |
| Grand Prix detail | Technical, informative, immersive |
| Standings | Sharp, clear, efficient |
| Explore | Browsable, organized, calm |
| Driver detail | Heroic, premium, subject-focused |
| Team detail | Identity-led, structured, modern |
| Circuit detail | Technical, diagram-driven, clean |
| Settings | Minimal, secondary, practical |

---

## 23. Recommended design decisions established by this document

This document establishes the following design decisions:

- The UI should be dark-first.
- The visual language should feel premium and motorsport-inspired.
- The product should use a restrained color system with red as the primary accent.
- The recommended typography pairing is Sora + Inter.
- Home should be the most visually expressive screen.
- Standings should prioritize clarity and density.
- Explore should group Drivers, Teams and Circuits.
- Driver detail should be hero-led.
- Team detail should use team identity with restraint.
- Circuit detail should embrace structured visual data.
- The bottom navigation should have four primary destinations.
- Ads must be visually controlled and non-blocking.

---

## 24. Open design questions for later iteration

The following items may still evolve:

- Whether the bottom navigation is fully embedded or floating.
- Whether Home includes a horizontal upcoming-races carousel or a vertical list.
- Whether Explore uses segmented controls or a top-tab system.
- Whether Team detail includes a car hero image by default.
- Whether a light theme is included in the first release.
- Whether race results are embedded inside Grand Prix detail or separated visually into their own section.
- How much visual emphasis should be given to team colors on standings rows.
- Which images and logos are legally safe to use.
- Whether a more custom icon set is worth the effort for v1.

---

## 25. UI/UX acceptance criteria

The UI/UX direction will be considered successful when:

- Users can identify the next race immediately after opening the app.
- The application feels visually modern and coherent.
- Navigation between major sections is clear and fast.
- Data-heavy screens remain easy to scan.
- Hero screens feel emotionally engaging without sacrificing usability.
- The interface remains strong with or without images.
- Color usage supports focus rather than distraction.
- Typography remains readable at all supported sizes.
- The product feels premium but not visually excessive.
- The design system is reusable across future features.

---

## 26. Summary

The new GridView should adopt a dark, premium, motorsport-inspired design language that balances excitement with clarity.

The interface should be:

- Bold but not noisy.
- Technical but not intimidating.
- Emotional but still practical.
- Consistent across all core sections.

The recommended visual foundation is:

- Dark-first surfaces.
- Red-led accent system.
- Sora for headings.
- Inter for body text.
- Modular rounded cards.
- Hero-driven Home and profile screens.
- Clean, efficient standings and calendar screens.

This direction takes inspiration from the provided references while remaining original and suitable for a Formula 1 product focused on season tracking, drivers, teams, circuits and standings.
