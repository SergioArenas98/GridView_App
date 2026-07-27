import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/circuits/presentation/circuit_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/presentation/not_found_screen.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

/// The Grand Prix detail screen is a long page; a tall surface lets a test
/// assert across the whole of it without relaxing any assertion.
const Size _tall = Size(400, 2400);

GrandPrixDetailView _detail({
  int season = 2026,
  int round = 13,
  String name = 'Belgian Grand Prix',
  String? officialName,
  EventStatus status = EventStatus.upcoming,
  WeekendFormat format = WeekendFormat.sprint,
  List<Session>? sessions,
  bool hasResults = false,
  Circuit? circuit,
  String? timezone = 'Europe/Brussels',
}) => GrandPrixDetailView(
  grandPrix: GrandPrix(
    id: '$season-belgian-grand-prix',
    season: season,
    round: round,
    eventSlug: 'belgian-grand-prix',
    name: name,
    officialName: officialName,
    circuitId: 'spa-francorchamps',
    status: status,
    format: format,
    startDate: '2026-07-24',
    endDate: '2026-07-26',
    timezone: timezone,
    sessions: sessions ?? belgianSprintSessions(),
    hasResults: hasResults,
  ),
  circuit: circuit ?? circuitSpa(),
  freshness: freshness(
    generatedAt: DateTime.utc(2026, 7, 18, 12),
    staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
  ),
);

RaceResult _race({
  List<RaceResultEntry>? entries,
  ResultStatus status = ResultStatus.finalResult,
  FastestLap? fastestLap,
}) => raceResultFixture(
  sessionType: SessionType.race,
  status: status,
  fastestLap: fastestLap,
  entries:
      entries ??
      <RaceResultEntry>[
        const RaceResultEntry(
          driverId: 'max-verstappen',
          constructorId: 'red-bull',
          driverName: 'Max Verstappen',
          constructorName: 'Red Bull Racing',
          position: 1,
          points: 25,
          status: FinishStatus.finished,
          laps: 44,
          elapsedTime: Duration(
            hours: 1,
            minutes: 25,
            seconds: 3,
            milliseconds: 456,
          ),
        ),
        const RaceResultEntry(
          driverId: 'oscar-piastri',
          constructorId: 'mclaren',
          driverName: 'Oscar Piastri',
          constructorName: 'McLaren',
          position: 2,
          points: 18.5,
          status: FinishStatus.finished,
          laps: 44,
          gapToLeader: Duration(seconds: 4, milliseconds: 120),
        ),
      ],
);

RaceResult _sprint() => raceResultFixture(
  sessionType: SessionType.sprint,
  entries: <RaceResultEntry>[
    const RaceResultEntry(
      driverId: 'lando-norris',
      constructorId: 'mclaren',
      driverName: 'Lando Norris',
      constructorName: 'McLaren',
      position: 1,
      points: 8,
      status: FinishStatus.finished,
    ),
  ],
);

FakeRaceWeekendRepository _repo({
  GrandPrixDetailView? detail,
  List<RaceResult>? results,
  Future<RefreshResult> Function(int season, int round)? onRefreshGrandPrix,
  Future<RefreshResult> Function(int season, int round)? onRefreshResults,
}) => FakeRaceWeekendRepository(
  home: homeViewFixture(),
  calendar: (int season) => calendarFixture(season: season),
  grandPrix: (int s, int r) => detail ?? _detail(season: s, round: r),
  results: (int s, int r) => results ?? const <RaceResult>[],
  onRefreshGrandPrix: onRefreshGrandPrix,
  onRefreshResults: onRefreshResults,
);

Future<void> _open(
  WidgetTester tester, {
  FakeRaceWeekendRepository? repository,
  String location = '/calendar/2026/13',
  double textScale = 1,
  Size surfaceSize = _tall,
  Locale locale = const Locale('en'),
}) => pumpApp(
  tester,
  initialLocation: location,
  repository: repository ?? _repo(),
  surfaceSize: surfaceSize,
  textScale: textScale,
  locale: locale,
  disableAnimations: true,
);

