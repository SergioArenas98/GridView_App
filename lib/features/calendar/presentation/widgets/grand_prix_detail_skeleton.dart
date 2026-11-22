import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';

/// The Grand Prix Detail loading placeholder (`gpd.css` `.skel`, states
/// frame 1; Step 55C.12): 12px from the app bar, a full-width 212px band
/// block between `line.subtle` hairlines, a 120 × 18 label and three 48px
/// rows on the gutter; static (no motion), announced once as loading.
///
/// Spacing is the flex column's 8px gap plus each shape's own margins
/// (block 20px below, label 6px below), so 28px from the block to the
/// label, 14px from the label to the first row, 8px between rows and 8px
/// under the last. The placeholder colours are the theme's, never the
/// Graphite band's (LT-16), so the Light skeleton stays light.
class GrandPrixDetailSkeleton extends StatelessWidget {
  const GrandPrixDetailSkeleton({super.key});

  /// `.skel__hero` height.
  static const double blockHeight = 212;

  /// `.skel__row--48` height.
  static const double rowHeight = 48;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).themeRoles;
    final BorderSide hairline = BorderSide(color: roles.line.subtle);
    const Widget row = Padding(
      padding: EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
      child: GvPrimerSkeleton(height: rowHeight),
    );
    return GvPrimerLoading(
      semanticLabel: AppLocalizations.of(context).a11yLoading,
      child: ListView(
        key: const ValueKey<String>('gp-detail-skeleton'),
        padding: const EdgeInsets.only(top: 12, bottom: 8),
        physics: const NeverScrollableScrollPhysics(),
        children: <Widget>[
          DecoratedBox(
            position: DecorationPosition.foreground,
            decoration: BoxDecoration(
              border: Border(top: hairline, bottom: hairline),
            ),
            child: const GvPrimerSkeleton(
              height: blockHeight,
              width: double.infinity,
              radius: 0,
            ),
          ),
          const SizedBox(height: 28),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
            child: Align(
              alignment: Alignment.centerLeft,
              child: GvPrimerSkeleton(height: 18, width: 120, radius: 4),
            ),
          ),
          const SizedBox(height: 14),
          row,
          const SizedBox(height: 8),
          row,
          const SizedBox(height: 8),
          row,
        ],
      ),
    );
  }
}
