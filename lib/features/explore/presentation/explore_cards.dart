import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/gv_team_accent.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/domain/entities/enums.dart';
import '../../shared/domain/entities/season_card.dart';
import '../../shared/domain/media/media_presentation.dart';
import '../../shared/domain/media/media_slot_policy.dart';
import '../../shared/domain/media/media_variant_selector.dart';
import '../../shared/presentation/entity_formatting.dart';
import '../../shared/presentation/media_slot.dart';
import 'widgets/explore_entity_row.dart';

/// The three Explore row presentations, in Primer V2 (EX-01, EX-02, RK-2).
///
/// Each maps a domain read model onto [ExploreEntityRow] and omits every value
/// the local database does not have: a missing team leaves no dangling
/// separator, a missing statistic never becomes a false zero, an unranked
/// competitor shows no position (RK-2) while known points, including 0, stay,
/// and no stable identifier is ever displayed or turned into a name.
///
/// **Media (PD-16 open).** A collection with no media reference has no image
/// column (EX-02, Alternative B). Once any card of the collection has one,
/// every row reserves the existing 40px Flutter slot, decided from the read
/// model before anything loads, so loading, failure and absence never move the
/// text. The slot asks for a **thumbnail** at its rendered width, is decorative
/// (the row's label names the entity) and shows the existing placeholder when
/// nothing loads.

/// Whether [card] has a media reference its row slot could show.
bool driverHasMedia(SeasonDriverCard card) =>
    card.media?.preferred(MediaSlotPolicy.driverPortrait) != null;

/// Whether [card] has a media reference its row slot could show.
bool teamHasMedia(SeasonTeamCard card) =>
    card.media?.preferred(MediaSlotPolicy.constructorMark) != null;

/// Whether [card] has a media reference its row slot could show.
bool circuitHasMedia(SeasonCircuitCard card) =>
    card.media?.preferred(MediaSlotPolicy.circuitLayout) != null;

/// The row's image slot: the existing request and placeholder, decorative.
Widget _mediaSlot(
  BuildContext context, {
  required EntityMedia? media,
  required List<MediaCategory> preference,
  required IconData placeholderIcon,
}) => SizedBox(
  key: const ValueKey<String>('explore-row-media'),
  width: ExploreEntityRow.mediaSlot,
  child: GvRemoteImage(
    request: resolveMediaSlot(
      context,
      media: media,
      preference: preference,
      role: MediaDisplayRole.thumbnail,
      logicalWidth: ExploreEntityRow.mediaSlot,
      logicalHeight: ExploreEntityRow.mediaSlot,
    ),
    aspectRatio: 1,
    logicalWidth: ExploreEntityRow.mediaSlot,
    placeholderIcon: placeholderIcon,
    decorative: true,
  ),
);

/// The labelled Position / Points data (RK-2): an unranked position is
/// omitted, known points are kept, including 0.
List<ExploreDatum> _standing(
  AppLocalizations l10n,
  EntityFormatter fmt, {
  required int? position,
  required double? points,
}) {
  final String? shown = fmt.points(points);
  return <ExploreDatum>[
    if (position != null) ExploreDatum(l10n.fieldPosition, '$position'),
    if (shown != null) ExploreDatum(l10n.fieldPoints, shown),
  ];
}

/// The spoken standing: "Position 2", "402.5 points"; nothing for unknowns.
List<String> _spokenStanding(
  AppLocalizations l10n,
  EntityFormatter fmt, {
  required int? position,
  required double? points,
}) {
  final String? shown = fmt.points(points);
  return <String>[
    if (position != null) l10n.standingsPositionSemantics('$position'),
    if (shown != null) l10n.standingsPointsSemantics(shown),
  ];
}

/// The row's accessible name: the present parts, comma-separated.
String _label(List<String?> parts) =>
    EntityFormatter.joinDetails(parts, separator: ', ') ?? '';

EntityFormatter _formatter(BuildContext context) => EntityFormatter(
  Localizations.localeOf(context).toString(),
  AppLocalizations.of(context),
);

/// One driver in the Explore drivers collection.
class ExploreDriverCardRow extends StatelessWidget {
  const ExploreDriverCardRow({
    super.key,
    required this.card,
    this.mediaColumn,
    this.dividerAbove = false,
  });

  final SeasonDriverCard card;

