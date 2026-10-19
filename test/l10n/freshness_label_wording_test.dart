import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/l10n/app_localizations.dart';

/// Synchronization §3.2: the freshness caption shows `lastSuccessAt`, the last
/// time this device checked the resource with the server successfully (a 200
/// or a 304). It never claims the content was updated or published then.
void main() {
  const Map<String, String> approved = <String, String>{
    'en': 'Last successful check: 12:00',
    'es': 'Comprobado: 12:00',
  };

  test('every supported locale has approved caption copy', () {
    expect(
      AppLocalizations.supportedLocales
          .map((Locale l) => l.languageCode)
          .toSet(),
      approved.keys.toSet(),
      reason: 'a new locale needs its freshness caption approved here',
    );
  });

  for (final Locale locale in AppLocalizations.supportedLocales) {
    test('${locale.languageCode} says "last successful check"', () {
      final AppLocalizations l10n = lookupAppLocalizations(locale);
      final String expected = approved[locale.languageCode]!;

      // Home's caption and the Calendar / Standings caption read the same.
      expect(l10n.homeUpdated('12:00'), expected);
      expect(l10n.lastUpdatedLabel('12:00'), expected);
      for (final String claim in <String>['Updated', 'Actualizado']) {
        expect(l10n.homeUpdated('12:00'), isNot(contains(claim)));
        expect(l10n.lastUpdatedLabel('12:00'), isNot(contains(claim)));
      }
    });
  }
}
