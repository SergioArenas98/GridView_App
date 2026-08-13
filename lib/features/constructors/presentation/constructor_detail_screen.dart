import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
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
import '../../shared/presentation/widgets/entity_detail_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';
import '../application/team_detail_providers.dart';

/// Team detail for one exact season.
///
/// "Team" is the product vocabulary; **Constructor** stays the technical domain,
/// repository, resource-key and route vocabulary, so the route remains
/// `/constructors/:constructorId` and nothing in the contract is renamed.
///
/// Season branding decides the display name while the stable constructor
/// identity is preserved unchanged, so a rebranded team keeps its identity, its
/// place in the collection and its history. The line-up is derived from the
/// season's driver participation entries — the single local source of truth for
/// membership — so mid-season arrivals and exits stay representable.
///
/// The screen stays useful without media, a biography, a principal, a base, a
/// power unit, a chassis, a standing or a complete line-up.
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

    return EntityDetailScaffold<TeamProfile>(
      title: l10n.constructorTitle,
      state: ref.watch(teamDetailStateProvider(scope)),
      onRetry: () =>
          ref.read(teamDetailControllerProvider(scope).notifier).retry(),
      builder: _body,
    );
  }

  List<Widget> _body(
    BuildContext context,
    EntityDetailReady<TeamProfile> ready,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EntityFormatter fmt = EntityFormatter(
      Localizations.localeOf(context).toString(),
      l10n,
    );
    return <Widget>[
      _TeamHero(profile: ready.profile),
      const SizedBox(height: GvSpacing.xl),
      ..._championship(context, ready, fmt),
      ..._lineup(context, ready, fmt),
      ..._seasonFacts(context, ready.profile),
      ..._profileFacts(context, ready.profile),
    ];
  }

  /// The constructors' championship summary for the exact selected season.
  List<Widget> _championship(
    BuildContext context,
    EntityDetailReady<TeamProfile> ready,
    EntityFormatter fmt,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ConstructorStanding? standing = ready.profile.standing;
    if (standing == null) return const <Widget>[];
    return <Widget>[
      GvScreenSection(
        title: l10n.teamChampionshipSection,
        actionLabel: l10n.teamViewStandings,
        onAction: () => context.openEntity(
          RoutePaths.standingsConstructors(ready.season),
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

  /// The season line-up, derived from participation entries.
  ///
  /// Each real driver is rendered with their own span, so two spans are never
  /// flattened into a false simultaneous line-up. Unresolved driver stubs are
  /// omitted upstream and never become invented names here.
  List<Widget> _lineup(
    BuildContext context,
    EntityDetailReady<TeamProfile> ready,
    EntityFormatter fmt,
  ) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<TeamLineupMember> lineup = ready.profile.lineup;
    if (lineup.isEmpty) return const <Widget>[];
    return <Widget>[
      GvScreenSection(
        title: l10n.teamLineupSection,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            for (final TeamLineupMember m in lineup)
              GvDriverRow(
                key: ValueKey<String>('team-lineup-${m.driverId}'),
                name: m.name,
                subtitle: EntityFormatter.joinDetails(<String?>[
                  fmt.role(m.role),
                  m.isFullSeason
                      ? null
                      : fmt.participationSpan(
                          startRound: m.startRound,
                          endRound: m.endRound,
                        ),
                ]),
                number: fmt.count(m.raceNumber),
                shortCode: m.shortCode,
                semanticLabel: l10n.teamOpenDriver(m.name),
                onTap: () => context.openEntity(
                  RoutePaths.driver(m.driverId),
                  season: ready.season,
                ),
              ),
          ],
        ),
      ),
      const SizedBox(height: GvSpacing.xl),
    ];
  }

  /// The season's own facts. Rendered only when at least one is present, so an
  /// empty facts card is never shown.
  List<Widget> _seasonFacts(BuildContext context, TeamProfile profile) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ConstructorSeasonEntry? entry = profile.seasonEntry;
    if (entry == null || !profile.hasSeasonFacts) return const <Widget>[];
    return <Widget>[
      GvScreenSection(
        title: l10n.teamFactsSection,
        child: GvInfoCard(
          children: <Widget>[
            if (entry.powerUnit case final String powerUnit)
              GvDetailField(label: l10n.fieldPowerUnit, value: powerUnit),
            if (entry.teamPrincipal case final String principal)
              GvDetailField(label: l10n.fieldTeamPrincipal, value: principal),
            if (entry.base case final String base)
              GvDetailField(label: l10n.fieldBase, value: base),
            if (entry.chassis case final String chassis)
              GvDetailField(label: l10n.fieldChassis, value: chassis),
          ],
        ),
      ),
      const SizedBox(height: GvSpacing.xl),
    ];
  }

  /// The stable identity's own facts and curated biography.
  List<Widget> _profileFacts(BuildContext context, TeamProfile profile) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (!profile.hasProfileFacts) return const <Widget>[];
    final String? biography = profile.constructor.biography?.trim();
    final List<Widget> fields = <Widget>[
      if (profile.constructor.nationality case final String nationality)
        GvDetailField(label: l10n.fieldNationality, value: nationality),
    ];
    return <Widget>[
      if (fields.isNotEmpty) ...<Widget>[
        GvScreenSection(
          title: l10n.constructorInformation,
          child: GvInfoCard(children: fields),
        ),
        const SizedBox(height: GvSpacing.xl),
      ],
      if (biography != null && biography.isNotEmpty) ...<Widget>[
        GvScreenSection(
          title: l10n.teamAbout,
          child: GvContentCard(
            child: Text(biography, style: context.gvText.bodyM),
          ),
        ),
        const SizedBox(height: GvSpacing.xl),
      ],
    ];
  }
}

