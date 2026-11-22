import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/media/media_image_loader.dart';
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
import '../../shared/presentation/primer_status_kinds.dart';
import '../../shared/presentation/widgets/primer_detail_app_bar.dart';
import '../../shared/presentation/widgets/primer_detail_notices.dart';
import '../../shared/presentation/widgets/primer_detail_states.dart';
import '../application/circuit_detail_providers.dart';
import '../application/circuit_event_association.dart';
import 'widgets/circuit_detail_skeleton.dart';
import 'widgets/circuit_event_row.dart';
import 'widgets/circuit_facts.dart';
import 'widgets/circuit_records.dart';
import 'widgets/circuit_sheet.dart';

/// Circuit detail for one exact season, in Primer V2 (Step 55C.11; Dark and
/// Light; frozen reference `light-rollout-b2/cd-*`, the 54A dashed
/// unknown-format correction, VS-4 notice icons, PD-13a–c).
///
/// Circuit identity is **stable** and season-independent; only the related
/// Grand Prix is season-specific. Event properties — the race distance and
/// the event's lap count — belong to that event and deliberately never
/// appear as circuit identity fields.
///
/// The screen stays useful without media, physical facts, a lap record or a
/// related current-season event. State, providers, routing, refresh scope
/// and the related-event read model are unchanged; this file only presents
/// them.
///
/// **Related Grand Prix (CR-04 / PD-14 / CIR-02, Step 55C.11C; C-R1).** The
/// section follows [circuitEventAssociationProvider]: a stored related event
/// is shown (A); "No Grand Prix this season" only when that exact season's
/// calendar is materialized (`hasMaterializedCalendar`, B); otherwise, and
/// while it resolves, the whole section — heading, season line and
/// statement — is omitted (C). No new copy.
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
    final EntityDetailState<CircuitProfile> state = ref.watch(
      circuitDetailStateProvider(scope),
    );
    final CircuitEventAssociation association = ref.watch(
      circuitEventAssociationProvider(scope),
    );
    void retry() =>
        ref.read(circuitDetailControllerProvider(scope).notifier).retry();

    return Scaffold(
      backgroundColor: context.gvPrimer.surface.page,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            PrimerDetailAppBar(
              title: l10n.circuitTitle,
              backKey: const ValueKey<String>('circuit-detail-back'),
            ),
            Expanded(
              child: switch (state) {
                EntityDetailLoading<CircuitProfile>() =>
                  const CircuitDetailSkeleton(),
                EntityDetailSeasonUnavailable<CircuitProfile>() =>
                  PrimerDetailMessage(
                    glyph: GvPrimerGlyph.alert,
                    title: l10n.detailSeasonUnavailableTitle,
                    message: l10n.detailSeasonUnavailableMessage,
                    retryLabel: l10n.retry,
                    onRetry: retry,
                  ),
                EntityDetailNotFound<CircuitProfile>() => PrimerDetailMessage(
                  glyph: GvPrimerGlyph.help,
                  title: l10n.detailNotFoundTitle,
                  message: l10n.detailNotFoundMessage,
                ),
                EntityDetailFirstLoadError<CircuitProfile>() =>
                  PrimerDetailMessage(
                    glyph: GvPrimerGlyph.alert,
                    title: l10n.detailLoadErrorTitle,
                    message: l10n.errorGeneric,
                    retryLabel: l10n.retry,
                    onRetry: retry,
                  ),
                final EntityDetailReady<CircuitProfile> ready => _CircuitBody(
                  ready: ready,
                  association: association,
                ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// The ready profile: notices, the circuit sheet, then Lap record and This
/// season's Grand Prix, 32px apart, ending 32px above the bottom inset. One
/// primary scrollable.
class _CircuitBody extends StatelessWidget {
  const _CircuitBody({required this.ready, required this.association});

  final EntityDetailReady<CircuitProfile> ready;

  /// CR-04: what may be said about the season's Grand Prix.
  final CircuitEventAssociation association;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String locale = Localizations.localeOf(context).toString();
    final EntityFormatter fmt = EntityFormatter(locale, l10n);
    final CircuitProfile profile = ready.profile;
    return ListView(
      key: const ValueKey<String>('circuit-detail-list'),
      padding: EdgeInsets.only(
        bottom: 32 + MediaQuery.paddingOf(context).bottom,
      ),
      children: <Widget>[
        PrimerDetailNotices(
          notices: detailNotices(ready, l10n),
          blockKey: const ValueKey<String>('circuit-detail-notices'),
        ),
        CircuitSheet(
          name: profile.circuit.name,
          // Location exactly as before: locality and country, either
          // omitted without a dangling separator.
          location: EntityFormatter.joinDetails(<String?>[
            profile.circuit.locality,
            profile.circuit.country,
          ], separator: ', '),
          media: (BuildContext context, double width) =>
              _media(context, l10n, profile, width),
          facts: _facts(l10n, fmt, locale, profile),
        ),
        ..._lapRecord(l10n, fmt, profile),
        ..._related(context, l10n, fmt, profile),
      ],
    );
  }

  /// The circuit's own media, only when an asset is selected
  /// (`MediaSlotPolicy.circuitLayout`: layout diagram, then hero, then
  /// thumbnail). A layout diagram is informative and labelled with the
  /// circuit's name; a photograph is decorative. Never the media id, the
  /// category token or the URL.
  static CircuitSheetMedia? _media(
    BuildContext context,
    AppLocalizations l10n,
    CircuitProfile profile,
    double width,
  ) {
    final MediaPresentation? asset = profile.media.preferred(
      MediaSlotPolicy.circuitLayout,
    );
    if (asset == null) return null;
    final MediaImageRequest? request = requestForAsset(
      context,
      asset: asset,
      role: MediaDisplayRole.detail,
      logicalWidth: width,
    );
    return CircuitSheetMedia(
      request: request,
      semanticLabel: asset.category == MediaCategory.circuitLayout
          ? l10n.circuitLayoutImage(profile.circuit.name)
          : null,
    );
  }

  /// The physical facts, only when at least one is present
  /// (`hasPhysicalFacts`), never with a false zero. A null direction is
  /// omitted; an explicit unknown direction is the unavailable word without
  /// a glyph.
  static CircuitFactsData? _facts(
    AppLocalizations l10n,
    EntityFormatter fmt,
    String locale,
    CircuitProfile profile,
  ) {
    if (!profile.hasPhysicalFacts) return null;
    final Circuit circuit = profile.circuit;
    final CircuitDirection? direction = circuit.direction;
    return CircuitFactsData(
      title: l10n.circuitFactsSection,
      length: _length(l10n, fmt, locale, circuit.lengthMeters),
      facts: <CircuitFact>[
        if (fmt.count(circuit.cornerCount) case final String corners)
          CircuitFact(label: l10n.fieldCorners, value: corners),
        if (direction != null)
          CircuitFact(
            label: l10n.fieldDirection,
            value: fmt.direction(direction),
            kind: CircuitFactKind.word,
            glyph: switch (direction) {
              CircuitDirection.clockwise => GvPrimerGlyph.rotateCw,
              CircuitDirection.counterClockwise => GvPrimerGlyph.rotateCcw,
              CircuitDirection.unknown => null,
            },
          ),
        if (fmt.year(circuit.firstGrandPrixYear) case final String first)
          CircuitFact(label: l10n.fieldFirstGrandPrix, value: first),
      ],
    );
  }

  /// The length as the existing localized copy ("7.004 km" / "7,004 km"),
  /// split around its number for the dimension line. The stored metres are
  /// never modified.
  static CircuitLength? _length(
    AppLocalizations l10n,
    EntityFormatter fmt,
    String locale,
    int? metres,
  ) {
    final String? spoken = fmt.kilometres(metres);
    if (spoken == null || metres == null) return null;
    final String figure = NumberFormat.decimalPattern(
      locale,
    ).format(metres / 1000);
    final int at = spoken.indexOf(figure);
    return CircuitLength(
      label: l10n.fieldLength,
      figure: at < 0 ? spoken : figure,
      unit: at < 0 ? '' : spoken.substring(at + figure.length).trim(),
      spoken: spoken,
    );
  }

  /// The lap record, only when `hasLapRecord`. The holder appears only with
  /// a driver id, as the resolved name or localized unavailable copy —
  /// never the identifier — and is not a link.
  List<Widget> _lapRecord(
    AppLocalizations l10n,
    EntityFormatter fmt,
    CircuitProfile profile,
  ) {
    if (!profile.hasLapRecord) return const <Widget>[];
    final LapRecord record = profile.circuit.lapRecord!;
    final String? holder = profile.lapRecordDriverName;
    return <Widget>[
      _section(l10n.circuitLapRecordSection, 'lap-record'),
      CircuitLapRecord(
        timeLabel: l10n.fieldLapRecordTime,
        time: fmt.lapTime(record.time),
        attributes: <CircuitRecordAttribute>[
          if (record.driverId != null)
            CircuitRecordAttribute(
              label: l10n.fieldLapRecordDriver,
              value: holder ?? l10n.circuitLapRecordDriverUnavailable,
              unavailable: holder == null,
            ),
          if (fmt.year(record.year) case final String year)
            CircuitRecordAttribute(
              label: l10n.fieldLapRecordYear,
              value: year,
              tabular: true,
            ),
        ],
      ),
    ];
  }

  /// The season's related event, from local data — never inferred from the
  /// circuit's name, never borrowed from another season — led by the
  /// season line in both shown states (PD-13b).
  ///
  /// CR-04 (C-R1): the event row whenever an event is stored (A); the
  /// absence statement only for a confirmed absence (B); nothing at all —
  /// no heading, season line or statement — while the association is
  /// unknown or still resolving (C), so a false absence is never shown.
  List<Widget> _related(
    BuildContext context,
    AppLocalizations l10n,
    EntityFormatter fmt,
    CircuitProfile profile,
  ) {
    final RelatedGrandPrixSummary? event = profile.relatedGrandPrix;
    final Widget? content = event != null
        ? _eventRow(context, l10n, fmt, event)
        : association == CircuitEventAssociation.confirmedNone
        ? CircuitNoEvent(l10n.circuitNoRelatedGrandPrix)
        : null;
    if (content == null) return const <Widget>[];
    return <Widget>[
      _section(l10n.circuitRelatedGrandPrix, 'related'),
      CircuitSeasonLine(l10n.seasonLabel('${ready.season}')),
      content,
    ];
  }

  Widget _eventRow(
    BuildContext context,
    AppLocalizations l10n,
    EntityFormatter fmt,
    RelatedGrandPrixSummary event,
  ) {
    // A missing name is localized unavailable copy — never a placeholder
    // string, never a name derived from the identifier. Navigation is kept.
    final String name = event.name ?? l10n.grandPrixNameUnavailable;
    return CircuitEventRow(
      roundWord: _roundWord(l10n),
      round: '${event.round}',
      name: name,
      nameUnavailable: event.name == null,
      date: fmt.calendarDate(event.startDate),
      statuses: <GvPrimerStatusLabel>[
        if (event.status case final EventStatus status)
          GvPrimerStatusLabel(
            requiredEventStatusLabel(l10n, status),
            primerEventStatusKind(status),
          ),
        if (event.format case final WeekendFormat format)
          GvPrimerStatusLabel(
            weekendFormatLabel(l10n, format),
            // The 54A correction: an explicit unknown format is dashed.
            format == WeekendFormat.unknown
                ? GvPrimerChipKind.unknown
                : GvPrimerChipKind.context,
          ),
      ],
      linkLabel: l10n.circuitOpenGrandPrix(name),
      onOpen: () => context.openEntity(
        RoutePaths.grandPrix(season: event.season, round: event.round),
        season: event.season,
      ),
    );
  }

  /// The word of `roundLabel` without its number ("Round" / "Ronda"),
  /// whichever side of the number the locale puts it.
  static String _roundWord(AppLocalizations l10n) {
    const String marker = '\u0000';
    return l10n.roundLabel(marker).replaceAll(marker, '').trim();
  }

  /// A section's 32px gap and its title on the gutter.
  static Widget _section(String title, String id) => Padding(
    key: ValueKey<String>('circuit-section-$id'),
    padding: const EdgeInsets.fromLTRB(
      GvPrimerLayout.gutter,
      32,
      GvPrimerLayout.gutter,
      0,
    ),
    child: GvPrimerSectionTitle(title),
  );
}
