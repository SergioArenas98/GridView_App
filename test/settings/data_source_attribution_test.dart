import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/settings/application/data_source_attributions.dart';
import 'package:gridview/features/settings/application/external_links.dart';
import 'package:gridview/features/settings/domain/data_source_attribution.dart';
import 'package:gridview/features/settings/presentation/widgets/data_source_attribution_card.dart';

/// The shipped record, read from the repository exactly as it is bundled.
Map<String, Object?> _shipped() =>
    jsonDecode(File(dataSourceAttributionsAsset).readAsStringSync())
        as Map<String, Object?>;

Map<String, Object?> _withSource(Map<String, Object?> changes) {
  final Map<String, Object?> record = _shipped();
  final List<Object?> sources = record['sources']! as List<Object?>;
  return <String, Object?>{
    ...record,
    'sources': <Object?>[
      <String, Object?>{...sources.first! as Map<String, Object?>, ...changes},
    ],
  };
}

void main() {
  group('the shipped attribution record', () {
    test('is bundled from the path the app reads', () {
      final String pubspec = File('pubspec.yaml').readAsStringSync();
      expect(pubspec, contains('- $dataSourceAttributionsAsset'));
    });

    test('credits Jolpica F1 alone, dormant, under CC BY-NC-SA 4.0', () {
      final DataSourceAttributions record = DataSourceAttributions.fromJson(
        _shipped(),
      );

      expect(record.version, 'data-sources-v1');
      expect(record.sources, hasLength(1));
      final DataSourceAttribution jolpica = record.sources.single;
      expect(jolpica.sourceId, 'jolpica');
      expect(jolpica.name, 'Jolpica F1');
      expect(
        jolpica.sourceLink.uri,
        Uri.parse('https://github.com/jolpica/jolpica-f1'),
      );
      expect(
        jolpica.termsLink?.uri,
        Uri.parse('https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md'),
      );
      expect(jolpica.licenseName, 'CC BY-NC-SA 4.0');
      expect(
        jolpica.licenseTitle,
        'Creative Commons Attribution-NonCommercial-ShareAlike 4.0 '
        'International',
      );
      expect(
        jolpica.licenseLink.uri,
        Uri.parse('https://creativecommons.org/licenses/by-nc-sa/4.0/'),
      );
      // Dormant until an explicit activation decision (O-9) says otherwise.
      expect(jolpica.status, DataSourceStatus.dormant);
      expect(jolpica.copyrightNotice, isNull);
      expect(jolpica.creatorDesignation, isNull);
      expect(jolpica.warrantyDisclaimerNotice, isNotNull);
    });
  });

  group('parsing refuses a record it could only show incompletely', () {
    test('an unknown kind', () {
      expect(
        () => DataSourceAttributions.fromJson(<String, Object?>{
          ..._shipped(),
          'kind': 'media-rights',
        }),
        throwsFormatException,
      );
    });

    test('a link the app would not open', () {
      for (final String url in <String>[
        'http://github.com/jolpica/jolpica-f1',
        'mailto:someone@example.org',
        'https://user@example.org/',
        'not a url',
      ]) {
        expect(
          () => DataSourceAttributions.fromJson(
            _withSource(<String, Object?>{'licenseUrl': url}),
          ),
          throwsFormatException,
          reason: url,
        );
      }
    });

    test('an unknown status', () {
      expect(
        () => DataSourceAttributions.fromJson(
          _withSource(<String, Object?>{'status': 'live'}),
        ),
        throwsFormatException,
      );
    });

    test('a missing or blank required value', () {
      expect(
        () => DataSourceAttributions.fromJson(
          _withSource(<String, Object?>{'name': '  '}),
        ),
        throwsFormatException,
      );
      final Map<String, Object?> record = _shipped();
      final Map<String, Object?> source = Map<String, Object?>.of(
        (record['sources']! as List<Object?>).first! as Map<String, Object?>,
      )..remove('copyrightNotice');
      expect(
        () => DataSourceAttributions.fromJson(<String, Object?>{
          ...record,
          'sources': <Object?>[source],
        }),
        throwsFormatException,
      );
    });
  });

  test('a link is displayed as host and path, without scheme or slash', () {
    expect(
      DataSourceAttributionCard.displayLink(
        ExternalLink.parse(
          'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        )!,
      ),
      'creativecommons.org/licenses/by-nc-sa/4.0',
    );
  });
}
