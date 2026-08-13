import 'dart:io';

import 'package:gridview/core/media/media_image_loader.dart';
import 'package:gridview/core/media/media_load_outcome.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/media/media_presentation.dart';

/// Deterministic media fixtures.
///
/// Every URL uses a reserved, non-routable test host and every image is
/// generated: no third-party asset, no provider URL and nothing that could be
/// mistaken for real Formula 1 media appears anywhere in the test suite.
const String kTestMediaHost = 'https://media.gridview.invalid';

String testMediaUrl(
  String owner,
  String id,
  String version,
  String variant, {
  String extension = 'webp',
}) => '$kTestMediaHost/media/$owner/$id/$version/$variant.$extension';

MediaVariant variant(String url, {int? width, int? height}) =>
    MediaVariant(url: url, width: width, height: height);

/// A driver portrait with all four variants at square sizes.
MediaAsset portraitAsset({
  String id = 'test-shape-portrait-v1',
  String owner = 'test-shape',
  String version = 'v1',
  MediaEntityType entityType = MediaEntityType.driver,
  MediaCategory category = MediaCategory.portrait,
  String? attribution = 'GridView synthetic fixture',
  String? license = 'GridView-owned synthetic fixture',
}) => MediaAsset(
  id: id,
  entityType: entityType,
  entityId: owner,
  category: category,
  format: MediaFormat.webp,
  version: version,
  aspectRatio: 1,
  attribution: attribution,
  license: license,
  fallbackCategory: category.wire,
  variants: MediaVariants(
    thumbnail: variant(
      testMediaUrl('drivers', owner, version, 'thumbnail'),
      width: 160,
      height: 160,
    ),
    card: variant(
      testMediaUrl('drivers', owner, version, 'card'),
      width: 480,
      height: 480,
    ),
    detail: variant(
      testMediaUrl('drivers', owner, version, 'detail'),
      width: 960,
      height: 960,
    ),
    hero: variant(
      testMediaUrl('drivers', owner, version, 'hero'),
      width: 1440,
      height: 1440,
    ),
  ),
);

/// An asset with exactly the variants supplied, for selector tests.
MediaAsset assetWithVariants(
  MediaVariants variants, {
  String id = 'test-shape-portrait-v1',
  String owner = 'test-shape',
  String version = 'v1',
  MediaEntityType entityType = MediaEntityType.driver,
  MediaCategory category = MediaCategory.portrait,
  double? aspectRatio,
}) => MediaAsset(
  id: id,
  entityType: entityType,
  entityId: owner,
  category: category,
  format: MediaFormat.webp,
  version: version,
  aspectRatio: aspectRatio,
  variants: variants,
);

MediaPresentation presentationOf(
  MediaAsset asset, {
  MediaEntityType? ownerType,
  String? ownerId,
}) => mediaPresentationFrom(
  asset,
  ownerType: ownerType ?? asset.entityType,
  ownerId: ownerId ?? asset.entityId ?? 'test-shape',
);

EntityMedia entityMediaOf(
  List<MediaAsset> assets, {
  MediaEntityType ownerType = MediaEntityType.driver,
  String ownerId = 'test-shape',
}) => EntityMedia.from(ownerType, ownerId, assets);

/// A [MediaImageLoader] that never touches the network or the disk cache.
///
/// It counts calls, so a test can prove exactly how many fetches a screen
/// caused — which is how "a rebuild issues no duplicate request", "a cached
/// image reopens with zero network calls" and "a failure is not retried" are
/// asserted rather than assumed.
class FakeMediaImageLoader implements MediaImageLoader {
  FakeMediaImageLoader({
    this.cachedFiles = const <String, File>{},
    this.loadedFiles = const <String, File>{},
    this.failures = const <String, MediaFailureKind>{},
    this.cancelled = const <String>{},
  });

  /// Files already on disk, keyed by cache key.
  final Map<String, File> cachedFiles;

  /// Files a fetch would produce, keyed by cache key.
  final Map<String, File> loadedFiles;

  /// Cache keys whose fetch fails, and how.
  final Map<String, MediaFailureKind> failures;

  /// Cache keys whose fetch is cancelled.
  final Set<String> cancelled;

  final List<String> cacheProbes = <String>[];
  final List<String> fetches = <String>[];

  /// Requests that reached the loader at all. A rejected URL must never appear.
  Iterable<String> get requestedUrls => _urls;
  final List<String> _urls = <String>[];

  @override
  Future<File?> cached(MediaImageRequest request) async {
    cacheProbes.add(request.cacheKey);
    _urls.add(request.url);
    return cachedFiles[request.cacheKey];
  }

  @override
  Future<MediaLoadOutcome> load(MediaImageRequest request) async {
    fetches.add(request.cacheKey);
    _urls.add(request.url);
    if (cancelled.contains(request.cacheKey)) {
      return const MediaLoadCancelled();
    }
    final MediaFailureKind? failure = failures[request.cacheKey];
    if (failure != null) return MediaLoadFailed(failure);
    final File? file = loadedFiles[request.cacheKey];
    if (file == null) {
      return const MediaLoadFailed(MediaFailureKind.network);
    }
    return MediaLoaded(file: file, fromCache: false);
  }
}
