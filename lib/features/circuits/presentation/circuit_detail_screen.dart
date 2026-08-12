import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/entity_detail_scope.dart';
import '../../shared/application/entity_detail_state.dart';
import '../../shared/domain/entities/circuit.dart';
import '../../shared/domain/entities/entity_profile.dart';
import '../../shared/domain/entities/enums.dart';
import '../../shared/domain/entities/season_card.dart';
import '../../shared/domain/media/media_presentation.dart';
import '../../shared/domain/media/media_slot_policy.dart';
import '../../shared/domain/media/media_variant_selector.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/entity_formatting.dart';
import '../../shared/presentation/media_slot.dart';
import '../../shared/presentation/widgets/entity_detail_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';
import '../application/circuit_detail_providers.dart';

/// Circuit detail for one exact season.
///
/// Circuit identity is **stable** and season-independent; only the related Grand
/// Prix is season-specific. Event properties — the race distance and the event's
/// lap count — belong to that event and deliberately never appear as circuit
/// identity fields.
///
/// The screen stays useful without layout media, coordinates, physical facts, a
/// lap record, a historical fact or a related current-season event: hosting no
/// event in the selected season is a valid state, not an error.
class CircuitDetailScreen extends ConsumerWidget {
  const CircuitDetailScreen({
    super.key,
    required this.circuitId,
    this.originSeason,
  });

  final String circuitId;

  /// The season handed over by the originating screen, or `null` for a deep
  /// link.
  final int? originSeason;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityDetailScope scope = EntityDetailScope(
      entityId: circuitId,
      originSeason: originSeason,
    );

