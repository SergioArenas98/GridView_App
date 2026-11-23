import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/preferences/preferences_providers.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/circuits/presentation/circuit_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/explore/application/explore_state.dart';
import 'package:gridview/features/explore/application/explore_ui_state.dart';
import 'package:gridview/features/explore/presentation/explore_collection_view.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/explore/presentation/widgets/explore_entity_row.dart';
import 'package:gridview/features/explore/presentation/widgets/explore_header.dart';
import 'package:gridview/features/explore/presentation/widgets/explore_status.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:intl/intl.dart';

import '../support/domain_fixtures.dart';
import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/media_fixtures.dart';
import '../support/primer_fonts.dart';
import '../support/reachability.dart';
import '../support/router_harness.dart';

/// Step 55C.7: the Primer V2 Explore — the Alternative B rows (EX-02) for
/// Drivers, Teams and Circuits, the labelled data and spoken standing (RK-2),
/// missing-data omission, the resource-scoped status (N-1, N-2, VS-4), the
/// media column rule, the team tick (XT-3), large text, keyboard, themes and
/// scroll retention. Routing, deep links and the basic offset round trips stay
/// in `explore_widget_test.dart`.

const Size _tall = Size(390, 1600);

Future<GoRouter> _pump(
  WidgetTester tester, {
  String location = '/explore',
  Size surfaceSize = _tall,
  Locale locale = const Locale('en'),
  double textScale = 1,
  AppThemePreference theme = AppThemePreference.dark,
  bool disableAnimations = true,
  List<SeasonDriverCard> Function(int season)? drivers,
  Stream<List<SeasonDriverCard>> Function(int season)? driversStream,
  List<SeasonTeamCard> Function(int season)? teams,
  List<SeasonCircuitCard> Function(int season)? circuits,
  ResourceSyncState? Function(String key)? metadata,
}) => pumpApp(
  tester,
  initialLocation: location,
  surfaceSize: surfaceSize,
  locale: locale,
  textScale: textScale,
  disableAnimations: disableAnimations,
  preferences: AppPreferences.defaults.copyWith(theme: theme),
  syncMetadata: metadata,
  drivers: FakeDriverRepository(
    cards: driversStream == null
        ? (drivers ?? (int s) => seasonDriverCardsFixture(season: s))
        : null,
    cardsStream: driversStream,
    profile: (int s, String id) => driverProfileFixture(season: s),
  ),
  constructors: FakeConstructorRepository(
    cards: teams ?? (int s) => seasonTeamCardsFixture(season: s),
    profile: (int s, String id) => teamProfileFixture(season: s),
  ),
  circuits: FakeCircuitRepository(
    cards: circuits ?? (int s) => seasonCircuitCardsFixture(season: s),
    profile: (int s, String id) =>
        circuitProfileFixture(season: s, circuitId: id),
  ),
);

/// Only `drivers:2026` is stale (its `staleAfter` long past); every other
/// resource is fresh.
ResourceSyncState? _driversStale(String key) => key == 'drivers:2026'
    ? syncedMetadata(key, staleAfter: DateTime.utc(2000))
    : syncedMetadata(key);

/// No resource of its own; only bootstrap materialized the collections.
ResourceSyncState? _bootstrapOnly(String key) =>
    key == 'bootstrap' ? syncedMetadata(key) : null;

Future<void> _publish(
  WidgetTester tester,
  AppSyncState state, {
  bool settle = true,
}) async {
  containerOf(tester).read(appSyncStateProvider.notifier).publish(state);
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}

AppSyncState _outcome(String key, ResourceSyncOutcomeKind kind) =>
    AppSyncCompleted(
      trigger: SyncTrigger.foreground,
      outcomes: <ResourceSyncOutcome>[
        ResourceSyncOutcome(
          resourceKey: key,
          kind: kind,
          failure: kind == ResourceSyncOutcomeKind.failed
              ? ApiFailureKind.networkUnavailable
              : null,
        ),
      ],
    );

Finder _segment(String label) => find.descendant(
  of: find.byType(GvPrimerSegmentedControl),
  matching: find.descendant(
    of: find.byType(GvPrimerFocusTarget),
    matching: find.text(label),
  ),
);

Finder _targetOf(Finder of) =>
    find.descendant(of: of, matching: find.byType(GvPrimerFocusTarget)).first;

FocusNode _nodeOf(WidgetTester tester, Finder target) => Focus.of(
  tester.element(
    find.descendant(of: target, matching: find.byType(GestureDetector)).first,
  ),
);

ExploreEntityRow _row(WidgetTester tester, String key) =>
    tester.widget<ExploreEntityRow>(find.byKey(ValueKey<String>(key)));

Finder get _list => find
    .descendant(
      of: find.byType(ExploreScreen),
      matching: find.byType(Scrollable),
    )
    .last;

double _offset(WidgetTester tester) =>
    tester.state<ScrollableState>(_list).position.pixels;

List<GvPrimerNotice> _notices(WidgetTester tester) =>
    tester.widgetList<GvPrimerNotice>(find.byType(GvPrimerNotice)).toList();

List<String> _traversal(SemanticsNode node) => <String>[
  if (node.label.isNotEmpty) node.label,
  for (final SemanticsNode child in node.debugListChildrenInOrder(
    DebugSemanticsDumpOrder.traversalOrder,
  ))
    ..._traversal(child),
];

List<SeasonDriverCard> _grid(int season) => <SeasonDriverCard>[
  for (int i = 0; i < 20; i++)
    driverCard(
      season: season,
      order: i,
      driverId: 'driver-${i + 1}',
      name: 'Driver ${i + 1}',
      raceNumber: i + 1,
      teamName: 'Team ${(i ~/ 2) + 1}',
      position: i + 1,
      points: (20 - i) * 10.0,
    ),
];

