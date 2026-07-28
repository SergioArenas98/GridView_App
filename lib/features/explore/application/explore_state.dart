import '../../../core/api/errors/api_failure.dart';
import '../../shared/domain/collection_materialization.dart';
import '../../shared/domain/entities/season_card.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/freshness_evaluator.dart';

/// Which Explore collection is being shown.
///
/// The three are **independent** remote resources (`drivers:<season>`,
/// `constructors:<season>`, `circuits:<season>`); this only says which one the
/// user is currently looking at. Selecting one is navigation state, never
/// remote-data state: it can never initiate a request.
enum ExploreCategory {
  drivers,
  teams,
  circuits;

  /// The route segment this category is addressed by.
  String get segment => switch (this) {
    ExploreCategory.drivers => 'drivers',
    ExploreCategory.teams => 'teams',
    ExploreCategory.circuits => 'circuits',
  };
}

/// Why an Explore collection could not be shown or could not be refreshed.
///
/// Only these two causes belong to a collection: neither an unrelated core
/// resource nor another category failing is ever this collection's error.
enum ExploreFailureCause {
  /// No season could be resolved locally, so there is no canonical
  /// `<collection>:<season>` resource to read or refresh.
  seasonUnresolved,

  /// This collection's own resource failed to synchronise.
  resourceFailed,
}

/// A collection-owned failure: the cause, plus the typed API failure when one
/// exists (an unresolved season has no HTTP failure behind it).
class ExploreFailure {
  const ExploreFailure(this.cause, [this.failure]);

  const ExploreFailure.seasonUnresolved()
    : cause = ExploreFailureCause.seasonUnresolved,
      failure = null;

  const ExploreFailure.resource(ApiFailure this.failure)
    : cause = ExploreFailureCause.resourceFailed;

  final ExploreFailureCause cause;
  final ApiFailure? failure;
}

/// One Explore collection's typed presentation state.
///
/// Derived independently per category, so one collection's loading state never
/// hides another's cached cards and one collection's failure never becomes
/// another's error. The variants are mutually exclusive: a valid empty
/// collection is never "loading", and cached cards are never replaced by an
/// error.
sealed class ExploreCollectionState<C> {
  const ExploreCollectionState();
}

/// No season resolved yet, or no materialized representation for this
/// collection yet.
class ExploreCollectionLoading<C> extends ExploreCollectionState<C> {
  const ExploreCollectionLoading();
}

/// Nothing local to show for this collection and its relevant synchronization
/// failed — either the collection's own resource, or the season context.
class ExploreCollectionFirstLoadError<C> extends ExploreCollectionState<C> {
  const ExploreCollectionFirstLoadError(this.failure);

  final ExploreFailure failure;
}

