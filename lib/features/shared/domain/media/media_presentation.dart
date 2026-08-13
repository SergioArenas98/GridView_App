import '../entities/enums.dart';
import '../entities/media.dart';

/// The four named size slots the media contract defines for one media asset.
///
/// The contract models `MediaAsset.variants` as an **object with these exact
/// keys**, not as an array, so there is no `MediaVariantName` enum on the wire:
/// the key *is* the name. This enum exists so the slot stops being a bare string
/// once it leaves persistence.
///
/// [rank] is the nominal ordering the names imply. It is used only as a
/// deterministic tie-break and as the last resort for an unmeasured candidate —
/// never as a substitute for measured dimensions, because a name is a claim
/// about intent and a dimension is a fact.
enum MediaVariantSlot {
  thumbnail('thumbnail', 0),
  card('card', 1),
  detail('detail', 2),
  hero('hero', 3);

  const MediaVariantSlot(this.wire, this.rank);

  /// The persisted `media_variants.variantName` token.
  final String wire;

  /// Ascending nominal size order.
  final int rank;

  /// The slot for [wire], or `null` when persistence holds a name this build
  /// does not know. An unknown slot is dropped rather than guessed at.
  static MediaVariantSlot? fromWire(String? wire) {
    for (final MediaVariantSlot slot in values) {
      if (slot.wire == wire) return slot;
    }
    return null;
  }
}

/// One size candidate of a [MediaPresentation]: a URL plus whatever dimensions
/// the contract actually supplied.
///
/// Both dimensions are nullable because `MediaVariant` permits null for either,
/// and an unmeasured candidate is never treated as adequate for a target size.
class MediaVariantCandidate {
  const MediaVariantCandidate({
    required this.slot,
    required this.url,
    this.width,
    this.height,
  });

  final MediaVariantSlot slot;

  /// The candidate URL exactly as stored. It is **not** validated here: URL
  /// policy is a separate pure decision, so this type stays a plain description
  /// of what persistence holds.
  final String url;

  final int? width;
  final int? height;

  /// Whether the candidate reports a usable width. Width is the primary
  /// dimension: every media slot in the product is width-constrained.
  bool get isMeasured => (width ?? 0) > 0;

  /// Whether both axes are usable, so an aspect ratio can be computed.
  bool get isFullyMeasured => isMeasured && (height ?? 0) > 0;

  /// The candidate's own aspect ratio, or `null` when it cannot be computed.
  double? get aspectRatio => isFullyMeasured ? width! / height! : null;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MediaVariantCandidate &&
          other.slot == slot &&
          other.url == url &&
          other.width == width &&
          other.height == height;

  @override
  int get hashCode => Object.hash(slot, url, width, height);
}

/// A presentation-safe view of one persisted media asset together with the real
/// entity that owns it.
///
/// Two identifiers are carried deliberately and are **internal only**:
/// [mediaId] and [ownerId] exist so selection, caching and diagnostics can be
/// precise. Neither is human-readable and neither may ever be rendered as copy
/// or announced as a semantic label — the display text for an image always comes
/// from localized strings and from the owning entity's own name.
///
/// Nothing Drift-shaped and nothing DTO-shaped reaches this type: it is built
/// from the domain [MediaAsset] the DAO already returns.
class MediaPresentation {
  const MediaPresentation({
    required this.mediaId,
    required this.entityType,
    required this.ownerId,
    required this.category,
    required this.format,
    required this.version,
    required this.variants,
    this.aspectRatio,
    this.attribution,
    this.license,
    this.fallbackCategory = MediaCategory.unknown,
  });

  /// Internal identity. Never displayed.
  final String mediaId;

  /// The real owner type. Always one of the four FK-backed entity types here,
  /// because a presentation read model is only ever built for a real owner.
  final MediaEntityType entityType;

  /// Internal identity of the owning entity. Never displayed.
  final String ownerId;

  final MediaCategory category;

  /// The asset's default delivery format. Individual variants may differ in
  /// practice; this is the asset-level declaration the contract carries.
  final MediaFormat format;

  /// Immutable version token. Part of the cache identity, so v1 and v2 of one
  /// asset can never collide.
  final String version;

  /// Every stored size candidate, in ascending slot order.
  final List<MediaVariantCandidate> variants;

  /// The asset-level aspect ratio, when the contract supplied one.
  final double? aspectRatio;

  final String? attribution;
  final String? license;

  /// Which placeholder to fall back to. [MediaCategory.unknown] means "no usable
  /// hint", which resolves to the neutral placeholder rather than to text.
  final MediaCategory fallbackCategory;

  bool get hasVariants => variants.isNotEmpty;

  /// The stored candidate for [slot], or `null`.
  MediaVariantCandidate? variant(MediaVariantSlot slot) {
    for (final MediaVariantCandidate candidate in variants) {
      if (candidate.slot == slot) return candidate;
    }
    return null;
  }
}

