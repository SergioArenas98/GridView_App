import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
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
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/presentation/widgets/mock_data_banner.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';
import 'package:gridview/l10n/app_localizations.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

/// Step 55C.2.1: the owner-approved production N-6. On the first useful
/// Calendar render, a failure or stale-data notice is brought into view ahead
/// of the next-race anchor; with no notice the anchor is unchanged. The
/// decision is taken once: restored positions, later notices, later Drift
/// emissions and the user's own scrolling are never overridden.
///
/// Visibility is checked against the real viewport: the list's own rect,
/// below the pinned header and above the bottom navigation — not merely the
/// widget's presence in the tree.

/// Before the clock the harness pins (2026-07-18 12:10Z): a stale resource.
final DateTime _past = DateTime.utc(2026, 7, 18, 11);

FakeRaceWeekendRepository _repository() => FakeRaceWeekendRepository(
  home: homeViewFixture(),
  // Home is the starting tab of the "already failed" openings and a tab-switch
  // stop, so it needs its dashboard to settle.
  dashboard: homeDashboardFixture(),
  calendar: (int season) => calendarFixture(season: season),
  grandPrix: (int season, int round) => grandPrixDetailFixture(season, round),
);

/// Pumps the app at [initialLocation]; the Calendar resource is stale when
/// [stale], and [metadata] overrides the metadata streams entirely.
///
/// The Primer V2 bottom navigation (Step 55C.15) fits its labels by their
/// measured width, so the real Archivo metrics are loaded: with the test font
/// every label is too wide and the bar would take its 2 × 2 layout at sizes
/// where the app shows one row.
Future<GoRouter> _pump(
  WidgetTester tester, {
  String initialLocation = '/calendar',
  Size surfaceSize = const Size(390, 844),
  Locale locale = const Locale('en'),
  double textScale = 1,
  AppThemePreference theme = AppThemePreference.dark,
  bool stale = false,
  bool mockData = false,
  Stream<ResourceSyncState?> Function(String key)? metadata,
}) async {
  await loadArchivo(tester);
  return pumpApp(
    tester,
    initialLocation: initialLocation,
    surfaceSize: surfaceSize,
    locale: locale,
    textScale: textScale,
    disableAnimations: true,
    mockData: mockData,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
    syncMetadata: (String key) =>
        syncedMetadata(key, staleAfter: stale ? _past : null),
    syncMetadataStream: metadata,
    repository: _repository(),
  );
}

/// Publishes a finished application run in which `calendar:2026` failed.
Future<void> _failCalendarRefresh(WidgetTester tester) async {
  containerOf(tester)
      .read(appSyncStateProvider.notifier)
      .publish(
        const AppSyncCompleted(
          trigger: SyncTrigger.manual,
          outcomes: <ResourceSyncOutcome>[
            ResourceSyncOutcome(
              resourceKey: 'calendar:2026',
              kind: ResourceSyncOutcomeKind.failed,
              failure: ApiFailureKind.networkUnavailable,
            ),
          ],
        ),
      );
  await tester.pumpAndSettle();
}

/// Opens the Calendar for the first time in this branch session from Home,
/// after the refresh failure is already known: the screen's first useful
/// render carries the failure notice.
Future<void> _openCalendarAfterFailure(
  WidgetTester tester, {
  Size surfaceSize = const Size(390, 844),
  Locale locale = const Locale('en'),
  double textScale = 1,
  AppThemePreference theme = AppThemePreference.dark,
  bool stale = false,
}) async {
  final GoRouter router = await _pump(
    tester,
    initialLocation: '/',
    surfaceSize: surfaceSize,
    locale: locale,
    textScale: textScale,
    theme: theme,
    stale: stale,
  );
  expect(
    find.byType(CalendarScreen),
    findsNothing,
    reason: 'the Calendar branch is built on its first visit',
  );
  await _failCalendarRefresh(tester);
  router.go('/calendar');
  await tester.pumpAndSettle();
}

Finder get _list => find
    .descendant(
      of: find.byType(CalendarScreen),
      matching: find.byType(Scrollable),
    )
    .first;

ScrollPosition _position(WidgetTester tester) =>
    tester.state<ScrollableState>(_list).position;

/// The part of the screen where list content can actually be seen: the list's
/// viewport, below the pinned header and above the bottom navigation.
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

/// A row is in view when its start (round, name) is visible: the emphasised
/// row can be taller than the viewport at large text on a narrow screen.
void _expectStartsInView(WidgetTester tester, Finder finder, String reason) {
  expect(finder, findsOneWidget, reason: reason);
  final Rect rect = tester.getRect(finder);
  final Rect area = _visibleArea(tester);
  expect(
    rect.top >= area.top - 0.5 && rect.top < area.bottom,
    isTrue,
    reason: '$reason: $rect does not start inside the visible area $area',
  );
}

