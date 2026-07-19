import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'route_paths.dart';

/// Marker carried as a route's `extra` to record the location a detail screen
/// was opened from — i.e. the page directly beneath it.
///
/// It is runtime-only (never serialized), so a deep-linked detail screen simply
/// arrives with no origin and pushes normally. Using a dedicated type keeps this
/// bookkeeping unambiguous and separate from any real route payload.
@immutable
class EntityNavigationOrigin {
  const EntityNavigationOrigin(this.location);

  final String location;
}

/// Navigation helpers for opening entity detail screens and Settings.
///
/// Entity screens link to related entities (driver → constructor, constructor →
/// driver, circuit → Grand Prix, …). Naive pushes would let a user build an
/// endless `A → B → A → B` stack. Per App Flow §11.3 / §12.3, when the target is
/// the page **directly beneath** the current one we return to it instead of
/// pushing a duplicate; otherwise we push.
///
/// This relies only on go_router's public API — `GoRouterState.of`, its `uri`
/// and `extra`, and `push`/`pop` — with no dependency on internal routing-match
/// types. Each push stamps the current location as the child's origin, so the
/// child can recognise an immediate loop back to it.
extension GridViewNavigation on BuildContext {
  /// Opens an entity/detail [location], collapsing an immediate back-and-forth
  /// loop into a `pop` so the stack never accumulates duplicate entity pages.
  void openEntity(String location) {
    final GoRouterState state = GoRouterState.of(this);
    final Object? origin = state.extra;
    if (origin is EntityNavigationOrigin &&
        _samePath(origin.location, location)) {
      pop();
    } else {
      push(location, extra: EntityNavigationOrigin(state.uri.toString()));
    }
  }

  /// Opens Settings above the current screen without changing the active
  /// primary branch (App Flow §13.3).
  void openSettings() => push(RoutePaths.settings);
}

bool _samePath(String a, String b) => Uri.parse(a).path == Uri.parse(b).path;
