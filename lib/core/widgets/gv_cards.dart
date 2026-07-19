import 'package:flutter/material.dart';

import '../theme/tokens/tokens.dart';

/// Standard content card: an elevated surface with a child slot.
class GvContentCard extends StatelessWidget {
  const GvContentCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(GvSpacing.md),
    this.onTap,
  });

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final Widget content = Padding(padding: padding, child: child);
    return Material(
      color: GvColors.surfaceElevated,
      borderRadius: GvRadii.lgAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        // When the card is interactive, guarantee a minimum 48px hit area even
        // if the content is short. Non-tappable cards are sized by content.
        child: onTap == null
            ? content
            : ConstrainedBox(
                constraints: const BoxConstraints(
                  minHeight: GvLayout.minTouchTarget,
                ),
                child: content,
              ),
      ),
    );
  }
}

/// Hero card shell for high-value screens: an optional background slot behind a
/// foreground content slot, with a subtle dark overlay for legibility.
class GvHeroCard extends StatelessWidget {
  const GvHeroCard({
    super.key,
    required this.child,
    this.background,
    this.height = 200,
  });

  final Widget child;
  final Widget? background;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: GvRadii.xlAll,
      child: Container(
        constraints: BoxConstraints(minHeight: height),
        color: GvColors.surfaceElevatedAlt,
        child: Stack(
          children: <Widget>[
            if (background != null) Positioned.fill(child: background!),
            if (background != null)
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: <Color>[Color(0x33000000), Color(0xCC0B0D12)],
                    ),
                  ),
                ),
              ),
            Padding(padding: const EdgeInsets.all(GvSpacing.lg), child: child),
          ],
        ),
      ),
    );
  }
}

/// Compact statistic card: a label, a large numeric/stat value and an optional
/// caption.
class GvDataCard extends StatelessWidget {
  const GvDataCard({
    super.key,
    required this.label,
    required this.value,
    this.caption,
  });

  final String label;
  final String value;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    return GvContentCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            label,
            style: GvTypography.label,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: GvSpacing.xs),
          Text(value, style: GvTypography.statValue),
          if (caption != null) ...<Widget>[
            const SizedBox(height: GvSpacing.xxs),
            Text(
              caption!,
              style: GvTypography.caption,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}
