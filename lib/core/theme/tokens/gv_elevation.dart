import 'package:flutter/widgets.dart';

import 'gv_colors.dart';

/// Depth on dark surfaces comes mainly from tonal layering; shadows are subtle.
/// Source: GridView_UI_UX_Design.md section 10.
abstract final class GvElevation {
  static const List<BoxShadow> none = <BoxShadow>[];

  static const List<BoxShadow> low = <BoxShadow>[
    BoxShadow(color: Color(0x33000000), blurRadius: 8, offset: Offset(0, 2)),
  ];

  static const List<BoxShadow> medium = <BoxShadow>[
    BoxShadow(color: Color(0x40000000), blurRadius: 16, offset: Offset(0, 6)),
  ];

  static const List<BoxShadow> high = <BoxShadow>[
    BoxShadow(color: Color(0x4D000000), blurRadius: 28, offset: Offset(0, 12)),
  ];

  /// Tonal surface for a given elevation step (0 = base page surface).
  static Color surfaceForStep(int step) => switch (step) {
    <= 0 => GvColors.surface,
    1 => GvColors.surfaceElevated,
    _ => GvColors.surfaceElevatedAlt,
  };
}
