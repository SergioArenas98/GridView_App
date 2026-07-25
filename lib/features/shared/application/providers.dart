import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/environment/app_environment.dart';
import '../../../core/database/gridview_database.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/gridview_dio.dart';
import '../data/remote/dio_gridview_api.dart';
import '../data/remote/fixture_gridview_api.dart';
import '../data/remote/gridview_api.dart';
import '../data/repositories/calendar_repository_impl.dart';
import '../data/repositories/circuit_repository_impl.dart';
import '../data/repositories/constructor_repository_impl.dart';
import '../data/repositories/content_repository_impl.dart';
import '../data/repositories/driver_repository_impl.dart';
import '../data/repositories/grand_prix_repository_impl.dart';
import '../data/repositories/home_repository_impl.dart';
import '../data/repositories/result_repository_impl.dart';
import '../data/repositories/season_repository_impl.dart';
import '../data/repositories/standings_repository_impl.dart';
import '../data/sync/refresh_coordinator.dart';
import '../data/sync/resource_sync.dart';
import '../domain/repositories/calendar_repository.dart';
import '../domain/repositories/circuit_repository.dart';
import '../domain/repositories/constructor_repository.dart';
import '../domain/repositories/content_repository.dart';
import '../domain/repositories/driver_repository.dart';
import '../domain/repositories/grand_prix_repository.dart';
import '../domain/repositories/home_repository.dart';
import '../domain/repositories/result_repository.dart';
import '../domain/repositories/season_repository.dart';
import '../domain/repositories/standings_repository.dart';

/// A `now` provider, overridable in tests for deterministic freshness.
final Provider<DateTime Function()> clockProvider =
    Provider<DateTime Function()>((Ref ref) => DateTime.now);

/// The build environment. Overridable in tests.
final Provider<AppEnvironment> appEnvironmentProvider =
    Provider<AppEnvironment>((Ref ref) => AppEnvironment.current);

/// Networking configuration for the active environment.
final Provider<ApiConfig> apiConfigProvider = Provider<ApiConfig>(
  (Ref ref) => ApiConfig.forEnvironment(ref.watch(appEnvironmentProvider)),
);

/// The application database. Opened once and closed with the scope.
final Provider<GridViewDatabase> databaseProvider = Provider<GridViewDatabase>((
  Ref ref,
) {
  final GridViewDatabase db = GridViewDatabase();
  ref.onDispose(db.close);
  return db;
});

/// The remote data source for the active environment.
///
/// Production always uses the real HTTP client and never falls back to mock
/// data — a missing base URL surfaces as a refresh failure, not fixtures.
/// Dev/staging use the bundled fixture source unless an explicit `API_BASE_URL`
/// is configured (e.g. a local fixture Worker or staging), in which case they
/// use the real HTTP client too.
final Provider<GridViewApi> remoteApiProvider = Provider<GridViewApi>((
  Ref ref,
) {
  final AppEnvironment env = ref.watch(appEnvironmentProvider);
  final ApiConfig config = ref.watch(apiConfigProvider);

  if (env.isProduction) {
    return DioGridViewApi(buildGridViewDio(config));
  }
  if (config.hasBaseUrl) {
    return DioGridViewApi(buildGridViewDio(config, enableSafeLogging: true));
  }
  return FixtureGridViewApi();
});

/// Whether the active remote source serves non-authoritative mock data (drives
/// the dev/staging mock banner). Always `false` in production.
final Provider<bool> usesMockDataProvider = Provider<bool>(
  (Ref ref) => ref.watch(remoteApiProvider).usesMockData,
);

/// The transactional resource-sync writer (conflict rule + metadata), bound to
/// the single application database.
final Provider<ResourceSync> resourceSyncProvider = Provider<ResourceSync>(
  (Ref ref) => ResourceSync(ref.watch(databaseProvider)),
);

/// The shared per-resource in-flight coordinator. One instance deduplicates
/// concurrent refreshes by canonical resource key across every repository;
/// different keys never block one another (no global lock).
final Provider<RefreshCoordinator> refreshCoordinatorProvider =
    Provider<RefreshCoordinator>((Ref ref) => RefreshCoordinator());

// --- Repositories -------------------------------------------------------

final Provider<SeasonRepository> seasonRepositoryProvider =
    Provider<SeasonRepository>(
      (Ref ref) => SeasonRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
        local: ref.watch(databaseProvider).seasonDao,
      ),
    );

final Provider<HomeRepository> homeRepositoryProvider =
    Provider<HomeRepository>(
      (Ref ref) => HomeRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
        local: ref.watch(databaseProvider).verticalSliceDao,
      ),
    );

final Provider<CalendarRepository> calendarRepositoryProvider =
    Provider<CalendarRepository>(
      (Ref ref) => CalendarRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
        local: ref.watch(databaseProvider).calendarDao,
      ),
    );

final Provider<GrandPrixRepository> grandPrixRepositoryProvider =
    Provider<GrandPrixRepository>(
      (Ref ref) => GrandPrixRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
        local: ref.watch(databaseProvider).verticalSliceDao,
        media: ref.watch(databaseProvider).mediaDao,
      ),
    );

final Provider<ResultRepository> resultRepositoryProvider =
    Provider<ResultRepository>(
      (Ref ref) => ResultRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
        local: ref.watch(databaseProvider).resultsDao,
      ),
    );

final Provider<StandingsRepository> standingsRepositoryProvider =
    Provider<StandingsRepository>(
      (Ref ref) => StandingsRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
        local: ref.watch(databaseProvider).standingsDao,
      ),
    );

final Provider<DriverRepository> driverRepositoryProvider =
    Provider<DriverRepository>(
      (Ref ref) => DriverRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
        local: ref.watch(databaseProvider).competitorDao,
      ),
    );

final Provider<ConstructorRepository> constructorRepositoryProvider =
    Provider<ConstructorRepository>(
      (Ref ref) => ConstructorRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
        local: ref.watch(databaseProvider).competitorDao,
      ),
    );

final Provider<CircuitRepository> circuitRepositoryProvider =
    Provider<CircuitRepository>(
      (Ref ref) => CircuitRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
        local: ref.watch(databaseProvider).calendarDao,
      ),
    );

final Provider<ContentRepository> contentRepositoryProvider =
    Provider<ContentRepository>(
      (Ref ref) => ContentRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
      ),
    );
