import 'package:flutter/material.dart';

import '../theme/gv_semantic_colors.dart';
import '../theme/tokens/tokens.dart';

/// Visual tone of a status chip. The design system does not know about domain
/// enums; feature code maps its own states (e.g. EventStatus) onto a tone.
enum GvStatusTone { neutral, info, live, success, warning }

/// A compact status pill. Meaning is carried by the text label (a coloured dot
/// only reinforces it), so information is never conveyed by colour alone.
class GvStatusChip extends StatelessWidget {
  const GvStatusChip({
    super.key,
    required this.label,
    this.tone = GvStatusTone.neutral,
  });

  final String label;
  final GvStatusTone tone;

  Color _toneColor(BuildContext context) {
    final GvSemanticColors colors = context.gvColors;
    return switch (tone) {
      GvStatusTone.neutral => colors.textMuted,
      GvStatusTone.info => colors.info,
      GvStatusTone.live => GvColors.accentPrimary,
      GvStatusTone.success => colors.success,
      GvStatusTone.warning => colors.warning,
    };
  }

  @override
  Widget build(BuildContext context) {
    final Color toneColor = _toneColor(context);
    return Semantics(
      label: label,
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: GvSpacing.sm,
            vertical: GvSpacing.xxs,
          ),
          decoration: const BoxDecoration(
            color: GvColors.surfaceElevatedAlt,
            borderRadius: GvRadii.pillAll,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: toneColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: GvSpacing.xs),
              // Flexible + ellipsis so a long label (or large text scaling)
              // shrinks within a constrained parent instead of overflowing.
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  softWrap: false,
                  overflow: TextOverflow.ellipsis,
                  style: GvTypography.label.copyWith(
                    color: GvColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
