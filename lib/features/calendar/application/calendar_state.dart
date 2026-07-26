import '../../../core/api/errors/api_failure.dart';
import '../../shared/domain/entities/calendar_entry.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/freshness_evaluator.dart';
import '../../shared/domain/relevant_event.dart';

/// Why the Calendar could not be shown or could not be refreshed.
///
/// Only these two causes are the Calendar's own: an unrelated core resource
/// failing during an application run is never a Calendar error.
enum CalendarFailureCause {
  /// No current season could be resolved locally, so there is no canonical
  /// `calendar:<season>` resource to read or refresh.
  seasonUnresolved,

  /// The calendar resource itself failed to synchronise.
  resourceFailed,
}

/// A Calendar-owned failure: the cause, plus the typed API failure when one
/// exists (an unresolved season has no HTTP failure behind it).
class CalendarFailure {
  const CalendarFailure(this.cause, [this.failure]);

  const CalendarFailure.seasonUnresolved()
    : cause = CalendarFailureCause.seasonUnresolved,
      failure = null;

  const CalendarFailure.resource(ApiFailure this.failure)
    : cause = CalendarFailureCause.resourceFailed;

  final CalendarFailureCause cause;
  final ApiFailure? failure;
}

/// The Calendar screen's typed presentation state.
///
/// The variants are mutually exclusive: a valid empty calendar is never
/// "loading", and cached events are never replaced by an error.
sealed class CalendarState {
  const CalendarState();
}

/// No season resolved yet, or no materialized calendar representation yet.
class CalendarLoading extends CalendarState {
  const CalendarLoading();
}

/// Nothing local to show and the relevant synchronization failed — either the
/// calendar resource itself, or the season context it needs.
class CalendarFirstLoadError extends CalendarState {
  const CalendarFirstLoadError(this.failure);

  final CalendarFailure failure;
}

/// The calendar representation is materialized and legitimately carries no
/// events. A real, valid state — never loading, never an error.
class CalendarEmpty extends CalendarState {
  const CalendarEmpty({
    required this.season,
    required this.freshness,
    this.lastSuccessAt,
    this.refreshing = false,
    this.refreshError,
  });

  final int season;
  final FreshnessState freshness;
  final DateTime? lastSuccessAt;
  final bool refreshing;
  final CalendarFailure? refreshError;

  bool get isStale => freshness == FreshnessState.stale;
}

/// Cached events are available.
class CalendarReady extends CalendarState {
  const CalendarReady({
    required this.season,
    required this.events,
    required this.freshness,
    this.relevant,
    this.lastSuccessAt,
    this.refreshing = false,
    this.refreshError,
  });

  final int season;

  /// The season's events in their persisted (round) order.
  final List<CalendarEntry> events;

  /// The event to highlight, or null when the season has none left.
  final RelevantEvent? relevant;

  final FreshnessState freshness;
  final DateTime? lastSuccessAt;
  final bool refreshing;

  /// A refresh failure that kept the cached events visible.
  final CalendarFailure? refreshError;

  bool get isStale => freshness == FreshnessState.stale;

  /// The identity of the highlighted event, or null when there is none.
  String? get relevantEventId => relevant?.event.id;
}

/// Derives the Calendar state from the locally resolved season, the Drift-backed
/// calendar stream, the persisted resource metadata and the transient manual
/// refresh status.
///
/// Pure and side-effect free, so every state is unit-testable without Riverpod
/// or a widget tree. Materialization is read from [metadata] — never inferred
/// from the number of events — so a valid empty calendar and one that has never
/// synchronised stay distinguishable.
CalendarState computeCalendarState({
  required int? season,
  required bool seasonReady,
  required List<CalendarEntry>? events,
  required ResourceSyncState? metadata,
  required bool metadataReady,
  required bool refreshing,
  required ApiFailure? lastFailure,
  required bool syncSettled,
  required DateTime now,
}) {
  final FreshnessState freshness = evaluateResourceFreshness(metadata, now);
  final CalendarFailure? refreshError = (refreshing || lastFailure == null)
      ? null
      : CalendarFailure.resource(lastFailure);

  // Cached events always win: content is never replaced by a loader or an error.
  if (season != null && events != null && events.isNotEmpty) {
    return CalendarReady(
      season: season,
      events: events,
      relevant: resolveRelevantEvent(
        events.map((CalendarEntry e) => e.grandPrix),
        now,
      ),
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
      return const CalendarLoading();
    }
    return const CalendarFirstLoadError(CalendarFailure.seasonUnresolved());
  }

  if (events == null || !metadataReady) return const CalendarLoading();

  // A recorded success is what materializes an authoritative collection, so an
  // empty-but-synced calendar is a valid representation.
  if (metadata?.lastSuccessAt != null) {
    return CalendarEmpty(
      season: season,
      freshness: freshness,
      lastSuccessAt: metadata?.lastSuccessAt,
      refreshing: refreshing,
      refreshError: refreshError,
    );
  }

  if (!refreshing && lastFailure != null) {
    return CalendarFirstLoadError(CalendarFailure.resource(lastFailure));
  }
  return const CalendarLoading();
}
