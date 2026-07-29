import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/calendar/presentation/calendar_screen.dart';
import '../../features/calendar/presentation/grand_prix_detail_screen.dart';
import '../../features/circuits/presentation/circuit_detail_screen.dart';
import '../../features/constructors/presentation/constructor_detail_screen.dart';
import '../../features/drivers/presentation/driver_detail_screen.dart';
import '../../features/explore/application/explore_state.dart';
import '../../features/explore/presentation/explore_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/settings/presentation/acknowledgements_screen.dart';
import '../../features/settings/presentation/information_screens.dart';
import '../../features/settings/presentation/preference_screens.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/shared/presentation/not_found_screen.dart';
import '../../features/standings/application/standings_state.dart';
import '../../features/standings/presentation/standings_screen.dart';
import 'app_shell.dart';
import 'entity_navigation.dart';
import 'route_names.dart';
import 'route_params.dart';
import 'route_paths.dart';

/// Builds the GridView router.
///
/// A [StatefulShellRoute.indexedStack] preserves the navigation stack and scroll
/// state of each of the four primary branches. Grand Prix detail and every
/// entity/Settings route open on the **root** navigator, above the shell, so the
/// active branch (and its scroll position) is preserved for the user to return
/// to. Unknown routes and invalid parameters resolve to a recoverable
/// not-found / invalid-route screen instead of throwing.
///
/// Navigator keys are created per call so that constructing several routers in a
/// single widget-test frame never collides on a shared [GlobalKey]. Production
/// builds the router exactly once.
///
/// [initialLocation] is exposed for tests and deep-link entry points.
GoRouter buildGridViewRouter({String initialLocation = RoutePaths.home}) {
  final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>(
    debugLabel: 'gv-root',
  );
  final GlobalKey<NavigatorState> homeNavigatorKey = GlobalKey<NavigatorState>(
    debugLabel: 'gv-home',
  );
  final GlobalKey<NavigatorState> calendarNavigatorKey =
      GlobalKey<NavigatorState>(debugLabel: 'gv-calendar');
  final GlobalKey<NavigatorState> standingsNavigatorKey =
      GlobalKey<NavigatorState>(debugLabel: 'gv-standings');
  final GlobalKey<NavigatorState> exploreNavigatorKey =
      GlobalKey<NavigatorState>(debugLabel: 'gv-explore');

  return GoRouter(
    initialLocation: initialLocation,
    navigatorKey: rootNavigatorKey,
    errorBuilder: (BuildContext context, GoRouterState state) =>
        const NotFoundScreen(),
    routes: <RouteBase>[
      StatefulShellRoute.indexedStack(
        builder:
            (
              BuildContext context,
              GoRouterState state,
              StatefulNavigationShell navigationShell,
            ) => AppShell(navigationShell: navigationShell),
        branches: <StatefulShellBranch>[
          // --- Home branch ---
          StatefulShellBranch(
            navigatorKey: homeNavigatorKey,
            routes: <RouteBase>[
              GoRoute(
                path: RoutePaths.home,
                name: RouteNames.home,
                builder: (_, _) => const HomeScreen(),
              ),
            ],
          ),

          // --- Calendar branch ---
          StatefulShellBranch(
            navigatorKey: calendarNavigatorKey,
            routes: <RouteBase>[
              GoRoute(
                path: RoutePaths.calendar,
                name: RouteNames.calendar,
                builder: (_, _) => const CalendarScreen(),
                routes: <RouteBase>[
                  // Grand Prix detail renders above the shell (root navigator)
                  // so back returns to the branch the user came from.
                  GoRoute(
                    path: RoutePaths.grandPrixRelative,
                    name: RouteNames.grandPrix,
                    parentNavigatorKey: rootNavigatorKey,
                    builder: (BuildContext context, GoRouterState state) {
                      final int? season = RouteParams.season(
                        state.pathParameters['season'],
                      );
                      final int? round = RouteParams.round(
                        state.pathParameters['round'],
                      );
                      if (season == null || round == null) {
                        return const NotFoundScreen(
                          kind: NotFoundKind.invalidParameters,
                        );
                      }
                      return GrandPrixDetailScreen(
                        season: season,
                        round: round,
                      );
                    },
                  ),
                ],
              ),
            ],
          ),

          // --- Standings branch ---
          // The branch root is season-agnostic: no season is encoded in the
          // router. The season-specific routes remain for deep links.
          StatefulShellBranch(
            navigatorKey: standingsNavigatorKey,
            initialLocation: RoutePaths.standings,
            routes: <RouteBase>[
              GoRoute(
                path: RoutePaths.standings,
                name: RouteNames.standings,
                // Season- and championship-agnostic: the screen resolves the
                // locally current season and defaults to Drivers on the first
                // visit of an application session.
                builder: (_, _) => const StandingsScreen(),
              ),
              GoRoute(
                path: RoutePaths.standingsDriversPattern,
                name: RouteNames.standingsDrivers,
                builder: (BuildContext context, GoRouterState state) =>
                    _standings(state, StandingsChampionship.drivers),
              ),
              GoRoute(
                path: RoutePaths.standingsConstructorsPattern,
                name: RouteNames.standingsConstructors,
                builder: (BuildContext context, GoRouterState state) =>
                    _standings(state, StandingsChampionship.constructors),
              ),
            ],
          ),

          // --- Explore branch ---
          // The three categories are route-addressable **siblings**, not
          // children, so selecting one replaces the Explore page inside the
          // branch instead of stacking a second Explore page on top of it. The
          // branch root opens the default category (Drivers).
          StatefulShellBranch(
            navigatorKey: exploreNavigatorKey,
            initialLocation: RoutePaths.explore,
            routes: <RouteBase>[
              GoRoute(
                path: RoutePaths.explore,
                name: RouteNames.explore,
                builder: (_, _) => const ExploreScreen(),
              ),
              GoRoute(
                path: RoutePaths.exploreDriversPattern,
                name: RouteNames.exploreDrivers,
                builder: (_, _) =>
                    const ExploreScreen(category: ExploreCategory.drivers),
              ),
              GoRoute(
                path: RoutePaths.exploreTeamsPattern,
                name: RouteNames.exploreTeams,
                builder: (_, _) =>
                    const ExploreScreen(category: ExploreCategory.teams),
              ),
              GoRoute(
                path: RoutePaths.exploreCircuitsPattern,
                name: RouteNames.exploreCircuits,
                builder: (_, _) =>
                    const ExploreScreen(category: ExploreCategory.circuits),
              ),
            ],
          ),
        ],
      ),

      // --- Root-level detail + Settings routes (above the shell) ---
      // Each detail route carries only the stable entity id. The season context
      // travels as typed navigation metadata (`EntityNavigationOrigin`), so a
      // historical origin keeps its exact season and a deep link (which carries
      // none) resolves the current season locally.
      GoRoute(
        path: RoutePaths.driverPattern,
        name: RouteNames.driver,
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) {
          final String? id = RouteParams.entityId(
            state.pathParameters['driverId'],
          );
          if (id == null) {
            return const NotFoundScreen(kind: NotFoundKind.invalidParameters);
          }
          return DriverDetailScreen(
            driverId: id,
            originSeason: _originSeason(state),
          );
        },
      ),
      GoRoute(
        path: RoutePaths.constructorPattern,
        name: RouteNames.constructor,
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) {
          final String? id = RouteParams.entityId(
            state.pathParameters['constructorId'],
          );
          if (id == null) {
            return const NotFoundScreen(kind: NotFoundKind.invalidParameters);
          }
          return ConstructorDetailScreen(
            constructorId: id,
            originSeason: _originSeason(state),
          );
        },
      ),
      GoRoute(
        path: RoutePaths.circuitPattern,
        name: RouteNames.circuit,
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) {
          final String? id = RouteParams.entityId(
            state.pathParameters['circuitId'],
          );
          if (id == null) {
            return const NotFoundScreen(kind: NotFoundKind.invalidParameters);
          }
          return CircuitDetailScreen(
            circuitId: id,
            originSeason: _originSeason(state),
          );
        },
      ),
      // Settings and every one of its sub-screens live on the root navigator.
      // Settings is therefore never a shell branch: opening it leaves the active
      // primary branch — and its scroll position — exactly as the user left it,
      // and back walks down through the Settings stack to that same origin.
      GoRoute(
        path: RoutePaths.settings,
        name: RouteNames.settings,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const SettingsScreen(),
        routes: <RouteBase>[
          GoRoute(
            path: RoutePaths.settingsLanguageRelative,
            name: RouteNames.settingsLanguage,
            parentNavigatorKey: rootNavigatorKey,
            builder: (_, _) => const LanguageSettingsScreen(),
          ),
          GoRoute(
            path: RoutePaths.settingsThemeRelative,
            name: RouteNames.settingsTheme,
            parentNavigatorKey: rootNavigatorKey,
            builder: (_, _) => const ThemeSettingsScreen(),
          ),
          GoRoute(
            path: RoutePaths.settingsTimeRelative,
            name: RouteNames.settingsTime,
            parentNavigatorKey: rootNavigatorKey,
            builder: (_, _) => const TimeDisplaySettingsScreen(),
          ),
          GoRoute(
            path: RoutePaths.settingsDataRelative,
            name: RouteNames.settingsData,
            parentNavigatorKey: rootNavigatorKey,
            builder: (_, _) => const DataSettingsScreen(),
          ),
          GoRoute(
            path: RoutePaths.settingsAcknowledgementsRelative,
            name: RouteNames.settingsAcknowledgements,
            parentNavigatorKey: rootNavigatorKey,
            builder: (_, _) => const AcknowledgementsScreen(),
          ),
          GoRoute(
            path: RoutePaths.settingsPrivacyRelative,
            name: RouteNames.settingsPrivacy,
            parentNavigatorKey: rootNavigatorKey,
            builder: (_, _) => const PrivacySettingsScreen(),
          ),
          GoRoute(
            path: RoutePaths.settingsAboutRelative,
            name: RouteNames.settingsAbout,
            parentNavigatorKey: rootNavigatorKey,
            builder: (_, _) => const AboutSettingsScreen(),
          ),
        ],
      ),
    ],
  );
}

/// The season context an entity route was opened with, or `null` for a deep
/// link. Runtime-only metadata: it is never parsed from the URL and never
/// substituted by a hardcoded year.
int? _originSeason(GoRouterState state) {
  final Object? extra = state.extra;
  return extra is EntityNavigationOrigin ? extra.season : null;
}

Widget _standings(GoRouterState state, StandingsChampionship championship) {
  final int? season = RouteParams.season(state.pathParameters['season']);
  if (season == null) {
    return const NotFoundScreen(kind: NotFoundKind.invalidParameters);
  }
  return StandingsScreen(championship: championship, season: season);
}
