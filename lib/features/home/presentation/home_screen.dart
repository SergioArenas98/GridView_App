import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/theme.dart';
import '../../../core/time/session_time_scope.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/calendar_entry.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/widgets/mock_data_banner.dart';
import '../application/home_providers.dart';
import '../application/home_state.dart';
import '../application/home_ui_state.dart';
import '../domain/home_module_availability.dart';
import '../domain/home_temporal_state.dart';
import 'home_formatting.dart';
import 'widgets/home_explore_strip.dart';
import 'widgets/home_header.dart';
import 'widgets/home_hero.dart';
import 'widgets/home_latest_result_card.dart';
import 'widgets/home_leader_card.dart';
import 'widgets/home_notices.dart';
import 'widgets/home_session_block.dart';
import 'widgets/home_upcoming_list.dart';

/// Home: the season-focused dashboard, in Primer V2 (Step 55C.1).
///
/// Every module reads a Drift-backed domain read model through
/// [homeStateProvider] — no DTO, Dio object or Drift row reaches this tree.
/// Cached content renders immediately, so the first frame never waits for the
/// network, and building or rebuilding the screen produces **no** request:
/// startup and foreground synchronization of the current-season core set belong
/// to the application coordinator (ADR 0015). Pull-to-refresh and the header
/// action go through that coordinator's single manual entry point, and Home
/// never synchronises a Grand Prix, result or entity detail.
///
/// The header scrolls with the content. The global bottom navigation stays the
/// shell's; content scrolls clear of it because the shell reserves its space.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  late final ScrollController _controller;

  @override
  void initState() {
    super.initState();
    _controller = ScrollController(
      initialScrollOffset: ref
          .read(homeUiStateProvider)
          .offsetFor(ref.read(currentSeasonProvider).value),
    )..addListener(_remember);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _remember() {
    if (!_controller.hasClients) return;
    ref
        .read(homeUiStateProvider.notifier)
        .rememberOffset(
          season: ref.read(currentSeasonProvider).value,
          offset: _controller.offset,
        );
  }

  Future<void> _refresh() =>
      ref.read(homeControllerProvider.notifier).refresh();

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final HomeState state = ref.watch(homeStateProvider);
    final GvPrimerRoles roles = context.gvPrimer;

    HomeHeader header({String? season, String? caption}) => HomeHeader(
      season: season,
      caption: caption,
      onRefresh: _refresh,
      onOpenSettings: () => context.openSettings(),
    );

    final Widget body = switch (state) {
      HomeLoading() => _HomeSkeleton(header: header()),
      HomeSeasonContextUnavailable() => _HomeFailure(
        header: header(),
        title: l10n.homeSeasonUnavailableTitle,
        message: l10n.homeSeasonUnavailableMessage,
        onRetry: _refresh,
      ),
      HomeFirstLoadError(:final failure) => _HomeFailure(
        header: header(),
        title: l10n.homeErrorTitle,
        message: failureMessage(l10n, failure),
        onRetry: _refresh,
      ),
      HomeSeasonEmpty() => _HomeSeasonEmpty(
        header: header(season: l10n.seasonLabel('${state.seasonYear}')),
        state: state,
        controller: _controller,
        onRefresh: _refresh,
      ),
      HomeReady() => _HomeDashboard(
        header: header(
          season: l10n.seasonLabel('${state.seasonYear}'),
          caption: _freshnessCaption(context, l10n, state),
        ),
        state: state,
        controller: _controller,
        onRefresh: _refresh,
      ),
    };

    return Scaffold(
      backgroundColor: roles.surface.page,
      body: SafeArea(child: body),
    );
  }

  /// The header caption. Home publishes **no** screen-wide "updated" time:
  /// its modules come from independently synchronised resources. An exact
  /// time is shown only for the Home resource itself, and only when it has
  /// synchronised under its own key (a bootstrap-materialized representation
  /// shows none). While a refresh runs the caption says so instead.
  String? _freshnessCaption(
    BuildContext context,
    AppLocalizations l10n,
    HomeReady state,
  ) {
    if (state.refreshing) return l10n.standingsRefreshingLabel;
    final DateTime? updated = state.homeProvenance.lastSuccessAt;
    if (updated == null) return null;
    return l10n.homeUpdated(
      DateFormat.Hm(
        Localizations.localeOf(context).languageCode,
      ).format(updated.toLocal()),
    );
  }
}

/// Section rhythm (`.home`): 16px top, 32px between sections, 24px at the end
/// (the shell already reserves the navigation's height and inset).
const double _sectionGap = 32;

EdgeInsets get _gutter =>
    const EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter);

