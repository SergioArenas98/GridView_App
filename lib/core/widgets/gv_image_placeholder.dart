import 'package:flutter/material.dart';

import '../theme/tokens/tokens.dart';

/// A layout-reserving placeholder shown where a remote image will render. It
/// keeps the aspect ratio so content does not shift when the image loads.
class GvImagePlaceholder extends StatelessWidget {
  const GvImagePlaceholder({
    super.key,
    this.aspectRatio = 1,
    this.icon = Icons.image_outlined,
    this.borderRadius = GvRadii.mdAll,
    this.semanticLabel,
  });

  final double aspectRatio;
  final IconData icon;
  final BorderRadius borderRadius;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticLabel,
      image: true,
      child: AspectRatio(
        aspectRatio: aspectRatio,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: GvColors.surfaceElevatedAlt,
            borderRadius: borderRadius,
          ),
          child: Center(
            child: Icon(
              icon,
              size: GvIconSizes.xl,
              color: GvColors.textDisabled,
            ),
          ),
        ),
      ),
    );
  }
}
