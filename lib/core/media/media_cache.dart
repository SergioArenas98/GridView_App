import 'dart:io';

import 'package:flutter_cache_manager/flutter_cache_manager.dart';

/// How long an unused cached image is kept.
///
/// Chosen against the product's own cadence rather than picked round: Grand Prix
/// weekends are roughly a fortnight apart, so 30 days keeps the imagery of the
/// events and competitors a user actually follows warm across at least two
/// weekends, while an image untouched for a month is cheap to fetch again.
const Duration kMediaCacheStalePeriod = Duration(days: 30);

/// The maximum number of cached image objects.
///
/// Derived from the expected v1 inventory: about 24 driver portraits, 10 team
/// marks, 24 circuit layouts and 24 event heroes is ~82 assets, and a device
/// that visits both a list and a detail screen caches up to three variants of
/// each, so ~250 objects. 400 leaves headroom for a season boundary, where two
/// seasons' imagery is briefly resident, without letting the cache grow without
/// limit.
const int kMediaCacheMaxObjects = 400;

/// The cache namespace. One namespace for the whole application, so there is
/// exactly one disk-cache owner and no feature can create a second store.
const String kMediaCacheKey = 'gridview_media';

/// One cached image file.
class CachedMediaFile {
  const CachedMediaFile(this.file);

  final File file;
}

/// The only disk cache for image bytes.
///
/// Image bytes never enter Drift, and this is the single owner of the bytes that
/// do get stored. Widgets never construct a [CacheManager]: they talk to a
/// loader, which talks to this.
///
/// Deliberately narrow. It exposes a cache-only read and a cache-or-fetch read
/// and nothing else — in particular no "clear everything", because one failed
/// image must never be able to discard every other cached image, and Phase 8B
/// ships no user-facing cache-clearing control.
abstract interface class MediaCache {
  /// The file already on disk for [cacheKey], or `null` when nothing is stored.
  ///
  /// Never performs a request. This is what makes an offline reopen provable:
  /// a cached image renders with zero network calls.
  Future<CachedMediaFile?> cached(String cacheKey);

  /// The cached file when present, otherwise one download of [url] stored under
  /// [cacheKey].
  ///
  /// Exactly one request per miss. There is no retry loop here: a failure throws
  /// and the loader maps it to a controlled outcome.
  Future<CachedMediaFile> resolve({
    required String url,
    required String cacheKey,
  });
}

/// [MediaCache] backed by `flutter_cache_manager`.
///
/// The package was already declared for this purpose and is now genuinely the
/// implementation, rather than a dependency with no call sites. It is used
/// directly instead of adding `cached_network_image`, because everything the
/// product needs — persistent disk storage, request de-duplication for the same
/// key, and eviction — is already here, and a second package would mean a second
/// cache store to reason about.
///
/// **Only two limits are enforced, because only two are enforceable.**
/// `Config` accepts `stalePeriod` and `maxNrOfCacheObjects` and nothing else:
/// there is no maximum-bytes setting in the package, so none is claimed. Size is
/// bounded indirectly, through the object count and through variant selection
/// never fetching a hero for a row.
class FlutterCacheManagerMediaCache implements MediaCache {
  FlutterCacheManagerMediaCache({CacheManager? manager})
    : _manager = manager ?? _shared;

  /// The one shared application instance. A single namespace means a single
  /// store: two managers over the same directory would each believe they owned
  /// eviction.
  static final CacheManager _shared = CacheManager(
    Config(
      kMediaCacheKey,
      stalePeriod: kMediaCacheStalePeriod,
      maxNrOfCacheObjects: kMediaCacheMaxObjects,
    ),
  );

  final CacheManager _manager;

  @override
  Future<CachedMediaFile?> cached(String cacheKey) async {
    final FileInfo? info = await _manager.getFileFromCache(cacheKey);
    if (info == null) return null;
    return CachedMediaFile(info.file);
  }

  @override
  Future<CachedMediaFile> resolve({
    required String url,
    required String cacheKey,
  }) async {
    // `getSingleFile` returns the stored file when it is still valid and
    // otherwise performs a single download. The package's own queue coalesces
    // concurrent requests for the same key, so a rebuilding list does not start
    // the same download twice.
    final File file = await _manager.getSingleFile(url, key: cacheKey);
    return CachedMediaFile(file);
  }
}
