/// Primer V2 theme-independent stroke and focus metrics (logical pixels).
///
/// Source: `CROSS-THEME-TOKEN-MAP.md` §4.3, §4.7, §4.11 and
/// `CROSS-THEME-CONSOLIDATION.md` §7.5 (frozen, DD XT-6). Only values the
/// frozen specification states are recorded here; the one focus offset that
/// differs per theme (the detail back button, XT-4) lives in
/// `GvPrimerFocusRoles.backButtonOffset`.
///
/// A positive offset draws the ring outside the control; a negative offset
/// draws it inside. Painting the ring (above decoration, never clipped by an
/// ancestor) is a shared-widget responsibility (XS-31), not part of the theme.
abstract final class GvPrimerMetrics {
  /// Width of every status-chip outline, solid or dashed (DK-1, VS-1).
  static const double statusOutlineWidth = 1.5;

  /// Dash length of the unknown-value boundary.
  ///
  /// **Initial Flutter choice, not frozen (Step 55B.1, owner review pending).**
  /// The specification only says "dashed"; the prototypes use the browser's
  /// own pattern. Measured on the approved Chrome captures
  /// (`cross-theme-54b/validation-20261113-222328-cal`), a 1.5px dashed chip
  /// edge repeats every 5px with dash and gap about equal, so Flutter starts
  /// at 2.5 / 2.5.
  static const double dashLength = 2.5;

  /// Gap between dashes of the unknown-value boundary (see [dashLength]).
  static const double dashGap = 2.5;

  /// Width of every keyboard-focus ring.
  static const double focusRingWidth = 2;

  /// Corner radius of the focused element the ring follows (`base.css`
  /// `:focus-visible { border-radius: 6px }`, XT-1 "6px radius").
  static const double focusRingRadius = 6;

  /// Width of the Light contextual focus backing band (LT-4, LT-5, LT-15).
  static const double focusBackingWidth = 5;

  /// Default ring offset: outside the control.
  static const double focusOffsetDefault = 3;

  /// Ring offset on rows: inside the row.
  static const double focusOffsetRow = -3;

  /// Ring offset inside the selected and unselected selector options.
  static const double focusOffsetSelector = -3;

  /// Ring offset around the Standings leader row (outside the inverse plane).
  static const double focusOffsetLeaderRow = 2;

  /// GP classification team-link ring, inside the link (LT-17, both themes).
  static const double focusOffsetTeamLink = -2;

  /// Home Explore links' ring, inside the link (XT-1, these links only).
  static const double focusOffsetHomeExplore = -4;

  /// Bottom-navigation tabs' ring, inside the tab (Step 55B.2.1, navigation
  /// only; owner review pending). −2 is the smallest inward offset that keeps
  /// the whole 2px ring inside the tab, so it stays on screen with a zero
  /// bottom inset and inside the bar's side padding (XS-31 stays open).
  static const double focusOffsetNavTab = -2;
}
