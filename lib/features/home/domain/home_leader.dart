import '../../shared/domain/entities/standing_entry.dart';

/// One championship's leader as Home represents it.
///
/// Deliberately a closed set of *facts about the data*, not a presentation
/// choice: nothing here can be produced by guessing. A leader exists only where
/// the contract confirmed `position == 1`, and only where a real display name
/// was stored for that competitor.
sealed class HomeLeader {
  const HomeLeader();
}

/// Exactly one competitor holds a confirmed position 1, and their identity is
/// resolved locally.
class HomeSingleLeader extends HomeLeader {
  const HomeSingleLeader({
    required this.entityId,
    required this.name,
    required this.points,
    this.teamName,
    this.teamColor,
    this.wins,
    this.provisional,
  });

  /// The stable GridView identifier the detail route uses. Never displayed.
  final String entityId;

  /// The authoritative display name. Never derived from [entityId].
  final String name;

  /// Confirmed championship points. A genuine zero stays zero.
  final double points;

  /// The season-specific team association, when the standing named one. Never
  /// guessed from participation entries.
  final String? teamName;

  /// The team's `#RRGGBB` accent, when known. Decorative only.
  final String? teamColor;

  final int? wins;
  final bool? provisional;
}

/// More than one competitor holds a confirmed position 1.
///
/// No single competitor is promoted to "the leader" and none of them becomes the
/// card's primary action: the module links to the complete standings instead.
class HomeTiedLeaders extends HomeLeader {
  const HomeTiedLeaders({
    required this.names,
    required this.points,
    this.count,
  });

  /// The authoritative names of the tied competitors, in the delivered order.
  /// Only names that are actually stored appear here — an unresolved identity
  /// contributes nothing rather than an identifier.
  final List<String> names;

  /// The shared confirmed points total, or `null` when the tied rows disagree
  /// about it (a tie on position without a tie on points is possible, and is
  /// never flattened into one number).
  final double? points;

  /// How many competitors are tied, including any whose name is not stored.
  final int? count;
}

/// No leader can be shown.
///
/// Either no row holds a confirmed position 1, or the single row that does has
/// no resolved identity. Both are represented as "unavailable" rather than
/// filled in from a maximum points total, the first delivered row or a
/// humanised identifier.
class HomeLeaderUnavailable extends HomeLeader {
  const HomeLeaderUnavailable();
}

/// Resolves the drivers' championship leader from the **confirmed** position-1
/// rows.
///
/// [leaders] must already be filtered to `position == 1`; this function never
/// inspects points to decide who leads.
HomeLeader resolveDriverLeader(List<DriverStandingEntry> leaders) {
  if (leaders.isEmpty) return const HomeLeaderUnavailable();
  if (leaders.length > 1) {
    return HomeTiedLeaders(
      names: leaders
          .map((DriverStandingEntry e) => e.driverName)
          .whereType<String>()
          .toList(growable: false),
      points: _sharedPoints(leaders.map((DriverStandingEntry e) => e.points)),
      count: leaders.length,
    );
  }
  final DriverStandingEntry entry = leaders.single;
  final String? name = entry.driverName;
  // An unresolved referential stub is not a leader identity, and its identifier
  // is not a display name — so there is nothing to show and nothing to open.
  if (name == null) return const HomeLeaderUnavailable();
  return HomeSingleLeader(
    entityId: entry.driverId,
    name: name,
    points: entry.points,
    teamName: entry.constructorName,
    teamColor: entry.teamColor,
    wins: entry.wins,
    provisional: entry.provisional,
  );
}

/// Resolves the constructors' championship leader, by the same rules.
HomeLeader resolveConstructorLeader(List<ConstructorStandingEntry> leaders) {
  if (leaders.isEmpty) return const HomeLeaderUnavailable();
  if (leaders.length > 1) {
    return HomeTiedLeaders(
      names: leaders
          .map((ConstructorStandingEntry e) => e.displayName)
          .whereType<String>()
          .toList(growable: false),
      points: _sharedPoints(
        leaders.map((ConstructorStandingEntry e) => e.points),
      ),
      count: leaders.length,
    );
  }
  final ConstructorStandingEntry entry = leaders.single;
  final String? name = entry.displayName;
  if (name == null) return const HomeLeaderUnavailable();
  return HomeSingleLeader(
    entityId: entry.constructorId,
    name: name,
    points: entry.points,
    teamColor: entry.teamColor,
    wins: entry.wins,
    provisional: entry.provisional,
  );
}

/// The points total the tied rows agree on, or `null` when they do not.
double? _sharedPoints(Iterable<double> points) {
  double? shared;
  for (final double value in points) {
    if (shared == null) {
      shared = value;
    } else if (shared != value) {
      return null;
    }
  }
  return shared;
}
