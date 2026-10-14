import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/circuit_dto.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/season_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/dto/summary_dto.dart';
import 'package:gridview/core/api/dto/view_dto.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';

import '../support/bootstrap_fixture.dart';
import '../support/scripted_api.dart';
import '../support/sync_harness.dart';

/// A published release as the scripted server serves it: one publication
/// instant on every document (ADR 0025 D4, amendment of 2026-10-14).
///
/// Core documents carry a long `staleAfter` on purpose. With the current
/// 15-minute expiry an old copy is usually due again by its own expiry, which
/// would hide the rule under test; a batch-horizon expiry would not.
class Release {
  const Release(this.label, this.generatedAt, {required this.manifestExpiry});

  final String label;
  final String generatedAt;
  final String manifestExpiry;

  static const String coreExpiry = '2026-07-25T00:00:00Z';

  String etag(String endpoint) => 'W/"$label-$endpoint"';
}

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

/// How an edge cache answers for one endpoint.
enum Cache {
  /// Honest: a `304` only when the client's validator is this release's.
  conditional,

  /// A stale cache that ignores the validator and serves its stored `200`.
  stale200,
}

typedef Served = ({Release release, Cache cache});

RemoteResult<T> _answer<T>(
  String endpoint,
  String path,
  T Function(Object? data) parse,
  Served served,
  String? sentEtag, {
  bool manifest = false,
}) {
  final Release r = served.release;
  if (served.cache == Cache.conditional && sentEtag == r.etag(endpoint)) {
    return RemoteNotModified<T>();
  }
  return modifiedFromFixture<T>(
    path,
    parse,
    etag: r.etag(endpoint),
    generatedAt: r.generatedAt,
    staleAfter: manifest ? r.manifestExpiry : Release.coreExpiry,
  );
}

T Function(Object? data) _list<D, T extends List<D>>(
  D Function(Map<String, dynamic> e) fromJson,
) =>
    (Object? data) =>
        (data! as List<dynamic>)
                .map((Object? e) => fromJson(e! as Map<String, dynamic>))
                .toList(growable: false)
            as T;

/// Scripts every automatic core endpoint and the manifest to serve [release],
/// except the endpoints named in [overrides].
void serve(
  ScriptedGridViewApi api,
  Release release, {
  Map<String, Served> overrides = const <String, Served>{},
}) {
  Served s(String endpoint) =>
      overrides[endpoint] ?? (release: release, cache: Cache.conditional);
  SeasonDto season(Object? d) => SeasonDto.fromJson(d! as Map<String, dynamic>);

  api
    ..currentSeason = ((String? e) => _answer<SeasonDto>(
      'currentSeason',
      'seasons/current.json',
      season,
      s('currentSeason'),
      e,
    ))
    ..season = ((String? e) => _answer<SeasonDto>(
      'season',
      'seasons/current.json',
      season,
      s('season'),
      e,
    ))
    ..home = ((String? e) => _answer<HomeDataDto>(
      'home',
      'home/pre-event.json',
      (Object? d) => HomeDataDto.fromJson(d! as Map<String, dynamic>),
      s('home'),
      e,
    ))
    ..calendar = ((String? e) => _answer<List<GrandPrixSummaryDto>>(
      'calendar',
      'calendar/2026.json',
      _list(GrandPrixSummaryDto.fromJson),
      s('calendar'),
      e,
    ))
    ..driverStandings = ((String? e) => _answer<List<DriverStandingDto>>(
      'driverStandings',
      'standings/drivers-fractional.json',
      _list(DriverStandingDto.fromJson),
      s('driverStandings'),
      e,
    ))
    ..constructorStandings = ((String? e) =>
        _answer<List<ConstructorStandingDto>>(
          'constructorStandings',
          'standings/constructors.json',
          _list(ConstructorStandingDto.fromJson),
          s('constructorStandings'),
          e,
        ))
    ..seasonDrivers = ((String? e) => _answer<List<SeasonDriverSummaryDto>>(
      'seasonDrivers',
      'drivers/season-drivers.json',
      _list(SeasonDriverSummaryDto.fromJson),
      s('seasonDrivers'),
      e,
    ))
    ..seasonConstructors = ((String? e) =>
        _answer<List<SeasonConstructorSummaryDto>>(
          'seasonConstructors',
          'constructors/season-constructors.json',
          _list(SeasonConstructorSummaryDto.fromJson),
          s('seasonConstructors'),
          e,
        ))
    ..seasonCircuits = ((String? e) => _answer<List<CircuitDto>>(
      'seasonCircuits',
      'circuits/season-circuits.json',
      _list(CircuitDto.fromJson),
      s('seasonCircuits'),
      e,
    ))
    ..contentManifest = ((String? e) => _answer<ContentManifestDto>(
      'contentManifest',
      'content/manifest.json',
      (Object? d) => ContentManifestDto.fromJson(d! as Map<String, dynamic>),
      s('contentManifest'),
      e,
      manifest: true,
    ));
}

const List<String> coreEndpoints = <String>[
  'currentSeason',
  'season',
  'home',
  'calendar',
  'driverStandings',
  'constructorStandings',
  'seasonDrivers',
  'seasonConstructors',
  'seasonCircuits',
];

Map<String, int> callsOf(ScriptedGridViewApi api) => <String, int>{
  for (final String e in <String>[...coreEndpoints, 'contentManifest'])
    if (api.callsFor(e) > 0) e: api.callsFor(e),
};

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

    test(
      'is retried on resume, once per run, while the cache stays old',
      () async {
        await settleOnP1();

        // Launch after the manifest's expiry: only the manifest is due, and it
        // reveals P2. No core resource is due by its own expiry.
        final ScriptedGridViewApi api = ScriptedGridViewApi();
        serve(api, p2);
        final SyncHarness h = launch(api, DateTime.utc(2026, 7, 18, 13, 1));
        await h.coordinator.start();
        expect(callsOf(api), <String, int>{'contentManifest': 1});

        // Resume: every core resource is behind the manifest. The calendar's
        // cache still serves P1.
        api.calls.clear();
        serve(
          api,
          p2,
          overrides: <String, Served>{
            'calendar': (release: p1, cache: Cache.stale200),
          },
        );
        await h.coordinator.onForeground();
        expect(callsOf(api), <String, int>{
          for (final String e in coreEndpoints) e: 1,
        });

        // Resume again with the cache still stale: one more attempt, never a
        // loop within the run.
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
      },
    );

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
