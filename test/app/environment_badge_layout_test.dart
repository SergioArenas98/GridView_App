import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/features/explore/presentation/widgets/explore_header.dart';
import 'package:gridview/features/home/presentation/widgets/home_header.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_app_bar.dart';
import 'package:gridview/features/shared/presentation/widgets/environment_badge.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_app_bar.dart';
import 'package:gridview/features/standings/presentation/widgets/standings_header.dart';

import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

/// The STAGING/DEV badge must never cover a screen's title.
///
/// On the reference phone the badge floated over the app bar and hid part of
/// long titles (Grand Prix detail, Acknowledgements, the Spanish
/// "Clasificaciones"). These checks measure the real layout: the badge sits in
/// its own strip, every app bar starts below it, and the app bar itself is not
/// pushed down twice by the status bar.

/// A status-bar inset like a phone's, so the safe-area handling is exercised.
const EdgeInsets _statusBar = EdgeInsets.only(top: 24);

const Map<String, String> _screens = <String, String>{
  'Home': '/',
  'Standings': '/standings',
  'Explore': '/explore',
  'Grand Prix detail': '/calendar/2026/13',
  'Settings': '/settings',
  'Data and updates': '/settings/data',
  'Acknowledgements': '/settings/acknowledgements',
};

const Map<String, Size> _surfaces = <String, Size>{
  'compact 320x568': Size(320, 568),
  'phone 360x640': Size(360, 640),
};

const List<Locale> _locales = <Locale>[Locale('en'), Locale('es')];

const List<double> _textScales = <double>[1.0, 1.3, 2.0];

/// The Primer V2 bottom navigation (Step 55C.15) fits its labels by their
/// measured width, so the real Archivo metrics are loaded: with the test font
/// every label is too wide and the bar would take its 2 × 2 layout at sizes
/// where the app shows one row.
Future<void> _pump(
  WidgetTester tester, {
  required String location,
  AppEnvironment environment = AppEnvironment.staging,
  Size surfaceSize = const Size(360, 640),
  Locale locale = const Locale('en'),
  double textScale = 1.0,
}) async {
  await loadArchivo(tester);
  await pumpApp(
    tester,
    initialLocation: location,
    environment: environment,
    environmentBadge: true,
    padding: _statusBar,
    surfaceSize: surfaceSize,
    locale: locale,
    textScale: textScale,
    disableAnimations: true,
  );
}

void _expectBadgeClearOfAppBars(WidgetTester tester, String label) {
  final Rect badge = tester.getRect(find.byType(GvEnvironmentBadge));
  expect(
    badge.top,
    greaterThanOrEqualTo(_statusBar.top),
    reason: '$label: the badge stays out of the status bar',
  );

  // The Primer V2 Home (Step 55C.1) has no Material app bar: its header
  // scrolls with the page. The same rules apply to it.
  final Finder homeHeader = find.byType(HomeHeader);
  if (homeHeader.evaluate().isNotEmpty) {
    final Rect header = tester.getRect(homeHeader);
    expect(
      header.top,
      greaterThanOrEqualTo(badge.bottom),
      reason: '$label: the Home header starts below the badge',
    );
    expect(
      header.top - badge.bottom,
      lessThan(_statusBar.top),
      reason: '$label: the status bar is not added to the header again',
    );
    final Rect title = tester.getRect(find.text('GridView'));
    expect(
      title.overlaps(badge),
      isFalse,
      reason: '$label: the GridView wordmark is not covered',
    );
    return;
  }

  // The Primer V2 Standings (Step 55C.5) and Explore (Step 55C.7) have their
  // own pinned header instead of a Material app bar, as does the Primer V2
  // Grand Prix detail (Step 55C.12, the shared Primer detail app bar) and the
  // Primer V2 Settings screens (Steps 55C.13A and 55C.13B, the wrapping
  // Settings app bar).
  // The same rules apply.
  final Finder standingsHeader = find.byWidgetPredicate(
    (Widget w) =>
        w is StandingsHeader ||
        w is ExploreHeader ||
        w is PrimerDetailAppBar ||
        w is SettingsAppBar,
  );
  if (standingsHeader.evaluate().isNotEmpty) {
    final Rect header = tester.getRect(standingsHeader);
    expect(
      header.top,
      greaterThanOrEqualTo(badge.bottom),
      reason: '$label: the pinned header starts below the badge',
    );
    expect(
      header.top - badge.bottom,
      lessThan(_statusBar.top),
      reason: '$label: the status bar is not added to the header again',
    );
    for (final Element text
        in find
            .descendant(of: standingsHeader, matching: find.byType(Text))
            .evaluate()) {
      expect(
        tester.getRect(find.byWidget(text.widget)).overlaps(badge),
        isFalse,
        reason: '$label: "${(text.widget as Text).data}" is not covered',
      );
    }
    return;
  }

  final Finder appBars = find.byType(AppBar);
  expect(appBars, findsWidgets, reason: '$label: an app bar is shown');
  for (final Element appBar in appBars.evaluate()) {
    final Rect bar = tester.getRect(find.byWidget(appBar.widget));
    expect(
      bar.top,
      greaterThanOrEqualTo(badge.bottom),
      reason: '$label: the app bar starts below the badge',
    );
    expect(
      bar.height,
      kToolbarHeight,
      reason: '$label: the status bar is not added to the app bar again',
    );
    final Finder texts = find.descendant(
      of: find.byWidget(appBar.widget),
      matching: find.byType(Text),
    );
    for (final Element text in texts.evaluate()) {
      final Rect title = tester.getRect(find.byWidget(text.widget));
      expect(
        title.overlaps(badge),
        isFalse,
        reason: '$label: "${(text.widget as Text).data}" is not covered',
      );
    }
  }
}

