import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/media_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';

void main() {
  late GridViewDatabase db;
  late MediaDao dao;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    dao = db.mediaDao;
  });
  tearDown(() => db.close());

  Future<void> insertDriver(String id) =>
      db.into(db.drivers).insert(DriversCompanion.insert(id: id, fullName: id));
  Future<void> insertConstructor(String id) => db
      .into(db.constructors)
      .insert(ConstructorsCompanion.insert(id: id, name: id));

  MediaAsset portrait(
    String id, {
    required MediaEntityType type,
    String? entityId,
  }) => MediaAsset(
    id: id,
    entityType: type,
    entityId: entityId,
    category: MediaCategory.portrait,
    format: MediaFormat.webp,
    variants: const MediaVariants(
      thumbnail: MediaVariant(
        url: 'https://cdn/thumb.webp',
        width: 96,
        height: 96,
      ),
      detail: MediaVariant(url: 'https://cdn/detail.webp'),
    ),
    aspectRatio: 1.0,
    version: 'v1',
    attribution: 'GridView',
  );

  test(
    'persists an asset with its variants and FK-backed association',
    () async {
      await insertDriver('max-verstappen');
      await dao.replaceOwnerMedia(
        MediaEntityType.driver,
        'max-verstappen',
        <MediaAsset>[
          portrait(
            'max-verstappen-portrait-v1',
            type: MediaEntityType.driver,
            entityId: 'max-verstappen',
          ),
        ],
      );

      final List<MediaAsset> media = await dao.mediaForOwner(
        MediaEntityType.driver,
        'max-verstappen',
      );
      expect(media, hasLength(1));
      final MediaAsset a = media.single;
      expect(a.id, 'max-verstappen-portrait-v1');
      expect(a.category, MediaCategory.portrait);
      expect(a.format, MediaFormat.webp);
      expect(a.variants.thumbnail?.url, 'https://cdn/thumb.webp');
      expect(a.variants.thumbnail?.width, 96);
      expect(a.variants.detail?.url, 'https://cdn/detail.webp');
      expect(a.variants.detail?.width, isNull);
      expect(a.variants.card, isNull);
      expect(a.aspectRatio, 1.0);
      expect(a.attribution, 'GridView');

      // The association row exists and is FK-backed.
      expect(await db.select(db.driverMedia).get(), hasLength(1));
    },
  );

  test(
    'preserves owner order and replaces obsolete media without duplicates',
    () async {
      await insertDriver('driver-a');
      await dao
          .replaceOwnerMedia(MediaEntityType.driver, 'driver-a', <MediaAsset>[
            portrait('a-2', type: MediaEntityType.driver, entityId: 'driver-a'),
            portrait('a-1', type: MediaEntityType.driver, entityId: 'driver-a'),
          ]);

      List<MediaAsset> media = await dao.mediaForOwner(
        MediaEntityType.driver,
        'driver-a',
      );
      expect(media.map((MediaAsset m) => m.id), <String>['a-2', 'a-1']);

      // Re-sync with a smaller, reordered set: obsolete 'a-2' must disappear.
      await dao.replaceOwnerMedia(
        MediaEntityType.driver,
        'driver-a',
        <MediaAsset>[
          portrait('a-1', type: MediaEntityType.driver, entityId: 'driver-a'),
        ],
      );
      media = await dao.mediaForOwner(MediaEntityType.driver, 'driver-a');
      expect(media.map((MediaAsset m) => m.id), <String>['a-1']);
      // No orphaned assets or variants remain.
      expect(await db.select(db.mediaAssets).get(), hasLength(1));
      expect(await db.select(db.mediaAssetVariants).get(), hasLength(2));
    },
  );

  test(
    'a placeholder/unknown owner type is rejected (no fabricated FK)',
    () async {
      await insertDriver('max-verstappen');
      await expectLater(
        dao.replaceOwnerMedia(
          MediaEntityType.placeholder,
          'driver',
          <MediaAsset>[portrait('ph-1', type: MediaEntityType.placeholder)],
        ),
        throwsA(isA<InvalidMediaOwnershipException>()),
      );
      // A placeholder asset row may exist in media_assets (e.g. from a content
      // manifest) but it never has an ownership association.
      await db
          .into(db.mediaAssets)
          .insert(
            MediaAssetsCompanion.insert(
              id: 'driver-placeholder-portrait-v1',
              entityType: MediaEntityType.placeholder.wire,
              category: MediaCategory.portrait.wire,
              format: MediaFormat.webp.wire,
              version: 'v1',
            ),
          );
      expect(await db.select(db.driverMedia).get(), isEmpty);
      expect(await db.select(db.constructorMedia).get(), isEmpty);
      expect(await db.select(db.circuitMedia).get(), isEmpty);
      expect(await db.select(db.grandPrixMedia).get(), isEmpty);
    },
  );

  test(
    'an entityType that does not match the owner is rejected and rolls back',
    () async {
      await insertDriver('max-verstappen');
      await expectLater(
        dao.replaceOwnerMedia(
          MediaEntityType.driver,
          'max-verstappen',
          <MediaAsset>[
            // entityType constructor under a driver owner -> invalid.
            portrait('mismatch-1', type: MediaEntityType.constructor),
          ],
        ),
        throwsA(isA<InvalidMediaOwnershipException>()),
      );
      // Nothing persisted.
      expect(await db.select(db.mediaAssets).get(), isEmpty);
      expect(await db.select(db.driverMedia).get(), isEmpty);
    },
  );

  test(
    'an asset is owned by exactly one owner; moving ownership is clean',
    () async {
      await insertDriver('driver-a');
      await insertDriver('driver-b');
      await insertConstructor('team-c');

      // Owned by driver-a.
      await dao.replaceOwnerMedia(
        MediaEntityType.driver,
        'driver-a',
        <MediaAsset>[
          portrait(
            'asset-x',
            type: MediaEntityType.driver,
            entityId: 'driver-a',
          ),
        ],
      );
      // Move to driver-b (same owner type).
      await dao.replaceOwnerMedia(
        MediaEntityType.driver,
        'driver-b',
        <MediaAsset>[
          portrait(
            'asset-x',
            type: MediaEntityType.driver,
            entityId: 'driver-b',
          ),
        ],
      );
      expect(
        await dao.mediaForOwner(MediaEntityType.driver, 'driver-a'),
        isEmpty,
      );
      expect(
        (await dao.mediaForOwner(MediaEntityType.driver, 'driver-b')).single.id,
        'asset-x',
      );

      // Move to a different owner type (constructor).
      await dao.replaceOwnerMedia(
        MediaEntityType.constructor,
        'team-c',
        <MediaAsset>[
          portrait(
            'asset-x',
            type: MediaEntityType.constructor,
            entityId: 'team-c',
          ),
        ],
      );

      // Exactly one association total, under the constructor.
      expect(await db.select(db.driverMedia).get(), isEmpty);
      expect(await db.select(db.constructorMedia).get(), hasLength(1));
      expect(await db.select(db.circuitMedia).get(), isEmpty);
      expect(await db.select(db.grandPrixMedia).get(), isEmpty);
      // And still a single media_assets row (no duplication across the moves).
      expect(await db.select(db.mediaAssets).get(), hasLength(1));
    },
  );

  test(
    'mediaForOwner returns an empty list for an owner with no media',
    () async {
      await insertDriver('lonely');
      expect(
        await dao.mediaForOwner(MediaEntityType.driver, 'lonely'),
        isEmpty,
      );
    },
  );
}
