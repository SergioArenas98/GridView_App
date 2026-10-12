import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/features/shared/presentation/widgets/environment_badge.dart';

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

Future<void> _pump(
  WidgetTester tester, {
  required String location,
  AppEnvironment environment = AppEnvironment.staging,
  Size surfaceSize = const Size(360, 640),
  Locale locale = const Locale('en'),
  double textScale = 1.0,
}) => pumpApp(
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

void _expectBadgeClearOfAppBars(WidgetTester tester, String label) {
  final Rect badge = tester.getRect(find.byType(GvEnvironmentBadge));
  expect(
    badge.top,
    greaterThanOrEqualTo(_statusBar.top),
    reason: '$label: the badge stays out of the status bar',
  );

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
      // The app bar starts at the top and extends under the status bar,
      // exactly as it does with no overlay installed at all.
      final Rect bar = tester.getRect(find.byType(AppBar).first);
      expect(bar.top, 0);
      expect(bar.height, kToolbarHeight + _statusBar.top);
    });
  }
}
