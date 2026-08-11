/// Why a media URL was refused.
///
/// The reason is deliberately coarse and never carries the offending URL, so it
/// can be logged and asserted on without leaking a credential-bearing query
/// string or exposing anything to the user.
enum MediaUrlRejection {
  /// Empty or whitespace only.
  empty,

  /// Not parseable as a URI at all.
  malformed,

  /// Not an absolute URL, so it has no scheme to judge.
  notAbsolute,

  /// A scheme the media system will never load (`file`, `content`, `data`,
  /// `javascript`, `ftp`, and anything else outside the allow-list).
  unsupportedScheme,

  /// `http` where only `https` is acceptable.
  insecureScheme,

  /// No host, so there is nothing to connect to.
  missingHost,

  /// `user:password@host`, or credentials smuggled into the fragment.
  embeddedCredentials,

  /// Control characters or whitespace inside the URL, which is how request
  /// smuggling and log-injection attempts usually look.
  controlCharacters,
}

/// The rule that decides whether a media URL may be loaded at all.
///
/// Pure and synchronous: it performs no lookup, no request and no I/O, so it can
/// be applied to every candidate of every asset on the render path without cost,
/// and asserted exhaustively in tests.
///
/// Staging and production accept **HTTPS only**. There is no configuration that
/// makes arbitrary `http` acceptable: the single exception is loopback, and it
/// exists for local development and must be injected explicitly. Tests should
/// prefer a fake loader over relaxing this.
class MediaUrlPolicy {
  const MediaUrlPolicy({this.allowLoopbackHttp = false});

  /// The policy staging and production use: HTTPS, public syntax, nothing else.
  static const MediaUrlPolicy strict = MediaUrlPolicy();

  /// Development-only relaxation that additionally accepts `http` on loopback.
  /// Never selected by environment inference — a caller has to pass it.
  static const MediaUrlPolicy developmentLoopback = MediaUrlPolicy(
    allowLoopbackHttp: true,
  );

  /// Whether `http://localhost` and `http://127.0.0.1` are acceptable.
  final bool allowLoopbackHttp;

  static const Set<String> _loopbackHosts = <String>{
    'localhost',
    '127.0.0.1',
    '::1',
  };

  bool isAllowed(String? url) => rejectionFor(url) == null;

  /// The reason [url] is unacceptable, or `null` when it may be loaded.
  MediaUrlRejection? rejectionFor(String? url) {
    if (url == null) return MediaUrlRejection.empty;
    // Compare against the raw value: trimming first would silently accept a URL
    // that arrived with a leading newline, which is exactly the shape a log- or
    // header-injection attempt takes.
    if (url.trim().isEmpty) return MediaUrlRejection.empty;
    if (_hasControlCharacters(url)) return MediaUrlRejection.controlCharacters;

    final Uri? uri = Uri.tryParse(url);
    if (uri == null) return MediaUrlRejection.malformed;
    if (!uri.hasScheme || !uri.isAbsolute) return MediaUrlRejection.notAbsolute;

    final String scheme = uri.scheme.toLowerCase();
    if (scheme != 'https' && scheme != 'http') {
      return MediaUrlRejection.unsupportedScheme;
    }
    if (uri.host.isEmpty) return MediaUrlRejection.missingHost;
    // `userInfo` covers `user@host` and `user:password@host`. A fragment is
    // never sent to the server, so a credential placed there is both useless and
    // a strong signal the URL is not what it claims to be.
    if (uri.userInfo.isNotEmpty) return MediaUrlRejection.embeddedCredentials;
    if (uri.hasFragment && _looksLikeCredentials(uri.fragment)) {
      return MediaUrlRejection.embeddedCredentials;
    }
    if (scheme == 'http') {
      final bool loopback = _loopbackHosts.contains(uri.host.toLowerCase());
      if (!allowLoopbackHttp || !loopback) {
        return MediaUrlRejection.insecureScheme;
      }
    }
    return null;
  }

  static bool _hasControlCharacters(String value) {
    for (final int unit in value.codeUnits) {
      // C0 controls, space, and DEL. A space inside a URL is always an error at
      // this boundary: a legitimate URL arrives percent-encoded.
      if (unit <= 0x20 || unit == 0x7F) return true;
    }
    return false;
  }

  static bool _looksLikeCredentials(String fragment) {
    final String lower = fragment.toLowerCase();
    for (final String marker in const <String>[
      'password=',
      'passwd=',
      'token=',
      'secret=',
      'access_key=',
      'signature=',
    ]) {
      if (lower.contains(marker)) return true;
    }
    return false;
  }

  /// A diagnostics-safe description of [url]: scheme and host only.
  ///
  /// The path is reduced to a marker and the query and fragment are dropped
  /// entirely, because a media URL is the one place a signed-delivery token
  /// would appear. Nothing produced here is shown to a user; it exists so a
  /// failure can be logged without becoming a credential leak.
  static String describe(String? url) {
    if (url == null || url.trim().isEmpty) return '(empty)';
    final Uri? uri = Uri.tryParse(url);
    if (uri == null || !uri.isAbsolute || uri.host.isEmpty) {
      return '(unparseable)';
    }
    final String suffix = uri.path.isEmpty || uri.path == '/' ? '' : '/…';
    return '${uri.scheme}://${uri.host}$suffix';
  }
}
