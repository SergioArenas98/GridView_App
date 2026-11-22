import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';

/// The related Grand Prix as one row link (`.rx`, CI12–CI16): Grand Prix
/// Detail's identity grammar in miniature (round figure | 12° Red Oxide
/// seam | event name), then the date, the applicable chips and the arrow
/// disc. 14px under the season line, 16px padding on the gutter between
/// `line.subtle` hairlines, at least 96px tall.
///
/// **Wide** (the section wider than 20em of body text): the round column
/// on the left, top-aligned; the seam beside it, as tall as the content
/// but between 48 and 76px; the name and date centred against the 44px
/// disc; the chips 10px below, spanning under the disc. **Narrow** (200%
/// text): round, seam (40–76px) and disc share the first line; the name
/// and date, then the chips, take the full width 14px apart.
///
/// The round is the word of `roundLabel` ("Round" / "Ronda", 13px weight
/// 700, secondary) above its figure (`min(2.75rem, 48px)`, 850, `wdth`
/// 125, −0.05em, line height 0.82, tabular, 6px below, 2px to the left).
/// The name is `min(1.1875rem, 30px)` 800 `wdth` 84; unavailable copy is
/// secondary 650 `wdth` 96 (PD-13a). The date is 14px secondary, 3px below.
///
/// Semantics are the current contract (PD-07 / XS-04 kept open): one button
/// named "Open {name}"; the round, date and chips are not announced. Focus
/// ring 3px inside (rows); hover `state.hover`, pressed `state.pressed.row`.
class CircuitEventRow extends StatelessWidget {
  const CircuitEventRow({
    super.key,
    required this.roundWord,
    required this.round,
    required this.name,
    required this.linkLabel,
    required this.onOpen,
    this.nameUnavailable = false,
    this.date,
    this.statuses = const <GvPrimerStatusLabel>[],
  });

  /// The word of `roundLabel` without the number ("Round").
  final String roundWord;

  /// The round figure ("13").
  final String round;
  final String name;
  final bool nameUnavailable;
  final String? date;
  final List<GvPrimerStatusLabel> statuses;
  final String linkLabel;
  final VoidCallback onOpen;

  /// `min-height: 96px` including the padding.
  static const double minHeight = 96;
  static const double columnGap = 14;

