import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/domain/entities/grand_prix.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../application/home_state.dart';
import '../../domain/home_temporal_state.dart';
import '../home_formatting.dart';
import '../home_status_kinds.dart';
import 'home_primer_parts.dart';

/// The featured Grand Prix (`refinement-01` `.hero`, B Motorsport Light).
///
/// Dark: the lit Graphite panel. Light: the white card with the Graphite
/// action strip. Both carry the oxide round block cut at 12° (DK-6 / LT-10
/// gradient), the phase label, the relative start, the status chips, the
/// condensed event name (the screen's identity heading), the circuit and
/// location line, and the "View Grand Prix" row. The whole panel opens the
/// Grand Prix; only the row is focusable and announced as the link.
///
/// Every line comes from values that exist: nothing is rendered for a missing
/// circuit, location, date or start time, and no imagery is part of the
/// approved composition.
class HomeHero extends StatelessWidget {
  const HomeHero({
    super.key,
    required this.module,
    required this.format,
    required this.now,
    required this.onOpen,
  });

  final HomeEventModule module;
  final HomeFormatter format;
  final DateTime now;
  final VoidCallback onOpen;

  /// The panel is narrow at or below 21em of its content width
  /// (`@container hero (max-width: 21em)`).
  static const double narrowEm = 21;

  static const double _pad = 18;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final GrandPrix event = module.focus.grandPrix;
    final String? relative = format.relativeStart(module.sessionFocus, now);
    final bool dark = roles.brightness == Brightness.dark;

    final List<GvPrimerStatusLabel> chips = <GvPrimerStatusLabel>[
      if (module.phase == HomeTemporalPhase.raceWeekend)
        GvPrimerStatusLabel(l10n.homeRaceWeekend, GvPrimerChipKind.context),
      GvPrimerStatusLabel(
        requiredEventStatusLabel(l10n, event.status),
        homeEventStatusKind(event.status),
      ),
      if (event.format == WeekendFormat.sprint)
        GvPrimerStatusLabel(
          weekendFormatLabel(l10n, WeekendFormat.sprint),
          GvPrimerChipKind.context,
        ),
    ];

