import 'entities/sync_state.dart';

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
/// The bootstrap record is consulted only for *materialization*. It contributes
/// no ETag, no provenance and no freshness to the resource, and it never makes
/// the resource's endpoint look revalidated (ADR 0014): a missing metadata row
/// stays missing, so the resource remains due for a later foreground or manual
/// synchronization.
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
  final ResourceSyncState? bootstrap = bootstrapMetadata;
  return bootstrap != null &&
      bootstrap.lastSuccessAt != null &&
      bootstrap.season == season;
}
