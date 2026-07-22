import 'package:drift/drift.dart';

import '../../../features/shared/domain/entities/enums.dart';
import '../../../features/shared/domain/entities/media.dart';
import '../entity_validation.dart';
import '../gridview_database.dart';
import '../media_tables.dart';

part 'media_dao.g.dart';

/// Thrown when media ownership is inconsistent: the owner type is not one of the
/// four real entity types, or an asset's `entityType` does not match the owner
/// table it is being written under. The write is rejected and no rows change.
class InvalidMediaOwnershipException implements Exception {
  const InvalidMediaOwnershipException(this.message);

  final String message;

  @override
  String toString() => 'InvalidMediaOwnershipException: $message';
}

/// Local data source for media assets and their FK-backed ownership.
///
/// A [MediaAsset] is persisted as one `media_assets` row, one `media_variants`
/// row per present size variant, and — for the four real owner types only — one
/// row in the matching ownership association table. `placeholder` and `unknown`
/// assets never receive an association row, so no foreign-key relationship is
/// ever fabricated for them.
///
/// Nothing Drift-shaped escapes: writes accept domain [MediaAsset]s and reads
/// return domain [MediaAsset]s.
@DriftAccessor(
  tables: <Type>[
    MediaAssets,
    MediaAssetVariants,
    DriverMedia,
    ConstructorMedia,
    CircuitMedia,
    GrandPrixMedia,
  ],
)
class MediaDao extends DatabaseAccessor<GridViewDatabase> with _$MediaDaoMixin {
  MediaDao(super.db);

  /// The ordered `MediaVariants` slot names persisted in `media_variants`.
  static const String _thumbnail = 'thumbnail';
  static const String _card = 'card';
  static const String _detail = 'detail';
  static const String _hero = 'hero';

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  /// Replaces all media owned by [ownerId] of [ownerType] with [assets], in one
  /// transaction. Existing assets for the owner (and their variants and
  /// association rows, via cascade) are removed first, so obsolete media never
  /// lingers and no duplicates are produced.
  ///
  /// Single-owner integrity is enforced: [ownerType] must be one of the four
  /// real entity types (`driver`/`constructor`/`circuit`/`grand_prix`), each
  /// asset's `entityType` must equal [ownerType], and any prior association of
  /// an incoming asset under a different owner is cleared first (a clean
  /// ownership move). A mediaId therefore lives in exactly one owner table. A
  /// violating write throws [InvalidMediaOwnershipException] and rolls back.
  Future<void> replaceOwnerMedia(
    MediaEntityType ownerType,
    String ownerId,
    List<MediaAsset> assets,
  ) async {
    if (!_isRealOwner(ownerType)) {
      throw InvalidMediaOwnershipException(
        'A real owner type is required (driver/constructor/circuit/grand_prix), '
        'got "${ownerType.wire}".',
      );
    }
    validateSlug(ownerId, field: 'media owner id');
    for (final MediaAsset a in assets) {
      validateSlug(a.id, field: 'media id');
      if (a.entityType != ownerType) {
        throw InvalidMediaOwnershipException(
          'Media "${a.id}" has entityType "${a.entityType.wire}" but is being '
          'written under owner type "${ownerType.wire}".',
        );
      }
    }
    await transaction(() async {
      final List<String> existing = await _ownedMediaIds(ownerType, ownerId);
      if (existing.isNotEmpty) {
        await (delete(
          mediaAssets,
        )..where((MediaAssets m) => m.id.isIn(existing))).go();
      }
      for (int i = 0; i < assets.length; i++) {
        // Clear any prior association of this asset (under any owner) so it ends
        // up owned by exactly one owner.
        await _clearAllAssociations(assets[i].id);
        await _insertAsset(assets[i], ownerType, ownerId, i);
      }
    });
  }

  bool _isRealOwner(MediaEntityType t) =>
      t == MediaEntityType.driver ||
      t == MediaEntityType.constructor ||
      t == MediaEntityType.circuit ||
      t == MediaEntityType.grandPrix;

  Future<void> _clearAllAssociations(String mediaId) async {
    await (delete(
      driverMedia,
    )..where((DriverMedia t) => t.mediaId.equals(mediaId))).go();
    await (delete(
      constructorMedia,
    )..where((ConstructorMedia t) => t.mediaId.equals(mediaId))).go();
    await (delete(
      circuitMedia,
    )..where((CircuitMedia t) => t.mediaId.equals(mediaId))).go();
    await (delete(
      grandPrixMedia,
    )..where((GrandPrixMedia t) => t.mediaId.equals(mediaId))).go();
  }