/// Every media asset one real owner has **locally**, in stored order.
///
/// This is the unit the feature read models compose. It reports local
/// availability only: constructing it never fetches, never downloads and never
/// refreshes anything.
///
/// An asset whose `entityType` does not match [entityType] is dropped rather
/// than adopted, so a `placeholder` or `unknown` descriptor can never arrive
/// here wearing a real entity's ownership. The DAO already enforces this with
/// foreign keys; repeating the check at the presentation boundary means a future
/// caller cannot reintroduce a fabricated relationship.
class EntityMedia {
  const EntityMedia({
    required this.entityType,
    required this.ownerId,
    required this.assets,
  });

  /// Builds the read model for [ownerId] from the domain assets the DAO
  /// returned. Returns [EntityMedia] with no assets when [ownerType] is not a
  /// real owner type, because there is no entity to own anything.
  factory EntityMedia.from(
    MediaEntityType ownerType,
    String ownerId,
    List<MediaAsset> assets,
  ) {
    if (!isRealMediaOwner(ownerType)) {
      return EntityMedia(
        entityType: ownerType,
        ownerId: ownerId,
        assets: const <MediaPresentation>[],
      );
    }
    final List<MediaPresentation> presentations = <MediaPresentation>[];
    for (final MediaAsset asset in assets) {
      if (asset.entityType != ownerType) continue;
      presentations.add(
        mediaPresentationFrom(asset, ownerType: ownerType, ownerId: ownerId),
      );
    }
    return EntityMedia(
      entityType: ownerType,
      ownerId: ownerId,
      assets: List<MediaPresentation>.unmodifiable(presentations),
    );
  }

  /// An owner with no locally stored media. A valid, ordinary condition.
  factory EntityMedia.empty(MediaEntityType ownerType, String ownerId) =>
      EntityMedia(
        entityType: ownerType,
        ownerId: ownerId,
        assets: const <MediaPresentation>[],
      );

  final MediaEntityType entityType;

  /// Internal identity. Never displayed.
  final String ownerId;

  final List<MediaPresentation> assets;

  bool get isEmpty => assets.isEmpty;
  bool get isNotEmpty => assets.isNotEmpty;

  /// The stored assets in [category], in stored order.
  Iterable<MediaPresentation> inCategory(MediaCategory category) =>
      assets.where((MediaPresentation a) => a.category == category);

  /// The first asset matching [preference], in preference order.
  ///
  /// This is where "which asset is right for this slot" is decided — in one
  /// place, from an explicit ordered preference the caller states. The DAO
  /// deliberately does not choose: it returns everything the owner has, so a
  /// second category can be preferred without a schema or query change.
  ///
  /// Returns `null` when the owner has nothing in any preferred category, which
  /// is the normal "show the placeholder" outcome.
  MediaPresentation? preferred(List<MediaCategory> preference) {
    for (final MediaCategory category in preference) {
      for (final MediaPresentation asset in assets) {
        if (asset.category == category && asset.hasVariants) return asset;
      }
    }
    return null;
  }
}

/// Whether [type] is one of the four FK-backed real owner types.
///
/// `placeholder` and `unknown` are descriptors, not owners: they never receive
/// an association row and never gain an entity relationship.
bool isRealMediaOwner(MediaEntityType type) =>
    type == MediaEntityType.driver ||
    type == MediaEntityType.constructor ||
    type == MediaEntityType.circuit ||
    type == MediaEntityType.grandPrix;

/// Projects one domain [MediaAsset] onto the presentation model for a known
/// owner. Every valid variant, the attribution and the licence are preserved
/// exactly; nothing is invented for a value the contract left absent.
MediaPresentation mediaPresentationFrom(
  MediaAsset asset, {
  required MediaEntityType ownerType,
  required String ownerId,
}) {
  return MediaPresentation(
    mediaId: asset.id,
    entityType: ownerType,
    ownerId: ownerId,
    category: asset.category,
    format: asset.format,
    version: asset.version,
    variants: _candidatesOf(asset.variants),
    aspectRatio: asset.aspectRatio,
    attribution: asset.attribution,
    license: asset.license,
    fallbackCategory: MediaCategory.fromWire(asset.fallbackCategory),
  );
}

List<MediaVariantCandidate> _candidatesOf(MediaVariants variants) {
  final List<MediaVariantCandidate> out = <MediaVariantCandidate>[];
  void add(MediaVariantSlot slot, MediaVariant? variant) {
    if (variant == null) return;
    final String url = variant.url.trim();
    // An empty URL is not a candidate. It is dropped here rather than carried
    // forward as a variant that every later stage has to re-reject.
    if (url.isEmpty) return;
    out.add(
      MediaVariantCandidate(
        slot: slot,
        url: url,
        width: variant.width,
        height: variant.height,
      ),
    );
  }

  add(MediaVariantSlot.thumbnail, variants.thumbnail);
  add(MediaVariantSlot.card, variants.card);
  add(MediaVariantSlot.detail, variants.detail);
  add(MediaVariantSlot.hero, variants.hero);
  return List<MediaVariantCandidate>.unmodifiable(out);
}
