import '../../../../core/api/envelope/meta_dto.dart';
import '../../domain/entities/freshness.dart';
import 'wire.dart';

/// Maps response `meta` provenance to a domain [DataFreshness].
///
/// The response `meta` (SnapshotMeta / SeasonSnapshotMeta) is the authoritative
/// source of snapshot provenance for both Home and Grand Prix detail: it
/// **requires** `sourceUpdatedAt` — the source revision the conflict rule orders
/// by — whereas the standalone Home `freshness` object leaves it optional. The
/// remote layer rejects a snapshot whose meta is missing `sourceUpdatedAt`
/// before this mapper runs, so the persisted `sourceUpdatedAt` is always
/// present. All instants are normalised to UTC.
DataFreshness freshnessFromMeta(MetaDto meta) => DataFreshness(
  generatedAt: DateTime.parse(meta.generatedAt).toUtc(),
  sourceUpdatedAt: instantFromWire(meta.sourceUpdatedAt),
  staleAfter: instantFromWire(meta.staleAfter),
  contentVersion: meta.contentVersion,
);
