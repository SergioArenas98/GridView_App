import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/gv_team_accent.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/entity_detail_scope.dart';
import '../../shared/application/entity_detail_state.dart';
import '../../shared/domain/entities/entity_profile.dart';
import '../../shared/domain/entities/standing.dart';
import '../../shared/presentation/entity_formatting.dart';
import '../../shared/presentation/widgets/entity_detail_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';
import '../application/driver_detail_providers.dart';

/// Driver detail for one exact season.
///
/// The route carries only the stable driver id; the season arrives as typed
/// navigation metadata (a historical Standings origin keeps its own season) or,
/// for a deep link, is resolved locally. No season-scoped request is ever made
/// without a resolved season, and no year is ever hardcoded.
///
/// Local content renders immediately — a collection-derived summary is real,
/// useful content — while exactly one refresh of `driver:<id>:<season>` runs in
/// the background. Nothing else is refreshed.
///
/// The screen stays useful without a portrait, a biography, birth details, a
/// standing, a team association or any optional statistic.
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

    return EntityDetailScaffold<DriverProfile>(
      title: l10n.driverTitle,
      state: ref.watch(driverDetailStateProvider(scope)),
      onRetry: () =>
          ref.read(driverDetailControllerProvider(scope).notifier).retry(),
      builder: _body,
    );
  }

  List<Widget> _body(
    BuildContext context,
    EntityDetailReady<DriverProfile> ready,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = EntityFormatter(
      Localizations.localeOf(context).toString(),
      l10n,
    );
    final DriverProfile profile = ready.profile;
    final DriverParticipation? relevant = profile.relevantParticipation;

    return <Widget>[
      _DriverHero(profile: profile, relevant: relevant, formatter: fmt),
      const SizedBox(height: GvSpacing.xl),
      ..._team(context, ready, relevant, fmt),
      ..._championship(context, ready, fmt),
      ..._participation(context, profile, fmt),
      ..._profileFacts(context, profile, fmt),
    ];
  }

  /// Related-entity navigation: the relevant participation's team.
  ///
  /// Rendered only when an authoritative team name exists — an unresolved
  /// constructor contributes nothing, and the identifier is never shown in its
  /// place.
  List<Widget> _team(
    BuildContext context,
    EntityDetailReady<DriverProfile> ready,
    DriverParticipation? relevant,
    EntityFormatter fmt,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (relevant == null) return const <Widget>[];
    final String? teamName = relevant.teamName;
    if (teamName == null) return const <Widget>[];
    return <Widget>[
      GvScreenSection(
        title: l10n.fieldTeam,
        child: GvTeamRow(
          name: teamName,
          // Several spans make a single "current team" statement incomplete, so
          // the span is shown alongside it rather than hidden.
          subtitle: ready.profile.hasMultipleParticipations
              ? fmt.participationSpan(
                  startRound: relevant.startRound,
                  endRound: relevant.endRound,
                )
              : null,
          accentColor: GvTeamAccent.parse(relevant.teamColor),
          semanticLabel: l10n.driverOpenTeam(teamName),
          onTap: () => context.openEntity(
            RoutePaths.constructor(relevant.constructorId),
            season: ready.season,
          ),
        ),
      ),
      const SizedBox(height: GvSpacing.xl),
    ];
  }

  /// The championship summary for the exact selected season.
  ///
  /// A null position reads as unranked, never as zero; a null statistic is
  /// omitted entirely while a confirmed zero stays visible.
  List<Widget> _championship(
    BuildContext context,
    EntityDetailReady<DriverProfile> ready,
    EntityFormatter fmt,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final DriverStanding? standing = ready.profile.standing;
    if (standing == null) return const <Widget>[];
    return <Widget>[
      GvScreenSection(
        title: l10n.driverChampionshipSection,
        actionLabel: l10n.driverViewStandings,
        onAction: () => context.openEntity(
          RoutePaths.standingsDrivers(ready.season),
          season: ready.season,
        ),
        child: GvInfoCard(
          children: <Widget>[
            GvDetailField(
              label: l10n.fieldPosition,
              value: fmt.position(standing.position),
            ),
            GvDetailField(
              label: l10n.fieldPoints,
              value: fmt.points(standing.points) ?? '',
            ),
            if (fmt.count(standing.wins) case final String wins)
              GvDetailField(label: l10n.fieldWins, value: wins),
            if (fmt.count(standing.podiums) case final String podiums)
              GvDetailField(label: l10n.fieldPodiums, value: podiums),
          ],
        ),
      ),
      if (standing.provisional ?? false) ...<Widget>[
        const SizedBox(height: GvSpacing.sm),
        Align(
          alignment: Alignment.centerLeft,
          child: GvStatusChip(label: l10n.resultStatusProvisional),
        ),
      ],
      const SizedBox(height: GvSpacing.xl),
    ];
  }

  /// Every participation span in the season.
  ///
  /// A mid-season move keeps both spans rather than collapsing them into one
  /// false statement about the whole season.
  List<Widget> _participation(
    BuildContext context,
    DriverProfile profile,
    EntityFormatter fmt,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (profile.participations.isEmpty) return const <Widget>[];
    return <Widget>[
      GvScreenSection(
        title: l10n.driverParticipationSection,
        child: GvInfoCard(
          children: <Widget>[
            for (final DriverParticipation p in profile.participations) ...[
              GvDetailField(
                label: l10n.fieldTeam,
                value: p.teamName ?? l10n.driverTeamUnavailable,
              ),
              GvDetailField(label: l10n.fieldRole, value: fmt.role(p.role)),
              if (fmt.count(p.raceNumber) case final String number)
                GvDetailField(label: l10n.driverRaceNumber, value: number),
              GvDetailField(
                label: l10n.fieldParticipation,
                value: fmt.participationSpan(
                  startRound: p.startRound,
                  endRound: p.endRound,
                ),
              ),
            ],
          ],
        ),
      ),
      const SizedBox(height: GvSpacing.xl),
    ];
  }

  /// The detail-owned biography and birth facts. Rendered only when at least one
  /// is present, so an empty profile card is never shown.
  List<Widget> _profileFacts(
    BuildContext context,
    DriverProfile profile,
    EntityFormatter fmt,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (!profile.hasProfileFacts) return const <Widget>[];
    final String? biography = profile.driver.biography?.trim();
    final List<Widget> fields = <Widget>[
      if (profile.driver.nationality case final String nationality)
        GvDetailField(label: l10n.fieldNationality, value: nationality),
      if (fmt.calendarDate(profile.driver.dateOfBirth) case final String born)
        GvDetailField(label: l10n.fieldDateOfBirth, value: born),
      if (profile.driver.placeOfBirth case final String place)
        GvDetailField(label: l10n.fieldPlaceOfBirth, value: place),
      if (fmt.count(profile.driver.permanentNumber) case final String permanent)
        GvDetailField(label: l10n.driverPermanentNumber, value: permanent),
    ];
    return <Widget>[
      if (fields.isNotEmpty) ...<Widget>[
        GvScreenSection(
          title: l10n.driverProfileSection,
          child: GvInfoCard(children: fields),
        ),
        const SizedBox(height: GvSpacing.xl),
      ],
      if (biography != null && biography.isNotEmpty) ...<Widget>[
        GvScreenSection(
          title: l10n.driverAbout,
          child: GvContentCard(
            child: Text(biography, style: GvTypography.bodyM),
          ),
        ),
        const SizedBox(height: GvSpacing.xl),
      ],
    ];
  }
}

