// A manually-invoked staging smoke harness for the Phase 6B1 offline-first
// repository layer. It is NOT part of CI: it lives under `tool/` (not `test/`),
// so a bare `flutter test` never runs it, and it self-skips unless a base URL is
// supplied.
//
// Run it against a deployed public API with:
//
//   API_BASE_URL=https://gridview-api-staging.example.workers.dev \
//     flutter test tool/staging_smoke.dart
//
// or, if your shell can't set env vars inline:
//
//   flutter test tool/staging_smoke.dart \
//     --dart-define=API_BASE_URL=https://gridview-api-staging.example.workers.dev
//
// It uses only public GET routes, a throwaway on-disk database, no admin token,
// and prints only resource counts and a redacted ETag fingerprint — never full
// response bodies or internal data. It synchronizes a representative set of
// resources, closes and reopens the database, and confirms the local counts and
// ETags survived.
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/core/network/api_config.dart';
import 'package:gridview/core/network/gridview_dio.dart';
import 'package:gridview/features/shared/data/remote/dio_gridview_api.dart';
import 'package:gridview/features/shared/data/remote/gridview_api.dart';
import 'package:gridview/features/shared/data/repositories/calendar_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/season_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/standings_repository_impl.dart';
import 'package:gridview/features/shared/data/sync/refresh_coordinator.dart';
import 'package:gridview/features/shared/data/sync/resource_sync.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

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
}
