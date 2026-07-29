import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/router/entity_navigation.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/settings/presentation/preference_screens.dart';
import 'package:gridview/features/settings/presentation/settings_screen.dart';

import '../support/router_harness.dart';

/// A tall surface so the whole Settings list is laid out and every row is
/// tappable without scrolling.
const Size _tall = Size(400, 1600);

/// Settings is reached the way the product reaches it: the app-bar action on a
/// primary screen.
///
/// Assertions are made on the rendered screens rather than on the router's
/// location, because go_router's public route-information provider tracks the
/// declarative location only and an imperative `push` never updates it. What
/// matters to the reader is which screen is in front of them and what back
/// returns to, and that is exactly what these tests observe.
Future<void> openSettingsFromAppBar(WidgetTester tester) async {
  await tester.tap(find.byIcon(Icons.settings_outlined).first);
  await tester.pumpAndSettle();
}

Future<void> tapBack(WidgetTester tester) async {
  await tester.tap(find.byType(BackButton));
  await tester.pumpAndSettle();
}

void main() {
  group('Settings is secondary', () {
    testWidgets('opening Settings from Home returns to Home', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, surfaceSize: _tall, disableAnimations: true);
      expect(find.byType(HomeScreen), findsOneWidget);

      await openSettingsFromAppBar(tester);
      expect(find.byType(SettingsScreen), findsOneWidget);
      // The Home branch stays *mounted* beneath Settings — offstage, because the
      // pushed route is opaque — so its state and scroll position survive rather
      // than being rebuilt when the user comes back.
      expect(find.byType(HomeScreen, skipOffstage: false), findsOneWidget);

      await tapBack(tester);
      expect(find.byType(SettingsScreen), findsNothing);
      expect(find.byType(HomeScreen), findsOneWidget);
    });

    testWidgets('Settings is not a navigation destination', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, surfaceSize: _tall, disableAnimations: true);
      await openSettingsFromAppBar(tester);

      // Settings covers the shell, so its own app-bar action is gone: Settings
      // never becomes a fifth branch.
      expect(find.byIcon(Icons.settings_outlined), findsNothing);
    });

    testWidgets('a repeated tap cannot stack a second Settings page', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, surfaceSize: _tall, disableAnimations: true);
      await openSettingsFromAppBar(tester);

      // Fire the same navigation twice more from the already-open route.
      final BuildContext context = tester.element(find.byType(SettingsScreen));
      context.openSettings();
      context.openSettings();
      await tester.pumpAndSettle();

      expect(find.byType(SettingsScreen), findsOneWidget);
      // A single back returns to the origin, proving nothing stacked.
      await tapBack(tester);
      expect(find.byType(SettingsScreen), findsNothing);
      expect(find.byType(HomeScreen), findsOneWidget);
    });

    testWidgets('opening Settings from a detail returns to that same detail', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/drivers/max-verstappen',
        surfaceSize: _tall,
        disableAnimations: true,
      );
      expect(find.byType(DriverDetailScreen), findsOneWidget);

      tester.element(find.byType(DriverDetailScreen)).openSettings();
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);

      await tapBack(tester);
      expect(find.byType(SettingsScreen), findsNothing);
      expect(find.byType(DriverDetailScreen), findsOneWidget);
    });

    testWidgets(
      'a Settings sub-screen walks back through Settings to the origin',
      (WidgetTester tester) async {
        await pumpApp(tester, surfaceSize: _tall, disableAnimations: true);
        await openSettingsFromAppBar(tester);

        await tester.tap(find.byKey(const ValueKey<String>('settings-theme')));
        await tester.pumpAndSettle();
        expect(find.byType(ThemeSettingsScreen), findsOneWidget);

        await tapBack(tester);
        expect(find.byType(ThemeSettingsScreen), findsNothing);
        expect(find.byType(SettingsScreen), findsOneWidget);

        await tapBack(tester);
        expect(find.byType(SettingsScreen), findsNothing);
        expect(find.byType(HomeScreen), findsOneWidget);
      },
    );
  });

  group('preferences do not disturb navigation', () {
    testWidgets('changing the theme keeps the current screen', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/settings/theme',
        surfaceSize: _tall,
        disableAnimations: true,
      );

      await tester.tap(
        find.byKey(
          const ValueKey<Object?>('preference-option-AppThemePreference.light'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ThemeSettingsScreen), findsOneWidget);
    });

    testWidgets('changing the language keeps the current screen', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/settings/language',
        surfaceSize: _tall,
        disableAnimations: true,
      );

      await tester.tap(
        find.byKey(
          const ValueKey<Object?>(
            'preference-option-AppLanguagePreference.spanish',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(LanguageSettingsScreen), findsOneWidget);
      expect(find.text('Idioma'), findsWidgets);
    });

    testWidgets('changing a preference issues no synchronization request', (
      WidgetTester tester,
    ) async {
      int refreshes = 0;
      await pumpApp(
        tester,
        initialLocation: '/settings/time',
        surfaceSize: _tall,
        disableAnimations: true,
        onManualRefresh: () async => refreshes++,
      );

      for (final TimeDisplayPreference preference
          in TimeDisplayPreference.values) {
        await tester.tap(
          find.byKey(ValueKey<Object?>('preference-option-$preference')),
        );
        await tester.pumpAndSettle();
      }

      expect(refreshes, 0);
    });
  });
}