void main() {
  for (final MapEntry<String, String> screen in _screens.entries) {
    for (final MapEntry<String, Size> surface in _surfaces.entries) {
      for (final Locale locale in _locales) {
        for (final double scale in _textScales) {
          final String label =
              '${screen.key}, ${surface.key}, ${locale.languageCode}, '
              '${scale}x text';
          testWidgets('the STAGING badge clears the title: $label', (
            WidgetTester tester,
          ) async {
            await _pump(
              tester,
              location: screen.value,
              surfaceSize: surface.value,
              locale: locale,
              textScale: scale,
            );

            expect(
              find.descendant(
                of: find.byType(GvEnvironmentBadge),
                matching: find.text('STAGING'),
              ),
              findsOneWidget,
            );
            _expectBadgeClearOfAppBars(tester, label);
          });
        }
      }
    }
  }

  testWidgets('a development build reserves the same strip for DEV', (
    WidgetTester tester,
  ) async {
    await _pump(
      tester,
      location: '/calendar/2026/13',
      environment: AppEnvironment.development,
      surfaceSize: const Size(320, 568),
      locale: const Locale('es'),
    );

    expect(
      find.descendant(
        of: find.byType(GvEnvironmentBadge),
        matching: find.text('DEV'),
      ),
      findsOneWidget,
    );
    _expectBadgeClearOfAppBars(tester, 'development');
  });

  testWidgets('the badge strip ignores taps', (WidgetTester tester) async {
    await _pump(tester, location: '/');

    final Finder strip = find.byKey(
      const ValueKey<String>('environment-badge-strip'),
    );
    expect(
      find.descendant(of: strip, matching: find.byType(IgnorePointer)),
      findsOneWidget,
    );
    final IgnorePointer ignore = tester.widget(
      find.descendant(of: strip, matching: find.byType(IgnorePointer)),
    );
    expect(ignore.ignoring, isTrue);
  });

  for (final MapEntry<String, String> screen in _screens.entries) {
    testWidgets('production layout is unchanged: ${screen.key}', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: screen.value,
        environment: AppEnvironment.production,
      );

      expect(
        find.byKey(const ValueKey<String>('environment-badge-strip')),
        findsNothing,
      );
      expect(find.byType(GvEnvironmentBadge), findsNothing);
      if (screen.value == '/') {
        // Primer V2 Home: the page colour runs under the status bar and the
        // scrolling header starts right below it.
        expect(tester.getRect(find.byType(HomeHeader)).top, _statusBar.top);
        return;
      }
      if (screen.value == '/standings') {
        // Primer V2 Standings: the page colour runs under the status bar and
        // the pinned header starts right below it.
        expect(
          tester.getRect(find.byType(StandingsHeader)).top,
          _statusBar.top,
        );
        return;
      }
      if (screen.value == '/explore') {
        // Primer V2 Explore (Step 55C.7): as Standings.
        expect(tester.getRect(find.byType(ExploreHeader)).top, _statusBar.top);
        return;
      }
      if (screen.value.startsWith('/calendar/')) {
        // Primer V2 Grand Prix detail (Step 55C.12): as Standings, with the
        // shared Primer detail app bar inside the safe area.
        expect(
          tester.getRect(find.byType(PrimerDetailAppBar)).top,
          _statusBar.top,
        );
        return;
      }
      if (screen.value.startsWith('/settings')) {
        // Primer V2 Settings (Step 55C.13A root, Step 55C.13B information
        // screens): as Standings, with the Settings app bar inside the safe
        // area.
        expect(tester.getRect(find.byType(SettingsAppBar)).top, _statusBar.top);
        return;
      }
      // The app bar starts at the top and extends under the status bar,
      // exactly as it does with no overlay installed at all.
      final Rect bar = tester.getRect(find.byType(AppBar).first);
      expect(bar.top, 0);
      expect(bar.height, kToolbarHeight + _statusBar.top);
    });
  }
}
