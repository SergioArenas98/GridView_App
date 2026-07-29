import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/preferences/locale_resolution.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/l10n/app_localizations.dart';

void main() {
  /// The real supported set, so the rules are asserted against what the
  /// application actually ships rather than against a stand-in.
  final List<Locale> supported = AppLocalizations.supportedLocales;

  Locale resolve(AppLanguagePreference preference, List<Locale>? platform) =>
      resolveAppLocale(
        preference: preference,
        platformLocales: platform,
        supportedLocales: supported,
      );

  test('the application supports exactly English and Spanish', () {
    expect(supported.map((Locale l) => l.languageCode).toSet(), <String>{
      'en',
      'es',
    });
  });

  group('system preference', () {
    test('a supported platform language is used', () {
      expect(
        resolve(AppLanguagePreference.system, <Locale>[const Locale('es')]),
        const Locale('es'),
      );
      expect(
        resolve(AppLanguagePreference.system, <Locale>[const Locale('en')]),
        const Locale('en'),
      );
    });

    test('regional Spanish resolves to Spanish', () {
      for (final Locale regional in <Locale>[
        const Locale('es', 'ES'),
        const Locale('es', 'MX'),
        const Locale('es', '419'),
        Locale.fromSubtags(languageCode: 'es', scriptCode: 'Latn'),
      ]) {
        expect(
          resolve(AppLanguagePreference.system, <Locale>[regional]),
          const Locale('es'),
          reason: regional.toString(),
        );
      }
    });

    test('regional English resolves to English', () {
      for (final Locale regional in <Locale>[
        const Locale('en', 'GB'),
        const Locale('en', 'US'),
        const Locale('en', 'IN'),
      ]) {
        expect(
          resolve(AppLanguagePreference.system, <Locale>[regional]),
          const Locale('en'),
          reason: regional.toString(),
        );
      }
    });

    test('an unsupported platform language falls back to English', () {
      for (final Locale unsupported in <Locale>[
        const Locale('de'),
        const Locale('fr', 'FR'),
        const Locale('ja'),
        const Locale('pt', 'BR'),
        const Locale('zz'),
      ]) {
        expect(
          resolve(AppLanguagePreference.system, <Locale>[unsupported]),
          kFallbackLocale,
          reason: unsupported.toString(),
        );
      }
    });

    test('the first supported entry in the platform list wins', () {
      // Android reports an ordered preference list; the highest-priority
      // supported language is the one the user actually asked for.
      expect(
        resolve(AppLanguagePreference.system, <Locale>[
          const Locale('de'),
          const Locale('es', 'AR'),
          const Locale('en'),
        ]),
        const Locale('es'),
      );
    });

    test('an empty or absent platform list falls back to English', () {
      expect(resolve(AppLanguagePreference.system, null), kFallbackLocale);
      expect(
        resolve(AppLanguagePreference.system, const <Locale>[]),
        kFallbackLocale,
      );
    });
  });

  group('explicit preference', () {
    test('an explicit language ignores every platform locale', () {
      for (final List<Locale> platform in <List<Locale>>[
        <Locale>[const Locale('de')],
        <Locale>[const Locale('en', 'GB')],
        <Locale>[const Locale('es', 'MX')],
        <Locale>[],
      ]) {
        expect(
          resolve(AppLanguagePreference.spanish, platform),
          const Locale('es'),
          reason: platform.toString(),
        );
        expect(
          resolve(AppLanguagePreference.english, platform),
          const Locale('en'),
          reason: platform.toString(),
        );
      }
    });

    test('a later platform locale change cannot move an explicit choice', () {
      // The same preference resolved against two different platforms is stable.
      expect(
        resolve(AppLanguagePreference.spanish, <Locale>[const Locale('en')]),
        resolve(AppLanguagePreference.spanish, <Locale>[const Locale('ja')]),
      );
    });
  });

  test(
    'resolution is total: no input throws and every result is supported',
    () {
      for (final AppLanguagePreference preference
          in AppLanguagePreference.values) {
        for (final List<Locale>? platform in <List<Locale>?>[
          null,
          const <Locale>[],
          <Locale>[const Locale('und')],
          <Locale>[const Locale('qqq', 'ZZ')],
          <Locale>[const Locale('es'), const Locale('en')],
        ]) {
          final Locale result = resolve(preference, platform);
          expect(
            supported.map((Locale l) => l.languageCode),
            contains(result.languageCode),
            reason: '$preference / $platform',
          );
        }
      }
    },
  );
}
