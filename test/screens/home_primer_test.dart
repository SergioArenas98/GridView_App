import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

/// Step 55C.1: the Primer V2 Home composition — notice policy (N-1, N-2, N-3,
/// VS-4), chip vocabulary (VS-1), HM-01, theme switching and the responsive
/// matrix. Behaviour already covered by `home_widget_test.dart` is not
/// repeated here.

const Size _tall = Size(400, 3600);

/// Before the clock the harness pins (2026-07-18 12:10Z), so a resource
/// carrying it is stale.
final DateTime _past = DateTime.utc(2026, 7, 18, 11);

Future<void> _pump(
  WidgetTester tester, {
  HomeDashboardView? dashboard,
  Size surfaceSize = _tall,
  Locale locale = const Locale('en'),
  double textScale = 1,
  AppThemePreference theme = AppThemePreference.dark,
  Set<String> staleKeys = const <String>{},
}) => pumpApp(
  tester,
  surfaceSize: surfaceSize,
  locale: locale,
  textScale: textScale,
  disableAnimations: true,
  preferences: AppPreferences(
    language: AppPreferences.defaults.language,
    theme: theme,
    timeDisplay: AppPreferences.defaults.timeDisplay,
  ),
  syncMetadata: (String key) =>
      syncedMetadata(key, staleAfter: staleKeys.contains(key) ? _past : null),
  repository: FakeRaceWeekendRepository(
    dashboard: dashboard ?? homeDashboardFixture(),
    home: homeViewFixture(),
    calendar: (int season) => calendarFixture(season: season),
    grandPrix: (int season, int round) => grandPrixDetailFixture(season, round),
  ),
);

Future<void> _failHomeRefresh(WidgetTester tester) async {
  containerOf(tester)
      .read(appSyncStateProvider.notifier)
      .publish(
        const AppSyncCompleted(
          trigger: SyncTrigger.manual,
          outcomes: <ResourceSyncOutcome>[
            ResourceSyncOutcome(
              resourceKey: 'home:2026',
              kind: ResourceSyncOutcomeKind.failed,
              failure: ApiFailureKind.networkUnavailable,
            ),
          ],
        ),
      );
  await tester.pumpAndSettle();
}

List<GvPrimerNotice> _notices(WidgetTester tester) => tester
    .widgetList<GvPrimerNotice>(find.byType(GvPrimerNotice))
    .toList(growable: false);

