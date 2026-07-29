import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/preferences/preference_values.dart';

void main() {
  group('wire tokens', () {
    test('every preference persists a stable token, never an enum index', () {
      expect(
        AppLanguagePreference.values.map((AppLanguagePreference v) => v.wire),
        <String>['system', 'english', 'spanish'],
      );
      expect(
        AppThemePreference.values.map((AppThemePreference v) => v.wire),
        <String>['system', 'dark', 'light'],
      );
      expect(
        TimeDisplayPreference.values.map((TimeDisplayPreference v) => v.wire),
        <String>['device', 'event', 'both'],
      );

      // A token is never a bare integer, which is what makes an enum reorder
      // safe and a stored value readable across releases.
      for (final String token in <String>[
        ...AppLanguagePreference.values.map(
          (AppLanguagePreference v) => v.wire,
        ),
        ...AppThemePreference.values.map((AppThemePreference v) => v.wire),
        ...TimeDisplayPreference.values.map(
          (TimeDisplayPreference v) => v.wire,
        ),
      ]) {
        expect(
          int.tryParse(token),
          isNull,
          reason: '"$token" must not be numeric',
        );
      }
    });

    test('tokens round trip', () {
      for (final AppLanguagePreference v in AppLanguagePreference.values) {
        expect(AppLanguagePreference.fromWire(v.wire), v);
      }
      for (final AppThemePreference v in AppThemePreference.values) {
        expect(AppThemePreference.fromWire(v.wire), v);
      }
      for (final TimeDisplayPreference v in TimeDisplayPreference.values) {
        expect(TimeDisplayPreference.fromWire(v.wire), v);
      }
    });
  });

  group('safe fallbacks', () {
    test('a missing, unknown or corrupted token resolves to the default', () {
      for (final String? bad in <String?>[
        null,
        '',
        'SYSTEM',
        'Español',
        '1',
        'dark ',
        '{"theme":"dark"}',
      ]) {
        expect(
          AppLanguagePreference.fromWire(bad),
          AppLanguagePreference.system,
        );
        expect(AppThemePreference.fromWire(bad), AppThemePreference.dark);
        expect(
          TimeDisplayPreference.fromWire(bad),
          TimeDisplayPreference.device,
        );
      }
    });

    test(
      'the documented defaults are language system, theme dark, time device',
      () {
        expect(AppPreferences.defaults.language, AppLanguagePreference.system);
        expect(AppPreferences.defaults.theme, AppThemePreference.dark);
        expect(
          AppPreferences.defaults.timeDisplay,
          TimeDisplayPreference.device,
        );
      },
    );
  });

  group('derived values', () {
    test('language maps to a locale, and system pins nothing', () {
      expect(AppLanguagePreference.system.locale, isNull);
      expect(AppLanguagePreference.english.locale, const Locale('en'));
      expect(AppLanguagePreference.spanish.locale, const Locale('es'));
    });

    test('theme maps to a ThemeMode', () {
      expect(AppThemePreference.system.themeMode, ThemeMode.system);
      expect(AppThemePreference.dark.themeMode, ThemeMode.dark);
      expect(AppThemePreference.light.themeMode, ThemeMode.light);
    });
  });

  group('snapshot', () {
    test('copyWith replaces only the named preference', () {
      const AppPreferences base = AppPreferences.defaults;
      final AppPreferences next = base.copyWith(
        theme: AppThemePreference.light,
      );
      expect(next.theme, AppThemePreference.light);
      expect(next.language, base.language);
      expect(next.timeDisplay, base.timeDisplay);
    });

    test('equality is by value, so an unchanged snapshot never re-emits', () {
      expect(
        const AppPreferences(
          language: AppLanguagePreference.spanish,
          theme: AppThemePreference.light,
          timeDisplay: TimeDisplayPreference.both,
        ),
        const AppPreferences(
          language: AppLanguagePreference.spanish,
          theme: AppThemePreference.light,
          timeDisplay: TimeDisplayPreference.both,
        ),
      );
      expect(
        AppPreferences.defaults,
        isNot(
          AppPreferences.defaults.copyWith(theme: AppThemePreference.light),
        ),
      );
    });
  });
}
