import '../../../core/api/errors/api_failure.dart';
import '../../shared/domain/collection_materialization.dart';
import '../../shared/domain/entities/standing_entry.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/freshness_evaluator.dart';

/// Which championship table is shown. The two are independent remote resources
/// (`standings:drivers:<season>` and `standings:constructors:<season>`); this
/// only says which one the user is currently looking at.
enum StandingsChampionship { drivers, constructors }

/// Why a standings table could not be shown or could not be refreshed.
///
/// Only these two causes belong to a standings table: neither an unrelated core
/// resource nor the *other* championship failing is ever this table's error.
enum StandingsFailureCause {
  /// No season could be resolved locally, so there is no canonical
  /// `standings:*:<season>` resource to read or refresh.
  seasonUnresolved,

  /// This table's own resource failed to synchronise.
  resourceFailed,
}

/// A standings-owned failure: the cause, plus the typed API failure when one
/// exists (an unresolved season has no HTTP failure behind it).
class StandingsFailure {
  const StandingsFailure(this.cause, [this.failure]);

  const StandingsFailure.seasonUnresolved()
    : cause = StandingsFailureCause.seasonUnresolved,
      failure = null;

  const StandingsFailure.resource(ApiFailure this.failure)
    : cause = StandingsFailureCause.resourceFailed;

  final StandingsFailureCause cause;
  final ApiFailure? failure;
}

/// How the rows describe their own provisional status.
///
/// `provisional` is a per-row nullable boolean in the contract, so the rows —
/// not a guess — decide how it is presented. A null never means "final": it
/// means unspecified.
enum StandingsProvisionalSummary {
  /// No row says anything about it. Nothing is claimed either way.
  unspecified,

  /// Every row that specifies it says provisional. One concise section-level
  /// indication represents the data accurately.
  provisional,

  /// Rows disagree. The section claims nothing global; the provisional rows are
  /// marked individually so row-level correctness is retained.
  mixed,

  /// At least one row specifies it and none is provisional. Still not a claim
  /// that the table is final — simply nothing to indicate.
  notProvisional,
}

/// Summarises the rows' `provisional` flags without flattening a disagreement
/// into a false global state.
StandingsProvisionalSummary summariseProvisional(Iterable<bool?> flags) {
  bool anyTrue = false;
  bool anyFalse = false;
  for (final bool? flag in flags) {
    if (flag == null) continue;
    if (flag) {
      anyTrue = true;
    } else {
      anyFalse = true;
    }
  }
  if (!anyTrue && !anyFalse) return StandingsProvisionalSummary.unspecified;
  if (anyTrue && anyFalse) return StandingsProvisionalSummary.mixed;
  return anyTrue
      ? StandingsProvisionalSummary.provisional
      : StandingsProvisionalSummary.notProvisional;
}

/// One championship table's typed presentation state.
///
/// Derived independently per championship, so one table's loading state never
/// hides the other's cached rows and one table's failure never becomes the
/// other's error. The variants are mutually exclusive: a valid empty table is
/// never "loading", and cached rows are never replaced by an error.
sealed class StandingsTableState<R> {
  const StandingsTableState();
}

/// No season resolved yet, or no materialized representation for this table yet.
class StandingsLoading<R> extends StandingsTableState<R> {
  const StandingsLoading();
}

/// Nothing local to show for this table and its relevant synchronization
/// failed — either the table's own resource, or the season context it needs.
class StandingsFirstLoadError<R> extends StandingsTableState<R> {
  const StandingsFirstLoadError(this.failure);

  final StandingsFailure failure;
}

/// This table's representation is materialized and legitimately carries no rows.
/// A real, valid state — never loading, never an error.
class StandingsEmpty<R> extends StandingsTableState<R> {
  const StandingsEmpty({
    required this.season,
    required this.freshness,
    this.lastSuccessAt,
    this.refreshing = false,
    this.refreshError,
  });

  final int season;

  /// This resource's **own** freshness, or `null` when it has none of its own
  /// yet (a representation materialized by an accepted bootstrap). Unknown is
  /// never presented as stale, and never as fresh.
  final FreshnessState? freshness;

  final DateTime? lastSuccessAt;
  final bool refreshing;
  final StandingsFailure? refreshError;

  bool get isStale => freshness == FreshnessState.stale;
}

/// Cached rows are available, in the delivered order.
class StandingsReady<R> extends StandingsTableState<R> {
  const StandingsReady({
    required this.season,
    required this.rows,
    required this.freshness,
    required this.provisional,
    this.lastSuccessAt,
    this.refreshing = false,
    this.refreshError,
  });

  final int season;

