import 'package:flutter/material.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/gv_team_accent.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/domain/entities/season_card.dart';
import '../../shared/presentation/entity_formatting.dart';

/// The three Explore row presentations.
///
/// Each renders a domain read model only — no Drift rows, no DTOs, no Dio — and
/// omits every value the local database does not have, so a missing team leaves
/// no dangling separator, a missing statistic never becomes a false zero, and no
/// stable identifier is ever displayed or turned into a name.
///
/// Media placeholders reserve their layout without requesting a remote image.

/// One driver in the Explore drivers collection.
class ExploreDriverCardRow extends StatelessWidget {
  const ExploreDriverCardRow({super.key, required this.card});

  final SeasonDriverCard card;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = EntityFormatter(
      Localizations.localeOf(context).toString(),
      l10n,
    );

    final String? standing = card.position == null && card.points == null
        ? null
        : EntityFormatter.joinDetails(<String?>[
            card.position == null ? null : fmt.position(card.position),
            fmt.points(card.points),
          ], separator: ' · ');

    return GvDriverRow(
      key: ValueKey<String>('explore-driver-${card.driverId}'),
      name: card.name,
      // Team only when authoritative; nationality and standing only when known.
      subtitle: EntityFormatter.joinDetails(<String?>[
        card.teamName,
        card.nationality,
        standing,
      ]),
      number: fmt.count(card.raceNumber),
      shortCode: card.shortCode,
      accentColor: GvTeamAccent.parse(card.teamColor),
      semanticLabel: EntityFormatter.joinDetails(<String?>[
        card.name,
        card.teamName,
        standing,
      ], separator: ', '),
      leading: SizedBox(
        width: 40,
        child: GvImagePlaceholder(
          aspectRatio: 1,
          icon: Icons.person_outline,
          semanticLabel: l10n.driverPortraitPlaceholder,
        ),
      ),
      onTap: () => context.openEntity(
        RoutePaths.driver(card.driverId),
        season: card.season,
      ),
    );
  }
}

/// One team in the Explore teams collection.
class ExploreTeamCardRow extends StatelessWidget {
  const ExploreTeamCardRow({super.key, required this.card});

  final SeasonTeamCard card;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = EntityFormatter(
      Localizations.localeOf(context).toString(),
      l10n,
    );

    // A compact line-up summary from the derived participation entries.
    final String? lineup = card.lineup.isEmpty
        ? null
        : card.lineup
              .map((TeamLineupMember m) => m.shortCode ?? m.name)
              .join(' · ');
    final String? standing = card.position == null && card.points == null
        ? null
        : EntityFormatter.joinDetails(<String?>[
            card.position == null ? null : fmt.position(card.position),
            fmt.points(card.points),
          ]);

    return GvTeamRow(
      key: ValueKey<String>('explore-team-${card.constructorId}'),
      name: card.displayName,
      subtitle: EntityFormatter.joinDetails(<String?>[
        standing,
        card.powerUnit,
        lineup,
      ]),
      accentColor: GvTeamAccent.parse(card.teamColor),
      semanticLabel: EntityFormatter.joinDetails(<String?>[
        card.displayName,
        standing,
        lineup,
      ], separator: ', '),
      leading: SizedBox(
        width: 40,
        child: GvImagePlaceholder(
          aspectRatio: 1,
          icon: Icons.shield_outlined,
          semanticLabel: l10n.teamLogoPlaceholder,
        ),
      ),
      onTap: () => context.openEntity(
        RoutePaths.constructor(card.constructorId),
        season: card.season,
      ),
    );
  }
}

/// One circuit in the Explore circuits collection.
class ExploreCircuitCardRow extends StatelessWidget {
  const ExploreCircuitCardRow({super.key, required this.card});

  final SeasonCircuitCard card;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = EntityFormatter(
      Localizations.localeOf(context).toString(),
      l10n,
    );

    final RelatedGrandPrixSummary? event = card.relatedGrandPrix;
    final String? location = EntityFormatter.joinDetails(<String?>[
      card.locality,
      card.country,
    ], separator: ', ');
    final String? eventLine = event == null
        ? null
        : EntityFormatter.joinDetails(<String?>[
            event.name,
            fmt.calendarDate(event.startDate),
          ]);

    return GvCircuitRow(
      key: ValueKey<String>('explore-circuit-${card.circuitId}'),
      name: card.name,
      location: EntityFormatter.joinDetails(<String?>[
        location,
        eventLine,
        fmt.kilometres(card.lengthMeters),
      ]),
      semanticLabel: EntityFormatter.joinDetails(<String?>[
        card.name,
        location,
        event?.name,
      ], separator: ', '),
      leading: SizedBox(
        width: 40,
        child: GvImagePlaceholder(
          aspectRatio: 1,
          icon: Icons.route_outlined,
          semanticLabel: l10n.circuitLayoutPlaceholder,
        ),
      ),
      onTap: () => context.openEntity(
        RoutePaths.circuit(card.circuitId),
        season: card.season,
      ),
    );
  }
}
