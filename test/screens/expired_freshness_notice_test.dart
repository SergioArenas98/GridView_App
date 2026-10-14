import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/network/data_source_config.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

/// The remote staging observation of 2026-10-14, reproduced under a controlled
/// clock.
///
/// A first launch applies one bootstrap and ends the run, so Home, the Calendar
/// and both standings tables are materialized by bootstrap and have **no**
/// record of their own. The Grand Prix detail and its result document are then
/// fetched on demand and do have their own records. Every server record carries
/// the same `staleAfter` and nothing renews it, so once the clock passes it all
/// of the content on screen has expired.
///
/// The fixture's `staleAfter` stands in for the batch's (16:34:54Z on the phone)
/// and the clock is set a quarter of an hour past it.
final DateTime _staleAfter = DateTime.utc(2026, 7, 18, 12, 15);
final DateTime _afterStaleAfter = DateTime.utc(2026, 7, 18, 12, 30);

const Size _tall = Size(400, 2400);

/// The phone's persisted metadata after the first launch and one Grand Prix
/// visit: an expired bootstrap record, no record for the resources bootstrap
/// materialized, and expired records for everything fetched under its own key.
ResourceSyncState? _firstLaunchMetadata(String key) {
  const Set<String> bootstrapOnly = <String>{
    'home:2026',
    'calendar:2026',
    'standings:drivers:2026',
    'standings:constructors:2026',
  };
  if (bootstrapOnly.contains(key)) return null;
  return syncedMetadata(key, staleAfter: _staleAfter);
}

/// A completed Grand Prix with a cached classification, as R17 was on the phone.
FakeRaceWeekendRepository _repository({
  DateTime? detailStaleAfter,
  Future<RefreshResult> Function(int season, int round)? onRefreshResults,
}) => FakeRaceWeekendRepository(
  home: homeViewFixture(),
  dashboard: homeDashboardFixture(),
  calendar: (int season) => calendarFixture(season: season),
  grandPrix: (int season, int round) {
    final GrandPrixDetailView detail = grandPrixDetailFixture(season, round);
    return GrandPrixDetailView(
      grandPrix: _completed(detail.grandPrix),
      circuit: detail.circuit,
      freshness: freshness(
        generatedAt: DateTime.utc(2026, 7, 18, 12),
        staleAfter: detailStaleAfter ?? _staleAfter,
      ),
    );
  },
  results: (int season, int round) => <RaceResult>[
    raceResultFixture(
      sessionType: SessionType.race,
      entries: const <RaceResultEntry>[
        RaceResultEntry(
          driverId: 'max-verstappen',
          constructorId: 'red-bull',
          driverName: 'Max Verstappen',
          constructorName: 'Red Bull Racing',
          position: 1,
          points: 25,
          status: FinishStatus.finished,
        ),
      ],
    ),
  ],
  onRefreshResults: onRefreshResults,
);

GrandPrix _completed(GrandPrix gp) => GrandPrix(
  id: gp.id,
  season: gp.season,
  round: gp.round,
  eventSlug: gp.eventSlug,
  name: gp.name,
  officialName: gp.officialName,
  circuitId: gp.circuitId,
  status: EventStatus.completed,
  format: gp.format,
  startDate: gp.startDate,
  endDate: gp.endDate,
  timezone: gp.timezone,
  sessions: gp.sessions,
  hasResults: true,
);

/// The two kinds of build that must keep today's behaviour exactly.
enum _Build { remote, fixture }

Future<void> _pump(
  WidgetTester tester,
  String location, {
  required _Build build,
  Locale locale = const Locale('en'),
  FakeRaceWeekendRepository? repository,
}) => pumpApp(
  tester,
  initialLocation: location,
  repository: repository ?? _repository(),
  surfaceSize: _tall,
  disableAnimations: true,
  locale: locale,
  clock: _afterStaleAfter,
  syncMetadata: _firstLaunchMetadata,
  mockData: build == _Build.fixture,
  dataSourceMode: build == _Build.fixture
      ? DataSourceMode.fixture
      : DataSourceMode.remote,
);

Finder get _notices => find.byType(GvOfflineNotice);

