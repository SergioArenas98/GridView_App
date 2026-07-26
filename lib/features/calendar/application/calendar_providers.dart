import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/application/providers.dart';
import '../../shared/application/refresh_status.dart';
import '../../shared/domain/entities/calendar_entry.dart';
import '../../shared/domain/entities/resource_key.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../sync/application/resource_refresh_status.dart';
import '../../sync/application/sync_providers.dart';
import '../../sync/domain/app_sync_state.dart';
import '../../sync/domain/sync_resource.dart';
import 'calendar_state.dart';

/// The Drift-backed calendar stream for one season.
///
/// Keyed by season so a season transition switches to a different resource
/// rather than mutating one: the previous season's rows stay in Drift, simply
/// unwatched.
final calendarCacheProvider = StreamProvider.family<List<CalendarEntry>, int>(
  (Ref ref, int season) =>
      ref.watch(calendarRepositoryProvider).watchCalendar(season),
);

/// Owns the Calendar's *presentation* refresh status — never its content.
///
/// It deliberately starts **no** refresh when it is created: startup and
/// foreground refresh of the current-season core set belong to the single
/// application-level coordinator, so a screen rebuild can never produce a
/// request. What it does instead is mirror that coordinator's report for the
/// exact `calendar:<season>` resource, and expose [refresh] for the user's
/// pull-to-refresh / retry.
class CalendarController extends Notifier<RefreshStatus> {
  int? _season;

  @override
  RefreshStatus build() {
    _season = ref.watch(currentSeasonProvider).value;
    ref.listen<AppSyncState>(appSyncStateProvider, (
      AppSyncState? _,
      AppSyncState next,
    ) {
      final RefreshStatus? mapped = _statusFor(next, _season);
      if (mapped != null) state = mapped;
    });
    return _statusFor(ref.read(appSyncStateProvider), _season) ??
        RefreshStatus.idle;
  }

  /// The user-initiated refresh: the Phase 6B2 manual current-season core run.
  ///
  /// It forces eligibility for one run while keeping conditional requests and
  /// persisted ETags, needs no `BuildContext`, and is coalesced by the
  /// coordinator when tapped repeatedly. The returned future always completes —
  /// after success, failure or cancellation — so a refresh indicator can never
  /// hang.
  Future<void> refresh() async {
    if (state.inProgress) return;
    state = RefreshStatus.running;
    try {
      await refreshCurrentSeasonCore(ref);
    } finally {
      // The listener above normally publishes the terminal status; settle it
      // here too in case the run ended without emitting anything new.
      if (ref.mounted && state.inProgress) {
        state =
            _statusFor(ref.read(appSyncStateProvider), _season) ??
            RefreshStatus.idle;
      }
    }
  }

  /// Maps an application-level state onto the Calendar's status.
  ///
  /// Matching is strictly scoped to `calendar:<season>`: another season's
  /// calendar, or any unrelated core resource, never becomes this screen's
  /// error.
  static RefreshStatus? _statusFor(AppSyncState state, int? season) {
    if (season == null) {
      return state is AppSyncRunning ? RefreshStatus.running : null;
    }
    return resourceRefreshStatus(
      state,
      (SyncResource resource) =>
          resource is CalendarSyncResource && resource.year == season,
    );
  }
}

final NotifierProvider<CalendarController, RefreshStatus>
calendarControllerProvider =
    NotifierProvider<CalendarController, RefreshStatus>(CalendarController.new);

/// The derived, typed Calendar presentation state.
final Provider<CalendarState> calendarStateProvider = Provider<CalendarState>((
  Ref ref,
) {
  final AsyncValue<int?> season = ref.watch(currentSeasonProvider);
  final int? year = season.value;
  final RefreshStatus status = ref.watch(calendarControllerProvider);
  final AppSyncState sync = ref.watch(appSyncStateProvider);
  final DateTime now = ref.watch(clockProvider)();

  AsyncValue<List<CalendarEntry>>? events;
  AsyncValue<ResourceSyncState?>? metadata;
  if (year != null) {
    events = ref.watch(calendarCacheProvider(year));
    metadata = ref.watch(resourceSyncStateProvider(ResourceKey.calendar(year)));
  }
  // Bootstrap's own record. It is read for one thing only — whether an accepted
  // bootstrap materialized *this* season's collections — and contributes no
  // ETag, provenance or freshness to the calendar resource.
  final AsyncValue<ResourceSyncState?> bootstrap = ref.watch(
    resourceSyncStateProvider(ResourceKey.bootstrap()),
  );

  return computeCalendarState(
    season: year,
    seasonReady: season.hasValue,
    events: events?.value,
    metadata: metadata?.value,
    metadataReady: metadata?.hasValue ?? false,
    bootstrapMetadata: bootstrap.value,
    bootstrapMetadataReady: bootstrap.hasValue,
    refreshing: status.inProgress,
    lastFailure: status.lastFailure,
    syncSettled: sync is! AppSyncIdle && sync is! AppSyncRunning,
    now: now,
  );
});
