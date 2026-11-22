import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/explore/presentation/widgets/explore_header.dart';
import 'package:gridview/features/shared/presentation/widgets/mock_data_banner.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_pinned_header_layout.dart';
import 'package:gridview/features/standings/presentation/widgets/standings_header.dart';

import '../support/primer_fonts.dart';
import '../support/reachability.dart';
import '../support/router_harness.dart';

/// Regression for the Step 55C.15 overflow (Step 55C.15R): 320 × 480 at 200%
/// text with the environment strip, the fixture banner and the 2 × 2 Primer
/// navigation. Standings overflowed by 11px, and the probe matrix found
/// Explore overflowing by up to 42px with a bottom system inset.
///
/// Standings and Explore now use `PrimerPinnedHeaderLayout`: the header
/// stays pinned while it leaves the list two targets, and otherwise scrolls
/// away with the page. These checks protect the outcome, not the mechanism:
/// no overflow, every header control and the first and last rows reachable,
/// the banner readable, the strip and the navigation clear of the content,
/// and keyboard focus always landing on something visible.

final Finder _nav = find.byType(GvPrimerBottomNav);
final Finder _strip = find.byKey(
  const ValueKey<String>('environment-badge-strip'),
);

Future<void> _open(
  WidgetTester tester, {
  required String location,
  required AppThemePreference theme,
  AppEnvironment environment = AppEnvironment.staging,
  Size size = const Size(320, 480),
  double scale = 2,
  double bottomInset = 0,
  Locale locale = const Locale('es'),
}) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  await loadArchivo(tester);
  await pumpApp(
    tester,
    initialLocation: location,
    surfaceSize: size,
    textScale: scale,
    locale: locale,
    environment: environment,
    environmentBadge: true,
    mockData: true,
    padding: EdgeInsets.only(top: 24, bottom: bottomInset),
    disableAnimations: true,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
  );
}

/// The visible branch's list: the innermost scroll view on stage.
Finder get _list => find
    .descendant(
      of: find.byType(Scaffold).first,
      matching: find.byType(Scrollable),
    )
    .last;

/// The page's own scroll (short mode) or, failing that, the list.
Finder _pageScroll() {
  final Finder outer = find.descendant(
    of: find.byKey(const ValueKey<String>('primer-pinned-header-scroll')),
    matching: find.byType(Scrollable),
  );
  return outer.evaluate().isNotEmpty ? outer.first : _list;
}

/// Every focus target of [header] is reachable: scrolled into the area
/// between the strip and the navigation, it receives a tap.
Future<void> _expectHeaderReachable(
  WidgetTester tester,
  Finder header,
  Finder scroll,
) async {
  final List<Element> targets = find
      .descendant(of: header, matching: find.byType(GvPrimerFocusTarget))
      .evaluate()
      .toList();
  expect(targets, isNotEmpty);
  for (final Element target in targets) {
    final Finder f = find.byElementPredicate((Element e) => e == target);
    await tester.ensureVisible(f);
    await tester.pumpAndSettle();
    final Rect r = tester.getRect(f);
    expect(r.top, greaterThanOrEqualTo(tester.getRect(_strip).bottom - 0.5));
    expect(r.bottom, lessThanOrEqualTo(tester.getRect(_nav).top + 0.5));
    expect(receivesPointer(tester, f, r.center), isTrue);
    expect(r.height, greaterThanOrEqualTo(48));
  }
  tester.state<ScrollableState>(scroll).position.jumpTo(0);
  await tester.pumpAndSettle();
}

/// Tab moves focus through the page; every stop is at least partly visible
/// between the strip and the bottom of the screen (the traversal scrolls it
/// into view), and the bar's destinations are reached.
Future<void> _expectTabStopsVisible(WidgetTester tester, Size size) async {
  FocusManager.instance.highlightStrategy =
      FocusHighlightStrategy.alwaysTraditional;
  bool reachedNav = false;
  for (int i = 0; i < 24 && !reachedNav; i++) {
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pumpAndSettle();
    final FocusNode? node = FocusManager.instance.primaryFocus;
    if (node == null || node.context == null) continue;
    final Rect r = node.rect;
    final Rect screen = Rect.fromLTRB(
      0,
      tester.getRect(_strip).bottom,
      size.width,
      size.height,
    );
    expect(
      r.overlaps(screen),
      isTrue,
      reason: 'Tab stop $i at $r is entirely off screen',
    );
    reachedNav = find
        .ancestor(
          of: find.byElementPredicate((Element e) => e == node.context),
          matching: _nav,
        )
        .evaluate()
        .isNotEmpty;
  }
  expect(reachedNav, isTrue, reason: 'Tab reaches the navigation');
}

