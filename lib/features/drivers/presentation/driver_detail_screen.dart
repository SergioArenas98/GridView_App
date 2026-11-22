import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/media/media_image_loader.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/entity_detail_scope.dart';
import '../../shared/application/entity_detail_state.dart';
import '../../shared/domain/entities/entity_profile.dart';
import '../../shared/domain/entities/standing.dart';
import '../../shared/domain/media/media_slot_policy.dart';
import '../../shared/domain/media/media_variant_selector.dart';
import '../../shared/presentation/entity_formatting.dart';
import '../../shared/presentation/media_slot.dart';
import '../../shared/presentation/widgets/primer_detail_app_bar.dart';
import '../../shared/presentation/widgets/primer_detail_notices.dart';
import '../../shared/presentation/widgets/primer_detail_parts.dart';
import '../../shared/presentation/widgets/primer_detail_states.dart';
import '../application/driver_detail_providers.dart';
import 'widgets/driver_championship.dart';
import 'widgets/driver_detail_states.dart';
import 'widgets/driver_plate.dart';
import 'widgets/driver_stint_row.dart';

/// Driver detail for one exact season, in Primer V2 (Step 55C.9; Dark and
/// Light; frozen reference `light-rollout-b1/dd-*`, DR-01..03).
///
/// The route carries only the stable driver id; the season arrives as typed
/// navigation metadata (a historical Standings origin keeps its own season) or,
/// for a deep link, is resolved locally. No season-scoped request is ever made
/// without a resolved season, and no year is ever hardcoded.
///
/// Local content renders immediately — a collection-derived summary is real,
/// useful content — while exactly one refresh of `driver:<id>:<season>` runs in
/// the background. Nothing else is refreshed. State, providers, routing and the
/// relevant-span rule (`sortBySpanRelevance`, applied in the DAO) are unchanged;
/// this file only presents them.
///
/// The screen stays useful without a portrait, a biography, birth details, a
/// standing, a team association or any optional statistic: each absent part is
/// omitted, never shown as an empty block or a zero.
class DriverDetailScreen extends ConsumerWidget {
  const DriverDetailScreen({
    super.key,
    required this.driverId,
    this.originSeason,
  });

  final String driverId;

  /// The season handed over by the originating screen, or `null` for a deep
  /// link.
  final int? originSeason;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityDetailScope scope = EntityDetailScope(
      entityId: driverId,
      originSeason: originSeason,
    );
    final EntityDetailState<DriverProfile> state = ref.watch(
      driverDetailStateProvider(scope),
    );
    void retry() =>
        ref.read(driverDetailControllerProvider(scope).notifier).retry();

