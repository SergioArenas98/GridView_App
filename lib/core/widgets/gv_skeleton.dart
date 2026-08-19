import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// Announces a screen-level loading state once, and silences the shapes below.
///
/// A loading frame is built from many repeated blocks and cards. Each of those
/// is decoration — a screen reader that read one announcement per shape would
/// say "Loading" a dozen times for a single screen. So the announcement lives
/// here, on one live region at the boundary of the loading state, and the whole
/// visual subtree below is excluded from semantics.
///
/// Use it only where a screen (or a screen section) swaps its entire content
/// for a placeholder — never around an individual [GvSkeletonBlock] or
/// [GvSkeletonCard], and never around a remote image slot, whose loading is
/// deliberately not announced.
///
/// Semantics only: it adds no box, no padding and no constraint, so wrapping an
/// existing loading frame cannot move a pixel.
class GvLoadingSemantics extends StatelessWidget {
  const GvLoadingSemantics({
    super.key,
    required this.label,
    required this.child,
  });

  /// The localized announcement, supplied by the caller: the design system is
  /// deliberately localization-agnostic.
  final String label;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      liveRegion: true,
      container: true,
      child: ExcludeSemantics(child: child),
    );
  }
}

/// A pulsing placeholder block used while content loads. Respects the platform
/// reduced-motion setting (renders static when animations are disabled).
class GvSkeletonBlock extends StatefulWidget {
  const GvSkeletonBlock({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = GvRadii.smAll,
  });

  final double? width;
  final double height;
  final BorderRadius borderRadius;

  @override
  State<GvSkeletonBlock> createState() => _GvSkeletonBlockState();
}

class _GvSkeletonBlockState extends State<GvSkeletonBlock>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: GvMotion.slow,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!MediaQuery.disableAnimationsOf(context)) {
      _controller.repeat(reverse: true);
    } else {
      _controller.stop();
      _controller.value = 0.5;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (BuildContext context, Widget? child) {
        final double t = 0.35 + (_controller.value * 0.35);
        return Opacity(opacity: t, child: child);
      },
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: context.gvColors.surfaceElevatedAlt,
          borderRadius: widget.borderRadius,
        ),
      ),
    );
  }
}

/// A skeleton shaped like a standard content card.
class GvSkeletonCard extends StatelessWidget {
  const GvSkeletonCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(GvSpacing.md),
      decoration: BoxDecoration(
        color: context.gvColors.surfaceElevated,
        borderRadius: GvRadii.lgAll,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: const <Widget>[
          GvSkeletonBlock(width: 140, height: 18),
          SizedBox(height: GvSpacing.sm),
          GvSkeletonBlock(height: 12),
          SizedBox(height: GvSpacing.xs),
          GvSkeletonBlock(width: 220, height: 12),
        ],
      ),
    );
  }
}
