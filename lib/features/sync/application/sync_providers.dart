import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/observability/observability_providers.dart';
import '../../shared/application/providers.dart';
import '../data/resource_refresh_dispatcher.dart';
import '../domain/app_sync_state.dart';
import 'app_sync_coordinator.dart';

/// The maximum number of concurrent resource refreshes inside one stage.
/// Injected so tests can pin it and so the limit lives in exactly one place.
final Provider<int> syncConcurrencyProvider = Provider<int>(
  (Ref ref) => kDefaultSyncConcurrency,
);

/// The typed resource-key → repository-call registry.
final Provider<ResourceRefreshDispatcher> resourceRefreshDispatcherProvider =
    Provider<ResourceRefreshDispatcher>(
      (Ref ref) => ResourceRefreshDispatcher(
        bootstrap: ref.watch(bootstrapRepositoryProvider),
        season: ref.watch(seasonRepositoryProvider),
        home: ref.watch(homeRepositoryProvider),
        calendar: ref.watch(calendarRepositoryProvider),
        standings: ref.watch(standingsRepositoryProvider),
        drivers: ref.watch(driverRepositoryProvider),
        constructors: ref.watch(constructorRepositoryProvider),
        circuits: ref.watch(circuitRepositoryProvider),
        content: ref.watch(contentRepositoryProvider),
        grandPrix: ref.watch(grandPrixRepositoryProvider),
        results: ref.watch(resultRepositoryProvider),
      ),
    );

/// The aggregate synchronization state.
///
/// Deliberately **dependency-free**: it holds whatever the coordinator last
/// published and constructs nothing itself, so a feature controller (or a widget
/// test) can observe application-level synchronization without pulling in the
/// database, the remote data source or the whole repository graph.
class AppSyncStatusNotifier extends Notifier<AppSyncState> {
  @override
  AppSyncState build() => const AppSyncIdle();

  /// Publishes a new state. Called by the coordinator provider only.
  void publish(AppSyncState value) => state = value;
}

final NotifierProvider<AppSyncStatusNotifier, AppSyncState>
appSyncStateProvider = NotifierProvider<AppSyncStatusNotifier, AppSyncState>(
  AppSyncStatusNotifier.new,
);

/// The single application-level synchronization coordinator.
///
/// Creating it wires its state stream into [appSyncStateProvider]; disposing the
/// scope cancels any run in flight and releases every cancellation resource.
final Provider<AppSyncCoordinator> appSyncCoordinatorProvider =
    Provider<AppSyncCoordinator>((Ref ref) {
      final AppSyncCoordinator coordinator = AppSyncCoordinator(
        dispatcher: ref.watch(resourceRefreshDispatcherProvider),
        seasons: ref.watch(seasonRepositoryProvider),
        home: ref.watch(homeRepositoryProvider),
        bootstrap: ref.watch(bootstrapRepositoryProvider),
        metadata: ref.watch(databaseProvider).syncMetadataDao,
        now: ref.watch(clockProvider),
        maxConcurrency: ref.watch(syncConcurrencyProvider),
        tracer: ref.watch(performanceTracerProvider),
      );
      final StreamSubscription<AppSyncState> subscription = coordinator.states
          .listen(ref.read(appSyncStateProvider.notifier).publish);
      ref.onDispose(() {
        subscription.cancel();
        unawaited(coordinator.dispose());
      });
      return coordinator;
    });

/// A user-initiated refresh of the current-season core set.
typedef ManualCoreRefresh = Future<void> Function();

/// The manual current-season refresh entry point for Phase 7 feature
/// controllers.
///
/// It forces eligibility for one run, keeps conditional requests and persisted
/// ETags, and needs no `BuildContext`. Exposed as a provider so a feature
/// controller depends on the *capability* rather than on the coordinator's
/// whole object graph — a widget test can substitute it without opening a
/// database, and there is still exactly one implementation in the application.
final Provider<ManualCoreRefresh> manualCoreRefreshProvider =
    Provider<ManualCoreRefresh>(
      (Ref ref) =>
          () => ref.read(appSyncCoordinatorProvider).refreshNow(),
    );

/// Convenience wrapper around [manualCoreRefreshProvider].
Future<void> refreshCurrentSeasonCore(Ref ref) =>
    ref.read(manualCoreRefreshProvider)();
