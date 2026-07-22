// Drift column `.check()` constraints reference the column getter in their own
// definition (the documented drift DSL pattern); drift analyses the AST and
// never executes the getter, so the recursive-getter lint is a false positive.
// ignore_for_file: recursive_getters
import 'package:drift/drift.dart';

import 'competitor_tables.dart';
import 'tables.dart';

// Media descriptor tables (added in schema v2).
//
// `MediaAssets` describes an image (not the bytes). Size variants are normalised
// into `media_variants`. Ownership is modelled with one FK-backed association
// table per owner type — driver, constructor, circuit and grand_prix — because
// SQLite cannot express a single polymorphic foreign key across four parent
// tables. This gives real referential integrity for the four concrete owners
// while `placeholder` and `unknown` assets simply have no association row: they
// never fabricate a foreign-key relationship. `entityType`/`entityId` remain on
// the asset as the (possibly ownerless) descriptor values.

@DataClassName('MediaAssetRow')
class MediaAssets extends Table {
  TextColumn get id => text()();

  /// `MediaEntityType` wire token
  /// (`driver`/`constructor`/`circuit`/`grand_prix`/`placeholder`/`unknown`).
  TextColumn get entityType => text()();

  /// Descriptor value only; the FK-backed owner (when any) lives in the
  /// matching association table. Null/loose for `placeholder`/`unknown`.
  TextColumn get entityId => text().nullable()();

  /// `MediaCategory` wire token.
  TextColumn get category => text()();

  /// `MediaFormat` wire token.
  TextColumn get format => text()();
  RealColumn get aspectRatio =>
      real().nullable().check(aspectRatio.isBiggerThanValue(0.0))();

  /// Immutable version token, e.g. `v1`.
  TextColumn get version => text()();
  TextColumn get attribution => text().nullable()();
  TextColumn get license => text().nullable()();

  /// Placeholder category to use when the asset is missing.
  TextColumn get fallbackCategory => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}

/// A single size variant of a [MediaAssets] row. `variantName` is one of the
/// `MediaVariantName` slots (`thumbnail`, `card`, `detail`, `hero`).
@DataClassName('MediaVariantRow')
class MediaAssetVariants extends Table {
  @override
  String get tableName => 'media_variants';

  /// Cascades: removing a media asset removes its variants.
  TextColumn get mediaId =>
      text().references(MediaAssets, #id, onDelete: KeyAction.cascade)();
  TextColumn get variantName => text()();
  TextColumn get url => text()();
  IntColumn get width =>
      integer().nullable().check(width.isBiggerThanValue(0))();
  IntColumn get height =>
      integer().nullable().check(height.isBiggerThanValue(0))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{mediaId, variantName};
}

/// FK-backed media ownership for a driver. One owner per asset (`mediaId` is the
/// primary key), so an asset associates to at most one driver.
@DataClassName('DriverMediaRow')
@TableIndex(name: 'idx_driver_media_driver', columns: {#driverId})
class DriverMedia extends Table {
  TextColumn get mediaId =>
      text().references(MediaAssets, #id, onDelete: KeyAction.cascade)();
  TextColumn get driverId =>
      text().references(Drivers, #id, onDelete: KeyAction.cascade)();
  IntColumn get orderIndex =>
      integer().check(orderIndex.isBiggerOrEqualValue(0))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{mediaId};
}

/// FK-backed media ownership for a constructor.
@DataClassName('ConstructorMediaRow')
@TableIndex(
  name: 'idx_constructor_media_constructor',
  columns: {#constructorId},
)
class ConstructorMedia extends Table {
  TextColumn get mediaId =>
      text().references(MediaAssets, #id, onDelete: KeyAction.cascade)();
  TextColumn get constructorId =>
      text().references(Constructors, #id, onDelete: KeyAction.cascade)();
  IntColumn get orderIndex =>
      integer().check(orderIndex.isBiggerOrEqualValue(0))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{mediaId};
}

/// FK-backed media ownership for a circuit.
@DataClassName('CircuitMediaRow')
@TableIndex(name: 'idx_circuit_media_circuit', columns: {#circuitId})
class CircuitMedia extends Table {
  TextColumn get mediaId =>
      text().references(MediaAssets, #id, onDelete: KeyAction.cascade)();
  TextColumn get circuitId =>
      text().references(Circuits, #id, onDelete: KeyAction.cascade)();
  IntColumn get orderIndex =>
      integer().check(orderIndex.isBiggerOrEqualValue(0))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{mediaId};
}

/// FK-backed media ownership for a Grand Prix event.
@DataClassName('GrandPrixMediaRow')
@TableIndex(name: 'idx_grand_prix_media_gp', columns: {#grandPrixId})
class GrandPrixMedia extends Table {
  TextColumn get mediaId =>
      text().references(MediaAssets, #id, onDelete: KeyAction.cascade)();
  TextColumn get grandPrixId =>
      text().references(GrandPrixEvents, #id, onDelete: KeyAction.cascade)();
  IntColumn get orderIndex =>
      integer().check(orderIndex.isBiggerOrEqualValue(0))();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{mediaId};
}
