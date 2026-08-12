import 'package:flutter/material.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/gv_team_accent.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/domain/entities/season_card.dart';
import '../../shared/domain/media/media_slot_policy.dart';
import '../../shared/domain/media/media_variant_selector.dart';
import '../../shared/presentation/entity_formatting.dart';
import '../../shared/presentation/media_slot.dart';

/// The three Explore row presentations.
///
/// Each renders a domain read model only — no Drift rows, no DTOs, no Dio — and
/// omits every value the local database does not have, so a missing team leaves
/// no dangling separator, a missing statistic never becomes a false zero, and no
/// stable identifier is ever displayed or turned into a name.
///
/// The leading slot shows the owner's own media when a size-appropriate variant
/// is available locally, and the same layout-reserving placeholder otherwise.
/// Rows ask for a **thumbnail** at their real rendered width, so scrolling the
/// roster never fetches a detail or hero file, and every row image is decorative:
/// the row already carries an explicit semantic label naming the entity, so
/// announcing the picture as well would repeat it.

/// The leading media slot's rendered width in logical pixels. Rows are
/// width-constrained and square, so this is also the height.
const double _rowMediaSize = 40;

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
        width: _rowMediaSize,
        child: GvRemoteImage(
          request: resolveMediaSlot(
            context,
            media: card.media,
            preference: MediaSlotPolicy.driverPortrait,
            role: MediaDisplayRole.thumbnail,
            logicalWidth: _rowMediaSize,
            logicalHeight: _rowMediaSize,
          ),
          aspectRatio: 1,
          logicalWidth: _rowMediaSize,
          placeholderIcon: Icons.person_outline,
          decorative: true,
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
        width: _rowMediaSize,
        child: GvRemoteImage(
          request: resolveMediaSlot(
            context,
            // The team's stable mark. Not season livery: the contract carries no
            // season-entry media, so nothing here claims to be this year's car.
            media: card.media,
            preference: MediaSlotPolicy.constructorMark,
            role: MediaDisplayRole.thumbnail,
            logicalWidth: _rowMediaSize,
            logicalHeight: _rowMediaSize,
          ),
          aspectRatio: 1,
          logicalWidth: _rowMediaSize,
          placeholderIcon: Icons.shield_outlined,
          decorative: true,
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
        width: _rowMediaSize,
        child: GvRemoteImage(
          request: resolveMediaSlot(
            context,
            media: card.media,
            preference: MediaSlotPolicy.circuitLayout,
            role: MediaDisplayRole.thumbnail,
            logicalWidth: _rowMediaSize,
            logicalHeight: _rowMediaSize,
          ),
          aspectRatio: 1,
          logicalWidth: _rowMediaSize,
          placeholderIcon: Icons.route_outlined,
          decorative: true,
        ),
      ),
      onTap: () => context.openEntity(
        RoutePaths.circuit(card.circuitId),
        season: card.season,
      ),
    );
  }
}