  /// Whether a section [width] wide uses the narrow layout under [scaler]
  /// (`@container rel (max-width: 20em)`).
  static bool isNarrow(double width, TextScaler scaler) =>
      width <= GvPrimerLayout.containerEm(scaler, 20);

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final BorderSide hairline = BorderSide(color: roles.line.subtle);
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final TextScaler scaler = MediaQuery.textScalerOf(context);
        final bool narrow = isNarrow(constraints.maxWidth, scaler);
        return Padding(
          padding: const EdgeInsets.only(top: 14),
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border(top: hairline, bottom: hairline),
            ),
            child: GvPrimerFocusTarget(
              key: const ValueKey<String>('circuit-related-link'),
              onActivate: onOpen,
              semanticLabel: linkLabel,
              geometry: GvPrimerFocusGeometry.row,
              pressedColor: roles.state.pressedRow,
              hoverColor: roles.state.hover,
              child: ExcludeSemantics(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: GvPrimerLayout.gutter,
                    vertical: 16,
                  ),
                  child: narrow ? _narrow(roles, scaler) : _wide(roles, scaler),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _wide(GvPrimerRoles roles, TextScaler scaler) {
    final Widget right = Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(child: _text(roles, scaler)),
            const SizedBox(width: columnGap),
            const GvPrimerArrowDisc(),
          ],
        ),
        if (statuses.isNotEmpty) ...<Widget>[
          const SizedBox(height: 10),
          _chips(),
        ],
      ],
    );
    return IntrinsicHeight(
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: minHeight - 32),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Align(alignment: Alignment.topLeft, child: _round(roles, scaler)),
            const SizedBox(width: columnGap),
            const _Seam(minHeight: 48),
            const SizedBox(width: columnGap),
            Expanded(child: right),
          ],
        ),
      ),
    );
  }

  Widget _narrow(GvPrimerRoles roles, TextScaler scaler) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Align(alignment: Alignment.topLeft, child: _round(roles, scaler)),
              const SizedBox(width: columnGap),
              const _Seam(minHeight: 40),
              const Spacer(),
              const Center(child: GvPrimerArrowDisc()),
            ],
          ),
        ),
        const SizedBox(height: 14),
        _text(roles, scaler),
        if (statuses.isNotEmpty) ...<Widget>[
          const SizedBox(height: 14),
          _chips(),
        ],
      ],
    );
  }

  Widget _round(GvPrimerRoles roles, TextScaler scaler) {
    final double size = GvPrimerTypography.cappedSize(scaler, 44, 48);
    return Column(
      key: const ValueKey<String>('circuit-related-round'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          roundWord,
          style: GvPrimerTypography.archivo(
            size: 13,
            weight: 700,
            height: 1.2,
          ).copyWith(color: roles.text.secondary),
        ),
        const SizedBox(height: 6),
        Transform.translate(
          offset: const Offset(-2, 0),
          child: Text(
            round,
            textScaler: TextScaler.noScaling,
            style: GvPrimerTypography.archivo(
              size: size,
              weight: 850,
              width: 125,
              height: 0.82,
              tabularFigures: true,
            ).copyWith(letterSpacing: -0.05 * size, color: roles.text.primary),
          ),
        ),
      ],
    );
  }

  Widget _text(GvPrimerRoles roles, TextScaler scaler) {
    final double size = GvPrimerTypography.cappedSize(scaler, 19, 30);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          name,
          key: const ValueKey<String>('circuit-related-name'),
          textScaler: TextScaler.noScaling,
          style: nameUnavailable
              ? GvPrimerTypography.archivo(
                  size: size,
                  weight: 650,
                  width: 96,
                  height: 1.15,
                ).copyWith(color: roles.text.secondary)
              : GvPrimerTypography.archivo(
                  size: size,
                  weight: 800,
                  width: 84,
                  height: 1.15,
                ).copyWith(color: roles.text.primary),
        ),
        if (date case final String day) ...<Widget>[
          const SizedBox(height: 3),
          Text(
            day,
            key: const ValueKey<String>('circuit-related-date'),
            style: GvPrimerTypography.archivo(
              size: 14,
              weight: 400,
              height: 1.3,
            ).copyWith(color: roles.text.secondary),
          ),
        ],
      ],
    );
  }

  Widget _chips() => Wrap(
    key: const ValueKey<String>('circuit-related-chips'),
    spacing: 6,
    runSpacing: 6,
    children: <Widget>[
      for (final GvPrimerStatusLabel s in statuses)
        GvPrimerStatusChip(label: s.label, kind: s.kind),
    ],
  );
}

/// The 4px Red Oxide seam (`.rx__seam`), as tall as its row but between
/// [minHeight] and 76px, top-aligned, skewed −12° about its centre.
/// Decorative (contrast 2.80 on the page, as Grand Prix Detail).
class _Seam extends StatelessWidget {
  const _Seam({required this.minHeight});

  final double minHeight;

  static const double width = 4;
  static const double maxHeight = 76;

  @override
  Widget build(BuildContext context) {
    final Color color = GvPrimerSurface.of(context).roles.fill.brand.fill;
    return SizedBox(
      width: width,
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: minHeight,
            maxHeight: maxHeight,
          ),
          child: SizedBox(
            key: const ValueKey<String>('circuit-related-seam'),
            width: width,
            height: double.infinity,
            child: CustomPaint(painter: _SeamPainter(color)),
          ),
        ),
      ),
    );
  }
}

class _SeamPainter extends CustomPainter {
  const _SeamPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final double shift = math.tan(12 * math.pi / 180) * size.height / 2;
    canvas.drawPath(
      Path()
        ..moveTo(shift, 0)
        ..lineTo(size.width + shift, 0)
        ..lineTo(size.width - shift, size.height)
        ..lineTo(-shift, size.height)
        ..close(),
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(_SeamPainter old) => old.color != color;
}
