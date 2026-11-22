import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/home/presentation/home_status_kinds.dart';
import 'package:gridview/features/home/presentation/widgets/home_explore_strip.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/l10n/app_localizations.dart';

import '../support/a11y_harness.dart';
import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

/// Step 55C.3: the owner's Home visual-review corrections — a single "Final"
/// indicator for a completed Grand Prix with a final classification (every
/// other pairing keeps both facts), and the approved Primer V2 Explore
/// pictograms in place of the Material stand-ins.

Future<void> _pump(
  WidgetTester tester, {
  required HomeDashboardView dashboard,
  Locale locale = const Locale('en'),
  double width = 400,
  double textScale = 1,
  AppThemePreference theme = AppThemePreference.dark,
}) => pumpApp(
  tester,
  surfaceSize: Size(width, 3600),
  locale: locale,
  textScale: textScale,
  disableAnimations: true,
  preferences: AppPreferences.defaults.copyWith(theme: theme),
  repository: FakeRaceWeekendRepository(
    dashboard: dashboard,
    home: homeViewFixture(),
    calendar: (int season) => calendarFixture(season: season),
    grandPrix: (int season, int round) => grandPrixDetailFixture(season, round),
  ),
);

/// Round 12, with [event] status and, unless [result] is null, a cached race
/// classification of that status naming a winner.
HomeDashboardView _dashboard({
  EventStatus event = EventStatus.completed,
  ResultStatus? result = ResultStatus.finalResult,
}) => homeDashboardFixture(
  latestCompleted: calendarEntry(
    round: 12,
    name: 'Italian Grand Prix',
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    status: event,
    hasResults: true,
  ),
  latestRaceResult: result == null
      ? null
      : raceResultFixture(
          sessionType: SessionType.race,
          round: 12,
          status: result,
          entries: const <RaceResultEntry>[
            RaceResultEntry(
              driverId: 'max-verstappen',
              constructorId: 'red-bull',
              driverName: 'Max Verstappen',
              position: 1,
              status: FinishStatus.finished,
            ),
          ],
        ),
);

/// The latest-result section's chip words, in order.
List<String> _chips(WidgetTester tester) => tester
    .widgetList<GvPrimerStatusChip>(
      find.descendant(
        of: find.byKey(const ValueKey<String>('home-latest-result')),
        matching: find.byType(GvPrimerStatusChip),
      ),
    )
    .map((GvPrimerStatusChip c) => c.label)
    .toList();

