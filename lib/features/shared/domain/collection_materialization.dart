import 'entities/sync_state.dart';
import 'freshness_evaluator.dart';

/// Whether a season-scoped **collection** has a materialized local
/// representation, from persisted synchronization state alone.
///
/// This is the one rule shared by every season collection the first-launch
/// aggregate can apply (the calendar, the drivers' and constructors' standings).
/// Two records can materialize a collection, and neither is inferred from the
/// number of rows:
///
/// 1. the collection's **own** record — its canonical resource key has
///    synchronised successfully at least once (the same rule as
///    `SyncedRepository.collectionRepresentation`);
/// 2. an **accepted bootstrap for this exact season** — one atomic transaction
///    applied the contract-defined collections, so a season that legitimately
///    has no rows is materialized even though the collection's own endpoint has
///    never been called.
///
/// Here the bootstrap record is consulted only for *materialization*. It
/// contributes no ETag and no provenance to the resource, and it never makes the
/// resource's endpoint look revalidated (ADR 0014): a missing metadata row stays
/// missing, so the resource remains due for a later foreground or manual
/// synchronization. [presentedFreshness] is the only place that reads its
/// freshness, and only for display.
///
/// The season match uses the bootstrap row's **own** season scope — the season
/// the last accepted bootstrap actually applied — so an older season's bootstrap
/// can never materialize a newer current season's collection.
///
/// Because bootstrap applies its collections in a single transaction, an
/// accepted bootstrap materializes each of them; it never lets one individual
/// resource's own record stand in for another's.
bool hasMaterializedCollection({
  required int? season,
  required ResourceSyncState? metadata,
  required ResourceSyncState? bootstrapMetadata,
}) {
  if (season == null) return false;
  if (metadata?.lastSuccessAt != null) return true;
  return _bootstrapApplied(season, bootstrapMetadata);
}

/// The freshness presented for a resource that an accepted bootstrap can
/// materialize.
///
/// A resource that has synchronised under its own key always presents its own
/// record. Until then, the content on screen is exactly what an accepted
/// bootstrap for this season applied. When [bootstrapFallback] is set, the
/// bootstrap representation's own server-provided freshness is presented
/// instead. An expired bootstrap therefore reads as stale on every screen it
/// materialized, just as an expired individual resource does.
///
/// This is a read, never a write. Nothing is recorded under the resource's key,
/// the resource stays due for its own synchronization, and no update time is
/// borrowed (ADR 0014). With no own record and no applicable fallback the
/// freshness is unknown (`null`), which is presented as neither fresh nor stale.
///
/// [bootstrapFallback] is off for frozen and sample-fixture builds, which keep
/// the established "unknown" presentation.
FreshnessState? presentedFreshness({
  required int? season,
  required ResourceSyncState? metadata,
  required ResourceSyncState? bootstrapMetadata,
  required bool bootstrapFallback,
  required DateTime now,
}) {
  if (metadata?.lastSuccessAt != null) {
    return evaluateResourceFreshness(metadata, now);
  }
  if (bootstrapFallback &&
      season != null &&
      _bootstrapApplied(season, bootstrapMetadata)) {
    return evaluateResourceFreshness(bootstrapMetadata, now);
  }
  return null;
}

bool _bootstrapApplied(int season, ResourceSyncState? bootstrap) =>
    bootstrap != null &&
    bootstrap.lastSuccessAt != null &&
    bootstrap.season == season;
