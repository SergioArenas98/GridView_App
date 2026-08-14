import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/environment/app_environment.dart';
import '../../../core/database/connection/open_connection.dart';
import '../../../core/database/gridview_database.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/data_source_config.dart';
import '../../../core/network/gridview_dio.dart';
import '../../../core/observability/observability_providers.dart';
import '../../../core/time/device_time_zone.dart';
import '../data/remote/dio_gridview_api.dart';
import '../data/remote/fixture_gridview_api.dart';
import '../data/remote/gridview_api.dart';
import '../data/remote/misconfigured_gridview_api.dart';
import '../data/repositories/bootstrap_repository_impl.dart';
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
import '../data/sync/sync_observation.dart';
import '../domain/entities/media.dart';
import '../domain/entities/season.dart';
import '../domain/entities/sync_state.dart';
import '../domain/repositories/bootstrap_repository.dart';
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

/// The clock the device is on.
///
/// Production defers to the platform, so the device's own daylight-saving
/// transitions are handled for instants arbitrarily far ahead. Tests override it
/// with a pinned IANA zone so a widget test or golden never depends on the host
/// machine (a developer machine and the CI runner convert the same instant
/// differently and report different zone names for it).
final Provider<DeviceTimeZone> deviceTimeZoneProvider =
    Provider<DeviceTimeZone>((Ref ref) => const DeviceTimeZone.system());

/// The device's current time-zone label, as shown to the user.
///
/// Derived from [deviceTimeZoneProvider] and the injected clock, so the label
/// and the conversion can never disagree about which zone the user is reading.
final Provider<String> deviceTimeZoneLabelProvider = Provider<String>((
  Ref ref,
) {
  final DateTime now = ref.watch(clockProvider)();
  final String name = ref
      .watch(deviceTimeZoneProvider)
      .toDeviceTime(now)
      .timeZoneName;
  return name.isEmpty ? 'local' : name;
});

/// Every credit line that must be displayed for the locally stored media.
///
/// A pure local read, so the acknowledgements screen never issues a request and
/// works offline as soon as media metadata has been persisted once.
///
/// A stream rather than a one-shot read: when a replacement snapshot removes an
/// asset, the credit it required stops being displayed on its own. The screen is
/// then a straight rendering of what is currently stored, which is the only claim
/// it is entitled to make.
final StreamProvider<List<MediaAttribution>> mediaAttributionsProvider =
    StreamProvider<List<MediaAttribution>>(
      (Ref ref) => ref.watch(databaseProvider).mediaDao.watchAttributions(),
    );

/// The build environment. Overridable in tests.
final Provider<AppEnvironment> appEnvironmentProvider =
    Provider<AppEnvironment>((Ref ref) => AppEnvironment.current);

/// Networking configuration for the active environment.
final Provider<ApiConfig> apiConfigProvider = Provider<ApiConfig>(
  (Ref ref) => ApiConfig.forEnvironment(ref.watch(appEnvironmentProvider)),
);

/// The deliberately-selected remote data-source mode (`DATA_SOURCE`
/// build define). Overridable in tests. Fixture mode is never inferred; a
/// missing or malformed value resolves to [DataSourceMode.remote].
final Provider<DataSourceMode> dataSourceModeProvider =
    Provider<DataSourceMode>(
      (Ref ref) => DataSourceConfig.fromEnvironment().mode,
    );

/// The application database. Opened once and closed with the scope.
///
/// The open is traced (once per process, on first use) because it is the one
/// unavoidable local I/O step between launching and rendering cached content:
/// if it regresses, every screen starts late and nothing else in the app
/// explains why.
final Provider<GridViewDatabase> databaseProvider = Provider<GridViewDatabase>((
  Ref ref,
) {
  final GridViewDatabase db = GridViewDatabase(
    connection: openAppConnection(tracer: ref.watch(performanceTracerProvider)),
  );
  ref.onDispose(db.close);
  return db;
});

/// The remote data source for the active build.
///
/// Selection is a deliberate function of `(environment, DATA_SOURCE mode, base
/// URL)`; the bundled fixture source is used **only** when fixture mode is
/// explicitly selected in a non-production build. It is never inferred from a
/// missing `API_BASE_URL`.
///
/// - **production** never constructs the fixture source: fixture mode is a
///   controlled configuration failure, and remote mode with no base URL is a
///   controlled configuration failure. A valid base URL uses the real HTTP
///   client.
/// - **dev/staging** use the bundled fixtures only under explicit fixture mode;
///   remote mode requires a valid base URL (else a controlled configuration
///   failure, not fixtures).
final Provider<GridViewApi> remoteApiProvider = Provider<GridViewApi>((
  Ref ref,
) {
  final AppEnvironment env = ref.watch(appEnvironmentProvider);
  final ApiConfig config = ref.watch(apiConfigProvider);
  final DataSourceMode mode = ref.watch(dataSourceModeProvider);

  if (env.isProduction) {
    // Production must never construct FixtureGridViewApi.
    if (mode == DataSourceMode.fixture) {
      return const MisconfiguredGridViewApi(
        MisconfigurationReason.fixtureForbiddenInProduction,
      );
    }
    if (!config.hasBaseUrl) {
      return const MisconfiguredGridViewApi(
        MisconfigurationReason.missingBaseUrl,
      );
    }
    return DioGridViewApi(buildGridViewDio(config));
  }

  // Dev / staging.
  if (mode == DataSourceMode.fixture) {
    return FixtureGridViewApi();
  }
  // Remote mode: a base URL is required — never fall back to fixtures.
  if (!config.hasBaseUrl) {
    return const MisconfiguredGridViewApi(
      MisconfigurationReason.missingBaseUrl,
    );
  }
  return DioGridViewApi(buildGridViewDio(config, enableSafeLogging: true));
});

