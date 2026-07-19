import 'package:flutter/material.dart';

import '../theme/tokens/tokens.dart';

/// A reserved, layout-stable advertisement slot. It performs **no** ad SDK
/// initialization or network work — it only reserves space so that real ad
/// integration (a later phase) cannot cause layout shift. The label marks it
/// clearly as an ad placeholder.
class GvAdContainer extends StatelessWidget {
  const GvAdContainer({
    super.key,
    this.height = 64,
    this.label = 'Advertisement',
  });

  final double height;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      container: true,
      child: Container(
        height: height,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: GvColors.surface,
          borderRadius: GvRadii.mdAll,
          border: Border.all(color: GvColors.divider),
        ),
        child: Text(
          label,
          style: GvTypography.caption.copyWith(color: GvColors.textDisabled),
        ),
      ),
    );
  }
}
