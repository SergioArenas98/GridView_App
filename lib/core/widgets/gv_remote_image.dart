import 'dart:io';

import 'package:flutter/material.dart';

import '../media/media_image_loader.dart';
import '../media/media_load_outcome.dart';
import '../media/media_loader_scope.dart';
import '../theme/theme.dart';
import 'gv_image_placeholder.dart';

/// A remote image that always occupies its slot, whatever happens to the bytes.
///
/// Data-agnostic by construction: it accepts a validated URL and its cache
/// identity as primitives and knows nothing about `Driver`, `Constructor`,
/// `Circuit`, `GrandPrix`, `MediaAsset`, a repository, a Riverpod `Ref`, a Drift
/// row or a DTO. Selecting *which* image belongs here happened before this
/// widget was built.
///
/// [GvImagePlaceholder] remains the fallback for every state that is not a
/// rendered image — no request, loading, rejected URL, network failure, HTTP
/// failure, decode failure and a missing loader all resolve to the same stable
/// placeholder at the same size. There is no broken-image icon, no error text, no
/// exception, no URL and no identifier on screen, and a failure never touches the
/// surrounding text or navigation.
class GvRemoteImage extends StatefulWidget {
  const GvRemoteImage({
    super.key,
    required this.request,
    required this.aspectRatio,
    this.logicalWidth,
    this.fit = BoxFit.cover,
    this.placeholderIcon = Icons.image_outlined,
    this.borderRadius = GvRadii.mdAll,
    this.semanticLabel,
    this.decorative = false,
  });

  /// Markers for the three no-image states.
  ///
  /// All three render the same placeholder — a user must not be able to tell a
  /// failure from a slow load — so these exist purely so a test can assert which
  /// one was reached. They change no pixel and appear in no golden.
  static const ValueKey<String> noMediaPlaceholderKey = ValueKey<String>(
    'gv-remote-image-none',
  );
  static const ValueKey<String> pendingPlaceholderKey = ValueKey<String>(
    'gv-remote-image-pending',
  );
  static const ValueKey<String> failedPlaceholderKey = ValueKey<String>(
    'gv-remote-image-failed',
  );

  /// The image to show, or `null` when no suitable media exists. `null` is an
  /// ordinary state, not an error: the placeholder is the correct rendering.
  final MediaImageRequest? request;

  /// The ratio the slot reserves. Held identically in every state, which is what
  /// guarantees no layout shift when bytes arrive or fail to.
  final double aspectRatio;

  /// The width the image will occupy, when the caller knows it. Used only to size
  /// the decode; layout is driven by the parent and [aspectRatio].
  final double? logicalWidth;

  final BoxFit fit;

  /// The placeholder glyph for this slot's category.
  final IconData placeholderIcon;

  final BorderRadius borderRadius;

  /// Localized description, for an image that carries information the adjacent
  /// text does not. Never an id, a filename, a URL or a category token.
  final String? semanticLabel;

  /// Whether the image is purely decorative, in which case it is removed from the
  /// semantics tree entirely so a screen reader does not announce it twice.
  final bool decorative;

  @override
  State<GvRemoteImage> createState() => _GvRemoteImageState();
}

class _GvRemoteImageState extends State<GvRemoteImage> {
  /// The cache key of the load that is in flight or has completed, so an
  /// ordinary rebuild — a scroll, a theme change, a parent setState — never
  /// starts the same download again. Only a genuinely different image does.
  String? _loadedKey;
  File? _file;
  bool _failed = false;

  /// Whether the bytes came off disk. A cached hit appears immediately and skips
  /// the fade, so scrolling back to a row does not replay an animation.
  bool _wasCached = false;