  Future<void> _insertAsset(
    MediaAsset asset,
    MediaEntityType ownerType,
    String ownerId,
    int order,
  ) async {
    await into(mediaAssets).insertOnConflictUpdate(_assetCompanion(asset));

    await (delete(
      mediaAssetVariants,
    )..where((MediaAssetVariants v) => v.mediaId.equals(asset.id))).go();
    for (final MapEntry<String, MediaVariant> entry in _variantEntries(
      asset.variants,
    )) {
      await into(mediaAssetVariants).insert(
        MediaAssetVariantsCompanion.insert(
          mediaId: asset.id,
          variantName: entry.key,
          url: entry.value.url,
          width: Value<int?>(entry.value.width),
          height: Value<int?>(entry.value.height),
        ),
      );
    }

    await _insertAssociation(ownerType, asset.id, ownerId, order);
  }

  Future<void> _insertAssociation(
    MediaEntityType ownerType,
    String mediaId,
    String ownerId,
    int order,
  ) async {
    switch (ownerType) {
      case MediaEntityType.driver:
        await into(driverMedia).insert(
          DriverMediaCompanion.insert(
            mediaId: mediaId,
            driverId: ownerId,
            orderIndex: order,
          ),
        );
      case MediaEntityType.constructor:
        await into(constructorMedia).insert(
          ConstructorMediaCompanion.insert(
            mediaId: mediaId,
            constructorId: ownerId,
            orderIndex: order,
          ),
        );
      case MediaEntityType.circuit:
        await into(circuitMedia).insert(
          CircuitMediaCompanion.insert(
            mediaId: mediaId,
            circuitId: ownerId,
            orderIndex: order,
          ),
        );
      case MediaEntityType.grandPrix:
        await into(grandPrixMedia).insert(
          GrandPrixMediaCompanion.insert(
            mediaId: mediaId,
            grandPrixId: ownerId,
            orderIndex: order,
          ),
        );
      case MediaEntityType.placeholder:
      case MediaEntityType.unknown:
        // Not a real owner: never fabricate a foreign-key association.
        break;
    }
  }

