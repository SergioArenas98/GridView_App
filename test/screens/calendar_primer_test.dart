import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_event_row.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_header.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

/// Step 55C.2: the Primer V2 Calendar (Stage 1) — notice policy (N-1, N-2,
/// VS-4), XT-2, VS-1, next / current emphasis, the pinned header and the
/// scrolling status, keyboard activation, themes and the responsive matrix.
/// Behaviour already covered by `calendar_widget_test.dart` is not repeated.

/// Before the clock the harness pins (2026-07-18 12:10Z): a stale resource.
final DateTime _past = DateTime.utc(2026, 7, 18, 11);

Future<void> _pump(
  WidgetTester tester, {
  Size surfaceSize = const Size(400, 1600),
  Locale locale = const Locale('en'),
  double textScale = 1,
  AppThemePreference theme = AppThemePreference.dark,
  bool stale = false,
  List<CalendarEntry> Function(int season)? calendar,
}) => pumpApp(
  tester,
  initialLocation: '/calendar',
  surfaceSize: surfaceSize,
  locale: locale,
  textScale: textScale,
  disableAnimations: true,
  preferences: AppPreferences.defaults.copyWith(theme: theme),
  syncMetadata: (String key) =>
      syncedMetadata(key, staleAfter: stale ? _past : null),
  repository: FakeRaceWeekendRepository(
    home: homeViewFixture(),
    calendar: calendar ?? (int season) => calendarFixture(season: season),
    grandPrix: (int season, int round) => grandPrixDetailFixture(season, round),
  ),
);

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

Finder get _list => find
    .descendant(
      of: find.byType(CalendarScreen),
      matching: find.byType(Scrollable),
    )
    .first;

Future<void> _toTop(WidgetTester tester) async {
  tester.state<ScrollableState>(_list).position.jumpTo(0);
  await tester.pumpAndSettle();
}

/// The true end of the lazily built list (its extent grows as rows build).
Future<void> _toEnd(WidgetTester tester) async {
  for (int i = 0; i < 3; i++) {
    final ScrollPosition position = tester
        .state<ScrollableState>(_list)
        .position;
    position.jumpTo(position.maxScrollExtent);
    await tester.pumpAndSettle();
  }
}

List<GvPrimerNotice> _notices(WidgetTester tester) => tester
    .widgetList<GvPrimerNotice>(find.byType(GvPrimerNotice))
    .toList(growable: false);

GvPrimerRaceRow _row(WidgetTester tester, int round) =>
    tester.widget<GvPrimerRaceRow>(
      find.descendant(
        of: find.byKey(ValueKey<String>('calendar-event-$round')),
        matching: find.byType(GvPrimerRaceRow),
      ),
    );

