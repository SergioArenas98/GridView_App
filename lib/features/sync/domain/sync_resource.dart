import '../../shared/domain/entities/resource_key.dart';

/// The dependency stage a resource belongs to. Stages run strictly in order;
/// resources inside one stage are independent and may run concurrently.
enum SyncStage {
  /// The first-launch aggregate, planned only when first-use policy calls for
  /// it.
  bootstrap,

  /// Season context. A changed current season must be resolved before any
  /// season-scoped command is built.
  seasonContext,

  /// What the first screen needs.
  firstScreen,

  /// Championship state.
  championship,

  /// Explore collections and the content manifest.
  exploreAndContent,
}

/// A canonical resource key, parsed into a typed value.
///
/// This is the single dispatch vocabulary shared by the planner, the
/// coordinator and the repository dispatcher: nothing else splits resource-key
/// strings. Parsing is total — an unknown or malformed key becomes an
/// [UnsupportedSyncResource] rather than an exception, so a metadata row written
/// by a newer app version can never crash synchronization (and is never
/// deleted).
sealed class SyncResource {
  const SyncResource();

  /// The canonical key, rebuilt from [ResourceKey] rather than echoed back.
  String get key;

  /// The season this resource is scoped to, or null when it is season-agnostic.
  int? get season => null;

  /// Whether automatic startup/foreground runs may refresh this resource.
  ///
  /// Core current-season resources are automatic; details and historical
  /// resources stay **on demand** — their feature or detail controller refreshes
  /// them when opened, or the user asks explicitly. Their metadata remains
  /// stored and queryable either way.
  bool get isAutomaticCore => false;

  /// The stage an automatic run schedules this resource in.
  SyncStage get stage => SyncStage.exploreAndContent;
}

class BootstrapSyncResource extends SyncResource {
  const BootstrapSyncResource();

  @override
  String get key => ResourceKey.bootstrap();

  @override
  SyncStage get stage => SyncStage.bootstrap;
}

class CurrentSeasonSyncResource extends SyncResource {
  const CurrentSeasonSyncResource();

  @override
  String get key => ResourceKey.currentSeason();

  @override
  bool get isAutomaticCore => true;

  @override
  SyncStage get stage => SyncStage.seasonContext;
}

class SeasonMetadataSyncResource extends SyncResource {
  const SeasonMetadataSyncResource(this.year);

  final int year;

  @override
  String get key => ResourceKey.season(year);

  @override
  int? get season => year;

  @override
  bool get isAutomaticCore => true;

  @override
  SyncStage get stage => SyncStage.seasonContext;
}

/// The Home view. `GET /v1/home` takes an optional season; the application only
/// ever asks for the current one, so this resource is season-agnostic and stays
/// plannable even when no season context could be resolved.
class HomeSyncResource extends SyncResource {
  const HomeSyncResource();

  @override
  String get key => ResourceKey.home();

  @override
  bool get isAutomaticCore => true;

  @override
  SyncStage get stage => SyncStage.firstScreen;
}

class CalendarSyncResource extends SyncResource {
  const CalendarSyncResource(this.year);

  final int year;

  @override
  String get key => ResourceKey.calendar(year);

  @override
  int? get season => year;

  @override
  bool get isAutomaticCore => true;

  @override
  SyncStage get stage => SyncStage.firstScreen;
}

class DriverStandingsSyncResource extends SyncResource {
  const DriverStandingsSyncResource(this.year);

  final int year;

  @override
  String get key => ResourceKey.driverStandings(year);

  @override
  int? get season => year;

  @override
  bool get isAutomaticCore => true;

  @override
  SyncStage get stage => SyncStage.championship;
}

class ConstructorStandingsSyncResource extends SyncResource {
  const ConstructorStandingsSyncResource(this.year);

  final int year;

  @override
  String get key => ResourceKey.constructorStandings(year);

  @override
  int? get season => year;

  @override
  bool get isAutomaticCore => true;

  @override
  SyncStage get stage => SyncStage.championship;
}

class SeasonDriversSyncResource extends SyncResource {
  const SeasonDriversSyncResource(this.year);

  final int year;

  @override
  String get key => ResourceKey.drivers(year);

  @override
  int? get season => year;

  @override
  bool get isAutomaticCore => true;
}

class SeasonConstructorsSyncResource extends SyncResource {
  const SeasonConstructorsSyncResource(this.year);

  final int year;

  @override
  String get key => ResourceKey.constructors(year);

  @override
  int? get season => year;

  @override
  bool get isAutomaticCore => true;
}

class SeasonCircuitsSyncResource extends SyncResource {
  const SeasonCircuitsSyncResource(this.year);

  final int year;

  @override
  String get key => ResourceKey.circuits(year);

  @override
  int? get season => year;

  @override
  bool get isAutomaticCore => true;
}

/// The content/media manifest — metadata only, and season-agnostic.
class ContentManifestSyncResource extends SyncResource {
  const ContentManifestSyncResource();

  @override
  String get key => ResourceKey.contentManifest();

  @override
  bool get isAutomaticCore => true;
}

// --- On-demand resources ---------------------------------------------------
// Never swept by an automatic run. Owned by the feature/detail controller that
// opened them, or by an explicit user action.

class GrandPrixSyncResource extends SyncResource {
  const GrandPrixSyncResource(this.year, this.round);

  final int year;
  final int round;

  @override
  String get key => ResourceKey.grandPrix(year, round);

  @override
  int? get season => year;
}

class GrandPrixResultsSyncResource extends SyncResource {
  const GrandPrixResultsSyncResource(this.year, this.round);

  final int year;
  final int round;

  @override
  String get key => ResourceKey.grandPrixResults(year, round);

  @override
  int? get season => year;
}

class DriverDetailSyncResource extends SyncResource {
  const DriverDetailSyncResource(this.driverId, this.year);

  final String driverId;
  final int year;

  @override
  String get key => ResourceKey.driver(driverId, year);

  @override
  int? get season => year;
}

class ConstructorDetailSyncResource extends SyncResource {
  const ConstructorDetailSyncResource(this.constructorId, this.year);

  final String constructorId;
  final int year;

  @override
  String get key => ResourceKey.constructor(constructorId, year);

  @override
  int? get season => year;
}

class CircuitDetailSyncResource extends SyncResource {
  const CircuitDetailSyncResource(this.circuitId, this.year);

  final String circuitId;
  final int year;

  @override
  String get key => ResourceKey.circuit(circuitId, year);

  @override
  int? get season => year;
}

/// A stored key this app version cannot dispatch: an unknown prefix, a malformed
/// scope or an additive future key type.
///
/// It is never refreshed and never crashes a run; its metadata row is left
/// untouched so a newer build can still use it.
class UnsupportedSyncResource extends SyncResource {
  const UnsupportedSyncResource(this.storedKey);

  final String storedKey;

  @override
  String get key => storedKey;
}
