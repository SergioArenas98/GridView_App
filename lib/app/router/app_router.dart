import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/calendar/presentation/calendar_screen.dart';
import '../../features/calendar/presentation/grand_prix_detail_screen.dart';
import '../../features/circuits/presentation/circuit_detail_screen.dart';
import '../../features/constructors/presentation/constructor_detail_screen.dart';
import '../../features/drivers/presentation/driver_detail_screen.dart';
import '../../features/explore/presentation/circuit_list_screen.dart';
import '../../features/explore/presentation/constructor_list_screen.dart';
import '../../features/explore/presentation/driver_list_screen.dart';
import '../../features/explore/presentation/explore_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/shared/presentation/not_found_screen.dart';
import '../../features/standings/presentation/standings_screen.dart';
import 'app_shell.dart';
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
                builder: (_, _) =>
                    const StandingsScreen(tab: StandingsTab.drivers),
              ),
              GoRoute(
                path: RoutePaths.standingsDriversPattern,
                name: RouteNames.standingsDrivers,
                builder: (BuildContext context, GoRouterState state) =>
                    _standings(state, StandingsTab.drivers),
              ),
              GoRoute(
                path: RoutePaths.standingsConstructorsPattern,
                name: RouteNames.standingsConstructors,
                builder: (BuildContext context, GoRouterState state) =>
                    _standings(state, StandingsTab.constructors),
              ),
            ],
          ),

          // --- Explore branch ---
          StatefulShellBranch(
            navigatorKey: exploreNavigatorKey,
            routes: <RouteBase>[
              GoRoute(
                path: RoutePaths.explore,
                name: RouteNames.explore,
                builder: (_, _) => const ExploreScreen(),
                routes: <RouteBase>[
                  GoRoute(
                    path: RoutePaths.exploreDriversRelative,
                    name: RouteNames.exploreDrivers,
                    builder: (_, _) => const DriverListScreen(),
                  ),
                  GoRoute(
                    path: RoutePaths.exploreTeamsRelative,
                    name: RouteNames.exploreTeams,
                    builder: (_, _) => const ConstructorListScreen(),
                  ),
                  GoRoute(
                    path: RoutePaths.exploreCircuitsRelative,
                    name: RouteNames.exploreCircuits,
                    builder: (_, _) => const CircuitListScreen(),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),

      // --- Root-level detail + Settings routes (above the shell) ---
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
          return DriverDetailScreen(driverId: id);
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
          return ConstructorDetailScreen(constructorId: id);
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
          return CircuitDetailScreen(circuitId: id);
        },
      ),
      GoRoute(
        path: RoutePaths.settings,
        name: RouteNames.settings,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const SettingsScreen(),
      ),
    ],
  );
}

Widget _standings(GoRouterState state, StandingsTab tab) {
  final int? season = RouteParams.season(state.pathParameters['season']);
  if (season == null) {
    return const NotFoundScreen(kind: NotFoundKind.invalidParameters);
  }
  return StandingsScreen(tab: tab, season: season);
}