    final Widget lead = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Semantics(
          header: true,
          child: Text(
            format.heroTitle(module.phase),
            style: homeTextStyle(
              weight: 600,
              height: 1.3,
              color: roles.text.secondary,
            ),
          ),
        ),
        if (relative != null) ...<Widget>[
          const SizedBox(height: 4),
          HomeReadable(
            child: HomeDisplayText(
              relative,
              size: 22,
              cap: 34,
              weight: 750,
              width: 88,
              height: 1.06,
              tracking: -0.015,
              color: roles.text.accent,
            ),
          ),
          const SizedBox(height: 4),
        ],
        const SizedBox(height: 4),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: <Widget>[
            for (final GvPrimerStatusLabel chip in chips)
              GvPrimerStatusChip(label: chip.label, kind: chip.kind),
          ],
        ),
        const SizedBox(height: 2),
      ],
    );

    return HomeStretchedLink(
      key: const ValueKey<String>('home-hero-open'),
      onOpen: onOpen,
      ringGeometry: const GvPrimerFocusGeometry(
        offset: GvPrimerMetrics.focusOffsetDefault,
        radius: GvPrimerLayout.radiusLg,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GvPrimerLayout.radiusLg),
          boxShadow: dark ? _darkPanelShadow : _lightCardShadow,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(GvPrimerLayout.radiusLg),
          child: DecoratedBox(
            decoration: dark
                ? const BoxDecoration(gradient: _darkPanelBase)
                : BoxDecoration(color: roles.surface.card),
            // The glow and the 1px top highlight sit between the base and
            // the content (background decorations nest outside-in).
            child: DecoratedBox(
              decoration: dark
                  ? const BoxDecoration(
                      gradient: _darkPanelLight,
                      border: Border(top: BorderSide(color: _darkPanelEdge)),
                    )
                  : const BoxDecoration(),
              child: LayoutBuilder(
                builder: (BuildContext context, BoxConstraints constraints) {
                  final TextScaler scaler = MediaQuery.textScalerOf(context);
                  final bool narrow =
                      constraints.maxWidth - 2 * _pad <=
                      GvPrimerLayout.containerEm(scaler, narrowEm);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      if (narrow) ...<Widget>[
                        _RoundBlock(round: event.round, narrow: true),
                        const SizedBox(height: 14),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: _pad),
                          child: lead,
                        ),
                      ] else
                        IntrinsicHeight(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: <Widget>[
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    _pad,
                                    _pad,
                                    0,
                                    0,
                                  ),
                                  child: Align(
                                    alignment: Alignment.topLeft,
                                    child: lead,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              _RoundBlock(round: event.round, narrow: false),
                            ],
                          ),
                        ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(_pad, 12, _pad, 0),
                        child: _identity(context, roles, event),
                      ),
                      const SizedBox(height: 12),
                      _ActionRow(label: l10n.homeOpenGrandPrix),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _identity(BuildContext context, GvPrimerRoles roles, GrandPrix event) {
    final String? line = _locationLine(event);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        // The event name is the screen's primary identity heading.
        Semantics(
          header: true,
          child: HomeDisplayText(
            event.name,
            size: 30,
            cap: 42,
            weight: 800,
            width: 78,
            height: 1.02,
            tracking: -0.02,
            color: roles.text.primary,
          ),
        ),
        if (line != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: HomeReadable(
              child: Text(
                line,
                style: homeTextStyle(color: roles.text.secondary),
              ),
            ),
          ),
      ],
    );
  }

  /// The circuit / location / dates line, assembled only from present values
  /// (`shared-reference-data.md` H06–H09: missing parts drop with their
  /// separator).
  String? _locationLine(GrandPrix event) {
    final List<String> place = <String>[
      ?module.focus.circuit?.locality,
      ?module.focus.circuit?.country,
    ];
    final List<String> parts = <String>[
      ?module.focus.circuit?.name,
      if (place.isNotEmpty) place.join(', '),
      ?format.dateRange(event.startDate, event.endDate),
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  // Dark lit panel (`DARK-THEME-ROLES.md` `effect.*`; token map §5): Dark
  // lighting values inside an effect, never roles, like `#B04633`.
  static const Color _litTop = Color(0xFF202226);
  static const Color _litBottom = Color(0xFF1A1B1F);
  static const Color _litGlow = Color(0xFF2A2C31);

  /// `linear-gradient(180deg, #202226 0%, #1A1B1F 100%)`.
  static const LinearGradient _darkPanelBase = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: <Color>[_litTop, _litBottom],
  );

  /// `radial-gradient(120% 90% at 0% 0%, #2A2C31 0%, transparent 60%)`,
  /// approximated by a circular radial gradient from the top-left corner.
  static const RadialGradient _darkPanelLight = RadialGradient(
    center: Alignment.topLeft,
    radius: 1.2,
    colors: <Color>[_litGlow, Color(0x002A2C31)],
    stops: <double>[0, 0.6],
  );

  /// `inset 0 1px 0 rgba(255, 255, 255, 0.05)`.
  static const Color _darkPanelEdge = Color(0x0DFFFFFF);

  /// `0 22px 40px -24px rgba(0, 0, 0, 0.8)`.
  static const List<BoxShadow> _darkPanelShadow = <BoxShadow>[
    BoxShadow(
      color: Color(0xCC000000),
      offset: Offset(0, 22),
      blurRadius: 40,
      spreadRadius: -24,
    ),
  ];

  /// Light card shadow (`LIGHT-THEME-ROLES.md` `effect.shadow`): `0 1px 2px`
  /// Graphite 6%, `0 16px 30px -20px` Graphite 30%.
  static final List<BoxShadow> _lightCardShadow = <BoxShadow>[
    BoxShadow(
      color: GvPrimerPalette.graphite900.withValues(alpha: 0.06),
      offset: const Offset(0, 1),
      blurRadius: 2,
    ),
    BoxShadow(
      color: GvPrimerPalette.graphite900.withValues(alpha: 0.30),
      offset: const Offset(0, 16),
      blurRadius: 30,
      spreadRadius: -20,
    ),
  ];
}

/// The round on the oxide livery block. Wide: a column flush with the panel's
/// top-right corner, leading edge cut at 12°. Narrow: a strip across the top,
/// its trailing edge cut at 12° at 78% of the width. Visually "Round" above
/// "23"; read as one phrase ("Round 23" / "Ronda 23").
class _RoundBlock extends StatelessWidget {
  const _RoundBlock({required this.round, required this.narrow});

