import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/core/network/api_config.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/data/remote/dio_gridview_api.dart';
import 'package:gridview/features/shared/data/remote/fixture_gridview_api.dart';
import 'package:gridview/features/shared/data/remote/gridview_api.dart';
import 'package:gridview/features/shared/domain/repositories/race_weekend_repository.dart';

/// Proves production never uses the bundled fixture source and never silently
/// falls back to it, even when the API base URL is missing.
void main() {
  test(
    'production never constructs the fixture API (even with no base URL)',
    () async {
      final ProviderContainer container = ProviderContainer(
        overrides: [
          appEnvironmentProvider.overrideWithValue(AppEnvironment.production),
          apiConfigProvider.overrideWithValue(const ApiConfig(baseUrl: '')),
        ],
      );
      addTearDown(container.dispose);

      final GridViewApi api = container.read(remoteApiProvider);
      expect(api, isA<DioGridViewApi>());
      expect(api, isNot(isA<FixtureGridViewApi>()));
      expect(api.usesMockData, isFalse);
      expect(container.read(usesMockDataProvider), isFalse);
    },
  );

  test(
    'missing production API config yields a controlled failure, not fixtures',
    () async {
      final GridViewDatabase db = GridViewDatabase.forTesting(
        NativeDatabase.memory(),
      );
      addTearDown(db.close);
      final ProviderContainer container = ProviderContainer(
        overrides: [
          appEnvironmentProvider.overrideWithValue(AppEnvironment.production),
          apiConfigProvider.overrideWithValue(const ApiConfig(baseUrl: '')),
          databaseProvider.overrideWithValue(db),
        ],
      );
      addTearDown(container.dispose);

      final RaceWeekendRepository repo = container.read(
        raceWeekendRepositoryProvider,
      );
      final RefreshResult result = await repo.refreshHome();

      // A controlled, typed failure — never a fixture-backed success.
      expect(result, isA<RefreshFailure>());
      // No fixture data was written to the cache.
      expect(await repo.watchHome().first, isNull);
    },
  );

  test('dev/staging select the remote source deterministically', () async {
    ProviderContainer devWith({required String baseUrl}) => ProviderContainer(
      overrides: [
        appEnvironmentProvider.overrideWithValue(AppEnvironment.development),
        apiConfigProvider.overrideWithValue(ApiConfig(baseUrl: baseUrl)),
      ],
    );

    final ProviderContainer noUrl = devWith(baseUrl: '');
    addTearDown(noUrl.dispose);
    expect(noUrl.read(remoteApiProvider), isA<FixtureGridViewApi>());
    expect(noUrl.read(usesMockDataProvider), isTrue);

    final ProviderContainer withUrl = devWith(baseUrl: 'https://staging.test');
    addTearDown(withUrl.dispose);
    expect(withUrl.read(remoteApiProvider), isA<DioGridViewApi>());
    expect(withUrl.read(usesMockDataProvider), isFalse);
  });
}
