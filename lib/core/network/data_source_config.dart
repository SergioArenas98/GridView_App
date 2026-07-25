/// The remote data-source mode for a build, selected deliberately at build time
/// with `--dart-define=DATA_SOURCE=remote|fixture`.
///
/// Fixture mode is **never** inferred from a missing `API_BASE_URL`: it requires
/// the explicit `fixture` value, and it is honoured only in non-production
/// builds. Any missing or malformed value resolves to [remote] so a
/// misconfiguration can never silently enable bundled fixtures.
enum DataSourceMode {
  /// Talk to the real GridView API over HTTPS (requires a valid `API_BASE_URL`).
  remote,

  /// Serve the bundled dev/staging fixtures. Deliberate, non-production only.
  fixture,
}

/// Resolves the [DataSourceMode] from the build-time `DATA_SOURCE` define.
class DataSourceConfig {
  const DataSourceConfig(this.mode);

  final DataSourceMode mode;

  static const String _define = String.fromEnvironment('DATA_SOURCE');

  /// The raw, unparsed `DATA_SOURCE` value (for diagnostics only).
  static String get rawDefine => _define;

  /// Parses [raw] into a mode. Only the exact token `fixture` (case- and
  /// whitespace-insensitive) selects fixtures; `remote` selects remote; an empty
  /// (unspecified) or malformed value resolves to [DataSourceMode.remote] so a
  /// misconfiguration never silently enables fixtures.
  static DataSourceMode parse(String raw) {
    switch (raw.trim().toLowerCase()) {
      case 'fixture':
        return DataSourceMode.fixture;
      case 'remote':
        return DataSourceMode.remote;
      default:
        // Missing or malformed → remote. Never fixtures.
        return DataSourceMode.remote;
    }
  }

  /// Whether [raw] is a non-empty value that is not a recognised mode.
  static bool isMalformed(String raw) {
    final String v = raw.trim().toLowerCase();
    return v.isNotEmpty && v != 'remote' && v != 'fixture';
  }

  /// Resolves the mode from the current build's `DATA_SOURCE` define.
  factory DataSourceConfig.fromEnvironment() =>
      DataSourceConfig(parse(_define));
}
