import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/app.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/preferences/preference_store.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/preferences/preferences_providers.dart';
import 'package:gridview/core/preferences/preferences_repository.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

/// XS-35 (Step 55C.16R): the system bars follow the Primer theme in every
/// environment and on every route.
///
/// Before the fix no production widget annotated a system overlay style (the
/// Material `AppBar`s that used to were gone), so production fell back to
/// Flutter's `MaterialApp` default: a black navigation bar in both themes.
/// Development and staging builds took the legacy style from the environment
/// strip instead.
///
/// These are flutter_tester checks of what the app *asks* the platform for
/// (`SystemChrome`). They do not prove how a particular Android version
/// renders the bars; that stays a device check (XS-16, Theme Foundation §6r).

final Finder _regions = find.byWidgetPredicate(
  (Widget w) => w is AnnotatedRegion<SystemUiOverlayStyle>,
  skipOffstage: false,
);

SystemUiOverlayStyle _expected(GvPrimerRoles roles) =>
    gvPrimerSystemOverlayStyle(roles);

/// The single region's value, and the style the platform was last asked for.
void _expectApplied(WidgetTester tester, GvPrimerRoles roles, String reason) {
  expect(_regions, findsOneWidget, reason: '$reason: one owner');
  final AnnotatedRegion<SystemUiOverlayStyle> region = tester
      .widget<AnnotatedRegion<SystemUiOverlayStyle>>(_regions);
  expect(region.value, _expected(roles), reason: '$reason: region');
  // ignore: invalid_use_of_visible_for_testing_member
  expect(SystemChrome.latestStyle, _expected(roles), reason: '$reason: chrome');
}

Future<AppPreferencesRepository> _pumpGridViewApp(
  WidgetTester tester, {
  required AppEnvironment environment,
  required AppThemePreference theme,
}) async {
  final FakeRaceWeekendRepository repo = defaultFakeRepository();
  final AppPreferencesRepository preferences = AppPreferencesRepository(
    store: InMemoryPreferenceStore(
      initial: <String, String>{PreferenceKeys.theme: theme.wire},
    ),
  );
  addTearDown(preferences.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        homeRepositoryProvider.overrideWithValue(repo),
        grandPrixRepositoryProvider.overrideWithValue(repo),
        clockProvider.overrideWithValue(() => DateTime.utc(2026, 7, 18, 12)),
        currentSeasonResolverProvider.overrideWithValue(() async => 2026),
        currentSeasonProvider.overrideWith(
          (Ref ref) => Stream<int?>.value(2026),
        ),
        resourceSyncStateProvider.overrideWith(
          (Ref ref, String key) =>
              Stream<ResourceSyncState?>.value(syncedMetadata(key)),
        ),
        appEnvironmentProvider.overrideWithValue(environment),
        usesMockDataProvider.overrideWithValue(false),
        appPreferencesRepositoryProvider.overrideWithValue(preferences),
      ],
      child: const GridViewApp(),
    ),
  );
  await tester.pumpAndSettle();
  expect(find.byType(HomeScreen), findsOneWidget);
  return preferences;
}

