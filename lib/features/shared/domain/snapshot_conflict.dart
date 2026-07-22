import 'entities/freshness.dart';

/// The ordering-relevant provenance of a single snapshot revision.
///
/// A snapshot is ordered **primarily by [sourceUpdatedAt]** — the revision of
/// the underlying source data. [generatedAt] (when the edge produced the
/// response) is only ever a deterministic tie-breaker for two snapshots that
/// share the same source revision but differ in content; it must never outrank
/// or substitute for [sourceUpdatedAt]. [contentVersion] is an opaque token
/// compared by equality only (never assumed lexicographically sortable).
class SnapshotRevision {
  const SnapshotRevision({
    required this.generatedAt,
    this.sourceUpdatedAt,
    this.contentVersion,
  });

  /// Builds a revision from a domain [DataFreshness].
  factory SnapshotRevision.fromFreshness(DataFreshness f) => SnapshotRevision(
    generatedAt: f.generatedAt,
    sourceUpdatedAt: f.sourceUpdatedAt,
    contentVersion: f.contentVersion,
  );

  final DateTime generatedAt;
  final DateTime? sourceUpdatedAt;
  final String? contentVersion;
}

/// The decision of the snapshot conflict rule for one incoming revision.
enum SnapshotConflictOutcome {
  /// The incoming revision is newer (or repairs an incomplete stored one) and
  /// should be written.
  apply,

  /// The incoming revision is older than the stored one; reject and preserve
  /// the cache.
  rejectedOlder,

  /// The incoming revision is the same as the stored one (equal source revision
  /// and equal content); an idempotent no-op — do not rewrite domain rows.
  skippedUpToDate,

  /// The incoming revision is contract-invalid (no `sourceUpdatedAt`); reject
  /// without writing. `generatedAt` is never used as a substitute.
  rejectedInvalid,
}

/// The single, centralized snapshot conflict rule applied to **every** modified
/// snapshot across every resource. Repositories and DAOs must call this rather
/// than re-deriving slightly different comparisons.
///
/// 1. incoming `sourceUpdatedAt` **missing** → [SnapshotConflictOutcome.rejectedInvalid].
/// 2. no stored revision → [SnapshotConflictOutcome.apply].
/// 3. stored `sourceUpdatedAt` missing but incoming present →
///    [SnapshotConflictOutcome.apply] (repair an incomplete stored snapshot;
///    this is cache repair, not `generatedAt` ordering).
/// 4. incoming source older than stored → [SnapshotConflictOutcome.rejectedOlder].
/// 5. incoming source newer than stored → [SnapshotConflictOutcome.apply].
/// 6. equal source + equal `contentVersion` → [SnapshotConflictOutcome.skippedUpToDate].
/// 7. equal source + differing `contentVersion` → `generatedAt` tie-break: a
///    strictly later `generatedAt` applies; an equal or earlier one is rejected.
abstract final class SnapshotConflict {
  static SnapshotConflictOutcome decide(
    SnapshotRevision incoming,
    SnapshotRevision? stored,
  ) {
    final DateTime? incomingSource = incoming.sourceUpdatedAt;
    if (incomingSource == null) {
      return SnapshotConflictOutcome.rejectedInvalid;
    }
    if (stored == null) return SnapshotConflictOutcome.apply;

    final DateTime? storedSource = stored.sourceUpdatedAt;
    if (storedSource == null) {
      // The stored snapshot predates the sourceUpdatedAt invariant; a valid
      // incoming snapshot repairs it.
      return SnapshotConflictOutcome.apply;
    }

    if (incomingSource.isBefore(storedSource)) {
      return SnapshotConflictOutcome.rejectedOlder;
    }
    if (incomingSource.isAfter(storedSource)) {
      return SnapshotConflictOutcome.apply;
    }
    // Equal source revision.
    if (incoming.contentVersion == stored.contentVersion) {
      return SnapshotConflictOutcome.skippedUpToDate;
    }
    // Differing content at the same source revision: generatedAt tie-break only.
    return incoming.generatedAt.isAfter(stored.generatedAt)
        ? SnapshotConflictOutcome.apply
        : SnapshotConflictOutcome.rejectedOlder;
  }
}
