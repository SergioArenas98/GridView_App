import 'sync_resource.dart';

/// Turns a stored canonical resource key back into a typed [SyncResource].
///
/// This is the **only** place a resource key is taken apart. Repositories,
/// the planner and the coordinator all work with the typed values, so no string
/// splitting is repeated anywhere else and `resource_sync_metadata` rows written
/// by any build can be read back safely.
///
/// Parsing is total and non-throwing:
///
/// - an unknown prefix, a wrong segment count, a non-numeric season or round, an
///   out-of-range season or round, or a malformed stable id all resolve to
///   [UnsupportedSyncResource];
/// - an unsupported key is never refreshed, never crashes a run and — crucially
///   — never causes its metadata row to be deleted, so an additive key type
///   introduced by a newer app version survives a downgrade.
abstract final class SyncResourceParser {
  /// Season bounds mirror the local database's scalar rule (1950..2100).
  static const int _minSeason = 1950;
  static const int _maxSeason = 2100;

  /// Round bounds mirror the local database's scalar rule (1..30).
  static const int _minRound = 1;
  static const int _maxRound = 30;

  static final RegExp _stableId = RegExp(r'^[a-z0-9]+(-[a-z0-9]+)*$');

  static SyncResource parse(String key) {
    final List<String> parts = key.split(':');
    if (parts.isEmpty || parts.any((String p) => p.isEmpty)) {
      return UnsupportedSyncResource(key);
    }

    switch (parts.first) {
      case 'bootstrap':
        return parts.length == 1
            ? const BootstrapSyncResource()
            : UnsupportedSyncResource(key);

      case 'season':
        if (parts.length != 2) return UnsupportedSyncResource(key);
        if (parts[1] == 'current') return const CurrentSeasonSyncResource();
        final int? year = _season(parts[1]);
        return year == null
            ? UnsupportedSyncResource(key)
            : SeasonMetadataSyncResource(year);

      case 'home':
        // Only the current-season Home is a known application resource; an
        // explicitly season-scoped Home key is not one this build dispatches.
        return parts.length == 2 && parts[1] == 'current'
            ? const HomeSyncResource()
            : UnsupportedSyncResource(key);

      case 'calendar':
        return _seasonScoped(key, parts, CalendarSyncResource.new);

      case 'drivers':
        return _seasonScoped(key, parts, SeasonDriversSyncResource.new);

      case 'constructors':
        return _seasonScoped(key, parts, SeasonConstructorsSyncResource.new);

      case 'circuits':
        return _seasonScoped(key, parts, SeasonCircuitsSyncResource.new);

      case 'standings':
        if (parts.length != 3) return UnsupportedSyncResource(key);
        final int? year = _season(parts[2]);
        if (year == null) return UnsupportedSyncResource(key);
        return switch (parts[1]) {
          'drivers' => DriverStandingsSyncResource(year),
          'constructors' => ConstructorStandingsSyncResource(year),
          _ => UnsupportedSyncResource(key),
        };

      case 'content':
        return parts.length == 2 && parts[1] == 'manifest'
            ? const ContentManifestSyncResource()
            : UnsupportedSyncResource(key);

      case 'grand-prix':
        return _round(key, parts, GrandPrixSyncResource.new);

      case 'grand-prix-results':
        return _round(key, parts, GrandPrixResultsSyncResource.new);

      case 'driver':
        return _entityScoped(key, parts, DriverDetailSyncResource.new);

      case 'constructor':
        return _entityScoped(key, parts, ConstructorDetailSyncResource.new);

      case 'circuit':
        return _entityScoped(key, parts, CircuitDetailSyncResource.new);

      default:
        return UnsupportedSyncResource(key);
    }
  }

  static SyncResource _seasonScoped(
    String key,
    List<String> parts,
    SyncResource Function(int year) build,
  ) {
    if (parts.length != 2) return UnsupportedSyncResource(key);
    final int? year = _season(parts[1]);
    return year == null ? UnsupportedSyncResource(key) : build(year);
  }

  static SyncResource _round(
    String key,
    List<String> parts,
    SyncResource Function(int year, int round) build,
  ) {
    if (parts.length != 3) return UnsupportedSyncResource(key);
    final int? year = _season(parts[1]);
    final int? round = _roundValue(parts[2]);
    return year == null || round == null
        ? UnsupportedSyncResource(key)
        : build(year, round);
  }

  static SyncResource _entityScoped(
    String key,
    List<String> parts,
    SyncResource Function(String id, int year) build,
  ) {
    if (parts.length != 3) return UnsupportedSyncResource(key);
    final String id = parts[1];
    final int? year = _season(parts[2]);
    if (year == null || id.length > 96 || !_stableId.hasMatch(id)) {
      return UnsupportedSyncResource(key);
    }
    return build(id, year);
  }

  static int? _season(String raw) {
    final int? value = int.tryParse(raw);
    if (value == null || value < _minSeason || value > _maxSeason) return null;
    return value;
  }

  static int? _roundValue(String raw) {
    final int? value = int.tryParse(raw);
    if (value == null || value < _minRound || value > _maxRound) return null;
    return value;
  }
}
