import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

// A small set of full-screen goldens for the primary shell and three
// representative skeletons. Animations are disabled and the surface size is
// fixed so the images are deterministic. Cross-platform font antialiasing is
// absorbed by the 2% tolerant comparator in test/flutter_test_config.dart.
const Size _device = Size(390, 844);

Future<void> _pump(WidgetTester tester, String location) async {
  await pumpApp(
    tester,
    initialLocation: location,
    surfaceSize: _device,
    disableAnimations: true,
  );
}

void main() {
  testWidgets('golden: primary shell pill navigation', (
    WidgetTester tester,
  ) async {
    await _pump(tester, '/');
    await expectLater(
      find.byType(GvBottomNav),
      matchesGoldenFile('goldens/primary_shell_nav.png'),
    );
  });

  testWidgets('golden: home loaded (cached next Grand Prix)', (
    WidgetTester tester,
  ) async {
    await _pump(tester, '/');
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/home_loaded.png'),
    );
  });

  // The deliberate Standings loading frame: the final screen with the selected
  // table not yet materialized (this supersedes the Phase 3 skeleton golden).
  testWidgets('golden: standings loading', (WidgetTester tester) async {
    await pumpApp(
      tester,
      initialLocation: '/standings',
      surfaceSize: _device,
      disableAnimations: true,
      syncMetadata: (String key) => null,
      standings: FakeStandingsRepository(
        drivers: (int season) => const <DriverStandingEntry>[],
        constructors: (int season) => const <ConstructorStandingEntry>[],
      ),
    );
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/standings_loading.png'),
    );
  });

  testWidgets('golden: grand prix detail loaded', (WidgetTester tester) async {
    await _pump(tester, '/calendar/2026/13');
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/grand_prix_detail_loaded.png'),
    );
  });

  // --- Phase 7A: Calendar and Grand Prix real-data screens ----------------

  testWidgets('golden: calendar populated', (WidgetTester tester) async {
    await _pump(tester, '/calendar');
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/calendar_populated.png'),
    );
  });

  testWidgets('golden: calendar empty', (WidgetTester tester) async {
    await pumpApp(
      tester,
      initialLocation: '/calendar',
      surfaceSize: _device,
      disableAnimations: true,
      repository: FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => const <CalendarEntry>[],
      ),
    );
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/calendar_empty.png'),
    );
  });

  testWidgets('golden: calendar stale (cached data notice)', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      initialLocation: '/calendar',
      surfaceSize: _device,
      disableAnimations: true,
      syncMetadata: (String key) =>
          syncedMetadata(key, staleAfter: DateTime.utc(2026, 7, 18, 11)),
    );
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/calendar_stale.png'),
    );
  });

  testWidgets('golden: upcoming standard grand prix', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      initialLocation: '/calendar/2026/14',
      surfaceSize: _device,
      disableAnimations: true,
      repository: FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => calendarFixture(season: season),
        grandPrix: (int s, int r) => _standardWeekend(),
      ),
    );
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/grand_prix_standard_upcoming.png'),
    );
  });

  testWidgets('golden: completed grand prix with results', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      initialLocation: '/calendar/2026/12',
      surfaceSize: _device,
      disableAnimations: true,
      repository: FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => calendarFixture(season: season),
        grandPrix: (int s, int r) => _completedWeekend(),
        results: (int s, int r) => <RaceResult>[_raceDocument()],
      ),
    );
    // The classification sits below the fold; scroll it into view so the
    // golden captures what this screen is really about.
    await tester.drag(find.byType(ListView), const Offset(0, -700));
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/grand_prix_completed_results.png'),
    );
  });

  // --- Phase 7B: the Standings real-data screen -----------------------------

  testWidgets('golden: drivers standings populated', (
    WidgetTester tester,
  ) async {
    await _pump(tester, '/standings');
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/standings_drivers_populated.png'),
    );
  });

  testWidgets('golden: constructors standings populated', (
    WidgetTester tester,
  ) async {
    await _pump(tester, '/standings/constructors/2026');
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/standings_constructors_populated.png'),
    );
  });

  // Fractional points, tied confirmed leaders, a duplicated position, an
  // unranked row and a provisional table in one frame.
  testWidgets('golden: fractional and tied standings', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      initialLocation: '/standings',
      surfaceSize: _device,
      disableAnimations: true,
      standings: FakeStandingsRepository(
        drivers: (int season) => <DriverStandingEntry>[
          driverStandingEntry(
            order: 0,
            position: 1,
            driverId: 'tied-a',
            driverName: 'Ada Tied',
            constructorId: 'team-one',
            constructorName: 'Team One',
            teamColor: '#1E41FF',
            points: 200.5,
            wins: 4,
            provisional: true,
          ),
          driverStandingEntry(
            order: 1,
            position: 1,
            driverId: 'tied-b',
            driverName: 'Bo Tied',
            constructorId: 'team-two',
            constructorName: 'Team Two',
            teamColor: '#FF8000',
            points: 200.5,
            wins: 4,
            provisional: true,
          ),
          driverStandingEntry(
            order: 2,
            position: 3,
            driverId: 'zero-points',
            driverName: 'Cal Zero',
            constructorId: 'team-three',
            constructorName: 'Team Three',
            points: 0,
            wins: 0,
            provisional: true,
          ),
          driverStandingEntry(
            order: 3,
            driverId: 'unranked',
            driverName: 'Dee Unranked',
            points: 0,
            provisional: true,
          ),
        ],
      ),
    );
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/standings_fractional_tied.png'),
    );
  });

  testWidgets('golden: standings empty', (WidgetTester tester) async {
    await pumpApp(
      tester,
      initialLocation: '/standings',
      surfaceSize: _device,
      disableAnimations: true,
      standings: FakeStandingsRepository(
        drivers: (int season) => const <DriverStandingEntry>[],
        constructors: (int season) => const <ConstructorStandingEntry>[],
      ),
    );
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/standings_empty.png'),
    );
  });

  testWidgets('golden: standings stale (cached data notice)', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      initialLocation: '/standings',
      surfaceSize: _device,
      disableAnimations: true,
      syncMetadata: (String key) =>
          syncedMetadata(key, staleAfter: DateTime.utc(2026, 7, 18, 11)),
    );
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/standings_stale.png'),
    );
  });

  testWidgets('golden: standings non-blocking refresh failure', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      initialLocation: '/standings/drivers/2024',
      surfaceSize: _device,
      disableAnimations: true,
      standings: FakeStandingsRepository(
        drivers: (int season) => driverStandingsFixture(season: season),
        constructors: (int season) =>
            constructorStandingsFixture(season: season),
        onRefreshDrivers: (int season) async => const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        ),
      ),
    );
    await tester.tap(find.byKey(const ValueKey<String>('standings-refresh')));
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/standings_refresh_failure.png'),
    );
  });

  testWidgets('golden: grand prix with a failed result section', (
    WidgetTester tester,
  ) async {
    await pumpApp(
      tester,
      initialLocation: '/calendar/2026/12',
      surfaceSize: _device,
      disableAnimations: true,
      repository: FakeRaceWeekendRepository(
        home: homeViewFixture(),
        calendar: (int season) => calendarFixture(season: season),
        grandPrix: (int s, int r) => _completedWeekend(),
        onRefreshResults: (int s, int r) async => const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.serverUnavailable),
        ),
      ),
    );
    await tester.drag(find.byType(ListView), const Offset(0, -700));
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/grand_prix_result_error.png'),
    );
  });
}