void _expectFullyVisible(WidgetTester tester, Finder finder, String reason) {
  expect(finder, findsOneWidget, reason: reason);
  expect(
    _fullyVisible(tester, finder),
    isTrue,
    reason:
        '$reason: ${tester.getRect(finder)} lies outside the visible area '
        '${_visibleArea(tester)}',
  );
}

/// The current or next Grand Prix (the one highlighted race row).
final Finder _nextRow = find.byWidgetPredicate(
  (Widget w) => w is GvPrimerRaceRow && w.highlighted,
);

Finder get _notice => find.byType(GvPrimerNotice);

GvPrimerNotice _onlyNotice(WidgetTester tester) =>
    tester.widget<GvPrimerNotice>(_notice);

void main() {
  group('initial positioning chooses notice or next event (N-6)', () {
    testWidgets('no notice: the next-event anchor is preserved', (
      WidgetTester tester,
    ) async {
      await _pump(tester);

      expect(_notice, findsNothing);
      expect(
        _position(tester).pixels,
        greaterThan(0),
        reason: 'the list opened at the next round, not at round 1',
      );
      _expectStartsInView(tester, _nextRow, 'next event');
    });

    testWidgets('stale data on opening: the stale notice is visible', (
      WidgetTester tester,
    ) async {
      await _pump(tester, stale: true);

      expect(_onlyNotice(tester).cause, GvPrimerNoticeCause.stale);
      _expectFullyVisible(tester, _notice, 'stale notice');
    });

    testWidgets('refresh failure on opening: the failure notice is visible', (
      WidgetTester tester,
    ) async {
      await _openCalendarAfterFailure(tester);

      expect(_onlyNotice(tester).cause, GvPrimerNoticeCause.failure);
      expect(
        _onlyNotice(tester).message,
        "Couldn't refresh — showing saved data.",
      );
      _expectFullyVisible(tester, _notice, 'failure notice');
    });

    testWidgets('failure over stale data on opening: the combined N-2 notice '
        'is visible', (WidgetTester tester) async {
      await _openCalendarAfterFailure(tester, stale: true);

      expect(_notice, findsOneWidget);
      expect(_onlyNotice(tester).cause, GvPrimerNoticeCause.failure);
      expect(
        _onlyNotice(tester).message,
        "Couldn't refresh. Saved data may be out of date.",
      );
      _expectFullyVisible(tester, _notice, 'combined notice');
    });

    testWidgets('the first notice in reading order is the target', (
      WidgetTester tester,
    ) async {
      // Calendar state can never show two notices: its only two causes
      // concern one resource and combine (N-2). The target is therefore the
      // first, and only, notice, in N-1 order.
      final AppLocalizations l10n = await AppLocalizations.delegate.load(
        const Locale('en'),
      );
      for (final (bool failed, bool stale) in const <(bool, bool)>[
        (true, true),
        (true, false),
        (false, true),
      ]) {
        final List<CalendarNoticeSpec> notices = calendarNotices(
          failed: failed,
          stale: stale,
          l10n: l10n,
        );
        expect(notices, hasLength(1));
        expect(
          notices.first.cause,
          failed ? GvPrimerNoticeCause.failure : GvPrimerNoticeCause.stale,
        );
      }
    });

    testWidgets('content before the notice is scrolled past when it would '
        'leave the notice out of view, never to the bare top', (
      WidgetTester tester,
    ) async {
      // 320 @200% with the caption and the sample-data banner above the
      // notice: at the top of the content the notice is cut off by the bottom
      // navigation, so offset zero is not enough. Spanish since Step 55C.15:
      // with the real Archivo metrics the English notice already fits at the
      // top, so it would no longer exercise this path.
      await _pump(
        tester,
        surfaceSize: const Size(320, 693),
        textScale: 2,
        stale: true,
        mockData: true,
        locale: const Locale('es'),
      );

      expect(find.byType(MockDataBanner), findsOneWidget);
      expect(
        _position(tester).pixels,
        greaterThan(0),
        reason: 'the notice needed the list to move',
      );
      _expectFullyVisible(tester, _notice, 'notice below the banner');

      // At the bare top it really would not have been visible.
      _position(tester).jumpTo(0);
      await tester.pump();
      expect(_fullyVisible(tester, _notice), isFalse);
    });
  });

  group('restored positions and user scrolling are protected', () {
    testWidgets('returning from Grand Prix detail restores the position', (
      WidgetTester tester,
    ) async {
      await _pump(tester, stale: true);
      _expectFullyVisible(tester, _notice, 'stale notice on opening');

      const Key target = ValueKey<String>('calendar-event-14');
      await scrollToKey(tester, CalendarScreen, target);
      final double offset = _position(tester).pixels;
      expect(offset, greaterThan(0));

      await tester.tap(find.byKey(target));
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();

      expect(_position(tester).pixels, offset);
    });

    testWidgets('returning from another tab restores the position', (
      WidgetTester tester,
    ) async {
      await _pump(tester, stale: true);
      await scrollToKey(
        tester,
        CalendarScreen,
        const ValueKey<String>('calendar-event-12'),
      );
      final double offset = _position(tester).pixels;
      expect(offset, greaterThan(0));

      await tapNav(tester, 'Home');
      await tapNav(tester, 'Calendar');

      expect(_position(tester).pixels, offset);
    });

    testWidgets('a failure arriving after positioning does not jump', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      final double anchored = _position(tester).pixels;
      expect(anchored, greaterThan(0));

      await _failCalendarRefresh(tester);

      expect(_position(tester).pixels, anchored);
      _expectStartsInView(tester, _nextRow, 'next event stays in view');
      // The notice belongs to the top of the content, which is not forced
      // into view (it may not even be built at this offset).
      expect(
        _notice.evaluate().isEmpty || !_fullyVisible(tester, _notice),
        isTrue,
      );
    });

    testWidgets('a later Drift emission does not re-anchor', (
      WidgetTester tester,
    ) async {
      await _pump(tester, stale: true);
      await scrollToKey(
        tester,
        CalendarScreen,
        const ValueKey<String>('calendar-event-15'),
      );
      final double offset = _position(tester).pixels;

      // The coordinator's refresh starts and ends, and the record is rewritten.
      await _failCalendarRefresh(tester);
      containerOf(tester)
          .read(appSyncStateProvider.notifier)
          .publish(
            const AppSyncCompleted(
              trigger: SyncTrigger.manual,
              outcomes: <ResourceSyncOutcome>[
                ResourceSyncOutcome(
                  resourceKey: 'calendar:2026',
                  kind: ResourceSyncOutcomeKind.applied,
                ),
              ],
            ),
          );
      await tester.pumpAndSettle();

      expect(_position(tester).pixels, offset);
    });
  });

  group('freshness answering after the first rows (deferred decision)', () {
    /// The Calendar record answers only when the test says so; every other
    /// record answers at once.
    Stream<ResourceSyncState?> Function(String key) heldCalendarRecord(
      StreamController<ResourceSyncState?> held,
    ) =>
        (String key) => key == 'calendar:2026'
        ? held.stream
        : Stream<ResourceSyncState?>.value(syncedMetadata(key));

    testWidgets('a stale record answering late still puts the notice first', (
      WidgetTester tester,
    ) async {
      final StreamController<ResourceSyncState?> held =
          StreamController<ResourceSyncState?>.broadcast();
      addTearDown(held.close);
      await _pump(tester, metadata: heldCalendarRecord(held));

      expect(
        _position(tester).pixels,
        0,
        reason: 'rows are shown, but the positioning waits for freshness',
      );
      expect(_notice, findsNothing);

      held.add(syncedMetadata('calendar:2026', staleAfter: _past));
      await tester.pumpAndSettle();

      expect(_onlyNotice(tester).cause, GvPrimerNoticeCause.stale);
      _expectFullyVisible(tester, _notice, 'late stale notice');
    });

    testWidgets('a fresh record answering late still anchors the next event', (
      WidgetTester tester,
    ) async {
      final StreamController<ResourceSyncState?> held =
          StreamController<ResourceSyncState?>.broadcast();
      addTearDown(held.close);
      await _pump(tester, metadata: heldCalendarRecord(held));
      expect(_position(tester).pixels, 0);

      held.add(syncedMetadata('calendar:2026'));
      await tester.pumpAndSettle();

      expect(_notice, findsNothing);
      expect(_position(tester).pixels, greaterThan(0));
      _expectStartsInView(tester, _nextRow, 'next event');
    });

    testWidgets('scrolling before the deferred positioning is never '
        'overridden', (WidgetTester tester) async {
      final StreamController<ResourceSyncState?> held =
          StreamController<ResourceSyncState?>.broadcast();
      addTearDown(held.close);
      await _pump(tester, metadata: heldCalendarRecord(held));

      await tester.drag(_list, const Offset(0, -150));
      await tester.pumpAndSettle();
      final double scrolled = _position(tester).pixels;
      expect(scrolled, greaterThan(0));

      // A fresh record would otherwise anchor the next event.
      held.add(syncedMetadata('calendar:2026'));
      await tester.pumpAndSettle();

      expect(_position(tester).pixels, scrolled);
    });
  });

  group('CalendarScrollAnchor', () {
    Widget host(CalendarScrollAnchor anchor, {required bool reveal}) {
      return MaterialApp(
        home: Builder(
          builder: (BuildContext context) {
            if (reveal) anchor.revealItem(index: 150, itemCount: 200);
            return NotificationListener<ScrollNotification>(
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
            );
          },
        ),
      );
    }

    CalendarScrollAnchor anchorFor(ScrollController controller) =>
        CalendarScrollAnchor(
          controller: controller,
          anchorKey: GlobalKey(),
          noticeKey: GlobalKey(),
        );

    testWidgets('without interference it converges on the item', (
      WidgetTester tester,
    ) async {
      final ScrollController controller = ScrollController();
      addTearDown(controller.dispose);
      final CalendarScrollAnchor anchor = anchorFor(controller);
      await tester.pumpWidget(host(anchor, reveal: true));
      await tester.pumpAndSettle();

      expect(find.text('item 150'), findsOneWidget);
      expect(controller.position.pixels, greaterThan(0));
    });

    testWidgets('a drag between its passes cancels the remaining passes', (
      WidgetTester tester,
    ) async {
      final ScrollController controller = ScrollController();
      addTearDown(controller.dispose);
      final CalendarScrollAnchor anchor = anchorFor(controller);
      // The first frame runs the first pass: item 150 is not built, so the
      // list jumps to an estimate and schedules another pass.
      await tester.pumpWidget(host(anchor, reveal: true));
      final double estimate = controller.position.pixels;
      expect(estimate, greaterThan(0));

      // The user drags before the next frame's pass runs.
      await tester.drag(find.byType(ListView), const Offset(0, 200));
      final double dragged = controller.position.pixels;
      expect(anchor.userScrolled, isTrue);

      await tester.pumpAndSettle();
      expect(
        controller.position.pixels,
        dragged,
        reason: 'no later pass moved the list after the user scrolled',
      );
    });

    testWidgets('a restored position is kept, with no scroll gesture at all', (
      WidgetTester tester,
    ) async {
      // A list rebuilt with a new controller restores its offset from page
      // storage: no user notification is ever dispatched, yet the position is
      // not the controller's initial offset, so it is the user's to keep.
      Widget storedList(ScrollController controller) => MaterialApp(
        home: ListView.builder(
          key: const PageStorageKey<String>('stored'),
          controller: controller,
          itemCount: 200,
          itemBuilder: (BuildContext context, int i) =>
              SizedBox(height: 60, child: Text('item $i')),
        ),
      );
      final ScrollController first = ScrollController();
      addTearDown(first.dispose);
      await tester.pumpWidget(storedList(first));
      first.jumpTo(400);
      await tester.pump();

      final ScrollController second = ScrollController();
      addTearDown(second.dispose);
      final CalendarScrollAnchor anchor = anchorFor(second);
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (BuildContext context) {
              anchor.revealItem(index: 150, itemCount: 200);
              return ListView.builder(
                key: const PageStorageKey<String>('stored'),
                controller: second,
                itemCount: 200,
                itemBuilder: (BuildContext context, int i) => SizedBox(
                  key: i == 150 ? anchor.anchorKey : null,
                  height: 60,
                  child: Text('item $i'),
                ),
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(anchor.userScrolled, isFalse);
      expect(second.position.pixels, 400);
      expect(find.text('item 150'), findsNothing);
    });

    testWidgets('the decision is taken once and a scroll first keeps it', (
      WidgetTester tester,
    ) async {
      final ScrollController controller = ScrollController();
      addTearDown(controller.dispose);
      final CalendarScrollAnchor anchor = anchorFor(controller);
      await tester.pumpWidget(host(anchor, reveal: false));
      await tester.drag(find.byType(ListView), const Offset(0, -120));
      await tester.pumpAndSettle();
      final double scrolled = controller.position.pixels;

      anchor.revealItem(index: 150, itemCount: 200);
      await tester.pumpAndSettle();
      expect(anchor.decided, isTrue);
      expect(controller.position.pixels, scrolled);

      anchor.revealNotice();
      anchor.revealItem(index: 150, itemCount: 200);
      await tester.pumpAndSettle();
      expect(controller.position.pixels, scrolled);
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

          testWidgets('$name: the combined notice is visible on opening', (
            WidgetTester tester,
          ) async {
            await _openCalendarAfterFailure(
              tester,
              surfaceSize: size,
              locale: locale,
              textScale: scale,
              theme: theme,
              stale: true,
            );
            expect(tester.takeException(), isNull);
            _expectFullyVisible(tester, _notice, name);
            expect(_onlyNotice(tester).cause, GvPrimerNoticeCause.failure);
          });

          testWidgets('$name: without a notice the next event is in view', (
            WidgetTester tester,
          ) async {
            await _pump(
              tester,
              surfaceSize: size,
              locale: locale,
              textScale: scale,
              theme: theme,
            );
            expect(tester.takeException(), isNull);
            expect(_notice, findsNothing);
            expect(_position(tester).pixels, greaterThan(0), reason: name);
            _expectStartsInView(tester, _nextRow, name);
          });
        }
      }
    }
  });
}
