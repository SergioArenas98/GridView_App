import 'dart:async';
import 'dart:io';

import 'media_cache.dart';
import 'media_load_outcome.dart';

/// A validated URL plus the immutable identity it is cached under.
///
/// Primitives only: the loader and the image component never see a domain
/// entity, a Drift row or a DTO. The [cacheKey] is built by the selector, which
/// is the layer that knows the asset, its version and the variant.
class MediaImageRequest {
  const MediaImageRequest({required this.url, required this.cacheKey});

  /// Already accepted by `MediaUrlPolicy`. The loader does not re-validate.
  final String url;

  final String cacheKey;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MediaImageRequest &&
          other.url == url &&
          other.cacheKey == cacheKey;

  @override
  int get hashCode => Object.hash(url, cacheKey);
}

/// The boundary between the image component and the cache/network.
///
/// One shared, data-agnostic service — not a provider per image and not a
/// repository per row. It performs the HTTPS request for image bytes and nothing
/// else: it never calls `GridViewApi`, a Dio repository, `AppSyncCoordinator`, a
/// detail refresh or a content-manifest refresh. Media binary delivery is a
/// separate system from GridView JSON synchronisation, and this type is where
/// that separation is enforced.
abstract interface class MediaImageLoader {
  /// Bytes already on disk, or `null` when nothing is cached. No request.
  Future<File?> cached(MediaImageRequest request);

  /// Cached bytes, else exactly one fetch.
  ///
  /// Never throws: every failure mode becomes a [MediaLoadOutcome], so a package
  /// exception cannot escape into a widget's build.
  Future<MediaLoadOutcome> load(MediaImageRequest request);
}

/// The production loader: a thin, exception-mapping layer over [MediaCache].
class CachedMediaImageLoader implements MediaImageLoader {
  CachedMediaImageLoader(this._cache);

  final MediaCache _cache;

  @override
  Future<File?> cached(MediaImageRequest request) async {
    try {
      return (await _cache.cached(request.cacheKey))?.file;
    } on Object {
      // A cache read that fails is reported as "nothing cached". The caller then
      // decides whether to fetch; it must not crash because a cache index was
      // unreadable.
      return null;
    }
  }

  @override
  Future<MediaLoadOutcome> load(MediaImageRequest request) async {
    try {
      final CachedMediaFile file = await _cache.resolve(
        url: request.url,
        cacheKey: request.cacheKey,
      );
      return MediaLoaded(file: file.file, fromCache: false);
    } on SocketException {
      return const MediaLoadFailed(MediaFailureKind.network);
    } on TimeoutException {
      return const MediaLoadFailed(MediaFailureKind.network);
    } on HttpException {
      return const MediaLoadFailed(MediaFailureKind.http);
    } on FileSystemException {
      return const MediaLoadFailed(MediaFailureKind.cacheWrite);
    } on Object catch (error) {
      // `flutter_cache_manager` raises its own `HttpExceptionWithStatus` for a
      // non-2xx response. It is matched structurally rather than by import so
      // this file does not depend on a package-private type, and so an unknown
      // package error still becomes a controlled outcome instead of escaping.
      final String name = error.runtimeType.toString();
      if (name.contains('HttpException')) {
        return const MediaLoadFailed(MediaFailureKind.http);
      }
      return const MediaLoadFailed(MediaFailureKind.unknown);
    }
  }
}