void main() {
  group('Grand Prix header and weekend facts', () {
    testWidgets('shows identity, status, format, location and dates', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(
            officialName: 'Formula 1 Mock Belgian Grand Prix 2026',
          ),
        ),
      );

      expect(find.text('Belgian Grand Prix'), findsOneWidget);
      expect(
        find.text('Formula 1 Mock Belgian Grand Prix 2026'),
        findsOneWidget,
      );
      expect(find.text('Upcoming'), findsOneWidget);
      expect(find.text('Sprint weekend'), findsOneWidget);
      expect(
        find.textContaining('Round 13 · 2026 season · Spa, Belgium'),
        findsOneWidget,
      );
      // Circuit facts.
      expect(find.text('Circuit de Spa-Francorchamps'), findsOneWidget);
      expect(find.text('Spa, Belgium'), findsWidgets);
      expect(find.text('Europe/Brussels'), findsOneWidget);
      expect(find.text('Your time zone'), findsOneWidget);
    });

    testWidgets('an official name identical to the name is not repeated', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(detail: _detail(officialName: 'Belgian Grand Prix')),
      );
      expect(find.text('Belgian Grand Prix'), findsOneWidget);
    });

    testWidgets('a missing locality, country and timezone simply vanish', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(
            circuit: const Circuit(id: 'spa-francorchamps', name: 'Spa'),
            timezone: null,
          ),
        ),
      );

      expect(find.text('Spa'), findsOneWidget);
      expect(find.text('Event time zone'), findsNothing);
      expect(find.textContaining('null'), findsNothing);
    });

    testWidgets('an unknown event status still reads as a label', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(
            status: EventStatus.unknown,
            format: WeekendFormat.unknown,
          ),
        ),
      );

      expect(find.text('Status unknown'), findsOneWidget);
      expect(find.text('Format unknown'), findsOneWidget);
    });
  });

  group('Session schedule', () {
    testWidgets('sprint weekends render every session in delivered order', (
      WidgetTester tester,
    ) async {
      await _open(tester);

      double dyOf(String name) => tester.getTopLeft(find.text(name)).dy;
      expect(dyOf('Practice 1'), lessThan(dyOf('Sprint Qualifying')));
      expect(dyOf('Sprint Qualifying'), lessThan(dyOf('Sprint')));
      expect(dyOf('Sprint'), lessThan(dyOf('Qualifying')));
      expect(dyOf('Qualifying'), lessThan(dyOf('Race')));
    });

    testWidgets('standard weekends use the same widget path', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(
            format: WeekendFormat.standard,
            sessions: <Session>[
              Session(
                id: 's-fp1',
                type: SessionType.practice1,
                name: 'Practice 1',
                startTime: DateTime.utc(2026, 7, 10, 11),
                status: SessionStatus.completed,
              ),
              Session(
                id: 's-race',
                type: SessionType.race,
                name: 'Race',
                startTime: DateTime.utc(2026, 7, 12, 13),
                status: SessionStatus.completed,
              ),
            ],
          ),
        ),
      );

      expect(find.text('Practice 1'), findsOneWidget);
      expect(find.text('Race'), findsOneWidget);
      expect(find.byType(GvSessionRow), findsNWidgets(2));
    });

    testWidgets('unknown, cancelled and postponed sessions stay visible', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(
            sessions: <Session>[
              Session(
                id: 's-unknown',
                type: SessionType.unknown,
                startTime: DateTime.utc(2026, 7, 24, 9),
                status: SessionStatus.unknown,
              ),
              Session(
                id: 's-cancelled',
                type: SessionType.practice2,
                name: 'Practice 2',
                startTime: DateTime.utc(2026, 7, 24, 14),
                status: SessionStatus.cancelled,
              ),
              Session(
                id: 's-postponed',
                type: SessionType.qualifying,
                name: 'Qualifying',
                startTime: DateTime.utc(2026, 7, 25, 14),
                status: SessionStatus.postponed,
              ),
            ],
          ),
        ),
      );

      expect(find.byType(GvSessionRow), findsNWidgets(3));
      expect(find.text('Session'), findsOneWidget);
      expect(find.textContaining('Cancelled'), findsOneWidget);
      expect(find.textContaining('Postponed'), findsOneWidget);
    });

    testWidgets('a session without a start time shows no time at all', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(
            sessions: <Session>[
              const Session(
                id: 's-tbd',
                type: SessionType.race,
                name: 'Race',
                status: SessionStatus.scheduled,
              ),
            ],
          ),
        ),
      );

      expect(find.text('Race'), findsOneWidget);
      expect(find.text('Scheduled'), findsOneWidget);
      expect(find.textContaining('00:00'), findsNothing);
    });

    testWidgets('a weekend with no sessions shows a controlled empty state', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(detail: _detail(sessions: const <Session>[])),
      );

      expect(find.text('Schedule not available'), findsOneWidget);
      expect(find.byType(GvSessionRow), findsNothing);
    });
  });

  group('Results', () {
    testWidgets('an upcoming event shows a results-pending state, no error', (
      WidgetTester tester,
    ) async {
      await _open(tester);

      expect(find.text('Results not available yet'), findsOneWidget);
      expect(find.byType(GvErrorState), findsNothing);
      expect(find.byType(GvResultRow), findsNothing);
    });

    testWidgets('a completed race renders its classification', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[_race()],
        ),
      );

      expect(find.text('Race results'), findsOneWidget);
      expect(find.byType(GvResultRow), findsNWidgets(2));
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(find.text('Red Bull Racing'), findsOneWidget);
      expect(find.text('1:25:03.456'), findsOneWidget);
      expect(find.text('+4.120'), findsOneWidget);
      // Fractional points keep their fraction; whole points lose the ".0".
      expect(find.text('25'), findsOneWidget);
      expect(find.text('18.5'), findsOneWidget);
    });

    testWidgets('sprint and race classifications coexist and stay separate', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[_sprint(), _race()],
        ),
      );

      expect(find.text('Sprint results'), findsOneWidget);
      expect(find.text('Race results'), findsOneWidget);
      expect(
        tester.getTopLeft(find.text('Sprint results')).dy,
        lessThan(tester.getTopLeft(find.text('Race results')).dy),
      );
      expect(find.text('Lando Norris'), findsOneWidget);
      expect(find.text('Max Verstappen'), findsOneWidget);
    });

    testWidgets('DNF, DNS, DSQ, DNQ and lapped finishes all read as text', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[
            _race(
              entries: const <RaceResultEntry>[
                RaceResultEntry(
                  driverId: 'a-driver',
                  constructorId: 'a-team',
                  driverName: 'A Driver',
                  constructorName: 'A Team',
                  position: 15,
                  status: FinishStatus.lapped,
                  lapsBehind: 2,
                ),
                RaceResultEntry(
                  driverId: 'b-driver',
                  constructorId: 'b-team',
                  driverName: 'B Driver',
                  constructorName: 'B Team',
                  status: FinishStatus.dnf,
                  dnfReason: 'Power unit',
                ),
                RaceResultEntry(
                  driverId: 'c-driver',
                  constructorId: 'c-team',
                  driverName: 'C Driver',
                  constructorName: 'C Team',
                  status: FinishStatus.dns,
                ),
                RaceResultEntry(
                  driverId: 'd-driver',
                  constructorId: 'd-team',
                  driverName: 'D Driver',
                  constructorName: 'D Team',
                  status: FinishStatus.dsq,
                ),
                RaceResultEntry(
                  driverId: 'e-driver',
                  constructorId: 'e-team',
                  driverName: 'E Driver',
                  constructorName: 'E Team',
                  status: FinishStatus.dnq,
                ),
                RaceResultEntry(
                  driverId: 'f-driver',
                  constructorId: 'f-team',
                  driverName: 'F Driver',
                  constructorName: 'F Team',
                  status: FinishStatus.unknown,
                ),
              ],
            ),
          ],
        ),
      );

      expect(find.textContaining('DNF'), findsOneWidget);
      expect(find.textContaining('DNS'), findsOneWidget);
      expect(find.textContaining('DSQ'), findsOneWidget);
      expect(find.textContaining('DNQ'), findsOneWidget);
      expect(find.textContaining('Lapped'), findsOneWidget);
      expect(find.textContaining('Status unknown'), findsOneWidget);
      expect(find.text('+2 laps'), findsOneWidget);
      // An entry with no position shows a placeholder, never a false zero.
      expect(find.text('—'), findsNWidgets(5));
      expect(find.text('0'), findsNothing);
    });

    testWidgets('duplicate displayed positions render as delivered', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[
            _race(
              entries: const <RaceResultEntry>[
                RaceResultEntry(
                  driverId: 'a-driver',
                  constructorId: 'a-team',
                  driverName: 'A Driver',
                  position: 3,
                  status: FinishStatus.finished,
                ),
                RaceResultEntry(
                  driverId: 'b-driver',
                  constructorId: 'b-team',
                  driverName: 'B Driver',
                  position: 3,
                  status: FinishStatus.finished,
                ),
              ],
            ),
          ],
        ),
      );

      expect(find.text('3'), findsNWidgets(2));
    });

    testWidgets('a fastest lap is marked without hiding anything else', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[
            _race(
              fastestLap: const FastestLap(driverId: 'oscar-piastri', lap: 40),
            ),
          ],
        ),
      );

      expect(find.textContaining('Fastest lap'), findsOneWidget);
      expect(find.byType(GvResultRow), findsNWidgets(2));
    });

    testWidgets('a provisional classification says so', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[_race(status: ResultStatus.provisional)],
        ),
      );

      expect(find.text('Provisional'), findsOneWidget);
    });

    testWidgets('a result failure with no cache is scoped to its section', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          onRefreshResults: (int s, int r) async => const RefreshFailure(
            ApiFailure(kind: ApiFailureKind.serverUnavailable),
          ),
        ),
      );

      expect(find.text("Can't load results"), findsOneWidget);
      // The weekend information is untouched.
      expect(find.text('Belgian Grand Prix'), findsOneWidget);
      expect(find.byType(GvSessionRow), findsNWidgets(5));
    });

    testWidgets('a result failure with cache keeps the classification', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[_race()],
          onRefreshResults: (int s, int r) async => const RefreshFailure(
            ApiFailure(kind: ApiFailureKind.networkUnavailable),
          ),
        ),
      );

      expect(find.byType(GvResultRow), findsNWidgets(2));
      expect(find.text("Can't load results"), findsNothing);
    });

    testWidgets('cached results survive a hasResults flag that says false', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed),
          results: <RaceResult>[_race()],
        ),
      );

      expect(find.byType(GvResultRow), findsNWidgets(2));
      expect(find.text('Results not available yet'), findsNothing);
    });
  });

  group('Detail freshness', () {
    testWidgets('a detail failure keeps the cached weekend visible', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          onRefreshGrandPrix: (int s, int r) async => const RefreshFailure(
            ApiFailure(kind: ApiFailureKind.networkUnavailable),
          ),
        ),
      );

      expect(find.byType(GvSessionRow), findsNWidgets(5));
      expect(
        find.text("Couldn't refresh — showing saved data."),
        findsOneWidget,
      );
    });

    testWidgets('a stale detail shows a cached-data notice with its content', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar/2026/13',
        repository: _repo(),
        surfaceSize: _tall,
        disableAnimations: true,
        // Past the fixture's staleAfter.
        clock: DateTime.utc(2026, 7, 18, 12, 30),
      );

      expect(find.byType(GvOfflineNotice), findsOneWidget);
      expect(find.byType(GvSessionRow), findsNWidgets(5));
    });
  });

  group('Navigation', () {
    testWidgets('the circuit action opens the circuit by stable id', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      await tester.tap(find.text('View circuit'));
      await tester.pumpAndSettle();

      expect(find.byType(CircuitDetailScreen), findsOneWidget);
      expect(
        tester
            .widget<CircuitDetailScreen>(find.byType(CircuitDetailScreen))
            .circuitId,
        'spa-francorchamps',
      );
    });

    testWidgets('a result row opens the driver by stable id', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[_race()],
        ),
      );
      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();

      expect(find.byType(DriverDetailScreen), findsOneWidget);
      expect(
        tester
            .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
            .driverId,
        'max-verstappen',
      );
    });

    testWidgets('the team action opens the constructor by stable id', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[_race()],
        ),
      );
      await tester.tap(find.text('Red Bull Racing'));
      await tester.pumpAndSettle();

      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
      expect(
        tester
            .widget<ConstructorDetailScreen>(
              find.byType(ConstructorDetailScreen),
            )
            .constructorId,
        'red-bull',
      );
    });

    testWidgets('Grand Prix -> Circuit -> back does not stack duplicates', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      await tester.tap(find.text('View circuit'));
      await tester.pumpAndSettle();
      expect(find.byType(CircuitDetailScreen), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();

      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      expect(find.byType(CircuitDetailScreen), findsNothing);
    });

    testWidgets('system back from detail returns to the Calendar branch', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        repository: _repo(),
        surfaceSize: const Size(400, 1200),
        disableAnimations: true,
      );
      await tester.tap(find.text('Belgian Grand Prix'));
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();

      expect(find.byType(CalendarScreen), findsOneWidget);
      expect(find.byType(GrandPrixDetailScreen), findsNothing);
    });

    testWidgets('a deep link opens the detail directly', (
      WidgetTester tester,
    ) async {
      await _open(tester, location: '/calendar/2026/13');
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      expect(find.text('Belgian Grand Prix'), findsOneWidget);
    });

    testWidgets('an invalid season or round stays controlled', (
      WidgetTester tester,
    ) async {
      await _open(tester, location: '/calendar/not-a-year/13');
      expect(find.byType(NotFoundScreen), findsOneWidget);
      expect(find.text('Invalid link'), findsOneWidget);
    });
  });

  group('Accessibility', () {
    testWidgets('result rows announce position, driver, team and points', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[_race()],
        ),
      );

      expect(
        find.bySemanticsLabel(
          RegExp('1, Max Verstappen, Red Bull Racing, Finished, 25 Points'),
        ),
        findsOneWidget,
      );
      expect(
        find.bySemanticsLabel('Open team Red Bull Racing'),
        findsOneWidget,
      );
    });

    testWidgets('the team action keeps a 48px touch target', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[_race()],
        ),
      );

      final Size size = tester.getSize(
        find
            .ancestor(
              of: find.text('Red Bull Racing'),
              matching: find.byType(ConstrainedBox),
            )
            .first,
      );
      expect(size.height, greaterThanOrEqualTo(48));
    });

    testWidgets('the page survives a large text scale', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[_sprint(), _race()],
        ),
        textScale: 2,
        surfaceSize: const Size(400, 4000),
      );

      expect(find.byType(GvResultRow), findsWidgets);
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders Spanish copy for the new strings', (
      WidgetTester tester,
    ) async {
      await _open(tester, locale: const Locale('es'));

      expect(find.text('Fin de semana al sprint'), findsOneWidget);
      expect(find.text('Resultados aún no disponibles'), findsOneWidget);
      expect(find.text('Tu zona horaria'), findsOneWidget);
    });
  });

  group('unresolved competitor identities', () {
    /// A classification whose competitors have not synchronised yet: the
    /// document carries identifiers only, and the local profiles are still
    /// referential stubs, so both names arrive null.
    RaceResult unresolvedRace({String? driverName, String? constructorName}) =>
        _race(
          entries: <RaceResultEntry>[
            RaceResultEntry(
              driverId: 'unsynced-driver',
              constructorId: 'unsynced-team',
              driverName: driverName,
              constructorName: constructorName,
              position: 1,
              points: 25,
              status: FinishStatus.finished,
              laps: 44,
            ),
          ],
        );

    /// Everything the removed fallback used to render, so a regression to it
    /// fails loudly rather than quietly reappearing.
    void expectNoIdentifierText(WidgetTester tester) {
      for (final String forbidden in <String>[
        'unsynced-driver',
        'Unsynced Driver',
        'unsynced-team',
        'Unsynced Team',
        'unsynced',
        'Unsynced',
      ]) {
        expect(
          find.textContaining(forbidden),
          findsNothing,
          reason: 'no raw or humanised identifier may be rendered: $forbidden',
        );
      }
      // …and nothing in the semantics tree either.
      expect(
        find.bySemanticsLabel(RegExp('unsynced', caseSensitive: false)),
        findsNothing,
        reason: 'no identifier-derived text may reach an accessibility label',
      );
    }

    testWidgets('an unresolved driver name shows the localized fallback', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[
            unresolvedRace(constructorName: 'Red Bull Racing'),
          ],
        ),
      );

      expect(find.text('Driver name unavailable'), findsOneWidget);
      // The rest of the row is unaffected.
      expect(find.text('Red Bull Racing'), findsWidgets);
      expect(find.text('25'), findsWidgets);
      expectNoIdentifierText(tester);
    });

    testWidgets('an unresolved driver still navigates by its stable id', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[
            unresolvedRace(constructorName: 'Red Bull Racing'),
          ],
        ),
      );

      await tester.tap(find.text('Driver name unavailable'));
      await tester.pumpAndSettle();

      expect(find.byType(DriverDetailScreen), findsOneWidget);
      expect(
        tester
            .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
            .driverId,
        'unsynced-driver',
      );
    });

    testWidgets('an unresolved team name shows the localized fallback', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[unresolvedRace(driverName: 'Max Verstappen')],
        ),
      );

      expect(find.text('Team name unavailable'), findsWidgets);
      expect(find.text('Max Verstappen'), findsWidgets);
      // The team action is still a labelled button, with no identifier in it.
      expect(find.bySemanticsLabel('Open team'), findsOneWidget);
      expectNoIdentifierText(tester);
    });

    testWidgets('an unresolved team still navigates by its stable id', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[unresolvedRace(driverName: 'Max Verstappen')],
        ),
      );

      await tester.tap(find.bySemanticsLabel('Open team'));
      await tester.pumpAndSettle();

      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
      expect(
        tester
            .widget<ConstructorDetailScreen>(
              find.byType(ConstructorDetailScreen),
            )
            .constructorId,
        'unsynced-team',
      );
    });

    testWidgets('both names unresolved stays readable and accessible', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[unresolvedRace()],
        ),
      );

      // The two unavailable slots are distinguishable rather than one repeated
      // word, so the row still reads unambiguously.
      expect(find.text('Driver name unavailable'), findsOneWidget);
      expect(find.text('Team name unavailable'), findsWidgets);
      // The classification is still fully rendered: position, points, laps.
      expect(find.text('1'), findsWidgets);
      expect(find.text('25'), findsWidgets);
      expect(tester.takeException(), isNull);
      expectNoIdentifierText(tester);
    });

    testWidgets('the row semantics use localized unavailable wording', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[unresolvedRace()],
        ),
      );

      expect(
        find.bySemanticsLabel(
          RegExp(
            '1, Driver name unavailable, Team name unavailable, '
            'Finished, 25 Points',
          ),
        ),
        findsOneWidget,
      );
      expectNoIdentifierText(tester);
    });

    testWidgets('Spanish renders the localized fallbacks', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        locale: const Locale('es'),
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[unresolvedRace()],
        ),
      );

      expect(find.text('Nombre del piloto no disponible'), findsOneWidget);
      expect(find.text('Nombre del equipo no disponible'), findsWidgets);
      expect(find.bySemanticsLabel('Abrir el equipo'), findsOneWidget);
      expectNoIdentifierText(tester);
    });

    testWidgets('a resolved classification is unchanged', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        repository: _repo(
          detail: _detail(status: EventStatus.completed, hasResults: true),
          results: <RaceResult>[_race()],
        ),
      );

      expect(find.text('Max Verstappen'), findsWidgets);
      expect(find.text('Red Bull Racing'), findsWidgets);
      expect(find.text('Driver name unavailable'), findsNothing);
      expect(find.text('Team name unavailable'), findsNothing);
      expect(find.bySemanticsLabel('Open team Red Bull Racing'), findsWidgets);
    });
  });
}
