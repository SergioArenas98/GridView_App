import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/media/media_presentation.dart';
import 'package:gridview/features/shared/domain/media/media_url_policy.dart';
import 'package:gridview/features/shared/domain/media/media_variant_selector.dart';

import '../support/media_fixtures.dart';

const MediaVariantSelector selector = MediaVariantSelector();

MediaSelectionRequest request({
  MediaDisplayRole role = MediaDisplayRole.thumbnail,
  double width = 40,
  double? height,
  double dpr = 1,
  double? ratio,
}) => MediaSelectionRequest(
  role: role,
  logicalWidth: width,
  logicalHeight: height,
  devicePixelRatio: dpr,
  intendedAspectRatio: ratio,
);

MediaPresentation fullAsset() => presentationOf(portraitAsset());

void main() {
  group('physical target is logical size x DPR', () {
    test('DPR 1: a 40px row takes the 160px thumbnail', () {
      final MediaSelection? s = selector.select(fullAsset(), request(dpr: 1));
      expect(s!.slot, MediaVariantSlot.thumbnail);
    });

    test('DPR 2: an 80px row still fits the 160px thumbnail exactly', () {
      final MediaSelection? s = selector.select(
        fullAsset(),
        request(width: 80, dpr: 2),
      );
      expect(s!.slot, MediaVariantSlot.thumbnail);
      expect(s.width, 160);
    });

    test('DPR 3: a 60px row needs 180px, so the thumbnail is not enough', () {
      // The whole point of measuring instead of assuming one density.
      final MediaSelection? s = selector.select(
        fullAsset(),
        request(width: 60, dpr: 3),
      );
      expect(s!.slot, MediaVariantSlot.card);
      expect(s.width, 480);
    });
  });

  group('smallest adequate candidate', () {
    test('a small row never downloads a hero when something smaller fits', () {
      final MediaSelection? s = selector.select(
        fullAsset(),
        request(width: 40, dpr: 2),
      );
      expect(s!.slot, MediaVariantSlot.thumbnail);
      expect(s.width, lessThan(1440));
    });

    test('a card-sized slot takes the card, not the detail', () {
      final MediaSelection? s = selector.select(
        fullAsset(),
        request(role: MediaDisplayRole.card, width: 240, dpr: 2),
      );
      expect(s!.slot, MediaVariantSlot.card);
    });

    test('a detail-sized slot takes the detail', () {
      final MediaSelection? s = selector.select(
        fullAsset(),
        request(role: MediaDisplayRole.detail, width: 480, dpr: 2),
      );
      expect(s!.slot, MediaVariantSlot.detail);
    });

    test('a hero-sized slot takes the hero', () {
      final MediaSelection? s = selector.select(
        fullAsset(),
        request(role: MediaDisplayRole.hero, width: 480, dpr: 3),
      );
      expect(s!.slot, MediaVariantSlot.hero);
    });
  });

  group('a missing semantic variant falls back on size, not on the name', () {
    test('with no thumbnail, a row takes the next adequate size', () {
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            card: variant(
              testMediaUrl('drivers', 'x', 'v1', 'card'),
              width: 480,
              height: 480,
            ),
            hero: variant(
              testMediaUrl('drivers', 'x', 'v1', 'hero'),
              width: 1440,
              height: 1440,
            ),
          ),
        ),
      );
      final MediaSelection? s = selector.select(asset, request());
      expect(s!.slot, MediaVariantSlot.card);
    });

    test(
      'a hero named variant that is actually small is judged on its size',
      () {
        // Dimension information takes precedence over trusting a name that is
        // clearly inappropriate for the requested render size.
        final MediaPresentation asset = presentationOf(
          assetWithVariants(
            MediaVariants(
              hero: variant(
                testMediaUrl('drivers', 'x', 'v1', 'hero'),
                width: 100,
                height: 100,
              ),
              detail: variant(
                testMediaUrl('drivers', 'x', 'v1', 'detail'),
                width: 960,
                height: 960,
              ),
            ),
          ),
        );
        final MediaSelection? s = selector.select(
          asset,
          request(role: MediaDisplayRole.hero, width: 400, dpr: 2),
        );
        expect(s!.slot, MediaVariantSlot.detail);
        expect(s.width, 960);
      },
    );
  });

  group('when nothing is large enough', () {
    test('the largest measured candidate is used', () {
      // An undersized image still beats no image.
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant(
              testMediaUrl('drivers', 'x', 'v1', 'thumbnail'),
              width: 80,
              height: 80,
            ),
            card: variant(
              testMediaUrl('drivers', 'x', 'v1', 'card'),
              width: 120,
              height: 120,
            ),
          ),
        ),
      );
      final MediaSelection? s = selector.select(
        asset,
        request(role: MediaDisplayRole.hero, width: 400, dpr: 3),
      );
      expect(s!.width, 120);
    });
  });

  group('unknown dimensions', () {
    test('an unmeasured candidate is never assumed adequate', () {
      // A measured candidate that actually covers the target wins over an
      // unmeasured one that merely has the matching name.
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant(testMediaUrl('drivers', 'x', 'v1', 'thumbnail')),
            card: variant(
              testMediaUrl('drivers', 'x', 'v1', 'card'),
              width: 480,
              height: 480,
            ),
          ),
        ),
      );
      final MediaSelection? s = selector.select(asset, request());
      expect(s!.slot, MediaVariantSlot.card);
      expect(s.wasMeasured, isTrue);
    });

    test(
      'with nothing measured at all, the role\'s own slot is the fallback',
      () {
        final MediaPresentation asset = presentationOf(
          assetWithVariants(
            MediaVariants(
              thumbnail: variant(
                testMediaUrl('drivers', 'x', 'v1', 'thumbnail'),
              ),
              hero: variant(testMediaUrl('drivers', 'x', 'v1', 'hero')),
            ),
          ),
        );
        expect(
          selector.select(asset, request(role: MediaDisplayRole.hero))!.slot,
          MediaVariantSlot.hero,
        );
        expect(
          selector
              .select(asset, request(role: MediaDisplayRole.thumbnail))!
              .slot,
          MediaVariantSlot.thumbnail,
        );
      },
    );

    test('with nothing measured, the nearest slot to the role is chosen', () {
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            card: variant(testMediaUrl('drivers', 'x', 'v1', 'card')),
            hero: variant(testMediaUrl('drivers', 'x', 'v1', 'hero')),
          ),
        ),
      );
      expect(
        selector.select(asset, request(role: MediaDisplayRole.thumbnail))!.slot,
        MediaVariantSlot.card,
      );
    });

    test('a width-only candidate is usable; height is not required', () {
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant(
              testMediaUrl('drivers', 'x', 'v1', 'thumbnail'),
              width: 160,
            ),
          ),
        ),
      );
      expect(selector.select(asset, request())!.width, 160);
    });

    test('a constrained height is honoured when the candidate reports one', () {
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant(
              testMediaUrl('drivers', 'x', 'v1', 'thumbnail'),
              width: 400,
              height: 40,
            ),
            card: variant(
              testMediaUrl('drivers', 'x', 'v1', 'card'),
              width: 400,
              height: 400,
            ),
          ),
        ),
      );
      final MediaSelection? s = selector.select(
        asset,
        request(width: 200, height: 200, dpr: 1),
      );
      expect(s!.height, 400);
    });
  });

  group('URL policy is applied before anything else', () {
    test('a malformed URL is never selected', () {
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant('not a url', width: 160, height: 160),
            card: variant(
              testMediaUrl('drivers', 'x', 'v1', 'card'),
              width: 480,
              height: 480,
            ),
          ),
        ),
      );
      expect(selector.select(asset, request())!.slot, MediaVariantSlot.card);
    });

    test('HTTP is rejected under the strict policy', () {
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant(
              'http://media.gridview.invalid/a.webp',
              width: 160,
              height: 160,
            ),
          ),
        ),
      );
      expect(selector.select(asset, request()), isNull);
    });

    test('embedded credentials are rejected', () {
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant(
              'https://u:p@media.gridview.invalid/a.webp',
              width: 160,
              height: 160,
            ),
          ),
        ),
      );
      expect(selector.select(asset, request()), isNull);
    });

    test('an unsupported scheme is rejected', () {
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant('file:///tmp/a.webp', width: 160, height: 160),
          ),
        ),
      );
      expect(selector.select(asset, request()), isNull);
    });

    test('loopback HTTP is selectable only with the development policy', () {
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant(
              'http://localhost:8080/a.webp',
              width: 160,
              height: 160,
            ),
          ),
        ),
      );
      expect(selector.select(asset, request()), isNull);
      expect(
        const MediaVariantSelector(
          policy: MediaUrlPolicy.developmentLoopback,
        ).select(asset, request()),
        isNotNull,
      );
    });

    test(
      'all candidates invalid yields null rather than a placeholder URL',
      () {
        final MediaPresentation asset = presentationOf(
          assetWithVariants(
            MediaVariants(
              thumbnail: variant('http://a.test/x.webp', width: 160),
              card: variant('ftp://a.test/x.webp', width: 480),
            ),
          ),
        );
        expect(selector.select(asset, request()), isNull);
      },
    );

    test('an asset with no variants yields null', () {
      expect(
        selector.select(
          presentationOf(assetWithVariants(const MediaVariants())),
          request(),
        ),
        isNull,
      );
    });
  });

  group('aspect ratio', () {
    test('rounding noise within tolerance is accepted', () {
      // 160x90 stores as 1.7778 against an intended 16/9; that is rounding, not
      // a different crop.
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant(
              testMediaUrl('drivers', 'x', 'v1', 'thumbnail'),
              width: 160,
              height: 90,
            ),
          ),
        ),
      );
      expect(
        selector.select(asset, request(width: 160, ratio: 16 / 9)),
        isNotNull,
      );
    });

    test(
      'a genuinely different crop is skipped when an alternative exists',
      () {
        final MediaPresentation asset = presentationOf(
          assetWithVariants(
            MediaVariants(
              thumbnail: variant(
                testMediaUrl('drivers', 'x', 'v1', 'thumbnail'),
                width: 160,
                height: 160,
              ),
              card: variant(
                testMediaUrl('drivers', 'x', 'v1', 'card'),
                width: 480,
                height: 270,
              ),
            ),
          ),
        );
        final MediaSelection? s = selector.select(
          asset,
          request(width: 160, ratio: 16 / 9),
        );
        expect(s!.slot, MediaVariantSlot.card);
      },
    );

    test('when every candidate is a different crop, one is still shown', () {
      // A slightly wrong crop beats a placeholder over a valid image.
      final MediaPresentation asset = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant(
              testMediaUrl('drivers', 'x', 'v1', 'thumbnail'),
              width: 160,
              height: 160,
            ),
          ),
        ),
      );
      expect(
        selector.select(asset, request(width: 160, ratio: 16 / 9)),
        isNotNull,
      );
    });

    test('the tolerance is the documented 2%', () {
      expect(kAspectRatioRoundingTolerance, 0.02);
    });
  });

  group('determinism', () {
    test('stored variant order cannot change the result', () {
      // The size comparator falls through to the slot rank, which is unique per
      // candidate, so the ordering is total.
      final MediaVariant a = variant(
        testMediaUrl('drivers', 'x', 'v1', 'card'),
        width: 480,
        height: 480,
      );
      final MediaVariant b = variant(
        testMediaUrl('drivers', 'x', 'v1', 'detail'),
        width: 480,
        height: 480,
      );

      final MediaPresentation forwards = presentationOf(
        assetWithVariants(MediaVariants(card: a, detail: b)),
      );
      final MediaPresentation backwards = presentationOf(
        assetWithVariants(MediaVariants(detail: b, card: a)),
      );
      expect(
        selector.select(forwards, request(width: 200))!.url,
        selector.select(backwards, request(width: 200))!.url,
      );
    });

    test('repeated selection is stable', () {
      final MediaPresentation asset = fullAsset();
      final MediaSelection? first = selector.select(asset, request());
      for (int i = 0; i < 5; i++) {
        expect(selector.select(asset, request())!.url, first!.url);
      }
    });

    test('version strings are never compared', () {
      // A lexical version sort would put "v10" before "v9"; nothing here sorts
      // by version at all, so both versions select the same slot.
      final MediaPresentation v9 = presentationOf(portraitAsset(version: 'v9'));
      final MediaPresentation v10 = presentationOf(
        portraitAsset(version: 'v10'),
      );
      expect(
        selector.select(v9, request())!.slot,
        selector.select(v10, request())!.slot,
      );
    });
  });

  group('cache identity', () {
    test('distinguishes asset, version and variant', () {
      final MediaSelection thumb = selector.select(fullAsset(), request())!;
      final MediaSelection hero = selector.select(
        fullAsset(),
        request(role: MediaDisplayRole.hero, width: 480, dpr: 3),
      )!;
      expect(thumb.cacheKey, isNot(hero.cacheKey));

      final MediaSelection v2 = selector.select(
        presentationOf(portraitAsset(version: 'v2')),
        request(),
      )!;
      // v1 and v2 of one asset must never share a cache entry.
      expect(thumb.cacheKey, isNot(v2.cacheKey));
    });

    test('changes when the URL changes even at the same version', () {
      final MediaPresentation moved = presentationOf(
        assetWithVariants(
          MediaVariants(
            thumbnail: variant(
              'https://other.invalid/a.webp',
              width: 160,
              height: 160,
            ),
          ),
        ),
      );
      expect(
        selector.select(moved, request())!.cacheKey,
        isNot(selector.select(fullAsset(), request())!.cacheKey),
      );
    });

    test('carries no display text', () {
      final MediaSelection s = selector.select(fullAsset(), request())!;
      expect(s.cacheKey, contains('test-shape-portrait-v1'));
      expect(s.cacheKey, contains('v1'));
      expect(s.cacheKey, contains('thumbnail'));
    });
  });
}
