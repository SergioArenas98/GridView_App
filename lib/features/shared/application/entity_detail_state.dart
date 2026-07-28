import '../../../core/api/errors/api_failure.dart';
import '../domain/entities/sync_state.dart';
import '../domain/freshness_evaluator.dart';

/// Why a detail screen has nothing to show.
enum EntityDetailFailureCause {
  /// Neither an origin season nor a locally stored current season exists, so
  /// there is no canonical season-scoped resource key to read or refresh. The
  /// screen must not call a season-scoped endpoint without a season.
  seasonUnresolved,

  /// This entity's own detail resource failed to synchronise.
  resourceFailed,
}

/// A detail-owned failure: the cause, plus the typed API failure when one
/// exists (an unresolved season has no HTTP failure behind it).
class EntityDetailFailure {
  const EntityDetailFailure(this.cause, [this.failure]);

  const EntityDetailFailure.seasonUnresolved()
    : cause = EntityDetailFailureCause.seasonUnresolved,
      failure = null;

  const EntityDetailFailure.resource(ApiFailure this.failure)
    : cause = EntityDetailFailureCause.resourceFailed;

  final EntityDetailFailureCause cause;
  final ApiFailure? failure;
}

/// One entity-detail screen's typed presentation state, generic over the
/// feature's own profile read model.
///
/// The generic parameter keeps this type-safe and keeps every feature-specific
/// partial state where it belongs — inside the profile, whose optional sections
/// are individually nullable. This deliberately avoids one cross-entity class
/// full of unrelated nullable fields.
///
/// No raw exception ever reaches presentation: failures are [ApiFailure] values
/// wrapped in [EntityDetailFailure].
sealed class EntityDetailState<P> {
  const EntityDetailState();
}

/// The season context is still resolving, or a first on-demand load is in
/// flight with nothing local to show yet.
class EntityDetailLoading<P> extends EntityDetailState<P> {
  const EntityDetailLoading();
}

/// No season could be resolved, so no season-scoped request may be made. The
/// screen offers a retry rather than calling an endpoint without a season.
class EntityDetailSeasonUnavailable<P> extends EntityDetailState<P> {
  const EntityDetailSeasonUnavailable();
}

/// Nothing real exists locally and the detail resource definitively reports the
/// entity does not exist.
class EntityDetailNotFound<P> extends EntityDetailState<P> {
  const EntityDetailNotFound();
}

/// Nothing real exists locally and the detail refresh failed transiently. A
/// recoverable first-load error, never a permanent not-found.
class EntityDetailFirstLoadError<P> extends EntityDetailState<P> {
  const EntityDetailFirstLoadError(this.failure);

  final EntityDetailFailure failure;
}

/// A real local entity is available — either a collection/bootstrap-derived
/// **partial** summary or a **materialized** detail — and is rendered.
///
/// Cached content always stays visible: a refresh, a failure, or a focused
/// detail-unavailable response never replaces it with a loader or an error page.
class EntityDetailReady<P> extends EntityDetailState<P> {
  const EntityDetailReady({
    required this.profile,
    required this.season,
    required this.materialized,
    required this.freshness,
    this.lastSuccessAt,
    this.refreshing = false,
    this.refreshError,
    this.detailUnavailable = false,
  });

  final P profile;

  /// The exact season this profile was composed for.
  final int season;

  /// Whether the **exact detail resource** has synchronised successfully and has
  /// a valid local representation.
  ///
  /// `false` means the visible content came from a collection, a bootstrap, the
  /// Calendar, Standings or a Grand Prix — useful, real, but not proof that the
  /// detail endpoint was ever called. Detail-owned sections then render as
  /// structured placeholders and **no detail freshness is claimed**.
  final bool materialized;

  /// This detail resource's **own** freshness. Always `null` when
  /// [materialized] is `false`: a collection's or bootstrap's freshness is never
  /// borrowed to vouch for a detail.
  final FreshnessState? freshness;

  /// The exact detail resource's own last successful synchronization, or `null`
  /// when it has none.
  final DateTime? lastSuccessAt;

  final bool refreshing;

  /// A refresh failure that kept the visible content. Non-blocking.
  final EntityDetailFailure? refreshError;

  /// The detail endpoint reported the entity does not exist while a real local
  /// summary is present: the summary stays visible and the detail-owned sections
  /// are reported unavailable, instead of turning the page into a not-found.
  final bool detailUnavailable;

  bool get isStale => freshness == FreshnessState.stale;
}

/// Derives an entity-detail state from the resolved season, the local profile
/// stream, the **exact detail resource's** persisted metadata and the
/// controller's transient refresh status.
///
/// Pure and side-effect free, so every state is unit-testable without Riverpod
/// or a widget tree.
///
/// Materialization is decided by the detail resource's own record **and** the
/// presence of a real local profile. Collection, bootstrap, Standings, Calendar
/// and Grand Prix data can supply a profile, but never a detail's metadata: a
/// partial profile is reported with `materialized: false` and a `null`
/// freshness (ADR 0014).
EntityDetailState<P> computeEntityDetailState<P>({
  required int? season,
  required bool seasonReady,
  required P? profile,
  required bool profileReady,
  required ResourceSyncState? metadata,
  required bool metadataReady,
  required bool refreshing,
  required ApiFailure? lastFailure,
  required bool notFound,
  required DateTime now,
}) {
  // A real local entity always wins: content is never replaced by a loader or
  // an error page, and a 404 alongside real content is a focused, non-blocking
  // detail-unavailable state rather than a page-level not-found.
  if (season != null && profile != null) {
    final bool materialized = metadata?.lastSuccessAt != null;
    final EntityDetailFailure? refreshError =
        (refreshing || lastFailure == null)
        ? null
        : EntityDetailFailure.resource(lastFailure);
    return EntityDetailReady<P>(
      profile: profile,
      season: season,
      materialized: materialized,
      freshness: materialized ? evaluateResourceFreshness(metadata, now) : null,
      lastSuccessAt: metadata?.lastSuccessAt,
      refreshing: refreshing,
      refreshError: notFound ? null : refreshError,
      detailUnavailable: notFound,
    );
  }

  if (season == null) {
    // Only claim the season is unresolvable once resolution has actually
    // finished; before that this is an ordinary first load.
    return seasonReady && !refreshing
        ? EntityDetailSeasonUnavailable<P>()
        : EntityDetailLoading<P>();
  }

  if (!profileReady || !metadataReady) return EntityDetailLoading<P>();

  // No real local entity. A definitive not-found outranks a transient failure.
  if (notFound) return EntityDetailNotFound<P>();
  if (!refreshing && lastFailure != null) {
    return EntityDetailFirstLoadError<P>(
      EntityDetailFailure.resource(lastFailure),
    );
  }
  return EntityDetailLoading<P>();
}
