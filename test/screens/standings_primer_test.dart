import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/preferences/preferences_providers.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';
import 'package:gridview/features/standings/presentation/widgets/standings_header.dart';
import 'package:gridview/features/standings/presentation/widgets/standings_table.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';
import 'package:intl/intl.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/primer_fonts.dart';
import '../support/reachability.dart';
import '../support/router_harness.dart';

/// Step 55C.5: the Primer V2 Standings — leader card and ranking rows, the
/// provisional and unranked treatments, the resource-scoped freshness caption
/// and notices (PD-03 / STD-01, N-1, N-2, VS-4), the pinned header and the
/// scrolling status, large text, keyboard, themes and the team tick.
/// Behaviour already covered by `standings_widget_test.dart` (selection,
/// independent offsets, detail round trips, deep links, refresh routing) is
/// not repeated.

/// Before the clock the harness pins (2026-07-18 12:10Z): a stale resource.
final DateTime _past = DateTime.utc(2026, 7, 18, 11);
final DateTime _driversCheck = DateTime.utc(2026, 7, 18, 9, 5);
final DateTime _constructorsCheck = DateTime.utc(2026, 7, 18, 11, 45);

String _time(DateTime instant, [String lang = 'en']) =>
    DateFormat.Hm(lang).format(instant.toLocal());

Future<void> _pump(
  WidgetTester tester, {
  String location = '/standings',
  Size surfaceSize = const Size(400, 1600),
  Locale locale = const Locale('en'),
  double textScale = 1,
  AppThemePreference theme = AppThemePreference.dark,
  List<DriverStandingEntry> Function(int season)? drivers,
  List<ConstructorStandingEntry> Function(int season)? constructors,
  ResourceSyncState? Function(String key)? metadata,
}) => pumpApp(
  tester,
  initialLocation: location,
  surfaceSize: surfaceSize,
  locale: locale,
  textScale: textScale,
  disableAnimations: true,
  preferences: AppPreferences.defaults.copyWith(theme: theme),
  syncMetadata: metadata,
  standings: FakeStandingsRepository(
    drivers: drivers ?? (int season) => driverStandingsFixture(),
    constructors: constructors ?? (int season) => constructorStandingsFixture(),
  ),
);

/// Each table's own check time; nothing stale.
ResourceSyncState? _ownTimes(String key) => switch (key) {
  'standings:drivers:2026' => syncedMetadata(key, lastSuccessAt: _driversCheck),
  'standings:constructors:2026' => syncedMetadata(
    key,
    lastSuccessAt: _constructorsCheck,
  ),
  _ => syncedMetadata(key),
};

Future<void> _publish(WidgetTester tester, AppSyncState state) async {
  containerOf(tester).read(appSyncStateProvider.notifier).publish(state);
  await tester.pumpAndSettle();
}

Future<void> _fail(WidgetTester tester, String key) => _publish(
  tester,
  AppSyncCompleted(
    trigger: SyncTrigger.manual,
    outcomes: <ResourceSyncOutcome>[
      ResourceSyncOutcome(
        resourceKey: key,
        kind: ResourceSyncOutcomeKind.failed,
        failure: ApiFailureKind.networkUnavailable,
      ),
    ],
  ),
);

Finder _segment(String label) => find.descendant(
  of: find.byType(GvPrimerSegmentedControl),
  matching: find.descendant(
    of: find.byType(GvPrimerFocusTarget),
    matching: find.text(label),
  ),
);

FocusNode _nodeOf(WidgetTester tester, Finder target) => Focus.of(
  tester.element(
    find.descendant(of: target, matching: find.byType(GestureDetector)).first,
  ),
);

Finder get _list => find
    .descendant(
      of: find.byType(StandingsScreen),
      matching: find.byType(Scrollable),
    )
    .last;

List<GvPrimerStandingsRow> _rows(WidgetTester tester) => tester
    .widgetList<GvPrimerStandingsRow>(find.byType(GvPrimerStandingsRow))
    .toList();

List<GvPrimerNotice> _notices(WidgetTester tester) =>
    tester.widgetList<GvPrimerNotice>(find.byType(GvPrimerNotice)).toList();

/// Labels under [node] in screen-reader traversal order.
List<String> _traversal(SemanticsNode node) => <String>[
  if (node.label.isNotEmpty) node.label,
  for (final SemanticsNode child in node.debugListChildrenInOrder(
    DebugSemanticsDumpOrder.traversalOrder,
  ))
    ..._traversal(child),
];

