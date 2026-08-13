import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/media/media_cache.dart';
import 'package:gridview/core/media/media_image_loader.dart';
import 'package:gridview/core/media/media_load_outcome.dart';

import '../support/synthetic_png.dart';

/// A [MediaCache] whose every behaviour is scripted, so the loader's mapping
/// from "the package threw X" to "the outcome is Y" can be asserted exactly.
///
/// No internet, no real cache manager, no filesystem beyond a temporary file.
///
/// It deliberately throws non-Error, non-Exception values as well: the whole
/// point of the loader is that *anything* a package throws becomes a controlled
/// outcome, so the test has to be able to throw the awkward cases.
// ignore_for_file: only_throw_errors
class ScriptedCache implements MediaCache {
  ScriptedCache({
    this.cachedFile,
    this.resolved,
    this.onResolve,
    this.onCached,
  });

  File? cachedFile;
  File? resolved;
  Object? Function()? onResolve;
  Object? Function()? onCached;

  int cachedCalls = 0;
  int resolveCalls = 0;

  @override
  Future<CachedMediaFile?> cached(String cacheKey) async {
    cachedCalls += 1;
    final Object? error = onCached?.call();
    if (error != null) throw error;
    final File? file = cachedFile;
    return file == null ? null : CachedMediaFile(file);
  }

  @override
  Future<CachedMediaFile> resolve({
    required String url,
    required String cacheKey,
  }) async {
    resolveCalls += 1;
    final Object? error = onResolve?.call();
    if (error != null) throw error;
    return CachedMediaFile(resolved!);
  }
}

void main() {
  late Directory tmp;
  late File image;

  setUp(() {
    tmp = Directory.systemTemp.createTempSync('gv_media_loader');
    image = writePng(tmp, 'a.png', bandedPng(8, 8));
  });

  tearDown(() {
    if (tmp.existsSync()) tmp.deleteSync(recursive: true);
  });

  const MediaImageRequest request = MediaImageRequest(
    url: 'https://media.gridview.invalid/media/drivers/x/v1/thumbnail.webp',
    cacheKey: 'x|v1|thumbnail|https://media.gridview.invalid/a.webp',
  );

  group('cache reads', () {
    test('a cache hit returns the file without any fetch', () async {
      final ScriptedCache cache = ScriptedCache(cachedFile: image);
      final CachedMediaImageLoader loader = CachedMediaImageLoader(cache);

      expect((await loader.cached(request))!.path, image.path);
      expect(cache.resolveCalls, 0);
    });

    test('a cache miss reports nothing rather than fetching', () async {
      final ScriptedCache cache = ScriptedCache();
      expect(await CachedMediaImageLoader(cache).cached(request), isNull);
      expect(cache.resolveCalls, 0);
    });

    test(
      'a cache read failure degrades to a miss instead of throwing',
      () async {
        // An unreadable cache index must not crash a build; the caller then
        // decides whether to fetch.
        final ScriptedCache cache = ScriptedCache(
          onCached: () => const FileSystemException('index unreadable'),
        );
        expect(await CachedMediaImageLoader(cache).cached(request), isNull);
      },
    );
  });

  group('fetches', () {
    test('a miss performs exactly one fetch', () async {
      final ScriptedCache cache = ScriptedCache(resolved: image);
      final MediaLoadOutcome outcome = await CachedMediaImageLoader(
        cache,
      ).load(request);

      expect(outcome, isA<MediaLoaded>());
      expect((outcome as MediaLoaded).file.path, image.path);
      expect(cache.resolveCalls, 1);
    });

    test('a failure is not retried inside the loader', () async {
      // No retry loop: one request, one answer. Retrying is a decision for a
      // caller with context, not something the boundary does silently.
      final ScriptedCache cache = ScriptedCache(
        onResolve: () => const SocketException('offline'),
      );
      final CachedMediaImageLoader loader = CachedMediaImageLoader(cache);

      await loader.load(request);
      expect(cache.resolveCalls, 1);
    });
  });

  group('every failure becomes a controlled outcome', () {
    Future<MediaFailureKind> kindFor(Object error) async {
      final MediaLoadOutcome outcome = await CachedMediaImageLoader(
        ScriptedCache(onResolve: () => error),
      ).load(request);
      return (outcome as MediaLoadFailed).kind;
    }

    test('a socket failure is a network failure', () async {
      expect(
        await kindFor(const SocketException('no route')),
        MediaFailureKind.network,
      );
    });

    test('a timeout is a network failure', () async {
      expect(await kindFor(TimeoutException('slow')), MediaFailureKind.network);
    });

    test('an HTTP error is an HTTP failure', () async {
      expect(await kindFor(const HttpException('404')), MediaFailureKind.http);
    });

    test('a package HTTP error is recognised structurally', () async {
      // `flutter_cache_manager` raises its own HttpExceptionWithStatus, matched
      // without importing a package-private type.
      expect(await kindFor(_HttpExceptionWithStatus()), MediaFailureKind.http);
    });

    test('a filesystem failure is a cache-write failure', () async {
      expect(
        await kindFor(const FileSystemException('disk full')),
        MediaFailureKind.cacheWrite,
      );
    });

    test(
      'anything unclassifiable is still an outcome, never an exception',
      () async {
        // The guarantee that matters: a package exception cannot escape into a
        // widget build.
        expect(await kindFor(StateError('surprise')), MediaFailureKind.unknown);
        expect(await kindFor('a bare string'), MediaFailureKind.unknown);
      },
    );
  });

  group('cache policy', () {
    test('declares only the limits the package can enforce', () {
      // `Config` accepts a stale period and a maximum object count and nothing
      // else. There is no maximum-bytes setting, so none is claimed.
      expect(kMediaCacheStalePeriod, const Duration(days: 30));
      expect(kMediaCacheMaxObjects, 400);
    });

    test('uses one application-wide namespace', () {
      expect(kMediaCacheKey, 'gridview_media');
    });
  });
}

/// Stands in for the cache package's own status-bearing HTTP exception.
class _HttpExceptionWithStatus implements Exception {}
