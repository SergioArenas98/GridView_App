/// What the bundled fixtures of a `DATA_SOURCE=fixture` build are.
///
/// Every fixture build bundles sample data unless a test-only frozen-data
/// build replaced it. That build ships one descriptor,
/// `assets/dev_fixtures/frozen-dataset.json`, written by the offline converter
/// (`services/edge-api/scripts/season-batch/fixtures.ts`). The descriptor, not
/// a build flag, decides how the data is labelled and credited, so the label
/// always follows the data that is actually bundled.
sealed class FixtureDataIdentity {
  const FixtureDataIdentity();
}

/// The committed sample fixtures, or a synthetic converted batch: never
/// presented as captured data.
final class SampleFixtureData extends FixtureDataIdentity {
  const SampleFixtureData();
}

/// A frozen snapshot converted from a separately authorized provider capture.
/// It is fixed at [capturedAt] and receives no updates.
final class FrozenCaptureData extends FixtureDataIdentity {
  const FrozenCaptureData({
    required this.capturedAt,
    required this.season,
    required this.sourceIds,
    required this.manifestSha256,
  });

  /// The instant the capture was complete, UTC.
  final DateTime capturedAt;
  final int season;

  /// The attribution-record sources this snapshot's data comes from.
  final Set<String> sourceIds;

  /// The SHA-256 of the reviewed season-batch manifest.
  final String manifestSha256;
}

/// A descriptor is bundled but cannot be read: the data's origin is unknown,
/// so it is presented as neither sample nor captured data.
final class UnverifiedFixtureData extends FixtureDataIdentity {
  const UnverifiedFixtureData();
}

/// The capture date as shown to the reader: the UTC calendar date, ISO 8601.
String captureDateLabel(DateTime capturedAt) {
  final DateTime utc = capturedAt.toUtc();
  String two(int value) => value.toString().padLeft(2, '0');
  return '${utc.year}-${two(utc.month)}-${two(utc.day)}';
}

final RegExp _instant = RegExp(
  r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$',
);
final RegExp _sha256 = RegExp(r'^[0-9a-f]{64}$');
final RegExp _fixtureName = RegExp(r'^[a-z0-9]+(?:-[a-z0-9]+)*\.json$');

const List<String> _descriptorKeys = <String>[
  'kind',
  'schemaVersion',
  'origin',
  'season',
  'capturedAt',
  'sources',
  'batch',
  'files',
];

const List<String> _batchKeys = <String>[
  'manifestSha256',
  'artifactSha256',
  'captureDigest',
  'generatorCommit',
  'version',
  'documentCount',
];

/// One fixture file the descriptor lists.
class FrozenFixtureFile {
  const FrozenFixtureFile({
    required this.name,
    required this.byteLength,
    required this.sha256,
  });

  final String name;
  final int byteLength;
  final String sha256;
}

/// The decoded descriptor.
class FrozenDatasetDescriptor {
  const FrozenDatasetDescriptor({required this.identity, required this.files});

  final FixtureDataIdentity identity;
  final List<FrozenFixtureFile> files;

  /// Decodes the converter's descriptor exactly, refusing anything else with a
  /// [FormatException]. The origin and the credited sources must agree: a
  /// provider capture credits Jolpica, a synthetic batch credits nothing.
  factory FrozenDatasetDescriptor.fromJson(Object? json) {
    final Map<String, Object?> root = _exact(json, _descriptorKeys, 'root');
    if (root['kind'] != 'gridview-frozen-dataset' ||
        root['schemaVersion'] != 1) {
      throw const FormatException('not a frozen dataset descriptor');
    }
    final Object? season = root['season'];
    final Object? capturedAt = root['capturedAt'];
    if (season is! int ||
        capturedAt is! String ||
        !_instant.hasMatch(capturedAt)) {
      throw const FormatException('season or capturedAt is malformed');
    }
    final DateTime? instant = DateTime.tryParse(capturedAt);
    if (instant == null || !instant.isUtc) {
      throw const FormatException('capturedAt is not a UTC instant');
    }
    final Map<String, Object?> batch = _exact(
      root['batch'],
      _batchKeys,
      'batch',
    );
    final Object? manifestSha256 = batch['manifestSha256'];
    if (manifestSha256 is! String || !_sha256.hasMatch(manifestSha256)) {
      throw const FormatException('manifestSha256 is malformed');
    }
    final Object? sources = root['sources'];
    if (sources is! List<Object?>) {
      throw const FormatException('sources is not a list');
    }
    final FixtureDataIdentity identity = switch (root['origin']) {
      'provider-capture'
          when sources.length == 1 && sources.single == 'jolpica' =>
        FrozenCaptureData(
          capturedAt: instant,
          season: season,
          sourceIds: const <String>{'jolpica'},
          manifestSha256: manifestSha256,
        ),
      'synthetic' when sources.isEmpty => const SampleFixtureData(),
      _ => throw const FormatException('origin and sources disagree'),
    };
    return FrozenDatasetDescriptor(
      identity: identity,
      files: List<FrozenFixtureFile>.unmodifiable(_files(root['files'])),
    );
  }

  static List<FrozenFixtureFile> _files(Object? json) {
    if (json is! List<Object?> || json.isEmpty) {
      throw const FormatException('files is empty or not a list');
    }
    final List<FrozenFixtureFile> files = <FrozenFixtureFile>[];
    for (final Object? entry in json) {
      final Map<String, Object?> file = _exact(entry, const <String>[
        'name',
        'byteLength',
        'sha256',
      ], 'file');
      final Object? name = file['name'];
      final Object? byteLength = file['byteLength'];
      final Object? sha256 = file['sha256'];
      if (name is! String ||
          !_fixtureName.hasMatch(name) ||
          name == 'frozen-dataset.json' ||
          (files.isNotEmpty && name.compareTo(files.last.name) <= 0) ||
          byteLength is! int ||
          byteLength < 0 ||
          sha256 is! String ||
          !_sha256.hasMatch(sha256)) {
        throw const FormatException('a file entry is malformed');
      }
      files.add(
        FrozenFixtureFile(name: name, byteLength: byteLength, sha256: sha256),
      );
    }
    return files;
  }

  static Map<String, Object?> _exact(
    Object? json,
    List<String> keys,
    String what,
  ) {
    if (json is! Map<String, Object?> ||
        json.length != keys.length ||
        !keys.every(json.containsKey)) {
      throw FormatException('$what does not have exactly the expected keys');
    }
    return json;
  }
}
