import '../../../../core/api/envelope/meta_dto.dart';
import '../../domain/snapshot_conflict.dart';

/// The scope columns of a `resource_sync_metadata` row: the season, a stable
/// entity id and/or a round, as applicable to the resource. Unused dimensions
/// stay null (e.g. the content manifest has no scope; a season collection has a
/// season but no entity id).
class ResourceScope {
  const ResourceScope({this.season, this.entityId, this.round});

  static const ResourceScope none = ResourceScope();

  final int? season;
  final String? entityId;
  final int? round;
}

/// The validator + provenance of a modified (HTTP 200) remote snapshot, as the
/// sync writer needs it: the entity tag plus the snapshot revision fields the
/// conflict rule and freshness bookkeeping use. Built from the response `meta`
/// (SnapshotMeta / SeasonSnapshotMeta); `serverStale` is supplied separately by
/// the few payloads that carry an explicit stale flag (e.g. Home freshness).
class RemoteSnapshotMeta {
  const RemoteSnapshotMeta({
    required this.generatedAt,
    this.etag,
    this.sourceUpdatedAt,
    this.staleAfter,
    this.contentVersion,
    this.serverStale,
  });

  /// Builds from a parsed response [MetaDto]. Instants are normalised to UTC.
  factory RemoteSnapshotMeta.fromMeta(
    MetaDto meta, {
    String? etag,
    bool? serverStale,
  }) => RemoteSnapshotMeta(
    generatedAt: DateTime.parse(meta.generatedAt).toUtc(),
    etag: etag,
    sourceUpdatedAt: _utc(meta.sourceUpdatedAt),
    staleAfter: _utc(meta.staleAfter),
    contentVersion: meta.contentVersion,
    serverStale: serverStale,
  );

  final String? etag;
  final DateTime generatedAt;
  final DateTime? sourceUpdatedAt;
  final DateTime? staleAfter;
  final String? contentVersion;
  final bool? serverStale;

  /// The revision view used by the centralized [SnapshotConflict] rule.
  SnapshotRevision get revision => SnapshotRevision(
    generatedAt: generatedAt,
    sourceUpdatedAt: sourceUpdatedAt,
    contentVersion: contentVersion,
  );

  static DateTime? _utc(String? iso) =>
      iso == null ? null : DateTime.parse(iso).toUtc();
}
