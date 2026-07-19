import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'route_paths.dart';

/// Navigation helpers for opening entity detail screens and Settings.
///
/// Entity screens link to related entities (driver → constructor, constructor →
/// driver, circuit → Grand Prix, …). Naive pushes would let a user build an
/// endless `A → B → A → B` stack. Per App Flow §11.3 / §12.3, when the target
/// route is the page **directly beneath** the current one we return to it
/// instead of pushing a duplicate; otherwise we push normally.
extension GridViewNavigation on BuildContext {
  /// Opens an entity/detail [location], collapsing an immediate back-and-forth
  /// loop into a pop so the stack never accumulates duplicate entity pages.
  void openEntity(String location) {
    final GoRouter router = GoRouter.of(this);
    final List<String> stack = rootPageLocations(
      router.routerDelegate.currentConfiguration,
    );
    if (stack.length >= 2 && _samePath(stack[stack.length - 2], location)) {
      pop();
    } else {
      push(location);
    }
  }

  /// Opens Settings above the current screen without changing the active
  /// primary branch (App Flow §13.3).
  void openSettings() => push(RoutePaths.settings);
}

/// The ordered locations of the pages currently on the root navigator: the
/// shell's location followed by each imperatively-pushed detail route. Exposed
/// for tests that assert loop-free navigation.
List<String> rootPageLocations(RouteMatchList configuration) {
  final List<String> locations = <String>[configuration.uri.path];
  for (final RouteMatchBase match in configuration.matches) {
    if (match is ImperativeRouteMatch) {
      locations.add(match.matchedLocation);
    }
  }
  return locations;
}

bool _samePath(String a, String b) => Uri.parse(a).path == Uri.parse(b).path;