    return Scaffold(
      backgroundColor: context.gvPrimer.surface.page,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            PrimerDetailAppBar(
              title: l10n.driverTitle,
              backKey: const ValueKey<String>('driver-detail-back'),
            ),
            Expanded(
              child: switch (state) {
                EntityDetailLoading<DriverProfile>() =>
                  const DriverDetailSkeleton(),
                EntityDetailSeasonUnavailable<DriverProfile>() =>
                  PrimerDetailMessage(
                    glyph: GvPrimerGlyph.alert,
                    title: l10n.detailSeasonUnavailableTitle,
                    message: l10n.detailSeasonUnavailableMessage,
                    retryLabel: l10n.retry,
                    onRetry: retry,
                  ),
                EntityDetailNotFound<DriverProfile>() => PrimerDetailMessage(
                  glyph: GvPrimerGlyph.help,
                  title: l10n.detailNotFoundTitle,
                  message: l10n.detailNotFoundMessage,
                ),
                EntityDetailFirstLoadError<DriverProfile>() =>
                  PrimerDetailMessage(
                    glyph: GvPrimerGlyph.alert,
                    title: l10n.detailLoadErrorTitle,
                    message: l10n.errorGeneric,
                    retryLabel: l10n.retry,
                    onRetry: retry,
                  ),
                final EntityDetailReady<DriverProfile> ready => _DriverBody(
                  ready: ready,
                ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// The ready profile: notices, plate, then Season participation,
/// Championship, Profile and About (the prototype's order; PD-11 / DRV-01
/// keeps the section order pending), 32px apart, ending 32px above the
/// bottom inset. One primary scrollable.
class _DriverBody extends StatelessWidget {
  const _DriverBody({required this.ready});

  final EntityDetailReady<DriverProfile> ready;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = EntityFormatter(
      Localizations.localeOf(context).toString(),
      l10n,
    );
    final DriverProfile profile = ready.profile;
    return ListView(
      key: const ValueKey<String>('driver-detail-list'),
      padding: EdgeInsets.only(
        bottom: 32 + MediaQuery.paddingOf(context).bottom,
      ),
      children: <Widget>[
        PrimerDetailNotices(
          notices: detailNotices(ready, l10n),
          blockKey: const ValueKey<String>('driver-detail-notices'),
        ),
        _plate(context, l10n, fmt, profile),
        ..._participation(context, l10n, fmt, profile),
        ..._championship(context, l10n, fmt, profile.standing),
        ..._profileFacts(l10n, fmt, profile),
        ..._about(l10n, profile),
      ],
    );
  }

  /// The identity plate. The board shows the relevant span's race number,
  /// else the permanent number, named by its source (DR-03); the season line
  /// is the ready state's season (DR-02); the nationality is shown once,
  /// here (DRV-01 item 2, pending).
  Widget _plate(
    BuildContext context,
    AppLocalizations l10n,
    EntityFormatter fmt,
    DriverProfile profile,
  ) {
    final DriverParticipation? relevant = profile.relevantParticipation;
    final String? raceNumber = fmt.count(relevant?.raceNumber);
    final String? permanent = fmt.count(profile.driver.permanentNumber);
    final DriverPlateNumber? number = raceNumber != null
        ? DriverPlateNumber(label: l10n.driverRaceNumber, figure: raceNumber)
        : permanent != null
        ? DriverPlateNumber(
            label: l10n.driverPermanentNumber,
            figure: permanent,
          )
        : null;
    return DriverPlate(
      name: profile.driver.fullName,
      seasonLine: l10n.seasonLabel('${ready.season}'),
      nationality: _present(profile.driver.nationality),
      nationalityLabel: l10n.fieldNationality,
      number: number,
      code: _present(profile.driver.shortCode),
      portrait: (BuildContext context, double width) =>
          _portrait(context, profile, width),
      // DD-06 Option B (approved, Step 55C.9F): stack before a name word
      // would be split beside the board.
      stackForUnbrokenName: true,
    );
  }

  static MediaImageRequest? _portrait(
    BuildContext context,
    DriverProfile profile,
    double width,
  ) => resolveMediaSlot(
    context,
    media: profile.media,
    preference: MediaSlotPolicy.driverPortrait,
    role: MediaDisplayRole.detail,
    logicalWidth: width,
  );

  /// Every span of the season in relevance order. Only the relevant span
  /// with a resolved team name is a link, opening that team in the
  /// profile's season; a mid-season move keeps every span.
  List<Widget> _participation(
    BuildContext context,
    AppLocalizations l10n,
    EntityFormatter fmt,
    DriverProfile profile,
  ) {
    if (profile.participations.isEmpty) return const <Widget>[];
    final List<Widget> rows = <Widget>[];
    for (final (int i, DriverParticipation p)
        in profile.participations.indexed) {
      final String? team = p.teamName;
      final bool link = i == 0 && team != null;
      rows.add(
        DriverStintRow(
          key: ValueKey<String>('driver-stint-${p.entry.id}'),
          teamName: team ?? l10n.driverTeamUnavailable,
          teamUnavailable: team == null,
          teamColor: link ? GvTeamAccent.parse(p.teamColor) : null,
          dividerAbove: i > 0,
          facts: <DriverStintFact>[
            DriverStintFact(
              value: _keepRoundNumber(
                fmt.participationSpan(
                  startRound: p.startRound,
                  endRound: p.endRound,
                ),
              ),
              hiddenLabel: l10n.fieldParticipation,
              emphasis: DriverStintEmphasis.span,
            ),
            DriverStintFact(
              value: fmt.role(p.role),
              hiddenLabel: l10n.fieldRole,
            ),
            if (fmt.count(p.raceNumber) case final String number)
              DriverStintFact(
                value: number,
                label: l10n.driverRaceNumber,
                emphasis: DriverStintEmphasis.number,
              ),
          ],
          linkLabel: link ? l10n.driverOpenTeam(team) : null,
          onOpen: link
              ? () => context.openEntity(
                  RoutePaths.constructor(p.constructorId),
                  season: ready.season,
                )
              : null,
        ),
      );
    }
    return <Widget>[
      ..._section(l10n.driverParticipationSection, 'participation'),
      const SizedBox(height: 10),
      ...rows,
    ];
  }

  /// The championship for the exact season, only with a standing. A null
  /// position is the word "Unranked", never 0; a null statistic is omitted,
  /// a confirmed zero stays.
  List<Widget> _championship(
    BuildContext context,
    AppLocalizations l10n,
    EntityFormatter fmt,
    DriverStanding? standing,
  ) {
    if (standing == null) return const <Widget>[];
    return <Widget>[
      ..._section(l10n.driverChampionshipSection, 'championship'),
      DriverChampionship(
        stats: <GvPrimerStat>[
          GvPrimerStat(
            label: l10n.fieldPosition,
            value: fmt.position(standing.position),
            kind: standing.position == null
                ? GvPrimerStatKind.word
                : GvPrimerStatKind.lead,
          ),
          GvPrimerStat(
            label: l10n.fieldPoints,
            value: fmt.points(standing.points) ?? '',
          ),
        ],
        more: <DriverInlineStat>[
          if (fmt.count(standing.wins) case final String wins)
            DriverInlineStat(label: l10n.fieldWins, value: wins),
          if (fmt.count(standing.podiums) case final String podiums)
            DriverInlineStat(label: l10n.fieldPodiums, value: podiums),
        ],
        provisionalLabel: (standing.provisional ?? false)
            ? l10n.resultStatusProvisional
            : null,
        standingsLabel: l10n.driverViewStandings,
        // A Standings table lives inside the shell: change branch (or return
        // to the table this driver was opened from), never push it here.
        onOpenStandings: () => context.openBranchDestination(
          RoutePaths.standingsDrivers(ready.season),
        ),
      ),
    ];
  }

  /// The detail-owned birth facts and permanent number, behind the same
  /// `hasProfileFacts` gate (a permanent number alone never opens it). The
  /// nationality is in the plate.
  List<Widget> _profileFacts(
    AppLocalizations l10n,
    EntityFormatter fmt,
    DriverProfile profile,
  ) {
    if (!profile.hasProfileFacts) return const <Widget>[];
    final List<Widget> facts = <Widget>[
      if (fmt.calendarDate(profile.driver.dateOfBirth) case final String born)
        GvPrimerFact(label: l10n.fieldDateOfBirth, value: born),
      if (_present(profile.driver.placeOfBirth) case final String place)
        GvPrimerFact(label: l10n.fieldPlaceOfBirth, value: place),
      if (fmt.count(profile.driver.permanentNumber) case final String number)
        GvPrimerFact(label: l10n.driverPermanentNumber, value: number),
    ];
    if (facts.isEmpty) return const <Widget>[];
    return <Widget>[
      ..._section(l10n.driverProfileSection, 'profile'),
      const SizedBox(height: 12),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
        child: GvPrimerFactGrid(children: facts),
      ),
    ];
  }

  /// The trimmed biography (`.about`: 16px, line height 1.55), only when it
  /// is not blank.
  List<Widget> _about(AppLocalizations l10n, DriverProfile profile) {
    final String? biography = _present(profile.driver.biography);
    if (biography == null) return const <Widget>[];
    return <Widget>[
      ..._section(l10n.driverAbout, 'about'),
      const SizedBox(height: 10),
      PrimerDetailAbout(biography),
    ];
  }

  /// A section's 32px gap and its title on the gutter.
  static List<Widget> _section(String title, String id) => <Widget>[
    const SizedBox(height: 32),
    Padding(
      key: ValueKey<String>('driver-section-$id'),
      padding: const EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
      child: GvPrimerSectionTitle(title),
    ),
  ];

  /// A trimmed value, or `null` when absent or blank.
  static String? _present(String? value) {
    final String? trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }

  /// The space before a round number is non-breaking, so "Desde la ronda 7"
  /// never orphans the number at large text (prototype defect 3; the ARB
  /// copy is unchanged).
  static String _keepRoundNumber(String span) =>
      span.replaceAllMapped(RegExp(r' (\d)'), (Match m) => '\u00A0${m[1]}');
}