/// The complete dashboard: one primary vertical scrollable, no nested scroll
/// views, and no provider or controller per module.
class _HomeDashboard extends ConsumerWidget {
  const _HomeDashboard({
    required this.header,
    required this.state,
    required this.controller,
    required this.onRefresh,
  });

  final Widget header;
  final HomeReady state;
  final ScrollController controller;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final HomeFormatter format = _formatter(context, ref);
    final DateTime now = ref.watch(clockProvider)();
    final int season = state.seasonYear;
    final bool showMock = ref.watch(usesMockDataProvider);
    final List<HomeNoticeSpec> notices = homeReadyNotices(state, l10n);

    void openGrandPrix(int round) =>
        context.openEntity(RoutePaths.grandPrix(season: season, round: round));

    // HM-01: under "Next Grand Prix", a calendar that answered "no races
    // left" makes the secondary section redundant. Both conditions are
    // required; an empty list alone never hides it.
    final bool omitUpcoming =
        state.phase == HomeTemporalPhase.preEvent &&
        state.upcoming.availability == HomeModuleAvailability.availableEmpty;

    return _HomeRefresh(
      onRefresh: onRefresh,
      child: ListView(
        controller: controller,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 24),
        children: <Widget>[
          header,
          if (showMock)
            Padding(
              padding: _gutter.copyWith(top: 12),
              child: const MockDataBanner(),
            ),
          if (notices.isNotEmpty)
            Padding(
              padding: _gutter.copyWith(top: 16),
              child: HomeNotices(notices: notices),
            ),
          const SizedBox(height: 16),

          // --- Featured Grand Prix ------------------------------------------
          Padding(
            padding: _gutter,
            child: HomeHero(
              module: state.event,
              format: format,
              now: now,
              onOpen: () => openGrandPrix(state.event.round),
            ),
          ),
          const SizedBox(height: _sectionGap),

          // --- Weekend sessions (full-bleed band) ----------------------------
          HomeSessionBlock(
            module: state.event,
            format: format,
            onOpen: () => openGrandPrix(state.event.round),
          ),
          const SizedBox(height: _sectionGap),

          // --- Championship band ----------------------------------------------
          Padding(
            padding: _gutter,
            child: HomeChampionshipBand(
              driver: HomeLeaderCard(
                cardKey: 'home-driver-leader',
                championshipLabel: l10n.homeDriversLeaderTitle,
                standingsLabel: l10n.driverViewStandings,
                module: state.driverLeader,
                format: format,
                onOpenStandings: () =>
                    _goToBranch(context, RoutePaths.standingsDrivers(season)),
                onOpenEntity: (String id) =>
                    context.openEntity(RoutePaths.driver(id), season: season),
                openEntitySemanticLabel: l10n.homeOpenDriver,
              ),
              team: HomeLeaderCard(
                cardKey: 'home-team-leader',
                championshipLabel: l10n.homeTeamsLeaderTitle,
                standingsLabel: l10n.teamViewStandings,
                module: state.teamLeader,
                format: format,
                onOpenStandings: () => _goToBranch(
                  context,
                  RoutePaths.standingsConstructors(season),
                ),
                onOpenEntity: (String id) => context.openEntity(
                  RoutePaths.constructor(id),
                  season: season,
                ),
                openEntitySemanticLabel: l10n.homeOpenTeam,
              ),
            ),
          ),
          const SizedBox(height: _sectionGap),

          // --- Latest completed Grand Prix ----------------------------------
          if (state.latestResult case final latest?) ...<Widget>[
            Padding(
              padding: _gutter,
              child: HomeLatestResultCard(
                module: latest,
                format: format,
                onOpen: () => openGrandPrix(latest.round),
              ),
            ),
            const SizedBox(height: _sectionGap),
          ],

          // --- Upcoming events ----------------------------------------------
          if (!omitUpcoming) ...<Widget>[
            HomeUpcomingSection(
              module: state.upcoming,
              format: format,
              onOpen: (CalendarEntry entry) => openGrandPrix(entry.round),
              onOpenCalendar: () => _goToBranch(context, RoutePaths.calendar),
            ),
            const SizedBox(height: _sectionGap),
          ],

          Padding(padding: _gutter, child: const _HomeQuickLinks()),
        ],
      ),
    );
  }
}

/// A valid season with no known events: a real state, never a loader and never
/// an error. The shell, Settings and every other destination stay usable.
class _HomeSeasonEmpty extends ConsumerWidget {
  const _HomeSeasonEmpty({
    required this.header,
    required this.state,
    required this.controller,
    required this.onRefresh,
  });

  final Widget header;
  final HomeSeasonEmpty state;
  final ScrollController controller;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool showMock = ref.watch(usesMockDataProvider);
    final List<HomeNoticeSpec> notices = homeSeasonEmptyNotices(state, l10n);

