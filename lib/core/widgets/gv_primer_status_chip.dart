import 'package:flutter/material.dart';

import '../theme/gv_primer_role_groups.dart';
import '../theme/gv_primer_roles.dart';
import '../theme/gv_primer_surface.dart';
import '../theme/tokens/gv_primer_metrics.dart';
import '../theme/tokens/gv_primer_typography.dart';
import '../theme/tokens/gv_radii.dart';
import 'gv_primer_icons.dart';
import 'gv_primer_outline.dart';

/// The visual treatment of a Primer V2 status chip (token map §4.7).
///
/// The design system knows no domain enum: feature code maps its own state
/// (event, session, result or finish status, weekend format) onto a kind and
/// supplies the localized word. Every kind exists in the frozen specification
/// and in the application's models; none is invented.
enum GvPrimerChipKind {
  /// Known secondary status, solid `line.status`: Upcoming / Scheduled,
  /// Provisional (word only, no dagger: VS-2 rejected, VS-3), Not available,
  /// DNF, DNS, DSQ, DNQ, Lapped.
  known,

  /// Completed: solid `line.status` with a check icon.
  completed,

  /// Unknown value (event status, format, session, finish): dashed
  /// `line.unknown`, the stronger boundary (VS-1).
  unknown,

  /// Cancelled: solid outline at the unknown alpha with the prototype's "ban"
  /// glyph (top-left → bottom-right diagonal, [GvPrimerGlyph.ban]).
  cancelled,

  /// Postponed: solid outline at the unknown alpha with a "pause" icon.
  postponed,

  /// Final result: filled inverse chip with a check icon (`final.*`).
  finalResult,

  /// Live: Ember fill (`live.*`). LT-7: validated as an isolated specimen
  /// only; contextual validation is pending until an app screen presents it.
  live,

  /// Context ("Sprint weekend", "Standard weekend"): raised fill.
  context,

  /// Fastest lap in a Grand Prix classification (`gpd.css` `.chip--fastest`,
  /// DD G-7): the context chip's raised fill with the prototype's stopwatch
  /// glyph (Step 55C.12). The word carries the meaning; the icon is
  /// decorative.
  fastestLap,
}

/// Chip density.
enum GvPrimerChipSize {
  /// `.chip`: 30px minimum height, 6px × 12px padding.
  regular,

  /// Calendar list rows (`.ev .chip`, "compact chip for list rows"): 26px
  /// minimum height, 4px × 10px padding (Step 55B.3).
  compact,

  /// GP results and the Standings row marker (`chip--sm`): 24px minimum
  /// height, 3px × 8px padding.
  small,
}

/// A Primer V2 status chip.
///
/// The word carries the state; the outline pattern, fill and decorative icon
/// reinforce it, so meaning is never colour alone. Colours come from the
/// surface the chip sits on ([GvPrimerSurface]), so the same chip is correct
/// on the Dark and Light page, inside the inverse plane and inside the Light
/// Graphite band.
///
/// Long labels wrap instead of being clipped (`max-width: 100%`, VS-5), so
/// place the chip in a parent with a bounded width (a `Wrap`, a column).
class GvPrimerStatusChip extends StatelessWidget {
  const GvPrimerStatusChip({
    super.key,
    required this.label,
    required this.kind,
    this.size = GvPrimerChipSize.regular,
  });

  final String label;
  final GvPrimerChipKind kind;
  final GvPrimerChipSize size;

  /// Icon size at 100% text (`.chip .icon--sm`).
  static const double iconSize = 14;

  /// Icon size at 200% text and above (option B, owner-approved in Step
  /// 55B.2.1): the icon's maximum for this component.
  static const double maxIconSize = 18;

  /// The icon size for [scaler]: 14px at 100%, 18px at 200%, linear in the
  /// label's *effective* scale between them and clamped to [14, 18].
  ///
  /// The effective scale is what [scaler] actually does to the 13px label
  /// (`scaler.scale(13) / 13`), so Android's non-linear font scaling, which
  /// enlarges small text more than large text, drives the icon exactly as it
  /// drives the word next to it.
  static double iconSizeFor(TextScaler scaler) {
    final double labelSize = GvPrimerTypography.chipLabel.fontSize!;
    final double factor = scaler.scale(labelSize) / labelSize;
    return (iconSize + (factor - 1) * (maxIconSize - iconSize)).clamp(
      iconSize,
      maxIconSize,
    );
  }

  static const double _regularMinHeight = 30;
  static const double _compactMinHeight = 26;
  static const double _smallMinHeight = 24;
  static const EdgeInsets _regularPadding = EdgeInsets.symmetric(
    horizontal: 12,
    vertical: 6,
  );
  static const EdgeInsets _compactPadding = EdgeInsets.symmetric(
    horizontal: 10,
    vertical: 4,
  );
  static const EdgeInsets _smallPadding = EdgeInsets.symmetric(
    horizontal: 8,
    vertical: 3,
  );