void main() {
  late AppLocalizations en;
  setUpAll(() async {
    en = await AppLocalizations.delegate.load(const Locale('en'));
  });

  group('latest result: no redundant "Completed" next to "Final"', () {
    testWidgets('completed + final: the single "Final" indicator', (
      WidgetTester tester,
    ) async {
      await _pump(tester, dashboard: _dashboard());
      expect(_chips(tester), <String>['Final']);
      final GvPrimerStatusChip chip = tester.widget(
        find.descendant(
          of: find.byKey(const ValueKey<String>('home-latest-result')),
          matching: find.byType(GvPrimerStatusChip),
        ),
      );
      expect(chip.kind, GvPrimerChipKind.finalResult);
    });

    testWidgets('Spanish: "Definitivo" alone, no "Finalizado"', (
      WidgetTester tester,
    ) async {
      await _pump(tester, dashboard: _dashboard(), locale: const Locale('es'));
      expect(_chips(tester), <String>['Definitivo']);
    });

    for (final (EventStatus event, ResultStatus? result)
        in <(EventStatus, ResultStatus?)>[
          (EventStatus.completed, ResultStatus.provisional),
          (EventStatus.completed, ResultStatus.unavailable),
          (EventStatus.completed, ResultStatus.unknown),
          (EventStatus.unknown, ResultStatus.finalResult),
          (EventStatus.cancelled, ResultStatus.finalResult),
          (EventStatus.postponed, ResultStatus.finalResult),
        ]) {
      testWidgets('${event.wire} + ${result!.name}: both facts stay', (
        WidgetTester tester,
      ) async {
        await _pump(
          tester,
          dashboard: _dashboard(event: event, result: result),
        );
        final List<String> chips = _chips(tester);
        expect(chips, hasLength(2), reason: '$chips');
        expect(chips.last, switch (result) {
          ResultStatus.finalResult => en.resultStatusFinal,
          ResultStatus.provisional => en.resultStatusProvisional,
          ResultStatus.unavailable => en.resultStatusUnavailable,
          ResultStatus.unknown => en.resultStatusUnknown,
        });
      });
    }

    testWidgets('completed without a cached classification keeps '
        '"Completed"', (WidgetTester tester) async {
      await _pump(tester, dashboard: _dashboard(result: null));
      expect(_chips(tester), <String>['Completed']);
    });

    test('only completed + final is covered (truth table)', () {
      for (final EventStatus event in EventStatus.values) {
        for (final ResultStatus? result in <ResultStatus?>[
          null,
          ...ResultStatus.values,
        ]) {
          expect(
            homeFinalResultCoversEvent(event, result),
            event == EventStatus.completed &&
                result == ResultStatus.finalResult,
            reason: '$event + $result',
          );
        }
      }
    });
  });

  group('Explore: the approved Primer V2 pictograms', () {
    testWidgets('drivers, teams, circuits; same size and accent colour', (
      WidgetTester tester,
    ) async {
      await _pump(tester, dashboard: homeDashboardFixture());
      final Finder strip = find.byType(HomeExploreStrip);
      expect(
        find.descendant(of: strip, matching: find.byType(Icon)),
        findsNothing,
        reason: 'no Material stand-in remains',
      );
      final List<GvPrimerIcon> icons = tester
          .widgetList<GvPrimerIcon>(
            find.descendant(of: strip, matching: find.byType(GvPrimerIcon)),
          )
          .toList();
      expect(icons.map((GvPrimerIcon i) => i.glyph), <GvPrimerGlyph>[
        GvPrimerGlyph.driver,
        GvPrimerGlyph.team,
        GvPrimerGlyph.circuit,
      ]);
      final Color accent = GvPrimerSurface.of(
        tester.element(strip),
      ).roles.text.accent;
      for (final GvPrimerIcon icon in icons) {
        expect(icon.size, 24);
        expect(icon.color, accent);
        expect(icon.strokeWidth, GvPrimerIconStroke.regular);
      }
      for (final String key in <String>['drivers', 'teams', 'circuits']) {
        final Size target = tester.getSize(
          find.byKey(ValueKey<String>('home-quick-$key')),
        );
        expect(target.height, greaterThanOrEqualTo(48), reason: key);
      }
    });

    // Geometry from the prototype's SVG: points on each primitive are inked,
    // and the mirror points a wrong arc direction would ink are not.
    for (final (GvPrimerGlyph glyph, List<Offset> inked, List<Offset> blank)
        in <(GvPrimerGlyph, List<Offset>, List<Offset>)>[
          (
            GvPrimerGlyph.driver,
            <Offset>[
              const Offset(12, 3), // head (circle 12,7 r4) top
              const Offset(17.83, 16.17), // right shoulder, centre (15,19)
              const Offset(6.17, 16.17), // left shoulder, centre (9,19)
              const Offset(19, 20.5), // right side
              const Offset(12, 15), // shoulder line
            ],
            <Offset>[
              const Offset(12, 7), // inside the head
              const Offset(16.17, 17.83), // a clockwise right shoulder
              const Offset(7.83, 17.83), // a clockwise left shoulder
            ],
          ),
          (
            GvPrimerGlyph.team,
            <Offset>[
              const Offset(9, 3), // head (circle 9,7 r4) top
              const Offset(14.83, 16.17), // body arc, centre (12,19)
              const Offset(3.17, 16.17), // body arc, centre (6,19)
              const Offset(20.83, 16.17), // second shoulder, centre (18,19)
              const Offset(19, 7), // second head arc, rightmost
            ],
            <Offset>[
              const Offset(9, 7), // inside the head
              const Offset(13.17, 17.83), // a clockwise body arc
            ],
          ),
          (
            GvPrimerGlyph.circuit,
            <Offset>[
              const Offset(6, 16), // start circle (6,19 r3) top
              const Offset(18, 8), // end circle (18,5 r3) bottom
              const Offset(21, 15.5), // right loop, rightmost
              const Offset(3, 8.5), // left loop, leftmost
              const Offset(12, 19), // bottom straight
              const Offset(12, 12), // middle straight
              const Offset(12, 5), // top straight
            ],
            <Offset>[
              const Offset(14, 15.5), // a right loop drawn inwards
              const Offset(10, 8.5), // a left loop drawn inwards
            ],
          ),
        ]) {
      testWidgets('${glyph.name}: the prototype geometry', (
        WidgetTester tester,
      ) async {
        const double size = 96;
        const double scale = size / 24;
        final ui.PictureRecorder recorder = ui.PictureRecorder();
        GvPrimerGlyphPainter(
          glyph,
          const Color(0xFF000000),
          GvPrimerIconStroke.regular,
        ).paint(Canvas(recorder), const Size.square(size));
        late ByteData bytes;
        await tester.runAsync(() async {
          final ui.Image image = await recorder.endRecording().toImage(
            size.toInt(),
            size.toInt(),
          );
          bytes = (await image.toByteData())!;
        });
        int alpha(Offset p) {
          final int x = (p.dx * scale).round().clamp(0, size.toInt() - 1);
          final int y = (p.dy * scale).round().clamp(0, size.toInt() - 1);
          return bytes.getUint8((y * size.toInt() + x) * 4 + 3);
        }

        for (final Offset p in inked) {
          expect(alpha(p), greaterThan(128), reason: '${glyph.name} at $p');
        }
        for (final Offset p in blank) {
          expect(alpha(p), lessThan(32), reason: '${glyph.name} at $p');
        }
      });
    }
  });

  group('latest result: heading start, chips end (`.result__head`)', () {
    final Finder head = find.byKey(
      const ValueKey<String>('home-latest-result-head'),
    );
    Finder inLatest(Finder f) => find.descendant(
      of: find.byKey(const ValueKey<String>('home-latest-result')),
      matching: f,
    );

    /// The heading and the chip group's rects, after checking that nothing
    /// in the row is clipped or truncated.
    (Rect, Rect) layoutOf(WidgetTester tester) {
      final Rect title = tester.getRect(
        inLatest(find.byType(GvPrimerSectionTitle)),
      );
      final List<Rect> chips = tester
          .widgetList<GvPrimerStatusChip>(
            inLatest(find.byType(GvPrimerStatusChip)),
          )
          .map((GvPrimerStatusChip c) => tester.getRect(find.byWidget(c)))
          .toList();
      final Rect group = chips.reduce((Rect a, Rect b) => a.expandToInclude(b));
      for (final RenderParagraph p in tester.renderObjectList<RenderParagraph>(
        find.descendant(of: head, matching: find.byType(RichText)),
      )) {
        expect(p.didExceedMaxLines, isFalse);
        expect(
          p.size.height,
          greaterThanOrEqualTo(p.getMaxIntrinsicHeight(p.size.width) - 0.5),
        );
        expect(
          p.size.width,
          greaterThanOrEqualTo(p.getMinIntrinsicWidth(double.infinity) - 0.5),
        );
      }
      return (title, group);
    }

    /// Against the screen's own gutters (not the row's box, which would
    /// shrink with its content if the row stopped spanning the width).
    void expectOppositeOrStacked(
      WidgetTester tester,
      String name, {
      required double width,
    }) {
      final double start = GvPrimerLayout.gutter;
      final double end = width - GvPrimerLayout.gutter;
      final (Rect title, Rect chips) = layoutOf(tester);
      expect(tester.getRect(head).right, closeTo(end, 0.5), reason: name);
      expect(title.left, closeTo(start, 0.5), reason: name);
      if (chips.top < title.bottom - 0.5) {
        // One row: opposite sides, vertically centred together.
        expect(chips.right, closeTo(end, 0.5), reason: name);
        expect(chips.center.dy, closeTo(title.center.dy, 1), reason: name);
      } else {
        // Stacked: the chips start the next line.
        expect(chips.left, closeTo(start, 0.5), reason: name);
        expect(chips.top, greaterThanOrEqualTo(title.bottom), reason: name);
      }
    }

    for (final AppThemePreference theme in const <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      testWidgets('390 @100% ${theme.wire}: one row, chip on the trailing '
          'gutter', (WidgetTester tester) async {
        await loadArchivo(tester);
        await _pump(tester, dashboard: _dashboard(), width: 390, theme: theme);
        expect(tester.takeException(), isNull);
        final Rect row = tester.getRect(head);
        final (Rect title, Rect chip) = layoutOf(tester);
        expect(chip.top, lessThan(title.bottom), reason: 'same row');
        expect(title.left, closeTo(GvPrimerLayout.gutter, 0.5));
        expect(chip.right, closeTo(390 - GvPrimerLayout.gutter, 0.5));
        expect(row.right, closeTo(390 - GvPrimerLayout.gutter, 0.5));
        expect(chip.center.dy, closeTo(title.center.dy, 1));
      });

      for (final Locale locale in const <Locale>[Locale('en'), Locale('es')]) {
        testWidgets('320 @200% ${locale.languageCode} ${theme.wire}: opposite '
            'sides or stacked, never clipped', (WidgetTester tester) async {
          await loadArchivo(tester);
          await _pump(
            tester,
            dashboard: _dashboard(),
            width: 320,
            textScale: 2,
            theme: theme,
            locale: locale,
          );
          expect(tester.takeException(), isNull);
          expectOppositeOrStacked(
            tester,
            '320 @200% ${locale.languageCode}',
            width: 320,
          );
        });
      }
    }

    for (final (String name, EventStatus event, ResultStatus result)
        in <(String, EventStatus, ResultStatus)>[
          (
            'completed + provisional',
            EventStatus.completed,
            ResultStatus.provisional,
          ),
          ('unknown + final', EventStatus.unknown, ResultStatus.finalResult),
        ]) {
      for (final (double width, double scale) in const <(double, double)>[
        (390, 1),
        (320, 2),
      ]) {
        testWidgets('$name at ${width.toInt()} @${(scale * 100).toInt()}%: '
            'both chips, same rule', (WidgetTester tester) async {
          await loadArchivo(tester);
          await _pump(
            tester,
            dashboard: _dashboard(event: event, result: result),
            width: width,
            textScale: scale,
          );
          expect(tester.takeException(), isNull);
          expect(_chips(tester), hasLength(2));
          expectOppositeOrStacked(tester, name, width: width);
        });
      }
    }

    testWidgets('reading order: heading, then the chip, then the event', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pump(tester, dashboard: _dashboard(), width: 390);
      expectReadingOrder(tester, <String>[
        'Latest result',
        'Final',
        'Italian Grand Prix',
      ]);
      handle.dispose();
    });
  });
}
