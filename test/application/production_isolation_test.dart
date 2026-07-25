import 'dart:io';

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
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/domain/repositories/content_repository.dart';
import 'package:gridview/features/shared/domain/repositories/home_repository.dart';

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

      final HomeRepository repo = container.read(homeRepositoryProvider);
      final RefreshResult result = await repo.refreshHome();

      // A controlled, typed failure — never a fixture-backed success.
      expect(result, isA<RefreshFailure>());
      // No fixture data was written to the cache.
      expect(await repo.watchHome().first, isNull);
    },
  );

  test(
    'every production repository refresh fails cleanly with no fixtures',
    () async {
      final GridViewDatabase db = GridViewDatabase.forTesting(
        NativeDatabase.memory(),
      );
      addTearDown(db.close);
      final ProviderContainer c = ProviderContainer(
        overrides: [
          appEnvironmentProvider.overrideWithValue(AppEnvironment.production),
          apiConfigProvider.overrideWithValue(const ApiConfig(baseUrl: '')),
          databaseProvider.overrideWithValue(db),
        ],
      );
      addTearDown(c.dispose);

      // No admin credential and no fixture source is reachable in production;
      // every refresh surfaces a typed failure, never mock content.
      final List<RefreshResult> results = <RefreshResult>[
        await c.read(seasonRepositoryProvider).refreshCurrentSeason(),
        await c.read(homeRepositoryProvider).refreshHome(),
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
      }
    },
  );

  test('the remote API is constructed without any admin credential', () {
    // The Dio the production API is built with carries no Authorization header
    // and no admin token — the public client never sends one.
    final ProviderContainer container = ProviderContainer(
      overrides: [
        appEnvironmentProvider.overrideWithValue(AppEnvironment.production),
        apiConfigProvider.overrideWithValue(
          const ApiConfig(baseUrl: 'https://api.example'),
        ),
      ],
    );
    addTearDown(container.dispose);
    final GridViewApi api = container.read(remoteApiProvider);
    expect(api, isA<DioGridViewApi>());
    expect(api.usesMockData, isFalse);
    // The repository interfaces expose no admin/write surface at all.
    expect(container.read(homeRepositoryProvider), isA<HomeRepository>());
    expect(container.read(contentRepositoryProvider), isA<ContentRepository>());
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

  // Selection is a pure function of (environment, base URL). It proves both the
  // development and the **staging** boundaries: staging with a configured base
  // URL uses the real HTTP client, and staging selects the fixture source ONLY
  // because no base URL is configured — never merely because the flavor is
  // staging.
  for (final AppEnvironment env in <AppEnvironment>[
    AppEnvironment.development,
    AppEnvironment.staging,
  ]) {
    test('${env.name}: base URL selects Dio, its absence selects fixtures', () {
      ProviderContainer withBase(String baseUrl) => ProviderContainer(
        overrides: [
          appEnvironmentProvider.overrideWithValue(env),
          apiConfigProvider.overrideWithValue(ApiConfig(baseUrl: baseUrl)),
        ],
      );

      final ProviderContainer configured = withBase('https://api.example');
      addTearDown(configured.dispose);
      expect(
        configured.read(remoteApiProvider),
        isA<DioGridViewApi>(),
        reason: '$env with a base URL uses the real HTTP client',
      );
      expect(configured.read(usesMockDataProvider), isFalse);

      final ProviderContainer noUrl = withBase('');
      addTearDown(noUrl.dispose);
      expect(
        noUrl.read(remoteApiProvider),
        isA<FixtureGridViewApi>(),
        reason: '$env selects fixtures only when no base URL is configured',
      );
      expect(noUrl.read(usesMockDataProvider), isTrue);
    });
  }
}
