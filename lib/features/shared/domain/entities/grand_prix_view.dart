import 'circuit.dart';
import 'freshness.dart';
import 'grand_prix.dart';

/// The Grand Prix detail vertical-slice aggregate read from the local database.
///
/// A domain-only view composed from the persisted Grand Prix, its ordered
/// sessions ([GrandPrix.sessions]), its host circuit summary, and the detail
/// snapshot's freshness. [freshness] is `null` when the Grand Prix has only been
/// cached indirectly (e.g. from the Home snapshot) and never refreshed through
/// its own detail endpoint.
class GrandPrixDetailView {
  const GrandPrixDetailView({
    required this.grandPrix,
    this.circuit,
    this.freshness,
  });

  final GrandPrix grandPrix;
  final Circuit? circuit;
  final DataFreshness? freshness;
}