List<DriverStandingEntry> _tied(int season) => <DriverStandingEntry>[
  for (final (int i, String name) in <String>['Tied A', 'Tied B'].indexed)
    driverStandingEntry(
      order: i,
      position: 1,
      driverId: 'tied-$i',
      driverName: name,
      constructorName: 'Team $i',
      points: 100,
      wins: 2,
    ),
  driverStandingEntry(
    order: 2,
    position: 3,
    driverId: 'third',
    driverName: 'Third Driver',
    points: 80.5,
    wins: 0,
  ),
];

void main() {
  group('ranking rows (S-5, RK-1, RK-4)', () {
    testWidgets('a confirmed position 1 is the one leader card, with the '
        'visible kicker and the points unit', (WidgetTester tester) async {
      await _pump(tester);
      final List<GvPrimerStandingsRow> rows = _rows(tester);
      final List<GvPrimerStandingsRow> leaders = rows
          .where((GvPrimerStandingsRow r) => r.leaderLabel != null)
          .toList();
      expect(leaders, hasLength(1));
      expect(leaders.single.name, 'Max Verstappen');
      expect(leaders.single.leaderLabel, 'Championship leader');
      expect(leaders.single.pointsUnit, 'pts');
      expect(find.text('Championship leader'), findsOneWidget);
      // Ordinary rows: no unit, and no hairline directly under the card.
      final GvPrimerStandingsRow second = rows[1];
      expect(second.pointsUnit, isNull);
      expect(second.dividerAbove, isFalse);
      expect(rows[2].dividerAbove, isTrue);
    });

    testWidgets('tied leaders: both cards say tied, positions stay '
        'duplicated, the second follows the first', (
      WidgetTester tester,
    ) async {
      await _pump(tester, drivers: _tied);
      final List<GvPrimerStandingsRow> rows = _rows(tester);
      expect(rows.map((GvPrimerStandingsRow r) => r.position), <String>[
        '1',
        '1',
        '3',
      ]);
      expect(rows[0].leaderLabel, 'Tied for the championship lead');
      expect(rows[1].leaderLabel, 'Tied for the championship lead');
      expect(rows[0].followsLeader, isFalse);
      expect(rows[1].followsLeader, isTrue);
      expect(rows[2].leaderLabel, isNull);
      expect(rows[2].dividerAbove, isFalse);
      expect(find.text('Tied for the championship lead'), findsNWidgets(2));
      expect(find.text('Championship leader'), findsNothing);
      expect(
        find.bySemanticsLabel(RegExp('Tied A.*Tied for the championship lead')),
        findsOneWidget,
      );
    });

    testWidgets('no confirmed position 1: no leader is manufactured', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        drivers: (int season) => <DriverStandingEntry>[
          driverStandingEntry(
            order: 0,
            driverId: 'unranked',
            driverName: 'Unranked Top',
            points: 999,
          ),
          driverStandingEntry(
            order: 1,
            position: 2,
            driverId: 'second',
            driverName: 'Second Place',
            points: 10,
          ),
        ],
      );
      expect(
        _rows(tester).where((GvPrimerStandingsRow r) => r.leaderLabel != null),
        isEmpty,
      );
      expect(find.textContaining('leader'), findsNothing);
      expect(_rows(tester).first.position, '—');
    });

    testWidgets('points: fractions, a confirmed zero, and missing wins '
        'omitted', (WidgetTester tester) async {
      await _pump(
        tester,
        constructors: (int season) => <ConstructorStandingEntry>[
          constructorStandingEntry(
            order: 0,
            position: 1,
            constructorId: 'a',
            seasonName: 'Alpha Team',
            points: 0.5,
          ),
          constructorStandingEntry(
            order: 1,
            position: 2,
            constructorId: 'b',
            seasonName: 'Beta Team',
            points: 0,
            wins: 0,
          ),
        ],
      );
      final List<GvPrimerStandingsRow> drivers = _rows(tester);
      expect(drivers[1].points, '232.5');
      expect(drivers[3].points, '0');
      expect(drivers[3].details, <String>['Alpine', '0 wins']);
      // The reserve entrant: no team, no wins, nothing invented.
      expect(drivers[4].details, isEmpty);

      await tester.tap(_segment('Constructors'));
      await tester.pumpAndSettle();
      final List<GvPrimerStandingsRow> teams = _rows(tester);
      expect(teams[0].points, '0.5');
      expect(teams[0].details, isEmpty, reason: 'wins not supplied');
      expect(teams[1].points, '0');
      expect(teams[1].details, <String>['0 wins']);
    });

    testWidgets('Spanish: decimal comma, plural wins, unranked "Sin '
        'clasificar" (RK-1)', (WidgetTester tester) async {
      await _pump(tester, locale: const Locale('es'));
      final List<GvPrimerStandingsRow> rows = _rows(tester);
      expect(rows[1].points, '232,5');
      expect(rows[0].details, <String>['Red Bull Racing', '6 victorias']);
      expect(rows[0].leaderLabel, 'Líder del campeonato');
      expect(rows[0].pointsUnit, 'pts');
      expect(
        find.bySemanticsLabel(RegExp(r'^Sin clasificar, Reserve Entrant, ')),
        findsOneWidget,
      );
      expect(find.bySemanticsLabel(RegExp('no disponible,')), findsNothing);
    });
  });

  group('provisional (ST15, VS-3)', () {
    List<DriverStandingEntry> provisional({required bool mixed}) =>
        <DriverStandingEntry>[
          driverStandingEntry(
            order: 0,
            position: 1,
            driverId: 'a',
            driverName: 'Row A',
            points: 10,
            provisional: true,
          ),
          driverStandingEntry(
            order: 1,
            position: 2,
            driverId: 'b',
            driverName: 'Row B',
            points: 5,
            provisional: !mixed,
          ),
        ];

    testWidgets('every row agrees: one whole-table caption, no row chip', (
      WidgetTester tester,
    ) async {
      await _pump(tester, drivers: (int s) => provisional(mixed: false));
      expect(
        find.byKey(const ValueKey<String>('standings-provisional')),
        findsOneWidget,
      );
      expect(find.byType(GvPrimerStatusChip), findsNothing);
    });

    testWidgets('rows disagree: only the provisional row has the compact '
        'word-only marker', (WidgetTester tester) async {
      await _pump(tester, drivers: (int s) => provisional(mixed: true));
      expect(
        find.byKey(const ValueKey<String>('standings-provisional')),
        findsNothing,
      );
      final List<GvPrimerStandingsRow> rows = _rows(tester);
      expect(rows[0].statuses, const <GvPrimerStatusLabel>[
        GvPrimerStatusLabel('Provisional', GvPrimerChipKind.known),
      ]);
      expect(rows[1].statuses, isEmpty);
      final GvPrimerStatusChip chip = tester.widget(
        find.byType(GvPrimerStatusChip),
      );
      expect(chip.label, 'Provisional', reason: 'no dagger (VS-3)');
      expect(chip.size, GvPrimerChipSize.small);
    });
  });

  group('freshness caption (PD-03 / STD-01)', () {
    testWidgets("each table shows only its own resource's check time", (
      WidgetTester tester,
    ) async {
      await _pump(tester, metadata: _ownTimes);
      Text caption() => tester.widget<Text>(
        find.byKey(const ValueKey<String>('standings-freshness')),
      );
      expect(caption().data, 'Last successful check: ${_time(_driversCheck)}');
      await tester.tap(_segment('Constructors'));
      await tester.pumpAndSettle();
      expect(
        caption().data,
        'Last successful check: ${_time(_constructorsCheck)}',
      );
    });

    testWidgets("never Home's or bootstrap's time: a bootstrap-materialized "
        'table shows no caption', (WidgetTester tester) async {
      await _pump(
        tester,
        metadata: (String key) => key.startsWith('standings:')
            ? null
            : syncedMetadata(key, lastSuccessAt: DateTime.utc(2026, 7, 18, 4)),
      );
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('standings-freshness')),
        findsNothing,
      );
      expect(find.textContaining('Last successful check'), findsNothing);
    });

    testWidgets('while refreshing, "Refreshing…" replaces the time', (
      WidgetTester tester,
    ) async {
      await _pump(tester, metadata: _ownTimes);
      await _publish(tester, const AppSyncRunning(trigger: SyncTrigger.manual));
      expect(
        tester
            .widget<Text>(
              find.byKey(const ValueKey<String>('standings-freshness')),
            )
            .data,
        'Refreshing…',
      );
      expect(find.textContaining('Last successful check'), findsNothing);
      // Cached rows stay below.
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(find.byType(GvPrimerSkeleton), findsNothing);
    });

    testWidgets('a failed refresh keeps the previous successful time and the '
        'rows', (WidgetTester tester) async {
      await _pump(tester, metadata: _ownTimes);
      await _fail(tester, 'standings:drivers:2026');
      expect(
        find.text('Last successful check: ${_time(_driversCheck)}'),
        findsOneWidget,
      );
      expect(find.text('Max Verstappen'), findsOneWidget);
    });
  });

  group('notices (N-1, N-2, VS-4)', () {
    testWidgets('failure alone: the existing alert notice', (
      WidgetTester tester,
    ) async {
      await _pump(tester, metadata: _ownTimes);
      await _fail(tester, 'standings:drivers:2026');
      final List<GvPrimerNotice> notices = _notices(tester);
      expect(notices, hasLength(1));
      expect(notices.single.cause, GvPrimerNoticeCause.failure);
      expect(notices.single.message, "Couldn't refresh — showing saved data.");
    });

    testWidgets('stale alone: the existing clock notice', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        metadata: (String key) => syncedMetadata(key, staleAfter: _past),
      );
      final List<GvPrimerNotice> notices = _notices(tester);
      expect(notices, hasLength(1));
      expect(notices.single.cause, GvPrimerNoticeCause.stale);
      expect(
        notices.single.message,
        'This data may be out of date — showing the last saved version.',
      );
    });

    for (final (Locale locale, String wording) in const <(Locale, String)>[
      (Locale('en'), "Couldn't refresh. Saved data may be out of date."),
      (
        Locale('es'),
        'No se pudo actualizar. Los datos guardados pueden estar '
            'desactualizados.',
      ),
    ]) {
      testWidgets('${locale.languageCode}: failure + stale of the same table '
          'is one combined notice', (WidgetTester tester) async {
        await _pump(
          tester,
          locale: locale,
          metadata: (String key) => syncedMetadata(key, staleAfter: _past),
        );
        await _fail(tester, 'standings:drivers:2026');
        final List<GvPrimerNotice> notices = _notices(tester);
        expect(notices, hasLength(1));
        expect(notices.single.cause, GvPrimerNoticeCause.failure);
        expect(notices.single.message, wording);
      });
    }

    testWidgets("the other championship's failure never reaches this table", (
      WidgetTester tester,
    ) async {
      await _pump(tester, metadata: _ownTimes);
      await _fail(tester, 'standings:constructors:2026');
      expect(_notices(tester), isEmpty);
      await tester.tap(_segment('Constructors'));
      await tester.pumpAndSettle();
      expect(_notices(tester), hasLength(1));
      expect(_notices(tester).single.cause, GvPrimerNoticeCause.failure);
    });

    testWidgets('an unrelated core failure is not a Standings notice', (
      WidgetTester tester,
    ) async {
      await _pump(tester, metadata: _ownTimes);
      await _fail(tester, 'calendar:2026');
      expect(_notices(tester), isEmpty);
    });
  });

  group('pinned header and scrolling status', () {
    List<DriverStandingEntry> grid(int season) => <DriverStandingEntry>[
      for (int i = 0; i < 20; i++)
        driverStandingEntry(
          order: i,
          position: i + 1,
          driverId: 'd$i',
          driverName: 'Driver ${i + 1}',
          points: (20 - i) * 10.0,
        ),
    ];

    testWidgets('title, season and selector stay pinned; the caption and '
        'notice scroll with the rows', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _pump(
        tester,
        surfaceSize: const Size(390, 844),
        drivers: grid,
        metadata: (String key) => syncedMetadata(
          key,
          lastSuccessAt: _driversCheck,
          staleAfter: _past,
        ),
      );
      final Rect header = tester.getRect(find.byType(StandingsHeader));
      final Rect status = tester.getRect(
        find.byKey(const ValueKey<String>('standings-status')),
      );
      expect(status.top, greaterThanOrEqualTo(header.bottom));

      await tester.drag(_list, const Offset(0, -400));
      await tester.pumpAndSettle();
      expect(tester.getRect(find.byType(StandingsHeader)), header);
      expect(find.text('2026 season'), findsOneWidget);
      expect(find.byType(GvPrimerSegmentedControl), findsOneWidget);
      final Finder now = find.byKey(const ValueKey<String>('standings-status'));
      expect(
        now.evaluate().isEmpty || tester.getRect(now).top < status.top,
        isTrue,
        reason: 'the status block moves with the rows',
      );
    });

    testWidgets('a background failure while scrolled keeps the offset', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        surfaceSize: const Size(390, 700),
        drivers: grid,
        metadata: _ownTimes,
      );
      await tester.drag(_list, const Offset(0, -500));
      await tester.pumpAndSettle();
      final double before = tester
          .state<ScrollableState>(_list)
          .position
          .pixels;
      expect(before, greaterThan(0));
      await _fail(tester, 'standings:drivers:2026');
      expect(
        tester.state<ScrollableState>(_list).position.pixels,
        greaterThan(0),
        reason: 'never reset to the top',
      );
    });

    testWidgets('header reading order: title, Refresh, Settings, season, '
        'then the Championship selector', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pump(tester);
      final List<String> labels = _traversal(
        tester.getSemantics(find.byType(StandingsHeader)),
      );
      final List<int> at = <String>[
        'Standings',
        'Refresh standings',
        'Open settings',
        '2026 season',
        'Championship',
        'Drivers',
        'Constructors',
      ].map(labels.indexOf).toList();
      expect(at.every((int i) => i >= 0), isTrue, reason: '$labels');
      for (int i = 1; i < at.length; i++) {
        expect(at[i], greaterThan(at[i - 1]), reason: '$labels');
      }
      handle.dispose();
    });
  });

  group('large text (320×693 @200%)', () {
    for (final (Locale locale, String drivers, String constructors)
        in const <(Locale, String, String)>[
          (Locale('en'), 'Drivers', 'Constructors'),
          (Locale('es'), 'Pilotos', 'Constructores'),
        ]) {
      testWidgets('${locale.languageCode}: the pinned header stays a third of '
          'the screen; every row is reachable in an unobstructed list; the '
          'selector stacks with 48dp options', (WidgetTester tester) async {
        await loadArchivo(tester);
        await _pump(
          tester,
          surfaceSize: const Size(320, 693),
          locale: locale,
          textScale: 2,
          metadata: (String key) => syncedMetadata(
            key,
            lastSuccessAt: _driversCheck,
            staleAfter: _past,
          ),
        );
        await _fail(tester, 'standings:drivers:2026');
        expect(tester.takeException(), isNull);
        final double header = tester
            .getSize(find.byType(StandingsHeader))
            .height;
        // Measured 235px (33.9%); the status block is not part of it.
        expect(header / 693, lessThan(0.40));
        // Step 55C.15R (owner decision D1): the approved 2 × 2 navigation
        // (155px at 320 @200%, the legacy pill was 89px) leaves the list
        // 303px, 43.7% of the screen, where the old test asked for 50%. The
        // share was only a proxy; this checks the contract it stood for: an
        // unobstructed list viewport in which every row, the last included,
        // can be scrolled whole into view and still takes a tap there.
        final Finder nav = find.byType(GvPrimerBottomNav);
        final Finder pinned = find.byType(StandingsHeader);
        final Rect list = tester.getRect(_list);
        expect(list.top, greaterThanOrEqualTo(tester.getRect(pinned).bottom));
        expect(list.bottom, lessThanOrEqualTo(tester.getRect(nav).top));
        final List<String> names = <String>[
          for (final DriverStandingEntry e in driverStandingsFixture())
            if (e.driverName != null) e.driverName!,
        ];
        expect(names, isNotEmpty);
        for (final String driver in names) {
          final Finder row = find.ancestor(
            of: find.text(driver),
            matching: find.byType(GvPrimerStandingsRow),
          );
          if (row.evaluate().isEmpty) {
            await tester.scrollUntilVisible(
              find.text(driver),
              120,
              scrollable: _list,
            );
          }
          await expectReachable(
            tester,
            target: row.first,
            scrollable: _list,
            header: pinned,
            navigation: nav,
            reason: driver,
          );
          // Standard rows fit whole. The leader card (316px English, 352px
          // Spanish) is taller than the 303px list at this size; it is
          // checked above line by line instead, and takes a tap.
          if (tester.widget<GvPrimerStandingsRow>(row.first).leaderLabel !=
              null) {
            continue;
          }
          expect(
            tester.getSize(row.first).height,
            lessThanOrEqualTo(
              visibleListArea(
                tester,
                scrollable: _list,
                header: pinned,
                navigation: nav,
              ).height,
            ),
            reason: driver,
          );
        }
        await scrollToEnd(tester, _list);
        final Rect lastRow = tester.getRect(
          find.byType(GvPrimerStandingsRow).last,
        );
        expect(lastRow.bottom, lessThanOrEqualTo(tester.getRect(nav).top));
        expect(tester.takeException(), isNull);

        final Rect a = tester.getRect(
          find.ancestor(
            of: _segment(drivers),
            matching: find.byType(GvPrimerFocusTarget),
          ),
        );
        final Rect b = tester.getRect(
          find.ancestor(
            of: _segment(constructors),
            matching: find.byType(GvPrimerFocusTarget),
          ),
        );
        expect(b.top, greaterThanOrEqualTo(a.bottom), reason: 'stacked');
        for (final Rect r in <Rect>[a, b]) {
          expect(r.height, greaterThanOrEqualTo(48));
          expect(r.width, greaterThanOrEqualTo(48));
        }
      });

      testWidgets('${locale.languageCode}: tied leaders and long names are '
          'whole, never clipped or ellipsized', (WidgetTester tester) async {
        await loadArchivo(tester);
        await _pump(
          tester,
          surfaceSize: const Size(320, 6000),
          locale: locale,
          textScale: 2,
          drivers: (int season) => <DriverStandingEntry>[
            ..._tied(season),
            driverStandingEntry(
              order: 3,
              position: 4,
              driverId: 'long',
              // Layout test data, not a result.
              driverName: 'Maximiliano Alessandro Villanueva-Hernández',
              constructorName: 'Oracle Red Bull Racing',
              points: 1234.5,
              wins: 12,
            ),
          ],
          metadata: (String key) => syncedMetadata(
            key,
            lastSuccessAt: _driversCheck,
            staleAfter: _past,
          ),
        );
        await _fail(tester, 'standings:drivers:2026');
        expect(tester.takeException(), isNull);
        for (final RenderParagraph p
            in tester.renderObjectList<RenderParagraph>(
              find.descendant(
                of: find.byType(StandingsScreen),
                matching: find.byType(RichText),
              ),
            )) {
          final String text = p.text.toPlainText();
          expect(p.overflow, isNot(TextOverflow.ellipsis), reason: text);
          final double need = p.softWrap
              ? p.getMinIntrinsicWidth(double.infinity)
              : p.getMaxIntrinsicWidth(double.infinity);
          expect(
            need,
            lessThanOrEqualTo(p.size.width + 0.5),
            reason: '"$text" is clipped',
          );
          expect(p.didExceedMaxLines, isFalse, reason: text);
        }
        final String kicker = locale.languageCode == 'es'
            ? 'Empatado en el liderato del campeonato'
            : 'Tied for the championship lead';
        expect(find.text(kicker), findsNWidgets(2));
      });
    }
  });

  group('keyboard', () {
    testWidgets('Tab moves between the options; Enter selects Constructors', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pump(tester);
      final Finder driversTarget = find.ancestor(
        of: _segment('Drivers'),
        matching: find.byType(GvPrimerFocusTarget),
      );
      final Finder constructorsTarget = find.ancestor(
        of: _segment('Constructors'),
        matching: find.byType(GvPrimerFocusTarget),
      );
      _nodeOf(tester, driversTarget).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(
        FocusManager.instance.primaryFocus,
        _nodeOf(tester, constructorsTarget),
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.text('McLaren Formula 1 Team'), findsOneWidget);
      expect(
        tester.getSemantics(find.bySemanticsLabel('Constructors').first),
        isSemantics(isSelected: true, isButton: true),
      );
      handle.dispose();
    });

    testWidgets('Enter on a focused ranking row opens the driver', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      final Finder leader = find.descendant(
        of: find.byKey(
          const ValueKey<String>('driver-standing-max-verstappen'),
        ),
        matching: find.byType(GvPrimerFocusTarget),
      );
      _nodeOf(tester, leader.first).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
            .driverId,
        'max-verstappen',
      );
    });

    testWidgets('Space on a focused constructor row opens the constructor', (
      WidgetTester tester,
    ) async {
      await _pump(tester, location: '/standings/constructors/2026');
      final Finder row = find.descendant(
        of: find.byKey(const ValueKey<String>('constructor-standing-ferrari')),
        matching: find.byType(GvPrimerFocusTarget),
      );
      _nodeOf(tester, row.first).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<ConstructorDetailScreen>(
              find.byType(ConstructorDetailScreen),
            )
            .constructorId,
        'ferrari',
      );
    });
  });

  group('themes', () {
    for (final (AppThemePreference pref, GvPrimerRoles roles)
        in <(AppThemePreference, GvPrimerRoles)>[
          (AppThemePreference.dark, GvPrimerRoles.dark),
          (AppThemePreference.light, GvPrimerRoles.light),
        ]) {
      testWidgets('${pref.wire}: page, opaque header and the inverse leader '
          'plane', (WidgetTester tester) async {
        await _pump(tester, theme: pref);
        final Scaffold scaffold = tester.widget<Scaffold>(
          find
              .descendant(
                of: find.byType(StandingsScreen),
                matching: find.byType(Scaffold),
              )
              .first,
        );
        expect(scaffold.backgroundColor, roles.surface.page);
        final ColoredBox header = tester.widget<ColoredBox>(
          find
              .descendant(
                of: find.byType(StandingsHeader),
                matching: find.byType(ColoredBox),
              )
              .first,
        );
        expect(header.color, roles.surface.page);
        final LinearGradient plane = _leaderGradient(tester)! as LinearGradient;
        final LinearGradient expected = roles.surface.inverse.toGradient();
        expect(plane.colors, expected.colors);
        expect(plane.stops, expected.stops);
      });
    }

    testWidgets('switching Dark → Light at runtime keeps the selection and '
        'the offset', (WidgetTester tester) async {
      await _pump(
        tester,
        surfaceSize: const Size(390, 700),
        location: '/standings',
        constructors: (int season) => <ConstructorStandingEntry>[
          for (int i = 0; i < 12; i++)
            constructorStandingEntry(
              order: i,
              position: i + 1,
              constructorId: 'c$i',
              seasonName: 'Team ${i + 1}',
              points: (12 - i) * 10.0,
            ),
        ],
      );
      await tester.tap(_segment('Constructors'));
      await tester.pumpAndSettle();
      await tester.drag(_list, const Offset(0, -200));
      await tester.pumpAndSettle();
      final double before = tester
          .state<ScrollableState>(_list)
          .position
          .pixels;
      expect(before, greaterThan(0));

      await containerOf(tester)
          .read(appPreferencesProvider.notifier)
          .setTheme(AppThemePreference.light);
      await tester.pumpAndSettle();
      final Scaffold scaffold = tester.widget<Scaffold>(
        find
            .descendant(
              of: find.byType(StandingsScreen),
              matching: find.byType(Scaffold),
            )
            .first,
      );
      expect(scaffold.backgroundColor, GvPrimerRoles.light.surface.page);
      // Still the Constructors table.
      expect(find.textContaining(RegExp(r'^Team \d+$')), findsWidgets);
      expect(find.text('Max Verstappen'), findsNothing);
      expect(
        tester.state<ScrollableState>(_list).position.pixels,
        closeTo(before, 0.5),
      );
    });
  });

  group('team tick (ST08 / ST13, XT-3)', () {
    testWidgets('drawn only with a supplied colour, unchanged, decorative', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pump(tester);
      final List<GvPrimerTeamMark> marks = tester
          .widgetList<GvPrimerTeamMark>(find.byType(GvPrimerTeamMark))
          .toList();
      // Verstappen, Norris, Leclerc carry colours; Colapinto and the reserve
      // entrant do not.
      expect(marks.map((GvPrimerTeamMark m) => m.color), <Color>[
        const Color(0xFF1E41FF),
        const Color(0xFFFF8000),
        const Color(0xFFE8002D),
      ]);
      expect(
        marks.every((GvPrimerTeamMark m) => m.shape == GvPrimerTeamShape.tick),
        isTrue,
      );
      expect(
        find.byKey(const ValueKey<String>('standings-tick-franco-colapinto')),
        findsNothing,
      );
      // The rows' accessible names are unchanged by the tick.
      expect(
        find.bySemanticsLabel(
          'Position 2, Lando Norris, McLaren, 232.5 points, 5 wins',
        ),
        findsOneWidget,
      );
      // Fixed tick length (40), not stretched to the row.
      expect(
        tester.getSize(find.byType(GvPrimerTeamMark).at(1)).height,
        StandingsRankRow.tickLength,
      );
      handle.dispose();
    });

    testWidgets('the 1px boundary appears only below 3:1 on the surface it '
        'sits on', (WidgetTester tester) async {
      await _pump(tester);
      final List<GvPrimerTeamMarkPainter> painters = tester
          .widgetList<CustomPaint>(
            find.descendant(
              of: find.byType(GvPrimerTeamMark),
              matching: find.byType(CustomPaint),
            ),
          )
          .map((CustomPaint p) => p.painter)
          .whereType<GvPrimerTeamMarkPainter>()
          .toList();
      expect(painters, hasLength(3));
      // Leader #1E41FF on the Dark Chalk plane: well above 3:1, no boundary.
      expect(painters[0].edge, isNull);
      // #FF8000 on the Dark page: 7.25:1, no boundary.
      expect(painters[1].edge, isNull);

      // #1E41FF on an ordinary row of the Dark page (2.83:1): the 1px
      // boundary in the page's primary text colour; the fill is unchanged.
      await _pump(
        tester,
        drivers: (int season) => <DriverStandingEntry>[
          driverStandingEntry(
            order: 0,
            position: 2,
            driverId: 'blue',
            driverName: 'Blue Team Driver',
            teamColor: '#1E41FF',
            points: 10,
          ),
        ],
      );
      final GvPrimerTeamMarkPainter blue =
          tester
                  .widget<CustomPaint>(
                    find.descendant(
                      of: find.byType(GvPrimerTeamMark),
                      matching: find.byType(CustomPaint),
                    ),
                  )
                  .painter!
              as GvPrimerTeamMarkPainter;
      expect(blue.color, const Color(0xFF1E41FF));
      expect(blue.edge, GvPrimerRoles.dark.text.primary);
    });
  });

  group('responsive matrix (EN/ES × 390@100% / 320@200% × Dark/Light)', () {
    for (final Locale locale in const <Locale>[Locale('en'), Locale('es')]) {
      for (final (Size size, double scale) in const <(Size, double)>[
        (Size(390, 844), 1),
        (Size(320, 693), 2),
      ]) {
        for (final AppThemePreference theme in const <AppThemePreference>[
          AppThemePreference.dark,
          AppThemePreference.light,
        ]) {
          final String name =
              '${locale.languageCode} ${size.width.toInt()}×'
              '${size.height.toInt()} @${(scale * 100).toInt()}% ${theme.wire}';
          testWidgets('$name: header, status and last row all reachable', (
            WidgetTester tester,
          ) async {
            await loadArchivo(tester);
            await _pump(
              tester,
              surfaceSize: size,
              locale: locale,
              textScale: scale,
              theme: theme,
              metadata: (String key) => syncedMetadata(
                key,
                lastSuccessAt: _driversCheck,
                staleAfter: _past,
              ),
            );
            await _fail(tester, 'standings:drivers:2026');
            expect(tester.takeException(), isNull);
            final Rect header = tester.getRect(find.byType(StandingsHeader));
            final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
            expect(header.bottom, lessThan(nav.top), reason: name);
            expect(
              tester.getRect(find.byType(GvPrimerNotice)).top,
              greaterThanOrEqualTo(header.bottom),
            );
            for (int i = 0; i < 3; i++) {
              final ScrollPosition p = tester
                  .state<ScrollableState>(_list)
                  .position;
              p.jumpTo(p.maxScrollExtent);
              await tester.pumpAndSettle();
            }
            expect(tester.takeException(), isNull);
            final Rect last = tester.getRect(
              find.byKey(
                const ValueKey<String>('driver-standing-reserve-entrant'),
              ),
            );
            expect(last.bottom, lessThanOrEqualTo(nav.top), reason: name);
          });
        }
      }
    }
  });
}

Gradient? _leaderGradient(WidgetTester tester) {
  final Finder leader = find.byWidgetPredicate(
    (Widget w) => w is GvPrimerStandingsRow && w.leaderLabel != null,
  );
  for (final DecoratedBox box in tester.widgetList<DecoratedBox>(
    find.descendant(of: leader.first, matching: find.byType(DecoratedBox)),
  )) {
    final Decoration d = box.decoration;
    if (d is BoxDecoration && d.gradient != null) return d.gradient;
  }
  return null;
}