  static Widget _icon(_ChipStyle style, double size) {
    final GvPrimerGlyph? glyph = style.glyph;
    if (glyph != null) {
      return GvPrimerIcon(
        glyph,
        size: size,
        color: style.foreground,
        strokeWidth: GvPrimerIconStroke.small,
      );
    }
    return Icon(style.icon, size: size, color: style.foreground);
  }

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData surface = GvPrimerSurface.of(context);
    final _ChipStyle style = _ChipStyle.resolve(kind, surface);
    final bool small = size == GvPrimerChipSize.small;
    final double borderInset = style.outline == null
        ? 0
        : GvPrimerMetrics.statusOutlineWidth;
    // CSS padding sits inside the border, so an outlined chip adds the stroke.
    final EdgeInsets padding =
        switch (size) {
          GvPrimerChipSize.regular => _regularPadding,
          GvPrimerChipSize.compact => _compactPadding,
          GvPrimerChipSize.small => _smallPadding,
        } +
        EdgeInsets.all(borderInset);

    Widget chip = ConstrainedBox(
      constraints: BoxConstraints(
        minHeight: switch (size) {
          GvPrimerChipSize.regular => _regularMinHeight,
          GvPrimerChipSize.compact => _compactMinHeight,
          GvPrimerChipSize.small => _smallMinHeight,
        },
      ),
      child: Padding(
        padding: padding,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (style.icon != null || style.glyph != null) ...<Widget>[
              _icon(style, iconSizeFor(MediaQuery.textScalerOf(context))),
              SizedBox(width: small ? 4 : 6),
            ],
            Flexible(
              child: Text(
                label,
                softWrap: true,
                style: GvPrimerTypography.chipLabel.copyWith(
                  color: style.foreground,
                ),
              ),
            ),
          ],
        ),
      ),
    );

    if (style.fill != null) {
      chip = DecoratedBox(
        decoration: BoxDecoration(
          color: style.fill,
          borderRadius: GvRadii.smAll,
        ),
        child: chip,
      );
    }
    if (style.outline != null) {
      chip = CustomPaint(
        foregroundPainter: GvPrimerOutlinePainter(
          outline: style.outline!,
          radius: GvRadii.sm,
        ),
        child: chip,
      );
    }

    // One node: the word. The icon and the boundary are decorative.
    return Semantics(
      container: true,
      label: label,
      child: ExcludeSemantics(child: chip),
    );
  }
}

/// The colours and icon of one chip kind on one surface.
class _ChipStyle {
  const _ChipStyle({
    required this.foreground,
    this.fill,
    this.outline,
    this.icon,
    this.glyph,
  });

  final Color foreground;
  final Color? fill;
  final GvPrimerOutline? outline;
  final IconData? icon;

  /// A Primer stroke glyph, used where no Material icon is close enough.
  final GvPrimerGlyph? glyph;

  static _ChipStyle resolve(GvPrimerChipKind kind, GvPrimerSurfaceData s) {
    final GvPrimerRoles roles = s.roles;
    return switch (kind) {
      GvPrimerChipKind.known => _ChipStyle(
        foreground: s.foreground,
        outline: s.statusKnown,
      ),
      GvPrimerChipKind.completed => _ChipStyle(
        foreground: s.foreground,
        outline: s.statusKnown,
        icon: Icons.check_rounded,
      ),
      GvPrimerChipKind.unknown => _ChipStyle(
        foreground: s.foreground,
        outline: s.statusUnknown,
      ),
      GvPrimerChipKind.cancelled => _ChipStyle(
        foreground: s.foreground,
        outline: s.statusAlert,
        glyph: GvPrimerGlyph.ban,
      ),
      GvPrimerChipKind.postponed => _ChipStyle(
        foreground: s.foreground,
        outline: s.statusAlert,
        icon: Icons.pause_circle_outline,
      ),
      GvPrimerChipKind.finalResult => _ChipStyle(
        foreground: roles.fill.finalChip.on,
        fill: roles.fill.finalChip.fill,
        icon: Icons.check_rounded,
      ),
      GvPrimerChipKind.live => _ChipStyle(
        foreground: roles.fill.live.on,
        fill: roles.fill.live.fill,
      ),
      GvPrimerChipKind.context => _ChipStyle(
        foreground: s.foreground,
        fill: roles.surface.raised,
      ),
      GvPrimerChipKind.fastestLap => _ChipStyle(
        foreground: s.foreground,
        fill: roles.surface.raised,
        glyph: GvPrimerGlyph.timer,
      ),
    };
  }
}