void main() {
  group('notices (N-1, N-2, VS-4)', () {
    testWidgets('failure + stale of the calendar resource is one combined '
        'notice', (WidgetTester tester) async {
      await _pump(tester, stale: true);
      await _failCalendarRefresh(tester);
      await _toTop(tester);

      final List<GvPrimerNotice> notices = _notices(tester);
      expect(notices, hasLength(1));
      expect(notices.single.cause, GvPrimerNoticeCause.failure);
      expect(
        notices.single.message,
        "Couldn't refresh. Saved data may be out of date.",
      );
      expect(find.byType(CalendarEventRow), findsWidgets);
    });

    testWidgets('the combined wording is the approved Spanish text', (
      WidgetTester tester,
    ) async {
      await _pump(tester, stale: true, locale: const Locale('es'));
      await _failCalendarRefresh(tester);
      await _toTop(tester);
      expect(
        _notices(tester).single.message,
        'No se pudo actualizar. Los datos guardados pueden estar '
        'desactualizados.',
      );
    });

    testWidgets('failure alone keeps the existing alert notice', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await _failCalendarRefresh(tester);
      await _toTop(tester);
      final List<GvPrimerNotice> notices = _notices(tester);
      expect(notices, hasLength(1));
      expect(notices.single.cause, GvPrimerNoticeCause.failure);
      expect(notices.single.message, "Couldn't refresh — showing saved data.");
    });

    testWidgets('stale alone keeps the existing clock notice', (
      WidgetTester tester,
    ) async {
      await _pump(tester, stale: true);
      await _toTop(tester);
      final List<GvPrimerNotice> notices = _notices(tester);
      expect(notices, hasLength(1));
      expect(notices.single.cause, GvPrimerNoticeCause.stale);
      expect(
        notices.single.message,
        'This data may be out of date — showing the last saved version.',
      );
    });

    testWidgets('fresh and successful: no notice at all', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await _toTop(tester);
      expect(find.byType(GvPrimerNotice), findsNothing);
    });
  });

  group('rows (XT-2, VS-1, emphasis)', () {
    testWidgets('completed rows are full strength with the completed chip', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await _toTop(tester);
      final GvPrimerRaceRow completed = _row(tester, 11);
      expect(completed.highlighted, isFalse);
      expect(
        completed.statuses.first,
        const GvPrimerStatusLabel('Completed', GvPrimerChipKind.completed),
      );
      expect(
        find.descendant(
          of: find.byKey(const ValueKey<String>('calendar-event-11')),
          matching: find.byWidgetPredicate(
            (Widget w) => w is Opacity && w.opacity < 1,
          ),
        ),
        findsNothing,
        reason: 'XT-2: a completed row is never dimmed',
      );
    });

    testWidgets('an unknown status stays dashed and unknown even when its '
        'dates are long past', (WidgetTester tester) async {
      await _pump(
        tester,
        calendar: (int season) => <CalendarEntry>[
          calendarEntry(
            round: 1,
            name: 'Past Unknown Grand Prix',
            startDate: '2026-03-06',
            endDate: '2026-03-08',
            status: EventStatus.unknown,
          ),
          calendarEntry(
            round: 2,
            name: 'Later Grand Prix',
            startDate: '2026-08-07',
            endDate: '2026-08-09',
          ),
        ],
      );
      expect(
        _row(tester, 1).statuses.first,
        const GvPrimerStatusLabel('Status unknown', GvPrimerChipKind.unknown),
      );
      expect(find.text('Completed'), findsNothing);
    });

    testWidgets('the next event is the only highlighted row, with its kicker '
        'and the flat oxide block', (WidgetTester tester) async {
      await _pump(tester);
      final Iterable<GvPrimerRaceRow> rows = tester.widgetList<GvPrimerRaceRow>(
        find.byType(GvPrimerRaceRow),
      );
      expect(rows.where((GvPrimerRaceRow r) => r.highlighted), hasLength(1));
      final GvPrimerRaceRow next = _row(tester, 13);
      expect(next.highlighted, isTrue);
      expect(next.highlightLabel, 'Next');
      final GvPrimerRoundBlockPainter block =
          tester
                  .widget<CustomPaint>(
                    find
                        .descendant(
                          of: find.byKey(
                            const ValueKey<String>('calendar-event-13'),
                          ),
                          matching: find.byWidgetPredicate(
                            (Widget w) =>
                                w is CustomPaint &&
                                w.painter is GvPrimerRoundBlockPainter,
                          ),
                        )
                        .first,
                  )
                  .painter!
              as GvPrimerRoundBlockPainter;
      expect(block.color, GvPrimerRoles.dark.fill.brand.fill, reason: 'DK-2');
    });

    testWidgets('an event in progress keeps the band without the Next kicker', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        calendar: (int season) => <CalendarEntry>[
          calendarEntry(
            round: 1,
            name: 'Done Grand Prix',
            startDate: '2026-07-03',
            endDate: '2026-07-05',
            status: EventStatus.completed,
          ),
          calendarEntry(
            round: 2,
            name: 'Running Grand Prix',
            startDate: '2026-07-17',
            endDate: '2026-07-19',
            status: EventStatus.inProgress,
          ),
          calendarEntry(
            round: 3,
            name: 'Later Grand Prix',
            startDate: '2026-08-07',
            endDate: '2026-08-09',
          ),
        ],
      );
      final GvPrimerRaceRow current = _row(tester, 2);
      expect(current.highlighted, isTrue);
      expect(current.highlightLabel, isNull);
      expect(find.text('Next'), findsNothing);
    });

    testWidgets('rows announce name, round, status, circuit and dates', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      expect(
        find.bySemanticsLabel(
          RegExp(
            r'^Belgian Grand Prix, round 13, Next, Upcoming, Sprint weekend, '
            r'Circuit de Spa-Francorchamps, .*Jul 24',
          ),
        ),
        findsOneWidget,
      );
    });

    testWidgets('dates are calendar-only and localized', (
      WidgetTester tester,
    ) async {
      await _pump(tester, locale: const Locale('es'));
      expect(find.textContaining('24 jul'), findsWidgets);
    });
  });

  group('pinned header and scrolling status (Stage 1)', () {
    testWidgets('title and season stay pinned; the caption scrolls away', (
      WidgetTester tester,
    ) async {
      await _pump(tester, surfaceSize: const Size(390, 844));
      await _toTop(tester);
      final Rect header = tester.getRect(find.byType(CalendarHeader));
      final double caption = tester
          .getRect(find.byKey(const ValueKey<String>('calendar-freshness')))
          .top;
      expect(caption, greaterThanOrEqualTo(header.bottom));

      await tester.drag(_list, const Offset(0, -300));
      await tester.pumpAndSettle();

      expect(tester.getRect(find.byType(CalendarHeader)), header);
      expect(find.text('Calendar'), findsWidgets);
      expect(find.text('2026 season'), findsOneWidget);
      final Finder captionNow = find.byKey(
        const ValueKey<String>('calendar-freshness'),
      );
      expect(
        captionNow.evaluate().isEmpty ||
            tester.getRect(captionNow).top < caption,
        isTrue,
        reason: 'the caption moves with the rows',
      );
      // Rows scroll under the pinned header, never over it.
      for (final Element e in find.byType(GvPrimerRaceRow).evaluate()) {
        final Rect r = tester.getRect(find.byWidget(e.widget));
        if (r.bottom > header.bottom) continue;
        fail('a row is drawn above the pinned header: $r');
      }
    });

    testWidgets('there is exactly one sticky block: the header', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      expect(find.byType(CalendarHeader), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(CalendarScreen),
          matching: find.byType(SliverPersistentHeader),
        ),
        findsNothing,
      );
    });
  });

  group('keyboard', () {
    testWidgets('Enter on a focused row opens its Grand Prix', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      final Finder row = find.byKey(
        const ValueKey<String>('calendar-event-13'),
      );
      final FocusNode node = Focus.of(
        tester.element(
          find
              .descendant(of: row, matching: find.byType(GestureDetector))
              .first,
        ),
      );
      node.requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      final GrandPrixDetailScreen detail = tester.widget(
        find.byType(GrandPrixDetailScreen),
      );
      expect((detail.season, detail.round), (2026, 13));
    });
  });

  group('themes', () {
    for (final (AppThemePreference pref, GvPrimerRoles roles)
        in <(AppThemePreference, GvPrimerRoles)>[
          (AppThemePreference.dark, GvPrimerRoles.dark),
          (AppThemePreference.light, GvPrimerRoles.light),
        ]) {
      testWidgets('${pref.wire}: page role and header surface', (
        WidgetTester tester,
      ) async {
        await _pump(tester, theme: pref);
        final Scaffold scaffold = tester.widget<Scaffold>(
          find
              .descendant(
                of: find.byType(CalendarScreen),
                matching: find.byType(Scaffold),
              )
              .first,
        );
        expect(scaffold.backgroundColor, roles.surface.page);
        final DecoratedBox header = tester.widget<DecoratedBox>(
          find
              .descendant(
                of: find.byType(CalendarHeader),
                matching: find.byType(DecoratedBox),
              )
              .first,
        );
        expect(
          (header.decoration as BoxDecoration).color,
          roles.surface.page,
          reason: 'the pinned header is opaque: rows never show through',
        );
      });
    }
  });

  group('no clipped text at 320 @200%', () {
    for (final Locale locale in const <Locale>[Locale('en'), Locale('es')]) {
      testWidgets('${locale.languageCode}: every text fits its box', (
        WidgetTester tester,
      ) async {
        await loadArchivo(tester);
        await _pump(
          tester,
          surfaceSize: const Size(320, 8000),
          locale: locale,
          textScale: 2,
          stale: true,
        );
        await _failCalendarRefresh(tester);
        expect(tester.takeException(), isNull);
        for (final RenderParagraph p
            in tester.renderObjectList<RenderParagraph>(
              find.descendant(
                of: find.byType(CalendarScreen),
                matching: find.byType(RichText),
              ),
            )) {
          final double need = p.softWrap
              ? p.getMinIntrinsicWidth(double.infinity)
              : p.getMaxIntrinsicWidth(double.infinity);
          expect(
            need,
            lessThanOrEqualTo(p.size.width + 0.5),
            reason: '"${p.text.toPlainText()}" is clipped',
          );
        }
      });
    }
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
          testWidgets('$name: header, notice and last row all reachable', (
            WidgetTester tester,
          ) async {
            await _pump(
              tester,
              surfaceSize: size,
              locale: locale,
              textScale: scale,
              theme: theme,
              stale: true,
            );
            await _failCalendarRefresh(tester);
            expect(tester.takeException(), isNull);

            final Rect header = tester.getRect(find.byType(CalendarHeader));
            final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
            expect(header.bottom, lessThan(nav.top), reason: name);

            await _toTop(tester);
            expect(find.byType(GvPrimerNotice), findsOneWidget);
            expect(
              tester.getRect(find.byType(GvPrimerNotice)).top,
              greaterThanOrEqualTo(header.bottom),
            );

            await _toEnd(tester);
            expect(tester.takeException(), isNull);
            final Rect last = tester.getRect(
              find.byKey(const ValueKey<String>('calendar-event-15')),
            );
            expect(last.bottom, lessThanOrEqualTo(nav.top), reason: name);
          });
        }
      }
    }
  });
}
