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
    required this.seasonYear,
    required this.freshness,
    this.season,
    this.featured,
    this.circuit,
  });

  /// The season this Home representation describes. Always known: it is the
  /// snapshot's own focus season, not something inferred from a featured event.
  final int seasonYear;

  /// Active-season context, when the season row has been synchronised. Optional
  /// so Home can still render before season metadata arrives.
  final Season? season;

  /// The next / featured Grand Prix, or `null` when the season has nothing
  /// scheduled yet. An empty season is a **valid, materialized** Home — not a
  /// missing one — so this is nullable rather than a reason to reject the
  /// snapshot. Its [GrandPrix.sessions] carry whatever sessions the home
  /// snapshot supplied (typically the featured session).
  final GrandPrix? featured;

  /// The featured event's host circuit summary, when known.
  final Circuit? circuit;

  final DataFreshness freshness;

  /// Whether this season currently has a featured event to show.
  bool get hasFeaturedEvent => featured != null;
}
