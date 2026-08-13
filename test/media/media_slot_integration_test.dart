import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/media/media_image_loader.dart';
import 'package:gridview/core/widgets/gv_image_placeholder.dart';
import 'package:gridview/core/widgets/gv_remote_image.dart';
import 'package:gridview/features/settings/presentation/acknowledgements_screen.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';

import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/media_fixtures.dart';
import '../support/router_harness.dart';
import '../support/synthetic_png.dart';

/// Media in the live product slots.
///
/// Every assertion here is about one thing: **domain data availability is not
/// media availability.** A screen is complete, navigable and correct with no
/// imagery, with failing imagery and with imagery that never arrives.
const Size _surface = Size(400, 1400);

/// Which variant slot a request is for, read from the cache key the selector
/// built. This is how "a row never fetches a hero" is asserted on the request
/// itself rather than on a rendered pixel.
String _slotOf(String cacheKey) => cacheKey.split('|')[2];

MediaAsset _driverPortrait(String driverId) =>
    portraitAsset(id: '$driverId-portrait-v1', owner: driverId);

MediaAsset _teamLogo(String constructorId) => MediaAsset(
  id: '$constructorId-logo-v1',
  entityType: MediaEntityType.constructor,
  entityId: constructorId,
  category: MediaCategory.logo,
  format: MediaFormat.png,
  version: 'v1',
  aspectRatio: 1,
  variants: MediaVariants(
    thumbnail: variant(
      testMediaUrl(
        'constructors',
        constructorId,
        'v1',
        'thumbnail',
        extension: 'png',
      ),
      width: 160,
      height: 160,
    ),
    detail: variant(
      testMediaUrl(
        'constructors',
        constructorId,
        'v1',
        'detail',
        extension: 'png',
      ),
      width: 960,
      height: 960,
    ),
  ),
);

MediaAsset _circuitLayout(String circuitId) => MediaAsset(
  id: '$circuitId-layout-v1',
  entityType: MediaEntityType.circuit,
  entityId: circuitId,
  category: MediaCategory.circuitLayout,
  format: MediaFormat.png,
  version: 'v1',
  aspectRatio: 16 / 9,
  variants: MediaVariants(
    thumbnail: variant(
      testMediaUrl('circuits', circuitId, 'v1', 'thumbnail', extension: 'png'),
      width: 160,
      height: 90,
    ),
    detail: variant(
      testMediaUrl('circuits', circuitId, 'v1', 'detail', extension: 'png'),
      width: 960,
      height: 540,
    ),
  ),
);

