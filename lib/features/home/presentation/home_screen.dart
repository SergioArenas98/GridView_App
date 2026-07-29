import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/calendar_entry.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/widgets/mock_data_banner.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';
import '../application/home_providers.dart';
import '../application/home_state.dart';
import '../application/home_ui_state.dart';
import '../domain/home_module_availability.dart';
import 'home_formatting.dart';
import 'widgets/home_hero.dart';
import 'widgets/home_latest_result_card.dart';
import 'widgets/home_leader_card.dart';
import 'widgets/home_session_block.dart';
import 'widgets/home_upcoming_list.dart';

/// Home: the season-focused dashboard.
///
/// Every module reads a Drift-backed domain read model through
/// [homeStateProvider] — no DTO, Dio object or Drift row reaches this tree.
/// Cached content renders immediately, so the first frame never waits for the
/// network, and building or rebuilding the screen produces **no** request:
/// startup and foreground synchronization of the current-season core set belong
/// to the application coordinator (ADR 0015). Pull-to-refresh and the app-bar
/// action go through that coordinator's single manual entry point, and Home
/// never synchronises a Grand Prix, result or entity detail.
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

    return GvScreenScaffold(
      title: l10n.appTitle,
      showSettingsAction: true,
      extraActions: <Widget>[
        GvIconButton(
          key: const ValueKey<String>('home-refresh'),
          icon: Icons.refresh,
          semanticLabel: l10n.homeRefreshAction,
          onPressed: _refresh,
        ),
      ],
      body: switch (state) {
        HomeLoading() => const _HomeSkeleton(),
        HomeSeasonContextUnavailable() => _HomeFailure(
          title: l10n.homeSeasonUnavailableTitle,
          message: l10n.homeSeasonUnavailableMessage,
          onRetry: _refresh,
        ),
        HomeFirstLoadError(:final failure) => _HomeFailure(
          title: l10n.homeErrorTitle,
          message: failureMessage(l10n, failure),
          onRetry: _refresh,
        ),
        HomeSeasonEmpty() => _HomeSeasonEmpty(
          state: state,
          controller: _controller,
          onRefresh: _refresh,
        ),
        HomeReady() => _HomeDashboard(
          state: state,
          controller: _controller,
          onRefresh: _refresh,
        ),
      },
    );
  }
}

/// The complete dashboard: one primary vertical scrollable, no nested scroll
/// views, and no provider or controller per card.
class _HomeDashboard extends ConsumerWidget {
  const _HomeDashboard({
    required this.state,
    required this.controller,
    required this.onRefresh,
  });

  final HomeReady state;
  final ScrollController controller;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final HomeFormatter format = _formatter(context);
    final DateTime now = ref.watch(clockProvider)();
    final int season = state.seasonYear;
    final bool showMock = ref.watch(usesMockDataProvider);

