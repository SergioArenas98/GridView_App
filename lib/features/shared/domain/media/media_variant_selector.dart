import 'media_presentation.dart';
import 'media_url_policy.dart';

/// How large an image will actually be rendered.
///
/// This is a *display* role, not a variant name. It exists so a caller states
/// what it is drawing ("a 40px row thumbnail") rather than guessing which stored
/// variant it wants, which is what makes it impossible for a list row to ask for
/// a hero file.
enum MediaDisplayRole {
  thumbnail(MediaVariantSlot.thumbnail),
  card(MediaVariantSlot.card),
  detail(MediaVariantSlot.detail),
  hero(MediaVariantSlot.hero);

  const MediaDisplayRole(this.preferredSlot);

  /// The slot whose name matches this role. Used only for tie-breaking and for
  /// the unmeasured fallback — never to override a measured dimension.
  final MediaVariantSlot preferredSlot;
}

/// What to render: one validated URL and the dimensions it was chosen on.
class MediaSelection {
  const MediaSelection({
    required this.url,
    required this.slot,
    required this.mediaId,
    required this.version,
    this.width,
    this.height,
  });

  /// A URL that has already passed [MediaUrlPolicy]. The loader may use it as-is.
  final String url;

  final MediaVariantSlot slot;

  /// Internal identity of the chosen asset, for cache keying and diagnostics.
  /// Never displayed.
  final String mediaId;

  /// The asset's immutable version, so the cache identity changes when the
  /// publication does.
  final String version;

  final int? width;
  final int? height;

  /// Whether the choice was made on measured dimensions rather than on a name.
  bool get wasMeasured => (width ?? 0) > 0;

  /// The immutable identity this image is cached under.
  ///
  /// Composite rather than the bare URL, so the three things that must never
  /// share a cache entry are distinguished by construction rather than by
  /// trusting a URL to have the right shape: the asset, its immutable version
  /// and the variant. `v1` and `v2` of one asset therefore cannot collide, and
  /// neither can a thumbnail and a hero.
  ///
  /// The URL is part of the key as well, so republishing an asset to a different
  /// URL without bumping its version still produces a distinct entry instead of
  /// serving superseded bytes. Nothing localized and nothing display-derived
  /// appears here — only immutable identity.
  String get cacheKey => '$mediaId|$version|${slot.wire}|$url';
}

/// What the caller is about to draw.
class MediaSelectionRequest {
  const MediaSelectionRequest({
    required this.role,
    required this.logicalWidth,
    required this.devicePixelRatio,
    this.logicalHeight,
    this.intendedAspectRatio,
  });

  final MediaDisplayRole role;

  /// The width the image will occupy in logical pixels.
  final double logicalWidth;

  /// The height in logical pixels, when the slot constrains it. Null means the
  /// height follows from the aspect ratio and is not a selection constraint.
  final double? logicalHeight;

  /// The device pixel ratio the image will be rasterised at.
  final double devicePixelRatio;

  /// The ratio the slot expects, when it has one. Used only to reject a
  /// genuinely incompatible crop — see [kAspectRatioRoundingTolerance].
  final double? intendedAspectRatio;

  /// The physical width the image must cover.
  double get targetWidth => logicalWidth * devicePixelRatio;

  /// The physical height the image must cover, when constrained.
  double? get targetHeight =>
      logicalHeight == null ? null : logicalHeight! * devicePixelRatio;
}

/// How far a candidate's own ratio may differ from the slot's intended ratio
/// before it is treated as a different crop rather than the same image.
///
/// Derived, not guessed. Variant dimensions are integers, so a stored ratio is
/// already rounded: for a candidate whose long edge is the smallest the
/// processing pipeline emits (160px), the worst-case rounding error is
/// `0.5/159.5 + 0.5/39.5 ≈ 1.6%` for the most extreme 4:1 crop at that size.
/// 2% therefore covers integer rounding for every variant the pipeline can
/// produce, while anything beyond it is a real difference in framing.
///
/// This is unrelated to the golden comparator's 2% pixel tolerance; the two
/// numbers coincide by arithmetic accident and are not linked.
const double kAspectRatioRoundingTolerance = 0.02;

/// Chooses which stored variant to load, or decides that none may be.
///
/// Pure: no request, no cache read, no widget work, no clock. Given the same
/// asset and request it always returns the same selection, and the order the
/// variants happen to be stored in cannot change the answer — every comparison
/// falls through to the slot rank, which is unique per candidate.
class MediaVariantSelector {
  const MediaVariantSelector({this.policy = MediaUrlPolicy.strict});

  /// The URL rule applied before a candidate is considered at all. A rejected
  /// URL is never selected, never returned and never reaches the cache.
  final MediaUrlPolicy policy;

