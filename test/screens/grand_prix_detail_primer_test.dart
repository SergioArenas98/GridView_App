// Step 55C.12: the production Grand Prix Detail in Primer V2 (Dark and Light).
//
// Presentation only: route, season and round identity, refresh scope, both
// resources' state and the navigation helpers are the existing ones and are
// asserted here through the real router, providers and fakes. Every value is
// a test fixture; every name starting "Synthetic" is invented
// (`test/support/grand_prix_review_fixtures.dart`).
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/application/grand_prix_detail_state.dart';
import 'package:gridview/features/calendar/application/grand_prix_results_state.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/calendar/presentation/widgets/grand_prix_band.dart';
import 'package:gridview/features/calendar/presentation/widgets/grand_prix_notices.dart';
import 'package:gridview/features/calendar/presentation/widgets/grand_prix_schedule.dart';
import 'package:gridview/features/circuits/presentation/circuit_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/presentation/domain_status.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_app_bar.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_notices.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/l10n/app_localizations_en.dart';
import 'package:gridview/l10n/app_localizations_es.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/grand_prix_review_fixtures.dart';
import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

const String _belgium = '/calendar/2026/13';

// --- Fixtures -----------------------------------------------------------------

GrandPrixDetailView _detail({
  int round = 13,
  String name = 'Belgian Grand Prix',
  String? officialName,
  EventStatus status = EventStatus.upcoming,
  WeekendFormat format = WeekendFormat.sprint,
  List<Session>? sessions,
  bool hasResults = false,
  Circuit? circuit,
  String? timezone = 'Europe/Brussels',
  String? startDate = '2026-07-24',
  String? endDate = '2026-07-26',
}) => GrandPrixDetailView(
  grandPrix: GrandPrix(
    id: '2026-belgian-grand-prix',
    season: 2026,
    round: round,
    eventSlug: 'belgian-grand-prix',
    name: name,
    officialName: officialName,
    circuitId: 'spa-francorchamps',
    status: status,
    format: format,
    startDate: startDate,
    endDate: endDate,
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

GrandPrixDetailView _completed({String? officialName}) => _detail(
  status: EventStatus.completed,
  hasResults: true,
  officialName: officialName,
);

const RaceResultEntry _max = RaceResultEntry(
  driverId: 'max-verstappen',
  constructorId: 'red-bull',
  driverName: 'Max Verstappen',
  constructorName: 'Red Bull Racing',
  position: 1,
  points: 25,
  status: FinishStatus.finished,
  elapsedTime: Duration(hours: 1, minutes: 25, seconds: 3, milliseconds: 456),
);

const RaceResultEntry _oscar = RaceResultEntry(
  driverId: 'oscar-piastri',
  constructorId: 'mclaren',
  driverName: 'Oscar Piastri',
  constructorName: 'McLaren',
  position: 2,
  points: 18.5,
  status: FinishStatus.finished,
  gapToLeader: Duration(seconds: 4, milliseconds: 120),
);

RaceResult _race({
  List<RaceResultEntry> entries = const <RaceResultEntry>[_max, _oscar],
  ResultStatus status = ResultStatus.finalResult,
  FastestLap? fastestLap,
  SessionType type = SessionType.race,
}) => raceResultFixture(
  sessionType: type,
  status: status,
  fastestLap: fastestLap,
  entries: entries,
);

Future<RefreshResult> _offline(int s, int r) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.networkUnavailable));
Future<RefreshResult> _unavailable(int s, int r) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.serverUnavailable));

/// Every record stale, so both resources are stale (after 2000).
ResourceSyncState? _allStale(String key) =>
    syncedMetadata(key, staleAfter: DateTime.utc(2000));

/// Only the results record stale.
ResourceSyncState? _resultsStale(String key) =>
    key == ResourceKey.grandPrixResults(2026, 13)
    ? syncedMetadata(key, staleAfter: DateTime.utc(2000))
    : syncedMetadata(key);

/// Only the event record stale.
ResourceSyncState? _eventStale(String key) =>
    key == ResourceKey.grandPrix(2026, 13)
    ? syncedMetadata(key, staleAfter: DateTime.utc(2000))
    : syncedMetadata(key);

// --- Harness ------------------------------------------------------------------

Future<void> _reset(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
}

/// The label of every live-region node in the whole semantics tree, so a
/// test can assert that exactly one announcement exists and what it says.
List<String> _liveRegionLabels(WidgetTester tester) {
  final List<String> labels = <String>[];
  bool visit(SemanticsNode node) {
    final SemanticsData data = node.getSemanticsData();
    if (data.flagsCollection.isLiveRegion) labels.add(data.label);
    node.visitChildren(visit);
    return true;
  }

  visit(
    tester.binding.renderViews.first.owner!.semanticsOwner!.rootSemanticsNode!,
  );
  return labels;
}

/// Opens Grand Prix Detail above Home, as from the Calendar, so Back exists.
Future<GoRouter> _open(
  WidgetTester tester, {
  GrandPrixDetailView? detail,
  List<RaceResult> results = const <RaceResult>[],
  Future<RefreshResult> Function(int s, int r)? refreshDetail,
  Future<RefreshResult> Function(int s, int r)? refreshResults,
  ResourceSyncState? Function(String key)? metadata,
  Size size = const Size(390, 2600),
  double textScale = 1,
  Locale locale = const Locale('en'),
  AppThemePreference theme = AppThemePreference.dark,
  TimeDisplayPreference time = TimeDisplayPreference.device,
  String deviceTimeZone = 'UTC',
  bool mockData = false,
}) async {
  await _reset(tester);
  await loadArchivo(tester);
  final GoRouter router = await pumpApp(
    tester,
    surfaceSize: size,
    textScale: textScale,
    locale: locale,
    disableAnimations: true,
    syncMetadata: metadata,
    deviceTimeZone: deviceTimeZone,
    mockData: mockData,
    preferences: AppPreferences.defaults.copyWith(
      theme: theme,
      timeDisplay: time,
    ),
    repository: FakeRaceWeekendRepository(
      home: homeViewFixture(),
      calendar: (int season) => calendarFixture(season: season),
      grandPrix: (int s, int r) => detail ?? _detail(round: r),
      results: (int s, int r) => results,
      onRefreshGrandPrix: refreshDetail,
      onRefreshResults: refreshResults,
    ),
  );
  unawaited(router.push(_belgium));
  await tester.pumpAndSettle();
  return router;
}

Finder _key(String k) => find.byKey(ValueKey<String>(k));
Finder get _band => _key('gp-band');
Finder get _back => _key('gp-detail-back');
Finder get _circuit => _key('gp-circuit-link');

Finder _row(String driverId) =>
    _key('result-2026-belgian-grand-prix-race-$driverId');

/// The focus target of a result row's separate team link.
Finder _teamLink(String driverId) => find
    .descendant(of: _row(driverId), matching: find.byType(GvPrimerFocusTarget))
    .at(1);

FocusNode _nodeOf(WidgetTester tester, Finder target) => Focus.of(
  tester.element(
    find.descendant(of: target, matching: find.byType(GestureDetector)).first,
  ),
);

List<String> _messages(WidgetTester tester, [Finder? within]) => <String>[
  for (final GvPrimerNotice n in tester.widgetList(
    within == null
        ? find.byType(GvPrimerNotice)
        : find.descendant(of: within, matching: find.byType(GvPrimerNotice)),
  ))
    n.message,
];

List<GvPrimerStatusChip> _chipsIn(WidgetTester tester, Finder scope) => tester
    .widgetList<GvPrimerStatusChip>(
      find.descendant(of: scope, matching: find.byType(GvPrimerStatusChip)),
    )
    .toList();

GvPrimerResultRow _resultRow(WidgetTester tester, String driverId) =>
    tester.widget<GvPrimerResultRow>(_row(driverId));