    void openGrandPrix(int round) =>
        context.openEntity(RoutePaths.grandPrix(season: season, round: round));

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        controller: controller,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        children: <Widget>[
          _SeasonHeading(season: season),
          if (showMock) ...<Widget>[
            const SizedBox(height: GvSpacing.md),
            const MockDataBanner(),
          ],
          _HomeNotices(state: state),
          const SizedBox(height: GvSpacing.xl),

          // --- Relevant Grand Prix hero -----------------------------------
          GvScreenSection(
            title: format.heroTitle(state.phase),
            child: HomeHero(
              module: state.event,
              format: format,
              now: now,
              onOpen: () => openGrandPrix(state.event.round),
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // --- Session timing ----------------------------------------------
          GvScreenSection(
            title: l10n.homeSessions,
            child: HomeSessionBlock(
              module: state.event,
              format: format,
              now: now,
              onOpen: () => openGrandPrix(state.event.round),
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // --- Championship snapshot ---------------------------------------
          GvScreenSection(
            title: l10n.homeDriversLeaderTitle,
            actionLabel: l10n.driverViewStandings,
            onAction: () =>
                _goToBranch(context, RoutePaths.standingsDrivers(season)),
            child: HomeLeaderCard(
              cardKey: 'home-driver-leader',
              championshipLabel: l10n.homeDriversLeaderTitle,
              module: state.driverLeader,
              format: format,
              onOpenStandings: () =>
                  _goToBranch(context, RoutePaths.standingsDrivers(season)),
              onOpenEntity: (String id) =>
                  context.openEntity(RoutePaths.driver(id), season: season),
              openEntitySemanticLabel: l10n.homeOpenDriver,
            ),
          ),
          const SizedBox(height: GvSpacing.lg),
          GvScreenSection(
            title: l10n.homeTeamsLeaderTitle,
            actionLabel: l10n.teamViewStandings,
            onAction: () =>
                _goToBranch(context, RoutePaths.standingsConstructors(season)),
            child: HomeLeaderCard(
              cardKey: 'home-team-leader',
              championshipLabel: l10n.homeTeamsLeaderTitle,
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
          const SizedBox(height: GvSpacing.xl),

          // --- Latest completed Grand Prix ----------------------------------
          if (state.latestResult case final latest?) ...<Widget>[
            GvScreenSection(
              title: l10n.homeLatestResult,
              child: HomeLatestResultCard(
                module: latest,
                format: format,
                onOpen: () => openGrandPrix(latest.round),
              ),
            ),
            const SizedBox(height: GvSpacing.xl),
          ],

          // --- Upcoming events ----------------------------------------------
          GvScreenSection(
            title: l10n.homeUpcoming,
            actionLabel: l10n.homeViewCalendar,
            onAction: () => _goToBranch(context, RoutePaths.calendar),
            // Four distinct outcomes, never blurred into one: nothing is known
            // yet; the calendar cannot answer; it answered that no races
            // remain; it listed them. Events already stored stay on screen
            // while the first two are being told apart.
            child: switch (state.upcoming.availability) {
              HomeModuleAvailability.resolving =>
                state.upcoming.events.isEmpty
                    ? const _ResolvingModule(
                        moduleKey: 'home-upcoming-resolving',
                      )
                    : HomeUpcomingList(
                        module: state.upcoming,
                        onOpen: (CalendarEntry entry) =>
                            openGrandPrix(entry.round),
                      ),
              HomeModuleAvailability.unavailable => _EmptyModule(
                message: l10n.homeUpcomingUnavailable,
              ),
              HomeModuleAvailability.availableEmpty => _EmptyModule(
                message: l10n.homeNoUpcomingEvents,
              ),
              HomeModuleAvailability.available => HomeUpcomingList(
                module: state.upcoming,
                onOpen: (CalendarEntry entry) => openGrandPrix(entry.round),
              ),
            },
          ),
          const SizedBox(height: GvSpacing.xl),

          const _HomeQuickLinks(),
        ],
      ),
    );
  }
}

/// A valid season with no known events: a real state, never a loader and never
/// an error. The shell, Settings and every other destination stay usable.
class _HomeSeasonEmpty extends ConsumerWidget {
  const _HomeSeasonEmpty({
    required this.state,
    required this.controller,
    required this.onRefresh,
  });

  final HomeSeasonEmpty state;
  final ScrollController controller;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool showMock = ref.watch(usesMockDataProvider);

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        controller: controller,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        children: <Widget>[
          _SeasonHeading(season: state.seasonYear),
          if (showMock) ...<Widget>[
            const SizedBox(height: GvSpacing.md),
            const MockDataBanner(),
          ],
          if (state.refreshError != null || state.provenance.isStale)
            Padding(
              padding: const EdgeInsets.only(top: GvSpacing.md),
              child: GvOfflineNotice(
                message: state.refreshError != null
                    ? l10n.homeUpdateFailed
                    : l10n.homeCachedNotice,
              ),
            ),
          const SizedBox(height: GvSpacing.xl),
          GvEmptyState(
            key: const ValueKey<String>('home-season-empty'),
            title: l10n.homeCalendarUnavailableTitle,
            message: l10n.homeCalendarUnavailableMessage,
            icon: Icons.event_busy_outlined,
          ),
          const SizedBox(height: GvSpacing.xl),
          const _HomeQuickLinks(),
        ],
      ),
    );
  }
}

/// Shortcuts to the other primary destinations. They stay useful in an empty or
/// partial season, and each destination remains responsible for its own loading
/// and empty states.
class _HomeQuickLinks extends StatelessWidget {
  const _HomeQuickLinks();

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GvScreenSection(
      title: l10n.homeQuickLinks,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _link(
            context,
            key: 'home-quick-drivers',
            label: l10n.exploreDrivers,
            semanticLabel: l10n.homeOpenDrivers,
            location: RoutePaths.exploreDrivers(),
          ),
          const SizedBox(height: GvSpacing.xs),
          _link(
            context,
            key: 'home-quick-teams',
            label: l10n.exploreTeams,
            semanticLabel: l10n.homeOpenTeams,
            location: RoutePaths.exploreTeams(),
          ),
          const SizedBox(height: GvSpacing.xs),
          _link(
            context,
            key: 'home-quick-circuits',
            label: l10n.exploreCircuits,
            semanticLabel: l10n.homeOpenCircuits,
            location: RoutePaths.exploreCircuits(),
          ),
        ],
      ),
    );
  }

  Widget _link(
    BuildContext context, {
    required String key,
    required String label,
    required String semanticLabel,
    required String location,
  }) => Semantics(
    button: true,
    label: semanticLabel,
    child: ExcludeSemantics(
      child: GvSecondaryButton(
        key: ValueKey<String>(key),
        label: label,
        icon: Icons.arrow_forward,
        onPressed: () => _goToBranch(context, location),
      ),
    ),
  );
}