  final int round;
  final bool narrow;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final Color on = roles.fill.brand.on;
    final ({String before, String after}) parts = homeTemplateParts(
      l10n.roundLabel,
    );
    final TextStyle labelStyle = homeTextStyle(
      weight: 700,
      height: 1.2,
      color: on,
    );
    final Widget number = HomeDisplayText(
      '$round',
      size: narrow ? 68 : 84,
      cap: narrow ? 100 : 112,
      weight: 800,
      width: 125,
      height: 0.8,
      tracking: -0.04,
      tabular: true,
      color: on,
    );
    final List<Widget> words = <Widget>[
      if (parts.before.trim().isNotEmpty)
        Text(parts.before.trim(), style: labelStyle),
    ];
    final List<Widget> trailing = <Widget>[
      if (parts.after.trim().isNotEmpty)
        Text(parts.after.trim(), style: labelStyle),
    ];

    final Widget content = narrow
        ? Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 10),
            child: Wrap(
              spacing: 10,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.end,
              children: <Widget>[...words, number, ...trailing],
            ),
          )
        : Padding(
            padding: const EdgeInsets.fromLTRB(28, 14, 18, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                for (final Widget w in words) ...<Widget>[
                  w,
                  const SizedBox(height: 6),
                ],
                number,
                ...trailing,
              ],
            ),
          );

    return Semantics(
      container: true,
      label: l10n.roundLabel('$round'),
      child: ExcludeSemantics(
        child: CustomPaint(
          painter: _RoundBlockPainter(
            narrow: narrow,
            dark: roles.brightness == Brightness.dark,
          ),
          child: content,
        ),
      ),
    );
  }
}

/// Paints the brand-gradient block (`.hero__round::before`), skewed −12°
/// about its bottom-left corner as the CSS does, so both slanted edges lean
/// "/". Wide: the box runs from the block's left edge to 40px past its right
/// edge (clipped by the panel). Narrow: from 60px before the panel's left edge
/// to 78% of its width.
class _RoundBlockPainter extends CustomPainter {
  const _RoundBlockPainter({required this.narrow, required this.dark});

  final bool narrow;
  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    final Rect box = narrow
        ? Rect.fromLTRB(-60, 0, size.width * 0.78, size.height)
        : Rect.fromLTRB(0, 0, size.width + 40, size.height);
    final double run = GvLiveryCut.runFor(size.height);
    final Path path = Path()
      ..moveTo(box.left + run, box.top)
      ..lineTo(box.right + run, box.top)
      ..lineTo(box.right, box.bottom)
      ..lineTo(box.left, box.bottom)
      ..close();
    // `-10px 0 24px -12px` black 60% (Dark), `-10px 0 24px -14px` Graphite
    // 30% (Light). Depth only.
    final double spread = dark ? 12 : 14;
    canvas.drawPath(
      path.shift(Offset(-10 + spread / 2, 0)),
      Paint()
        ..color = dark
            ? const Color(0x99000000)
            : GvPrimerPalette.graphite900.withValues(alpha: 0.30)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, _sigma(24)),
    );
    canvas.drawPath(
      path,
      Paint()
        ..shader = GvPrimerEffects.brandGradientHero.toGradient().createShader(
          box,
        ),
    );
  }

  static double _sigma(double blur) => math.max(0, blur * 0.57735 + 0.5);

  @override
  bool shouldRepaint(_RoundBlockPainter oldDelegate) =>
      oldDelegate.narrow != narrow || oldDelegate.dark != dark;
}

/// The "View Grand Prix" row: a hairline above it on the Dark panel; in Light
/// the B Motorsport Graphite strip (Dark roles in the strip, so the label is
/// Chalk and the disc is the inverted Chalk disc with a Graphite arrow).
class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles page = GvPrimerSurface.of(context).roles;
    final bool strip = page.brightness == Brightness.light;
    Widget row = Builder(
      builder: (BuildContext context) {
        final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
        return DecoratedBox(
          decoration: BoxDecoration(
            color: strip ? roles.surface.page : null,
            border: Border(
              top: BorderSide(
                color: strip ? roles.surface.page : roles.line.subtle,
              ),
            ),
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 52),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 8, 12, 8),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      label,
                      style: homeTextStyle(
                        weight: 700,
                        height: 1.3,
                        color: roles.text.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const GvPrimerArrowDisc(size: 36),
                ],
              ),
            ),
          ),
        );
      },
    );
    if (strip) {
      row = GvPrimerSurface(kind: GvPrimerSurfaceKind.graphiteBand, child: row);
    }
    return HomeStretchedLinkAnchor(semanticLabel: label, child: row);
  }
}