/// Whether the active remote source serves non-authoritative mock data (drives
/// the dev/staging mock banner). Always `false` in production.
final Provider<bool> usesMockDataProvider = Provider<bool>(
  (Ref ref) => ref.watch(remoteApiProvider).usesMockData,
);

/// Resolves the locally stored current-season year, or null when none is
/// stored.
///
/// Season-scoped feature controllers call this to build canonical resource keys
/// (Home, calendar, standings, …) — a controller never reaches into the season
/// repository itself. It is deliberately a **function** rather than an async
/// provider: there is no loading state to thread through, and a widget test can
/// supply a season with `overrideWithValue` without constructing the database.
typedef CurrentSeasonResolver = Future<int?> Function();

final Provider<CurrentSeasonResolver> currentSeasonResolverProvider =
    Provider<CurrentSeasonResolver>((Ref ref) {
      final SeasonRepository seasons = ref.watch(seasonRepositoryProvider);
      return () async => (await seasons.readCurrentSeason())?.year;
    });

/// The locally resolved current-season year as a stream, or `null` while none is
/// stored.
///
/// Season-agnostic screens (Calendar, later Standings) watch this so a season
/// transition re-points them at the new season's resources without a route
/// change and without any hardcoded year. It reads only the local database: a
/// transient loss of connectivity never clears an already-resolved season.
final StreamProvider<int?> currentSeasonProvider = StreamProvider<int?>(
  (Ref ref) => ref
      .watch(seasonRepositoryProvider)
      .watchCurrentSeason()
      .map((Season? season) => season?.year),
);

/// Streams the persisted synchronization metadata of one canonical resource key.
///
/// This is the durable materialization/freshness record — never a row count and
/// never in-memory run state — so a successfully synchronised but empty
/// collection is distinguishable from one that has never synchronised.
// The family type itself is not exported by flutter_riverpod's show-list, so the
// provider is declared without an explicit type annotation.
final resourceSyncStateProvider =
    StreamProvider.family<ResourceSyncState?, String>(
      (Ref ref, String key) =>
          ref.watch(databaseProvider).syncMetadataDao.watchResource(key),
    );

/// The transactional resource-sync writer (conflict rule + metadata), bound to
/// the single application database.
///
/// Its apply-error observer is the application's single materialization report:
/// one wiring here covers all twelve repositories.
final Provider<ResourceSync> resourceSyncProvider = Provider<ResourceSync>(
  (Ref ref) => ResourceSync(
    ref.watch(databaseProvider),
    onApplyError: observeSnapshotApplyErrors(
      reporter: ref.watch(errorReporterProvider),
      environment: ref.watch(appEnvironmentProvider),
    ),
  ),
);

/// The shared per-resource in-flight coordinator. One instance deduplicates
/// concurrent refreshes by canonical resource key across every repository;
/// different keys never block one another (no global lock).
///
/// Its outcome observer is the application's single refresh-failure report:
/// because every repository refresh runs through this one object, the reporting
/// policy is applied in exactly one place and collapsed duplicate refreshes are
/// reported once rather than once per caller.
final Provider<RefreshCoordinator> refreshCoordinatorProvider =
    Provider<RefreshCoordinator>(
      (Ref ref) => RefreshCoordinator(
        onOutcome: observeRefreshOutcomes(
          reporter: ref.watch(errorReporterProvider),
          environment: ref.watch(appEnvironmentProvider),
        ),
      ),
    );

// --- Repositories -------------------------------------------------------

/// The first-launch aggregate repository. It writes several domain families in
/// one transaction, so it is bound to the same single database instance as
/// every other repository.
final Provider<BootstrapRepository> bootstrapRepositoryProvider =
    Provider<BootstrapRepository>((Ref ref) {
      final GridViewDatabase db = ref.watch(databaseProvider);
      return BootstrapRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        sync: ref.watch(resourceSyncProvider),
        coordinator: ref.watch(refreshCoordinatorProvider),
        now: ref.watch(clockProvider),
        seasons: db.seasonDao,
        calendar: db.calendarDao,
        competitors: db.competitorDao,
        standings: db.standingsDao,
        snapshots: db.verticalSliceDao,
      );
    });

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
        dashboard: ref.watch(databaseProvider).homeDashboardDao,
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
