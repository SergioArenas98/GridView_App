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
import '../../shared/domain/entities/season_card.dart';
import '../../shared/domain/entities/season_entry.dart';
import '../../shared/domain/entities/standing.dart';
import '../../shared/domain/media/media_slot_policy.dart';
import '../../shared/domain/media/media_variant_selector.dart';
import '../../shared/presentation/entity_formatting.dart';
import '../../shared/presentation/media_slot.dart';
import '../../shared/presentation/widgets/primer_detail_app_bar.dart';
import '../../shared/presentation/widgets/primer_detail_notices.dart';
import '../../shared/presentation/widgets/primer_detail_parts.dart';
import '../../shared/presentation/widgets/primer_detail_states.dart';
import '../application/team_detail_providers.dart';
import 'widgets/team_banner.dart';
import 'widgets/team_lineup.dart';
import 'widgets/team_sections.dart';

/// Team detail for one exact season, in Primer V2 (Step 55C.10; Dark and
/// Light; frozen reference `light-rollout-b1/td-*`, TM-01..03, XT-3, LT-13).
///
/// "Team" is the product vocabulary; **Constructor** stays the technical
/// domain, repository, resource-key and route vocabulary, so the route
/// remains `/constructors/:constructorId` and nothing in the contract is
/// renamed.
///
/// Season branding decides the display name while the stable constructor
/// identity is preserved unchanged, so a rebranded team keeps its identity,
/// its place in the collection and its history. The line-up is derived from
/// the season's driver participation entries — the single local source of
/// truth for membership — so mid-season arrivals and exits stay
/// representable. State, providers, routing and the roster order are
/// unchanged; this file only presents them.
///
/// The screen stays useful without media, a biography, a principal, a base,
/// a power unit, a chassis, a standing or a complete line-up: each absent
/// part is omitted, never shown as an empty block or a zero.
class ConstructorDetailScreen extends ConsumerWidget {
  const ConstructorDetailScreen({
    super.key,
    required this.constructorId,
    this.originSeason,
  });

  final String constructorId;

  /// The season handed over by the originating screen, or `null` for a deep
  /// link.
  final int? originSeason;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityDetailScope scope = EntityDetailScope(
      entityId: constructorId,
      originSeason: originSeason,
    );
    final EntityDetailState<TeamProfile> state = ref.watch(
      teamDetailStateProvider(scope),
    );
    void retry() =>
        ref.read(teamDetailControllerProvider(scope).notifier).retry();

