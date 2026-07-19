import 'package:flutter/widgets.dart';

/// Responsive content sizing. Default screen padding is 20 horizontal
/// (GridView_UI_UX_Design.md section 9.2); wide screens cap content width.
abstract final class GvLayout {
  static const double screenPaddingHorizontal = 20;
  static const double sectionSpacing = 20;

  /// Content is capped so a phone-first single column does not stretch on
  /// larger widths.
  static const double maxContentWidth = 560;

  static const EdgeInsets screenPadding = EdgeInsets.symmetric(
    horizontal: screenPaddingHorizontal,
  );

  /// A "narrow phone" breakpoint used by the catalogue and overflow-safe
  /// layouts.
  static const double narrowPhoneWidth = 320;
}