void main() {
  tearDown(() {
    FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  });

  for (final AppThemePreference theme in <AppThemePreference>[
    AppThemePreference.dark,
    AppThemePreference.light,
  ]) {
    for (final AppEnvironment environment in <AppEnvironment>[
      AppEnvironment.development,
      AppEnvironment.staging,
    ]) {
      for (final double inset in <double>[0, 24]) {
        final String config =
            '${theme.wire} ${environment.label} bottom inset $inset';

        testWidgets('Standings 320×480 @200% $config: no overflow; header, '
            'banner and rows reachable', (WidgetTester tester) async {
          await _open(
            tester,
            location: '/standings',
            theme: theme,
            environment: environment,
            bottomInset: inset,
          );
          expect(tester.takeException(), isNull);
          expect(find.byType(PrimerPinnedHeaderLayout), findsOneWidget);
          final Finder scroll = _pageScroll();
          final Rect strip = tester.getRect(_strip);
          expect(strip.top, 0);
          expect(
            tester.getRect(find.byType(StandingsHeader)).top,
            greaterThanOrEqualTo(strip.bottom),
          );
          await _expectHeaderReachable(
            tester,
            find.byType(StandingsHeader),
            scroll,
          );
          final Finder list = _list;
          for (final Finder target in <Finder>[
            find.byType(MockDataBanner),
            find.byType(GvPrimerStandingsRow).first,
          ]) {
            await expectReachable(
              tester,
              target: target,
              scrollable: list,
              header: _strip,
              navigation: _nav,
              reason: '$config ${target.describeMatch(Plurality.one)}',
            );
          }
          await scrollToEnd(tester, list);
          await expectReachable(
            tester,
            target: find.byType(GvPrimerStandingsRow).last,
            scrollable: list,
            header: _strip,
            navigation: _nav,
            reason: '$config last row',
          );
          expect(tester.takeException(), isNull);
        });

        for (final String location in <String>[
          '/explore',
          '/explore/circuits',
        ]) {
          testWidgets('$location 320×480 @200% $config: no overflow; header '
              'and banner reachable', (WidgetTester tester) async {
            await _open(
              tester,
              location: location,
              theme: theme,
              environment: environment,
              bottomInset: inset,
            );
            expect(tester.takeException(), isNull);
            final Finder scroll = _pageScroll();
            await _expectHeaderReachable(
              tester,
              find.byType(ExploreHeader),
              scroll,
            );
            final Finder list = _list;
            await expectReachable(
              tester,
              target: find.byType(MockDataBanner),
              scrollable: list,
              header: _strip,
              navigation: _nav,
              reason: '$config banner',
            );
            await scrollToEnd(tester, list);
            expect(tester.takeException(), isNull);
          });
        }
      }
    }

    for (final String location in <String>['/standings', '/explore']) {
      testWidgets('${theme.wire} $location 320×480 @200% STAGING: Tab stops '
          'stay visible and reach the navigation', (WidgetTester tester) async {
        await _open(tester, location: location, theme: theme);
        await _expectTabStopsVisible(tester, const Size(320, 480));
      });
    }

    testWidgets('${theme.wire} navigation 320×480 @200%: every destination ≥ '
        '48dp, inside the bar, below the content', (WidgetTester tester) async {
      await _open(
        tester,
        location: '/standings',
        theme: theme,
        bottomInset: 24,
      );
      final Rect bar = tester.getRect(_nav);
      expect(bar.bottom, 480);
      for (final String label in <String>[
        'Inicio',
        'Calendario',
        'Clasificaciones',
        'Explorar',
      ]) {
        final Rect t = tester.getRect(
          find.ancestor(
            of: find.descendant(of: _nav, matching: find.text(label)),
            matching: find.byType(GvPrimerFocusTarget),
          ),
        );
        expect(t.height, greaterThanOrEqualTo(48), reason: label);
        expect(bar.contains(t.center), isTrue, reason: label);
        // The 24dp system inset stays below the destinations.
        expect(t.bottom, lessThanOrEqualTo(480 - 24 + 0.5), reason: label);
      }
    });
  }

  group('the pinned header is unchanged where it fits', () {
    for (final (String name, Size size, double scale)
        in <(String, Size, double)>[
          ('320×693 @200%', const Size(320, 693), 2),
          ('390×844 @100%', const Size(390, 844), 1),
        ]) {
      for (final String location in <String>['/standings', '/explore']) {
        testWidgets('$location $name with the STAGING strip and banner: '
            'pinned, no page scroll, no overflow', (WidgetTester tester) async {
          await _open(
            tester,
            location: location,
            theme: AppThemePreference.dark,
            size: size,
            scale: scale,
          );
          expect(tester.takeException(), isNull);
          expect(
            find.byKey(const ValueKey<String>('primer-pinned-header-scroll')),
            findsNothing,
          );
          final Finder header = location == '/standings'
              ? find.byType(StandingsHeader)
              : find.byType(ExploreHeader);
          final Rect before = tester.getRect(header);
          final Finder list = _list;
          await scrollToEnd(tester, list);
          expect(tester.getRect(header), before, reason: 'still pinned');
          expect(tester.takeException(), isNull);
        });
      }
    }
  });
}
