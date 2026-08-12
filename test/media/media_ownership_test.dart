import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/database/daos/media_dao.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/media/media_presentation.dart';
import 'package:gridview/features/shared/domain/media/media_slot_policy.dart';

import '../support/media_fixtures.dart';

/// Media ownership at the persistence boundary, and the presentation read models
/// built on top of it.
///
/// The rule under test throughout: **a real asset has at most one real owner, and
/// a descriptor has none.** `placeholder` and `unknown` assets never gain a
/// foreign-key association, so they can never masquerade as an entity's imagery.
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
  Future<void> insertCircuit(String id) =>
      db.into(db.circuits).insert(CircuitsCompanion.insert(id: id, name: id));
  Future<void> insertGrandPrix(String id) async {
    // `grand_prix.season` is a foreign key onto `seasons.year`.
    await db
        .into(db.seasons)
        .insert(
          SeasonsCompanion.insert(
            year: const Value<int>(2026),
            status: 'in_progress',
          ),
        );
    await db
        .into(db.grandPrixEvents)
        .insert(
          GrandPrixEventsCompanion.insert(
            id: id,
            season: 2026,
            round: 1,
            eventSlug: 'test-grand-prix',
            name: 'Test Grand Prix',
            circuitId: 'test-circuit',
            status: 'scheduled',
            format: 'standard',
            hasResults: const Value<bool>(false),
          ),
        );
  }

  MediaAsset asset(
    String id, {
    required MediaEntityType type,
    String? owner,
    MediaCategory category = MediaCategory.portrait,
    String? attribution = 'GridView synthetic fixture',
    String? license = 'GridView-owned synthetic fixture',
    String version = 'v1',
    MediaVariants? variants,
  }) => MediaAsset(
    id: id,
    entityType: type,
    entityId: owner,
    category: category,
    format: MediaFormat.webp,
    version: version,
    aspectRatio: 1.0,
    attribution: attribution,
    license: license,
    fallbackCategory: category.wire,
    variants:
        variants ??
        MediaVariants(
          thumbnail: variant(
            testMediaUrl('drivers', owner ?? id, version, 'thumbnail'),
            width: 160,
            height: 160,
          ),
          detail: variant(
            testMediaUrl('drivers', owner ?? id, version, 'detail'),
          ),
        ),
  );

  group('every real owner type round-trips', () {
    test('driver', () async {
      await insertDriver('test-shape');
      await dao
          .replaceOwnerMedia(MediaEntityType.driver, 'test-shape', <MediaAsset>[
            asset(
              'test-shape-portrait-v1',
              type: MediaEntityType.driver,
              owner: 'test-shape',
            ),
          ]);
      expect(
        await dao.mediaForOwner(MediaEntityType.driver, 'test-shape'),
        hasLength(1),
      );
    });

    test('constructor', () async {
      await insertConstructor('test-team');
      await dao.replaceOwnerMedia(
        MediaEntityType.constructor,
        'test-team',
        <MediaAsset>[
          asset(
            'test-team-logo-v1',
            type: MediaEntityType.constructor,
            owner: 'test-team',
            category: MediaCategory.logo,
          ),
        ],
      );
      expect(
        await dao.mediaForOwner(MediaEntityType.constructor, 'test-team'),
        hasLength(1),
      );
    });

    test('circuit', () async {
      await insertCircuit('test-circuit');
      await dao.replaceOwnerMedia(
        MediaEntityType.circuit,
        'test-circuit',
        <MediaAsset>[
          asset(
            'test-circuit-layout-v1',
            type: MediaEntityType.circuit,
            owner: 'test-circuit',
            category: MediaCategory.circuitLayout,
          ),
        ],
      );
      expect(
        await dao.mediaForOwner(MediaEntityType.circuit, 'test-circuit'),
        hasLength(1),
      );
    });

    test('grand prix', () async {
      await insertCircuit('test-circuit');
      await insertGrandPrix('2026-test-grand-prix');
      await dao.replaceOwnerMedia(
        MediaEntityType.grandPrix,
        '2026-test-grand-prix',
        <MediaAsset>[
          asset(
            'test-event-hero-v1',
            type: MediaEntityType.grandPrix,
            owner: '2026-test-grand-prix',
            category: MediaCategory.hero,
          ),
        ],
      );
      expect(
        await dao.mediaForOwner(
          MediaEntityType.grandPrix,
          '2026-test-grand-prix',
        ),
        hasLength(1),
      );
    });
  });

  group('single-owner integrity', () {
    test(
      'an entityType that disagrees with the owner table is rejected',
      () async {
        await insertDriver('test-shape');
        expect(
          () => dao.replaceOwnerMedia(
            MediaEntityType.driver,
            'test-shape',
            <MediaAsset>[
              asset(
                'mismatched-v1',
                type: MediaEntityType.constructor,
                owner: 'test-shape',
              ),
            ],
          ),
          throwsA(isA<InvalidMediaOwnershipException>()),
        );
      },
    );

    test('a descriptor type is not an owner', () async {
      for (final MediaEntityType type in <MediaEntityType>[
        MediaEntityType.placeholder,
        MediaEntityType.unknown,
      ]) {
        expect(
          () => dao.replaceOwnerMedia(type, 'anything', const <MediaAsset>[]),
          throwsA(isA<InvalidMediaOwnershipException>()),
        );
      }
    });

    test('reassigning an asset moves it rather than duplicating it', () async {
      await insertDriver('driver-a');
      await insertDriver('driver-b');
      final MediaAsset shared = asset(
        'shared-portrait-v1',
        type: MediaEntityType.driver,
        owner: 'driver-a',
      );

      await dao.replaceOwnerMedia(
        MediaEntityType.driver,
        'driver-a',
        <MediaAsset>[shared],
      );
      await dao.replaceOwnerMedia(
        MediaEntityType.driver,
        'driver-b',
        <MediaAsset>[shared],
      );

      expect(
        await dao.mediaForOwner(MediaEntityType.driver, 'driver-a'),
        isEmpty,
      );
      expect(
        (await dao.mediaForOwner(MediaEntityType.driver, 'driver-b')).single.id,
        'shared-portrait-v1',
      );
    });

    test('a placeholder descriptor never becomes entity media', () async {
      await insertDriver('test-shape');
      await dao
          .replaceOwnerMedia(MediaEntityType.driver, 'test-shape', <MediaAsset>[
            asset(
              'test-shape-portrait-v1',
              type: MediaEntityType.driver,
              owner: 'test-shape',
            ),
          ]);

      // Even if a descriptor reaches the read model, ownership filtering drops
      // it: it has no association row and no real owner.
      final EntityMedia media =
          EntityMedia.from(MediaEntityType.driver, 'test-shape', <MediaAsset>[
            ...await dao.mediaForOwner(MediaEntityType.driver, 'test-shape'),
            asset('placeholder-portrait-v1', type: MediaEntityType.placeholder),
            asset('unknown-portrait-v1', type: MediaEntityType.unknown),
          ]);
      expect(media.assets.map((MediaPresentation a) => a.mediaId), <String>[
        'test-shape-portrait-v1',
      ]);
    });
  });

  group('replacement', () {
    test('removes obsolete assets, associations and variants', () async {
      await insertDriver('test-shape');
      await dao.replaceOwnerMedia(
        MediaEntityType.driver,
        'test-shape',
        <MediaAsset>[
          asset(
            'old-portrait-v1',
            type: MediaEntityType.driver,
            owner: 'test-shape',
          ),
        ],
      );
      await dao
          .replaceOwnerMedia(MediaEntityType.driver, 'test-shape', <MediaAsset>[
            asset(
              'new-portrait-v2',
              type: MediaEntityType.driver,
              owner: 'test-shape',
              version: 'v2',
            ),
          ]);

      final List<MediaAsset> media = await dao.mediaForOwner(
        MediaEntityType.driver,
        'test-shape',
      );
      expect(media.single.id, 'new-portrait-v2');
      // The removed asset's variants went with it, via cascade.
      expect(
        await db.select(db.mediaAssetVariants).get(),
        everyElement(
          predicate<MediaVariantRow>(
            (MediaVariantRow v) => v.mediaId == 'new-portrait-v2',
          ),
        ),
      );
    });

    test(
      'a removed asset stops being selectable without breaking the owner',
      () async {
        await insertDriver('test-shape');
        await dao.replaceOwnerMedia(
          MediaEntityType.driver,
          'test-shape',
          <MediaAsset>[
            asset(
              'old-portrait-v1',
              type: MediaEntityType.driver,
              owner: 'test-shape',
            ),
          ],
        );
        await dao.replaceOwnerMedia(
          MediaEntityType.driver,
          'test-shape',
          const <MediaAsset>[],
        );

        expect(
          await dao.mediaForOwner(MediaEntityType.driver, 'test-shape'),
          isEmpty,
        );
        // The driver itself is untouched: removing imagery is not removing data.
        expect(await db.select(db.drivers).get(), hasLength(1));
      },
    );
  });

  group('everything the contract carries is preserved', () {
    test(
      'multiple categories, all variants, attribution, licence, ratio',
      () async {
        await insertDriver('test-shape');
        await dao.replaceOwnerMedia(
          MediaEntityType.driver,
          'test-shape',
          <MediaAsset>[
            asset(
              'test-shape-portrait-v1',
              type: MediaEntityType.driver,
              owner: 'test-shape',
            ),
            asset(
              'test-shape-hero-v1',
              type: MediaEntityType.driver,
              owner: 'test-shape',
              category: MediaCategory.hero,
              license: 'a different licence',
            ),
          ],
        );

        final List<MediaAsset> media = await dao.mediaForOwner(
          MediaEntityType.driver,
          'test-shape',
        );
        expect(media, hasLength(2));
        expect(media.map((MediaAsset a) => a.category), <MediaCategory>[
          MediaCategory.portrait,
          MediaCategory.hero,
        ]);
        expect(media.first.attribution, 'GridView synthetic fixture');
        expect(media.last.license, 'a different licence');
        expect(media.first.aspectRatio, 1.0);
        expect(media.first.fallbackCategory, 'portrait');
      },
    );

    test('nullable variant dimensions survive the round trip', () async {
      await insertDriver('test-shape');
      await dao
          .replaceOwnerMedia(MediaEntityType.driver, 'test-shape', <MediaAsset>[
            asset(
              'test-shape-portrait-v1',
              type: MediaEntityType.driver,
              owner: 'test-shape',
            ),
          ]);
      final MediaAsset stored = (await dao.mediaForOwner(
        MediaEntityType.driver,
        'test-shape',
      )).single;

      expect(stored.variants.thumbnail!.width, 160);
      // The detail variant deliberately carries no dimensions; null must not
      // become zero.
      expect(stored.variants.detail!.width, isNull);
      expect(stored.variants.detail!.height, isNull);
    });
  });

  group('batched collection read', () {
    test('returns each owner its own media, in stored order', () async {
      await insertDriver('driver-a');
      await insertDriver('driver-b');
      await dao
          .replaceOwnerMedia(MediaEntityType.driver, 'driver-a', <MediaAsset>[
            asset(
              'a-portrait-v1',
              type: MediaEntityType.driver,
              owner: 'driver-a',
            ),
            asset(
              'a-hero-v1',
              type: MediaEntityType.driver,
              owner: 'driver-a',
              category: MediaCategory.hero,
            ),
          ]);
      await dao.replaceOwnerMedia(
        MediaEntityType.driver,
        'driver-b',
        <MediaAsset>[
          asset(
            'b-portrait-v1',
            type: MediaEntityType.driver,
            owner: 'driver-b',
          ),
        ],
      );

      final Map<String, List<MediaAsset>> batched = await dao.mediaForOwners(
        MediaEntityType.driver,
        <String>{'driver-a', 'driver-b', 'driver-without-media'},
      );
      expect(batched['driver-a']!.map((MediaAsset a) => a.id), <String>[
        'a-portrait-v1',
        'a-hero-v1',
      ]);
      expect(batched['driver-b']!.single.id, 'b-portrait-v1');
      // An owner with no imagery is simply absent, not an empty entry to check.
      expect(batched.containsKey('driver-without-media'), isFalse);
    });

    test('agrees with the per-owner read', () async {
      await insertDriver('test-shape');
      await dao
          .replaceOwnerMedia(MediaEntityType.driver, 'test-shape', <MediaAsset>[
            asset(
              'test-shape-portrait-v1',
              type: MediaEntityType.driver,
              owner: 'test-shape',
            ),
          ]);
      final Map<String, List<MediaAsset>> batched = await dao.mediaForOwners(
        MediaEntityType.driver,
        <String>{'test-shape'},
      );
      expect(
        batched['test-shape']!.map((MediaAsset a) => a.id),
        (await dao.mediaForOwner(
          MediaEntityType.driver,
          'test-shape',
        )).map((MediaAsset a) => a.id),
      );
    });

    test('is empty for a descriptor type or an empty id set', () async {
      expect(
        await dao.mediaForOwners(MediaEntityType.placeholder, <String>{'x'}),
        isEmpty,
      );
      expect(
        await dao.mediaForOwners(MediaEntityType.driver, const <String>{}),
        isEmpty,
      );
    });
  });

  group('slot policy chooses by category, never arbitrarily', () {
    test('a driver slot takes the portrait, not the logo', () async {
      final EntityMedia media = entityMediaOf(<MediaAsset>[
        asset(
          'test-shape-logo-v1',
          type: MediaEntityType.driver,
          owner: 'test-shape',
          category: MediaCategory.logo,
        ),
        asset(
          'test-shape-portrait-v1',
          type: MediaEntityType.driver,
          owner: 'test-shape',
        ),
      ]);
      expect(
        media.preferred(MediaSlotPolicy.driverPortrait)!.mediaId,
        'test-shape-portrait-v1',
      );
    });

    test('a category outside the slot policy is never shown there', () async {
      final EntityMedia media = entityMediaOf(<MediaAsset>[
        asset(
          'test-shape-car-v1',
          type: MediaEntityType.driver,
          owner: 'test-shape',
          category: MediaCategory.car,
        ),
      ]);
      // `car` is not a driver-portrait category, so the slot shows nothing.
      expect(media.preferred(MediaSlotPolicy.driverPortrait), isNull);
    });

    test('a team slot prefers the logo, then the car', () async {
      final EntityMedia teamMedia = entityMediaOf(
        <MediaAsset>[
          asset(
            'test-team-car-v1',
            type: MediaEntityType.constructor,
            owner: 'test-team',
            category: MediaCategory.car,
          ),
          asset(
            'test-team-logo-v1',
            type: MediaEntityType.constructor,
            owner: 'test-team',
            category: MediaCategory.logo,
          ),
        ],
        ownerType: MediaEntityType.constructor,
        ownerId: 'test-team',
      );
      expect(
        teamMedia.preferred(MediaSlotPolicy.constructorMark)!.mediaId,
        'test-team-logo-v1',
      );
    });

    test('an asset with no usable variant is not preferred', () async {
      final EntityMedia media = entityMediaOf(<MediaAsset>[
        asset(
          'test-shape-portrait-v1',
          type: MediaEntityType.driver,
          owner: 'test-shape',
          variants: const MediaVariants(),
        ),
      ]);
      expect(media.preferred(MediaSlotPolicy.driverPortrait), isNull);
    });
  });

  group('Grand Prix hero draws on the event first, the circuit second', () {
    EntityMedia eventMedia(List<MediaAsset> assets) => EntityMedia.from(
      MediaEntityType.grandPrix,
      '2026-test-grand-prix',
      assets,
    );
    EntityMedia circuitMedia(List<MediaAsset> assets) =>
        EntityMedia.from(MediaEntityType.circuit, 'test-circuit', assets);

    test('event media wins and is not marked a fallback', () {
      final EventHeroMedia? hero = EventHeroMedia.resolve(
        eventMedia: eventMedia(<MediaAsset>[
          asset(
            'test-event-hero-v1',
            type: MediaEntityType.grandPrix,
            owner: '2026-test-grand-prix',
            category: MediaCategory.hero,
          ),
        ]),
        circuitMedia: circuitMedia(<MediaAsset>[
          asset(
            'test-circuit-layout-v1',
            type: MediaEntityType.circuit,
            owner: 'test-circuit',
            category: MediaCategory.circuitLayout,
          ),
        ]),
      );
      expect(hero!.asset.mediaId, 'test-event-hero-v1');
      expect(hero.isCircuitFallback, isFalse);
    });

    test(
      'the circuit is used only when the event has nothing, and is flagged',
      () {
        final EventHeroMedia? hero = EventHeroMedia.resolve(
          eventMedia: eventMedia(const <MediaAsset>[]),
          circuitMedia: circuitMedia(<MediaAsset>[
            asset(
              'test-circuit-layout-v1',
              type: MediaEntityType.circuit,
              owner: 'test-circuit',
              category: MediaCategory.circuitLayout,
            ),
          ]),
        );
        // The flag is what lets presentation describe a diagram accurately rather
        // than assuming an event photograph.
        expect(hero!.asset.mediaId, 'test-circuit-layout-v1');
        expect(hero.isCircuitFallback, isTrue);
      },
    );

    test('neither owner having imagery is a null hero, not an error', () {
      expect(
        EventHeroMedia.resolve(eventMedia: null, circuitMedia: null),
        isNull,
      );
    });
  });

  group('persistence survives a close and reopen', () {
    test('media and its ownership are still there', () async {
      final Directory dir = Directory.systemTemp.createTempSync('gv_media_db');
      addTearDown(() {
        if (dir.existsSync()) dir.deleteSync(recursive: true);
      });
      final File file = File('${dir.path}${Platform.pathSeparator}m.sqlite');

      final GridViewDatabase first = GridViewDatabase.forTesting(
        NativeDatabase(file),
      );
      await first
          .into(first.drivers)
          .insert(
            DriversCompanion.insert(id: 'test-shape', fullName: 'Test Shape'),
          );
      await first.mediaDao
          .replaceOwnerMedia(MediaEntityType.driver, 'test-shape', <MediaAsset>[
            asset(
              'test-shape-portrait-v1',
              type: MediaEntityType.driver,
              owner: 'test-shape',
            ),
          ]);
      await first.close();

      final GridViewDatabase second = GridViewDatabase.forTesting(
        NativeDatabase(file),
      );
      addTearDown(second.close);
      final List<MediaAsset> media = await second.mediaDao.mediaForOwner(
        MediaEntityType.driver,
        'test-shape',
      );
      expect(media.single.id, 'test-shape-portrait-v1');
      expect(media.single.variants.thumbnail!.width, 160);
      expect(media.single.attribution, 'GridView synthetic fixture');
    });
  });
}
