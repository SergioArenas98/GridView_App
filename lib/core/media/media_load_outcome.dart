import 'dart:io';

/// Why a media load did not produce bytes.
///
/// Every value is a *media* outcome. None of them is a domain condition: no
/// value here may ever make a screen partial, mark a resource stale, or trigger
/// a refresh of anything.
enum MediaFailureKind {
  /// The URL failed [MediaUrlPolicy] and was never requested. It never reaches
  /// the cache and is never retried, because nothing about it will change.
  rejectedUrl,

  /// The device could not reach the host — offline, DNS, timeout.
  network,

  /// The host answered with an error status.
  http,

  /// The cache could not be read. Treated as a miss that failed rather than as a
  /// miss, so it is visible in diagnostics.
  cacheRead,

  /// The bytes arrived but could not be stored. The image may still render; only
  /// the persistence of it is lost.
  cacheWrite,

  /// Anything the loader could not classify. Package exceptions are mapped here
  /// rather than escaping.
  unknown,
}

/// The result of asking the loader for one image.
sealed class MediaLoadOutcome {
  const MediaLoadOutcome();
}

/// Bytes are available on disk at [file].
class MediaLoaded extends MediaLoadOutcome {
  const MediaLoaded({required this.file, required this.fromCache});

  final File file;

  /// Whether this came from disk without a request. Used by tests to prove an
  /// offline reopen issues no network call.
  final bool fromCache;
}

/// No bytes. [kind] is safe to log; it carries no URL.
class MediaLoadFailed extends MediaLoadOutcome {
  const MediaLoadFailed(this.kind);

  final MediaFailureKind kind;
}

/// The load was abandoned because the caller went away — a row scrolled off, a
/// widget was disposed, a route was popped.
///
/// Deliberately **not** a failure: it is the expected outcome of ordinary
/// scrolling, so it is never logged as an error and never shows an error state.
class MediaLoadCancelled extends MediaLoadOutcome {
  const MediaLoadCancelled();
}