/// The driver hero: identity, season number, short code and nationality, with a
/// layout-reserving portrait placeholder. No remote image is requested.
class _DriverHero extends StatelessWidget {
  const _DriverHero({
    required this.profile,
    required this.relevant,
    required this.formatter,
  });

  final DriverProfile profile;
  final DriverParticipation? relevant;
  final EntityFormatter formatter;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    // The season race number when the season supplies one, else the permanent
    // number. The two are never conflated in the labelled fields below.
    final String? number = formatter.count(
      relevant?.raceNumber ?? profile.driver.permanentNumber,
    );
    final String? chip = EntityFormatter.joinDetails(<String?>[
      number == null ? null : '#$number',
      profile.driver.shortCode,
    ]);
    final String? subtitle = EntityFormatter.joinDetails(<String?>[
      relevant?.teamName,
      profile.driver.nationality,
    ]);

    return GvHeroCard(
      background: GvImagePlaceholder(
        aspectRatio: 1,
        icon: Icons.person_outline,
        borderRadius: BorderRadius.zero,
        semanticLabel: l10n.driverPortraitPlaceholder,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.end,
        children: <Widget>[
          if (chip != null) GvStatusChip(label: chip),
          const SizedBox(height: GvSpacing.sm),
          Semantics(
            header: true,
            child: Text(profile.driver.fullName, style: GvTypography.pageTitle),
          ),
          if (subtitle != null) Text(subtitle, style: GvTypography.bodyM),
        ],
      ),
    );
  }
}
