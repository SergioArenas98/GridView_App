import 'package:flutter/material.dart';

import '../theme/theme.dart';

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
      color: context.gvColors.surfaceElevated,
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
        color: context.gvColors.surfaceElevatedAlt,
        child: Stack(
          children: <Widget>[
            if (background != null) Positioned.fill(child: background!),
            // The scrim fades the image toward the page background so the hero's
            // text always has a readable base. Both stops come from the theme:
            // a hardcoded dark scrim would render the light theme's dark text
            // dark-on-dark.
            if (background != null)
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: <Color>[
                        context.gvColors.heroScrimTop,
                        context.gvColors.heroScrimBottom,
                      ],
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
            style: context.gvText.label,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: GvSpacing.xs),
          Text(value, style: context.gvText.statValue),
          if (caption != null) ...<Widget>[
            const SizedBox(height: GvSpacing.xxs),
            Text(
              caption!,
              style: context.gvText.caption,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}
