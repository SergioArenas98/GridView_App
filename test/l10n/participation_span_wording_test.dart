import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/presentation/entity_formatting.dart';
import 'package:gridview/l10n/app_localizations.dart';

/// ADR 0026 D6 and D12 item 3: null bounds describe what has been observed,
/// never a prediction. Null/null reads "From season start", never "Full
/// season", in every supported locale.
void main() {
  /// The approved copy for the four bound combinations, per locale:
  /// (null, null), (null, 11), (12, null), (12, 14).
  const Map<String, List<String>> approved = <String, List<String>>{
    'en': <String>[
      'From season start',
      'Until round 11',
      'From round 12',
      'Rounds 12–14',
    ],
    'es': <String>[
      'Desde el inicio de la temporada',
      'Hasta la ronda 11',
      'Desde la ronda 12',
      'Rondas 12–14',
    ],
  };

  test('every supported locale has approved span copy', () {
    expect(
      AppLocalizations.supportedLocales
          .map((Locale l) => l.languageCode)
          .toSet(),
      approved.keys.toSet(),
      reason: 'a new locale needs its span wording approved here',
    );
  });

  for (final Locale locale in AppLocalizations.supportedLocales) {
    group('${locale.languageCode} span wording', () {
      final EntityFormatter fmt = EntityFormatter(
        locale.languageCode,
        lookupAppLocalizations(locale),
      );
      final List<String> expected = approved[locale.languageCode]!;

      test('null/null reads from the season start, never a full season', () {
        final String text = fmt.participationSpan();

        expect(text, expected[0]);
        expect(text.toLowerCase(), isNot(contains('full season')));
        expect(text.toLowerCase(), isNot(contains('temporada completa')));
      });

      test('an open start with an observed exit reads until that round', () {
        expect(fmt.participationSpan(endRound: 11), expected[1]);
      });

      test('an observed arrival with no exit reads from that round', () {
        expect(fmt.participationSpan(startRound: 12), expected[2]);
      });

      test('a closed span reads as its round range', () {
        expect(
          fmt.participationSpan(startRound: 12, endRound: 14),
          expected[3],
        );
      });
    });
  }
}
