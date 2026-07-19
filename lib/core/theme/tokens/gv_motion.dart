import 'package:flutter/animation.dart';

/// Animation durations and curves. Motion is short and confident
/// (GridView_UI_UX_Design.md section 13).
abstract final class GvMotion {
  static const Duration fast = Duration(milliseconds: 120);
  static const Duration medium = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 320);

  static const Curve standard = Curves.easeInOutCubic;
  static const Curve emphasized = Curves.easeOutCubic;
  static const Curve exit = Curves.easeInCubic;
}
