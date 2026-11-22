import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';

/// The Circuit Detail loading placeholder (`cd.css` `.skel`, PD-13c): a
/// full-width 232px sheet block, then two groups of a 140 × 18 label and an
/// 88px row, static (no motion), announced once as loading.
///
/// Spacing is the flex column's: 8px gaps plus each shape's own margins,
/// which do not collapse (block 24px below; label 16px above and 6px below;
/// rows on the gutter), so 48px from the block to the first label, 14px
/// from a label to its row, 24px from a row to the next label, and 8px
/// under the last row. The shared `PrimerDetailSkeleton` (Driver and Team:
/// one label, three 72px rows) does not fit this geometry.
class CircuitDetailSkeleton extends StatelessWidget {
  const CircuitDetailSkeleton({super.key});

  /// `.skel__head` height.
  static const double blockHeight = 232;

  /// `.skel__row` height.
  static const double rowHeight = 88;

  @override
  Widget build(BuildContext context) {
    const Widget label = Padding(
      padding: EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
      child: Align(
        alignment: Alignment.centerLeft,
        child: GvPrimerSkeleton(height: 18, width: 140, radius: 4),
      ),
    );
    const Widget row = Padding(
      padding: EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
      child: GvPrimerSkeleton(height: rowHeight),
    );
    return GvPrimerLoading(
      semanticLabel: AppLocalizations.of(context).a11yLoading,
      child: ListView(
        key: const ValueKey<String>('circuit-detail-skeleton'),
        padding: const EdgeInsets.only(bottom: 8),
        physics: const NeverScrollableScrollPhysics(),
        children: const <Widget>[
          GvPrimerSkeleton(
            height: blockHeight,
            width: double.infinity,
            radius: 0,
          ),
          SizedBox(height: 48),
          label,
          SizedBox(height: 14),
          row,
          SizedBox(height: 24),
          label,
          SizedBox(height: 14),
          row,
        ],
      ),
    );
  }
}
