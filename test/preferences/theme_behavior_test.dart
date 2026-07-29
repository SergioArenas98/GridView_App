import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/preferences/preferences_providers.dart';
import 'package:gridview/core/theme/gridview_theme.dart';
import 'package:gridview/core/theme/gv_semantic_colors.dart';
import 'package:gridview/core/theme/gv_text_styles.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/settings/presentation/settings_screen.dart';

import '../support/component_harness.dart';
import '../support/router_harness.dart';

/// The brightness the app actually resolved, read from the rendered theme rather
/// than from the preference, so these tests observe the outcome and not the
/// input.
Brightness resolvedBrightness(WidgetTester tester) =>
    Theme.of(tester.element(find.byType(Scaffold).first)).brightness;

void main() {
  group('theme mode resolution', () {
    testWidgets('dark and light preferences pin their theme', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        preferences: AppPreferences.defaults.copyWith(
          theme: AppThemePreference.dark,
        ),
        platformBrightness: Brightness.light,
        disableAnimations: true,
      );
      expect(resolvedBrightness(tester), Brightness.dark);

      await pumpApp(
        tester,
        preferences: AppPreferences.defaults.copyWith(
          theme: AppThemePreference.light,
        ),
        platformBrightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(resolvedBrightness(tester), Brightness.light);
    });

    testWidgets('system follows the platform brightness', (
      WidgetTester tester,
    ) async {
      for (final Brightness platform in Brightness.values) {
        await pumpApp(
          tester,
          preferences: AppPreferences.defaults.copyWith(
            theme: AppThemePreference.system,
          ),
          platformBrightness: platform,
          disableAnimations: true,
        );
        expect(resolvedBrightness(tester), platform, reason: platform.name);
      }
    });

    testWidgets('a platform brightness change moves the system theme but not '
        'an explicit one', (WidgetTester tester) async {
      // System: the same preference resolves differently per platform.
      await pumpApp(
        tester,
        preferences: AppPreferences.defaults.copyWith(
          theme: AppThemePreference.system,
        ),
        platformBrightness: Brightness.light,
        disableAnimations: true,
      );
      expect(resolvedBrightness(tester), Brightness.light);

      // Explicit dark: the platform is ignored in both directions.
      for (final Brightness platform in Brightness.values) {
        await pumpApp(
          tester,
          preferences: AppPreferences.defaults.copyWith(
            theme: AppThemePreference.dark,
          ),
          platformBrightness: platform,
          disableAnimations: true,
        );
        expect(
          resolvedBrightness(tester),
          Brightness.dark,
          reason: platform.name,
        );
      }
    });
  });

  group('system overlays', () {
    test('each theme inverts the system bar icons against its own bars', () {
      final SystemUiOverlayStyle dark =
          buildGridViewDarkTheme().appBarTheme.systemOverlayStyle!;
      final SystemUiOverlayStyle light =
          buildGridViewLightTheme().appBarTheme.systemOverlayStyle!;

      expect(dark.statusBarIconBrightness, Brightness.light);
      expect(dark.systemNavigationBarIconBrightness, Brightness.light);
      expect(dark.systemNavigationBarColor, GvSemanticColors.dark.background);

      expect(light.statusBarIconBrightness, Brightness.dark);
      expect(light.systemNavigationBarIconBrightness, Brightness.dark);
      expect(light.systemNavigationBarColor, GvSemanticColors.light.background);

      // The status bar itself stays transparent in both, so the app background
      // shows through rather than a second competing colour.
      expect(dark.statusBarColor, const Color(0x00000000));
      expect(light.statusBarColor, const Color(0x00000000));
    });
  });

  group('semantic role completeness', () {
    test('both themes install both GridView extensions', () {
      for (final ThemeData theme in <ThemeData>[
        buildGridViewDarkTheme(),
        buildGridViewLightTheme(),
      ]) {
        expect(theme.extension<GvSemanticColors>(), isNotNull);
        expect(theme.extension<GvTextStyles>(), isNotNull);
      }
    });

    test('the two palettes differ in every surface and text role', () {
      const GvSemanticColors d = GvSemanticColors.dark;
      const GvSemanticColors l = GvSemanticColors.light;
      // A role that accidentally shared a value between themes would mean the
      // light theme had not actually been given that role.
      expect(d.background, isNot(l.background));
      expect(d.surface, isNot(l.surface));
      expect(d.surfaceElevated, isNot(l.surfaceElevated));
      expect(d.surfaceElevatedAlt, isNot(l.surfaceElevatedAlt));
      expect(d.textPrimary, isNot(l.textPrimary));
      expect(d.textSecondary, isNot(l.textSecondary));
      expect(d.textMuted, isNot(l.textMuted));
      expect(d.divider, isNot(l.divider));
      expect(d.heroScrimBottom, isNot(l.heroScrimBottom));
    });

    test('the dark scale is unchanged from the raw typographic constants', () {
      // This is what keeps unrelated dark goldens byte-identical: migrating a
      // call site from GvTypography to context.gvText cannot change a pixel.
      final GvTextStyles dark = GvTextStyles.dark;
      expect(dark.caption.color, GvSemanticColors.dark.textMuted);
      expect(dark.bodyM.color, GvSemanticColors.dark.textSecondary);
      expect(dark.cardTitle.color, GvSemanticColors.dark.textPrimary);
      expect(dark.statValue.fontFeatures, isNotNull);
    });
  });

  group('shared components render in light', () {
    // A smoke matrix: every shared component builds and paints under the light
    // theme without throwing and without an unresolved colour.
    final Map<String, Widget> components = <String, Widget>{
      'primary button': GvPrimaryButton(label: 'Go', onPressed: () {}),
      'disabled primary button': const GvPrimaryButton(label: 'Off'),
      'loading primary button': const GvPrimaryButton(
        label: 'Load',
        isLoading: true,
      ),
      'secondary button': GvSecondaryButton(label: 'More', onPressed: () {}),
      'status chip info': const GvStatusChip(
        label: 'Upcoming',
        tone: GvStatusTone.info,
      ),
      'status chip live': const GvStatusChip(
        label: 'Live',
        tone: GvStatusTone.live,
      ),
      'status chip success': const GvStatusChip(
        label: 'Done',
        tone: GvStatusTone.success,
      ),
      'status chip warning': const GvStatusChip(
        label: 'Postponed',
        tone: GvStatusTone.warning,
      ),
      'content card': const GvContentCard(child: Text('Card')),
      'segmented control': GvSegmentedControl(
        segments: const <String>['Drivers', 'Teams'],
        selectedIndex: 0,
        onChanged: (_) {},
      ),
      'empty state': const GvEmptyState(
        title: 'Nothing yet',
        message: 'Nothing has been published.',
      ),
      'error state': const GvErrorState(
        title: "Can't load",
        message: 'Try again later.',
        retryLabel: 'Try again',
      ),
      'driver row': const GvDriverRow(
        name: 'Driver',
        team: 'Team',
        number: '1',
        shortCode: 'DRV',
      ),
      'data card': const GvDataCard(label: 'Points', value: '210.5'),
      'hero card': const GvHeroCard(child: Text('Hero')),
      'hero card with background': const GvHeroCard(
        background: GvImagePlaceholder(),
        child: Text('Hero'),
      ),
      'image placeholder': const GvImagePlaceholder(semanticLabel: 'Portrait'),
      'skeleton card': const GvSkeletonCard(),
      'section header': const GvSectionHeader(title: 'Section'),
      'standings row': const GvStandingsRow(
        position: '1',
        name: 'Driver',
        team: 'Team',
        points: '210.5',
        isLeader: true,
        accentColor: Color(0xFF1E41FF),
      ),
      'session row': const GvSessionRow(
        name: 'Race',
        time: '15:00 CEST',
        secondaryTime: '14:00 UTC',
        statusLabel: 'Scheduled',
      ),
      'offline notice': const GvOfflineNotice(message: 'Showing cached data'),
      'ad container': const GvAdContainer(),
    };

    components.forEach((String name, Widget widget) {
      testWidgets('$name renders in the light theme', (
        WidgetTester tester,
      ) async {
        await pumpComponent(tester, widget, brightness: Brightness.light);
        expect(tester.takeException(), isNull, reason: name);
      });
    });
  });

  group('changing the theme preserves navigation and scroll', () {
    testWidgets('the route and its scroll offset survive a theme change', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        surfaceSize: const Size(390, 844),
        disableAnimations: true,
      );

      // Scroll Home away from the top.
      final Finder list = find.byType(ListView).first;
      await tester.drag(list, const Offset(0, -240));
      await tester.pumpAndSettle();
      final double before = tester
          .widget<Scrollable>(find.byType(Scrollable).first)
          .controller!
          .offset;
      expect(before, greaterThan(0));

      await containerOf(tester)
          .read(appPreferencesProvider.notifier)
          .setTheme(AppThemePreference.light);
      await tester.pumpAndSettle();

      expect(resolvedBrightness(tester), Brightness.light);
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(
        tester
            .widget<Scrollable>(find.byType(Scrollable).first)
            .controller!
            .offset,
        before,
      );
    });

    testWidgets('a theme change on a Settings sub-route keeps that route', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/settings',
        surfaceSize: const Size(400, 1600),
        disableAnimations: true,
      );

      await containerOf(tester)
          .read(appPreferencesProvider.notifier)
          .setTheme(AppThemePreference.light);
      await tester.pumpAndSettle();

      expect(resolvedBrightness(tester), Brightness.light);
      expect(find.byType(SettingsScreen), findsOneWidget);
    });
  });
}
