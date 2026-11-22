import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../application/home_state.dart';
import '../../domain/home_leader.dart';
import '../home_formatting.dart';
import 'home_primer_parts.dart';

/// The championship band (`refinement-01` `.champ`): the screen's one inverse
/// plane (Chalk in Dark, Graphite in Light), holding the two leader entries
/// separated by the plane's hairline. The two championships stay independent:
/// their data, failure and freshness never cross.
class HomeChampionshipBand extends StatelessWidget {
  const HomeChampionshipBand({
    super.key,
    required this.driver,
    required this.team,
  });

  final HomeLeaderCard driver;
  final HomeLeaderCard team;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles theme = GvPrimerSurface.of(context).themeRoles;
    final bool dark = theme.brightness == Brightness.dark;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(GvPrimerLayout.radiusLg),
        gradient: theme.surface.inverse.toGradient(),
        boxShadow: dark
            ? _darkBandShadow
            : GvPrimerEffects.inversePlaneShadow(Brightness.light),
      ),
      child: GvPrimerSurface(
        kind: GvPrimerSurfaceKind.inverse,
        child: Builder(
          builder: (BuildContext context) {
            final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  driver,
                  DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: roles.line.subtle)),
                    ),
                    child: team,
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  /// `0 20px 36px -26px rgba(0, 0, 0, 0.9)` (Dark `.champ`). Depth only.
  static const List<BoxShadow> _darkBandShadow = <BoxShadow>[
    BoxShadow(
      color: Color(0xE6000000),
      offset: Offset(0, 20),
      blurRadius: 36,
      spreadRadius: -26,
    ),
  ];
}

/// One championship-leader entry inside [HomeChampionshipBand].
///
/// The representable states stay distinct:
///
/// - while the standings materialization is still being read the entry asserts
///   **nothing**: no leader, no empty result, no unavailability, no figure;
/// - a **single confirmed leader** shows the confirmed points, the 12° oxide
///   seam, the authoritative name and the team, and opens that competitor;
/// - **tied leaders** are announced as tied with the stored names; none is
///   promoted, and the entry opens the complete standings;
/// - **no leader yet** (an available table that names none) and an
///   **unavailable** table each say so in the name position, with no figure.
///
/// Every state keeps the standings link, so the entry is never a dead end. A
/// missing points value is never shown as zero; a stable identifier drives the
/// route and is never displayed.
class HomeLeaderCard extends StatelessWidget {
  const HomeLeaderCard({
    super.key,
    required this.cardKey,
    required this.championshipLabel,
    required this.standingsLabel,
    required this.module,
    required this.format,
    required this.onOpenStandings,
    this.onOpenEntity,
    this.openEntitySemanticLabel,
  });

  /// A stable widget key so a test can address exactly this entry.
  final String cardKey;

  /// The localized championship name, announced before anything else.
  final String championshipLabel;

  /// The standings link label ("View drivers' standings").
  final String standingsLabel;

  final HomeLeaderModule module;
  final HomeFormatter format;
  final VoidCallback onOpenStandings;
  final void Function(String entityId)? onOpenEntity;
  final String Function(String name)? openEntitySemanticLabel;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return Padding(
      padding: const EdgeInsets.only(top: 14, bottom: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Semantics(
            header: true,
            child: Text(
              championshipLabel,
              style: homeTextStyle(
                weight: 600,
                height: 1.3,
                color: roles.text.secondary,
              ),
            ),
          ),
          const SizedBox(height: 4),
          _body(context),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: HomeTextLink(
              label: standingsLabel,
              accent: true,
              expand: true,
              onActivate: onOpenStandings,
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (module.leader) {
      HomeSingleLeader(
        :final String entityId,
        :final String name,
        :final double points,
        :final String? teamName,
        :final bool? provisional,
      ) =>
        _target(
          semanticLabel: <String>[
            name,
            ?teamName,
            l10n.standingsPointsSemantics(format.pointsNumber(points)),
            if (provisional == true) l10n.standingsProvisionalBadge,
            ?openEntitySemanticLabel?.call(name),
          ].join(', '),
          onTap: onOpenEntity == null ? null : () => onOpenEntity!(entityId),
          child: _LeaderBody(
            points: format.pointsNumber(points),
            unit: homeTemplateParts(l10n.homePointsValue).after.trim(),
            name: name,
            detail: teamName,
            badge: provisional == true ? l10n.standingsProvisionalBadge : null,
          ),
        ),
      HomeTiedLeaders(:final List<String> names, :final double? points) =>
        _target(
          semanticLabel: <String>[
            l10n.homeTiedLeaders,
            if (names.isNotEmpty) names.join(', '),
            if (points != null)
              l10n.standingsPointsSemantics(format.pointsNumber(points)),
          ].join(', '),
          onTap: onOpenStandings,
          child: _LeaderBody(
            points: points == null ? null : format.pointsNumber(points),
            unit: homeTemplateParts(l10n.homePointsValue).after.trim(),
            name: l10n.homeTiedLeaders,
            // Only stored names are summarised; an unresolved identity
            // contributes nothing rather than an identifier.
            detail: names.isEmpty ? null : names.join(' · '),
          ),
        ),
      HomeLeaderUnavailable() when module.availability.isResolving => SizedBox(
        key: ValueKey<String>('$cardKey-resolving'),
        height: 36,
      ),
      HomeLeaderUnavailable() => () {
        final String title = module.availability.isUnavailable
            ? l10n.homeLeaderUnavailable
            : l10n.homeNoLeaderYet;
        return _target(
          semanticLabel: title,
          onTap: onOpenStandings,
          child: _LeaderBody(name: title, unit: '', muted: true),
        );
      }(),
    };
  }

  Widget _target({
    required String semanticLabel,
    required VoidCallback? onTap,
    required Widget child,
  }) => GvPrimerFocusTarget(
    key: ValueKey<String>(cardKey),
    onActivate: onTap,
    role: GvPrimerTargetRole.link,
    semanticLabel: semanticLabel,
    child: ExcludeSemantics(
      // A one-line state message still gets a full 48dp target.
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: GvPrimerLayout.minTarget),
        child: Align(alignment: AlignmentDirectional.bottomStart, child: child),
      ),
    ),
  );
}

