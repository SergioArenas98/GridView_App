import 'circuit.dart';
import 'freshness.dart';
import 'grand_prix.dart';
import 'season.dart';

/// The Home vertical-slice aggregate read from the local database.
///
/// A domain-only view (no Drift rows, no DTOs) composed from the persisted
/// `home` snapshot: the active season context (when available), the featured /
/// next Grand Prix (with the featured session persisted under it), and the
/// snapshot's freshness.
class HomeView {
  const HomeView({
    required this.featured,
    required this.freshness,
    this.season,
    this.circuit,
  });

  /// Active-season context, when it has been synchronised. Optional so Home can
  /// still render from the featured event alone.
  final Season? season;

  /// The next / featured Grand Prix. Its [GrandPrix.sessions] carry whatever
  /// sessions the home snapshot supplied (typically the featured session).
  final GrandPrix featured;

  /// The featured event's host circuit summary, when known.
  final Circuit? circuit;

  final DataFreshness freshness;
}