void main() {
  late Directory tmp;
  late File image;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('gv_media_slots');
    image = writePng(tmp, 'a.png', bandedPng(16, 16));
  });

  tearDown(() {
    if (tmp.existsSync()) tmp.deleteSync(recursive: true);
  });

  /// A loader that serves every request from "disk", so no fetch is required.
  FakeMediaImageLoader servingEverything() => _ServingLoader(image);

  group('Explore rows', () {
    testWidgets('a driver row uses its own portrait at thumbnail size', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = servingEverything();
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _surface,
        mediaLoader: loader,
        drivers: FakeDriverRepository(
          cards: (int season) => <SeasonDriverCard>[
            driverCard(
              driverId: 'test-shape',
              name: 'Test Shape',
              order: 0,
              media: entityMediaOf(<MediaAsset>[_driverPortrait('test-shape')]),
            ),
          ],
        ),
      );

      expect(loader.cacheProbes, isNotEmpty);
      // A 40px row must never pull a detail or hero file.
      for (final String key in loader.cacheProbes) {
        expect(_slotOf(key), 'thumbnail');
      }
      expect(find.byType(GvRemoteImage), findsWidgets);
    });

    testWidgets(
      'a row with no media renders the placeholder and fetches nothing',
      (WidgetTester tester) async {
        final FakeMediaImageLoader loader = servingEverything();
        await pumpApp(
          tester,
          initialLocation: '/explore',
          surfaceSize: _surface,
          mediaLoader: loader,
          drivers: FakeDriverRepository(
            cards: (int season) => <SeasonDriverCard>[
              driverCard(driverId: 'test-shape', name: 'Test Shape', order: 0),
            ],
          ),
        );

        expect(loader.cacheProbes, isEmpty);
        expect(loader.fetches, isEmpty);
        expect(find.text('Test Shape'), findsOneWidget);
        expect(find.byType(GvImagePlaceholder), findsWidgets);
      },
    );

    testWidgets('a row keeps its text when the image fails', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = FakeMediaImageLoader();
      await pumpApp(
        tester,
        initialLocation: '/explore',
        surfaceSize: _surface,
        mediaLoader: loader,
        drivers: FakeDriverRepository(
          cards: (int season) => <SeasonDriverCard>[
            driverCard(
              driverId: 'test-shape',
              name: 'Test Shape',
              order: 0,
              teamName: 'Test Team',
              media: entityMediaOf(<MediaAsset>[_driverPortrait('test-shape')]),
            ),
          ],
        ),
      );

      expect(find.text('Test Shape'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a team row uses the constructor\'s stable mark', (
      WidgetTester tester,
    ) async {
      // Stable identity imagery, not season livery: the contract carries no
      // season-entry media, so a season brand name never implies a season image.
      final FakeMediaImageLoader loader = servingEverything();
      await pumpApp(
        tester,
        initialLocation: '/explore/teams',
        surfaceSize: _surface,
        mediaLoader: loader,
        constructors: FakeConstructorRepository(
          cards: (int season) => <SeasonTeamCard>[
            teamCard(
              constructorId: 'test-team',
              stableName: 'Test Team',
              seasonName: 'Test Team Racing',
              order: 0,
              media: entityMediaOf(
                <MediaAsset>[_teamLogo('test-team')],
                ownerType: MediaEntityType.constructor,
                ownerId: 'test-team',
              ),
            ),
          ],
        ),
      );

      expect(loader.cacheProbes, isNotEmpty);
      for (final String key in loader.cacheProbes) {
        expect(_slotOf(key), 'thumbnail');
        expect(key, contains('test-team-logo-v1'));
      }
      // The season brand is still the display name; only the image is stable.
      expect(find.text('Test Team Racing'), findsOneWidget);
    });

    testWidgets('a circuit row uses circuit-owned layout media', (
      WidgetTester tester,
    ) async {
      final FakeMediaImageLoader loader = servingEverything();
      await pumpApp(
        tester,
        initialLocation: '/explore/circuits',
        surfaceSize: _surface,
        mediaLoader: loader,
        circuits: FakeCircuitRepository(
          cards: (int season) => <SeasonCircuitCard>[
            circuitCard(
              circuitId: 'test-circuit',
              name: 'Test Circuit',
              order: 1,
              media: entityMediaOf(
                <MediaAsset>[_circuitLayout('test-circuit')],
                ownerType: MediaEntityType.circuit,
                ownerId: 'test-circuit',
              ),
            ),
          ],
        ),
      );

      expect(loader.cacheProbes, isNotEmpty);
      for (final String key in loader.cacheProbes) {
        expect(key, contains('test-circuit-layout-v1'));
      }
    });
  });

  group('acknowledgements', () {
    testWidgets('shows the credits stored locally, with no request', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/settings/acknowledgements',
        surfaceSize: _surface,
        mediaAttributions: const <MediaAttribution>[
          MediaAttribution(
            category: MediaCategory.portrait,
            attribution: 'GridView synthetic fixture',
            license: 'GridView-owned synthetic fixture',
          ),
        ],
      );

      expect(find.byKey(AcknowledgementsScreen.creditsKey), findsOneWidget);
      expect(find.textContaining('GridView synthetic fixture'), findsOneWidget);
    });

    testWidgets('an empty register renders the empty state, not a credit', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/settings/acknowledgements',
        surfaceSize: _surface,
      );
      expect(find.byKey(AcknowledgementsScreen.emptyKey), findsOneWidget);
      expect(find.byKey(AcknowledgementsScreen.creditsKey), findsNothing);
    });

    testWidgets('several credits are all shown, in order', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/settings/acknowledgements',
        surfaceSize: _surface,
        mediaAttributions: const <MediaAttribution>[
          MediaAttribution(
            category: MediaCategory.portrait,
            attribution: 'Alpha rights holder',
          ),
          MediaAttribution(
            category: MediaCategory.circuitLayout,
            attribution: 'Beta rights holder',
            license: 'CC-BY-4.0',
          ),
        ],
      );

      expect(find.textContaining('Alpha rights holder'), findsOneWidget);
      expect(find.textContaining('Beta rights holder'), findsOneWidget);
      expect(find.textContaining('CC-BY-4.0'), findsOneWidget);
    });

    testWidgets('no media id, owner id or URL is ever used as a title', (
      WidgetTester tester,
    ) async {
      await pumpApp(
        tester,
        initialLocation: '/settings/acknowledgements',
        surfaceSize: _surface,
        mediaAttributions: const <MediaAttribution>[
          MediaAttribution(
            category: MediaCategory.portrait,
            attribution: 'GridView synthetic fixture',
          ),
        ],
      );

      // The label is a localized category, never an identifier.
      expect(find.text('Portrait'), findsOneWidget);
      expect(find.textContaining('test-shape-portrait-v1'), findsNothing);
      expect(find.textContaining('media.gridview.invalid'), findsNothing);
      expect(find.textContaining('portrait-v1'), findsNothing);
    });
  });
}

/// A loader whose cache already holds everything, so nothing is ever fetched.
class _ServingLoader extends FakeMediaImageLoader {
  _ServingLoader(this._file);

  final File _file;

  @override
  Future<File?> cached(MediaImageRequest request) async {
    cacheProbes.add(request.cacheKey);
    return _file;
  }
}