    return EntityDetailScaffold<CircuitProfile>(
      title: l10n.circuitTitle,
      state: ref.watch(circuitDetailStateProvider(scope)),
      onRetry: () =>
          ref.read(circuitDetailControllerProvider(scope).notifier).retry(),
      builder: _body,
    );
  }

  List<Widget> _body(
    BuildContext context,
    EntityDetailReady<CircuitProfile> ready,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = EntityFormatter(
      Localizations.localeOf(context).toString(),
      l10n,
    );
    return <Widget>[
      _CircuitHero(profile: ready.profile),
      const SizedBox(height: GvSpacing.xl),
      ..._facts(context, ready.profile, fmt),
      ..._lapRecord(context, ready.profile, fmt),
      ..._relatedGrandPrix(context, ready, fmt),
    ];
  }

  /// The circuit's physical facts. Rendered only when at least one is present,
  /// so an empty facts card is never shown, and never with a false zero.
  List<Widget> _facts(
    BuildContext context,
    CircuitProfile profile,
    EntityFormatter fmt,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (!profile.hasPhysicalFacts) return const <Widget>[];
    final Circuit circuit = profile.circuit;
    return <Widget>[
      GvScreenSection(
        title: l10n.circuitFactsSection,
        child: GvInfoCard(
          children: <Widget>[
            // The stored metres are preserved; only the display is converted.
            if (fmt.kilometres(circuit.lengthMeters) case final String length)
              GvDetailField(label: l10n.fieldLength, value: length),
            if (fmt.count(circuit.cornerCount) case final String corners)
              GvDetailField(label: l10n.fieldCorners, value: corners),
            if (circuit.direction != null)
              GvDetailField(
                label: l10n.fieldDirection,
                value: fmt.direction(circuit.direction),
              ),
            if (fmt.year(circuit.firstGrandPrixYear) case final String first)
              GvDetailField(label: l10n.fieldFirstGrandPrix, value: first),
          ],
        ),
      ),
      const SizedBox(height: GvSpacing.xl),
    ];
  }

  /// The lap record. A missing holder name uses localized unavailable copy —
  /// never the driver identifier.
  List<Widget> _lapRecord(
    BuildContext context,
    CircuitProfile profile,
    EntityFormatter fmt,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (!profile.hasLapRecord) return const <Widget>[];
    final LapRecord record = profile.circuit.lapRecord!;
    return <Widget>[
      GvScreenSection(
        title: l10n.circuitLapRecordSection,
        child: GvInfoCard(
          children: <Widget>[
            if (fmt.lapTime(record.time) case final String time)
              GvDetailField(label: l10n.fieldLapRecordTime, value: time),
            if (record.driverId != null)
              GvDetailField(
                label: l10n.fieldLapRecordDriver,
                value:
                    profile.lapRecordDriverName ??
                    l10n.circuitLapRecordDriverUnavailable,
              ),
            if (fmt.year(record.year) case final String year)
              GvDetailField(label: l10n.fieldLapRecordYear, value: year),
          ],
        ),
      ),
      const SizedBox(height: GvSpacing.xl),
    ];
  }

  /// The season's related event, taken from local data — never inferred from the
  /// circuit's name and never borrowed from another season.
  List<Widget> _relatedGrandPrix(
    BuildContext context,
    EntityDetailReady<CircuitProfile> ready,
    EntityFormatter fmt,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final RelatedGrandPrixSummary? event = ready.profile.relatedGrandPrix;
    if (event == null) {
      return <Widget>[
        GvScreenSection(
          title: l10n.circuitRelatedGrandPrix,
          child: GvInfoCard(
            children: <Widget>[
              GvDetailField(
                label: l10n.seasonLabel('${ready.season}'),
                value: l10n.circuitNoRelatedGrandPrix,
              ),
            ],
          ),
        ),
        const SizedBox(height: GvSpacing.xl),
      ];
    }

    // A missing event name uses localized unavailable copy — never a skeleton
    // placeholder string, and never a name derived from the identifier.
    final String name = event.name ?? l10n.grandPrixNameUnavailable;
    return <Widget>[
      GvScreenSection(
        title: l10n.circuitRelatedGrandPrix,
        child: GvContentCard(
          onTap: () => context.openEntity(
            RoutePaths.grandPrix(season: event.season, round: event.round),
            season: event.season,
          ),
          child: Semantics(
            button: true,
            label: l10n.circuitOpenGrandPrix(name),
            child: ExcludeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(name, style: context.gvText.cardTitle),
                  const SizedBox(height: GvSpacing.xxs),
                  if (EntityFormatter.joinDetails(<String?>[
                        l10n.roundLabel('${event.round}'),
                        fmt.calendarDate(event.startDate),
                      ])
                      case final String line)
                    Text(line, style: context.gvText.bodyM),
                  const SizedBox(height: GvSpacing.xs),
                  Wrap(
                    spacing: GvSpacing.xs,
                    children: <Widget>[
                      if (event.status case final status?)
                        GvStatusChip(
                          label: requiredEventStatusLabel(l10n, status),
                          tone: toneForEventStatus(status),
                        ),
                      if (event.format case final format?)
                        GvStatusChip(label: weekendFormatLabel(l10n, format)),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      const SizedBox(height: GvSpacing.xl),
    ];
  }
}

/// The circuit hero: authoritative name and location over the circuit's own media
/// when it is available locally. The identifier is never shown.
///
/// This is the one entity hero whose image can be **informative**. A track layout
/// diagram conveys the shape of the circuit, which no adjacent text states, so it
/// is labelled. An environmental photograph conveys nothing the name and location
/// do not, so it is decorative and stays out of the semantics tree — the two are
/// distinguished by the selected asset's own category rather than assumed.
class _CircuitHero extends StatelessWidget {
  const _CircuitHero({required this.profile});

  final CircuitProfile profile;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String? location = EntityFormatter.joinDetails(<String?>[
      profile.circuit.locality,
      profile.circuit.country,
    ], separator: ', ');

    final double width = MediaQuery.sizeOf(context).width;
    final MediaPresentation? asset = profile.media.preferred(
      MediaSlotPolicy.circuitLayout,
    );
    final bool isLayoutDiagram = asset?.category == MediaCategory.circuitLayout;

    return GvHeroCard(
      background: GvRemoteImage(
        request: asset == null
            ? null
            : requestForAsset(
                context,
                asset: asset,
                role: MediaDisplayRole.detail,
                logicalWidth: width,
              ),
        aspectRatio: 16 / 9,
        logicalWidth: width,
        placeholderIcon: Icons.route_outlined,
        borderRadius: BorderRadius.zero,
        // A diagram is described; a photograph is not. The label names the
        // circuit, never the media id, the category token or the URL.
        decorative: !isLayoutDiagram,
        semanticLabel: isLayoutDiagram
            ? l10n.circuitLayoutImage(profile.circuit.name)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.end,
        children: <Widget>[
          Semantics(
            header: true,
            child: Text(profile.circuit.name, style: context.gvText.pageTitle),
          ),
          if (location != null) Text(location, style: context.gvText.bodyM),
        ],
      ),
    );
  }
}
