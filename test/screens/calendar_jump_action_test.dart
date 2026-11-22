import 'dart:math' as math;
import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_header.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_scroll_anchor.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_status_block.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../support/a11y_harness.dart';
import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

/// Step 55C.2.2 (XS-19): the user-initiated "Go to next / current Grand Prix"
/// action after a Calendar notice. It appears only with a notice and a
/// relevant row, moves nothing by being there, and on activation positions the
/// list exactly as the opening without a notice would (same anchor, same
/// target, top alignment for an oversized row), without opening the detail.

/// Before the clock the harness pins (2026-07-18 12:10Z): a stale resource.
final DateTime _past = DateTime.utc(2026, 7, 18, 11);

const int _seasonLength = 23;

String _date(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

DateTime _start(int round) =>
    DateTime.utc(2026, 3, 6).add(Duration(days: 14 * (round - 1)));

/// A deterministic, synthetic 23-round season (no real or private data):
/// rounds before [target] completed, [target] in progress when [current],
/// later rounds scheduled; or every round completed when [target] is null.
List<CalendarEntry> _season({
  int? target = 18,
  bool current = false,
}) => <CalendarEntry>[
  for (int round = 1; round <= _seasonLength; round++)
    calendarEntry(
      round: round,
      name: 'Round $round Grand Prix',
      startDate: _date(_start(round)),
      endDate: _date(_start(round).add(const Duration(days: 2))),
      status: target == null || round < target
          ? EventStatus.completed
          : (round == target && current
                ? EventStatus.inProgress
                : EventStatus.scheduled),
      format: round % 4 == 2 ? WeekendFormat.sprint : WeekendFormat.standard,
      circuit: Circuit(
        id: 'circuit-$round',
        name: 'Circuit $round',
        locality: 'Town $round',
        country: 'Country $round',
      ),
    ),
];

/// A clock three days before [round] starts.
DateTime _clockBefore(int round) => _start(
  round,
).subtract(const Duration(days: 3)).add(const Duration(hours: 12));

Future<GoRouter> _pump(
  WidgetTester tester, {
  String initialLocation = '/calendar',
  Size surfaceSize = const Size(390, 844),
  Locale locale = const Locale('en'),
  double textScale = 1,
  AppThemePreference theme = AppThemePreference.dark,
  bool stale = true,
  List<CalendarEntry>? calendar,
  DateTime? clock,
}) => pumpApp(
  tester,
  initialLocation: initialLocation,
  surfaceSize: surfaceSize,
  locale: locale,
  textScale: textScale,
  disableAnimations: true,
  clock: clock,
  preferences: AppPreferences.defaults.copyWith(theme: theme),
  syncMetadata: (String key) =>
      syncedMetadata(key, staleAfter: stale ? _past : null),
  repository: FakeRaceWeekendRepository(
    home: homeViewFixture(),
    dashboard: homeDashboardFixture(),
    calendar: (int season) => calendar ?? calendarFixture(season: season),
    grandPrix: (int season, int round) => grandPrixDetailFixture(season, round),
  ),
);

/// The full synthetic season, stale, with round 18 next.
Future<GoRouter> _pumpSeason(
  WidgetTester tester, {
  Size surfaceSize = const Size(390, 844),
  Locale locale = const Locale('en'),
  double textScale = 1,
  AppThemePreference theme = AppThemePreference.dark,
  bool stale = true,
  bool current = false,
}) => _pump(
  tester,
  surfaceSize: surfaceSize,
  locale: locale,
  textScale: textScale,
  theme: theme,
  stale: stale,
  calendar: _season(current: current),
  clock: _clockBefore(18),
);

Future<void> _publish(WidgetTester tester, {ApiFailureKind? failure}) async {
  containerOf(tester)
      .read(appSyncStateProvider.notifier)
      .publish(
        AppSyncCompleted(
          trigger: SyncTrigger.manual,
          outcomes: <ResourceSyncOutcome>[
            ResourceSyncOutcome(
              resourceKey: 'calendar:2026',
              kind: failure == null
                  ? ResourceSyncOutcomeKind.applied
                  : ResourceSyncOutcomeKind.failed,
              failure: failure,
            ),
          ],
        ),
      );
  await tester.pumpAndSettle();
}

final Finder _action = find.byKey(const ValueKey<String>('calendar-jump'));

Finder get _list => find
    .descendant(
      of: find.byType(CalendarScreen),
      matching: find.byType(Scrollable),
    )
    .first;

ScrollPosition _position(WidgetTester tester) =>
    tester.state<ScrollableState>(_list).position;

Finder _row(int round) => find.byKey(ValueKey<String>('calendar-event-$round'));

final Finder _highlighted = find.byWidgetPredicate(
  (Widget w) => w is GvPrimerRaceRow && w.highlighted,
);

Rect _visibleArea(WidgetTester tester) {
  final Rect list = tester.getRect(_list);
  final Rect header = tester.getRect(find.byType(CalendarHeader));
  final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
  return Rect.fromLTRB(
    list.left,
    math.max(list.top, header.bottom),
    list.right,
    math.min(list.bottom, nav.top),
  );
}

bool _fullyVisible(WidgetTester tester, Finder finder) {
  final Rect rect = tester.getRect(finder);
  final Rect area = _visibleArea(tester);
  return rect.top >= area.top - 0.5 && rect.bottom <= area.bottom + 0.5;
}

void _expectStartsInView(WidgetTester tester, Finder finder, String reason) {
  expect(finder, findsOneWidget, reason: reason);
  final Rect rect = tester.getRect(finder);
  final Rect area = _visibleArea(tester);
  expect(
    rect.top >= area.top - 0.5 && rect.top < area.bottom,
    isTrue,
    reason: '$reason: $rect does not start inside $area',
  );
}

/// Scrolls the action into view, as a user would (at 320 @200% it can lie
/// below the viewport even at the very top of the content).
Future<void> _showAction(WidgetTester tester) async {
  await tester.ensureVisible(
    find.byKey(const ValueKey<String>('calendar-jump')),
  );
  await tester.pumpAndSettle();
}

/// Scrolls to the very top of the content.
Future<void> _toTop(WidgetTester tester) async {
  _position(tester).jumpTo(0);
  await tester.pumpAndSettle();
}

String _label(WidgetTester tester) =>
    tester.widget<CalendarJumpAction>(_action).label;

FocusNode _focusOf(WidgetTester tester, Finder finder) => Focus.of(
  tester.element(
    find.descendant(of: finder, matching: find.byType(GestureDetector)).first,
  ),
);

void main() {
  group('when the action appears and what it says', () {
    testWidgets('stale notice and a future race: "Go to next Grand Prix"', (
      WidgetTester tester,
    ) async {
      await _pumpSeason(tester);
      expect(_action, findsOneWidget);
      expect(_label(tester), 'Go to next Grand Prix');
    });

    testWidgets('Spanish: "Ir al próximo Gran Premio"', (
      WidgetTester tester,
    ) async {
      await _pumpSeason(tester, locale: const Locale('es'));
      expect(_label(tester), 'Ir al próximo Gran Premio');
    });

    testWidgets('a race in progress: "Go to current Grand Prix"', (
      WidgetTester tester,
    ) async {
      await _pumpSeason(tester, current: true);
      expect(_label(tester), 'Go to current Grand Prix');
    });

    testWidgets('Spanish in progress: "Ir al Gran Premio en curso"', (
      WidgetTester tester,
    ) async {
      await _pumpSeason(tester, current: true, locale: const Locale('es'));
      expect(_label(tester), 'Ir al Gran Premio en curso');
    });

    testWidgets('a race whose dates have passed is not "current"', (
      WidgetTester tester,
    ) async {
      // Round 17's weekend is over but it is neither completed nor
      // classified: the shared selection makes it neither current nor next,
      // so the wording stays "next" (round 18), never inferred from time.
      final List<CalendarEntry> season = _season()
        ..[16] = calendarEntry(
          round: 17,
          name: 'Round 17 Grand Prix',
          startDate: _date(_start(17)),
          endDate: _date(_start(17).add(const Duration(days: 2))),
          circuit: const Circuit(id: 'circuit-17', name: 'Circuit 17'),
        );
      await _pump(tester, calendar: season, clock: _clockBefore(18));
      expect(_label(tester), 'Go to next Grand Prix');
      await tester.tap(_action);
      await tester.pumpAndSettle();
      final GvPrimerRaceRow row = tester.widget<GvPrimerRaceRow>(_highlighted);
      expect(row.highlightLabel, 'Next');
      _expectStartsInView(tester, _row(18), 'round 18');
    });

    testWidgets('inside its weekend window the race is "current", as the '
        'shared selection says', (WidgetTester tester) async {
      await _pump(
        tester,
        calendar: _season(),
        clock: _start(18).add(const Duration(days: 1, hours: 12)),
      );
      expect(_label(tester), 'Go to current Grand Prix');
      await tester.tap(_action);
      await tester.pumpAndSettle();
      // The row agrees: emphasised, without the "Next" kicker.
      expect(
        tester.widget<GvPrimerRaceRow>(_highlighted).highlightLabel,
        isNull,
      );
      _expectStartsInView(tester, _row(18), 'round 18');
    });

    testWidgets('a failure notice alone also offers the action', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(
        tester,
        initialLocation: '/',
        stale: false,
        calendar: _season(),
        clock: _clockBefore(18),
      );
      await _publish(tester, failure: ApiFailureKind.networkUnavailable);
      router.go('/calendar');
      await tester.pumpAndSettle();
      expect(find.byType(GvPrimerNotice), findsOneWidget);
      expect(_action, findsOneWidget);
    });

    testWidgets('the combined N-2 notice has exactly one action', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _pump(
        tester,
        initialLocation: '/',
        calendar: _season(),
        clock: _clockBefore(18),
      );
      await _publish(tester, failure: ApiFailureKind.networkUnavailable);
      router.go('/calendar');
      await tester.pumpAndSettle();
      expect(find.byType(GvPrimerNotice), findsOneWidget);
      expect(
        tester.widget<GvPrimerNotice>(find.byType(GvPrimerNotice)).message,
        "Couldn't refresh. Saved data may be out of date.",
      );
      expect(_action, findsOneWidget);
      expect(find.byType(CalendarJumpAction), findsOneWidget);
    });

    testWidgets('no notice: no action', (WidgetTester tester) async {
      await _pumpSeason(tester, stale: false);
      await _toTop(tester);
      expect(find.byType(GvPrimerNotice), findsNothing);
      expect(find.byType(CalendarJumpAction), findsNothing);
    });

    testWidgets('no relevant race: no action, the notice stays', (
      WidgetTester tester,
    ) async {
      await _pump(tester, calendar: _season(target: null));
      expect(find.byType(GvPrimerNotice), findsOneWidget);
      expect(_highlighted, findsNothing);
      expect(find.byType(CalendarJumpAction), findsNothing);
    });

    testWidgets('an empty season: no action, the notice stays', (
      WidgetTester tester,
    ) async {
      await _pump(tester, calendar: const <CalendarEntry>[]);
      expect(find.text('No races scheduled yet'), findsOneWidget);
      expect(find.byType(GvPrimerNotice), findsOneWidget);
      expect(find.byType(CalendarJumpAction), findsNothing);
    });

    testWidgets('first loading without rows: no action', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        disableAnimations: true,
        syncMetadata: (String key) => syncedMetadata(key, staleAfter: _past),
        repository: FakeRaceWeekendRepository(
          home: homeViewFixture(),
          calendarStream: (int season) =>
              const Stream<List<CalendarEntry>>.empty(),
        ),
      );
      expect(find.byKey(const ValueKey<String>('calendar-skeleton')), findsOne);
      expect(find.byType(CalendarJumpAction), findsNothing);
    });
  });

  group('activation positions the list only', () {
    testWidgets('full season: it lands where the opening without a notice '
        'lands, without opening the detail', (WidgetTester tester) async {
      // The reference: the same season opened without a notice.
      await _pumpSeason(tester, stale: false);
      expect(_position(tester).pixels, greaterThan(0));
      final double reference = tester.getRect(_row(18)).top;
      // A fresh screen: otherwise the next pump reuses this one's State.
      await tester.pumpWidget(const SizedBox.shrink());

      await _pumpSeason(tester);
      expect(_row(18), findsNothing, reason: 'notice-first opening');
      expect(tester.getRect(_action).height, greaterThanOrEqualTo(48));

      await tester.tap(_action);
      await tester.pumpAndSettle();

      // The same row at the same place on screen as the opening without a
      // notice (the notice and the action only add height above the rows).
      expect(tester.getRect(_row(18)).top, closeTo(reference, 0.5));
      _expectStartsInView(tester, _row(18), 'round 18');
      expect(find.byType(GrandPrixDetailScreen), findsNothing);
    });

    testWidgets('an oversized row is aligned by its top', (
      WidgetTester tester,
    ) async {
      // 320 @200%: the emphasised round 13 row is taller than the viewport.
      await _pump(tester, surfaceSize: const Size(320, 693), textScale: 2);
      await _showAction(tester);
      await tester.tap(_action);
      await tester.pumpAndSettle();

      final Rect row = tester.getRect(_row(13));
      final Rect area = _visibleArea(tester);
      expect(row.height, greaterThan(area.height));
      expect(row.top, closeTo(area.top, 0.5));
    });

    testWidgets('the route stays the Calendar', (WidgetTester tester) async {
      final GoRouter router = await _pumpSeason(tester);
      await tester.tap(_action);
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, '/calendar');
      expect(find.byType(CalendarScreen), findsOneWidget);
    });

    testWidgets('after a jump, another tab and the detail restore the '
        'position', (WidgetTester tester) async {
      final GoRouter router = await _pumpSeason(tester);
      await tester.tap(_action);
      await tester.pumpAndSettle();
      final double jumped = _position(tester).pixels;

      router.go('/');
      await tester.pumpAndSettle();
      router.go('/calendar');
      await tester.pumpAndSettle();
      expect(_position(tester).pixels, jumped);

      await tester.tap(find.text('Round 18 Grand Prix'));
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      router.pop();
      await tester.pumpAndSettle();
      expect(_position(tester).pixels, jumped);
    });

    testWidgets('later refreshes and notice changes never jump', (
      WidgetTester tester,
    ) async {
      await _pumpSeason(tester);
      final double opening = _position(tester).pixels;

      // The notice turns into N-2, then the refresh succeeds: the action
      // is there throughout, but nothing moves.
      await _publish(tester, failure: ApiFailureKind.networkUnavailable);
      expect(_position(tester).pixels, opening);
      await _publish(tester);
      expect(_position(tester).pixels, opening);

      // After a jump too.
      await tester.tap(_action);
      await tester.pumpAndSettle();
      final double jumped = _position(tester).pixels;
      await _publish(tester, failure: ApiFailureKind.networkUnavailable);
      expect(_position(tester).pixels, jumped);
    });

    testWidgets('later emissions after a jump never move the list', (
      WidgetTester tester,
    ) async {
      await _pumpSeason(tester);
      await tester.tap(_action);
      await tester.pumpAndSettle();
      final double jumped = _position(tester).pixels;
      // Every later emission leaves the user's chosen position alone.
      await _publish(tester);
      await _publish(tester, failure: ApiFailureKind.serverUnavailable);
      expect(_position(tester).pixels, jumped);
    });
  });

  group('CalendarScrollAnchor.jumpToItem', () {
    Widget host(CalendarScrollAnchor anchor) => MaterialApp(
      home: NotificationListener<ScrollNotification>(
        onNotification: anchor.handleScrollNotification,
        child: ListView.builder(
          controller: anchor.controller,
          itemCount: 200,
          itemBuilder: (BuildContext context, int i) => SizedBox(
            key: i == 150 ? anchor.anchorKey : null,
            height: 60,
            child: Text('item $i'),
          ),
        ),
      ),
    );

    CalendarScrollAnchor anchorFor(WidgetTester tester) {
      final ScrollController controller = ScrollController();
      addTearDown(controller.dispose);
      return CalendarScrollAnchor(
        controller: controller,
        anchorKey: GlobalKey(),
        noticeKey: GlobalKey(),
      );
    }

    testWidgets('converges on an unbuilt item without animation', (
      WidgetTester tester,
    ) async {
      final CalendarScrollAnchor anchor = anchorFor(tester);
      await tester.pumpWidget(host(anchor));
      anchor.jumpToItem(index: 150, itemCount: 200);
      // No animation: a few plain frames, never a settle on a ticker.
      for (int i = 0; i < 4; i++) {
        await tester.pump();
      }
      expect(find.text('item 150'), findsOneWidget);
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('runs even after earlier user scrolling (the user asked)', (
      WidgetTester tester,
    ) async {
      final CalendarScrollAnchor anchor = anchorFor(tester);
      await tester.pumpWidget(host(anchor));
      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pumpAndSettle();
      expect(anchor.userScrolled, isTrue);

      anchor.jumpToItem(index: 150, itemCount: 200);
      await tester.pumpAndSettle();
      expect(find.text('item 150'), findsOneWidget);
    });

    testWidgets('a drag between its passes cancels the rest', (
      WidgetTester tester,
    ) async {
      final CalendarScrollAnchor anchor = anchorFor(tester);
      await tester.pumpWidget(host(anchor));
      anchor.jumpToItem(index: 150, itemCount: 200);
      final double estimate = anchor.controller.position.pixels;
      expect(estimate, greaterThan(0), reason: 'first pass jumped at once');

      await tester.drag(find.byType(ListView), const Offset(0, 200));
      final double dragged = anchor.controller.position.pixels;
      await tester.pumpAndSettle();
      expect(anchor.controller.position.pixels, dragged);
    });

    testWidgets('a jump spends a still-pending automatic decision', (
      WidgetTester tester,
    ) async {
      final CalendarScrollAnchor anchor = anchorFor(tester);
      await tester.pumpWidget(host(anchor));
      expect(anchor.decided, isFalse);
      anchor.jumpToItem(index: 40, itemCount: 200);
      await tester.pumpAndSettle();
      final double jumped = anchor.controller.position.pixels;
      expect(anchor.decided, isTrue);

      anchor.revealItem(index: 150, itemCount: 200);
      anchor.revealNotice();
      await tester.pumpAndSettle();
      expect(anchor.controller.position.pixels, jumped);
    });
  });

  group('keyboard and semantics', () {
    for (final (String name, LogicalKeyboardKey key)
        in <(String, LogicalKeyboardKey)>[
          ('Enter', LogicalKeyboardKey.enter),
          ('Space', LogicalKeyboardKey.space),
        ]) {
      testWidgets('$name on the focused action jumps', (
        WidgetTester tester,
      ) async {
        await _pumpSeason(tester, stale: false);
        final double reference = tester.getRect(_row(18)).top;
        // A fresh screen: otherwise the next pump reuses this one's State.
        await tester.pumpWidget(const SizedBox.shrink());
        await _pumpSeason(tester);

        final FocusNode node = _focusOf(tester, _action);
        node.requestFocus();
        await tester.pump();
        expect(node.hasPrimaryFocus, isTrue);
        await tester.sendKeyEvent(key);
        await tester.pumpAndSettle();

        expect(tester.getRect(_row(18)).top, closeTo(reference, 0.5));
        expect(find.byType(GrandPrixDetailScreen), findsNothing);
      });
    }

    testWidgets('one button named by its words, read after the notice and '
        'before the first round', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pumpSeason(tester);

      final SemanticsData data = nodeLabelled(tester, 'Go to next Grand Prix');
      expect(data.flagsCollection.isButton, isTrue);
      // Focusable: the focus flag is present (true or false), not absent.
      expect(data.flagsCollection.isFocused, isNot(Tristate.none));
      expect(data.hasAction(SemanticsAction.tap), isTrue);
      expect(labelOccurrences(tester, 'Go to next Grand Prix'), 1);
      expectReadingOrder(tester, <String>[
        'Calendar',
        'This data may be out of date',
        'Go to next Grand Prix',
        'Round 1 Grand Prix',
      ]);
      handle.dispose();
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
          testWidgets('$name: fits, is reachable and jumps', (
            WidgetTester tester,
          ) async {
            await loadArchivo(tester);
            await _pumpSeason(
              tester,
              surfaceSize: size,
              locale: locale,
              textScale: scale,
              theme: theme,
            );
            expect(tester.takeException(), isNull);
            final bool atOpening = _fullyVisible(tester, _action);
            final String label = _label(tester);

            await _showAction(tester);
            expect(_fullyVisible(tester, _action), isTrue, reason: name);
            final Rect rect = tester.getRect(_action);
            expect(rect.height, greaterThanOrEqualTo(48), reason: name);
            expect(rect.width, greaterThanOrEqualTo(48), reason: name);

            // Not obscured: a hit at its centre reaches the action.
            final HitTestResult hit = tester.hitTestOnBinding(rect.center);
            final RenderObject target = tester.renderObject(
              find.descendant(of: _action, matching: find.byType(Text)),
            );
            expect(
              hit.path.any(
                (HitTestEntry e) =>
                    e.target == target ||
                    (e.target is RenderObject &&
                        _isAncestor(e.target as RenderObject, target)),
              ),
              isTrue,
              reason: name,
            );

            // No clipped text.
            for (final RenderParagraph p
                in tester.renderObjectList<RenderParagraph>(
                  find.descendant(of: _action, matching: find.byType(RichText)),
                )) {
              expect(p.didExceedMaxLines, isFalse, reason: name);
              expect(
                p.size.height,
                greaterThanOrEqualTo(
                  p.getMaxIntrinsicHeight(p.size.width) - 0.5,
                ),
                reason: name,
              );
              expect(
                p.size.width,
                greaterThanOrEqualTo(
                  p.getMinIntrinsicWidth(double.infinity) - 0.5,
                ),
                reason: name,
              );
            }

            await tester.tap(_action);
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
            _expectStartsInView(tester, _row(18), name);
            debugPrint(
              'XS-19 $name: action fully visible at opening: $atOpening; '
              'label "$label" ${rect.width.toStringAsFixed(0)}×'
              '${rect.height.toStringAsFixed(0)}',
            );
          });
        }
      }
    }
  });
}

bool _isAncestor(RenderObject ancestor, RenderObject node) {
  RenderObject? current = node.parent;
  while (current != null) {
    if (identical(current, ancestor)) return true;
    current = current.parent;
  }
  return false;
}