/// Points, unit, seam, name and detail (`.leader__body`). The points and the
/// holder sit side by side and wrap onto two lines when fewer than 8em remain
/// for the holder (`flex: 1 1 8em`); without a figure the holder stands alone,
/// with no seam.
class _LeaderBody extends StatelessWidget {
  const _LeaderBody({
    required this.name,
    required this.unit,
    this.points,
    this.detail,
    this.badge,
    this.muted = false,
  });

  final String? points;
  final String unit;
  final String name;
  final String? detail;
  final String? badge;

  /// A state message rather than a name ("No leader yet").
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final Widget who = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (muted)
          Text(
            name,
            style: homeTextStyle(
              size: 17,
              weight: 700,
              height: 1.3,
              color: roles.text.primary,
            ),
          )
        else
          HomeDisplayText(
            name,
            size: 24,
            cap: 34,
            weight: 800,
            width: 84,
            height: 1.08,
            tracking: -0.015,
            color: roles.text.primary,
          ),
        if (detail case final String text)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              text,
              style: homeTextStyle(color: roles.text.secondary),
            ),
          ),
        if (badge case final String word)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: GvPrimerStatusChip(
              label: word,
              kind: GvPrimerChipKind.known,
              size: GvPrimerChipSize.small,
            ),
          ),
      ],
    );
    final String? figure = points;
    if (figure == null) {
      return Padding(padding: const EdgeInsets.only(bottom: 2), child: who);
    }
    final TextStyle numberStyle = homeDisplayStyle(
      scaler,
      size: 60,
      cap: 80,
      weight: 850,
      width: 112,
      height: 0.82,
      tracking: -0.045,
      tabular: true,
    ).copyWith(color: roles.text.primary);
    final TextSpan pointsSpan = TextSpan(
      children: <InlineSpan>[
        TextSpan(text: figure, style: numberStyle),
        if (unit.isNotEmpty)
          TextSpan(
            text: ' $unit',
            style: homeTextStyle(
              size: scaler.scale(15),
              weight: 700,
              height: 1,
              color: roles.text.secondary,
            ),
          ),
      ],
    );
    // Wraps the unit under the figure when even the stacked line is too
    // narrow (Spanish "460,5 pts" at 320 @200%), rather than clipping it.
    final Widget pointsBlock = Text.rich(
      pointsSpan,
      textScaler: TextScaler.noScaling,
    );
    final Widget seamed = CustomPaint(
      painter: _SeamPainter(roles.fill.brand.fill),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 2, 0, 2),
        child: who,
      ),
    );
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final TextPainter measure = TextPainter(
          text: pointsSpan,
          textDirection: Directionality.of(context),
          textScaler: TextScaler.noScaling,
        )..layout();
        final double remaining = constraints.maxWidth - measure.width - 12;
        measure.dispose();
        // `flex: 1 1 8em` (border-box, so the seam padding is included).
        final bool stacked = remaining < GvPrimerLayout.containerEm(scaler, 8);
        if (stacked) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[pointsBlock, const SizedBox(height: 8), seamed],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            pointsBlock,
            const SizedBox(width: 12),
            Expanded(child: seamed),
          ],
        );
      },
    );
  }
}

/// The 3px oxide livery seam (`.leader__who::before`): left 10px, from 6px
/// above to 2px below the holder, skewed −12° about its top so the slant
/// grows away from the text. Decoration only.
class _SeamPainter extends CustomPainter {
  const _SeamPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const double left = 10;
    const double top = -6;
    final double bottom = size.height + 2;
    final double run = GvLiveryCut.runFor(bottom - top);
    final Path path = Path()
      ..moveTo(left, top)
      ..lineTo(left + 3, top)
      ..lineTo(left + 3 - run, bottom)
      ..lineTo(left - run, bottom)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_SeamPainter oldDelegate) => oldDelegate.color != color;
}