/// The team hero: season branding, the stable fallback name when it differs, a
/// contrast-safe team colour and the constructor's own mark when one is available
/// locally.
///
/// The image is the constructor's **stable** identity imagery, never presented as
/// this season's livery: `ConstructorSeasonEntry` carries no media field, so the
/// contract cannot express season-specific branding and this build does not
/// pretend otherwise — even though [TeamProfile.displayName] above it may well be
/// a season brand. It is decorative, because that name is the adjacent heading.
class _TeamHero extends StatelessWidget {
  const _TeamHero({required this.profile});

  final TeamProfile profile;

  @override
  Widget build(BuildContext context) {
    final Color? accent = GvTeamAccent.parse(
      profile.seasonEntry?.colorPrimary ?? profile.constructor.colorPrimary,
    );
    final String? subtitle = EntityFormatter.joinDetails(<String?>[
      profile.stableFallbackName,
      profile.constructor.nationality ?? profile.constructor.countryCode,
    ]);

    return GvHeroCard(
      background: GvRemoteImage(
        request: resolveMediaSlot(
          context,
          media: profile.media,
          preference: MediaSlotPolicy.constructorMark,
          role: MediaDisplayRole.detail,
          logicalWidth: MediaQuery.sizeOf(context).width,
        ),
        aspectRatio: 16 / 9,
        logicalWidth: MediaQuery.sizeOf(context).width,
        placeholderIcon: Icons.shield_outlined,
        borderRadius: BorderRadius.zero,
        decorative: true,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.end,
        children: <Widget>[
          if (accent != null) ...<Widget>[
            Container(
              width: 48,
              height: 4,
              decoration: BoxDecoration(
                color: accent,
                borderRadius: GvRadii.pillAll,
              ),
            ),
            const SizedBox(height: GvSpacing.sm),
          ],
          Semantics(
            header: true,
            child: Text(profile.displayName, style: context.gvText.pageTitle),
          ),
          if (subtitle != null) Text(subtitle, style: context.gvText.bodyM),
        ],
      ),
    );
  }
}