/// This collection's representation is materialized and legitimately carries no
/// entities. A real, valid state — never loading, never an error.
class ExploreCollectionEmpty<C> extends ExploreCollectionState<C> {
  const ExploreCollectionEmpty({
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
  final ExploreFailure? refreshError;

  bool get isStale => freshness == FreshnessState.stale;
}

/// Cached cards are available, in the collection's deterministic local order.
class ExploreCollectionReady<C> extends ExploreCollectionState<C> {
  const ExploreCollectionReady({
    required this.season,
    required this.cards,
    required this.freshness,
    this.lastSuccessAt,
    this.refreshing = false,
    this.refreshError,
  });

  final int season;

  /// The collection's cards in their deterministic local order. Rendering
  /// follows it exactly; standings enrichment never re-sorts it. Circuits use
  /// the provider's calendar round; drivers and teams use a deterministic
  /// product rule (see [SeasonDriverCard.orderIndex]).
  final List<C> cards;

  /// This resource's own freshness, or `null` when it has none of its own yet.
  final FreshnessState? freshness;

  final DateTime? lastSuccessAt;
  final bool refreshing;

  /// A refresh failure that kept the cached cards visible.
  final ExploreFailure? refreshError;

  bool get isStale => freshness == FreshnessState.stale;
}

/// Derives one Explore collection's state from the resolved season, its own
/// Drift-backed stream, its own persisted resource metadata and its own
/// transient refresh status.
///
/// Pure and side-effect free, so every state is unit-testable without Riverpod
/// or a widget tree. Materialization comes from the shared
/// [hasMaterializedCollection] rule — never from the number of rows — so a valid
/// empty collection and one that has never synchronised stay distinguishable.
///
/// Freshness is this resource's **own**, and is `null` while it has none (a
/// representation materialized by bootstrap). Bootstrap provenance is never
/// borrowed to fill it in, and no other collection's record is ever consulted.
ExploreCollectionState<C> computeExploreCollectionState<C>({
  required int? season,
  required bool seasonReady,
  required List<C>? cards,
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
  final ExploreFailure? refreshError = (refreshing || lastFailure == null)
      ? null
      : ExploreFailure.resource(lastFailure);

  // Cached cards always win: content is never replaced by a loader or an error.
  if (season != null && cards != null && cards.isNotEmpty) {
    return ExploreCollectionReady<C>(
      season: season,
      cards: cards,
      freshness: freshness,
      lastSuccessAt: metadata?.lastSuccessAt,
      refreshing: refreshing,
      refreshError: refreshError,
    );
  }

  if (season == null) {
    // Only claim the season is unresolvable once an application run has
    // actually finished trying; before that this is an ordinary first load.
    if (!seasonReady || refreshing || !syncSettled) {
      return ExploreCollectionLoading<C>();
    }
    return ExploreCollectionFirstLoadError<C>(
      const ExploreFailure.seasonUnresolved(),
    );
  }

  if (cards == null || !metadataReady || !bootstrapMetadataReady) {
    return ExploreCollectionLoading<C>();
  }

  // A materialized authoritative collection — synchronised directly, or applied
  // by an accepted bootstrap for this exact season — makes an empty collection a
  // valid representation rather than an unknown one.
  if (hasMaterializedCollection(
    season: season,
    metadata: metadata,
    bootstrapMetadata: bootstrapMetadata,
  )) {
    return ExploreCollectionEmpty<C>(
      season: season,
      freshness: freshness,
      lastSuccessAt: metadata?.lastSuccessAt,
      refreshing: refreshing,
      refreshError: refreshError,
    );
  }

  if (!refreshing && lastFailure != null) {
    return ExploreCollectionFirstLoadError<C>(
      ExploreFailure.resource(lastFailure),
    );
  }
  return ExploreCollectionLoading<C>();
}

/// The Explore screen's state: the selected category, the resolved season and
/// **all three** collections' independently derived states.
///
/// Unselected categories keep their state rather than discarding it, so
/// switching the selector immediately reveals cached cards without a loader and
/// without a request.
class ExploreScreenState {
  const ExploreScreenState({
    required this.selected,
    required this.season,
    required this.drivers,
    required this.teams,
    required this.circuits,
  });

  final ExploreCategory selected;

  /// The season being shown: the locally resolved current season. Never a
  /// hardcoded year.
  final int? season;

  final ExploreCollectionState<SeasonDriverCard> drivers;
  final ExploreCollectionState<SeasonTeamCard> teams;
  final ExploreCollectionState<SeasonCircuitCard> circuits;

  /// Whether the *selected* collection is currently refreshing. Freshness,
  /// failures and progress are always scoped to the selected resource.
  bool get selectedRefreshing => switch (selected) {
    ExploreCategory.drivers => _refreshing(drivers),
    ExploreCategory.teams => _refreshing(teams),
    ExploreCategory.circuits => _refreshing(circuits),
  };

  static bool _refreshing<C>(ExploreCollectionState<C> state) =>
      switch (state) {
        ExploreCollectionReady<C>(:final bool refreshing) => refreshing,
        ExploreCollectionEmpty<C>(:final bool refreshing) => refreshing,
        _ => false,
      };
}
