import '../application/external_links.dart';

/// Whether GridView retrieves data from a source yet.
///
/// The screen's wording depends on it: a `dormant` source is credited without
/// claiming that data from it is being served.
enum DataSourceStatus { dormant, active }

/// The attribution one licensor is owed (ADR 0019 decision 5;
/// GridView_Provider_Evaluation.md §7.6.2).
///
/// Read from the repository-owned record `content/attribution/data-sources.json`
/// rather than hard-coded, so a notice the licensor supplies later can be
/// carried, and a source removed on request, without changing code. Every
/// value is shown as published; none of it is localized.
class DataSourceAttribution {
  const DataSourceAttribution({
    required this.sourceId,
    required this.name,
    required this.sourceLink,
    required this.termsLink,
    required this.licenseName,
    required this.licenseTitle,
    required this.licenseLink,
    required this.status,
    required this.copyrightNotice,
    required this.warrantyDisclaimerNotice,
    required this.creatorDesignation,
  });

  final String sourceId;
  final String name;
  final ExternalLink sourceLink;
  final ExternalLink? termsLink;
  final String licenseName;
  final String licenseTitle;
  final ExternalLink licenseLink;
  final DataSourceStatus status;
  final String? copyrightNotice;
  final String? warrantyDisclaimerNotice;
  final String? creatorDesignation;
}

/// The whole attribution record: its version and every source, in order.
class DataSourceAttributions {
  const DataSourceAttributions({required this.version, required this.sources});

  /// Identifies the exact content of the record. See the record's schema.
  final String version;
  final List<DataSourceAttribution> sources;

  /// Parses the decoded record, refusing anything malformed.
  ///
  /// Strict on purpose: a legal notice that half-parses would be shown
  /// incomplete, so any missing field, unknown status or link the app would
  /// not open is a [FormatException] instead. `npm run validate:content`
  /// checks the same file against its JSON Schema in CI.
  factory DataSourceAttributions.fromJson(Object? json) {
    final Map<String, Object?> root = _object(json, 'record');
    if (root['kind'] != 'data-source-attribution') {
      throw const FormatException('not a data-source-attribution record');
    }
    final Object? sources = root['sources'];
    if (sources is! List<Object?>) {
      throw const FormatException('sources is not a list');
    }
    return DataSourceAttributions(
      version: _text(root, 'version'),
      sources: List<DataSourceAttribution>.unmodifiable(sources.map(_source)),
    );
  }

  static DataSourceAttribution _source(Object? json) {
    final Map<String, Object?> source = _object(json, 'source');
    return DataSourceAttribution(
      sourceId: _text(source, 'sourceId'),
      name: _text(source, 'name'),
      sourceLink: _link(source, 'sourceUrl'),
      termsLink: source['termsUrl'] == null ? null : _link(source, 'termsUrl'),
      licenseName: _text(source, 'licenseName'),
      licenseTitle: _text(source, 'licenseTitle'),
      licenseLink: _link(source, 'licenseUrl'),
      status: switch (source['status']) {
        'dormant' => DataSourceStatus.dormant,
        'active' => DataSourceStatus.active,
        final Object? other => throw FormatException('unknown status $other'),
      },
      copyrightNotice: _optionalText(source, 'copyrightNotice'),
      warrantyDisclaimerNotice: _optionalText(
        source,
        'warrantyDisclaimerNotice',
      ),
      creatorDesignation: _optionalText(source, 'creatorDesignation'),
    );
  }

  static Map<String, Object?> _object(Object? json, String what) {
    if (json is Map<String, Object?>) return json;
    throw FormatException('$what is not an object');
  }

  static String _text(Map<String, Object?> json, String key) {
    final Object? value = json[key];
    if (value is String && value.trim().isNotEmpty) return value;
    throw FormatException('$key is missing or blank');
  }

  static String? _optionalText(Map<String, Object?> json, String key) {
    if (!json.containsKey(key)) throw FormatException('$key is missing');
    return json[key] == null ? null : _text(json, key);
  }

  /// Only an `https` link the app would actually open is accepted.
  static ExternalLink _link(Map<String, Object?> json, String key) {
    final ExternalLink? link = ExternalLink.parse(_text(json, key));
    if (link == null || link.kind != ExternalLinkKind.https) {
      throw FormatException('$key is not an https link');
    }
    return link;
  }
}
