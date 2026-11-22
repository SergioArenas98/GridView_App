import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/gridview_theme.dart';
import 'package:gridview/core/theme/gv_primer_roles.dart';
import 'package:gridview/core/theme/gv_semantic_colors.dart';
import 'package:gridview/core/theme/gv_text_styles.dart';

import '../support/router_harness.dart';

/// Step 55A integration: the Primer V2 roles ride on the existing theme
/// infrastructure, follow the theme preference (including ThemeMode.system),
/// and leave every legacy, currently rendered theme value untouched.

GvPrimerRoles? primerOf(WidgetTester tester) => Theme.of(
  tester.element(find.byType(Scaffold).first),
).extension<GvPrimerRoles>();

void main() {
  group('installed through the existing theme builder', () {
    test('both themes install the Primer V2 roles next to the legacy '
        'extensions', () {
      final ThemeData dark = buildGridViewDarkTheme();
      final ThemeData light = buildGridViewLightTheme();

      expect(dark.extension<GvPrimerRoles>(), same(GvPrimerRoles.dark));
      expect(light.extension<GvPrimerRoles>(), same(GvPrimerRoles.light));
      // The legacy extensions are still the ones the app renders with.
      expect(dark.extension<GvSemanticColors>(), same(GvSemanticColors.dark));
      expect(light.extension<GvSemanticColors>(), same(GvSemanticColors.light));
      expect(dark.extension<GvTextStyles>(), same(GvTextStyles.dark));
      expect(light.extension<GvTextStyles>(), same(GvTextStyles.light));
    });

    testWidgets(
      'context.gvPrimer falls back to Dark outside a GridView theme',
      (WidgetTester tester) async {
        late GvPrimerRoles resolved;
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(),
            home: Builder(
              builder: (BuildContext context) {
                resolved = context.gvPrimer;
                return const SizedBox();
              },
            ),
          ),
        );
        expect(resolved, same(GvPrimerRoles.dark));
      },
    );
  });

  group('legacy appearance is preserved (Primer V2 not activated)', () {
    // Literal legacy values: if Primer V2 ever leaks into the Material
    // configuration before a migration step activates it, these fail.
    test('Dark Material configuration is unchanged', () {
      final ThemeData t = buildGridViewDarkTheme();
      expect(t.scaffoldBackgroundColor, const Color(0xFF0B0D12));
      expect(t.canvasColor, const Color(0xFF0B0D12));
      expect(t.colorScheme.primary, const Color(0xFFFF3B30));
      expect(t.colorScheme.secondary, const Color(0xFF3B82F6));
      expect(t.colorScheme.surface, const Color(0xFF11151C));
      expect(t.colorScheme.onSurface, const Color(0xFFF5F7FA));
      expect(t.colorScheme.onSurfaceVariant, const Color(0xFFA1AAB8));
      expect(t.colorScheme.surfaceContainerHighest, const Color(0xFF202734));
      expect(t.colorScheme.outline, const Color(0xFF2D3645));
      expect(t.dividerColor, const Color(0xFF2D3645));
      expect(t.cardTheme.color, const Color(0xFF171C24));
      expect(t.appBarTheme.backgroundColor, const Color(0xFF0B0D12));
      expect(
        t.elevatedButtonTheme.style!.backgroundColor!.resolve(<WidgetState>{}),
        const Color(0xFFDC2626),
      );
      expect(t.textTheme.bodyMedium!.color, const Color(0xFFD9DEE7));
      // No family is bundled (GvFonts are null), so Material's default
      // typography supplies Roboto; Archivo is not activated in Step 55A.
      expect(t.textTheme.bodyMedium!.fontFamily, 'Roboto');
      expect(t.textTheme.headlineLarge!.fontFamily, 'Roboto');
    });

    test('Light Material configuration is unchanged', () {
      final ThemeData t = buildGridViewLightTheme();
      expect(t.scaffoldBackgroundColor, const Color(0xFFF1F4F9));
      expect(t.canvasColor, const Color(0xFFF1F4F9));
      expect(t.colorScheme.primary, const Color(0xFFC62719));
      expect(t.colorScheme.secondary, const Color(0xFF1D4ED8));
      expect(t.colorScheme.surface, const Color(0xFFF7F9FC));
      expect(t.colorScheme.onSurface, const Color(0xFF0F131A));
      expect(t.colorScheme.onSurfaceVariant, const Color(0xFF566070));
      expect(t.colorScheme.surfaceContainerHighest, const Color(0xFFE5EAF2));
      expect(t.colorScheme.outline, const Color(0xFFC7D0DE));
      expect(t.dividerColor, const Color(0xFFC7D0DE));
      expect(t.cardTheme.color, const Color(0xFFFFFFFF));
      expect(t.appBarTheme.backgroundColor, const Color(0xFFF1F4F9));
      expect(
        t.elevatedButtonTheme.style!.backgroundColor!.resolve(<WidgetState>{}),
        const Color(0xFFC62719),
      );
      expect(t.textTheme.bodyMedium!.color, const Color(0xFF333C4A));
      expect(t.textTheme.bodyMedium!.fontFamily, 'Roboto');
    });
  });

  group('follows the theme preference in the real app', () {
    testWidgets('explicit preferences pin their Primer roles', (
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
      expect(primerOf(tester), same(GvPrimerRoles.dark));

      await pumpApp(
        tester,
        preferences: AppPreferences.defaults.copyWith(
          theme: AppThemePreference.light,
        ),
        platformBrightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(primerOf(tester), same(GvPrimerRoles.light));
    });

    testWidgets(
      'ThemeMode.system resolves the Primer roles from the platform',
      (WidgetTester tester) async {
        for (final Brightness platform in Brightness.values) {
          await pumpApp(
            tester,
            preferences: AppPreferences.defaults.copyWith(
              theme: AppThemePreference.system,
            ),
            platformBrightness: platform,
            disableAnimations: true,
          );
          expect(primerOf(tester)!.brightness, platform, reason: platform.name);
          // The legacy roles resolve in step: one theme, not two systems.
          final ThemeData theme = Theme.of(
            tester.element(find.byType(Scaffold).first),
          );
          expect(theme.brightness, platform);
          expect(
            theme.extension<GvSemanticColors>(),
            same(
              platform == Brightness.dark
                  ? GvSemanticColors.dark
                  : GvSemanticColors.light,
            ),
          );
        }
      },
    );
  });
}
