import 'package:flutter/widgets.dart';

/// Primer V2 raw colour values: layer 1 of the five-layer model.
///
/// Source: `design-exploration/prototypes/primer-v2/CROSS-THEME-TOKEN-MAP.md`
/// §1 (frozen, DD XT-6), which takes every value from the frozen role
/// documents (`DARK-THEME-ROLES.md` DK-1 to DK-6, `LIGHT-THEME-ROLES.md` LT-1
/// to LT-18). No other Primer V2 colour literal exists.
///
/// These are the only Primer V2 literals and they carry **no role**: a widget
/// never reads this class. It asks `context.gvPrimer` for a role and receives
/// the value of the active theme (and, later, of its surface scope).
///
/// Deliberately absent:
/// - `#B04633`, the start stop of the three retained decorative gradients. It
///   is a contextual value that lives only inside `GvPrimerEffects` (DK-6,
///   LT-10) and must never become a shared token.
/// - The Dark lighting values (`#2A2C31`, `#202226`, `#1A1B1F`, `#1B1D20`),
///   which exist only inside decorative effects.
///
/// Primer V2 replaces the legacy `GvColors` / `GvColorsLight` palette (XS-28).
/// Until every screen migrates, both palettes coexist; the legacy one still
/// drives everything that is rendered today.
abstract final class GvPrimerPalette {
  /// Dark `ground-low`: the sunken bottom-navigation base.
  static const Color graphite950 = Color(0xFF101113);

  /// Dark `ground` (page); Light primary text and inverse surface.
  static const Color graphite900 = Color(0xFF141518);

  /// Dark `tray` (bands); Light `inverse-low` and the GP heading band.
  static const Color graphite800 = Color(0xFF1F2125);

  /// Dark `raised`.
  static const Color graphite700 = Color(0xFF2A2D32);

  /// Dark `on-chalk-2`; Light secondary text.
  static const Color slate600 = Color(0xFF4F525A);

  /// Dark secondary text; Light `on-inverse-2`.
  static const Color slate400 = Color(0xFFA9ABB1);

  /// Chalk: Dark primary text and inverse surface; Light `on-inverse`.
  static const Color chalk100 = Color(0xFFECEAE5);

  /// End stop of the Dark inverse-surface gradient.
  static const Color chalk200 = Color(0xFFE2DFD8);

  /// Light page (LT-2).
  static const Color neutralLightPage = Color(0xFFEBECEE);

  /// Light band (LT-2).
  static const Color neutralLightBand = Color(0xFFF7F7F8);

  /// Light card: the elevated Home Grand Prix hero card **only** (LT-2).
  static const Color neutralLightCard = Color(0xFFFFFFFF);

  /// Light raised (LT-2).
  static const Color neutralLightRaised = Color(0xFFDCDDE1);

  /// Red Oxide: brand surface in both themes; Light accent.
  static const Color oxide600 = Color(0xFFA03E2B);

  /// End stop of the retained decorative brand gradient only (DK-6). No flat
  /// role of its own.
  static const Color oxide700 = Color(0xFF7A2E21);

  /// Ember: Dark accent and focus; Light only inside Graphite panels and Live.
  static const Color ember400 = Color(0xFFF08A6C);

  /// Every primitive, in the order of the token map. Used by tests to prove
  /// the palette holds exactly the 15 approved values.
  static const List<Color> all = <Color>[
    graphite950,
    graphite900,
    graphite800,
    graphite700,
    slate600,
    slate400,
    chalk100,
    chalk200,
    neutralLightPage,
    neutralLightBand,
    neutralLightCard,
    neutralLightRaised,
    oxide600,
    oxide700,
    ember400,
  ];
}
