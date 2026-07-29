import '../../shared/domain/entities/enums.dart';
import '../../shared/domain/entities/race_result.dart';

/// The winner of a cached race classification, as Home may summarise it.
class HomeRaceWinner {
  const HomeRaceWinner({
    required this.driverId,
    required this.name,
    this.teamName,
  });

  /// The stable identifier the detail route would use. Never displayed.
  final String driverId;

  /// The authoritative display name — never derived from [driverId].
  final String name;

  /// The team named by the classification entry, when its identity is stored.
  final String? teamName;
}

/// Resolves the winner of an already-cached **race** classification.
///
/// Returns `null` — meaning "no winner to show", never "there was no race" —
/// when any of the following holds:
/// - the document is not a race classification (a sprint has its own winner and
///   is never substituted for the race);
/// - the classification is [ResultStatus.unavailable] or carries no entries;
/// - no entry holds a confirmed `position == 1`. The winner is never taken from
///   the first stored row, from the delivered order or from a points total;
/// - more than one entry claims position 1 — an ambiguous classification, from
///   which no winner is picked arbitrarily;
/// - the winning entry's driver identity is not resolved locally. A stable
///   identifier is not a display name, and a humanised identifier is not one
///   either, so the caller shows localized "winner unavailable" copy instead.
///
/// A `null` result never turns the latest-event card into an error: the event
/// summary is useful on its own, and result enrichment is strictly optional.
HomeRaceWinner? resolveHomeRaceWinner(RaceResult? result) {
  if (result == null) return null;
  if (result.sessionType != SessionType.race) return null;
  if (result.status == ResultStatus.unavailable) return null;

  RaceResultEntry? winner;
  for (final RaceResultEntry entry in result.entries) {
    if (entry.position != 1) continue;
    // A second confirmed position 1 makes the classification ambiguous; no
    // winner is chosen rather than the earlier or later row winning by accident.
    if (winner != null) return null;
    winner = entry;
  }
  if (winner == null) return null;

  final String? name = winner.driverName;
  if (name == null) return null;
  return HomeRaceWinner(
    driverId: winner.driverId,
    name: name,
    teamName: winner.constructorName,
  );
}
