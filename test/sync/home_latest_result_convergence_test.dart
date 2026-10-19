import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/result_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/home/application/home_state.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';

import '../support/bootstrap_fixture.dart';
import '../support/fixtures.dart';
import '../support/release_server.dart';
import '../support/scripted_api.dart';
import '../support/sync_harness.dart';

/// The staging releases of the 2026-10-19 phone check
/// (`device-1d/01-PUBLICATION-1D-CHECK.md`), with their real instants.
///
/// `pm1-…1c`: every document expires 15 minutes after publication.
const Release c1 = Release(
  'c1',
  '2026-10-14T16:19:54.572Z',
  manifestExpiry: '2026-10-14T17:19:54.572Z',
  coreExpiry: '2026-10-14T16:34:54.572Z',
);

/// `pm1-…1d`: the same content republished under the calendar horizon.
const Release d1 = Release(
  'd1',
  '2026-10-19T18:43:32.476Z',
  manifestExpiry: '2026-10-19T19:43:32.476Z',
  coreExpiry: '2026-10-25T20:00:00.000Z',
);

/// The resume that found `…1d` on the phone.
final DateTime resumedAt = DateTime.utc(2026, 10, 19, 18, 55, 27);

/// The fixture calendar's round with a classified result, whose race
/// classification Home shows (round 17 on the phone).
const int round = 12;
final String resultKey = ResourceKey.grandPrixResults(2026, round);

/// Serves the fixture calendar as a Jolpica batch delivers it: every status
/// `unknown` and no weekend dates (ADR 0022 A6, A8). Only a classified result
/// settles a round, so the latest completed round is [round] whatever the
/// date, as R17 was on the phone. Conditional like every scripted endpoint.
void serveJolpicaCalendar(ScriptedGridViewApi api, Release release) {
  api.calendar = (String? etag) {
    if (etag == release.etag('calendar')) {
      return RemoteNotModified<List<GrandPrixSummaryDto>>();
    }
    final Map<String, dynamic> json = loadFixture('calendar/2026.json');
    (json['meta'] as Map<String, dynamic>)
      ..['generatedAt'] = release.generatedAt
      ..['staleAfter'] = release.coreExpiry;
    for (final Object? event in json['data'] as List<dynamic>) {
      (event! as Map<String, dynamic>)
        ..['status'] = 'unknown'
        ..['startDate'] = null
        ..['endDate'] = null;
    }
    return modifiedFromJson<List<GrandPrixSummaryDto>>(
      json,
      (Object? data) => (data! as List<dynamic>)
          .map(
            (Object? e) =>
                GrandPrixSummaryDto.fromJson(e! as Map<String, dynamic>),
          )
          .toList(growable: false),
      etag: release.etag('calendar'),
    );
  };
}

