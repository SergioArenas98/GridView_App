import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/environment/app_environment.dart';
import '../../../core/database/gridview_database.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/gridview_dio.dart';
import '../data/remote/dio_gridview_api.dart';
import '../data/remote/fixture_gridview_api.dart';
import '../data/remote/gridview_api.dart';
import '../data/repositories/race_weekend_repository_impl.dart';
import '../domain/repositories/race_weekend_repository.dart';

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

/// The vertical-slice repository.
final Provider<RaceWeekendRepository> raceWeekendRepositoryProvider =
    Provider<RaceWeekendRepository>((Ref ref) {
      return RaceWeekendRepositoryImpl(
        remote: ref.watch(remoteApiProvider),
        local: ref.watch(databaseProvider).verticalSliceDao,
      );
    });

/// Whether the active remote source serves non-authoritative mock data (drives
/// the dev/staging mock banner). Always `false` in production.
final Provider<bool> usesMockDataProvider = Provider<bool>(
  (Ref ref) => ref.watch(remoteApiProvider).usesMockData,
);