    return _HomeRefresh(
      onRefresh: onRefresh,
      child: ListView(
        controller: controller,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 24),
        children: <Widget>[
          header,
          if (showMock)
            Padding(
              padding: _gutter.copyWith(top: 12),
              child: const MockDataBanner(),
            ),
          if (notices.isNotEmpty)
            Padding(
              padding: _gutter.copyWith(top: 16),
              child: HomeNotices(notices: notices),
            ),
          GvPrimerEmptyState(
            key: const ValueKey<String>('home-season-empty'),
            icon: Icons.event_busy_outlined,
            title: l10n.homeCalendarUnavailableTitle,
            message: l10n.homeCalendarUnavailableMessage,
            size: GvPrimerEmptySize.list,
          ),
          const SizedBox(height: 8),
          Padding(padding: _gutter, child: const _HomeQuickLinks()),
        ],
      ),
    );
  }
}

/// Shortcuts to the Explore categories. They stay useful in an empty or partial
/// season; each destination owns its own loading and empty states.
class _HomeQuickLinks extends StatelessWidget {
  const _HomeQuickLinks();

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return HomeExploreStrip(
      links: <HomeExploreLink>[
        HomeExploreLink(
          key: 'home-quick-drivers',
          label: l10n.exploreDrivers,
          semanticLabel: l10n.homeOpenDrivers,
          glyph: GvPrimerGlyph.driver,
          onOpen: () => _goToBranch(context, RoutePaths.exploreDrivers()),
        ),
        HomeExploreLink(
          key: 'home-quick-teams',
          label: l10n.exploreTeams,
          semanticLabel: l10n.homeOpenTeams,
          glyph: GvPrimerGlyph.team,
          onOpen: () => _goToBranch(context, RoutePaths.exploreTeams()),
        ),
        HomeExploreLink(
          key: 'home-quick-circuits',
          label: l10n.exploreCircuits,
          semanticLabel: l10n.homeOpenCircuits,
          glyph: GvPrimerGlyph.circuit,
          onOpen: () => _goToBranch(context, RoutePaths.exploreCircuits()),
        ),
      ],
    );
  }
}

/// Pull-to-refresh in Primer roles: the accent spinner on the band.
class _HomeRefresh extends StatelessWidget {
  const _HomeRefresh({required this.onRefresh, required this.child});

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = context.gvPrimer;
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: roles.text.accent,
      backgroundColor: roles.surface.band,
      child: child,
    );
  }
}

/// A first-load failure. The header (Refresh, Settings), the bottom navigation
/// and every other destination stay usable — the user is never trapped.
class _HomeFailure extends StatelessWidget {
  const _HomeFailure({
    required this.header,
    required this.title,
    required this.message,
    required this.onRetry,
  });

  final Widget header;
  final String title;
  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: <Widget>[
        header,
        GvPrimerEmptyState(
          glyph: GvPrimerGlyph.alert,
          title: title,
          message: message,
          size: GvPrimerEmptySize.list,
          action: GvPrimerButton(label: l10n.retry, onPressed: onRetry),
        ),
      ],
    );
  }
}

/// The static first-load frame, shown only while no Home representation has
/// been materialized for the resolved season: the real header, then
/// placeholders in the shapes of the hero, the sessions band and the
/// championship band (LT-16 theme placeholders, no animation), announced once.
class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton({required this.header});

  final Widget header;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: <Widget>[
        header,
        const SizedBox(height: 16),
        GvPrimerLoading(
          semanticLabel: AppLocalizations.of(context).a11yLoading,
          child: Padding(
            padding: _gutter,
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                GvPrimerSkeleton(
                  key: ValueKey<String>('home-skeleton'),
                  height: 220,
                  radius: GvPrimerLayout.radiusLg,
                ),
                SizedBox(height: _sectionGap),
                GvPrimerSkeleton(width: 180, height: 24),
                SizedBox(height: 14),
                GvPrimerSkeleton(height: 96),
                SizedBox(height: _sectionGap),
                GvPrimerSkeleton(height: 240, radius: GvPrimerLayout.radiusLg),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Switches the shell to another primary branch.
///
/// Calendar, Standings and Explore live **inside** the bottom-navigation shell,
/// so Home reaches them by changing the active branch rather than by pushing a
/// page on top of Home's own branch. `go` also replaces rather than stacks, so a
/// repeated tap can never build a duplicate route. Only go_router's public API
/// is used.
void _goToBranch(BuildContext context, String location) => context.go(location);

HomeFormatter _formatter(BuildContext context, WidgetRef ref) => HomeFormatter(
  AppLocalizations.of(context),
  Localizations.localeOf(context).toLanguageTag(),
  sessionTimePresenterOf(context, ref),
);
