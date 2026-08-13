import 'package:flutter/widgets.dart';

import '../../../core/media/media_image_loader.dart';
import '../domain/entities/enums.dart';
import '../domain/media/media_presentation.dart';
import '../domain/media/media_variant_selector.dart';

/// The single place a feature widget turns "this owner's media" into "this exact
/// image request".
///
/// It exists so the DPR-aware size decision happens where the real rendered size
/// is known — inside `build`, with a `BuildContext` — while the decision itself
/// stays in the pure selector. The widget contributes measurements; it does not
/// contribute policy.
///
/// Returns `null` whenever there is nothing loadable: no media, nothing in an
/// accepted category, or no variant with an acceptable URL. `null` is the normal
/// "render the placeholder" answer, never an error.
MediaImageRequest? resolveMediaSlot(
  BuildContext context, {
  required EntityMedia? media,
  required List<MediaCategory> preference,
  required MediaDisplayRole role,
  required double logicalWidth,
  double? logicalHeight,
  double? intendedAspectRatio,
  MediaVariantSelector selector = const MediaVariantSelector(),
}) {
  final MediaPresentation? asset = media?.preferred(preference);
  if (asset == null) return null;
  return requestForAsset(
    context,
    asset: asset,
    role: role,
    logicalWidth: logicalWidth,
    logicalHeight: logicalHeight,
    intendedAspectRatio: intendedAspectRatio,
    selector: selector,
  );
}

/// [resolveMediaSlot] for a caller that has already chosen the asset — the Grand
/// Prix hero, which resolves its own owner first because it may legitimately draw
/// on either the event or the circuit.
MediaImageRequest? requestForAsset(
  BuildContext context, {
  required MediaPresentation asset,
  required MediaDisplayRole role,
  required double logicalWidth,
  double? logicalHeight,
  double? intendedAspectRatio,
  MediaVariantSelector selector = const MediaVariantSelector(),
}) {
  final MediaSelection? selection = selector.select(
    asset,
    MediaSelectionRequest(
      role: role,
      logicalWidth: logicalWidth,
      logicalHeight: logicalHeight,
      // The real device density, so the physical target is measured rather than
      // assumed. A 40px row on a 3x screen needs 120 physical pixels, not 40.
      devicePixelRatio: MediaQuery.devicePixelRatioOf(context),
      intendedAspectRatio: intendedAspectRatio,
    ),
  );
  if (selection == null) return null;
  return MediaImageRequest(url: selection.url, cacheKey: selection.cacheKey);
}