/// The season heading. A semantic heading, and never a hardcoded year.
class _SeasonHeading extends StatelessWidget {
  const _SeasonHeading({required this.season});

  final int season;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Semantics(
      header: true,
      child: Text(l10n.seasonLabel('$season'), style: context.gvText.displayL),
    );
  }
}

/// Home's discreet freshness / partial-data communication.
///
/// It deliberately publishes **no** single screen-wide "updated" timestamp:
/// Home's modules come from several resources that are synchronised
/// independently, so one time would falsely imply they were all refreshed at
/// that moment. An exact time is shown only for the Home resource itself, and
/// only when that resource has actually synchronised under its own key — a
/// representation materialized by an accepted bootstrap therefore shows none.
/// Anything wider is expressed as safe aggregate uncertainty.
class _HomeNotices extends StatelessWidget {
  const _HomeNotices({required this.state});

  final HomeReady state;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final DateTime? updated = state.homeProvenance.lastSuccessAt;
    final bool failed = state.refreshError != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (state.refreshing)
          Padding(
            padding: const EdgeInsets.only(top: GvSpacing.xs),
            child: Text(
              l10n.standingsRefreshingLabel,
              style: context.gvText.caption,
            ),
          )
        else if (updated != null)
          Padding(
            padding: const EdgeInsets.only(top: GvSpacing.xs),
            child: Text(
              l10n.homeUpdated(
                DateFormat.Hm(
                  Localizations.localeOf(context).languageCode,
                ).format(updated.toLocal()),
              ),
              style: context.gvText.caption,
            ),
          ),
        if (failed || state.hasStaleSection || state.isPartial)
          Padding(
            padding: const EdgeInsets.only(top: GvSpacing.md),
            child: GvOfflineNotice(
              key: const ValueKey<String>('home-notice'),
              message: failed
                  ? l10n.homeUpdateFailed
                  : state.hasStaleSection
                  ? l10n.homeSomeInformationOutdated
                  : l10n.homeSomeInformationUnavailable,
            ),
          ),
      ],
    );
  }
}

/// A module whose materialization has not been read yet.
///
/// Deliberately silent: it asserts neither "nothing here" nor "unavailable",
/// because neither is known. A restrained static block keeps the section's
/// height stable so the resolved content does not jump into place — it is not
/// animated, it triggers nothing, and it never replaces the page with a loader.
class _ResolvingModule extends StatelessWidget {
  const _ResolvingModule({required this.moduleKey});

  final String moduleKey;

  @override
  Widget build(BuildContext context) => Container(
    key: ValueKey<String>(moduleKey),
    height: 44,
    decoration: BoxDecoration(
      color: context.gvColors.surfaceElevated,
      borderRadius: GvRadii.smAll,
    ),
  );
}

/// A module that is genuinely unavailable: one concise line rather than an empty
/// card shell or a broken separator.
class _EmptyModule extends StatelessWidget {
  const _EmptyModule({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Text(
    message,
    style: context.gvText.bodyM.copyWith(color: context.gvColors.textSecondary),
  );
}

/// A first-load failure. The global shell, the bottom navigation and Settings all
/// stay usable — the user is never trapped on a splash screen.
class _HomeFailure extends StatelessWidget {
  const _HomeFailure({
    required this.title,
    required this.message,
    required this.onRetry,
  });

  final String title;
  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GvErrorState(
      title: title,
      message: message,
      icon: Icons.wifi_off_outlined,
      retryLabel: l10n.retry,
      onRetry: onRetry,
    );
  }
}

/// The structured first-load frame, shown only while no Home representation has
/// been materialized for the resolved season.
class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        GvSpacing.md,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.xxl,
      ),
      children: const <Widget>[
        GvSkeletonBlock(width: 160, height: 28),
        SizedBox(height: GvSpacing.xl),
        GvSkeletonCard(),
        SizedBox(height: GvSpacing.xl),
        GvSkeletonBlock(width: 140, height: 18),
        SizedBox(height: GvSpacing.md),
        GvSkeletonBlock(height: 48),
        SizedBox(height: GvSpacing.sm),
        GvSkeletonBlock(height: 48),
        SizedBox(height: GvSpacing.xl),
        GvSkeletonBlock(width: 140, height: 18),
        SizedBox(height: GvSpacing.md),
        GvSkeletonBlock(height: 64),
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

HomeFormatter _formatter(BuildContext context) => HomeFormatter(
  AppLocalizations.of(context),
  Localizations.localeOf(context).toLanguageTag(),
);
