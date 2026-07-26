import 'dart:async';

import 'package:drift/drift.dart' show QueryRow;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/circuit_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';
import 'package:gridview/features/sync/domain/sync_resource.dart';
import 'package:gridview/features/sync/domain/sync_resource_parser.dart';

import '../support/bootstrap_fixture.dart';
import '../support/scripted_api.dart';
import '../support/sync_harness.dart';

/// Scripts every core endpoint with a valid, newer-than-cache response.
void scriptCoreEndpoints(ScriptedGridViewApi api, {int season = 2026}) {
  api.currentSeason = (_) => modifiedFromFixture<SeasonDto>(
    'seasons/current.json',
    (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
  );
  api.season = (_) => modifiedFromFixture<SeasonDto>(
    'seasons/current.json',
    (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
  );
  api.home = (_) => modifiedFromFixture<HomeDataDto>(
    'home/pre-event.json',
    (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
  );
  api.calendar = (_) => modifiedListFromFixture<GrandPrixSummaryDto>(
    'calendar/2026.json',
    GrandPrixSummaryDto.fromJson,
  );
  api.driverStandings = (_) => modifiedListFromFixture<DriverStandingDto>(
    'standings/drivers-fractional.json',
    DriverStandingDto.fromJson,
  );
  api.constructorStandings = (_) =>
      modifiedListFromFixture<ConstructorStandingDto>(
        'standings/constructors.json',
        ConstructorStandingDto.fromJson,
      );
  api.seasonDrivers = (_) => modifiedListFromFixture<SeasonDriverSummaryDto>(
    'drivers/season-drivers.json',
    SeasonDriverSummaryDto.fromJson,
  );
  api.seasonConstructors = (_) =>
      modifiedListFromFixture<SeasonConstructorSummaryDto>(
        'constructors/season-constructors.json',
        SeasonConstructorSummaryDto.fromJson,
      );
  api.seasonCircuits = (_) => modifiedListFromFixture<CircuitDto>(
    'circuits/season-circuits.json',
    CircuitDto.fromJson,
  );
  api.contentManifest = (_) => modifiedFromFixture<ContentManifestDto>(
    'content/manifest.json',
    (Object? d) => ContentManifestDto.fromJson(d! as Map<String, dynamic>),
  );
}

/// Every `resource_sync_metadata` key that looks like a Home resource, however
/// it is shaped. Used to prove that only canonical `home:<year>` rows exist.
Future<List<String>> homeMetadataKeys(GridViewDatabase db) async {
  final List<QueryRow> rows = await db
      .customSelect('SELECT resource_key FROM resource_sync_metadata')
      .get();
  return rows
      .map((QueryRow r) => r.read<String>('resource_key'))
      .where((String k) => k == 'home' || k.startsWith('home:'))
      .toList(growable: false)
    ..sort();
}

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;
  late SyncHarness h;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
    h = SyncHarness(db, api);
  });
  tearDown(() async {
    await h.dispose();
    await db.close();
  });

  /// Brings the cache to "returning launch": a current season and a renderable
  /// Home, materialized by one bootstrap.
  Future<void> seedUsableCache() async {
    api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
    await h.coordinator.start();
    api.calls.clear();
  }

  group('startup', () {
    test(
      'an empty cache attempts bootstrap first, and only bootstrap',
      () async {
        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        await h.coordinator.start();

        expect(api.callsFor('bootstrap'), 1);
        expect(api.callsFor('home'), 0);
        expect(api.callsFor('calendar'), 0);
        expect(api.callsFor('driverStandings'), 0);
        expect(api.callsFor('seasonDrivers'), 0);
        expect(api.callsFor('contentManifest'), 0);
        expect(h.coordinator.state, isA<AppSyncCompleted>());
      },
    );

    test('startup runs exactly once, however often it is called', () async {
      api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
      await h.coordinator.start();
      await h.coordinator.start();
      await h.coordinator.start();
      expect(api.callsFor('bootstrap'), 1);
    });

    test(
      'the initial resumed notification does not duplicate startup',
      () async {
        api.bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
        // A lifecycle bridge that reports `resumed` before startup has run must
        // not produce two runs.
        await Future.wait<void>(<Future<void>>[
          h.coordinator.start(),
          h.coordinator.onForeground(),
        ]);
        expect(api.callsFor('bootstrap'), 1);
      },
    );

    test('a returning launch renders from cache and skips bootstrap', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);

      await h.coordinator.onForeground();
      expect(api.callsFor('bootstrap'), 0);
      expect(api.callsFor('home'), 1);
      expect(api.callsFor('calendar'), 1);
    });
  });

  group('bootstrap failure recovery — Home is season-scoped', () {
    test('no local season and a failed current-season lookup makes zero Home '
        'requests', () async {
      api.bootstrap = (_) => const RemoteFailure<BootstrapDataDto>(
        ApiFailure(kind: ApiFailureKind.serverUnavailable),
      );
      api.currentSeason = (_) => const RemoteFailure<SeasonDto>(
        ApiFailure(kind: ApiFailureKind.networkUnavailable),
      );
      api.home = (_) => modifiedFromFixture<HomeDataDto>(
        'home/pre-event.json',
        (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
      );

      await h.coordinator.start();

      expect(api.callsFor('bootstrap'), 1, reason: 'no retry loop');
      expect(api.callsFor('currentSeason'), 1, reason: 'attempted once');
      // Home is season-scoped: with no season there is no canonical key, so
      // it is never requested — not even unscoped.
      expect(api.callsFor('home'), 0);
      // No compensating fan-out either.
      expect(api.callsFor('driverStandings'), 0);
      expect(api.callsFor('seasonDrivers'), 0);
      expect(api.callsFor('calendar'), 0);
      expect(h.coordinator.state, isA<AppSyncSeasonContextUnavailable>());

      // And no Home metadata of any shape was created.
      expect(await homeMetadataKeys(db), isEmpty);
    });

    test(
      'a locally resolved season makes Home use that exact canonical year',
      () async {
        await seedUsableCache();
        // Keep the stored current season but drop the Home representation, so
        // the next run is a first-use run again.
        await db.customStatement('DELETE FROM snapshots');
        scriptCoreEndpoints(api);
        api.bootstrap = (_) => const RemoteFailure<BootstrapDataDto>(
          ApiFailure(kind: ApiFailureKind.serverUnavailable),
        );
        api.currentSeason = (_) => const RemoteFailure<SeasonDto>(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        );

        await h.coordinator.onForeground();

        expect(api.callsFor('home'), 1);
        expect(await homeMetadataKeys(db), <String>[ResourceKey.home(2026)]);
        // The recovery plan is the minimum first screen, not the whole set.
        expect(api.callsFor('calendar'), 0);
        expect(api.callsFor('driverStandings'), 0);
      },
    );

    test(
      'a remotely resolved season makes Home use the returned year',
      () async {
        api.bootstrap = (_) => const RemoteFailure<BootstrapDataDto>(
          ApiFailure(kind: ApiFailureKind.serverUnavailable),
        );
        api.currentSeason = (_) => modifiedFromJson<SeasonDto>(
          <String, dynamic>{
            'data': seasonJson(2031),
            'meta': <String, dynamic>{
              'apiVersion': '1',
              'schemaVersion': 1,
              'season': 2031,
              'generatedAt': '2026-07-18T12:00:00Z',
              'sourceUpdatedAt': '2026-07-18T11:55:00Z',
              'requestId': 'req-test-season',
            },
          },
          (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
          etag: 'W/"season-2031"',
        );
        api.home = (_) => modifiedFromFixture<HomeDataDto>(
          'home/pre-event.json',
          (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
        );

        await h.coordinator.start();

        expect(api.callsFor('currentSeason'), 1);
        expect(api.callsFor('home'), 1);
        // Exactly one Home metadata row, under the resolved year.
        expect(await homeMetadataKeys(db), <String>[ResourceKey.home(2031)]);
      },
    );

    test(
      'no unscoped or "current" Home metadata can ever be created',
      () async {
        await seedUsableCache();
        scriptCoreEndpoints(api);
        await h.coordinator.refreshNow();

        final List<String> keys = await homeMetadataKeys(db);
        expect(keys, isNotEmpty);
        for (final String key in keys) {
          expect(key, isNot('home'));
          expect(key, isNot('home:current'));
          expect(
            SyncResourceParser.parse(key),
            isA<HomeSyncResource>(),
            reason: '$key must be a canonical season-scoped Home key',
          );
        }
      },
    );
  });

  group('due eligibility', () {
    test(
      'an automatic run refreshes only resources the server says are due',
      () async {
        await seedUsableCache();
        scriptCoreEndpoints(api);
        await h.coordinator.onForeground();
        api.calls.clear();

        // Everything just synced; the fixtures' staleAfter is 12:15 and the
        // harness clock is 12:00, so nothing is due yet.
        await h.coordinator.onForeground();
        expect(api.calls, isEmpty);
        expect(h.coordinator.state, isA<AppSyncCompleted>());
      },
    );

    test('a server-stale resource is refreshed again', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      await h.coordinator.onForeground();
      api.calls.clear();

      final ResourceSyncState stored = (await db.syncMetadataDao.read(
        ResourceKey.calendar(2026),
      ))!;
      await db.syncMetadataDao.upsert(stored.copyWith(serverStale: true));

      await h.coordinator.onForeground();
      expect(api.callsFor('calendar'), 1);
      expect(api.callsFor('home'), 0);
    });

    test('detail resources are never swept by a foreground run', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      // A detail resource that has never synchronised: still not automatic.
      await db.syncMetadataDao.upsert(
        ResourceSyncState(resourceKey: ResourceKey.grandPrix(2026, 13)),
      );
      await db.syncMetadataDao.upsert(
        ResourceSyncState(
          resourceKey: ResourceKey.driver('max-verstappen', 2026),
        ),
      );

      await h.coordinator.onForeground();
      expect(api.callsFor('grandPrix'), 0);
      expect(api.callsFor('driver'), 0);
    });

    test('a malformed stored key never crashes a run', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      await db.syncMetadataDao.upsert(
        const ResourceSyncState(resourceKey: 'weather:2026:13'),
      );

      await h.coordinator.onForeground();
      expect(h.coordinator.state, isA<AppSyncCompleted>());
      // The unknown row is left exactly where it was.
      expect(await db.syncMetadataDao.read('weather:2026:13'), isNotNull);
    });
  });

  group('stages and concurrency', () {
    test('stages run in dependency order', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      final List<String> order = <String>[];
      void record(String name) => order.add(name);

      api.currentSeason = (_) {
        record('currentSeason');
        return modifiedFromFixture<SeasonDto>(
          'seasons/current.json',
          (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
        );
      };
      api.home = (_) {
        record('home');
        return modifiedFromFixture<HomeDataDto>(
          'home/pre-event.json',
          (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
        );
      };
      api.driverStandings = (_) {
        record('driverStandings');
        return modifiedListFromFixture<DriverStandingDto>(
          'standings/drivers-fractional.json',
          DriverStandingDto.fromJson,
        );
      };
      api.contentManifest = (_) {
        record('contentManifest');
        return modifiedFromFixture<ContentManifestDto>(
          'content/manifest.json',
          (Object? d) =>
              ContentManifestDto.fromJson(d! as Map<String, dynamic>),
        );
      };

      await h.coordinator.onForeground();

      expect(order.indexOf('currentSeason'), lessThan(order.indexOf('home')));
      expect(order.indexOf('home'), lessThan(order.indexOf('driverStandings')));
      expect(
        order.indexOf('driverStandings'),
        lessThan(order.indexOf('contentManifest')),
      );
    });

    test(
      'independent resources overlap, bounded to the injected limit',
      () async {
        await h.dispose();
        await db.close();
        db = GridViewDatabase.forTesting(NativeDatabase.memory());
        api = ScriptedGridViewApi();
        h = SyncHarness(db, api, maxConcurrency: 4);

        await seedUsableCache();
        scriptCoreEndpoints(api);
        final ConcurrencyProbe probe = ConcurrencyProbe();

        // The widest stage holds four independent resources.
        api.seasonDrivers = (_) => probe.track(
          () async => modifiedListFromFixture<SeasonDriverSummaryDto>(
            'drivers/season-drivers.json',
            SeasonDriverSummaryDto.fromJson,
          ),
        );
        api.seasonConstructors = (_) => probe.track(
          () async => modifiedListFromFixture<SeasonConstructorSummaryDto>(
            'constructors/season-constructors.json',
            SeasonConstructorSummaryDto.fromJson,
          ),
        );
        api.seasonCircuits = (_) => probe.track(
          () async => modifiedListFromFixture<CircuitDto>(
            'circuits/season-circuits.json',
            CircuitDto.fromJson,
          ),
        );
        api.contentManifest = (_) => probe.track(
          () async => modifiedFromFixture<ContentManifestDto>(
            'content/manifest.json',
            (Object? d) =>
                ContentManifestDto.fromJson(d! as Map<String, dynamic>),
          ),
        );

        await h.coordinator.onForeground();
        expect(probe.peak, greaterThan(1), reason: 'a stage is not serialized');
        expect(probe.peak, lessThanOrEqualTo(4));
      },
    );

    test('a stricter injected limit is respected', () async {
      await h.dispose();
      await db.close();
      db = GridViewDatabase.forTesting(NativeDatabase.memory());
      api = ScriptedGridViewApi();
      h = SyncHarness(db, api, maxConcurrency: 2);

      await seedUsableCache();
      scriptCoreEndpoints(api);
      final ConcurrencyProbe probe = ConcurrencyProbe();
      api.seasonDrivers = (_) => probe.track(
        () async => modifiedListFromFixture<SeasonDriverSummaryDto>(
          'drivers/season-drivers.json',
          SeasonDriverSummaryDto.fromJson,
        ),
      );
      api.seasonConstructors = (_) => probe.track(
        () async => modifiedListFromFixture<SeasonConstructorSummaryDto>(
          'constructors/season-constructors.json',
          SeasonConstructorSummaryDto.fromJson,
        ),
      );
      api.seasonCircuits = (_) => probe.track(
        () async => modifiedListFromFixture<CircuitDto>(
          'circuits/season-circuits.json',
          CircuitDto.fromJson,
        ),
      );
      api.contentManifest = (_) => probe.track(
        () async => modifiedFromFixture<ContentManifestDto>(
          'content/manifest.json',
          (Object? d) =>
              ContentManifestDto.fromJson(d! as Map<String, dynamic>),
        ),
      );

      await h.coordinator.onForeground();
      expect(probe.peak, lessThanOrEqualTo(2));
    });
  });

  group('failure isolation', () {
    test('one failing resource does not block the independent ones', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      api.home = (_) => const RemoteFailure<HomeDataDto>(
        ApiFailure(kind: ApiFailureKind.serverUnavailable),
      );

      await h.coordinator.onForeground();

      expect(api.callsFor('calendar'), 1);
      expect(api.callsFor('driverStandings'), 1);
      expect(api.callsFor('contentManifest'), 1);

      final AppSyncCompleted state = h.coordinator.state as AppSyncCompleted;
      expect(state.fullSuccess, isFalse);
      expect(state.failureCount, 1);
      expect(state.successCount, greaterThan(5));
      final ResourceSyncOutcome home = state.outcomes.firstWhere(
        (ResourceSyncOutcome o) => o.resourceKey == ResourceKey.home(2026),
      );
      expect(home.kind, ResourceSyncOutcomeKind.failed);
      expect(home.failure, ApiFailureKind.serverUnavailable);
    });

    test(
      'a failed standings resource neither erases nor blocks the other',
      () async {
        await seedUsableCache();
        scriptCoreEndpoints(api);
        await h.coordinator.onForeground();
        final int constructorRows = await db.standingsDao
            .countConstructorStandings(2026);
        expect(constructorRows, greaterThan(0));
        api.calls.clear();

        api.driverStandings = (_) =>
            const RemoteFailure<List<DriverStandingDto>>(
              ApiFailure(kind: ApiFailureKind.serverUnavailable),
            );
        await db.syncMetadataDao.upsert(
          (await db.syncMetadataDao.read(
            ResourceKey.driverStandings(2026),
          ))!.copyWith(serverStale: true),
        );
        await db.syncMetadataDao.upsert(
          (await db.syncMetadataDao.read(
            ResourceKey.constructorStandings(2026),
          ))!.copyWith(serverStale: true),
        );

        await h.coordinator.onForeground();
        expect(api.callsFor('constructorStandings'), 1);
        expect(
          await db.standingsDao.countDriverStandings(2026),
          greaterThan(0),
        );
        expect(
          await db.standingsDao.countConstructorStandings(2026),
          constructorRows,
        );
      },
    );

    test('a rate-limited resource is not retried inside the run', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      api.calendar = (_) => const RemoteFailure<List<GrandPrixSummaryDto>>(
        ApiFailure(kind: ApiFailureKind.rateLimited, retryable: true),
      );

      await h.coordinator.onForeground();
      expect(api.callsFor('calendar'), 1);
      final AppSyncCompleted state = h.coordinator.state as AppSyncCompleted;
      expect(
        state.outcomes
            .firstWhere(
              (ResourceSyncOutcome o) =>
                  o.resourceKey == ResourceKey.calendar(2026),
            )
            .failure,
        ApiFailureKind.rateLimited,
      );
    });

    test(
      'no raw exception, DTO or transport object reaches the state',
      () async {
        await seedUsableCache();
        scriptCoreEndpoints(api);
        api.home = (_) => const RemoteFailure<HomeDataDto>(
          ApiFailure(kind: ApiFailureKind.invalidResponse, code: 'INTERNAL'),
        );

        await h.coordinator.onForeground();
        final AppSyncCompleted state = h.coordinator.state as AppSyncCompleted;
        for (final ResourceSyncOutcome outcome in state.outcomes) {
          expect(outcome.failure, anyOf(isNull, isA<ApiFailureKind>()));
          expect(outcome.resourceKey, isA<String>());
        }
      },
    );
  });

  group('manual refresh', () {
    test('a manual run refreshes core resources that are not due', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      await h.coordinator.onForeground();
      api.calls.clear();

      // Nothing is due, so an automatic run would do nothing.
      await h.coordinator.refreshNow();
      expect(api.callsFor('home'), 1);
      expect(api.callsFor('calendar'), 1);
      expect(api.callsFor('driverStandings'), 1);
      expect(api.callsFor('contentManifest'), 1);
    });

    test(
      'a manual run keeps conditional requests and persisted ETags',
      () async {
        await seedUsableCache();
        scriptCoreEndpoints(api);
        await h.coordinator.onForeground();
        final String? storedEtag = (await db.syncMetadataDao.read(
          ResourceKey.calendar(2026),
        ))?.etag;
        expect(storedEtag, isNotNull);

        await h.coordinator.refreshNow();
        expect(
          api.lastEtag['calendar'],
          storedEtag,
          reason: 'manual force means eligibility, never a validator bypass',
        );
        expect(
          (await db.syncMetadataDao.read(ResourceKey.calendar(2026)))?.etag,
          isNotNull,
        );
      },
    );

    test('a manual run reports a typed partial result', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      api.contentManifest = (_) => const RemoteFailure<ContentManifestDto>(
        ApiFailure(kind: ApiFailureKind.networkTimeout),
      );

      await h.coordinator.refreshNow();
      final AppSyncCompleted state = h.coordinator.state as AppSyncCompleted;
      expect(state.trigger, SyncTrigger.manual);
      expect(state.fullSuccess, isFalse);
      expect(state.failureCount, 1);
    });
  });

  group('trigger coalescing', () {
    test('two foreground triggers during a run coalesce into one', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      final Completer<void> gate = Completer<void>();
      api.currentSeason = (_) async {
        await gate.future;
        return modifiedFromFixture<SeasonDto>(
          'seasons/current.json',
          (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
        );
      };

      final Future<void> first = h.coordinator.onForeground();
      final Future<void> second = h.coordinator.onForeground();
      final Future<void> third = h.coordinator.onForeground();
      gate.complete();
      await Future.wait<void>(<Future<void>>[first, second, third]);

      expect(api.callsFor('currentSeason'), 1);
      expect(api.callsFor('home'), 1);
    });

    test(
      'a manual trigger during a run queues exactly one follow-up',
      () async {
        await seedUsableCache();
        scriptCoreEndpoints(api);
        final Completer<void> gate = Completer<void>();
        bool gated = true;
        api.currentSeason = (_) async {
          if (gated) await gate.future;
          return modifiedFromFixture<SeasonDto>(
            'seasons/current.json',
            (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
          );
        };

        final Future<void> automatic = h.coordinator.onForeground();
        final Future<void> manual1 = h.coordinator.refreshNow();
        final Future<void> manual2 = h.coordinator.refreshNow();
        final Future<void> manual3 = h.coordinator.refreshNow();
        gated = false;
        gate.complete();
        await Future.wait<void>(<Future<void>>[
          automatic,
          manual1,
          manual2,
          manual3,
        ]);

        // One automatic run plus exactly one forced follow-up.
        expect(api.callsFor('currentSeason'), 2);
        final AppSyncCompleted state = h.coordinator.state as AppSyncCompleted;
        expect(state.trigger, SyncTrigger.manual);
      },
    );
  });

  group('cancellation', () {
    test('cancelling stops scheduling and reports a cancelled run', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      final Completer<void> gate = Completer<void>();
      api.currentSeason = (_) async {
        await gate.future;
        return modifiedFromFixture<SeasonDto>(
          'seasons/current.json',
          (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
        );
      };

      final Future<void> run = h.coordinator.onForeground();
      await Future<void>.delayed(Duration.zero);
      h.coordinator.cancel();
      gate.complete();
      await run;

      expect(h.coordinator.state, isA<AppSyncCancelled>());
      expect(api.callsFor('home'), 0, reason: 'no further stage was scheduled');
      expect(api.callsFor('contentManifest'), 0);
    });

    test('a cancelled run is never reported as a success', () async {
      await seedUsableCache();
      scriptCoreEndpoints(api);
      final Completer<void> gate = Completer<void>();
      api.currentSeason = (_) async {
        await gate.future;
        return modifiedFromFixture<SeasonDto>(
          'seasons/current.json',
          (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
        );
      };
      final Future<void> run = h.coordinator.onForeground();
      await Future<void>.delayed(Duration.zero);
      h.coordinator.cancel();
      gate.complete();
      await run;
      expect(h.coordinator.state, isNot(isA<AppSyncCompleted>()));
    });

    test(
      'cancellation releases in-flight slots so a later run retries',
      () async {
        await seedUsableCache();
        scriptCoreEndpoints(api);
        final Completer<void> gate = Completer<void>();
        bool gated = true;
        api.currentSeason = (_) async {
          if (gated) await gate.future;
          return modifiedFromFixture<SeasonDto>(
            'seasons/current.json',
            (Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>),
          );
        };

        final Future<void> run = h.coordinator.onForeground();
        await Future<void>.delayed(Duration.zero);
        h.coordinator.cancel();
        gated = false;
        gate.complete();
        await run;

        expect(
          h.repositories.coordinator.isInFlight(ResourceKey.currentSeason()),
          isFalse,
        );

        api.calls.clear();
        await h.coordinator.onForeground();
        expect(h.coordinator.state, isA<AppSyncCompleted>());
        expect(api.callsFor('home'), 1);
      },
    );
  });
}