void main() {
  group('notices (N-1, N-2, N-3, VS-4)', () {
    testWidgets('failure + stale of the Home resource itself is one combined '
        'notice', (WidgetTester tester) async {
      await _pump(tester, staleKeys: <String>{'home:2026'});
      await _failHomeRefresh(tester);

      final List<GvPrimerNotice> notices = _notices(tester);
      expect(notices, hasLength(1));
      expect(notices.single.cause, GvPrimerNoticeCause.failure);
      expect(
        notices.single.message,
        "Couldn't refresh. Saved data may be out of date.",
      );
      // Cached content is retained.
      expect(find.text('Belgian Grand Prix'), findsWidgets);
    });

    testWidgets('the combined wording is the approved Spanish text', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        locale: const Locale('es'),
        staleKeys: <String>{'home:2026'},
      );
      await _failHomeRefresh(tester);
      expect(
        _notices(tester).single.message,
        'No se pudo actualizar. Los datos guardados pueden estar '
        'desactualizados.',
      );
    });

    testWidgets('failure + staleness of other content stays two notices, '
        'failure first', (WidgetTester tester) async {
      await _pump(tester, staleKeys: <String>{'standings:drivers:2026'});
      await _failHomeRefresh(tester);

      final List<GvPrimerNotice> notices = _notices(tester);
      expect(notices.map((GvPrimerNotice n) => n.cause), <GvPrimerNoticeCause>[
        GvPrimerNoticeCause.failure,
        GvPrimerNoticeCause.stale,
      ]);
      expect(notices.first.message, 'Update failed');
      expect(notices.last.message, 'Some information may be outdated');
    });

    testWidgets('stale only: one clock notice', (WidgetTester tester) async {
      await _pump(tester, staleKeys: <String>{'calendar:2026'});
      final List<GvPrimerNotice> notices = _notices(tester);
      expect(notices, hasLength(1));
      expect(notices.single.cause, GvPrimerNoticeCause.stale);
    });

    testWidgets('failure only: one alert notice over the cached dashboard', (
      WidgetTester tester,
    ) async {
      await _pump(tester);
      await _failHomeRefresh(tester);
      final List<GvPrimerNotice> notices = _notices(tester);
      expect(notices, hasLength(1));
      expect(notices.single.cause, GvPrimerNoticeCause.failure);
      expect(notices.single.message, 'Update failed');
      expect(find.text('Belgian Grand Prix'), findsWidgets);
      expect(find.byKey(const ValueKey<String>('home-hero-open')), findsOne);
    });

    testWidgets('an unavailable module keeps its own message; no aggregate '
        'notice beside a failure (N-3)', (WidgetTester tester) async {
      await pumpApp(
        tester,
        surfaceSize: _tall,
        disableAnimations: true,
        syncMetadata: unmaterialized(<String>{'standings:drivers:2026'}),
        repository: FakeRaceWeekendRepository(
          dashboard: homeDashboardFixture(
            driverLeaders: const <DriverStandingEntry>[],
          ),
          home: homeViewFixture(),
          calendar: (int season) => calendarFixture(season: season),
          grandPrix: (int season, int round) =>
              grandPrixDetailFixture(season, round),
        ),
      );
      await _failHomeRefresh(tester);
      expect(
        _notices(tester).map((GvPrimerNotice n) => n.cause),
        <GvPrimerNoticeCause>[GvPrimerNoticeCause.failure],
      );
      expect(find.text('Leader unavailable'), findsOneWidget);
    });

    testWidgets('season empty: failure + stale Home is the combined notice', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        staleKeys: <String>{'home:2026'},
        dashboard: homeDashboardFixture(
          withFocus: false,
          withLatestCompleted: false,
          upcoming: const <CalendarEntry>[],
        ),
      );
      await _failHomeRefresh(tester);
      expect(find.byKey(const ValueKey<String>('home-season-empty')), findsOne);
      final List<GvPrimerNotice> notices = _notices(tester);
      expect(notices, hasLength(1));
      expect(notices.single.cause, GvPrimerNoticeCause.failure);
    });

    testWidgets('each notice is a polite live region read once', (
      WidgetTester tester,
    ) async {
      await _pump(tester, staleKeys: <String>{'standings:drivers:2026'});
      await _failHomeRefresh(tester);
      expect(find.bySemanticsLabel('Update failed'), findsOneWidget);
      expect(
        find.bySemanticsLabel('Some information may be outdated'),
        findsOneWidget,
      );
    });
  });

  group('status vocabulary (VS-1)', () {
    testWidgets('an unknown event status is the dashed chip, never Completed', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        dashboard: homeDashboardFixture(
          focus: homeFocusFixture(status: EventStatus.unknown),
        ),
      );
      final GvPrimerStatusChip chip = tester.widget<GvPrimerStatusChip>(
        find
            .descendant(
              of: find.byKey(const ValueKey<String>('home-hero-open')),
              matching: find.byType(GvPrimerStatusChip),
            )
            .first,
      );
      expect(chip.kind, GvPrimerChipKind.unknown);
      expect(chip.label, 'Status unknown');
    });

    testWidgets('a sprint weekend and a race weekend add context chips', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        dashboard: homeDashboardFixture(
          // The Belgian fixture is a sprint weekend.
          focus: homeFocusFixture(status: EventStatus.inProgress),
        ),
      );
      final Iterable<GvPrimerStatusChip> chips = tester
          .widgetList<GvPrimerStatusChip>(
            find.descendant(
              of: find.byKey(const ValueKey<String>('home-hero-open')),
              matching: find.byType(GvPrimerStatusChip),
            ),
          );
      expect(chips.map((GvPrimerStatusChip c) => c.kind), <GvPrimerChipKind>[
        GvPrimerChipKind.context,
        GvPrimerChipKind.live,
        GvPrimerChipKind.context,
      ]);
    });
  });

  group('themes', () {
    for (final (AppThemePreference pref, GvPrimerRoles roles)
        in <(AppThemePreference, GvPrimerRoles)>[
          (AppThemePreference.dark, GvPrimerRoles.dark),
          (AppThemePreference.light, GvPrimerRoles.light),
        ]) {
      testWidgets('${pref.wire}: Home paints the Primer page role', (
        WidgetTester tester,
      ) async {
        await _pump(tester, theme: pref);
        final Scaffold scaffold = tester.widget<Scaffold>(
          find
              .descendant(
                of: find.byType(HomeScreen),
                matching: find.byType(Scaffold),
              )
              .first,
        );
        expect(scaffold.backgroundColor, roles.surface.page);
      });
    }
  });

  group('no clipped text at 320 @200%', () {
    for (final Locale locale in const <Locale>[Locale('en'), Locale('es')]) {
      testWidgets('${locale.languageCode}: every text fits its box', (
        WidgetTester tester,
      ) async {
        // Real Archivo metrics (the default test font is 1em per glyph).
        await loadArchivo(tester);
        // The whole page laid out at once, so every paragraph is measured.
        // The default fixture carries fractional points ("460,5 pts").
        await _pump(
          tester,
          surfaceSize: const Size(320, 7000),
          locale: locale,
          textScale: 2,
          staleKeys: <String>{'standings:drivers:2026'},
        );
        await _failHomeRefresh(tester);
        expect(tester.takeException(), isNull);
        for (final RenderParagraph p
            in tester.renderObjectList<RenderParagraph>(
              find.descendant(
                of: find.byType(HomeScreen),
                matching: find.byType(RichText),
              ),
            )) {
          // A wrapping paragraph only needs its longest unbreakable word to
          // fit; a non-wrapping one needs its whole line.
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
          testWidgets('$name: scrolls end to end without overflow', (
            WidgetTester tester,
          ) async {
            await _pump(
              tester,
              surfaceSize: size,
              locale: locale,
              textScale: scale,
              theme: theme,
              staleKeys: <String>{'standings:drivers:2026'},
            );
            await _failHomeRefresh(tester);
            expect(tester.takeException(), isNull);

            final Finder scrollable = find
                .descendant(
                  of: find.byType(HomeScreen),
                  matching: find.byType(Scrollable),
                )
                .first;
            final Finder explore = find.byKey(
              const ValueKey<String>('home-quick-circuits'),
            );
            await tester.scrollUntilVisible(
              explore,
              300,
              scrollable: scrollable,
            );
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
            expect(explore, findsOneWidget);

            // The last target clears the shell's bottom navigation.
            await tester.drag(scrollable, const Offset(0, -4000));
            await tester.pumpAndSettle();
            final Rect last = tester.getRect(explore);
            final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
            expect(last.bottom, lessThanOrEqualTo(nav.top), reason: name);
          });
        }
      }
    }
  });
}