  /// The table's rows in their persisted `order_index` order — authoritative,
  /// never re-sorted by position, points or name.
  final List<R> rows;

  /// This resource's own freshness, or `null` when it has none of its own yet.
  final FreshnessState? freshness;

  /// What the rows say about being provisional.
  final StandingsProvisionalSummary provisional;

  final DateTime? lastSuccessAt;
  final bool refreshing;

  /// A refresh failure that kept the cached rows visible.
  final StandingsFailure? refreshError;

  bool get isStale => freshness == FreshnessState.stale;
}

/// Derives one championship table's state from the resolved season, its own
/// Drift-backed stream, its own persisted resource metadata and its own
/// transient refresh status.
///
/// Pure and side-effect free, so every state is unit-testable without Riverpod
/// or a widget tree. Materialization comes from [hasMaterializedCollection] —
/// never from the number of rows — so a valid empty table and one that has never
/// synchronised stay distinguishable.
///
/// Freshness is this resource's **own**, and is `null` while it has none (a
/// representation materialized by bootstrap). Bootstrap provenance is never
/// borrowed to fill it in, and the other championship's record is never
/// consulted.
StandingsTableState<R> computeStandingsTableState<R>({
  required int? season,
  required bool seasonReady,
  required List<R>? rows,
  required Iterable<bool?> Function(List<R> rows) provisionalOf,
  required ResourceSyncState? metadata,
  required bool metadataReady,
  required ResourceSyncState? bootstrapMetadata,
  required bool bootstrapMetadataReady,
  required bool refreshing,
  required ApiFailure? lastFailure,
  required bool syncSettled,
  required DateTime now,
}) {
  final FreshnessState? freshness = metadata?.lastSuccessAt == null
      ? null
      : evaluateResourceFreshness(metadata, now);
  final StandingsFailure? refreshError = (refreshing || lastFailure == null)
      ? null
      : StandingsFailure.resource(lastFailure);

  // Cached rows always win: content is never replaced by a loader or an error.
  if (season != null && rows != null && rows.isNotEmpty) {
    return StandingsReady<R>(
      season: season,
      rows: rows,
      freshness: freshness,
      provisional: summariseProvisional(provisionalOf(rows)),
      lastSuccessAt: metadata?.lastSuccessAt,
      refreshing: refreshing,
      refreshError: refreshError,
    );
  }

  if (season == null) {
    // Only claim the season is unresolvable once an application run has
    // actually finished trying; before that this is an ordinary first load.
    if (!seasonReady || refreshing || !syncSettled) {
      return StandingsLoading<R>();
    }
    return StandingsFirstLoadError<R>(
      const StandingsFailure.seasonUnresolved(),
    );
  }

  if (rows == null || !metadataReady || !bootstrapMetadataReady) {
    return StandingsLoading<R>();
  }

  // A materialized authoritative collection — synchronised directly, or applied
  // by an accepted bootstrap for this exact season — makes an empty table a
  // valid representation rather than an unknown one.
  if (hasMaterializedCollection(
    season: season,
    metadata: metadata,
    bootstrapMetadata: bootstrapMetadata,
  )) {
    return StandingsEmpty<R>(
      season: season,
      freshness: freshness,
      lastSuccessAt: metadata?.lastSuccessAt,
      refreshing: refreshing,
      refreshError: refreshError,
    );
  }

  if (!refreshing && lastFailure != null) {
    return StandingsFirstLoadError<R>(StandingsFailure.resource(lastFailure));
  }
  return StandingsLoading<R>();
}

/// The Standings screen's state: the selected championship, the resolved season
/// and **both** tables' independently derived states.
///
/// The unselected table's state is retained rather than discarded, so switching
/// the selector immediately reveals cached rows without a loader and without a
/// request.
class StandingsScreenState {
  const StandingsScreenState({
    required this.selected,
    required this.season,
    required this.drivers,
    required this.constructors,
  });

  final StandingsChampionship selected;

  /// The season being shown: the route's exact season on an explicit route, or
  /// the locally resolved current season at the branch root.
  final int? season;

  final StandingsTableState<DriverStandingEntry> drivers;
  final StandingsTableState<ConstructorStandingEntry> constructors;

  /// Whether the *selected* table is currently refreshing. Freshness, failures
  /// and progress are always scoped to the selected resource.
  bool get selectedRefreshing => switch (selected) {
    StandingsChampionship.drivers => _refreshing(drivers),
    StandingsChampionship.constructors => _refreshing(constructors),
  };

  static bool _refreshing<R>(StandingsTableState<R> state) => switch (state) {
    StandingsReady<R>(:final bool refreshing) => refreshing,
    StandingsEmpty<R>(:final bool refreshing) => refreshing,
    _ => false,
  };
}
