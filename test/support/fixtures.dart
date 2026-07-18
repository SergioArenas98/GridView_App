import 'dart:convert';
import 'dart:io';

/// Shared API fixtures live with the edge API and are the single source of truth
/// for contract tests on both sides.
const fixturesRoot = 'services/edge-api/test/fixtures/api/v1';

Map<String, dynamic> loadFixture(String relativePath) =>
    jsonDecode(File('$fixturesRoot/$relativePath').readAsStringSync())
        as Map<String, dynamic>;

List<dynamic> loadFixtureList(String relativePath) =>
    jsonDecode(File('$fixturesRoot/$relativePath').readAsStringSync())
        as List<dynamic>;

/// A fixture manifest entry (see manifest.json).
class ManifestEntry {
  const ManifestEntry(this.raw);
  final Map<String, dynamic> raw;

  String get file => raw['file'] as String;
  String get type => raw['type'] as String;
  String? get data => raw['data'] as String?;
  String get dataKind => (raw['dataKind'] as String?) ?? 'single';
  String? get meta => raw['meta'] as String?;
  bool get expectValid => (raw['expectValid'] as bool?) ?? true;
}

List<ManifestEntry> loadManifest() =>
    (jsonDecode(File('$fixturesRoot/manifest.json').readAsStringSync()) as List)
        .map((e) => ManifestEntry(e as Map<String, dynamic>))
        .toList();
