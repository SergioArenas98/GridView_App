import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers.dart';

/// What a Driver/Team/Circuit detail screen instance is bound to.
///
/// The public detail routes encode only the **stable entity id**
/// (`/drivers/:driverId`), while the detail resources are season-scoped through
/// the API and repository contract. The missing half is therefore carried as
/// typed, optional navigation metadata rather than by changing the route paths
/// or inventing a query parameter:
///
/// * a screen opened from Explore or current-season Standings passes the
///   resolved current season;
/// * a screen opened from a historical Standings route passes that route's exact
///   season;
/// * a related-entity link (Driver → Team, Team → Driver) passes the season the
///   originating detail resolved;
/// * a direct deep link carries none, and the season is resolved locally.
///
/// Provider identity includes **both** halves, so the same entity viewed in two
/// seasons is two independent controllers reading two different metadata keys
/// and validators.
@immutable
class EntityDetailScope {
  const EntityDetailScope({required this.entityId, this.originSeason});

  /// The stable identifier from the route. Never a display name.
  final String entityId;

  /// The season handed over by the origin, or `null` for a deep link.
  final int? originSeason;

  @override
  bool operator ==(Object other) =>
      other is EntityDetailScope &&
      other.entityId == entityId &&
      other.originSeason == originSeason;

  @override
  int get hashCode => Object.hash(entityId, originSeason);

  @override
  String toString() =>
      'EntityDetailScope($entityId, season: ${originSeason ?? 'current'})';
}

/// The season a detail scope actually renders.
///
/// An origin season resolves immediately and exactly — a historical season is
/// never silently replaced by the current one. Without an origin the locally
/// stored current season is followed, so a deep link resolves safely and a
/// season transition re-points the screen without a hardcoded year.
///
/// A `null` value once resolved means **no season could be determined at all**:
/// the caller must then not call a season-scoped detail endpoint.
final entityDetailSeasonProvider =
    Provider.family<AsyncValue<int?>, EntityDetailScope>((
      Ref ref,
      EntityDetailScope scope,
    ) {
      final int? origin = scope.originSeason;
      if (origin != null) return AsyncValue<int?>.data(origin);
      return ref.watch(currentSeasonProvider);
    });
