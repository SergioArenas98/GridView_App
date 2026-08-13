import 'package:flutter/widgets.dart';

import 'media_image_loader.dart';

/// Supplies the one shared [MediaImageLoader] to the image components below it.
///
/// An inherited boundary rather than a provider-per-image: the loader is
/// data-agnostic and stateless from the widget tree's point of view, so a single
/// instance serves every slot on every screen.
///
/// A subtree with no scope renders placeholders and issues **no request**. That
/// is deliberate: it means a widget test can never accidentally reach the
/// network, and a forgotten scope degrades to the stable fallback instead of
/// throwing. The debug assertion in [maybeOf] keeps the mistake loud while
/// developing without making it fatal in release.
class MediaLoaderScope extends InheritedWidget {
  const MediaLoaderScope({
    super.key,
    required this.loader,
    required super.child,
  });

  final MediaImageLoader loader;

  /// The loader for this subtree, or `null` when none is installed.
  static MediaImageLoader? maybeOf(BuildContext context) {
    final MediaLoaderScope? scope = context
        .dependOnInheritedWidgetOfExactType<MediaLoaderScope>();
    assert(() {
      if (scope == null) {
        debugPrint(
          'GridView: no MediaLoaderScope above this remote image; it will '
          'render its placeholder and request nothing. Install one at the app '
          'root, or inject a fake loader in tests.',
        );
      }
      return true;
    }());
    return scope?.loader;
  }

  @override
  bool updateShouldNotify(MediaLoaderScope oldWidget) =>
      oldWidget.loader != loader;
}
