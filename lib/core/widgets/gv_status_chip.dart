import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// Visual tone of a status chip. The design system does not know about domain
/// enums; feature code maps its own states (e.g. EventStatus) onto a tone.
enum GvStatusTone { neutral, info, live, success, warning }

/// The semantic colour for a [GvStatusTone]. Shared so a chip, a row accent and
/// any other status affordance stay visually consistent; meaning is always
/// carried by an accompanying label, never by this colour alone.
Color gvToneColor(BuildContext context, GvStatusTone tone) {
  final GvSemanticColors colors = context.gvColors;
  return switch (tone) {
    GvStatusTone.neutral => colors.textMuted,
    GvStatusTone.info => colors.info,
    GvStatusTone.live => context.gvColors.accentPrimary,
    GvStatusTone.success => colors.success,
    GvStatusTone.warning => colors.warning,
  };
}

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

  @override
  Widget build(BuildContext context) {
    final Color toneColor = gvToneColor(context, tone);
    return Semantics(
      label: label,
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: GvSpacing.sm,
            vertical: GvSpacing.xxs,
          ),
          decoration: BoxDecoration(
            color: context.gvColors.surfaceElevatedAlt,
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
                  style: context.gvText.label.copyWith(
                    color: context.gvColors.textSecondary,
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
