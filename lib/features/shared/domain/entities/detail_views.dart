import 'circuit.dart';
import 'constructor.dart';
import 'driver.dart';
import 'grand_prix.dart';
import 'season_entry.dart';
import 'standing.dart';

// Domain-only aggregate views read from the local database. These compose
// several persisted entities into the shape a detail/list screen consumes. They
// are not part of the wire contract (no OpenAPI/domain-model change): they only
// bundle existing entities.

/// A driver paired with their participation entry for a specific season, used
/// by the "drivers by season" roster.
class SeasonDriver {
  const SeasonDriver({required this.driver, required this.entry});

  final Driver driver;
  final DriverSeasonEntry entry;
}

/// A constructor paired with its season entry, used by the "constructors by
/// season" list.
class SeasonConstructor {
  const SeasonConstructor({required this.constructor, required this.entry});

  final Constructor constructor;
  final ConstructorSeasonEntry entry;
}

/// Driver detail: stable identity (with media) plus the current season entry and
/// championship standing, when known.
class DriverDetailView {
  const DriverDetailView({
    required this.driver,
    this.seasonEntry,
    this.standing,
  });

  final Driver driver;
  final DriverSeasonEntry? seasonEntry;
  final DriverStanding? standing;
}

/// Team detail: stable identity (with media), the season entry, the current
/// championship standing and the season line-up (ordered drivers).
class TeamDetailView {
  const TeamDetailView({
    required this.constructor,
    this.seasonEntry,
    this.standing,
    this.lineup = const <Driver>[],
  });

  final Constructor constructor;
  final ConstructorSeasonEntry? seasonEntry;
  final ConstructorStanding? standing;
  final List<Driver> lineup;
}

/// Circuit detail: the circuit (with media) plus the Grand Prix events it hosts,
/// ordered by season/round.
class CircuitDetailView {
  const CircuitDetailView({
    required this.circuit,
    this.relatedGrandPrix = const <GrandPrix>[],
  });

  final Circuit circuit;
  final List<GrandPrix> relatedGrandPrix;
}