  Future<List<String>> _ownedMediaIds(
    MediaEntityType ownerType,
    String ownerId,
  ) async {
    switch (ownerType) {
      case MediaEntityType.driver:
        final List<DriverMediaRow> rows = await (select(
          driverMedia,
        )..where((DriverMedia t) => t.driverId.equals(ownerId))).get();
        return rows.map((DriverMediaRow r) => r.mediaId).toList();
      case MediaEntityType.constructor:
        final List<ConstructorMediaRow> rows =
            await (select(constructorMedia)..where(
                  (ConstructorMedia t) => t.constructorId.equals(ownerId),
                ))
                .get();
        return rows.map((ConstructorMediaRow r) => r.mediaId).toList();
      case MediaEntityType.circuit:
        final List<CircuitMediaRow> rows = await (select(
          circuitMedia,
        )..where((CircuitMedia t) => t.circuitId.equals(ownerId))).get();
        return rows.map((CircuitMediaRow r) => r.mediaId).toList();
      case MediaEntityType.grandPrix:
        final List<GrandPrixMediaRow> rows = await (select(
          grandPrixMedia,
        )..where((GrandPrixMedia t) => t.grandPrixId.equals(ownerId))).get();
        return rows.map((GrandPrixMediaRow r) => r.mediaId).toList();
      case MediaEntityType.placeholder:
      case MediaEntityType.unknown:
        return const <String>[];
    }
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  /// Reads the ordered media owned by [ownerId] of [ownerType]. Returns an empty
  /// list when the owner has no media (never `null`).
  Future<List<MediaAsset>> mediaForOwner(
    MediaEntityType ownerType,
    String ownerId,
  ) async {
    final List<String> orderedIds = await _orderedOwnedMediaIds(
      ownerType,
      ownerId,
    );
    if (orderedIds.isEmpty) return const <MediaAsset>[];

    final List<MediaAssetRow> assetRows = await (select(
      mediaAssets,
    )..where((MediaAssets m) => m.id.isIn(orderedIds))).get();
    final Map<String, MediaAssetRow> assetsById = <String, MediaAssetRow>{
      for (final MediaAssetRow r in assetRows) r.id: r,
    };

    final List<MediaVariantRow> variantRows = await (select(
      mediaAssetVariants,
    )..where((MediaAssetVariants v) => v.mediaId.isIn(orderedIds))).get();
    final Map<String, List<MediaVariantRow>> variantsByMedia =
        <String, List<MediaVariantRow>>{};
    for (final MediaVariantRow v in variantRows) {
      (variantsByMedia[v.mediaId] ??= <MediaVariantRow>[]).add(v);
    }

    final List<MediaAsset> result = <MediaAsset>[];
    for (final String id in orderedIds) {
      final MediaAssetRow? row = assetsById[id];
      if (row == null) continue;
      result.add(
        _assetFrom(row, variantsByMedia[id] ?? const <MediaVariantRow>[]),
      );
    }
    return result;
  }

  Future<List<String>> _orderedOwnedMediaIds(
    MediaEntityType ownerType,
    String ownerId,
  ) async {
    switch (ownerType) {
      case MediaEntityType.driver:
        final List<DriverMediaRow> rows =
            await (select(driverMedia)
                  ..where((DriverMedia t) => t.driverId.equals(ownerId))
                  ..orderBy(<OrderClauseGenerator<DriverMedia>>[
                    (DriverMedia t) => OrderingTerm(expression: t.orderIndex),
                  ]))
                .get();
        return rows.map((DriverMediaRow r) => r.mediaId).toList();
      case MediaEntityType.constructor:
        final List<ConstructorMediaRow> rows =
            await (select(constructorMedia)
                  ..where(
                    (ConstructorMedia t) => t.constructorId.equals(ownerId),
                  )
                  ..orderBy(<OrderClauseGenerator<ConstructorMedia>>[
                    (ConstructorMedia t) =>
                        OrderingTerm(expression: t.orderIndex),
                  ]))
                .get();
        return rows.map((ConstructorMediaRow r) => r.mediaId).toList();
      case MediaEntityType.circuit:
        final List<CircuitMediaRow> rows =
            await (select(circuitMedia)
                  ..where((CircuitMedia t) => t.circuitId.equals(ownerId))
                  ..orderBy(<OrderClauseGenerator<CircuitMedia>>[
                    (CircuitMedia t) => OrderingTerm(expression: t.orderIndex),
                  ]))
                .get();
        return rows.map((CircuitMediaRow r) => r.mediaId).toList();
      case MediaEntityType.grandPrix:
        final List<GrandPrixMediaRow> rows =
            await (select(grandPrixMedia)
                  ..where((GrandPrixMedia t) => t.grandPrixId.equals(ownerId))
                  ..orderBy(<OrderClauseGenerator<GrandPrixMedia>>[
                    (GrandPrixMedia t) =>
                        OrderingTerm(expression: t.orderIndex),
                  ]))
                .get();
        return rows.map((GrandPrixMediaRow r) => r.mediaId).toList();
      case MediaEntityType.placeholder:
      case MediaEntityType.unknown:
        return const <String>[];
    }
  }

  // ---------------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------------

  MediaAssetsCompanion _assetCompanion(MediaAsset a) =>
      MediaAssetsCompanion.insert(
        id: a.id,
        entityType: a.entityType.wire,
        entityId: Value<String?>(a.entityId),
        category: a.category.wire,
        format: a.format.wire,
        aspectRatio: Value<double?>(a.aspectRatio),
        version: a.version,
        attribution: Value<String?>(a.attribution),
        license: Value<String?>(a.license),
        fallbackCategory: Value<String?>(a.fallbackCategory),
      );

  Iterable<MapEntry<String, MediaVariant>> _variantEntries(MediaVariants v) {
    return <MapEntry<String, MediaVariant>>[
      if (v.thumbnail != null)
        MapEntry<String, MediaVariant>(_thumbnail, v.thumbnail!),
      if (v.card != null) MapEntry<String, MediaVariant>(_card, v.card!),
      if (v.detail != null) MapEntry<String, MediaVariant>(_detail, v.detail!),
      if (v.hero != null) MapEntry<String, MediaVariant>(_hero, v.hero!),
    ];
  }

  MediaAsset _assetFrom(MediaAssetRow row, List<MediaVariantRow> variants) {
    MediaVariant? slot(String name) {
      for (final MediaVariantRow v in variants) {
        if (v.variantName == name) {
          return MediaVariant(url: v.url, width: v.width, height: v.height);
        }
      }
      return null;
    }

    return MediaAsset(
      id: row.id,
      entityType: MediaEntityType.fromWire(row.entityType),
      entityId: row.entityId,
      category: MediaCategory.fromWire(row.category),
      format: MediaFormat.fromWire(row.format),
      variants: MediaVariants(
        thumbnail: slot(_thumbnail),
        card: slot(_card),
        detail: slot(_detail),
        hero: slot(_hero),
      ),
      aspectRatio: row.aspectRatio,
      version: row.version,
      attribution: row.attribution,
      license: row.license,
      fallbackCategory: row.fallbackCategory,
    );
  }
}
