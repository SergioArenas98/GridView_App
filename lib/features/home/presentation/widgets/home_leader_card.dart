import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../application/home_state.dart';
import '../../domain/home_leader.dart';
import '../home_formatting.dart';

/// One championship-leader module.
///
/// The representable states are distinct and never blurred together:
///
/// - while the standings materialization is still being read the card asserts
///   **nothing**: no leader, no empty result and no unavailability;
/// - a **single confirmed leader** shows the authoritative name, the confirmed
///   points and the team association, and opens that competitor's detail;
/// - **tied leaders** are announced as tied. No competitor is promoted to "the
///   leader" and none of them becomes the primary action — the card opens the
///   complete standings instead;
/// - **no leader yet** — the table is materialized and has simply not produced
///   one — says exactly that, because an available table has answered;
/// - an **unavailable** table, one with no materialized representation for the
///   season, shows controlled localized copy instead.
///
/// The last two both offer the standings action, so the section is never a dead
/// end.
///
/// A stable identifier drives the route and is never displayed; a competitor
/// whose identity is not stored locally is treated as unavailable rather than
/// rendered as a humanised identifier.
class HomeLeaderCard extends StatelessWidget {
  const HomeLeaderCard({
    super.key,
    required this.cardKey,
    required this.championshipLabel,
    required this.module,
    required this.format,
    required this.onOpenStandings,
    this.onOpenEntity,
    this.openEntitySemanticLabel,
  });

  /// A stable widget key so a test can address exactly this module.
  final String cardKey;

  /// The localized championship name, announced before anything else.
  final String championshipLabel;

  final HomeLeaderModule module;
  final HomeFormatter format;

  /// Opens the exact-season standings route for this championship.
  final VoidCallback onOpenStandings;

  /// Opens the leading competitor's detail. Supplied only for a single
  /// confirmed leader with a resolved identity.
  final void Function(String entityId)? onOpenEntity;
  final String Function(String name)? openEntitySemanticLabel;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (module.leader) {
      HomeSingleLeader(
        :final String entityId,
        :final String name,
        :final double points,
        :final String? teamName,
        :final String? teamColor,
        :final bool? provisional,
      ) =>
        _card(
          context: context,
          l10n: l10n,
          accent: GvTeamAccent.parse(teamColor),
          title: name,
          subtitle: teamName,
          value: format.points(points),
          badge: provisional == true ? l10n.standingsProvisionalBadge : null,
          onTap: onOpenEntity == null ? null : () => onOpenEntity!(entityId),
          semanticLabel: <String>[
            championshipLabel,
            name,
            ?teamName,
            l10n.standingsPointsSemantics(format.pointsNumber(points)),
            if (provisional == true) l10n.standingsProvisionalBadge,
          ].join(', '),
          buttonSemanticLabel: openEntitySemanticLabel?.call(name),
        ),
      HomeTiedLeaders(:final List<String> names, :final double? points) =>
        _card(
          context: context,
          l10n: l10n,
          title: l10n.homeTiedLeaders,
          // Only names that are actually stored are summarised; an unresolved
          // identity contributes nothing rather than an identifier.
          subtitle: names.isEmpty ? null : names.join(' · '),
          value: points == null ? null : format.points(points),
          onTap: onOpenStandings,
          semanticLabel: <String>[
            championshipLabel,
            l10n.homeTiedLeaders,
            if (names.isNotEmpty) names.join(', '),
            if (points != null)
              l10n.standingsPointsSemantics(format.pointsNumber(points)),
          ].join(', '),
        ),
      // No leader to name. Which reason applies is a real distinction: a
      // materialized table that has simply not produced a leader yet has
      // answered, and saying its information is unavailable would be false —
      // as would saying either one before the materialization read completes.
      HomeLeaderUnavailable() when module.availability.isResolving =>
        _ResolvingLeader(cardKey: cardKey),
      HomeLeaderUnavailable() => () {
        final String title = module.availability.isUnavailable
            ? l10n.homeLeaderUnavailable
            : l10n.homeNoLeaderYet;
        return _card(
          context: context,
          l10n: l10n,
          title: title,
          onTap: onOpenStandings,
          semanticLabel: '$championshipLabel, $title',
        );
      }(),
    };
  }

  Widget _card({
    required BuildContext context,
    required AppLocalizations l10n,
    required String title,
    required String semanticLabel,
    String? subtitle,
    String? value,
    String? badge,
    Color? accent,
    VoidCallback? onTap,
    String? buttonSemanticLabel,
  }) {
    return Semantics(
      button: onTap != null,
      label: buttonSemanticLabel == null
          ? semanticLabel
          : '$semanticLabel, $buttonSemanticLabel',
      child: ExcludeSemantics(
        child: GvContentCard(
          key: ValueKey<String>(cardKey),
          onTap: onTap,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: <Widget>[
              if (accent != null) ...<Widget>[
                Container(
                  width: 4,
                  height: 40,
                  decoration: BoxDecoration(
                    color: accent,
                    borderRadius: GvRadii.pillAll,
                  ),
                ),
                const SizedBox(width: GvSpacing.sm),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: context.gvText.cardTitle,
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: context.gvText.label,
                      ),
                    if (badge != null)
                      Padding(
                        padding: const EdgeInsets.only(top: GvSpacing.xxs),
                        child: GvStatusChip(label: badge),
                      ),
                  ],
                ),
              ),
              if (value != null) ...<Widget>[
                const SizedBox(width: GvSpacing.sm),
                Text(
                  value,
                  style: context.gvText.statValue.copyWith(fontSize: 18),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A championship module whose standings materialization has not been read yet.
///
/// It says nothing at all: naming no leader and calling the table unavailable
/// are both claims about stored state that has not been consulted. The card
/// shell keeps the section's height stable, carries no copy, no semantics
/// beyond the championship name, no action and no animation.
class _ResolvingLeader extends StatelessWidget {
  const _ResolvingLeader({required this.cardKey});

  final String cardKey;

  @override
  Widget build(BuildContext context) => GvContentCard(
    key: ValueKey<String>('$cardKey-resolving'),
    child: Container(
      height: 24,
      decoration: BoxDecoration(
        color: context.gvColors.surfaceElevatedAlt,
        borderRadius: GvRadii.smAll,
      ),
    ),
  );
}
