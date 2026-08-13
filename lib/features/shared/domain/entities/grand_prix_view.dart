import '../media/media_presentation.dart';
import 'circuit.dart';
import 'enums.dart';
import 'freshness.dart';
import 'grand_prix.dart';
import 'media.dart';

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

  /// The event's own media, read locally. Kept distinct from [circuitMedia]:
  /// Grand Prix media and circuit media are different owners, and the hero has to
  /// know which one it is showing to describe it correctly.
  EntityMedia get eventMedia => EntityMedia.from(
    MediaEntityType.grandPrix,
    grandPrix.id,
    grandPrix.media ?? const <MediaAsset>[],
  );

  /// The host circuit's own media, or `null` when no resolved circuit exists.
  EntityMedia? get circuitMedia {
    final Circuit? host = circuit;
    if (host == null) return null;
    return EntityMedia.from(
      MediaEntityType.circuit,
      host.id,
      host.media ?? const <MediaAsset>[],
    );
  }
}