void main() {
  test('the scenario keys match the canonical resource keys', () {
    // Guards the literal keys above against a key-format change.
    expect(ResourceKey.home(2026), 'home:2026');
    expect(ResourceKey.calendar(2026), 'calendar:2026');
    expect(ResourceKey.driverStandings(2026), 'standings:drivers:2026');
    expect(
      ResourceKey.constructorStandings(2026),
      'standings:constructors:2026',
    );
  });

  const Map<String, ({String home, String screen})> copy =
      <String, ({String home, String screen})>{
        'en': (
          home: 'Some information may be outdated',
          screen:
              'This data may be out of date — showing the last saved version.',
        ),
        'es': (
          home: 'Parte de la información puede estar desactualizada',
          screen:
              'Estos datos pueden estar desactualizados — mostrando la última '
              'versión guardada.',
        ),
      };

  for (final MapEntry<String, ({String home, String screen})> language
      in copy.entries) {
    final Locale locale = Locale(language.key);
    final String homeText = language.value.home;
    final String screenText = language.value.screen;

    group('remote build after staleAfter (${language.key})', () {
      testWidgets('Home shows one outdated-information notice', (
        WidgetTester tester,
      ) async {
        await _pump(tester, '/', build: _Build.remote, locale: locale);

        expect(_notices, findsOneWidget);
        expect(find.text(homeText), findsOneWidget);
      });

      testWidgets('Calendar shows one stale notice', (
        WidgetTester tester,
      ) async {
        await _pump(tester, '/calendar', build: _Build.remote, locale: locale);

        expect(_notices, findsOneWidget);
        expect(find.text(screenText), findsOneWidget);
      });

      for (final String table in <String>['drivers', 'constructors']) {
        testWidgets('Standings ($table) shows one stale notice', (
          WidgetTester tester,
        ) async {
          await _pump(
            tester,
            '/standings/$table/2026',
            build: _Build.remote,
            locale: locale,
          );

          expect(_notices, findsOneWidget);
          expect(find.text(screenText), findsOneWidget);
        });
      }

      testWidgets('Grand Prix detail shows one stale notice, not two', (
        WidgetTester tester,
      ) async {
        await _pump(
          tester,
          '/calendar/2026/13',
          build: _Build.remote,
          locale: locale,
        );

        expect(find.byType(GvResultRow), findsWidgets);
        expect(_notices, findsOneWidget);
        expect(find.text(screenText), findsOneWidget);
      });
    });
  }

  group('remote Grand Prix detail notice scope', () {
    testWidgets('expired classifications alone raise the one screen notice', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        '/calendar/2026/13',
        build: _Build.remote,
        repository: _repository(detailStaleAfter: DateTime.utc(2026, 7, 19)),
      );

      expect(_notices, findsOneWidget);
      expect(
        find.text(
          'This data may be out of date — showing the last saved version.',
        ),
        findsOneWidget,
      );
      // It sits above the weekend facts, not inside the result section.
      expect(
        tester.getTopLeft(_notices).dy,
        lessThan(tester.getTopLeft(find.byType(GvResultRow).first).dy),
      );
    });

    testWidgets('a result refresh failure keeps its own scoped notice', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        '/calendar/2026/13',
        build: _Build.remote,
        repository: _repository(
          detailStaleAfter: DateTime.utc(2026, 7, 19),
          onRefreshResults: (int s, int r) async => const RefreshFailure(
            ApiFailure(kind: ApiFailureKind.networkUnavailable),
          ),
        ),
      );

      // One stale notice for the screen, and the classification's own failure.
      expect(_notices, findsNWidgets(2));
      expect(
        find.text(
          'This data may be out of date — showing the last saved version.',
        ),
        findsOneWidget,
      );
      expect(
        find.text("Couldn't refresh — showing saved data."),
        findsOneWidget,
      );
    });
  });

  testWidgets('Home never gives a cached result the bootstrap freshness', (
    WidgetTester tester,
  ) async {
    // Every bootstrap-applicable section has its own fresh record, and the
    // cached classification has none. Only a fallback for the result document
    // could raise a notice, and there must be none.
    await pumpApp(
      tester,
      repository: FakeRaceWeekendRepository(
        home: homeViewFixture(),
        dashboard: homeDashboardFixture(
          latestRaceResult: _repository().results!(2026, 12).first,
        ),
        calendar: (int season) => calendarFixture(season: season),
      ),
      surfaceSize: _tall,
      disableAnimations: true,
      clock: _afterStaleAfter,
      syncMetadata: (String key) => switch (key) {
        'bootstrap' => syncedMetadata(key, staleAfter: _staleAfter),
        'grand-prix-results:2026:12' => null,
        _ => syncedMetadata(key),
      },
      dataSourceMode: DataSourceMode.remote,
    );

    expect(
      ResourceKey.grandPrixResults(2026, 12),
      'grand-prix-results:2026:12',
    );
    expect(_notices, findsNothing);
  });

  testWidgets('a remote-mode build serving mock data keeps today\'s notices', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      repository: _repository(),
      surfaceSize: _tall,
      disableAnimations: true,
      clock: _afterStaleAfter,
      syncMetadata: _firstLaunchMetadata,
      mockData: true,
      dataSourceMode: DataSourceMode.remote,
    );

    expect(_notices, findsNothing);
  });

  // Frozen and sample-fixture builds keep exactly their current notices: none on
  // the bootstrap-materialized screens, and the detail and result notices on the
  // Grand Prix screen.
  group('fixture build after staleAfter is unchanged', () {
    for (final String location in <String>[
      '/',
      '/calendar',
      '/standings/drivers/2026',
      '/standings/constructors/2026',
    ]) {
      testWidgets('$location shows no stale notice', (
        WidgetTester tester,
      ) async {
        await _pump(tester, location, build: _Build.fixture);

        expect(_notices, findsNothing);
      });
    }

    testWidgets('Grand Prix detail keeps its detail and result notices', (
      WidgetTester tester,
    ) async {
      await _pump(tester, '/calendar/2026/13', build: _Build.fixture);

      expect(_notices, findsNWidgets(2));
    });
  });

  // Before staleAfter the remote build shows nothing anywhere: the fallback to
  // bootstrap's own record reports fresh content as fresh.
  group('remote build before staleAfter', () {
    for (final String location in <String>[
      '/',
      '/calendar',
      '/standings/drivers/2026',
      '/calendar/2026/13',
    ]) {
      testWidgets('$location shows no stale notice', (
        WidgetTester tester,
      ) async {
        await pumpApp(
          tester,
          initialLocation: location,
          repository: _repository(),
          surfaceSize: _tall,
          disableAnimations: true,
          clock: DateTime.utc(2026, 7, 18, 12, 10),
          syncMetadata: _firstLaunchMetadata,
          dataSourceMode: DataSourceMode.remote,
        );

        expect(_notices, findsNothing);
      });
    }
  });
}