    return Scaffold(
      backgroundColor: context.gvPrimer.surface.page,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            PrimerDetailAppBar(
              title: l10n.constructorTitle,
              backKey: const ValueKey<String>('team-detail-back'),
            ),
            Expanded(
              child: switch (state) {
                EntityDetailLoading<TeamProfile>() =>
                  const TeamDetailSkeleton(),
                EntityDetailSeasonUnavailable<TeamProfile>() =>
                  PrimerDetailMessage(
                    glyph: GvPrimerGlyph.alert,
                    title: l10n.detailSeasonUnavailableTitle,
                    message: l10n.detailSeasonUnavailableMessage,
                    retryLabel: l10n.retry,
                    onRetry: retry,
                  ),
                EntityDetailNotFound<TeamProfile>() => PrimerDetailMessage(
                  glyph: GvPrimerGlyph.help,
                  title: l10n.detailNotFoundTitle,
                  message: l10n.detailNotFoundMessage,
                ),
                EntityDetailFirstLoadError<TeamProfile>() =>
                  PrimerDetailMessage(
                    glyph: GvPrimerGlyph.alert,
                    title: l10n.detailLoadErrorTitle,
                    message: l10n.errorGeneric,
                    retryLabel: l10n.retry,
                    onRetry: retry,
                  ),
                final EntityDetailReady<TeamProfile> ready => _TeamBody(
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

/// The ready profile: notices, banner, then Championship, Drivers, Team
/// details and About (TM-01: Championship before Drivers), 32px apart,
/// ending 32px above the bottom inset. One primary scrollable.
class _TeamBody extends StatelessWidget {
  const _TeamBody({required this.ready});

  final EntityDetailReady<TeamProfile> ready;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = EntityFormatter(
      Localizations.localeOf(context).toString(),
      l10n,
    );
    final TeamProfile profile = ready.profile;
    return ListView(
      key: const ValueKey<String>('team-detail-list'),
      padding: EdgeInsets.only(
        bottom: 32 + MediaQuery.paddingOf(context).bottom,
      ),
      children: <Widget>[
        PrimerDetailNotices(
          notices: detailNotices(ready, l10n),
          blockKey: const ValueKey<String>('team-detail-notices'),
        ),
        _banner(l10n, profile),
        ..._championship(context, l10n, fmt, profile.standing),
        ..._lineup(context, l10n, fmt, profile),
        ..._seasonFacts(l10n, profile),
        ..._about(l10n, profile),
      ],
    );
  }

  /// The entrant banner: the season-aware name, the season line (the ready
  /// state's season, DR-02), the stable name only when it differs (read as
  /// "Team: …", TM-02) and the nationality, shown once, here (TEAM-01 item
  /// 3; the "Team information" card is gone). Without a nationality the
  /// country code is shown alone, as before.
  Widget _banner(AppLocalizations l10n, TeamProfile profile) {
    final String? nationality = _present(profile.constructor.nationality);
    final String? countryCode = _present(profile.constructor.countryCode);
    return TeamBanner(
      name: profile.displayName,
      seasonLine: l10n.seasonLabel('${ready.season}'),
      meta: <TeamBannerMeta>[
        if (profile.stableFallbackName case final String stable)
          TeamBannerMeta(value: stable, term: l10n.fieldTeam, stableName: true),
        if (nationality != null)
          TeamBannerMeta(value: nationality, term: l10n.fieldNationality)
        else if (countryCode != null)
          TeamBannerMeta(value: countryCode),
      ],
      teamColor: _teamColor(profile),
      media: (BuildContext context, double width) =>
          _media(context, profile, width),
    );
  }

  /// The season colour, else the constructor's; never altered.
  static Color? _teamColor(TeamProfile profile) => GvTeamAccent.parse(
    profile.seasonEntry?.colorPrimary ?? profile.constructor.colorPrimary,
  );

  /// The constructor's stable imagery (never a season livery).
  static MediaImageRequest? _media(
    BuildContext context,
    TeamProfile profile,
    double width,
  ) => resolveMediaSlot(
    context,
    media: profile.media,
    preference: MediaSlotPolicy.constructorMark,
    role: MediaDisplayRole.detail,
    logicalWidth: width,
  );

  /// The constructors' championship for the exact season, only with a
  /// standing. A null position is the word "Unranked", never 0; null points
  /// render empty (unchanged); wins only when present, a confirmed zero
  /// kept.
  List<Widget> _championship(
    BuildContext context,
    AppLocalizations l10n,
    EntityFormatter fmt,
    ConstructorStanding? standing,
  ) {
    if (standing == null) return const <Widget>[];
    return <Widget>[
      ..._section(l10n.teamChampionshipSection, 'championship'),
      TeamChampionship(
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
          if (fmt.count(standing.wins) case final String wins)
            GvPrimerStat(label: l10n.fieldWins, value: wins),
        ],
        provisionalLabel: (standing.provisional ?? false)
            ? l10n.resultStatusProvisional
            : null,
        // Content-aware lines (Step 55C.10R, owner-approved Step 55C.10F):
        // ordinary figures keep the approved row; wide figures stack under
        // Position instead of splitting a label.
        fitStats: true,
        standingsLabel: l10n.teamViewStandings,
        // A Standings table lives inside the shell: change branch (or return
        // to the table this team was opened from), never push it here.
        onOpenStandings: () => context.openBranchDestination(
          RoutePaths.standingsConstructors(ready.season),
        ),
      ),
    ];
  }

  /// The season line-up, derived from participation entries, in the order
  /// the read model supplies. Each real driver is rendered with their own
  /// span, so two spans are never flattened into a false simultaneous
  /// line-up; a span is printed only when a boundary was observed.
  /// Unresolved driver stubs are omitted upstream and never become invented
  /// names here.
  List<Widget> _lineup(
    BuildContext context,
    AppLocalizations l10n,
    EntityFormatter fmt,
    TeamProfile profile,
  ) {
    final List<TeamLineupMember> lineup = profile.lineup;
    if (lineup.isEmpty) return const <Widget>[];
    return <Widget>[
      ..._section(l10n.teamLineupSection, 'lineup'),
      const SizedBox(height: 10),
      TeamLineup(
        teamColor: _teamColor(profile),
        terms: TeamLineupTerms(
          raceNumber: l10n.driverRaceNumber,
          participation: l10n.fieldParticipation,
          role: l10n.fieldRole,
        ),
        entries: <TeamLineupEntry>[
          for (final TeamLineupMember m in lineup)
            TeamLineupEntry(
              entryId: m.entryId,
              name: m.name,
              linkLabel: l10n.teamOpenDriver(m.name),
              role: fmt.role(m.role),
              number: fmt.count(m.raceNumber),
              code: _present(m.shortCode),
              span: m.hasObservedBoundary
                  ? _keepRoundNumber(
                      fmt.participationSpan(
                        startRound: m.startRound,
                        endRound: m.endRound,
                      ),
                    )
                  : null,
              onOpen: () => context.openEntity(
                RoutePaths.driver(m.driverId),
                season: ready.season,
              ),
            ),
        ],
      ),
    ];
  }

  /// The season's own facts as the spec sheet, only when at least one is
  /// present.
  List<Widget> _seasonFacts(AppLocalizations l10n, TeamProfile profile) {
    final ConstructorSeasonEntry? entry = profile.seasonEntry;
    if (entry == null || !profile.hasSeasonFacts) return const <Widget>[];
    final List<TeamSpec> specs = <TeamSpec>[
      if (_present(entry.powerUnit) case final String powerUnit)
        TeamSpec(label: l10n.fieldPowerUnit, value: powerUnit),
      if (_present(entry.teamPrincipal) case final String principal)
        TeamSpec(label: l10n.fieldTeamPrincipal, value: principal),
      if (_present(entry.base) case final String base)
        TeamSpec(label: l10n.fieldBase, value: base),
      if (_present(entry.chassis) case final String chassis)
        TeamSpec(label: l10n.fieldChassis, value: chassis),
    ];
    if (specs.isEmpty) return const <Widget>[];
    return <Widget>[
      ..._section(l10n.teamFactsSection, 'facts'),
      const SizedBox(height: 10),
      TeamSpecSheet(specs: specs),
    ];
  }

  /// The trimmed biography without a card (TEAM-01 item 9 pending), only
  /// when it is not blank.
  List<Widget> _about(AppLocalizations l10n, TeamProfile profile) {
    final String? biography = _present(profile.constructor.biography);
    if (biography == null) return const <Widget>[];
    return <Widget>[
      ..._section(l10n.teamAbout, 'about'),
      const SizedBox(height: 10),
      PrimerDetailAbout(biography),
    ];
  }

  /// A section's 32px gap and its title on the gutter.
  static List<Widget> _section(String title, String id) => <Widget>[
    const SizedBox(height: 32),
    Padding(
      key: ValueKey<String>('team-section-$id'),
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
  /// never orphans the number at large text (as Driver Detail; the ARB copy
  /// is unchanged).
  static String _keepRoundNumber(String span) =>
      span.replaceAllMapped(RegExp(r' (\d)'), (Match m) => '\u00A0${m[1]}');
}
