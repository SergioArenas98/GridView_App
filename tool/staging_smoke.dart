// A manually-invoked staging smoke harness for the offline-first data layer.
// It is NOT part of CI: it lives under `tool/` (not `test/`), so a bare
// `flutter test` never runs it, and it self-skips unless a base URL is supplied.
// CI never depends on staging availability.
//
// It contains two harnesses:
//
//  1. **repositories** (Phase 6B1) — synchronizes a representative set of public
//     resources, closes and reopens the database, and confirms the local counts
//     and ETags survived.
//  2. **orchestration** (Phase 6B2) — runs a first-use bootstrap through the
//     application synchronization coordinator, confirms the local first-use data
//     and the bootstrap ETag, closes and reopens the database, then runs a
//     returning pass that revalidates conditionally with the persisted
//     validators.
//
// Run it against a deployed public API with:
//
//   API_BASE_URL=https://gridview-api-staging.example.workers.dev \
//     flutter test tool/staging_smoke.dart
//
// or, if your shell can't set env vars inline:
//
//   flutter test tool/staging_smoke.dart \
//     --dart-define=DATA_SOURCE=remote \
//     --dart-define=API_BASE_URL=https://gridview-api-staging.example.workers.dev
//
// It uses only public GET routes, a throwaway on-disk database and no admin
// token, and prints only resource counts, safe failure categories and redacted
// ETag fingerprints — never full response bodies, internal KV names or
// credentials.
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/core/network/api_config.dart';
import 'package:gridview/core/network/data_source_config.dart';
import 'package:gridview/core/network/gridview_dio.dart';
import 'package:gridview/features/shared/data/remote/dio_gridview_api.dart';
import 'package:gridview/features/shared/data/remote/gridview_api.dart';
import 'package:gridview/features/shared/data/repositories/bootstrap_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/calendar_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/circuit_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/constructor_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/content_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/driver_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/grand_prix_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/home_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/result_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/season_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/standings_repository_impl.dart';
import 'package:gridview/features/shared/data/sync/refresh_coordinator.dart';
import 'package:gridview/features/shared/data/sync/resource_sync.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/sync/application/app_sync_coordinator.dart';
import 'package:gridview/features/sync/data/resource_refresh_dispatcher.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';

/// The staging base URL, from `--dart-define=API_BASE_URL` or the environment.
String _baseUrl() {
  const String define = String.fromEnvironment('API_BASE_URL');
  if (define.trim().isNotEmpty) return define.trim();
  return (Platform.environment['API_BASE_URL'] ?? '').trim();
}

int _season() {
  const String define = String.fromEnvironment('SMOKE_SEASON');
  final String raw = define.trim().isNotEmpty
      ? define.trim()
      : (Platform.environment['SMOKE_SEASON'] ?? '2026').trim();
  return int.tryParse(raw) ?? 2026;
}

/// A short, non-reversible fingerprint of an ETag, so the smoke can confirm an
/// ETag was persisted without printing its (potentially content-revealing) value.
String _etagFingerprint(String? etag) {
  if (etag == null || etag.isEmpty) return 'none';
  int hash = 0x811c9dc5;
  for (int i = 0; i < etag.length; i++) {
    hash ^= etag.codeUnitAt(i) & 0xff;
    hash = (hash * 0x01000193) & 0xffffffff;
  }
  return 'etag#${hash.toRadixString(16)}';
}