List<String> _traversal(SemanticsNode node) => <String>[
  if (node.label.isNotEmpty) node.label,
  for (final SemanticsNode child in node.debugListChildrenInOrder(
    DebugSemanticsDumpOrder.traversalOrder,
  ))
    ..._traversal(child),
];

const String _failed = "Couldn't refresh — showing saved data.";
const String _stale =
    'This data may be out of date — showing the last saved version.';
const String _combined = "Couldn't refresh. Saved data may be out of date.";

void main() {
  group('identity band', () {
    testWidgets('chips, round, season, heading, official name and facts', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _detail(officialName: 'Formula 1 Mock Belgian Grand Prix 2026'),
      );
      final List<GvPrimerStatusChip> chips = _chipsIn(tester, _band);
      expect(
        chips.map((GvPrimerStatusChip c) => (c.label, c.kind)),
        <(String, GvPrimerChipKind)>[
          ('Upcoming', GvPrimerChipKind.known),
          ('Sprint weekend', GvPrimerChipKind.context),
        ],
      );
      expect(tester.widget<Text>(_key('gp-band-round')).data, '13');
      expect(find.bySemanticsLabel('Round 13'), findsOneWidget);
      expect(tester.widget<Text>(_key('gp-band-season')).data, '2026 season');
      expect(
        tester.widget<Text>(_key('gp-band-name')).data,
        'Belgian Grand Prix',
      );
      expect(
        tester.widget<Text>(_key('gp-band-official')).data,
        'Formula 1 Mock Belgian Grand Prix 2026',
      );
      // Dates once, each side unbreakable; location once (G-1).
      expect(find.text('Jul 24 – Sun, Jul 26'), findsOneWidget);
      expect(find.text('Spa, Belgium'), findsOneWidget);
      expect(find.text('Dates'), findsOneWidget);
      expect(find.text('Location'), findsOneWidget);
    });

    testWidgets('the heading is a header; the band reads in prototype order', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(
        tester,
        detail: _detail(officialName: 'Formula 1 Mock Belgian Grand Prix 2026'),
      );
      expect(
        tester.getSemantics(_key('gp-band-name')),
        isSemantics(label: 'Belgian Grand Prix', isHeader: true),
      );
      final List<String> order = _traversal(
        tester.getSemantics(_band),
      ).toList();
      final List<String> expected = <String>[
        'Upcoming',
        'Sprint weekend',
        'Round 13',
        '2026 season',
        'Belgian Grand Prix',
        'Formula 1 Mock Belgian Grand Prix 2026',
      ];
      int cursor = -1;
      for (final String label in expected) {
        final int at = order.indexWhere((String l) => l == label, cursor + 1);
        expect(at, greaterThan(cursor), reason: '$label in $order');
        cursor = at;
      }
      expect(order.last, startsWith('Location'));
      handle.dispose();
    });

    testWidgets('GPD-03: a blank name is the localized fallback heading', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      for (final String blank in <String>['', '   ']) {
        await _open(tester, detail: _detail(name: blank));
        final Text heading = tester.widget<Text>(_key('gp-band-name'));
        expect(heading.data, 'Grand Prix name unavailable');
        // The approved secondary style (as Circuit Detail's PD-13a).
        expect(heading.style!.color, GvPrimerRoles.dark.text.secondary);
        expect(
          tester.getSemantics(_key('gp-band-name')),
          isSemantics(label: 'Grand Prix name unavailable', isHeader: true),
        );
        // The app-bar policy is unchanged: the generic title.
        expect(
          find.descendant(
            of: find.byType(PrimerDetailAppBar),
            matching: find.text('Grand Prix'),
          ),
          findsOneWidget,
        );
        expect(find.textContaining('belgian-grand-prix'), findsNothing);
      }
      handle.dispose();
    });

    testWidgets('official name: absent when missing, blank or identical', (
      WidgetTester tester,
    ) async {
      for (final String? official in <String?>[
        null,
        '  ',
        'Belgian Grand Prix',
      ]) {
        await _open(tester, detail: _detail(officialName: official));
        expect(_key('gp-band-official'), findsNothing);
      }
    });

    testWidgets('unknown status and format are dashed (VS-1)', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _detail(
          status: EventStatus.unknown,
          format: WeekendFormat.unknown,
        ),
      );
      expect(
        _chipsIn(tester, _band).map((GvPrimerStatusChip c) => c.kind),
        <GvPrimerChipKind>[GvPrimerChipKind.unknown, GvPrimerChipKind.unknown],
      );
      expect(find.text('Status unknown'), findsOneWidget);
      expect(find.text('Format unknown'), findsOneWidget);
    });

    testWidgets('completed status carries its check kind', (
      WidgetTester tester,
    ) async {
      await _open(tester, detail: _completed());
      expect(_chipsIn(tester, _band).first.kind, GvPrimerChipKind.completed);
    });

    testWidgets('missing dates and location remove the fact rail', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _detail(
          startDate: null,
          endDate: null,
          circuit: const Circuit(id: 'spa-francorchamps', name: 'Spa'),
        ),
      );
      expect(_key('gp-band-facts'), findsNothing);
      expect(find.text('Dates'), findsNothing);
      expect(find.text('Location'), findsNothing);
      expect(find.textContaining('null'), findsNothing);
    });

    testWidgets('Graphite band in both themes; no image (GP10 / XS-15)', (
      WidgetTester tester,
    ) async {
      for (final AppThemePreference theme in AppThemePreference.values.where(
        (AppThemePreference t) => t != AppThemePreference.system,
      )) {
        await _open(tester, theme: theme);
        // The fill is its own layer: a BoxDecoration with a gradient would
        // ignore its colour and let the page show through.
        expect(
          tester.widget<ColoredBox>(_key('gp-band-fill')).color,
          GvPrimerRoles.dark.surface.band,
          reason: theme.name,
        );
        for (final DecoratedBox box in tester.widgetList<DecoratedBox>(
          find.descendant(of: _band, matching: find.byType(DecoratedBox)),
        )) {
          final Decoration d = box.decoration;
          if (d is BoxDecoration && d.gradient != null) {
            expect(d.color, isNull, reason: 'a gradient hides its colour');
          }
        }
        // The fact rail starts 16px below the identity block, on the band.
        expect(
          tester.getTopLeft(_key('gp-band-facts')).dy,
          greaterThanOrEqualTo(
            tester.getBottomLeft(_key('gp-band-seam')).dy + 4 + 16 - 0.5,
          ),
        );
        expect(
          find.descendant(of: _band, matching: find.byType(Image)),
          findsNothing,
        );
      }
    });

    testWidgets('wide at 390dp, narrow at 320dp and at 200% text', (
      WidgetTester tester,
    ) async {
      double figure() =>
          tester.widget<Text>(_key('gp-band-round')).style!.fontSize!;
      await _open(tester);
      expect(figure(), 88);
      // Wide: the season sits beside the figure, right of the seam.
      expect(
        tester.getTopLeft(_key('gp-band-season')).dx,
        greaterThan(tester.getTopRight(_key('gp-band-seam')).dx),
      );
      await _open(tester, size: const Size(320, 2600));
      expect(figure(), 64);
      // Narrow: the name takes the full width below the figure.
      expect(tester.getTopLeft(_key('gp-band-name')).dx, GvPrimerLayout.gutter);
      expect(
        tester.getTopLeft(_key('gp-band-name')).dy,
        greaterThan(tester.getBottomLeft(_key('gp-band-round')).dy),
      );
      await _open(tester, size: const Size(390, 4000), textScale: 2);
      expect(figure(), 72);
      expect(tester.takeException(), isNull);
    });
  });

  group('circuit row', () {
    testWidgets('one link named with the circuit; event season travels', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final GoRouter router = await _open(tester);
      expect(
        find.bySemanticsLabel('View circuit, Circuit de Spa-Francorchamps'),
        findsOneWidget,
      );
      expect(tester.getSize(_circuit).height, greaterThanOrEqualTo(72));
      await tester.tap(_circuit);
      await tester.pumpAndSettle();
      final CircuitDetailScreen screen = tester.widget(
        find.byType(CircuitDetailScreen),
      );
      expect(screen.circuitId, 'spa-francorchamps');
      expect(screen.originSeason, 2026);
      expect(router.canPop(), isTrue);
      handle.dispose();
    });

    testWidgets('an unresolved circuit name still navigates (G-3)', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(
        tester,
        detail: GrandPrixDetailView(
          grandPrix: _detail().grandPrix,
          freshness: _detail().freshness,
        ),
      );
      expect(_key('gp-circuit-name'), findsNothing);
      expect(find.bySemanticsLabel('View circuit'), findsOneWidget);
      await tester.tap(_circuit);
      await tester.pumpAndSettle();
      expect(find.byType(CircuitDetailScreen), findsOneWidget);
      handle.dispose();
    });

    testWidgets('Grand Prix → Circuit → back does not stack duplicates', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      await tester.tap(_circuit);
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      expect(find.byType(CircuitDetailScreen), findsNothing);
    });
  });

  group('schedule', () {
    test('run-length grouping never reorders or merges across runs', () {
      final List<(String?, List<int>)> runs = runsByDay<int>(
        <int>[1, 2, 3, 4, 5, 6],
        (int i) => switch (i) {
          1 || 2 => 'Fri',
          3 => 'Sat',
          4 => 'Fri',
          5 || 6 => null,
          _ => 'x',
        },
      );
      expect(runs.map(((String?, List<int>) r) => r.$1), <String?>[
        'Fri',
        'Sat',
        'Fri',
        null,
      ]);
      expect(runs.expand(((String?, List<int>) r) => r.$2), <int>[
        1,
        2,
        3,
        4,
        5,
        6,
      ]);
    });

    testWidgets('delivered order, one header per consecutive day', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      final List<String> names = tester
          .widgetList<Text>(_key('session-name'))
          .map((Text t) => t.data!)
          .toList();
      expect(names, <String>[
        'Practice 1',
        'Sprint Qualifying',
        'Sprint',
        'Qualifying',
        'Race',
      ]);
      for (final String day in <String>[
        'Fri Jul 24',
        'Sat Jul 25',
        'Sun Jul 26',
      ]) {
        expect(find.text(day), findsOneWidget);
      }
      expect(find.text('Scheduled'), findsNWidgets(5));
    });

    testWidgets('a day that reappears later starts a new header', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _detail(
          sessions: <Session>[
            Session(
              id: 'a',
              type: SessionType.practice1,
              name: 'Practice 1',
              startTime: DateTime.utc(2026, 7, 24, 10),
              status: SessionStatus.scheduled,
            ),
            Session(
              id: 'b',
              type: SessionType.practice2,
              name: 'Practice 2',
              startTime: DateTime.utc(2026, 7, 25, 10),
              status: SessionStatus.scheduled,
            ),
            Session(
              id: 'c',
              type: SessionType.practice3,
              name: 'Practice 3',
              startTime: DateTime.utc(2026, 7, 24, 15),
              status: SessionStatus.scheduled,
            ),
          ],
        ),
      );
      expect(find.text('Fri Jul 24'), findsNWidgets(2));
      expect(
        tester.getTopLeft(find.text('Practice 2')).dy,
        lessThan(tester.getTopLeft(find.text('Practice 3')).dy),
      );
    });

    testWidgets('statuses: plain words, dashed unknown, alert and live chips', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _detail(
          sessions: <Session>[
            Session(
              id: 'u',
              type: SessionType.unknown,
              startTime: DateTime.utc(2026, 7, 24, 9),
              status: SessionStatus.unknown,
            ),
            Session(
              id: 'c',
              type: SessionType.practice2,
              name: 'Practice 2',
              startTime: DateTime.utc(2026, 7, 24, 14),
              status: SessionStatus.cancelled,
            ),
            Session(
              id: 'p',
              type: SessionType.qualifying,
              name: 'Qualifying',
              startTime: DateTime.utc(2026, 7, 25, 14),
              status: SessionStatus.postponed,
            ),
            Session(
              id: 'l',
              type: SessionType.race,
              name: 'Race',
              startTime: DateTime.utc(2026, 7, 26, 13),
              status: SessionStatus.live,
            ),
            Session(
              id: 'd',
              type: SessionType.sprint,
              name: 'Sprint',
              startTime: DateTime.utc(2026, 7, 26, 15),
              status: SessionStatus.completed,
            ),
          ],
        ),
      );
      final Map<String, GvPrimerChipKind> kinds = <String, GvPrimerChipKind>{
        for (final GvPrimerStatusChip c in _chipsIn(
          tester,
          _key('gp-schedule'),
        ))
          c.label: c.kind,
      };
      expect(kinds, <String, GvPrimerChipKind>{
        'Status unknown': GvPrimerChipKind.unknown,
        'Cancelled': GvPrimerChipKind.cancelled,
        'Postponed': GvPrimerChipKind.postponed,
        'Live': GvPrimerChipKind.live,
      });
      expect(find.text('Session'), findsOneWidget);
      expect(find.text('Completed'), findsOneWidget);
    });

    testWidgets('PD-06: each row reads time, name, status as one node', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester);
      final SemanticsNode node = tester.getSemantics(
        _key('session-2026-belgian-grand-prix-practice-1'),
      );
      expect(node.label, startsWith('10:30 UTC'));
      expect(
        node.label.indexOf('Practice 1'),
        greaterThan(node.label.indexOf('10:30 UTC')),
      );
      expect(
        node.label.indexOf('Scheduled'),
        greaterThan(node.label.indexOf('Practice 1')),
      );
      handle.dispose();
    });

    testWidgets('a session without a start time invents none', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(
        tester,
        detail: _detail(
          sessions: <Session>[
            const Session(
              id: 'tbd',
              type: SessionType.race,
              name: 'Race',
              status: SessionStatus.scheduled,
            ),
          ],
        ),
      );
      expect(_key('session-time'), findsNothing);
      expect(_key('session-time-none'), findsOneWidget);
      expect(find.textContaining('00:00'), findsNothing);
      // No day header without a time.
      expect(find.textContaining('Jul'), findsWidgets); // the fact rail only
      expect(find.textContaining('Sun Jul'), findsNothing);
      expect(
        tester.getSemantics(_key('session-tbd')).label,
        startsWith('Race'),
      );
      handle.dispose();
    });

    testWidgets('time modes: device, event, both (second clock differs)', (
      WidgetTester tester,
    ) async {
      await _open(tester);
      expect(find.text('10:30 UTC'), findsOneWidget);
      expect(_key('session-time-secondary'), findsNothing);

      await _open(tester, time: TimeDisplayPreference.event);
      expect(find.text('12:30 CEST'), findsOneWidget);
      expect(_key('session-time-secondary'), findsNothing);

      await _open(tester, time: TimeDisplayPreference.both);
      expect(find.text('12:30 CEST'), findsOneWidget);
      expect(find.text('10:30 UTC'), findsOneWidget);
    });

    testWidgets('Both mode keeps the second day when midnight is crossed', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        time: TimeDisplayPreference.both,
        detail: _detail(
          timezone: 'Asia/Tokyo',
          sessions: <Session>[
            Session(
              id: 'late',
              type: SessionType.race,
              name: 'Race',
              startTime: DateTime.utc(2026, 7, 26, 23),
              status: SessionStatus.scheduled,
            ),
          ],
        ),
      );
      // Primary: the event clock and its day; second line: device day + time.
      expect(find.text('Mon Jul 27'), findsOneWidget);
      expect(find.text('08:00 JST'), findsOneWidget);
      expect(find.text('Sun Jul 26 23:00 UTC'), findsOneWidget);
    });

    testWidgets('zones: event zone only when present; device zone always', (
      WidgetTester tester,
    ) async {
      await _open(tester, detail: _detail(sessions: const <Session>[]));
      expect(find.text('Event time zone'), findsOneWidget);
      expect(find.text('Your time zone'), findsOneWidget);
      expect(find.text('Schedule not available'), findsOneWidget);
      await _open(
        tester,
        detail: _detail(sessions: const <Session>[], timezone: null),
      );
      expect(find.text('Event time zone'), findsNothing);
      expect(find.text('Your time zone'), findsOneWidget);
    });

    testWidgets('time above the name below 22em (320dp); beside it at 390dp', (
      WidgetTester tester,
    ) async {
      Finder first(String k) => _key(k).first;
      await _open(tester);
      expect(
        tester.getTopLeft(first('session-name')).dx,
        greaterThan(tester.getTopRight(first('session-time')).dx),
      );
      await _open(tester, size: const Size(320, 2600));
      expect(
        tester.getTopLeft(first('session-name')).dy,
        greaterThan(tester.getBottomLeft(first('session-time')).dy),
      );
    });
  });

  group('results and winner semantics', () {
    testWidgets('race classification: winner, pts unit, timing, labels', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester, detail: _completed(), results: <RaceResult>[_race()]);
      final GvPrimerResultRow max = _resultRow(tester, 'max-verstappen');
      expect(max.winner, isTrue);
      expect(max.winnerLabel, 'Winner');
      expect(max.points, '25');
      expect(max.pointsUnit, 'pts');
      expect(max.timing, '1:25:03.456');
      expect(max.statuses, isEmpty); // "Finished" is hidden visually
      expect(
        max.semanticLabel,
        '1, Max Verstappen, Red Bull Racing, Finished, 25 Points, '
        '1:25:03.456, Winner',
      );
      final GvPrimerResultRow oscar = _resultRow(tester, 'oscar-piastri');
      expect(oscar.winner, isFalse);
      expect(oscar.points, '18.5');
      expect(oscar.timing, '+4.120');
      expect(find.text('Winner'), findsOneWidget);
      expect(
        find.bySemanticsLabel('Open team Red Bull Racing'),
        findsOneWidget,
      );
      handle.dispose();
    });

    testWidgets('no winner for a sprint, a tie, an unresolved P1 or an '
        'unavailable classification', (WidgetTester tester) async {
      const RaceResultEntry tied = RaceResultEntry(
        driverId: 'lando-norris',
        constructorId: 'mclaren',
        driverName: 'Lando Norris',
        constructorName: 'McLaren',
        position: 1,
        status: FinishStatus.finished,
      );
      const RaceResultEntry ghost = RaceResultEntry(
        driverId: 'ghost',
        constructorId: 'red-bull',
        position: 1,
        status: FinishStatus.finished,
      );
      for (final RaceResult doc in <RaceResult>[
        _race(type: SessionType.sprint),
        _race(entries: const <RaceResultEntry>[_max, tied]),
        _race(entries: const <RaceResultEntry>[ghost, _oscar]),
        _race(status: ResultStatus.unavailable),
      ]) {
        await _open(tester, detail: _completed(), results: <RaceResult>[doc]);
        expect(
          tester
              .widgetList<GvPrimerResultRow>(find.byType(GvPrimerResultRow))
              .where((GvPrimerResultRow r) => r.winner),
          isEmpty,
          reason: '${doc.sessionType} ${doc.status} ${doc.entries.length}',
        );
        expect(find.text('Winner'), findsNothing);
      }
    });

    testWidgets('sprint keeps its renderer and title, beside the race', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _completed(),
        results: <RaceResult>[
          _race(type: SessionType.sprint),
          _race(),
        ],
      );
      expect(find.text('Sprint results'), findsOneWidget);
      expect(find.text('Race results'), findsOneWidget);
      expect(
        tester.getTopLeft(find.text('Sprint results')).dy,
        lessThan(tester.getTopLeft(find.text('Race results')).dy),
      );
      // Only the race's P1 is the winner.
      expect(find.text('Winner'), findsOneWidget);
    });

    testWidgets('classification status kinds (R02, VS-1, no dagger)', (
      WidgetTester tester,
    ) async {
      for (final (ResultStatus status, String word, GvPrimerChipKind kind)
          in <(ResultStatus, String, GvPrimerChipKind)>[
            (ResultStatus.finalResult, 'Final', GvPrimerChipKind.finalResult),
            (ResultStatus.provisional, 'Provisional', GvPrimerChipKind.known),
            (ResultStatus.unknown, 'Status unknown', GvPrimerChipKind.unknown),
          ]) {
        await _open(
          tester,
          detail: _completed(),
          results: <RaceResult>[_race(status: status)],
        );
        final GvPrimerStatusChip chip = tester.widget(
          _key('results-status-2026-belgian-grand-prix-race'),
        );
        expect((chip.label, chip.kind), (word, kind));
        expect(find.textContaining('†'), findsNothing);
      }
    });

    testWidgets('finish chips, fastest lap, no false zero (G-7)', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _completed(),
        results: <RaceResult>[
          _race(
            fastestLap: const FastestLap(driverId: 'oscar-piastri', lap: 40),
            entries: const <RaceResultEntry>[
              _max,
              _oscar,
              RaceResultEntry(
                driverId: 'lapped',
                constructorId: 'a',
                driverName: 'A Driver',
                constructorName: 'A Team',
                position: 15,
                status: FinishStatus.lapped,
                lapsBehind: 2,
              ),
              RaceResultEntry(
                driverId: 'dnf',
                constructorId: 'b',
                driverName: 'B Driver',
                constructorName: 'B Team',
                status: FinishStatus.dnf,
                dnfReason: 'Power unit',
              ),
              RaceResultEntry(
                driverId: 'unknown',
                constructorId: 'c',
                driverName: 'C Driver',
                constructorName: 'C Team',
                status: FinishStatus.unknown,
              ),
            ],
          ),
        ],
      );
      expect(
        _resultRow(tester, 'oscar-piastri').statuses,
        <GvPrimerStatusLabel>[
          const GvPrimerStatusLabel('Fastest lap', GvPrimerChipKind.fastestLap),
        ],
      );
      final GvPrimerResultRow lapped = _resultRow(tester, 'lapped');
      expect(lapped.timing, '+2 laps');
      expect(lapped.points, isNull);
      expect(lapped.statuses.single.kind, GvPrimerChipKind.known);
      final GvPrimerResultRow dnf = _resultRow(tester, 'dnf');
      expect(dnf.position, '—');
      expect((dnf.points, dnf.timing), (null, null));
      expect(dnf.statuses.single.label, 'DNF');
      expect(find.textContaining('Power unit'), findsNothing);
      expect(
        _resultRow(tester, 'unknown').statuses.single.kind,
        GvPrimerChipKind.unknown,
      );
      expect(find.text('0'), findsNothing);
    });

    testWidgets('delivered order; duplicates and missing positions kept', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _completed(),
        results: <RaceResult>[syntheticFullFieldRace()],
      );
      final List<GvPrimerResultRow> rows = tester
          .widgetList<GvPrimerResultRow>(find.byType(GvPrimerResultRow))
          .toList();
      expect(rows, hasLength(syntheticFullFieldSize));
      expect(rows.map((GvPrimerResultRow r) => r.position).take(18), <String>[
        for (int i = 1; i <= 13; i++) '$i',
        '14',
        '14',
        '16',
        '17',
        '18',
      ]);
      expect(rows.skip(18).map((GvPrimerResultRow r) => r.position), <String>[
        '—',
        '—',
        '—',
        '—',
        '—',
      ]);
      expect(rows.where((GvPrimerResultRow r) => r.winner), hasLength(1));
      expect(rows[3].points, '12.5');
      expect(rows[9].points, '0.5');
      expect(rows[10].points, isNull);
      expect(rows[17].timing, '+1 Lap'); // supplied text fallback
      expect(rows[11].driverName, 'Driver name unavailable');
      expect(rows[11].driverNameIsFallback, isTrue);
      expect(rows[12].teamName, 'Team name unavailable');
      expect(rows[12].teamSemanticLabel, 'Open team');
      expect(find.textContaining('synthetic-'), findsNothing);
    });

    testWidgets('Spanish: decimal comma, pts unit, Winner kicker', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        locale: const Locale('es'),
        detail: _completed(),
        results: <RaceResult>[_race()],
      );
      final GvPrimerResultRow oscar = _resultRow(tester, 'oscar-piastri');
      expect(oscar.points, '18,5');
      expect(oscar.pointsUnit, 'pts');
      expect(find.text('Resultados de la carrera'), findsOneWidget);
      expect(_resultRow(tester, 'max-verstappen').winnerLabel, isNotEmpty);
    });

    testWidgets('results states: unavailable, error with retry, loading', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester);
      expect(_key('gp-results-unavailable'), findsOneWidget);
      expect(
        tester.getSemantics(find.text('Results not available yet')),
        isSemantics(isHeader: true, isLiveRegion: true),
      );
      await _open(tester, detail: _completed(), refreshResults: _unavailable);
      expect(_key('gp-results-error'), findsOneWidget);
      expect(find.text("Can't load results"), findsOneWidget);
      expect(
        find.text('The service is temporarily unavailable.'),
        findsOneWidget,
      );
      expect(find.text('Try again'), findsOneWidget);
      // The weekend is untouched by the results failure.
      expect(_band, findsOneWidget);
      expect(_key('session-name'), findsNWidgets(5));
      handle.dispose();
    });
  });

  group('two-resource notices', () {
    final AppLocalizationsEn l10n = AppLocalizationsEn();
    GrandPrixReady ready({bool failed = false, bool stale = false}) =>
        GrandPrixReady(
          view: _detail(),
          freshness: stale ? FreshnessState.stale : FreshnessState.fresh,
          refreshError: failed
              ? const ApiFailure(kind: ApiFailureKind.networkUnavailable)
              : null,
        );
    GrandPrixResultsReady results({bool failed = false, bool stale = false}) =>
        GrandPrixResultsReady(
          documents: <RaceResult>[_race()],
          freshness: stale ? FreshnessState.stale : FreshnessState.fresh,
          refreshError: failed
              ? const ApiFailure(kind: ApiFailureKind.networkUnavailable)
              : null,
        );
    List<String> top(
      GrandPrixReady d,
      GrandPrixResultsState r, {
      bool remote = true,
    }) => grandPrixEventNotices(
      detail: d,
      results: r,
      remoteFreshness: remote,
      l10n: l10n,
    ).map((DetailNoticeSpec n) => n.message).toList();
    List<String> section(GrandPrixResultsReady r, {bool remote = true}) =>
        grandPrixResultsNotices(
          results: r,
          remoteFreshness: remote,
          l10n: l10n,
        ).map((DetailNoticeSpec n) => n.message).toList();

    test('event scope: N-1 order, N-2 only for the event itself', () {
      expect(top(ready(), results()), isEmpty);
      expect(top(ready(failed: true), results()), <String>[_failed]);
      expect(top(ready(stale: true), results()), <String>[_stale]);
      expect(top(ready(failed: true, stale: true), results()), <String>[
        _combined,
      ]);
      // Remote: results-only staleness is the top stale notice …
      expect(top(ready(), results(stale: true)), <String>[_stale]);
      // … and never combined with an event failure (unrelated resources).
      expect(top(ready(failed: true), results(stale: true)), <String>[
        _failed,
        _stale,
      ]);
      // Fixture build: the top never carries the results' staleness.
      expect(top(ready(), results(stale: true), remote: false), isEmpty);
      // Results not ready: no results staleness to carry.
      expect(top(ready(), const GrandPrixResultsLoading()), isEmpty);
    });

    test('results scope: own failure; own staleness only in fixtures', () {
      expect(section(results()), isEmpty);
      expect(section(results(failed: true)), <String>[_failed]);
      expect(section(results(stale: true)), isEmpty);
      expect(section(results(failed: true, stale: true)), <String>[_failed]);
      expect(section(results(stale: true), remote: false), <String>[_stale]);
      expect(
        section(results(failed: true, stale: true), remote: false),
        <String>[_combined],
      );
    });

    test('notice causes pick the VS-4 icons', () {
      final List<DetailNoticeSpec> specs = grandPrixEventNotices(
        detail: ready(failed: true),
        results: results(stale: true),
        remoteFreshness: true,
        l10n: l10n,
      );
      expect(specs.map((DetailNoticeSpec s) => s.cause), <GvPrimerNoticeCause>[
        GvPrimerNoticeCause.failure,
        GvPrimerNoticeCause.stale,
      ]);
    });

    testWidgets('event failure + event stale: one combined top notice', (
      WidgetTester tester,
    ) async {
      await _open(tester, metadata: _eventStale, refreshDetail: _offline);
      expect(_messages(tester, _key('gp-detail-notices')), <String>[_combined]);
      expect(_band, findsOneWidget);
      expect(_key('session-name'), findsNWidgets(5));
    });

    testWidgets('fixture build: results failure + stale combine in results', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        mockData: true,
        detail: _completed(),
        results: <RaceResult>[_race()],
        metadata: _resultsStale,
        refreshResults: _offline,
      );
      expect(_key('gp-detail-notices'), findsNothing);
      expect(_messages(tester, _key('gp-results-notices')), <String>[
        _combined,
      ]);
    });

    testWidgets('results notice sits under the status chip, above the rows', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _completed(),
        results: <RaceResult>[_race()],
        refreshResults: _offline,
      );
      final Finder notice = _key('gp-results-notices');
      expect(_messages(tester, notice), <String>[_failed]);
      final double chipBottom = tester
          .getBottomLeft(_key('results-status-2026-belgian-grand-prix-race'))
          .dy;
      expect(tester.getTopLeft(notice).dy, greaterThanOrEqualTo(chipBottom));
      expect(
        tester.getBottomLeft(notice).dy,
        lessThanOrEqualTo(tester.getTopLeft(_row('max-verstappen')).dy),
      );
      // The weekend stays, and the event has no notice of its own.
      expect(_key('gp-detail-notices'), findsNothing);
    });

    testWidgets('event failure + results failure stay separate', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _completed(),
        results: <RaceResult>[_race()],
        refreshDetail: _offline,
        refreshResults: _offline,
      );
      expect(_messages(tester, _key('gp-detail-notices')), <String>[_failed]);
      expect(_messages(tester, _key('gp-results-notices')), <String>[_failed]);
      expect(find.byType(GvPrimerResultRow), findsNWidgets(2));
    });

    testWidgets('remote: both stale → one stale notice at the top only', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        detail: _completed(),
        results: <RaceResult>[_race()],
        metadata: _allStale,
      );
      expect(_messages(tester), <String>[_stale]);
      expect(_key('gp-results-notices'), findsNothing);
      // A notice above the band gives the band its top hairline.
      expect(
        tester.getTopLeft(_key('gp-detail-notices')).dy,
        lessThan(tester.getTopLeft(_band).dy),
      );
    });

    testWidgets('fixture banner sits above the band', (
      WidgetTester tester,
    ) async {
      await _open(tester, mockData: true);
      expect(find.text('Sample data — not live results'), findsOneWidget);
    });
  });

  group('page states', () {
    testWidgets('loading: the detail skeleton, announced once', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _reset(tester);
      final Completer<RefreshResult> never = Completer<RefreshResult>();
      final GoRouter router = await pumpApp(
        tester,
        surfaceSize: const Size(390, 844),
        disableAnimations: true,
        syncMetadata: (String key) => null,
        repository: FakeRaceWeekendRepository(
          home: homeViewFixture(),
          calendar: (int season) => calendarFixture(season: season),
          grandPrix: (int s, int r) => null,
          onRefreshGrandPrix: (int s, int r) => never.future,
        ),
      );
      unawaited(router.push(_belgium));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(_key('gp-detail-skeleton'), findsOneWidget);
      // Home below never synced either; only this screen's region counts.
      expect(
        find.descendant(
          of: find.byType(GrandPrixDetailScreen),
          matching: find.bySemanticsLabel('Loading'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byType(PrimerDetailAppBar),
          matching: find.text('Grand Prix'),
        ),
        findsOneWidget,
      );
      never.complete(const RefreshSuccess());
      handle.dispose();
    });

    testWidgets('not found and first-load error announce their titles', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      for (final (ApiFailureKind kind, String key, String title)
          in <(ApiFailureKind, String, String)>[
            (ApiFailureKind.notFound, 'gp-not-found', 'Grand Prix not found'),
            (
              ApiFailureKind.serverUnavailable,
              'gp-first-load-error',
              "Can't load this Grand Prix",
            ),
          ]) {
        await _reset(tester);
        final GoRouter router = await pumpApp(
          tester,
          surfaceSize: const Size(390, 844),
          disableAnimations: true,
          syncMetadata: (String key) => null,
          repository: FakeRaceWeekendRepository(
            home: homeViewFixture(),
            calendar: (int season) => calendarFixture(season: season),
            grandPrix: (int s, int r) => null,
            onRefreshGrandPrix: (int s, int r) async =>
                RefreshFailure(ApiFailure(kind: kind)),
          ),
        );
        unawaited(router.push(_belgium));
        await tester.pumpAndSettle();
        expect(_key(key), findsOneWidget);
        expect(
          tester.getSemantics(find.text(title)),
          isSemantics(isHeader: true, isLiveRegion: true),
        );
      }
      handle.dispose();
    });
  });

  // Step 55C.16R (GPD-13): the page-state title and message are separate
  // semantics nodes, as on NotFoundScreen (DD NF-6). Before the boundary the
  // heading and live region carried "title\nmessage" as one label.
  group('page-state semantics (GPD-13)', () {
    final List<(String, AppLocalizations)> languages =
        <(String, AppLocalizations)>[
          ('en', AppLocalizationsEn()),
          ('es', AppLocalizationsEs()),
        ];
    const ApiFailure serverDown = ApiFailure(
      kind: ApiFailureKind.serverUnavailable,
    );

    for (final (String code, AppLocalizations l10n) in languages) {
      final List<(ApiFailureKind, String, String, String, String)> states =
          <(ApiFailureKind, String, String, String, String)>[
            (
              ApiFailureKind.notFound,
              'gp-not-found',
              l10n.grandPrixNotFoundTitle,
              l10n.grandPrixNotFoundMessage,
              l10n.notFoundGoHome,
            ),
            (
              ApiFailureKind.serverUnavailable,
              'gp-first-load-error',
              l10n.grandPrixErrorTitle,
              failureMessage(l10n, serverDown),
              l10n.retry,
            ),
          ];
      for (final (
            ApiFailureKind kind,
            String key,
            String title,
            String message,
            String action,
          )
          in states) {
        testWidgets('$code $key: heading is the title alone, the message is '
            'its own node, one live region, action unchanged', (
          WidgetTester tester,
        ) async {
          final SemanticsHandle handle = tester.ensureSemantics();
          await _reset(tester);
          final GoRouter router = await pumpApp(
            tester,
            surfaceSize: const Size(390, 844),
            locale: Locale(code),
            disableAnimations: true,
            syncMetadata: (String key) => null,
            repository: FakeRaceWeekendRepository(
              home: homeViewFixture(),
              calendar: (int season) => calendarFixture(season: season),
              grandPrix: (int s, int r) => null,
              onRefreshGrandPrix: (int s, int r) async =>
                  RefreshFailure(ApiFailure(kind: kind)),
            ),
          );
          unawaited(router.push(_belgium));
          await tester.pumpAndSettle();
          expect(_key(key), findsOneWidget);
          final Finder inState = find.descendant(
            of: _key(key),
            matching: find.text(title),
          );

          expect(
            tester.getSemantics(inState),
            isSemantics(isHeader: true, isLiveRegion: true, label: title),
          );
          expect(
            tester.getSemantics(
              find.descendant(of: _key(key), matching: find.text(message)),
            ),
            isSemantics(isHeader: false, isLiveRegion: false, label: message),
          );
          expect(_liveRegionLabels(tester), <String>[title]);
          // The button's label merges into its own node (the button's
          // container), so its visible text resolves to the button.
          expect(
            tester.getSemantics(
              find.descendant(of: _key(key), matching: find.text(action)),
            ),
            isSemantics(
              isButton: true,
              hasTapAction: true,
              isFocusable: true,
              label: action,
            ),
          );
          handle.dispose();
        });
      }

      testWidgets('$code section state is unchanged: its title stays the '
          'heading and the message its own node', (WidgetTester tester) async {
        final SemanticsHandle handle = tester.ensureSemantics();
        await _open(tester, locale: Locale(code));
        final Finder block = _key('gp-results-unavailable');
        expect(block, findsOneWidget);
        expect(
          tester.getSemantics(
            find.descendant(
              of: block,
              matching: find.text(l10n.grandPrixResultsUnavailableTitle),
            ),
          ),
          isSemantics(
            isHeader: true,
            isLiveRegion: true,
            label: l10n.grandPrixResultsUnavailableTitle,
          ),
        );
        expect(
          tester.getSemantics(
            find.descendant(
              of: block,
              matching: find.text(l10n.grandPrixResultsPending),
            ),
          ),
          isSemantics(
            isHeader: false,
            isLiveRegion: false,
            label: l10n.grandPrixResultsPending,
          ),
        );
        handle.dispose();
      });
    }
  });

  // Step 55C.12R (GPD-12): the team link hugs its text and chevron.
  group('team-link bounds (GPD-12)', () {
    const RaceResultEntry shortTeam = RaceResultEntry(
      driverId: 'short-team-driver',
      constructorId: 'rb',
      driverName: 'Synthetic Driver Short',
      // A one-letter synthetic name: its content is narrower than 48dp.
      constructorName: 'X',
      position: 3,
      points: 15,
      status: FinishStatus.finished,
    );
    const RaceResultEntry longTeam = RaceResultEntry(
      driverId: 'long-team-driver',
      constructorId: 'long-team',
      driverName: 'Synthetic Driver Long',
      constructorName:
          'Synthetic Extraordinarily Long Constructor Name Formula One Team',
      position: 4,
      points: 12,
      status: FinishStatus.finished,
    );
    RaceResult field() => _race(
      entries: const <RaceResultEntry>[_max, _oscar, shortTeam, longTeam],
    );

    Finder chevronTextIn(String id) => find.descendant(
      of: _row(id),
      matching: find.byType(GvPrimerTrailingChevronText),
    );
    Finder chevronIn(String id) => find.descendant(
      of: chevronTextIn(id),
      matching: find.byType(GvPrimerRowChevron),
    );

    /// The right edge of the name column: the row's start of values in the
    /// wide layout, the gutter in the narrow one.
    double columnRight(WidgetTester tester, String id) {
      final Rect row = tester.getRect(_row(id));
      final Finder values = find.descendant(
        of: _row(id),
        matching: find.byWidgetPredicate(
          (Widget w) => w is Text && (w.data?.startsWith('+') ?? false),
        ),
      );
      if (values.evaluate().isEmpty) return row.right - GvPrimerLayout.gutter;
      // Narrow layout: the values sit under the team link.
      if (tester.getRect(values.first).top >
          tester.getRect(_teamLink(id)).top) {
        return row.right - GvPrimerLayout.gutter;
      }
      return math.min(
        row.right - GvPrimerLayout.gutter,
        tester.getRect(values.first).left - GvPrimerResultRow.columnGap,
      );
    }

    for (final AppThemePreference theme in <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      for (final (String lang, Size size, double scale)
          in <(String, Size, double)>[
            ('en', const Size(390, 2600), 1),
            ('es', const Size(320, 6000), 2),
          ]) {
        testWidgets('${theme.name} $lang ${size.width.toInt()}@'
            '${(scale * 100).toInt()}%: bounds follow the content', (
          WidgetTester tester,
        ) async {
          await _open(
            tester,
            theme: theme,
            locale: Locale(lang),
            size: size,
            textScale: scale,
            detail: _completed(),
            results: <RaceResult>[field()],
          );
          for (final String id in <String>[
            'max-verstappen',
            'oscar-piastri',
            'short-team-driver',
            'long-team-driver',
          ]) {
            final Rect link = tester.getRect(_teamLink(id));
            final Rect text = tester.getRect(chevronTextIn(id));
            final Rect chevron = tester.getRect(chevronIn(id));
            // 8px padding either side of the content, nothing more…
            expect(link.left, closeTo(text.left - 8, 0.5), reason: id);
            expect(
              link.width,
              closeTo(math.max(text.width + 16, 48), 0.5),
              reason: id,
            );
            // … the chevron inside the content box …
            expect(chevron.right, lessThanOrEqualTo(text.right + 0.5));
            // … and the text keeps its measured lines: the paragraph is not
            // re-wrapped (and clipped) by the hugging box.
            final RenderParagraph paragraph = tester.renderObject(
              find
                  .descendant(
                    of: chevronTextIn(id),
                    matching: find.byType(RichText),
                  )
                  .first,
            );
            expect(
              paragraph.textSize.height,
              lessThanOrEqualTo(text.height + 0.5),
              reason: '$id re-wrapped',
            );
            // … never wider than the name column, at least 48 × 48.
            expect(
              link.right,
              lessThanOrEqualTo(columnRight(tester, id) + 8.5),
              reason: id,
            );
            expect(link.height, greaterThanOrEqualTo(48), reason: id);
            expect(link.width, greaterThanOrEqualTo(48), reason: id);
          }
          // A short name no longer fills the column.
          expect(
            tester.getRect(_teamLink('oscar-piastri')).right,
            lessThan(columnRight(tester, 'oscar-piastri') - 40),
          );
          // "X" keeps a full 48dp target width (at 200% its content is wider).
          if (scale == 1) {
            expect(tester.getSize(_teamLink('short-team-driver')).width, 48);
          }
          // The long name wraps inside the column (chevron on the last line).
          final Rect long = tester.getRect(chevronTextIn('long-team-driver'));
          expect(long.height, greaterThan(30));
          expect(tester.takeException(), isNull);
        });
      }
    }

    testWidgets('the ring is painted on the link bounds, 2px inside', (
      WidgetTester tester,
    ) async {
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
      addTearDown(
        () => FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.automatic,
      );
      for (final AppThemePreference theme in <AppThemePreference>[
        AppThemePreference.dark,
        AppThemePreference.light,
      ]) {
        await _open(
          tester,
          theme: theme,
          detail: _completed(),
          results: <RaceResult>[field()],
        );
        final Finder link = _teamLink('oscar-piastri');
        _nodeOf(tester, link).requestFocus();
        await tester.pumpAndSettle();
        final Finder ring = find
            .descendant(of: link, matching: find.byType(CustomPaint))
            .evaluate()
            .where(
              (Element e) =>
                  (e.widget as CustomPaint).foregroundPainter
                      is GvPrimerFocusRingPainter,
            )
            .map((Element e) => find.byWidget(e.widget))
            .first;
        final GvPrimerFocusRingPainter painter =
            tester.widget<CustomPaint>(ring).foregroundPainter!
                as GvPrimerFocusRingPainter;
        expect(painter.visible, isTrue);
        expect(painter.geometry, GvPrimerFocusGeometry.teamLink);
        expect(painter.geometry.offset, -2);
        expect(tester.getRect(ring), tester.getRect(link));
        expect(tester.getSize(link).width, lessThan(120));
      }
    });

    testWidgets('pointer: beside the link opens the driver, never the team', (
      WidgetTester tester,
    ) async {
      for (final (Size size, double scale) in <(Size, double)>[
        (const Size(390, 2600), 1),
        (const Size(320, 6000), 2),
      ]) {
        await _open(
          tester,
          size: size,
          textScale: scale,
          detail: _completed(),
          results: <RaceResult>[field()],
        );
        final Rect link = tester.getRect(_teamLink('oscar-piastri'));
        // 12px right of the link, on its line, still inside the name column.
        final Offset beside = Offset(link.right + 12, link.center.dy);
        expect(beside.dx, lessThan(columnRight(tester, 'oscar-piastri')));
        await tester.tapAt(beside);
        await tester.pumpAndSettle();
        expect(find.byType(DriverDetailScreen), findsOneWidget);
        expect(find.byType(ConstructorDetailScreen), findsNothing);
        expect(
          tester
              .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
              .driverId,
          'oscar-piastri',
        );

        await _open(
          tester,
          size: size,
          textScale: scale,
          detail: _completed(),
          results: <RaceResult>[field()],
        );
        // Every point of the link opens the team only: its edges and centre.
        final Rect fresh = tester.getRect(_teamLink('oscar-piastri'));
        await tester.tapAt(fresh.centerRight - const Offset(2, 0));
        await tester.pumpAndSettle();
        expect(find.byType(ConstructorDetailScreen), findsOneWidget);
        expect(find.byType(DriverDetailScreen), findsNothing);
      }
    });

    testWidgets('keyboard: row then link; Space and Enter on each', (
      WidgetTester tester,
    ) async {
      for (final (LogicalKeyboardKey key, bool team)
          in <(LogicalKeyboardKey, bool)>[
            (LogicalKeyboardKey.enter, false),
            (LogicalKeyboardKey.space, false),
            (LogicalKeyboardKey.enter, true),
            (LogicalKeyboardKey.space, true),
          ]) {
        await _open(
          tester,
          detail: _completed(),
          results: <RaceResult>[field()],
        );
        _nodeOf(tester, _row('oscar-piastri')).requestFocus();
        await tester.pump();
        if (team) {
          await tester.sendKeyEvent(LogicalKeyboardKey.tab);
          await tester.pump();
          expect(
            FocusManager.instance.primaryFocus,
            _nodeOf(tester, _teamLink('oscar-piastri')),
          );
        }
        await tester.sendKeyEvent(key);
        await tester.pumpAndSettle();
        expect(
          find.byType(ConstructorDetailScreen),
          team ? findsOneWidget : findsNothing,
          reason: '$key team=$team',
        );
        expect(
          find.byType(DriverDetailScreen),
          team ? findsNothing : findsOneWidget,
          reason: '$key team=$team',
        );
      }
    });

    testWidgets('accessible names unchanged', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _open(tester, detail: _completed(), results: <RaceResult>[field()]);
      expect(find.bySemanticsLabel('Open team McLaren'), findsOneWidget);
      expect(find.bySemanticsLabel('Open team X'), findsOneWidget);
      expect(
        find.bySemanticsLabel(
          '2, Oscar Piastri, McLaren, Finished, 18.5 Points, +4.120',
        ),
        findsOneWidget,
      );
      handle.dispose();
    });
  });

  group('interaction and focus (GPD-04, GPD-05)', () {
    testWidgets('driver row and team link: separate targets, independent '
        'activation, classification season', (WidgetTester tester) async {
      final GoRouter router = await _open(
        tester,
        detail: _completed(),
        results: <RaceResult>[_race()],
      );
      // Driver row: the name area opens the driver only.
      await tester.tap(find.text('Max Verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
      expect(find.byType(ConstructorDetailScreen), findsNothing);
      final DriverDetailScreen driver = tester.widget(
        find.byType(DriverDetailScreen),
      );
      expect((driver.driverId, driver.originSeason), ('max-verstappen', 2026));
      expect(router.canPop(), isTrue);

      await _open(tester, detail: _completed(), results: <RaceResult>[_race()]);
      await tester.tap(_teamLink('max-verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
      expect(find.byType(DriverDetailScreen), findsNothing);
      final ConstructorDetailScreen team = tester.widget(
        find.byType(ConstructorDetailScreen),
      );
      expect((team.constructorId, team.originSeason), ('red-bull', 2026));
    });

    testWidgets('48dp targets; no chevron on the driver row', (
      WidgetTester tester,
    ) async {
      await _open(tester, detail: _completed(), results: <RaceResult>[_race()]);
      for (final String id in <String>['max-verstappen', 'oscar-piastri']) {
        expect(tester.getSize(_row(id)).height, greaterThanOrEqualTo(48));
        expect(tester.getSize(_teamLink(id)).height, greaterThanOrEqualTo(48));
      }
      expect(tester.getSize(_back), const Size(48, 48));
      // Exactly one chevron per row: the team link's (GPD-04).
      expect(
        find.descendant(
          of: _row('oscar-piastri'),
          matching: find.byType(GvPrimerRowChevron),
        ),
        findsOneWidget,
      );
    });

    testWidgets('keyboard order: Back, circuit, then driver row → team link', (
      WidgetTester tester,
    ) async {
      await _open(tester, detail: _completed(), results: <RaceResult>[_race()]);
      _nodeOf(tester, _back).requestFocus();
      await tester.pump();
      final List<FocusNode> expected = <FocusNode>[
        _nodeOf(tester, _circuit),
        _nodeOf(tester, _row('max-verstappen')),
        _nodeOf(tester, _teamLink('max-verstappen')),
        _nodeOf(tester, _row('oscar-piastri')),
        _nodeOf(tester, _teamLink('oscar-piastri')),
      ];
      for (final FocusNode node in expected) {
        await tester.sendKeyEvent(LogicalKeyboardKey.tab);
        await tester.pump();
        expect(FocusManager.instance.primaryFocus, node);
      }
      // Enter on the focused team link opens the team only.
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
      expect(find.byType(DriverDetailScreen), findsNothing);
    });

    testWidgets('focus rings: circular Back per theme; team link 2px inside', (
      WidgetTester tester,
    ) async {
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
      addTearDown(
        () => FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.automatic,
      );
      for (final (AppThemePreference theme, double offset)
          in <(AppThemePreference, double)>[
            (AppThemePreference.dark, 3),
            (AppThemePreference.light, 1),
          ]) {
        await _open(
          tester,
          theme: theme,
          detail: _completed(),
          results: <RaceResult>[_race()],
        );
        final GvPrimerFocusTarget back = tester.widget(_back);
        expect(back.geometry.offset, offset);
        expect(back.geometry.radius, 24);
        expect(
          tester.widget<GvPrimerFocusTarget>(_circuit).geometry,
          GvPrimerFocusGeometry.row,
        );
        expect(
          tester
              .widget<GvPrimerFocusTarget>(_teamLink('max-verstappen'))
              .geometry,
          GvPrimerFocusGeometry.teamLink,
        );
        for (final Finder target in <Finder>[
          _back,
          _circuit,
          _teamLink('oscar-piastri'),
        ]) {
          _nodeOf(tester, target).requestFocus();
          await tester.pumpAndSettle();
          final CustomPaint ring = tester
              .widgetList<CustomPaint>(
                find.descendant(of: target, matching: find.byType(CustomPaint)),
              )
              .firstWhere(
                (CustomPaint p) =>
                    p.foregroundPainter is GvPrimerFocusRingPainter,
              );
          expect(
            (ring.foregroundPainter! as GvPrimerFocusRingPainter).visible,
            isTrue,
          );
        }
      }
    });

    testWidgets('full field: every row and team link reachable by keyboard', (
      WidgetTester tester,
    ) async {
      await _open(
        tester,
        size: const Size(390, 844),
        detail: _completed(),
        results: <RaceResult>[syntheticFullFieldRace()],
      );
      _nodeOf(tester, _back).requestFocus();
      await tester.pump();
      // Circuit row, then 23 × (row, team link).
      for (int i = 0; i < 1 + 2 * syntheticFullFieldSize; i++) {
        await tester.sendKeyEvent(LogicalKeyboardKey.tab);
        await tester.pumpAndSettle();
      }
      expect(
        FocusManager.instance.primaryFocus,
        _nodeOf(tester, _teamLink('synthetic-driver-23')),
      );
      // The focused last link was scrolled into view.
      final Rect last = tester.getRect(_teamLink('synthetic-driver-23'));
      expect(last.bottom, lessThanOrEqualTo(844));
      expect(last.top, greaterThanOrEqualTo(0));
    });
  });

  group('responsive and text scale', () {
    for (final AppThemePreference theme in <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      for (final Locale locale in <Locale>[
        const Locale('en'),
        const Locale('es'),
      ]) {
        for (final (Size size, double scale) in <(Size, double)>[
          (const Size(390, 6000), 1),
          (const Size(320, 9000), 2),
        ]) {
          testWidgets('${theme.name} ${locale.languageCode} '
              '${size.width.toInt()}@${(scale * 100).toInt()}%: no overflow', (
            WidgetTester tester,
          ) async {
            await _open(
              tester,
              theme: theme,
              locale: locale,
              size: size,
              textScale: scale,
              time: TimeDisplayPreference.both,
              detail: _detail(
                status: EventStatus.completed,
                hasResults: true,
                name:
                    'Synthetic Extraordinarily Long Grand Prix Name of '
                    'the Twenty-Sixth Round',
                officialName:
                    'Synthetic Formula 1 Very Long Official Grand Prix '
                    'Title Sponsored by Several Companies 2026',
              ),
              results: <RaceResult>[syntheticFullFieldRace()],
            );
            expect(tester.takeException(), isNull);
            expect(
              find.byType(GvPrimerResultRow),
              findsNWidgets(syntheticFullFieldSize),
            );
            // The heading is never truncated; the app bar keeps one line.
            final Text heading = tester.widget(_key('gp-band-name'));
            expect(heading.maxLines, isNull);
            expect(heading.overflow, isNull);
            final double width = tester.getSize(_band).width;
            expect(width, size.width);
          });
        }
      }
    }

    test('container thresholds', () {
      const TextScaler one = TextScaler.noScaling;
      final TextScaler two = const TextScaler.linear(2);
      // Band: 20em of 15px body text (300 at 100%).
      expect(GrandPrixBand.isNarrow(358, one), isFalse);
      expect(GrandPrixBand.isNarrow(288, one), isTrue);
      expect(GrandPrixBand.isNarrow(358, two), isTrue);
      // Schedule: 22em (330 at 100%), on the full width.
      expect(GrandPrixSchedule.isNarrow(390, one), isFalse);
      expect(GrandPrixSchedule.isNarrow(320, one), isTrue);
      expect(GrandPrixSchedule.timeColumn(one), 120);
    });
  });
}