void main() {
  group('driver rows (EX-02, RK-2)', () {
    testWidgets('identity, affiliation, labelled standing, figure, tick', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      final ExploreEntityRow max = _row(
        tester,
        'explore-driver-max-verstappen',
      );
      expect(max.name, 'Max Verstappen');
      expect(max.subLines, <String>['Oracle Red Bull Racing · Dutch']);
      expect(max.data, const <ExploreDatum>[
        ExploreDatum('Position', '2'),
        ExploreDatum('Points', '402.5'),
      ]);
      expect(max.figure, '1');
      expect(max.figureCaption, 'VER');
      expect(max.accent, const Color(0xFF1E41FF));
      expect(max.media, isNull, reason: 'no media reference, no column');
      expect(
        max.semanticLabel,
        'Max Verstappen, Oracle Red Bull Racing, Position 2, 402.5 points',
      );
    });

    testWidgets('unranked with a genuine 0: "Points 0", no position, and no '
        'isolated number in the spoken name', (WidgetTester tester) async {
      await _pump(tester);
      final ExploreEntityRow col = _row(
        tester,
        'explore-driver-franco-colapinto',
      );
      expect(col.data, const <ExploreDatum>[ExploreDatum('Points', '0')]);
      expect(
        col.semanticLabel,
        'Franco Colapinto, BWT Alpine Formula One Team, 0 points',
      );
      expect(col.semanticLabel, isNot(contains('Position')));
      expect(col.semanticLabel, isNot(contains('Unranked')));
    });

    testWidgets('missing team, nationality, number and standing are omitted, '
        'never invented', (WidgetTester tester) async {
      await _pump(tester);
      final ExploreEntityRow unaffiliated = _row(
        tester,
        'explore-driver-unaffiliated-entrant',
      );
      expect(unaffiliated.subLines, isEmpty);
      expect(unaffiliated.data, isEmpty);
      expect(unaffiliated.figure, '55');
      expect(unaffiliated.figureCaption, isNull);
      expect(unaffiliated.accent, isNull);
      expect(unaffiliated.semanticLabel, 'Unaffiliated Entrant');
      final ExploreEntityRow reserve = _row(
        tester,
        'explore-driver-reserve-entrant',
      );
      expect(reserve.figure, isNull);
      expect(reserve.figureCaption, isNull);
      expect(reserve.data, isEmpty);
      expect(find.textContaining('not-synced-team'), findsNothing);
      expect(find.text('0'), findsOneWidget, reason: "only Colapinto's 0");
    });

    testWidgets('Spanish: field labels, decimal comma, spoken words', (
      WidgetTester tester,
    ) async {
      await _pump(tester, locale: const Locale('es'));
      final ExploreEntityRow max = _row(
        tester,
        'explore-driver-max-verstappen',
      );
      expect(max.data, const <ExploreDatum>[
        ExploreDatum('Posición', '2'),
        ExploreDatum('Puntos', '402,5'),
      ]);
      expect(
        max.semanticLabel,
        'Max Verstappen, Oracle Red Bull Racing, Posición 2, 402,5 puntos',
      );
    });

    testWidgets('each row is one link named by its label; the visible texts '
        'are not read again', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pump(tester);
      const String label =
          'Lando Norris, McLaren Formula 1 Team, Position 1, 460.5 points';
      expect(
        tester.getSemantics(find.bySemanticsLabel(label)),
        isSemantics(label: label, isLink: true, hasTapAction: true),
      );
      expect(find.bySemanticsLabel('NOR'), findsNothing);
      expect(find.bySemanticsLabel('Lando Norris'), findsNothing);
      handle.dispose();
    });
  });

  group('team and circuit rows', () {
    testWidgets('teams: season name, line-up codes, labelled data; no '
        'figure; a missing power unit is omitted', (WidgetTester tester) async {
      await _pump(tester, location: '/explore/teams');
      final ExploreEntityRow alpine = _row(tester, 'explore-team-alpine');
      expect(alpine.name, 'BWT Alpine Formula One Team');
      expect(alpine.codes, 'GAS · DOO · COL');
      expect(alpine.data, const <ExploreDatum>[
        ExploreDatum('Position', '6'),
        ExploreDatum('Points', '22'),
        ExploreDatum('Power unit', 'Renault'),
      ]);
      expect(alpine.figure, isNull);
      expect(alpine.accent, const Color(0xFF0093CC));
      expect(
        alpine.semanticLabel,
        'BWT Alpine Formula One Team, Position 6, 22 points, GAS · DOO · COL',
      );
      final ExploreEntityRow redBull = _row(tester, 'explore-team-red-bull');
      expect(redBull.name, 'Oracle Red Bull Racing');
      expect(
        redBull.data.map((ExploreDatum d) => d.label),
        isNot(contains('Power unit')),
      );
    });

    testWidgets('a team with nothing known shows only its stable name', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/explore/teams',
        teams: (int s) => <SeasonTeamCard>[
          teamCard(
            season: s,
            order: 0,
            constructorId: 'bare',
            stableName: 'Bare Test Team',
          ),
        ],
      );
      final ExploreEntityRow bare = _row(tester, 'explore-team-bare');
      expect(bare.name, 'Bare Test Team');
      expect(bare.codes, isNull);
      expect(bare.data, isEmpty);
      expect(bare.accent, isNull);
      expect(bare.semanticLabel, 'Bare Test Team');
    });

    testWidgets('circuits: location, event and date on their own lines, the '
        'length as the figure; the date never breaks', (
      WidgetTester tester,
    ) async {
      await _pump(tester, location: '/explore/circuits');
      final ExploreEntityRow monza = _row(tester, 'explore-circuit-monza');
      expect(monza.subLines, <String>[
        'Monza, Italy',
        'Italian Grand Prix · Jul 10, 2026',
      ]);
      expect(monza.figure, '5.793');
      expect(monza.figureCaption, 'km');
      expect(monza.figureKind, ExploreFigureKind.circuit);
      expect(
        monza.semanticLabel,
        'Autodromo Nazionale Monza, Monza, Italy, '
        'Italian Grand Prix',
      );

      await _pump(
        tester,
        location: '/explore/circuits',
        locale: const Locale('es'),
      );
      expect(_row(tester, 'explore-circuit-monza').figure, '5,793');
    });

    testWidgets('a circuit with no location, event or length shows none of '
        'them', (WidgetTester tester) async {
      await _pump(
        tester,
        location: '/explore/circuits',
        circuits: (int s) => <SeasonCircuitCard>[
          circuitCard(
            season: s,
            order: 1,
            circuitId: 'bare',
            name: 'Bare Test Circuit',
          ),
        ],
      );
      final ExploreEntityRow bare = _row(tester, 'explore-circuit-bare');
      expect(bare.subLines, isEmpty);
      expect(bare.figure, isNull);
      expect(bare.figureCaption, isNull);
      expect(bare.semanticLabel, 'Bare Test Circuit');
      expect(find.text('km'), findsNothing);
    });
  });

  group('resource-scoped status (N-1, N-2, VS-4)', () {
    testWidgets('refreshing: the progress line, cached rows stay', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await _publish(tester, const AppSyncRunning(trigger: SyncTrigger.manual));
      expect(find.byType(ExploreProgressLine), findsOneWidget);
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(_notices(tester), isEmpty);
    });

    testWidgets('failure alone: the existing "Update failed", alert icon; '
        'cached rows stay', (WidgetTester tester) async {
      await _pump(tester);
      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.failed),
      );
      expect(_notices(tester).single.cause, GvPrimerNoticeCause.failure);
      expect(_notices(tester).single.message, 'Update failed');
      expect(find.text('Max Verstappen'), findsOneWidget);
    });

    for (final (Locale locale, String text) in const <(Locale, String)>[
      (
        Locale('en'),
        'This data may be out of date — showing the last saved version.',
      ),
      (
        Locale('es'),
        'Estos datos pueden estar desactualizados — mostrando la última '
            'versión guardada.',
      ),
    ]) {
      testWidgets('${locale.languageCode}: stale alone: the established '
          'out-of-date notice (EF-2), clock icon', (WidgetTester tester) async {
        await _pump(tester, locale: locale, metadata: _driversStale);
        expect(_notices(tester).single.cause, GvPrimerNoticeCause.stale);
        expect(_notices(tester).single.message, text);
        expect(find.text('Showing saved data'), findsNothing);
      });
    }

    for (final (Locale locale, String text) in const <(Locale, String)>[
      (Locale('en'), "Couldn't refresh. Saved data may be out of date."),
      (
        Locale('es'),
        'No se pudo actualizar. Los datos guardados pueden estar '
            'desactualizados.',
      ),
    ]) {
      testWidgets('${locale.languageCode}: failure + stale of the same '
          'collection is the one N-2 notice', (WidgetTester tester) async {
        await _pump(tester, locale: locale, metadata: _driversStale);
        await _publish(
          tester,
          _outcome('drivers:2026', ResourceSyncOutcomeKind.failed),
        );
        expect(_notices(tester), hasLength(1));
        expect(_notices(tester).single.cause, GvPrimerNoticeCause.failure);
        expect(_notices(tester).single.message, text);
      });
    }

    testWidgets("one collection's status never reaches another", (
      WidgetTester tester,
    ) async {
      await _pump(tester, location: '/explore/teams', metadata: _driversStale);
      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.failed),
      );
      expect(_notices(tester), isEmpty, reason: 'drivers is not teams');
      await tester.tap(_segment('Drivers'));
      await tester.pumpAndSettle();
      expect(_notices(tester), hasLength(1), reason: 'N-2 on drivers only');
    });

    testWidgets('an unrelated core failure is not an Explore notice', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await _publish(
        tester,
        _outcome('standings:drivers:2026', ResourceSyncOutcomeKind.failed),
      );
      await _publish(
        tester,
        _outcome('calendar:2026', ResourceSyncOutcomeKind.failed),
      );
      expect(_notices(tester), isEmpty);
    });

    testWidgets('a bootstrap-materialized collection is never called stale '
        'and claims no time', (WidgetTester tester) async {
      await _pump(tester, metadata: _bootstrapOnly);
      expect(find.text('Max Verstappen'), findsOneWidget);
      expect(_notices(tester), isEmpty);
      expect(find.textContaining('Last successful check'), findsNothing);
    });

    testWidgets('an empty synchronized collection is empty, not missing, and '
        'keeps its own notice', (WidgetTester tester) async {
      await _pump(
        tester,
        metadata: _driversStale,
        drivers: (int s) => const <SeasonDriverCard>[],
      );
      expect(find.text('No drivers yet'), findsOneWidget);
      expect(find.byType(ExploreSkeleton), findsNothing);
      expect(
        _notices(tester).single.message,
        'This data may be out of date — showing the last saved version.',
      );
      expect(find.widgetWithText(GvPrimerButton, 'Try again'), findsOneWidget);
    });

    testWidgets('still resolving: the skeleton, never "empty"', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        driversStream: (int s) => const Stream<List<SeasonDriverCard>>.empty(),
      );
      expect(find.byType(ExploreSkeleton), findsOneWidget);
      expect(find.text('No drivers yet'), findsNothing);
      expect(find.byKey(const ValueKey<String>('explore-error')), findsNothing);
    });

    testWidgets('nothing local and a failed first load: the alert error with '
        'a retry, not the skeleton', (WidgetTester tester) async {
      await _pump(
        tester,
        drivers: (int s) => const <SeasonDriverCard>[],
        metadata: (String key) => null,
      );
      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.failed),
      );
      final GvPrimerEmptyState error = tester.widget<GvPrimerEmptyState>(
        find.byKey(const ValueKey<String>('explore-error')),
      );
      expect(error.glyph, GvPrimerGlyph.alert);
      expect(error.title, "Can't load the drivers");
      expect(find.byType(ExploreSkeleton), findsNothing);
      expect(find.widgetWithText(GvPrimerButton, 'Try again'), findsOneWidget);
    });

    testWidgets('reduced motion: the progress line stands still at 30%', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await _publish(tester, const AppSyncRunning(trigger: SyncTrigger.manual));
      final Rect line = tester.getRect(
        find.byKey(const ValueKey<String>('explore-progress')),
      );
      final Rect bar = tester.getRect(
        find.byKey(const ValueKey<String>('explore-progress-bar')),
      );
      expect(bar.left - line.left, closeTo(line.width * 0.3, 0.01));
      expect(bar.width, closeTo(line.width * 0.4, 0.01));
      await tester.pump(const Duration(milliseconds: 700));
      expect(
        tester
            .getRect(find.byKey(const ValueKey<String>('explore-progress-bar')))
            .left,
        bar.left,
      );
    });

    testWidgets('with animations the progress line sweeps', (
      WidgetTester tester,
    ) async {
      await _pump(tester, disableAnimations: false);
      await _publish(
        tester,
        const AppSyncRunning(trigger: SyncTrigger.manual),
        settle: false,
      );
      await tester.pump(const Duration(milliseconds: 100));
      final double first = tester
          .getRect(find.byKey(const ValueKey<String>('explore-progress-bar')))
          .left;
      await tester.pump(const Duration(milliseconds: 500));
      final double later = tester
          .getRect(find.byKey(const ValueKey<String>('explore-progress-bar')))
          .left;
      expect(later, isNot(first));
      // Leave the indeterminate line before the test ends.
      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.applied),
        settle: false,
      );
      await tester.pump();
      expect(find.byType(ExploreProgressLine), findsNothing);
    });
  });

  group('scroll retention', () {
    testWidgets('background refresh outcomes and Drift emissions never reset '
        'the position', (WidgetTester tester) async {
      final StreamController<List<SeasonDriverCard>> drift =
          StreamController<List<SeasonDriverCard>>.broadcast();
      addTearDown(drift.close);
      await _pump(
        tester,
        surfaceSize: const Size(390, 700),
        driversStream: (int s) => drift.stream,
      );
      drift.add(_grid(2026));
      await tester.pumpAndSettle();
      await tester.drag(_list, const Offset(0, -500));
      await tester.pumpAndSettle();
      expect(_offset(tester), greaterThan(0));
      // A row fully on screen at this position.
      final Rect viewport = tester.getRect(_list);
      final Key key = find
          .byType(ExploreEntityRow)
          .evaluate()
          .map((Element e) => e.widget.key!)
          .firstWhere((Key k) {
            final Rect r = tester.getRect(find.byKey(k));
            return r.top >= viewport.top && r.bottom <= viewport.bottom;
          });
      final Finder row = find.byKey(key);
      final Rect before = tester.getRect(row);

      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.applied),
      );
      expect(tester.getRect(row), before);
      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.failed),
      );
      // The notice is added above, in the scrolling status: the offset grows
      // by its height so the rows on screen stay where they were (EF-1).
      expect(tester.getRect(row), before);
      drift.add(<SeasonDriverCard>[
        ..._grid(2026),
        driverCard(order: 99, driverId: 'late', name: 'Late Entrant'),
      ]);
      await tester.pumpAndSettle();
      expect(tester.getRect(row), before);
    });

    testWidgets('the selected category survives a detail round trip', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(tester, location: '/explore/teams');
      await tester.tap(find.text('McLaren Formula 1 Team'));
      await tester.pumpAndSettle();
      expect(find.byType(ConstructorDetailScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/explore/teams');
      expect(find.text('McLaren Formula 1 Team'), findsOneWidget);
    });

    test('offsets are remembered per category and per season', () {
      final ProviderContainer container = ProviderContainer();
      addTearDown(container.dispose);
      final ExploreUiController ui = container.read(
        exploreUiStateProvider.notifier,
      );
      ui.rememberOffset(
        category: ExploreCategory.drivers,
        season: 2026,
        offset: 300,
      );
      ui.rememberOffset(
        category: ExploreCategory.circuits,
        season: 2026,
        offset: 120,
      );
      ExploreUiState state = container.read(exploreUiStateProvider);
      expect(state.offsetFor(ExploreCategory.drivers, 2026), 300);
      expect(state.offsetFor(ExploreCategory.teams, 2026), 0);
      expect(state.offsetFor(ExploreCategory.circuits, 2026), 120);
      expect(
        state.offsetFor(ExploreCategory.drivers, 2027),
        0,
        reason: 'another season starts at the top',
      );

      ui.rememberOffset(
        category: ExploreCategory.teams,
        season: 2027,
        offset: 50,
      );
      state = container.read(exploreUiStateProvider);
      expect(state.offsetFor(ExploreCategory.teams, 2027), 50);
      expect(
        state.offsetFor(ExploreCategory.drivers, 2027),
        0,
        reason: "the previous season's offsets are dropped",
      );
    });
  });

  group('media column (EX-02; PD-16 open)', () {
    testWidgets('no media reference: no image column, every name on the '
        'same line after the accent lane', (WidgetTester tester) async {
      await _pump(tester);
      expect(find.byType(GvRemoteImage), findsNothing);
      expect(find.byType(GvImagePlaceholder), findsNothing);
      final Set<double> starts = <double>{
        for (final Element e
            in find
                .byKey(const ValueKey<String>('explore-row-name'))
                .evaluate())
          tester.getTopLeft(find.byWidget(e.widget)).dx,
      };
      expect(starts, <double>{GvPrimerLayout.gutter + ExploreEntityRow.lane});
    });

    testWidgets('one reference: every row reserves the same slot, so names '
        'never move when an image loads, fails or is absent', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        drivers: (int s) => <SeasonDriverCard>[
          driverCard(
            season: s,
            order: 0,
            driverId: 'with-media',
            name: 'With Media',
            media: entityMediaOf(<MediaAsset>[
              portraitAsset(id: 'with-media-portrait-v1', owner: 'with-media'),
            ]),
          ),
          driverCard(
            season: s,
            order: 1,
            driverId: 'without-media',
            name: 'Without Media',
          ),
        ],
      );
      final Finder slots = find.byKey(
        const ValueKey<String>('explore-row-media'),
      );
      expect(slots, findsNWidgets(2));
      for (final Element e in slots.evaluate()) {
        expect(tester.getSize(find.byWidget(e.widget)), const Size(40, 40));
      }
      // No loader in the harness: both slots show the existing placeholder,
      // decorative, with no URL, error or identifier text.
      expect(find.byType(GvImagePlaceholder), findsNWidgets(2));
      expect(
        tester.getTopLeft(find.text('With Media')).dx,
        tester.getTopLeft(find.text('Without Media')).dx,
      );
      expect(find.textContaining('portrait'), findsNothing);
      expect(find.textContaining('http'), findsNothing);
    });
  });

  group('team tick (XT-3)', () {
    List<GvPrimerTeamMarkPainter> painters(WidgetTester tester) => tester
        .widgetList<CustomPaint>(
          find.descendant(
            of: find.byType(GvPrimerTeamMark),
            matching: find.byType(CustomPaint),
          ),
        )
        .map((CustomPaint p) => p.painter)
        .whereType<GvPrimerTeamMarkPainter>()
        .toList();

    testWidgets('Dark: the supplied colour unchanged; the 1px Chalk boundary '
        'only below 3:1 (#1E41FF), none for #FF8000', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      final List<GvPrimerTeamMarkPainter> p = painters(tester);
      expect(p.map((GvPrimerTeamMarkPainter x) => x.color), <Color>[
        const Color(0xFF1E41FF),
        const Color(0xFFFF8000),
      ]);
      expect(p[0].edge, GvPrimerRoles.dark.text.primary);
      expect(p[1].edge, isNull);
      // Fixed 3 × 40 tick in the accent lane, 18px from the row top.
      final Rect row = tester.getRect(
        find.byKey(const ValueKey<String>('explore-driver-max-verstappen')),
      );
      final Rect tick = tester.getRect(find.byType(GvPrimerTeamMark).first);
      expect(tick.size, const Size(3, 40));
      expect(tick.left - row.left, GvPrimerLayout.gutter);
      expect(tick.top - row.top, ExploreEntityRow.tickTop);
    });

    testWidgets('Light: #FF8000 gets the Graphite boundary, #1E41FF none', (
      WidgetTester tester,
    ) async {
      await _pump(tester, theme: AppThemePreference.light);
      final List<GvPrimerTeamMarkPainter> p = painters(tester);
      expect(p[0].edge, isNull);
      expect(p[1].edge, GvPrimerRoles.light.text.primary);
    });

    testWidgets('decorative: no semantics, no pointer target', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pump(tester);
      expect(
        find.descendant(
          of: find.byType(GvPrimerTeamMark),
          matching: find.byWidgetPredicate(
            (Widget w) => w is Semantics && (w.properties.label ?? '') != '',
          ),
        ),
        findsNothing,
      );
      expect(
        find.ancestor(
          of: find.byType(GvPrimerTeamMark).first,
          matching: find.byType(IgnorePointer),
        ),
        findsWidgets,
      );
      handle.dispose();
    });
  });

  group('keyboard and reading order', () {
    testWidgets('Tab moves between the options; Enter and Space select', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final GoRouter router = await _pump(tester);
      _nodeOf(
        tester,
        find.ancestor(
          of: _segment('Drivers'),
          matching: find.byType(GvPrimerFocusTarget),
        ),
      ).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(
        FocusManager.instance.primaryFocus,
        _nodeOf(
          tester,
          find.ancestor(
            of: _segment('Teams'),
            matching: find.byType(GvPrimerFocusTarget),
          ),
        ),
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/explore/teams');
      expect(
        tester.getSemantics(find.bySemanticsLabel('Teams').first),
        isSemantics(isSelected: true, isButton: true),
      );

      _nodeOf(
        tester,
        find.ancestor(
          of: _segment('Circuits'),
          matching: find.byType(GvPrimerFocusTarget),
        ),
      ).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pumpAndSettle();
      expect(shellLocation(router), '/explore/circuits');
      handle.dispose();
    });

    testWidgets('Enter on a focused driver row opens that driver; Space on a '
        'circuit row opens that circuit', (WidgetTester tester) async {
      await _pump(tester);
      _nodeOf(
        tester,
        _targetOf(
          find.byKey(const ValueKey<String>('explore-driver-lando-norris')),
        ),
      ).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<DriverDetailScreen>(find.byType(DriverDetailScreen))
            .driverId,
        'lando-norris',
      );

      await _pump(tester, location: '/explore/circuits');
      _nodeOf(
        tester,
        _targetOf(find.byKey(const ValueKey<String>('explore-circuit-monza'))),
      ).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<CircuitDetailScreen>(find.byType(CircuitDetailScreen))
            .circuitId,
        'monza',
      );
    });

    testWidgets('keyboard focus shows the ring on a row and on an option', (
      WidgetTester tester,
    ) async {
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.alwaysTraditional;
      addTearDown(
        () => FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.automatic,
      );
      await _pump(tester);
      bool ringVisible(Finder target) => tester
          .widget<GvPrimerFocusRing>(
            find.descendant(
              of: target,
              matching: find.byType(GvPrimerFocusRing),
            ),
          )
          .visible;
      final Finder row = _targetOf(
        find.byKey(const ValueKey<String>('explore-driver-max-verstappen')),
      );
      expect(ringVisible(row), isFalse);
      _nodeOf(tester, row).requestFocus();
      await tester.pumpAndSettle();
      expect(ringVisible(row), isTrue);

      final Finder teams = find.ancestor(
        of: _segment('Teams'),
        matching: find.byType(GvPrimerFocusTarget),
      );
      _nodeOf(tester, teams).requestFocus();
      await tester.pumpAndSettle();
      expect(ringVisible(teams), isTrue);
      expect(ringVisible(row), isFalse);
    });

    testWidgets('header reading order: title, Settings, season, category '
        'selector', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pump(tester);
      final List<String> labels = _traversal(
        tester.getSemantics(find.byType(ExploreHeader)),
      );
      final List<int> at = <String>[
        'Explore',
        'Open settings',
        '2026 season',
        'Explore category',
        'Drivers',
        'Teams',
        'Circuits',
      ].map(labels.indexOf).toList();
      expect(at.every((int i) => i >= 0), isTrue, reason: '$labels');
      for (int i = 1; i < at.length; i++) {
        expect(at[i], greaterThan(at[i - 1]), reason: '$labels');
      }
      handle.dispose();
    });
  });

  group('themes', () {
    for (final (AppThemePreference pref, GvPrimerRoles roles)
        in <(AppThemePreference, GvPrimerRoles)>[
          (AppThemePreference.dark, GvPrimerRoles.dark),
          (AppThemePreference.light, GvPrimerRoles.light),
        ]) {
      testWidgets('${pref.wire}: page colour and opaque pinned header', (
        WidgetTester tester,
      ) async {
        await _pump(tester, theme: pref);
        final Scaffold scaffold = tester.widget<Scaffold>(
          find
              .descendant(
                of: find.byType(ExploreScreen),
                matching: find.byType(Scaffold),
              )
              .first,
        );
        expect(scaffold.backgroundColor, roles.surface.page);
        final ColoredBox header = tester.widget<ColoredBox>(
          find
              .descendant(
                of: find.byType(ExploreHeader),
                matching: find.byType(ColoredBox),
              )
              .first,
        );
        expect(header.color, roles.surface.page);
      });
    }

    testWidgets('switching Dark → Light at runtime keeps the category and the '
        'offset', (WidgetTester tester) async {
      await _pump(
        tester,
        surfaceSize: const Size(390, 700),
        location: '/explore/teams',
        teams: (int s) => <SeasonTeamCard>[
          for (int i = 0; i < 12; i++)
            teamCard(
              season: s,
              order: i,
              constructorId: 'team-$i',
              stableName: 'Team ${i + 1}',
              position: i + 1,
              points: (12 - i) * 10.0,
            ),
        ],
      );
      await tester.drag(_list, const Offset(0, -300));
      await tester.pumpAndSettle();
      final double before = _offset(tester);
      expect(before, greaterThan(0));
      await containerOf(tester)
          .read(appPreferencesProvider.notifier)
          .setTheme(AppThemePreference.light);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<Scaffold>(
              find
                  .descendant(
                    of: find.byType(ExploreScreen),
                    matching: find.byType(Scaffold),
                  )
                  .first,
            )
            .backgroundColor,
        GvPrimerRoles.light.surface.page,
      );
      expect(find.text('Max Verstappen'), findsNothing);
      expect(_offset(tester), closeTo(before, 0.5));
    });
  });

  group('large text (320×693 @200%)', () {
    for (final Locale locale in const <Locale>[Locale('en'), Locale('es')]) {
      testWidgets('${locale.languageCode}: the selector stacks with 48dp '
          'options; a driver figure leads its row, a circuit figure follows '
          'its details', (WidgetTester tester) async {
        await loadArchivo(tester);
        await _pump(
          tester,
          surfaceSize: const Size(320, 693),
          locale: locale,
          textScale: 2,
        );
        expect(tester.takeException(), isNull);
        final List<Rect> options = <Rect>[
          for (final Element e
              in find
                  .descendant(
                    of: find.byType(GvPrimerSegmentedControl),
                    matching: find.byType(GvPrimerFocusTarget),
                  )
                  .evaluate())
            tester.getRect(find.byWidget(e.widget)),
        ];
        expect(options, hasLength(3));
        expect(options.map((Rect r) => r.top).toSet(), hasLength(3));
        for (final Rect r in options) {
          expect(r.height, greaterThanOrEqualTo(48));
        }
        final Finder max = find.byKey(
          const ValueKey<String>('explore-driver-max-verstappen'),
        );
        expect(
          tester
              .getRect(
                find.descendant(
                  of: max,
                  matching: find.byKey(
                    const ValueKey<String>('explore-row-fig'),
                  ),
                ),
              )
              .bottom,
          lessThanOrEqualTo(
            tester
                .getRect(
                  find.descendant(
                    of: max,
                    matching: find.byKey(
                      const ValueKey<String>('explore-row-name'),
                    ),
                  ),
                )
                .top,
          ),
        );

        await tester.tap(
          _segment(locale.languageCode == 'es' ? 'Circuitos' : 'Circuits'),
        );
        await tester.pumpAndSettle();
        final Finder monza = find.byKey(
          const ValueKey<String>('explore-circuit-monza'),
        );
        final Rect fig = tester.getRect(
          find.descendant(
            of: monza,
            matching: find.byKey(const ValueKey<String>('explore-row-fig')),
          ),
        );
        final Rect name = tester.getRect(
          find.descendant(
            of: monza,
            matching: find.byKey(const ValueKey<String>('explore-row-name')),
          ),
        );
        expect(fig.top, greaterThan(name.bottom));
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('status placement (owner-approved EF-1)', () {
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
              '${locale.languageCode} ${size.width.toInt()}@'
              '${(scale * 100).toInt()}% ${theme.wire}';
          testWidgets('$name: title, season and selector pinned; caption, '
              'progress and N-2 scroll before the rows; last row clears '
              'the navigation', (WidgetTester tester) async {
            await loadArchivo(tester);
            await _pump(
              tester,
              surfaceSize: size,
              locale: locale,
              textScale: scale,
              theme: theme,
              drivers: _grid,
              metadata: (String key) => key == 'drivers:2026'
                  ? syncedMetadata(
                      key,
                      lastSuccessAt: DateTime.utc(2026, 7, 18, 9, 5),
                      staleAfter: DateTime.utc(2000),
                    )
                  : syncedMetadata(key),
            );
            await _publish(
              tester,
              _outcome('drivers:2026', ResourceSyncOutcomeKind.failed),
            );
            expect(tester.takeException(), isNull);
            final Rect header = tester.getRect(find.byType(ExploreHeader));
            final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
            // The pinned share: title, season and selector only.
            expect(
              header.height / size.height,
              lessThan(scale == 1 ? 0.20 : 0.42),
              reason: name,
            );
            expect(
              find.descendant(
                of: find.byType(ExploreHeader),
                matching: find.byType(GvPrimerNotice),
              ),
              findsNothing,
            );
            final Finder status = find.byKey(
              const ValueKey<String>('explore-status'),
            );
            final Rect statusAt = tester.getRect(status);
            expect(statusAt.top, greaterThanOrEqualTo(header.bottom));
            expect(
              find.descendant(of: _list, matching: find.byType(GvPrimerNotice)),
              findsOneWidget,
              reason: 'the N-2 notice is inside the scrolling list',
            );
            // The status block is readable: whole when it fits, otherwise
            // (Spanish at 320 @200%, ≈279px against a 251px list) every line
            // of it can be scrolled whole into view. It scrolls with the rows
            // (EF-1), never behind the navigation.
            await expectReachable(
              tester,
              target: status,
              scrollable: _list,
              header: find.byType(ExploreHeader),
              navigation: find.byType(GvPrimerBottomNav),
              reason: '$name status',
            );
            tester.state<ScrollableState>(_list).position.jumpTo(0);
            await tester.pumpAndSettle();
            // Step 55C.15R (owner decision D1): at 320 @200% the approved
            // 2 × 2 navigation leaves no room for the first row under the
            // Spanish status block on opening, so "the first row sits right
            // under the status" became "the rows follow the status and are
            // reachable": the first row is scrolled to, whole, after the
            // status and tappable; then the last one.
            final Finder firstRow = find.byKey(
              const ValueKey<String>('explore-driver-driver-1'),
            );
            await expectReachable(
              tester,
              target: firstRow,
              scrollable: _list,
              header: find.byType(ExploreHeader),
              navigation: find.byType(GvPrimerBottomNav),
              reason: '$name first row',
            );
            if (status.evaluate().isNotEmpty) {
              expect(
                tester.getRect(firstRow).top,
                greaterThanOrEqualTo(tester.getRect(status).bottom),
                reason: 'the rows follow the status',
              );
            }

            await scrollToEnd(tester, _list);
            expect(tester.takeException(), isNull);
            expect(tester.getRect(find.byType(ExploreHeader)), header);
            expect(
              status.evaluate().isEmpty ||
                  tester.getRect(status).top < statusAt.top,
              isTrue,
              reason: 'the status moves with the rows',
            );
            final Rect last = tester.getRect(
              find.byKey(const ValueKey<String>('explore-driver-driver-20')),
            );
            expect(last.bottom, lessThanOrEqualTo(nav.top), reason: name);
            await expectReachable(
              tester,
              target: find.byKey(
                const ValueKey<String>('explore-driver-driver-20'),
              ),
              scrollable: _list,
              header: find.byType(ExploreHeader),
              navigation: find.byType(GvPrimerBottomNav),
              reason: '$name last row',
            );
          });
        }
      }
    }

    testWidgets('reading order: selector, caption, notice, then the rows', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pump(
        tester,
        metadata: (String key) => key == 'drivers:2026'
            ? syncedMetadata(
                key,
                lastSuccessAt: DateTime.utc(2026, 7, 18, 9, 5),
                staleAfter: DateTime.utc(2000),
              )
            : syncedMetadata(key),
      );
      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.failed),
      );
      final List<String> labels = _traversal(
        tester.getSemantics(find.byType(ExploreScreen)),
      );
      final int selector = labels.indexOf('Circuits');
      final int caption = labels.indexWhere(
        (String l) => l.startsWith('Last successful check'),
      );
      final int notice = labels.indexWhere(
        (String l) => l.contains("Couldn't refresh"),
      );
      final int row = labels.indexWhere(
        (String l) => l.startsWith('Max Verstappen'),
      );
      expect(
        <int>[selector, caption, notice, row].every((int i) => i >= 0),
        isTrue,
        reason: '$labels',
      );
      expect(selector, lessThan(caption));
      expect(caption, lessThan(notice));
      expect(notice, lessThan(row));
      handle.dispose();
    });

    testWidgets('scrolled into the list: a failure appearing, a refresh '
        'starting and a success clearing it never move the rows on screen', (
      WidgetTester tester,
    ) async {
      await _pump(tester, surfaceSize: const Size(390, 700), drivers: _grid);
      await tester.drag(_list, const Offset(0, -260));
      await tester.pumpAndSettle();
      final Finder row = find.byKey(
        const ValueKey<String>('explore-driver-driver-6'),
      );
      final Rect before = tester.getRect(row);

      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.failed),
      );
      // Built just above the viewport (in the cache extent), so the
      // correction path is the one exercised.
      expect(find.byType(GvPrimerNotice, skipOffstage: false), findsOneWidget);
      expect(tester.getRect(row), before);

      await _publish(
        tester,
        const AppSyncRunning(trigger: SyncTrigger.manual),
        settle: false,
      );
      await tester.pump();
      expect(tester.getRect(row), before);
      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.applied),
      );
      expect(find.byType(GvPrimerNotice, skipOffstage: false), findsNothing);
      expect(
        find.byType(ExploreProgressLine, skipOffstage: false),
        findsNothing,
      );
      expect(tester.getRect(row), before);

      // The remembered offset follows the corrected position, so a category
      // round trip restores exactly this view.
      expect(
        containerOf(
          tester,
        ).read(exploreUiStateProvider).offsetFor(ExploreCategory.drivers, 2026),
        closeTo(_offset(tester), 0.01),
      );
      await tester.tap(_segment('Teams'));
      await tester.pumpAndSettle();
      await tester.tap(_segment('Drivers'));
      await tester.pumpAndSettle();
      expect(tester.getRect(row), before);
    });

    testWidgets('at the top: a new notice is revealed above the rows', (
      WidgetTester tester,
    ) async {
      await _pump(tester, drivers: _grid);
      final Finder row = find.byKey(
        const ValueKey<String>('explore-driver-driver-1'),
      );
      final double before = tester.getRect(row).top;
      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.failed),
      );
      expect(_offset(tester), 0);
      final Rect notice = tester.getRect(find.byType(GvPrimerNotice));
      expect(notice.bottom, lessThanOrEqualTo(tester.getRect(row).top));
      expect(tester.getRect(row).top, greaterThan(before));
    });

    testWidgets('all three categories keep independent offsets with a status '
        'present', (WidgetTester tester) async {
      await _pump(
        tester,
        surfaceSize: const Size(390, 700),
        metadata: (String key) =>
            syncedMetadata(key, staleAfter: DateTime.utc(2000)),
        drivers: _grid,
        teams: (int s) => <SeasonTeamCard>[
          for (int i = 0; i < 12; i++)
            teamCard(
              season: s,
              order: i,
              constructorId: 'team-$i',
              stableName: 'Team ${i + 1}',
            ),
        ],
        circuits: (int s) => <SeasonCircuitCard>[
          for (int i = 0; i < 14; i++)
            circuitCard(
              season: s,
              order: i + 1,
              circuitId: 'circuit-$i',
              name: 'Circuit ${i + 1}',
              locality: 'City ${i + 1}',
            ),
        ],
      );
      expect(find.byType(GvPrimerNotice), findsOneWidget);
      final Map<String, double> at = <String, double>{};
      for (final (String label, double drag) in const <(String, double)>[
        ('Drivers', -300),
        ('Teams', -150),
        ('Circuits', -220),
      ]) {
        await tester.tap(_segment(label));
        await tester.pumpAndSettle();
        expect(_offset(tester), 0, reason: 'a fresh list starts at the top');
        await tester.drag(_list, Offset(0, drag));
        await tester.pumpAndSettle();
        at[label] = _offset(tester);
        expect(at[label], greaterThan(0));
      }
      for (final String label in const <String>[
        'Teams',
        'Drivers',
        'Circuits',
        'Teams',
      ]) {
        await tester.tap(_segment(label));
        await tester.pumpAndSettle();
        expect(_offset(tester), closeTo(at[label]!, 0.5), reason: label);
      }
    });
  });

  group('last-successful-check caption', () {
    String time(DateTime t) => DateFormat.Hm('en').format(t.toLocal());

    testWidgets("each collection shows only its own resource's time", (
      WidgetTester tester,
    ) async {
      final DateTime drivers = DateTime.utc(2026, 7, 18, 9, 5);
      final DateTime teams = DateTime.utc(2026, 7, 18, 11, 45);
      await _pump(
        tester,
        metadata: (String key) => switch (key) {
          'drivers:2026' => syncedMetadata(key, lastSuccessAt: drivers),
          'constructors:2026' => syncedMetadata(key, lastSuccessAt: teams),
          'circuits:2026' => null,
          _ => syncedMetadata(key),
        },
      );
      expect(
        find.text('Last successful check: ${time(drivers)}'),
        findsOneWidget,
      );
      await tester.tap(_segment('Teams'));
      await tester.pumpAndSettle();
      expect(
        find.text('Last successful check: ${time(teams)}'),
        findsOneWidget,
      );
      expect(
        find.text('Last successful check: ${time(drivers)}'),
        findsNothing,
      );
      await tester.tap(_segment('Circuits'));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey<String>('explore-freshness')),
        findsNothing,
        reason: 'no record of its own: no time is borrowed',
      );
    });

    testWidgets('while refreshing, the previous time stays with the progress '
        'line', (WidgetTester tester) async {
      final DateTime drivers = DateTime.utc(2026, 7, 18, 9, 5);
      await _pump(
        tester,
        metadata: (String key) => syncedMetadata(key, lastSuccessAt: drivers),
      );
      await _publish(tester, const AppSyncRunning(trigger: SyncTrigger.manual));
      expect(
        find.text('Last successful check: ${time(drivers)}'),
        findsOneWidget,
      );
      expect(find.byType(ExploreProgressLine), findsOneWidget);
    });
  });

  group('loading skeleton (EF-4)', () {
    testWidgets('no media column: no image squares; lines start at the '
        "rows' text column", (WidgetTester tester) async {
      await _pump(
        tester,
        driversStream: (int s) => const Stream<List<SeasonDriverCard>>.empty(),
      );
      final Finder blocks = find.descendant(
        of: find.byType(ExploreSkeleton),
        matching: find.byType(GvPrimerSkeleton),
      );
      expect(blocks, findsNWidgets(12), reason: 'six rows of two lines');
      expect(
        find.byKey(const ValueKey<String>('explore-skeleton-slot')),
        findsNothing,
      );
      final double start = GvPrimerLayout.gutter + ExploreEntityRow.lane;
      expect(tester.getTopLeft(blocks.at(0)).dx, start);
      expect(tester.getTopLeft(blocks.at(1)).dx, start);
      // The name line spans the text column (to the gutter); the second line
      // is 60% of it, aligned to the start.
      final double column = 390 - start - GvPrimerLayout.gutter;
      expect(tester.getSize(blocks.at(0)).width, column);
      expect(tester.getSize(blocks.at(1)).width, closeTo(column * 0.6, 0.01));
      expect(
        tester
            .getSize(
              find.byKey(const ValueKey<String>('explore-skeleton-row-0')),
            )
            .height,
        76,
      );
    });

    testWidgets('with a media column: the 40dp slot at the gutter, lines at '
        "the media rows' text column", (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildGridViewDarkTheme(),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: ExploreSkeleton(mediaColumn: true)),
        ),
      );
      final Finder slots = find.byKey(
        const ValueKey<String>('explore-skeleton-slot'),
      );
      expect(slots, findsNWidgets(6));
      expect(tester.getSize(slots.first), const Size(40, 40));
      expect(tester.getTopLeft(slots.first).dx, GvPrimerLayout.gutter);
      final Finder line = find
          .descendant(
            of: find.byKey(const ValueKey<String>('explore-skeleton-row-0')),
            matching: find.byType(GvPrimerSkeleton),
          )
          .at(1);
      expect(
        tester.getTopLeft(line).dx,
        GvPrimerLayout.gutter +
            ExploreEntityRow.mediaSlot +
            ExploreEntityRow.mediaGap,
      );
    });
  });

  group('responsive matrix (EN/ES × 390@100% / 320@200% × Dark/Light × '
      'categories)', () {
    for (final Locale locale in const <Locale>[Locale('en'), Locale('es')]) {
      for (final (Size size, double scale) in const <(Size, double)>[
        (Size(390, 844), 1),
        (Size(320, 693), 2),
      ]) {
        for (final AppThemePreference theme in const <AppThemePreference>[
          AppThemePreference.dark,
          AppThemePreference.light,
        ]) {
          for (final (String location, String lastKey)
              in const <(String, String)>[
                ('/explore/drivers', 'explore-driver-reserve-entrant'),
                ('/explore/teams', 'explore-team-red-bull'),
                ('/explore/circuits', 'explore-circuit-spa-francorchamps'),
              ]) {
            final String name =
                '${locale.languageCode} ${size.width.toInt()}@'
                '${(scale * 100).toInt()}% ${theme.wire} $location';
            testWidgets('$name: no overflow; header above the navigation; '
                'the last row clears the navigation', (
              WidgetTester tester,
            ) async {
              await loadArchivo(tester);
              await _pump(
                tester,
                location: location,
                surfaceSize: size,
                locale: locale,
                textScale: scale,
                theme: theme,
              );
              expect(tester.takeException(), isNull);
              final Rect header = tester.getRect(find.byType(ExploreHeader));
              final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
              expect(header.bottom, lessThan(nav.top), reason: name);
              for (int i = 0; i < 3; i++) {
                final ScrollPosition p = tester
                    .state<ScrollableState>(_list)
                    .position;
                p.jumpTo(p.maxScrollExtent);
                await tester.pumpAndSettle();
              }
              expect(tester.takeException(), isNull);
              final Rect last = tester.getRect(
                find.byKey(ValueKey<String>(lastKey)),
              );
              expect(last.bottom, lessThanOrEqualTo(nav.top), reason: name);
              // Step 55C.15R (owner decision D1): at 320 @200% a circuit row
              // (≈293px) is taller than the list left by the approved 2 × 2
              // navigation (251px), so "the whole last row is in view" cannot
              // hold. The row must still be traversable: every line of its
              // text and its media slot can be scrolled whole into view, and
              // its one action (the row) takes a tap. A row that fits keeps
              // the original whole-row check.
              final Finder lastRow = find.byKey(ValueKey<String>(lastKey));
              final Rect area = visibleListArea(
                tester,
                scrollable: _list,
                header: find.byType(ExploreHeader),
                navigation: find.byType(GvPrimerBottomNav),
              );
              if (last.height <= area.height) {
                expect(last.top, greaterThanOrEqualTo(header.bottom));
              }
              await expectReachable(
                tester,
                target: lastRow,
                scrollable: _list,
                header: find.byType(ExploreHeader),
                navigation: find.byType(GvPrimerBottomNav),
                reason: '$name last row',
              );
              final Finder media = find.descendant(
                of: lastRow,
                matching: find.byWidgetPredicate(
                  (Widget w) =>
                      w is SizedBox &&
                      w.width == ExploreEntityRow.mediaSlot &&
                      w.height == ExploreEntityRow.mediaSlot,
                ),
              );
              if (media.evaluate().isNotEmpty) {
                await expectReachable(
                  tester,
                  target: media.first,
                  scrollable: _list,
                  header: find.byType(ExploreHeader),
                  navigation: find.byType(GvPrimerBottomNav),
                  reason: '$name media',
                );
              }
              expect(tester.takeException(), isNull);
            });
          }
        }
      }
    }

    testWidgets('es 320@200% with the N-2 notice: no overflow and the last '
        'row stays reachable', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _pump(
        tester,
        surfaceSize: const Size(320, 693),
        locale: const Locale('es'),
        textScale: 2,
        metadata: _driversStale,
      );
      await _publish(
        tester,
        _outcome('drivers:2026', ResourceSyncOutcomeKind.failed),
      );
      expect(tester.takeException(), isNull);
      for (int i = 0; i < 3; i++) {
        final ScrollPosition p = tester.state<ScrollableState>(_list).position;
        p.jumpTo(p.maxScrollExtent);
        await tester.pumpAndSettle();
      }
      final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
      expect(
        tester
            .getRect(
              find.byKey(
                const ValueKey<String>('explore-driver-reserve-entrant'),
              ),
            )
            .bottom,
        lessThanOrEqualTo(nav.top),
      );
    });
  });
}
