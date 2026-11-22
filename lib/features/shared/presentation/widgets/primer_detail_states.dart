import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';

/// A full-page Primer V2 detail message (season unavailable, not found,
/// first-load error) in the detail size of the shared empty block, inside
/// its own scroll view so 200% text never overflows. Retry, when offered, is
/// the inverse pill button with the Driver/Team/Circuit hover (XS-09).
/// Shared by Driver, Team and Circuit Detail (extracted in Step 55C.10;
/// Circuit since Step 55C.11).
class PrimerDetailMessage extends StatelessWidget {
  const PrimerDetailMessage({
    super.key,
    required this.glyph,
    required this.title,
    required this.message,
    this.retryLabel,
    this.onRetry,
  });

  final GvPrimerGlyph glyph;
  final String title;
  final String message;
  final String? retryLabel;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
      children: <Widget>[
        GvPrimerEmptyState(
          glyph: glyph,
          title: title,
          message: message,
          action: retryLabel == null
              ? null
              : Align(
                  alignment: Alignment.centerLeft,
                  child: GvPrimerButton(
                    label: retryLabel!,
                    onPressed: onRetry,
                    hover: true,
                  ),
                ),
        ),
      ],
    );
  }
}

/// The Primer V2 detail loading placeholder shared by Driver (`dd.css`
/// `.skel`) and Team Detail (`td.css` `.skel`): a full-width heading block,
/// a 140 × 18 label and three 72px rows, static (no motion), announced once
/// as loading. The screens differ only in the heading block: its height
/// ([blockHeight]: Driver plate 176, Team banner 168) and whether a hairline
/// closes it ([blockDivider]: the Driver plate's bottom border).
class PrimerDetailSkeleton extends StatelessWidget {
  const PrimerDetailSkeleton({
    super.key,
    required this.blockHeight,
    this.blockDivider = false,
    this.listKey,
  });

  final double blockHeight;
  final bool blockDivider;

  /// The key of the skeleton's list (`driver-detail-skeleton`,
  /// `team-detail-skeleton`).
  final Key? listKey;

  /// Row height (`.skel__row`).
  static const double rowHeight = 72;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final Widget block = GvPrimerSkeleton(
      height: blockHeight,
      width: double.infinity,
      radius: 0,
    );
    return GvPrimerLoading(
      semanticLabel: AppLocalizations.of(context).a11yLoading,
      child: ListView(
        key: listKey,
        padding: const EdgeInsets.only(bottom: 8),
        physics: const NeverScrollableScrollPhysics(),
        children: <Widget>[
          if (blockDivider)
            Stack(
              children: <Widget>[
                block,
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 1,
                  child: ColoredBox(color: roles.line.subtle),
                ),
              ],
            )
          else
            block,
          // The 24px margin plus the 8px column gap.
          const SizedBox(height: 32),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
            child: Align(
              alignment: Alignment.centerLeft,
              child: GvPrimerSkeleton(height: 18, width: 140, radius: 4),
            ),
          ),
          // The 6px margin plus the 8px gap.
          const SizedBox(height: 14),
          for (int i = 0; i < 3; i++) ...<Widget>[
            if (i > 0) const SizedBox(height: 8),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
              child: GvPrimerSkeleton(height: rowHeight),
            ),
          ],
        ],
      ),
    );
  }
}