  /// The variant to render for [request], or `null` when the asset offers
  /// nothing loadable.
  ///
  /// Order of preference:
  ///
  /// 1. Candidates with a policy-valid URL and, when the slot states one, a
  ///    compatible aspect ratio.
  /// 2. Among those, measured candidates adequate for the physical target — the
  ///    **smallest** such candidate, so a 40px row never downloads a hero.
  /// 3. When no measured candidate is adequate, the **largest** measured
  ///    candidate, because an undersized image still beats no image.
  /// 4. When nothing is measured at all, the unmeasured candidate closest to the
  ///    role's own slot. Unknown dimensions are never assumed adequate; this is
  ///    an explicit last resort, not a size judgement.
  /// 5. Otherwise `null`.
  ///
  /// Ties are broken by dimensions first, then by proximity to the role's slot,
  /// then by slot rank. A variant name never outranks a measured dimension.
  MediaSelection? select(
    MediaPresentation asset,
    MediaSelectionRequest request,
  ) {
    final List<MediaVariantCandidate> loadable = <MediaVariantCandidate>[];
    for (final MediaVariantCandidate candidate in asset.variants) {
      if (!policy.isAllowed(candidate.url)) continue;
      if (!_ratioCompatible(candidate, request)) continue;
      loadable.add(candidate);
    }
    // Every candidate was an incompatible crop: fall back to ratio-agnostic
    // matching rather than showing nothing, since a slightly wrong crop is a
    // better outcome than a placeholder over a valid image.
    if (loadable.isEmpty && request.intendedAspectRatio != null) {
      for (final MediaVariantCandidate candidate in asset.variants) {
        if (policy.isAllowed(candidate.url)) loadable.add(candidate);
      }
    }
    if (loadable.isEmpty) return null;

    final List<MediaVariantCandidate> measured = loadable
        .where((MediaVariantCandidate c) => c.isMeasured)
        .toList();

    if (measured.isEmpty) {
      // No dimensions anywhere. Choose by name, deterministically.
      final MediaVariantCandidate chosen = _closestToRole(loadable, request);
      return _selectionOf(asset, chosen);
    }

    final List<MediaVariantCandidate> adequate = measured
        .where((MediaVariantCandidate c) => _isAdequate(c, request))
        .toList();

    if (adequate.isNotEmpty) {
      return _selectionOf(asset, _smallest(adequate, request));
    }
    return _selectionOf(asset, _largest(measured, request));
  }

  /// Whether [candidate] covers the physical target.
  ///
  /// Width is decisive because every media slot in the product is
  /// width-constrained. Height is only consulted when the slot constrains it
  /// *and* the candidate reports one: a candidate that met the width target but
  /// declares no height is not disqualified, because its height follows from the
  /// asset's own ratio rather than from a missing field.
  bool _isAdequate(
    MediaVariantCandidate candidate,
    MediaSelectionRequest request,
  ) {
    if (candidate.width! < request.targetWidth) return false;
    final double? targetHeight = request.targetHeight;
    if (targetHeight == null) return true;
    final int? height = candidate.height;
    if (height == null) return true;
    return height >= targetHeight;
  }

  bool _ratioCompatible(
    MediaVariantCandidate candidate,
    MediaSelectionRequest request,
  ) {
    final double? intended = request.intendedAspectRatio;
    if (intended == null || intended <= 0) return true;
    final double? actual = candidate.aspectRatio;
    // An unmeasured candidate makes no claim about its framing, so there is
    // nothing to contradict. It is filtered on size instead.
    if (actual == null) return true;
    return (actual - intended).abs() / intended <=
        kAspectRatioRoundingTolerance;
  }

  MediaVariantCandidate _smallest(
    List<MediaVariantCandidate> candidates,
    MediaSelectionRequest request,
  ) {
    MediaVariantCandidate best = candidates.first;
    for (final MediaVariantCandidate candidate in candidates.skip(1)) {
      if (_compareBySize(candidate, best, request) < 0) best = candidate;
    }
    return best;
  }

  MediaVariantCandidate _largest(
    List<MediaVariantCandidate> candidates,
    MediaSelectionRequest request,
  ) {
    MediaVariantCandidate best = candidates.first;
    for (final MediaVariantCandidate candidate in candidates.skip(1)) {
      if (_compareBySize(candidate, best, request) > 0) best = candidate;
    }
    return best;
  }

  /// Total ordering on candidate size. Total is the point: with the slot rank as
  /// the final term no two candidates can ever compare equal, so the stored
  /// order can never influence the result.
  int _compareBySize(
    MediaVariantCandidate a,
    MediaVariantCandidate b,
    MediaSelectionRequest request,
  ) {
    final int byWidth = (a.width ?? 0).compareTo(b.width ?? 0);
    if (byWidth != 0) return byWidth;
    final int byHeight = (a.height ?? 0).compareTo(b.height ?? 0);
    if (byHeight != 0) return byHeight;
    final int byRole = _roleDistance(
      a,
      request,
    ).compareTo(_roleDistance(b, request));
    if (byRole != 0) return byRole;
    return a.slot.rank.compareTo(b.slot.rank);
  }

  MediaVariantCandidate _closestToRole(
    List<MediaVariantCandidate> candidates,
    MediaSelectionRequest request,
  ) {
    MediaVariantCandidate best = candidates.first;
    for (final MediaVariantCandidate candidate in candidates.skip(1)) {
      final int byRole = _roleDistance(
        candidate,
        request,
      ).compareTo(_roleDistance(best, request));
      if (byRole < 0 || byRole == 0 && candidate.slot.rank < best.slot.rank) {
        best = candidate;
      }
    }
    return best;
  }

  int _roleDistance(
    MediaVariantCandidate candidate,
    MediaSelectionRequest request,
  ) => (candidate.slot.rank - request.role.preferredSlot.rank).abs();

  MediaSelection _selectionOf(
    MediaPresentation asset,
    MediaVariantCandidate candidate,
  ) => MediaSelection(
    url: candidate.url,
    slot: candidate.slot,
    mediaId: asset.mediaId,
    version: asset.version,
    width: candidate.width,
    height: candidate.height,
  );
}