  /// Guards against a late completion writing state for a superseded request or
  /// after disposal.
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(GvRemoteImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.request?.cacheKey != widget.request?.cacheKey) _sync();
  }

  void _sync() {
    final MediaImageRequest? request = widget.request;
    if (request == null) {
      setState(() {
        _loadedKey = null;
        _file = null;
        _failed = false;
      });
      return;
    }
    if (_loadedKey == request.cacheKey) return;
    _loadedKey = request.cacheKey;
    _file = null;
    _failed = false;
    // Deferred to the first frame: `dependOnInheritedWidgetOfExactType` is not
    // available from initState, and reading the loader lazily also means a slot
    // that never becomes visible never resolves one.
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolve(request));
  }

  Future<void> _resolve(MediaImageRequest request) async {
    if (!mounted) return;
    final MediaImageLoader? loader = MediaLoaderScope.maybeOf(context);
    // No loader: render the placeholder and request nothing.
    if (loader == null) return;

    final int generation = ++_generation;
    bool isCurrent() =>
        mounted &&
        generation == _generation &&
        widget.request?.cacheKey == request.cacheKey;

    final File? cached = await loader.cached(request);
    if (cached != null) {
      if (!isCurrent()) return;
      setState(() {
        _file = cached;
        _wasCached = true;
        _failed = false;
      });
      return;
    }

    final MediaLoadOutcome outcome = await loader.load(request);
    if (!isCurrent()) return;
    switch (outcome) {
      case MediaLoaded(:final File file):
        setState(() {
          _file = file;
          _wasCached = false;
          _failed = false;
        });
      case MediaLoadFailed():
        // A failure is a presentation fallback and nothing more: no retry loop,
        // no domain change, no page-level error.
        setState(() {
          _file = null;
          _failed = true;
        });
      case MediaLoadCancelled():
        // Not a failure. Leave the placeholder and record nothing.
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final Widget content = AspectRatio(
      aspectRatio: widget.aspectRatio,
      child: ClipRRect(
        borderRadius: widget.borderRadius,
        child: _body(context),
      ),
    );
    if (widget.decorative) return ExcludeSemantics(child: content);
    // An informative image is announced once, by its own label. There is no
    // "loading image" announcement: a placeholder that has not resolved yet has
    // nothing useful to say, and saying it on every rebuild would flood the
    // screen reader.
    return Semantics(
      label: widget.semanticLabel,
      image: true,
      child: ExcludeSemantics(child: content),
    );
  }

  Widget _body(BuildContext context) {
    final File? file = _file;
    if (file == null) return _placeholder();

    final double? cacheWidth = _decodeWidth(context);
    final Widget image = Image.file(
      file,
      key: ValueKey<String>(_loadedKey ?? ''),
      fit: widget.fit,
      width: double.infinity,
      height: double.infinity,
      // Decode close to the display size rather than at full resolution, so a
      // 40px row never keeps detail-resolution pixels in memory.
      cacheWidth: cacheWidth?.round(),
      // A decode failure is just another way of having no image.
      errorBuilder: (_, _, _) => _placeholder(),
      // Frames arriving from disk are already decoded quickly; a cached hit is
      // shown immediately so scrolling back does not replay a fade.
      gaplessPlayback: true,
    );

    if (_wasCached || MediaQuery.disableAnimationsOf(context)) return image;
    return _FadeIn(child: image);
  }

  /// The physical width to decode at, or `null` when the slot's width is unknown
  /// and the full stored size is the only safe choice.
  double? _decodeWidth(BuildContext context) {
    final double? width = widget.logicalWidth;
    if (width == null || width <= 0) return null;
    return width * MediaQuery.devicePixelRatioOf(context);
  }

  Widget _placeholder() => GvImagePlaceholder(
    // The three placeholder states render identically — that is the point, since
    // a user must not be able to tell a failure from a slow load. The key makes
    // them distinguishable to a test without changing a single pixel, so
    // "fell back after an error" can be asserted separately from "still
    // loading" and from "there was never any media".
    key: _placeholderKey,
    aspectRatio: widget.aspectRatio,
    icon: widget.placeholderIcon,
    borderRadius: widget.borderRadius,
  );

  ValueKey<String> get _placeholderKey {
    if (widget.request == null) return GvRemoteImage.noMediaPlaceholderKey;
    return _failed
        ? GvRemoteImage.failedPlaceholderKey
        : GvRemoteImage.pendingPlaceholderKey;
  }
}

/// Fades a freshly downloaded image in, without moving anything.
///
/// Opacity only: the layout box is already final, so the fade cannot cause a
/// shift. It plays once per newly downloaded image and never for a cached hit.
class _FadeIn extends StatelessWidget {
  const _FadeIn({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween<double>(begin: 0, end: 1),
    duration: GvMotion.fast,
    curve: GvMotion.standard,
    builder: (BuildContext context, double value, Widget? built) =>
        Opacity(opacity: value, child: built),
    child: child,
  );
}