void main() {
  final String baseUrl = _baseUrl();
  final int season = _season();

  test('staging smoke: sync, reopen and confirm counts + ETags', () async {
    if (baseUrl.isEmpty) {
      // Non-CI, opt-in: skip cleanly when no base URL is configured.
      markTestSkipped(
        'Set API_BASE_URL to run the staging smoke (public routes only).',
      );
      return;
    }

    final Directory tempDir = Directory.systemTemp.createTempSync(
      'gridview_staging_smoke',
    );
    final File dbFile = File('${tempDir.path}/gridview_v2.sqlite');
    addTearDown(() {
      if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
    });

    GridViewApi buildApi() =>
        DioGridViewApi(buildGridViewDio(ApiConfig(baseUrl: baseUrl)));

    // --- Session 1: synchronize a representative set of public resources. ---
    final GridViewDatabase db = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    final ResourceSync sync = ResourceSync(db);
    final RefreshCoordinator coordinator = RefreshCoordinator();
    final SeasonRepositoryImpl seasonRepo = SeasonRepositoryImpl(
      remote: buildApi(),
      sync: sync,
      coordinator: coordinator,
      now: DateTime.now,
      local: db.seasonDao,
    );
    final CalendarRepositoryImpl calendarRepo = CalendarRepositoryImpl(
      remote: buildApi(),
      sync: sync,
      coordinator: coordinator,
      now: DateTime.now,
      local: db.calendarDao,
    );
    final StandingsRepositoryImpl standingsRepo = StandingsRepositoryImpl(
      remote: buildApi(),
      sync: sync,
      coordinator: coordinator,
      now: DateTime.now,
      local: db.standingsDao,
    );

    void report(String resource, RefreshResult r) {
      final String outcome = switch (r) {
        RefreshSuccess(applied: final bool a) => a ? 'applied' : 'validated',
        RefreshFailure(failure: final f) => 'failed(${f.kind.name})',
      };
      // Only the resource name and a coarse outcome — no bodies or values.
      // ignore: avoid_print
      print('  sync $resource -> $outcome');
    }

    report('season:current', await seasonRepo.refreshCurrentSeason());
    report('calendar:$season', await calendarRepo.refreshCalendar(season));
    report(
      'standings:drivers:$season',
      await standingsRepo.refreshDriverStandings(season),
    );

    final int calCount = (await calendarRepo.readCalendar(season)).length;
    final int dsCount = (await standingsRepo.readDriverStandings(
      season,
    )).length;
    final ResourceSyncState? calMeta = await db.syncMetadataDao.read(
      ResourceKey.calendar(season),
    );
    // ignore: avoid_print
    print(
      '  local counts: calendar=$calCount driverStandings=$dsCount '
      'calendarEtag=${_etagFingerprint(calMeta?.etag)}',
    );
    await db.close();

    // --- Session 2: reopen and confirm the cache survived. ---
    final GridViewDatabase reopened = GridViewDatabase.forTesting(
      NativeDatabase(dbFile),
    );
    addTearDown(reopened.close);
    final int calAfter = (await reopened.calendarDao.calendar(season)).length;
    final ResourceSyncState? calMetaAfter = await reopened.syncMetadataDao.read(
      ResourceKey.calendar(season),
    );
    // ignore: avoid_print
    print(
      '  after reopen: calendar=$calAfter '
      'calendarEtag=${_etagFingerprint(calMetaAfter?.etag)}',
    );

    // The reopened counts and ETag fingerprint must match the first session.
    expect(calAfter, calCount, reason: 'calendar survived the reopen');
    expect(
      _etagFingerprint(calMetaAfter?.etag),
      _etagFingerprint(calMeta?.etag),
      reason: 'the persisted ETag survived the reopen',
    );
  });

  test(
    'staging smoke: first-use bootstrap, reopen and due revalidation',
    () async {
      if (baseUrl.isEmpty) {
        markTestSkipped(
          'Set API_BASE_URL to run the staging orchestration smoke '
          '(public routes only).',
        );
        return;
      }
      // Fixture mode is never inferred, and it is meaningless here: this harness
      // exists to exercise the real public API.
      final DataSourceMode mode = DataSourceConfig.fromEnvironment().mode;
      expect(
        mode,
        DataSourceMode.remote,
        reason: 'run with --dart-define=DATA_SOURCE=remote',
      );

      final Directory tempDir = Directory.systemTemp.createTempSync(
        'gridview_staging_orchestration',
      );
      final File dbFile = File('${tempDir.path}/gridview_v2.sqlite');
      addTearDown(() {
        if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
      });

      GridViewApi buildApi() =>
          DioGridViewApi(buildGridViewDio(ApiConfig(baseUrl: baseUrl)));

      AppSyncCoordinator buildCoordinator(GridViewDatabase db) {
        final ResourceSync sync = ResourceSync(db);
        final RefreshCoordinator perResource = RefreshCoordinator();
        final GridViewApi remote = buildApi();
        final BootstrapRepositoryImpl bootstrap = BootstrapRepositoryImpl(
          remote: remote,
          sync: sync,
          coordinator: perResource,
          now: DateTime.now,
          seasons: db.seasonDao,
          calendar: db.calendarDao,
          competitors: db.competitorDao,
          standings: db.standingsDao,
          snapshots: db.verticalSliceDao,
        );
        final SeasonRepositoryImpl seasons = SeasonRepositoryImpl(
          remote: remote,
          sync: sync,
          coordinator: perResource,
          now: DateTime.now,
          local: db.seasonDao,
        );
        final HomeRepositoryImpl home = HomeRepositoryImpl(
          remote: remote,
          sync: sync,
          coordinator: perResource,
          now: DateTime.now,
          local: db.verticalSliceDao,
          dashboard: db.homeDashboardDao,
        );
        return AppSyncCoordinator(
          dispatcher: ResourceRefreshDispatcher(
            bootstrap: bootstrap,
            season: seasons,
            home: home,
            calendar: CalendarRepositoryImpl(
              remote: remote,
              sync: sync,
              coordinator: perResource,
              now: DateTime.now,
              local: db.calendarDao,
            ),
            standings: StandingsRepositoryImpl(
              remote: remote,
              sync: sync,
              coordinator: perResource,
              now: DateTime.now,
              local: db.standingsDao,
            ),
            drivers: DriverRepositoryImpl(
              remote: remote,
              sync: sync,
              coordinator: perResource,
              now: DateTime.now,
              local: db.competitorDao,
            ),
            constructors: ConstructorRepositoryImpl(
              remote: remote,
              sync: sync,
              coordinator: perResource,
              now: DateTime.now,
              local: db.competitorDao,
            ),
            circuits: CircuitRepositoryImpl(
              remote: remote,
              sync: sync,
              coordinator: perResource,
              now: DateTime.now,
              local: db.calendarDao,
            ),
            content: ContentRepositoryImpl(
              remote: remote,
              sync: sync,
              coordinator: perResource,
              now: DateTime.now,
            ),
            grandPrix: GrandPrixRepositoryImpl(
              remote: remote,
              sync: sync,
              coordinator: perResource,
              now: DateTime.now,
              local: db.verticalSliceDao,
              media: db.mediaDao,
            ),
            results: ResultRepositoryImpl(
              remote: remote,
              sync: sync,
              coordinator: perResource,
              now: DateTime.now,
              local: db.resultsDao,
            ),
          ),
          seasons: seasons,
          home: home,
          bootstrap: bootstrap,
          metadata: db.syncMetadataDao,
          now: DateTime.now,
        );
      }

      void reportRun(String label, AppSyncState state) {
        final String summary = switch (state) {
          AppSyncCompleted(
            successCount: final int ok,
            failureCount: final int bad,
            outcomes: final List<ResourceSyncOutcome> all,
          ) =>
            'completed ok=$ok failed=$bad planned=${all.length}',
          AppSyncSeasonContextUnavailable() => 'no season context',
          AppSyncCancelled() => 'cancelled',
          _ => 'unexpected',
        };
        // Counts and safe categories only — never a body, key name or credential.
        // ignore: avoid_print
        print('  $label -> $summary');
        for (final ResourceSyncOutcome outcome in state.outcomes) {
          if (outcome.failure == null) continue;
          // ignore: avoid_print
          print('    ${outcome.resourceKey}: ${outcome.failure!.name}');
        }
      }

      // --- Session 1: an empty database performs a first-use bootstrap. ---
      final GridViewDatabase first = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      final AppSyncCoordinator startup = buildCoordinator(first);
      await startup.start();
      reportRun('startup', startup.state);

      final ResourceSyncState? bootstrapMeta = await first.syncMetadataDao.read(
        ResourceKey.bootstrap(),
      );
      final int events = await first.calendarDao.countEventsForSeason(season);
      // ignore: avoid_print
      print(
        '  first use: currentSeason='
        '${(await first.seasonDao.readCurrentSeason())?.year} '
        'calendarEvents=$events '
        'bootstrapEtag=${_etagFingerprint(bootstrapMeta?.etag)}',
      );
      expect(
        bootstrapMeta?.lastSuccessAt,
        isNotNull,
        reason: 'the bootstrap representation was recorded',
      );
      await startup.dispose();
      await first.close();

      // --- Session 2: reopen and run a returning/due synchronization pass. ---
      final GridViewDatabase second = GridViewDatabase.forTesting(
        NativeDatabase(dbFile),
      );
      addTearDown(second.close);
      final AppSyncCoordinator returning = buildCoordinator(second);
      addTearDown(returning.dispose);

      // A manual run forces eligibility while keeping the stored validators, so
      // the pass exercises conditional revalidation rather than a cold fetch.
      await returning.refreshNow();
      reportRun('returning', returning.state);

      final ResourceSyncState? afterMeta = await second.syncMetadataDao.read(
        ResourceKey.bootstrap(),
      );
      // ignore: avoid_print
      print(
        '  after reopen: calendarEvents='
        '${await second.calendarDao.countEventsForSeason(season)} '
        'bootstrapEtag=${_etagFingerprint(afterMeta?.etag)}',
      );

      expect(
        _etagFingerprint(afterMeta?.etag),
        _etagFingerprint(bootstrapMeta?.etag),
        reason: 'the bootstrap ETag survived the reopen',
      );
      final AppSyncState state = returning.state;
      expect(
        state,
        isA<AppSyncCompleted>(),
        reason: 'a returning pass completes with per-resource outcomes',
      );
      expect(
        (state as AppSyncCompleted).successCount,
        greaterThan(0),
        reason: 'at least one resource revalidated successfully',
      );
    },
  );
}
