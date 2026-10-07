import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart' show FlutterError;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/settings/application/data_source_attributions.dart';
import 'package:gridview/features/settings/domain/data_source_attribution.dart';
import 'package:gridview/features/shared/application/fixture_data_identity_provider.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/domain/fixture_data_identity.dart';

/// A descriptor exactly as the converter writes one.
Map<String, Object?> descriptor({
  String origin = 'provider-capture',
  List<Object?> sources = const <Object?>['jolpica'],
}) => <String, Object?>{
  'kind': 'gridview-frozen-dataset',
  'schemaVersion': 1,
  'origin': origin,
  'season': 2026,
  'capturedAt': '2026-10-08T12:00:00.000Z',
  'sources': sources,
  'batch': <String, Object?>{
    'manifestSha256': 'ab' * 32,
    'artifactSha256': 'cd' * 32,
    'captureDigest': 'ef' * 32,
    'generatorCommit': 'a' * 40,
    'version': '20261008120000000-batch',
    'documentCount': 3,
  },
  'files': <Object?>[
    <String, Object?>{
      'name': 'bootstrap.json',
      'byteLength': 10,
      'sha256': '01' * 32,
    },
    <String, Object?>{
      'name': 'home.json',
      'byteLength': 20,
      'sha256': '02' * 32,
    },
  ],
};

/// An asset bundle holding exactly [assets], with a matching asset manifest.
class MapAssetBundle extends CachingAssetBundle {
  MapAssetBundle(this.assets);

  final Map<String, String> assets;
  int reads = 0;

  @override
  Future<ByteData> load(String key) async {
    reads += 1;
    if (key == 'AssetManifest.bin') {
      return const StandardMessageCodec().encodeMessage(<String, Object>{
        for (final String path in assets.keys)
          path: <Object>[
            <String, Object>{'asset': path},
          ],
      })!;
    }
    final String? value = assets[key];
    if (value == null) throw FlutterError('Unable to load asset: $key');
    return ByteData.sublistView(Uint8List.fromList(utf8.encode(value)));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('the frozen dataset descriptor', () {
    test('a provider capture is frozen data credited to Jolpica', () {
      final FrozenDatasetDescriptor decoded = FrozenDatasetDescriptor.fromJson(
        descriptor(),
      );
      final FrozenCaptureData identity = decoded.identity as FrozenCaptureData;
      expect(identity.capturedAt, DateTime.utc(2026, 10, 8, 12));
      expect(identity.season, 2026);
      expect(identity.sourceIds, <String>{'jolpica'});
      expect(identity.manifestSha256, 'ab' * 32);
      expect(decoded.files.map((FrozenFixtureFile f) => f.name), <String>[
        'bootstrap.json',
        'home.json',
      ]);
      expect(captureDateLabel(identity.capturedAt), '2026-10-08');
    });

    test('a synthetic batch is sample data, never captured data', () {
      expect(
        FrozenDatasetDescriptor.fromJson(
          descriptor(origin: 'synthetic', sources: const <Object?>[]),
        ).identity,
        isA<SampleFixtureData>(),
      );
    });

    final Map<String, Map<String, Object?>>
    malformed = <String, Map<String, Object?>>{
      'an unknown field': <String, Object?>{...descriptor(), 'extra': 1},
      'another kind': <String, Object?>{...descriptor(), 'kind': 'x'},
      'a provider capture crediting nothing': descriptor(
        sources: const <Object?>[],
      ),
      'a synthetic batch crediting Jolpica': descriptor(origin: 'synthetic'),
      'an undeclared origin': descriptor(origin: 'captured'),
      'a local capture time': <String, Object?>{
        ...descriptor(),
        'capturedAt': '2026-10-08T12:00:00.000',
      },
      'no files': <String, Object?>{
        ...descriptor(),
        'files': const <Object?>[],
      },
      'a path in a file name': <String, Object?>{
        ...descriptor(),
        'files': <Object?>[
          <String, Object?>{
            'name': '../home.json',
            'byteLength': 1,
            'sha256': '01' * 32,
          },
        ],
      },
      'unsorted files': <String, Object?>{
        ...descriptor(),
        'files': (descriptor()['files']! as List<Object?>).reversed.toList(),
      },
    };
    for (final MapEntry<String, Map<String, Object?>> entry
        in malformed.entries) {
      test('refuses ${entry.key}', () {
        expect(
          () => FrozenDatasetDescriptor.fromJson(entry.value),
          throwsFormatException,
        );
      });
    }

    test('only credits sources the bundled attribution record names', () {
      final DataSourceAttributions record = DataSourceAttributions.fromJson(
        jsonDecode(File(dataSourceAttributionsAsset).readAsStringSync()),
      );
      final FrozenCaptureData identity =
          FrozenDatasetDescriptor.fromJson(descriptor()).identity
              as FrozenCaptureData;
      expect(
        record.sources.map((DataSourceAttribution s) => s.sourceId),
        containsAll(identity.sourceIds),
      );
    });
  });

  group('identifying the bundled fixtures', () {
    test('no descriptor means sample data', () async {
      expect(
        await loadFixtureDataIdentity(
          MapAssetBundle(<String, String>{
            'assets/dev_fixtures/home.json': '{}',
          }),
        ),
        isA<SampleFixtureData>(),
      );
    });

    test('a valid descriptor identifies frozen captured data', () async {
      expect(
        await loadFixtureDataIdentity(
          MapAssetBundle(<String, String>{
            frozenDatasetAsset: jsonEncode(descriptor()),
          }),
        ),
        isA<FrozenCaptureData>(),
      );
    });

    test('a bundled descriptor that cannot be decoded is unverified', () async {
      expect(
        await loadFixtureDataIdentity(
          MapAssetBundle(<String, String>{frozenDatasetAsset: '{"kind": 1}'}),
        ),
        isA<UnverifiedFixtureData>(),
      );
      expect(
        await loadFixtureDataIdentity(
          MapAssetBundle(<String, String>{frozenDatasetAsset: 'not json'}),
        ),
        isA<UnverifiedFixtureData>(),
      );
    });

    test('the committed bundle is sample data', () async {
      // The repository never commits a descriptor; a normal fixture build is
      // labelled as sample data.
      expect(
        await loadFixtureDataIdentity(rootBundle),
        isA<SampleFixtureData>(),
      );
    });
  });

  group('build-mode separation', () {
    test('a build that does not serve fixtures reads nothing', () async {
      final MapAssetBundle bundle = MapAssetBundle(<String, String>{
        frozenDatasetAsset: jsonEncode(descriptor()),
      });
      final ProviderContainer container = ProviderContainer(
        overrides: [
          usesMockDataProvider.overrideWithValue(false),
          fixtureAssetBundleProvider.overrideWithValue(bundle),
        ],
      );
      addTearDown(container.dispose);

      expect(await container.read(fixtureDataIdentityProvider.future), isNull);
      expect(bundle.reads, 0);
    });

    test('a fixture build identifies its bundle', () async {
      final ProviderContainer container = ProviderContainer(
        overrides: [
          usesMockDataProvider.overrideWithValue(true),
          fixtureAssetBundleProvider.overrideWithValue(
            MapAssetBundle(<String, String>{
              frozenDatasetAsset: jsonEncode(descriptor()),
            }),
          ),
        ],
      );
      addTearDown(container.dispose);

      expect(
        await container.read(fixtureDataIdentityProvider.future),
        isA<FrozenCaptureData>(),
      );
    });
  });
}