  /// Whether the collection has an image column; defaults to this card's
  /// own media reference when the row is shown on its own.
  final bool? mediaColumn;
  final bool dividerAbove;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = _formatter(context);
    final String? affiliation = EntityFormatter.joinDetails(<String?>[
      // Team only when authoritative; nationality only when known.
      card.teamName,
      card.nationality,
    ]);
    return ExploreEntityRow(
      key: ValueKey<String>('explore-driver-${card.driverId}'),
      name: card.name,
      subLines: <String>[?affiliation],
      data: _standing(l10n, fmt, position: card.position, points: card.points),
      figure: fmt.count(card.raceNumber),
      figureCaption: card.shortCode,
      accent: GvTeamAccent.parse(card.teamColor),
      dividerAbove: dividerAbove,
      semanticLabel: _label(<String?>[
        card.name,
        card.teamName,
        ..._spokenStanding(
          l10n,
          fmt,
          position: card.position,
          points: card.points,
        ),
      ]),
      media: (mediaColumn ?? driverHasMedia(card))
          ? _mediaSlot(
              context,
              media: card.media,
              preference: MediaSlotPolicy.driverPortrait,
              placeholderIcon: Icons.person_outline,
            )
          : null,
      onOpen: () => context.openEntity(
        RoutePaths.driver(card.driverId),
        season: card.season,
      ),
    );
  }
}

/// One team in the Explore teams collection.
class ExploreTeamCardRow extends StatelessWidget {
  const ExploreTeamCardRow({
    super.key,
    required this.card,
    this.mediaColumn,
    this.dividerAbove = false,
  });

  final SeasonTeamCard card;

  /// Whether the collection has an image column; defaults to this card's
  /// own media reference when the row is shown on its own.
  final bool? mediaColumn;
  final bool dividerAbove;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = _formatter(context);
    // A compact line-up summary from the derived participation entries.
    final String? lineup = card.lineup.isEmpty
        ? null
        : card.lineup
              .map((TeamLineupMember m) => m.shortCode ?? m.name)
              .join(' · ');
    final String? powerUnit = card.powerUnit;
    return ExploreEntityRow(
      key: ValueKey<String>('explore-team-${card.constructorId}'),
      name: card.displayName,
      codes: lineup,
      data: <ExploreDatum>[
        ..._standing(l10n, fmt, position: card.position, points: card.points),
        if (powerUnit != null && powerUnit.trim().isNotEmpty)
          ExploreDatum(l10n.fieldPowerUnit, powerUnit),
      ],
      accent: GvTeamAccent.parse(card.teamColor),
      dividerAbove: dividerAbove,
      semanticLabel: _label(<String?>[
        card.displayName,
        ..._spokenStanding(
          l10n,
          fmt,
          position: card.position,
          points: card.points,
        ),
        lineup,
      ]),
      media: (mediaColumn ?? teamHasMedia(card))
          ? _mediaSlot(
              context,
              // The team's stable mark. Not season livery: the contract
              // carries no season-entry media, so nothing here claims to be
              // this year's car.
              media: card.media,
              preference: MediaSlotPolicy.constructorMark,
              placeholderIcon: Icons.shield_outlined,
            )
          : null,
      onOpen: () => context.openEntity(
        RoutePaths.constructor(card.constructorId),
        season: card.season,
      ),
    );
  }
}

/// One circuit in the Explore circuits collection.
class ExploreCircuitCardRow extends StatelessWidget {
  const ExploreCircuitCardRow({
    super.key,
    required this.card,
    this.mediaColumn,
    this.dividerAbove = false,
  });

  final SeasonCircuitCard card;

  /// Whether the collection has an image column; defaults to this card's
  /// own media reference when the row is shown on its own.
  final bool? mediaColumn;
  final bool dividerAbove;

  /// The length's unit ("km"), taken from the existing `lengthKilometers`
  /// template so the figure and its caption stay the localized string.
  static String kilometreUnit(AppLocalizations l10n) {
    const String marker = '\u0000';
    return l10n.lengthKilometers(marker).replaceAll(marker, '').trim();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = _formatter(context);
    final String locale = Localizations.localeOf(context).toString();

    final RelatedGrandPrixSummary? event = card.relatedGrandPrix;
    final String? location = EntityFormatter.joinDetails(<String?>[
      card.locality,
      card.country,
    ], separator: ', ');
    final String? date = fmt.calendarDate(event?.startDate);
    final String? eventLine = event == null
        ? null
        : EntityFormatter.joinDetails(<String?>[
            event.name,
            // The date never breaks internally ("Jul / 10, 2026").
            date == null ? null : ExploreEntityRow.keepTogether(date),
          ]);
    final int? metres = card.lengthMeters;
    final String? length = metres == null
        ? null
        : NumberFormat.decimalPattern(locale).format(metres / 1000);

    return ExploreEntityRow(
      key: ValueKey<String>('explore-circuit-${card.circuitId}'),
      name: card.name,
      subLines: <String>[?location, ?eventLine],
      figure: length,
      figureCaption: length == null ? null : kilometreUnit(l10n),
      figureKind: ExploreFigureKind.circuit,
      dividerAbove: dividerAbove,
      semanticLabel: _label(<String?>[card.name, location, event?.name]),
      media: (mediaColumn ?? circuitHasMedia(card))
          ? _mediaSlot(
              context,
              media: card.media,
              preference: MediaSlotPolicy.circuitLayout,
              placeholderIcon: Icons.route_outlined,
            )
          : null,
      onOpen: () => context.openEntity(
        RoutePaths.circuit(card.circuitId),
        season: card.season,
      ),
    );
  }
}
