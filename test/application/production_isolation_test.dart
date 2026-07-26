import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/core/network/api_config.dart';
import 'package:gridview/core/network/data_source_config.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/data/remote/dio_gridview_api.dart';
import 'package:gridview/features/shared/data/remote/fixture_gridview_api.dart';
import 'package:gridview/features/shared/data/remote/gridview_api.dart';
import 'package:gridview/features/shared/data/remote/misconfigured_gridview_api.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/domain/repositories/content_repository.dart';
import 'package:gridview/features/shared/domain/repositories/home_repository.dart';

/// Builds a container for the remote-source selection with a fixed environment,
/// base URL and (already-parsed) data-source mode.
ProviderContainer _container({
  required AppEnvironment env,
  required String baseUrl,
  required DataSourceMode mode,
  GridViewDatabase? db,
}) {
  return ProviderContainer(
    overrides: [
      appEnvironmentProvider.overrideWithValue(env),
      apiConfigProvider.overrideWithValue(ApiConfig(baseUrl: baseUrl)),
      dataSourceModeProvider.overrideWithValue(mode),
      if (db != null) databaseProvider.overrideWithValue(db),
    ],
  );
}

void main() {
  // ---------------------------------------------------------------------------
  // DATA_SOURCE parsing: fixtures require a deliberate value; a missing or
  // malformed value never enables fixtures.
  // ---------------------------------------------------------------------------
  group('DataSourceConfig.parse', () {
    test('only the exact token "fixture" selects fixtures', () {
      expect(DataSourceConfig.parse('fixture'), DataSourceMode.fixture);
      expect(DataSourceConfig.parse('  FIXTURE  '), DataSourceMode.fixture);
    });

    test('"remote" selects remote', () {
      expect(DataSourceConfig.parse('remote'), DataSourceMode.remote);
    });

    test('a missing value resolves to remote (never fixtures)', () {
      expect(DataSourceConfig.parse(''), DataSourceMode.remote);
      expect(DataSourceConfig.parse('   '), DataSourceMode.remote);
    });

    test('a malformed value resolves to remote (never fixtures)', () {
      expect(DataSourceConfig.parse('banana'), DataSourceMode.remote);
      expect(DataSourceConfig.parse('fixtures'), DataSourceMode.remote);
      expect(DataSourceConfig.parse('true'), DataSourceMode.remote);
      expect(DataSourceConfig.isMalformed('banana'), isTrue);
      expect(DataSourceConfig.isMalformed(''), isFalse);
      expect(DataSourceConfig.isMalformed('remote'), isFalse);
    });
  });

  // ---------------------------------------------------------------------------
  // The complete remote-source selection truth table.
  // ---------------------------------------------------------------------------
  group('remote-source selection truth table', () {
    for (final AppEnvironment env in <AppEnvironment>[
      AppEnvironment.development,
      AppEnvironment.staging,
    ]) {
      test('$env + explicit remote + valid base URL -> Dio', () {
        final ProviderContainer c = _container(
          env: env,
          baseUrl: 'https://api.example',
          mode: DataSourceMode.remote,
        );
        addTearDown(c.dispose);
        expect(c.read(remoteApiProvider), isA<DioGridViewApi>());
        expect(c.read(usesMockDataProvider), isFalse);
      });

      test('$env + explicit fixture -> Fixture (banner shown)', () {
        final ProviderContainer c = _container(
          env: env,
          baseUrl: '',
          mode: DataSourceMode.fixture,
        );
        addTearDown(c.dispose);
        expect(c.read(remoteApiProvider), isA<FixtureGridViewApi>());
        expect(c.read(usesMockDataProvider), isTrue);
      });

      test(
        '$env + explicit fixture + a base URL still uses fixtures (deliberate)',
        () {
          final ProviderContainer c = _container(
            env: env,
            baseUrl: 'https://api.example',
            mode: DataSourceMode.fixture,
          );
          addTearDown(c.dispose);
          expect(c.read(remoteApiProvider), isA<FixtureGridViewApi>());
          expect(c.read(usesMockDataProvider), isTrue);
        },
      );

      test(
        '$env + remote + missing base URL -> controlled failure, not fixtures',
        () {
          final ProviderContainer c = _container(
            env: env,
            baseUrl: '',
            mode: DataSourceMode.remote,
          );
          addTearDown(c.dispose);
          final GridViewApi api = c.read(remoteApiProvider);
          expect(api, isA<MisconfiguredGridViewApi>());
          expect(api, isNot(isA<FixtureGridViewApi>()));
          expect(api.usesMockData, isFalse);
          expect(c.read(usesMockDataProvider), isFalse);
        },
      );

      test(
        '$env + missing mode (defaults remote) + no base URL -> not fixtures',
        () {
          final ProviderContainer c = _container(
            env: env,
            baseUrl: '',
            mode: DataSourceConfig.parse(''), // missing -> remote
          );
          addTearDown(c.dispose);
          expect(c.read(remoteApiProvider), isA<MisconfiguredGridViewApi>());
          expect(c.read(usesMockDataProvider), isFalse);
        },
      );

      test(
        '$env + malformed mode (defaults remote) + base URL -> Dio, not fixtures',
        () {
          final ProviderContainer c = _container(
            env: env,
            baseUrl: 'https://api.example',
            mode: DataSourceConfig.parse('banana'), // malformed -> remote
          );
          addTearDown(c.dispose);
          expect(c.read(remoteApiProvider), isA<DioGridViewApi>());
          expect(c.read(usesMockDataProvider), isFalse);
        },
      );
    }

    // Production.
    test('production + valid base URL -> Dio', () {
      final ProviderContainer c = _container(
        env: AppEnvironment.production,
        baseUrl: 'https://api.example',
        mode: DataSourceMode.remote,
      );
      addTearDown(c.dispose);
      expect(c.read(remoteApiProvider), isA<DioGridViewApi>());
      expect(c.read(usesMockDataProvider), isFalse);
    });

    test(
      'production + missing base URL -> controlled failure, not fixtures',
      () {
        final ProviderContainer c = _container(
          env: AppEnvironment.production,
          baseUrl: '',
          mode: DataSourceMode.remote,
        );
        addTearDown(c.dispose);
        final GridViewApi api = c.read(remoteApiProvider);
        expect(api, isA<MisconfiguredGridViewApi>());
        expect(
          (api as MisconfiguredGridViewApi).reason,
          MisconfigurationReason.missingBaseUrl,
        );
        expect(api, isNot(isA<FixtureGridViewApi>()));
        expect(c.read(usesMockDataProvider), isFalse);
      },
    );

    test(
      'production + attempted fixture mode -> explicit rejection, never Fixture',
      () {
        for (final String baseUrl in <String>['', 'https://api.example']) {
          final ProviderContainer c = _container(
            env: AppEnvironment.production,
            baseUrl: baseUrl,
            mode: DataSourceMode.fixture,
          );
          addTearDown(c.dispose);
          final GridViewApi api = c.read(remoteApiProvider);
          expect(api, isA<MisconfiguredGridViewApi>());
          expect(api, isNot(isA<FixtureGridViewApi>()));
          expect(
            (api as MisconfiguredGridViewApi).reason,
            MisconfigurationReason.fixtureForbiddenInProduction,
          );
          expect(c.read(usesMockDataProvider), isFalse);
        }
      },
    );
  });

  // ---------------------------------------------------------------------------
  // A misconfigured source yields controlled, typed failures — never fixtures.
  // ---------------------------------------------------------------------------
  test(
    'a misconfigured production build fails every repository refresh cleanly',
    () async {
      final GridViewDatabase db = GridViewDatabase.forTesting(
        NativeDatabase.memory(),
      );
      addTearDown(db.close);
      final ProviderContainer c = _container(
        env: AppEnvironment.production,
        baseUrl: '',
        mode: DataSourceMode.remote,
        db: db,
      );
      addTearDown(c.dispose);

      final HomeRepository home = c.read(homeRepositoryProvider);
      final RefreshResult result = await home.refreshHome(season: 2026);
      expect(result, isA<RefreshFailure>());
      expect(
        (result as RefreshFailure).failure.kind,
        ApiFailureKind.configuration,
      );
      // No fixture data was written.
      expect(await home.watchHome().first, isNull);

      // Every repository surfaces the same controlled configuration failure.
      final List<RefreshResult> results = <RefreshResult>[
        await c.read(seasonRepositoryProvider).refreshCurrentSeason(),
        await c.read(calendarRepositoryProvider).refreshCalendar(2026),
        await c
            .read(grandPrixRepositoryProvider)
            .refreshGrandPrix(season: 2026, round: 13),
        await c
            .read(resultRepositoryProvider)
            .refreshResults(season: 2026, round: 13),
        await c.read(standingsRepositoryProvider).refreshDriverStandings(2026),
        await c
            .read(standingsRepositoryProvider)
            .refreshConstructorStandings(2026),
        await c.read(driverRepositoryProvider).refreshSeasonDrivers(2026),
        await c
            .read(driverRepositoryProvider)
            .refreshDriver(driverId: 'max-verstappen', season: 2026),
        await c
            .read(constructorRepositoryProvider)
            .refreshSeasonConstructors(2026),
        await c
            .read(constructorRepositoryProvider)
            .refreshConstructor(constructorId: 'ferrari', season: 2026),
        await c.read(circuitRepositoryProvider).refreshSeasonCircuits(2026),
        await c
            .read(circuitRepositoryProvider)
            .refreshCircuit(circuitId: 'spa-francorchamps', season: 2026),
        await c.read(contentRepositoryProvider).refreshContentManifest(),
      ];
      for (final RefreshResult r in results) {
        expect(r, isA<RefreshFailure>());
        expect(
          (r as RefreshFailure).failure.kind,
          ApiFailureKind.configuration,
        );
      }
    },
  );

  test('a production build with a base URL sends no admin credential', () {
    final ProviderContainer c = _container(
      env: AppEnvironment.production,
      baseUrl: 'https://api.example',
      mode: DataSourceMode.remote,
    );
    addTearDown(c.dispose);
    final GridViewApi api = c.read(remoteApiProvider);
    expect(api, isA<DioGridViewApi>());
    expect(api.usesMockData, isFalse);
    // The repository interfaces expose no admin/write surface at all.
    expect(c.read(homeRepositoryProvider), isA<HomeRepository>());
    expect(c.read(contentRepositoryProvider), isA<ContentRepository>());
  });

  test('no provider identifier appears in any consumed shared fixture', () {
    // The mobile client only ever sees the GridView wire contract; provider
    // identifiers must never leak into a payload it parses into domain/Drift.
    const List<String> forbidden = <String>[
      'providerid',
      'provider_id',
      'apisports',
      'api-sports',
      'ergast',
    ];
    final Directory dir = Directory('services/edge-api/test/fixtures/api/v1');
    final List<File> jsonFiles = dir
        .listSync(recursive: true)
        .whereType<File>()
        .where((File f) => f.path.endsWith('.json'))
        .toList();
    expect(jsonFiles, isNotEmpty);
    for (final File f in jsonFiles) {
      final String lower = f.readAsStringSync().toLowerCase();
      for (final String token in forbidden) {
        expect(
          lower.contains(token),
          isFalse,
          reason: '${f.path} contains forbidden provider token "$token"',
        );
      }
    }
  });
}
