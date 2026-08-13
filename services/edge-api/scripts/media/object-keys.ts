import type { MediaOwnerType } from './rights.ts';

/// The variant slots the contract defines, in ascending size order.
export const MEDIA_VARIANT_SLOTS = [
  'thumbnail',
  'card',
  'detail',
  'hero',
] as const;

export type MediaVariantSlot = (typeof MEDIA_VARIANT_SLOTS)[number];

/// Maximum long-edge sizes, in pixels.
///
/// **Maximum targets, not forced output sizes.** A master smaller than a target
/// simply does not produce that variant: upscaling invents detail that was never
/// photographed, so a 700px master never becomes a 1440px hero.
export const MEDIA_VARIANT_MAX_WIDTH: Record<MediaVariantSlot, number> = {
  thumbnail: 160,
  card: 480,
  detail: 960,
  hero: 1440,
};

export type MediaOutputFormat = 'webp' | 'png';

const OWNER_SEGMENT: Record<MediaOwnerType, string> = {
  driver: 'drivers',
  constructor: 'constructors',
  circuit: 'circuits',
  grand_prix: 'grand-prix',
};

/// The path segment for an owner type. Kebab-case in the path, matching the
/// established layout, while the wire token stays `grand_prix`.
export function ownerSegment(type: MediaOwnerType): string {
  return OWNER_SEGMENT[type];
}

/// The immutable object key for one variant.
///
///     media/<owner>/<stable-id>/<version>/<variant>.<ext>
///
/// Every component is stable GridView identity: the owner type, the stable entity
/// id, an explicit version and an explicit variant. No localized name, no display
/// name, no provider id, no secret, and no timestamp acting as the only version
/// boundary — a timestamp would make two runs of the same input produce two
/// different keys, which is exactly what immutability has to rule out.
export function mediaObjectKey(options: {
  readonly entityType: MediaOwnerType;
  readonly entityId: string;
  readonly version: string;
  readonly variant: MediaVariantSlot;
  readonly format: MediaOutputFormat;
}): string {
  const { entityType, entityId, version, variant, format } = options;
  assertKeySegment(entityId, 'entityId');
  assertKeySegment(version, 'version');
  return [
    'media',
    ownerSegment(entityType),
    entityId,
    version,
    `${variant}.${format}`,
  ].join('/');
}

/// Guards a path segment against anything that would break key stability or
/// escape the prefix.
export function assertKeySegment(value: string, field: string): void {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) {
    throw new Error(
      `Invalid ${field} "${value}": object-key segments must be lowercase ASCII kebab-case.`,
    );
  }
}

/// The public URL for an object key under [baseUrl].
///
/// The base URL is always supplied by the operator. No production host is
/// hardcoded anywhere in the repository, because inventing one would put a URL
/// into a manifest that nothing serves.
export function mediaPublicUrl(baseUrl: string, objectKey: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}/${objectKey}`;
}
