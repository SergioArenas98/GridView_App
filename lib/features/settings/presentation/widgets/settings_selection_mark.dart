import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/gv_primer_icons.dart';
import '../../../../core/widgets/gv_primer_livery_cut.dart';

/// The Settings selection mark (`settings.css` `.mark`): one 12°
/// parallelogram, the livery cut ([GvLiveryCut]) skewed about its centre, so
/// the root and the option screens read as one system (token map §4.12).
///
/// - [SettingsSelectionMark.option] (26 × 20): unselected = a 2px
///   `text.secondary` outline, radius 3; selected = `mark.selected` fill and
///   a 16px `mark.on` check (stroke 3.25). Selection is never colour alone:
///   shape fill, check and the label's weight change together.
/// - [SettingsSelectionMark.value] (10 × 14): the small filled
///   `mark.selected` mark before a current value on the root, radius 1.5.
///
/// Sizes are fixed logical pixels (CSS `px`), as in the prototype. The mark
/// is decorative: the row or option carries the meaning in semantics.
class SettingsSelectionMark extends StatelessWidget {
  const SettingsSelectionMark.option({super.key, required this.selected})
    : _small = false;

  const SettingsSelectionMark.value({super.key})
    : selected = true,
      _small = true;

  final bool selected;
  final bool _small;

  /// `.mark` box.
  static const Size optionSize = Size(26, 20);

  /// `.mark--sm` box.
  static const Size valueSize = Size(10, 14);

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final Size size = _small ? valueSize : optionSize;
    return ExcludeSemantics(
      child: SizedBox.fromSize(
        size: size,
        child: CustomPaint(
          painter: _MarkPainter(
            filled: selected,
            fill: roles.fill.mark.fill,
            outline: roles.text.secondary,
            radius: _small ? 1.5 : 3,
          ),
          child: _small || !selected
              ? null
              : Center(
                  child: GvPrimerIcon(
                    GvPrimerGlyph.check,
                    size: 16,
                    color: roles.fill.mark.on,
                    strokeWidth: 3.25,
                  ),
                ),
        ),
      ),
    );
  }
}

class _MarkPainter extends CustomPainter {
  const _MarkPainter({
    required this.filled,
    required this.fill,
    required this.outline,
    required this.radius,
  });

  final bool filled;
  final Color fill;
  final Color outline;
  final double radius;

  /// `.mark::before { border: 2px }` (none on the small mark).
  static const double _border = 2;

  @override
  void paint(Canvas canvas, Size size) {
    final Rect box = Offset.zero & size;
    if (filled) {
      // Selected: background and border both `mark.selected`, so the fill
      // covers the whole box.
      canvas.drawPath(
        GvLiveryCut(radius: radius).getOuterPath(box),
        Paint()
          ..color = fill
          ..isAntiAlias = true,
      );
      return;
    }
    // The CSS border sits inside the box: stroke its centre line, 1px in.
    canvas.drawPath(
      GvLiveryCut(
        radius: radius - _border / 2,
      ).getOuterPath(box.deflate(_border / 2)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = _border
        ..color = outline
        ..isAntiAlias = true,
    );
  }

  @override
  bool shouldRepaint(_MarkPainter oldDelegate) =>
      oldDelegate.filled != filled ||
      oldDelegate.fill != fill ||
      oldDelegate.outline != outline ||
      oldDelegate.radius != radius;
}
