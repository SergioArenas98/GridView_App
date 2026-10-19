import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/application/refresh_status.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';
import 'package:gridview/features/sync/application/resource_refresh_status.dart';
import 'package:gridview/features/sync/domain/sync_resource.dart';

import '../support/bootstrap_fixture.dart';
import '../support/release_server.dart';
import '../support/scripted_api.dart';
import '../support/sync_harness.dart';

const Release p1 = Release(
  'p1',
  '2026-07-18T12:00:00Z',
  manifestExpiry: '2026-07-18T13:00:00Z',
);
const Release p2 = Release(
  'p2',
  '2026-07-18T13:00:00Z',
  manifestExpiry: '2026-07-18T14:00:00Z',
);

/// The `staleAfter` the server gives a season-complete release's data documents:
/// the last instant the contract can spell (ADR 0005, amendment of 2026-10-19).
const String seasonCompleteExpiry = '9999-12-31T23:59:59.999Z';

/// The next batch, published after P1 and P2's horizon: it classifies that
/// round, so its own horizon is the following one.
const Release p3 = Release(
  'p3',
  '2026-07-25T06:00:00Z',
  manifestExpiry: '2026-07-25T07:00:00Z',
  coreExpiry: '2026-08-08T13:00:00Z',
);

void main() {
  late GridViewDatabase db;
  final List<SyncHarness> launches = <SyncHarness>[];

  setUp(() => db = GridViewDatabase.forTesting(NativeDatabase.memory()));
  tearDown(() async {
    for (final SyncHarness h in launches) {
      await h.dispose();
    }
    launches.clear();
    await db.close();
  });

  /// A new process over the same database: a fresh coordinator at [now].
  SyncHarness launch(ScriptedGridViewApi api, DateTime now) {
    final SyncHarness h = SyncHarness(db, api, now: now);
    launches.add(h);
    return h;
  }

  Future<DateTime?> generatedAtOf(String key) async =>
      (await db.syncMetadataDao.read(key))?.generatedAt;

  /// First launch (bootstrap only, P1), then a returning launch that records
  /// every core resource and the manifest at P1.
  Future<void> settleOnP1() async {
    final ScriptedGridViewApi first = ScriptedGridViewApi()
      ..bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
    await launch(first, DateTime.utc(2026, 7, 18, 12)).coordinator.start();

    final ScriptedGridViewApi second = ScriptedGridViewApi();
    serve(second, p1);
    await launch(second, DateTime.utc(2026, 7, 18, 12, 1)).coordinator.start();
    expect(
      await generatedAtOf(ResourceKey.contentManifest()),
      DateTime.parse(p1.generatedAt),
    );
    expect(
      (await db.syncMetadataDao.read(ResourceKey.contentManifest()))?.season,
      2026,
      reason: 'the manifest records the season it was accepted under',
    );
  }

  group('a new manifest with an old cached core response', () {
    test('is retried on the next launch even when the manifest answers 304 '
        '(old 304 and old 200 in the same run)', () async {
      await settleOnP1();

      // P2 is published. A manual refresh fetches everything: the manifest
      // returns P2, but the edge cache answers the driver standings with the
      // old validator's 304 and the calendar with its old 200.
      final ScriptedGridViewApi third = ScriptedGridViewApi();
      serve(
        third,
        p2,
        overrides: <String, Served>{
          'driverStandings': (release: p1, cache: Cache.conditional),
          'calendar': (release: p1, cache: Cache.stale200),
        },
      );
      final SyncHarness h3 = launch(third, DateTime.utc(2026, 7, 18, 13, 1));
      await h3.coordinator.start();
      await h3.coordinator.refreshNow();
      expect(
        await generatedAtOf(ResourceKey.contentManifest()),
        DateTime.parse(p2.generatedAt),
      );
      expect(
        await generatedAtOf(ResourceKey.driverStandings(2026)),
        DateTime.parse(p1.generatedAt),
      );
      expect(
        await generatedAtOf(ResourceKey.calendar(2026)),
        DateTime.parse(p1.generatedAt),
      );

      // Next launch, after the manifest's own expiry: the manifest answers
      // 304, and exactly the two resources behind it are retried.
      final ScriptedGridViewApi fourth = ScriptedGridViewApi();
      serve(fourth, p2);
      final SyncHarness h4 = launch(fourth, DateTime.utc(2026, 7, 18, 14, 1));
      await h4.coordinator.start();

      expect(callsOf(fourth), <String, int>{
        'calendar': 1,
        'driverStandings': 1,
        'contentManifest': 1,
      });
      expect(fourth.lastEtag['contentManifest'], p2.etag('contentManifest'));
      expect(
        await generatedAtOf(ResourceKey.driverStandings(2026)),
        DateTime.parse(p2.generatedAt),
      );
      expect(
        await generatedAtOf(ResourceKey.calendar(2026)),
        DateTime.parse(p2.generatedAt),
      );

      // Converged: a resume requests no core resource. The manifest is probed
      // again because a 304 never extends its expired staleAfter.
      fourth.calls.clear();
      await h4.coordinator.onForeground();
      expect(callsOf(fourth), <String, int>{'contentManifest': 1});
    });

    test('is adopted by the run that finds it, then retried once per run '
        'while the cache stays old', () async {
      await settleOnP1();

      // Launch after the manifest's expiry: only the manifest is due, and it
      // reveals P2. The same run then refreshes every core resource behind
      // it. The calendar's cache still serves P1.
      final ScriptedGridViewApi api = ScriptedGridViewApi();
      serve(
        api,
        p2,
        overrides: <String, Served>{
          'calendar': (release: p1, cache: Cache.stale200),
        },
      );
      final SyncHarness h = launch(api, DateTime.utc(2026, 7, 18, 13, 1));
      await h.coordinator.start();
      expect(callsOf(api), <String, int>{
        for (final String e in coreEndpoints) e: 1,
        'contentManifest': 1,
      });
      expect(
        await generatedAtOf(ResourceKey.home(2026)),
        DateTime.parse(p2.generatedAt),
      );
      expect(
        await generatedAtOf(ResourceKey.calendar(2026)),
        DateTime.parse(p1.generatedAt),
      );

      // Resume with the cache still stale: one more attempt, never a loop
      // within the run, and the manifest is not due again yet.
      api.calls.clear();
      await h.coordinator.onForeground();
      expect(callsOf(api), <String, int>{'calendar': 1});

      // The cache catches up; one more resume converges, then nothing.
      api.calls.clear();
      serve(api, p2);
      await h.coordinator.onForeground();
      expect(callsOf(api), <String, int>{'calendar': 1});
      api.calls.clear();
      await h.coordinator.onForeground();
      expect(callsOf(api), isEmpty);
    });

    test('is retried after a bootstrap-only first launch', () async {
      // First launch: bootstrap only, at P1. No core resource has a record of
      // its own, and the manifest has not been fetched.
      final ScriptedGridViewApi first = ScriptedGridViewApi()
        ..bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
      await launch(first, DateTime.utc(2026, 7, 18, 12)).coordinator.start();
      expect(callsOf(first), isEmpty);
      expect(
        await db.syncMetadataDao.read(ResourceKey.contentManifest()),
        isNull,
      );

      // Second launch: everything is due. The manifest returns P2, the
      // calendar's cache its old P1 200.
      final ScriptedGridViewApi second = ScriptedGridViewApi();
      serve(
        second,
        p2,
        overrides: <String, Served>{
          'calendar': (release: p1, cache: Cache.stale200),
        },
      );
      final SyncHarness h = launch(second, DateTime.utc(2026, 7, 18, 13, 1));
      await h.coordinator.start();
      expect(
        await generatedAtOf(ResourceKey.calendar(2026)),
        DateTime.parse(p1.generatedAt),
      );

      // Resume: only the calendar is behind; the manifest is not refetched.
      second.calls.clear();
      serve(second, p2);
      await h.coordinator.onForeground();
      expect(callsOf(second), <String, int>{'calendar': 1});
      expect(
        await generatedAtOf(ResourceKey.calendar(2026)),
        DateTime.parse(p2.generatedAt),
      );
    });
  });

  group('a manually published batch (calendar horizon)', () {
    // `Release.defaultCoreExpiry` stands in for the batch horizon: the first sprint
    // or race the release does not classify. The manifest keeps an hour.
    final DateTime horizon = DateTime.parse(Release.defaultCoreExpiry);

    Future<FreshnessState> freshnessOf(String key, DateTime now) async =>
        evaluateResourceFreshness(await db.syncMetadataDao.read(key), now);

    test('a first launch days after the publication presents the bootstrap '
        'as fresh until the horizon', () async {
      final ScriptedGridViewApi api = ScriptedGridViewApi()
        ..bootstrap = (_) => bootstrapModified(
          bootstrapEnvelope(staleAfter: Release.defaultCoreExpiry),
        );
      final DateTime launchedAt = DateTime.utc(2026, 7, 21, 9);
      await launch(api, launchedAt).coordinator.start();

      final String bootstrap = ResourceKey.bootstrap();
      expect(await freshnessOf(bootstrap, launchedAt), FreshnessState.fresh);
      expect(
        await freshnessOf(
          bootstrap,
          horizon.subtract(const Duration(seconds: 1)),
        ),
        FreshnessState.fresh,
      );
      expect(
        await freshnessOf(bootstrap, horizon.add(const Duration(seconds: 1))),
        FreshnessState.stale,
      );
    });

    test(
      'a resume before the horizon checks only the manifest; its 304 '
      'leaves unchanged data fresh and the check due on the next run',
      () async {
        await settleOnP1();

        final ScriptedGridViewApi api = ScriptedGridViewApi();
        serve(api, p1);
        final DateTime twoDaysLater = DateTime.utc(2026, 7, 20, 12);
        final SyncHarness h = launch(api, twoDaysLater);
        await h.coordinator.start();
        expect(callsOf(api), <String, int>{'contentManifest': 1});
        expect(api.lastEtag['contentManifest'], p1.etag('contentManifest'));
        expect(
          await freshnessOf(ResourceKey.home(2026), twoDaysLater),
          FreshnessState.fresh,
        );

        // A 304 never extends the manifest's expiry, so every later startup or
        // resume checks for a newer publication again - and only that.
        api.calls.clear();
        await h.coordinator.onForeground();
        expect(callsOf(api), <String, int>{'contentManifest': 1});
      },
    );

    test('offline, the last snapshot is kept and its freshness is still the '
        "server's horizon", () async {
      await settleOnP1();
      final ResourceSyncState? homeBefore = await db.syncMetadataDao.read(
        ResourceKey.home(2026),
      );

      final ScriptedGridViewApi api = ScriptedGridViewApi()
        ..contentManifest = (_) => const RemoteFailure<ContentManifestDto>(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        );
      final DateTime offlineAt = DateTime.utc(2026, 7, 20, 12);
      final SyncHarness h = launch(api, offlineAt);
      await h.coordinator.start();

      // The failed check refreshes nothing and erases nothing.
      expect(callsOf(api), <String, int>{'contentManifest': 1});
      expect(
        (await db.syncMetadataDao.read(
          ResourceKey.contentManifest(),
        ))?.lastFailureCategory,
        isNotNull,
      );
      expect(await h.repositories.home.readHome(), isNotNull);
      final ResourceSyncState? homeAfter = await db.syncMetadataDao.read(
        ResourceKey.home(2026),
      );
      expect(homeAfter?.lastSuccessAt, homeBefore?.lastSuccessAt);
      expect(homeAfter?.staleAfter, horizon);
      expect(
        await freshnessOf(ResourceKey.home(2026), offlineAt),
        FreshnessState.fresh,
      );
      // Past the horizon the same offline copy is reported stale.
      expect(
        await freshnessOf(
          ResourceKey.home(2026),
          horizon.add(const Duration(minutes: 1)),
        ),
        FreshnessState.stale,
      );
    });

    test('past the horizon with no newer batch, unchanged data is stale and '
        'every core resource is checked each run', () async {
      await settleOnP1();

      final ScriptedGridViewApi api = ScriptedGridViewApi();
      serve(api, p1);
      final DateTime afterHorizon = horizon.add(const Duration(minutes: 1));
      final SyncHarness h = launch(api, afterHorizon);
      await h.coordinator.start();

      expect(callsOf(api), <String, int>{
        for (final String e in coreEndpoints) e: 1,
        'contentManifest': 1,
      });
      // Every answer was a 304: the copy is current, but the release no longer
      // covers the season, so it stays stale until a newer batch arrives.
      expect(
        await generatedAtOf(ResourceKey.home(2026)),
        DateTime.parse(p1.generatedAt),
      );
      expect(
        await freshnessOf(ResourceKey.home(2026), afterHorizon),
        FreshnessState.stale,
      );

      // The next batch moves the horizon; the run that finds it adopts it.
      api.calls.clear();
      serve(api, p3);
      await h.coordinator.onForeground();
      expect(
        await generatedAtOf(ResourceKey.home(2026)),
        DateTime.parse(p3.generatedAt),
      );
      expect(
        await freshnessOf(ResourceKey.home(2026), afterHorizon),
        FreshnessState.fresh,
      );
    });

    test('a failed background manifest check is silent, but a manual refresh '
        'reports the failed displayed resource', () async {
      await settleOnP1();
      RefreshStatus? statusOf(
        SyncHarness h,
        bool Function(SyncResource) matches,
      ) => resourceRefreshStatus(h.coordinator.state, matches);

      // Background run within the horizon: only the manifest is due, and it
      // fails. No displayed resource was requested, so none reports a failure.
      final ScriptedGridViewApi api = ScriptedGridViewApi();
      serve(api, p1);
      api.contentManifest = (_) => const RemoteFailure<ContentManifestDto>(
        ApiFailure(kind: ApiFailureKind.networkUnavailable),
      );
      final SyncHarness h = launch(api, DateTime.utc(2026, 7, 20, 12));
      await h.coordinator.start();
      expect(callsOf(api), <String, int>{'contentManifest': 1});
      for (final bool Function(SyncResource) matches
          in <bool Function(SyncResource)>[
            (SyncResource r) => r is HomeSyncResource,
            (SyncResource r) => r is CalendarSyncResource,
            (SyncResource r) => r is DriverStandingsSyncResource,
          ]) {
        expect(statusOf(h, matches)?.lastFailure, isNull);
      }

      // The user's manual refresh requests every displayed resource. Home's
      // request fails and is reported; the others answer 304 and are not.
      api.calls.clear();
      api.home = (_) => const RemoteFailure<HomeDataDto>(
        ApiFailure(kind: ApiFailureKind.networkUnavailable),
      );
      await h.coordinator.refreshNow();
      expect(api.callsFor('home'), 1);
      expect(
        statusOf(
          h,
          (SyncResource r) => r is HomeSyncResource,
        )?.lastFailure?.kind,
        ApiFailureKind.networkUnavailable,
      );
      expect(
        statusOf(h, (SyncResource r) => r is CalendarSyncResource)?.lastFailure,
        isNull,
      );
      // The failed request erased nothing.
      expect(await h.repositories.home.readHome(), isNotNull);
    });

    test(
      'a completed season stays current with no scheduled event left, and '
      'a later correction is still found by the hourly manifest check',
      () async {
        const Release complete = Release(
          'complete',
          '2026-12-07T10:00:00Z',
          manifestExpiry: '2026-12-07T11:00:00Z',
          coreExpiry: seasonCompleteExpiry,
        );
        const Release correction = Release(
          'correction',
          '2027-01-15T09:00:00Z',
          manifestExpiry: '2027-01-15T10:00:00Z',
          coreExpiry: seasonCompleteExpiry,
        );

        final ScriptedGridViewApi first = ScriptedGridViewApi()
          ..bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await launch(first, DateTime.utc(2026, 7, 18, 12)).coordinator.start();
        final ScriptedGridViewApi api = ScriptedGridViewApi();
        serve(api, complete);
        await launch(api, DateTime.utc(2026, 12, 7, 10, 1)).coordinator.start();
        expect(
          (await db.syncMetadataDao.read(ResourceKey.home(2026)))?.staleAfter,
          DateTime.parse(seasonCompleteExpiry),
        );

        // Months later only the manifest is checked, and the data is current.
        api.calls.clear();
        final DateTime months = DateTime.utc(2027, 1, 10);
        final SyncHarness h = launch(api, months);
        await h.coordinator.start();
        expect(callsOf(api), <String, int>{'contentManifest': 1});
        expect(
          await freshnessOf(ResourceKey.home(2026), months),
          FreshnessState.fresh,
        );

        // A correction is published: the run that finds it adopts it.
        api.calls.clear();
        serve(api, correction);
        final SyncHarness later = launch(api, DateTime.utc(2027, 1, 15, 9, 30));
        await later.coordinator.start();
        expect(callsOf(api), <String, int>{
          for (final String e in coreEndpoints) e: 1,
          'contentManifest': 1,
        });
        expect(
          await generatedAtOf(ResourceKey.home(2026)),
          DateTime.parse(correction.generatedAt),
        );
      },
    );
  });

  test('after a season transition, a manifest still holding the outgoing '
      "season's later instant is never compared", () async {
    await settleOnP1();

    // The stored manifest was accepted while 2025 was current. Its instant
    // and its source time are later than every 2026 release this client has
    // seen (the outgoing season was republished after the new one was first
    // published), and its content differs.
    final ResourceSyncState manifest = (await db.syncMetadataDao.read(
      ResourceKey.contentManifest(),
    ))!;
    await db.syncMetadataDao.upsert(
      ResourceSyncState(
        resourceKey: manifest.resourceKey,
        season: 2025,
        etag: 'W/"2025-contentManifest"',
        generatedAt: DateTime.parse(p2.generatedAt),
        sourceUpdatedAt: manifest.sourceUpdatedAt!.add(const Duration(days: 1)),
        staleAfter: DateTime.utc(2026, 7, 18, 12, 45),
        contentVersion: 'outgoing-2025',
        serverStale: false,
        lastAttemptAt: manifest.lastAttemptAt,
        lastSuccessAt: manifest.lastSuccessAt,
      ),
    );

    // No 2026 core resource is behind the outgoing season's instant.
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    serve(api, p1);
    final SyncHarness h = launch(api, DateTime.utc(2026, 7, 18, 12, 30));
    await h.coordinator.start();
    expect(callsOf(api), isEmpty);

    // Once the manifest is due, the 2026 manifest is accepted with its own
    // earlier instants and the season it belongs to, never rejected as older
    // than the outgoing season's. Still no core retry.
    final ScriptedGridViewApi later = ScriptedGridViewApi();
    serve(later, p1);
    await launch(later, DateTime.utc(2026, 7, 18, 12, 50)).coordinator.start();
    expect(callsOf(later), <String, int>{'contentManifest': 1});
    final ResourceSyncState? converged = await db.syncMetadataDao.read(
      ResourceKey.contentManifest(),
    );
    expect(converged?.season, 2026);
    expect(converged?.generatedAt, DateTime.parse(p1.generatedAt));
    expect(converged?.staleAfter, DateTime.parse(p1.manifestExpiry));
    expect(converged?.sourceUpdatedAt, manifest.sourceUpdatedAt);
    expect(converged?.lastFailureCategory, isNull);
  });

  test(
    'a record from the same release as the manifest is not retried',
    () async {
      await settleOnP1();
      final ScriptedGridViewApi api = ScriptedGridViewApi();
      serve(api, p1);
      await launch(api, DateTime.utc(2026, 7, 18, 12, 30)).coordinator.start();
      expect(callsOf(api), isEmpty);
      final ResourceSyncState? calendar = await db.syncMetadataDao.read(
        ResourceKey.calendar(2026),
      );
      expect(calendar?.generatedAt, DateTime.parse(p1.generatedAt));
    },
  );
}
