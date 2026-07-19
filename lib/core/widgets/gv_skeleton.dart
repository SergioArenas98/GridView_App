import 'package:flutter/material.dart';

import '../theme/tokens/tokens.dart';

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
          color: GvColors.surfaceElevatedAlt,
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
      decoration: const BoxDecoration(
        color: GvColors.surfaceElevated,
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