void main() {
  group('gvPrimerSystemOverlayStyle', () {
    test('Dark: transparent status bar, light icons, an opaque dark '
        'navigation surface from the Primer roles', () {
      final SystemUiOverlayStyle s = gvPrimerSystemOverlayStyle(
        GvPrimerRoles.dark,
      );
      expect(s.statusBarColor, const Color(0x00000000));
      expect(s.statusBarIconBrightness, Brightness.light);
      expect(s.statusBarBrightness, Brightness.dark);
      expect(s.systemNavigationBarIconBrightness, Brightness.light);
      expect(
        s.systemNavigationBarColor,
        Color.alphaBlend(
          GvPrimerRoles.dark.surface.nav,
          GvPrimerRoles.dark.surface.page,
        ),
      );
      expect(s.systemNavigationBarColor!.a, 1.0);
      expect(s.systemNavigationBarColor!.computeLuminance(), lessThan(0.05));
    });

    test('Light: transparent status bar, dark icons, an opaque light '
        'navigation surface from the Primer roles', () {
      final SystemUiOverlayStyle s = gvPrimerSystemOverlayStyle(
        GvPrimerRoles.light,
      );
      expect(s.statusBarColor, const Color(0x00000000));
      expect(s.statusBarIconBrightness, Brightness.dark);
      expect(s.statusBarBrightness, Brightness.light);
      expect(s.systemNavigationBarIconBrightness, Brightness.dark);
      expect(
        s.systemNavigationBarColor,
        Color.alphaBlend(
          GvPrimerRoles.light.surface.nav,
          GvPrimerRoles.light.surface.page,
        ),
      );
      expect(s.systemNavigationBarColor!.a, 1.0);
      expect(s.systemNavigationBarColor!.computeLuminance(), greaterThan(0.7));
    });
  });

  group('GridViewApp applies the Primer system-bar style', () {
    for (final AppEnvironment environment in AppEnvironment.values) {
      for (final (AppThemePreference theme, GvPrimerRoles roles)
          in <(AppThemePreference, GvPrimerRoles)>[
            (AppThemePreference.dark, GvPrimerRoles.dark),
            (AppThemePreference.light, GvPrimerRoles.light),
          ]) {
        testWidgets('${environment.name} ${theme.wire}: one region, and the '
            'platform is asked for the Primer style', (
          WidgetTester tester,
        ) async {
          await _pumpGridViewApp(
            tester,
            environment: environment,
            theme: theme,
          );
          _expectApplied(tester, roles, '${environment.name} ${theme.wire}');
          // The environment strip, when present, sets no style of its own.
          if (!environment.isProduction) {
            expect(
              find.byKey(const ValueKey<String>('environment-badge-strip')),
              findsOneWidget,
            );
          }
        });
      }
    }

    testWidgets('production: switching theme updates the bars, both ways', (
      WidgetTester tester,
    ) async {
      final AppPreferencesRepository preferences = await _pumpGridViewApp(
        tester,
        environment: AppEnvironment.production,
        theme: AppThemePreference.dark,
      );
      _expectApplied(tester, GvPrimerRoles.dark, 'start dark');

      await preferences.setTheme(AppThemePreference.light);
      await tester.pumpAndSettle();
      _expectApplied(tester, GvPrimerRoles.light, 'after Light');

      await preferences.setTheme(AppThemePreference.dark);
      await tester.pumpAndSettle();
      _expectApplied(tester, GvPrimerRoles.dark, 'after Dark');
    });
  });

  group('route changes never revert the style (production)', () {
    for (final (AppThemePreference theme, GvPrimerRoles roles)
        in <(AppThemePreference, GvPrimerRoles)>[
          (AppThemePreference.dark, GvPrimerRoles.dark),
          (AppThemePreference.light, GvPrimerRoles.light),
        ]) {
      testWidgets('${theme.wire}: shell branches, detail, Settings and '
          'not-found keep the one Primer region', (WidgetTester tester) async {
        final GoRouter router = await pumpApp(
          tester,
          surfaceSize: const Size(390, 844),
          disableAnimations: true,
          environment: AppEnvironment.production,
          preferences: AppPreferences.defaults.copyWith(theme: theme),
        );
        _expectApplied(tester, roles, 'Home');
        for (final String location in <String>[
          '/calendar',
          '/standings',
          '/explore',
        ]) {
          router.go(location);
          await tester.pumpAndSettle();
          _expectApplied(tester, roles, location);
        }
        for (final String location in <String>[
          '/calendar/2026/13',
          '/drivers/max-verstappen',
          '/settings',
          '/settings/theme',
          '/nowhere',
        ]) {
          unawaited(router.push(location));
          await tester.pumpAndSettle();
          _expectApplied(tester, roles, location);
        }
      });
    }
  });
}