/// Scripts [release] with the Jolpica-shaped calendar.
void serveBatch(
  ScriptedGridViewApi api,
  Release release, {
  Map<String, Served> overrides = const <String, Served>{},
}) {
  serve(api, release, overrides: overrides);
  serveJolpicaCalendar(api, release);
}

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

  SyncHarness launch(ScriptedGridViewApi api, DateTime now) {
    final SyncHarness h = SyncHarness(db, api, now: now);
    launches.add(h);
    return h;
  }

  Future<ResourceSyncState?> record(String key) => db.syncMetadataDao.read(key);

  /// Home exactly as `homeStateProvider` derives it in a remote build, from
  /// the stored dashboard and each module's own stored record.
  Future<HomeReady> homeAt(SyncHarness h, DateTime now) async {
    final HomeDashboardView? dashboard = await h.repositories.home
        .watchHomeDashboard()
        .first;
    final int? resultRound = dashboard?.latestRaceResult == null
        ? null
        : dashboard!.latestCompleted?.round;
    return computeHomeState(
          HomeStateInputs(
            season: 2026,
            seasonReady: true,
            dashboard: dashboard,
            dashboardReady: true,
            homeMetadata: await record(ResourceKey.home(2026)),
            calendarMetadata: await record(ResourceKey.calendar(2026)),
            driverStandingsMetadata: await record(
              ResourceKey.driverStandings(2026),
            ),
            constructorStandingsMetadata: await record(
              ResourceKey.constructorStandings(2026),
            ),
            resultMetadata: resultRound == null
                ? null
                : await record(ResourceKey.grandPrixResults(2026, resultRound)),
            bootstrapMetadata: await record(ResourceKey.bootstrap()),
            metadataReady: true,
            refreshing: false,
            lastFailure: null,
            driverStandingsFailed: false,
            constructorStandingsFailed: false,
            syncSettled: true,
            now: now,
            bootstrapFreshness: true,
          ),
        )
        as HomeReady;
  }

  /// The phone's state before the publication: bootstrap, then every core
  /// resource and the manifest at `…1c`. With [openGrandPrix] the user also
  /// opened the latest Grand Prix once, caching its classification at `…1c`.
  Future<void> settleOnC1({required bool openGrandPrix}) async {
    final ScriptedGridViewApi first = ScriptedGridViewApi()
      ..bootstrap = (_) => bootstrapModified(bootstrapEnvelope());
    await launch(first, DateTime.utc(2026, 10, 14, 16, 20)).coordinator.start();

    final ScriptedGridViewApi second = ScriptedGridViewApi();
    serveBatch(second, c1);
    final SyncHarness h = launch(second, DateTime.utc(2026, 10, 14, 16, 21));
    await h.coordinator.start();
    expect(callsOf(second)['results'], isNull);
    if (openGrandPrix) {
      await h.repositories.results.refreshResults(season: 2026, round: round);
      expect(
        (await record(resultKey))?.generatedAt,
        DateTime.parse(c1.generatedAt),
      );
    }
  }

  ResourceSyncOutcome? outcomeOf(SyncHarness h, String key) {
    final AppSyncState state = h.coordinator.state;
    if (state is! AppSyncCompleted) return null;
    return state.outcomes.lastWhere(
      (ResourceSyncOutcome o) => o.resourceKey == key,
      orElse: () => ResourceSyncOutcome.skipped('none'),
    );
  }

  const RemoteFailure<RaceResultDto> offline = RemoteFailure<RaceResultDto>(
    ApiFailure(kind: ApiFailureKind.networkUnavailable),
  );

  test(
    'the run that adopts a newer publication refreshes the cached latest '
    'result, and Home clears its notice without opening the Grand Prix',
    () async {
      await settleOnC1(openGrandPrix: true);
      final ScriptedGridViewApi api = ScriptedGridViewApi();
      serveBatch(api, d1);
      final SyncHarness h = launch(api, resumedAt);
      expect((await homeAt(h, resumedAt)).hasStaleSection, isTrue);

      await h.coordinator.start();

      expect(callsOf(api), <String, int>{
        for (final String e in coreEndpoints) e: 1,
        'contentManifest': 1,
        'results': 1,
      });
      expect(
        (await record(ResourceKey.home(2026)))?.generatedAt,
        DateTime.parse(d1.generatedAt),
      );
      final ResourceSyncState result = (await record(resultKey))!;
      expect(result.etag, d1.etag('results'));
      expect(result.generatedAt, DateTime.parse(d1.generatedAt));
      expect(result.staleAfter, DateTime.parse(d1.coreExpiry));
      expect(result.lastFailureCategory, isNull);
      // Identical content: the metadata-only republication rule, no domain write.
      expect(result.sourceUpdatedAt, DateTime.parse('2026-07-18T11:55:00Z'));
      expect(outcomeOf(h, resultKey)?.kind, ResourceSyncOutcomeKind.unchanged);

      final HomeReady home = await homeAt(h, resumedAt);
      expect(home.latestResult?.resultProvenance?.isStale, isFalse);
      expect(home.hasStaleSection, isFalse);
      expect(home.latestResult?.winner, isNotNull);

      // Converged: a resume requests nothing, and never the result again.
      api.calls.clear();
      await h.coordinator.onForeground();
      expect(callsOf(api), isEmpty);
    },
  );

  test('a failed result refresh keeps the cached result and the notice, and '
      'is retried once per run', () async {
    await settleOnC1(openGrandPrix: true);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    serveBatch(api, d1);
    api.results = (_) => offline;
    final SyncHarness h = launch(api, resumedAt);
    await h.coordinator.start();

    // The phone's reported state: the core adopted `…1d`, the result did not.
    expect(api.callsFor('results'), 1);
    expect(
      (await record(ResourceKey.home(2026)))?.staleAfter,
      DateTime.parse(d1.coreExpiry),
    );
    final ResourceSyncState result = (await record(resultKey))!;
    expect(result.generatedAt, DateTime.parse(c1.generatedAt));
    expect(result.staleAfter, DateTime.parse(c1.coreExpiry));
    expect(result.lastFailureCategory, isNotNull);
    final HomeReady home = await homeAt(h, resumedAt);
    expect(home.latestResult?.winner, isNotNull, reason: 'cache preserved');
    expect(home.homeProvenance.isStale, isFalse);
    expect(home.latestResult?.resultProvenance?.isStale, isTrue);
    expect(
      home.hasStaleSection,
      isTrue,
      reason: "Home's own expiry is never borrowed for the result",
    );

    // Each later run tries it exactly once while it fails.
    api.calls.clear();
    await h.coordinator.onForeground();
    expect(callsOf(api), <String, int>{'results': 1});

    // Once it answers, the next run converges and Home is fresh.
    api.calls.clear();
    serveBatch(api, d1);
    await h.coordinator.onForeground();
    expect(callsOf(api), <String, int>{'results': 1});
    expect((await homeAt(h, resumedAt)).hasStaleSection, isFalse);
  });

  test(
    'a cache that keeps serving the older result costs one request per run',
    () async {
      await settleOnC1(openGrandPrix: true);
      final ScriptedGridViewApi api = ScriptedGridViewApi();
      serveBatch(
        api,
        d1,
        overrides: <String, Served>{
          'results': (release: c1, cache: Cache.stale200),
        },
      );
      final SyncHarness h = launch(api, resumedAt);
      await h.coordinator.start();
      expect(api.callsFor('results'), 1);
      expect(
        (await record(resultKey))?.generatedAt,
        DateTime.parse(c1.generatedAt),
      );
      expect((await homeAt(h, resumedAt)).hasStaleSection, isTrue);

      api.calls.clear();
      await h.coordinator.onForeground();
      expect(callsOf(api), <String, int>{'results': 1});
    },
  );

  test('a result that was never loaded stays on demand', () async {
    await settleOnC1(openGrandPrix: false);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    serveBatch(api, d1);
    final SyncHarness h = launch(api, resumedAt);
    await h.coordinator.start();

    expect(callsOf(api), <String, int>{
      for (final String e in coreEndpoints) e: 1,
      'contentManifest': 1,
    });
    expect(await record(resultKey), isNull);
    final HomeReady home = await homeAt(h, resumedAt);
    expect(home.latestResult?.resultProvenance, isNull);
    expect(home.hasStaleSection, isFalse);
  });

  test('a result already on the current release is never requested again, '
      'not by its own expiry nor by a manual refresh', () async {
    await settleOnC1(openGrandPrix: true);
    final ScriptedGridViewApi api = ScriptedGridViewApi();
    serveBatch(api, d1);
    await launch(api, resumedAt).coordinator.start();
    expect(
      (await record(resultKey))?.generatedAt,
      DateTime.parse(d1.generatedAt),
    );

    // Later the same evening the manifest is due and answers 304.
    api.calls.clear();
    final SyncHarness evening = launch(api, DateTime.utc(2026, 10, 19, 20));
    await evening.coordinator.start();
    expect(callsOf(api), <String, int>{'contentManifest': 1});

    // The user's manual refresh forces the core set, not the result.
    api.calls.clear();
    await evening.coordinator.refreshNow();
    expect(api.callsFor('results'), 0);
    expect(api.callsFor('grandPrix'), 0);

    // Past the horizon with no newer batch: every core resource is checked,
    // and the result, now expired like Home itself, is still not requested.
    api.calls.clear();
    final DateTime afterHorizon = DateTime.utc(2026, 10, 25, 20, 1);
    await launch(api, afterHorizon).coordinator.start();
    expect(callsOf(api), <String, int>{
      for (final String e in coreEndpoints) e: 1,
      'contentManifest': 1,
    });
  });
}