GrandPrixDetailView _standardWeekend() => GrandPrixDetailView(
  grandPrix: GrandPrix(
    id: '2026-hungarian-grand-prix',
    season: 2026,
    round: 14,
    eventSlug: 'hungarian-grand-prix',
    name: 'Hungarian Grand Prix',
    officialName: 'Formula 1 Mock Hungarian Grand Prix 2026',
    circuitId: 'hungaroring',
    status: EventStatus.upcoming,
    format: WeekendFormat.standard,
    startDate: '2026-08-07',
    endDate: '2026-08-09',
    timezone: 'Europe/Budapest',
    sessions: <Session>[
      Session(
        id: 'h-fp1',
        type: SessionType.practice1,
        name: 'Practice 1',
        startTime: DateTime.utc(2026, 8, 7, 11, 30),
        status: SessionStatus.scheduled,
      ),
      Session(
        id: 'h-fp2',
        type: SessionType.practice2,
        name: 'Practice 2',
        startTime: DateTime.utc(2026, 8, 7, 15),
        status: SessionStatus.scheduled,
      ),
      Session(
        id: 'h-qualifying',
        type: SessionType.qualifying,
        name: 'Qualifying',
        startTime: DateTime.utc(2026, 8, 8, 14),
        status: SessionStatus.scheduled,
      ),
      Session(
        id: 'h-race',
        type: SessionType.race,
        name: 'Race',
        startTime: DateTime.utc(2026, 8, 9, 13),
        status: SessionStatus.scheduled,
      ),
    ],
    hasResults: false,
  ),
  circuit: const Circuit(
    id: 'hungaroring',
    name: 'Hungaroring',
    locality: 'Mogyoród',
    country: 'Hungary',
  ),
  freshness: freshness(
    generatedAt: DateTime.utc(2026, 7, 18, 12),
    staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
  ),
);

GrandPrixDetailView _completedWeekend() => GrandPrixDetailView(
  grandPrix: GrandPrix(
    id: '2026-italian-grand-prix',
    season: 2026,
    round: 12,
    eventSlug: 'italian-grand-prix',
    name: 'Italian Grand Prix',
    circuitId: 'monza',
    status: EventStatus.completed,
    format: WeekendFormat.standard,
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    timezone: 'Europe/Rome',
    sessions: <Session>[
      Session(
        id: 'i-qualifying',
        type: SessionType.qualifying,
        name: 'Qualifying',
        startTime: DateTime.utc(2026, 7, 11, 14),
        status: SessionStatus.completed,
      ),
      Session(
        id: 'i-race',
        type: SessionType.race,
        name: 'Race',
        startTime: DateTime.utc(2026, 7, 12, 13),
        status: SessionStatus.completed,
      ),
    ],
    hasResults: true,
  ),
  circuit: const Circuit(
    id: 'monza',
    name: 'Autodromo Nazionale Monza',
    locality: 'Monza',
    country: 'Italy',
  ),
  freshness: freshness(
    generatedAt: DateTime.utc(2026, 7, 18, 12),
    staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
  ),
);

RaceResult _raceDocument() => raceResultFixture(
  round: 12,
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
      elapsedTime: Duration(
        hours: 1,
        minutes: 15,
        seconds: 12,
        milliseconds: 345,
      ),
    ),
    RaceResultEntry(
      driverId: 'lando-norris',
      constructorId: 'mclaren',
      driverName: 'Lando Norris',
      constructorName: 'McLaren',
      position: 2,
      points: 18,
      status: FinishStatus.finished,
      gapToLeader: Duration(seconds: 3, milliseconds: 210),
    ),
    RaceResultEntry(
      driverId: 'charles-leclerc',
      constructorId: 'ferrari',
      driverName: 'Charles Leclerc',
      constructorName: 'Ferrari',
      status: FinishStatus.dnf,
      dnfReason: 'Power unit',
    ),
  ],
);
