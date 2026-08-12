import { mediaPublicUrl, type MediaVariantSlot } from './object-keys.ts';
import type { ProcessedAsset } from './process.ts';

/// One variant as the public contract expresses it.
export interface MediaVariantFragment {
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

/// A `MediaAsset` exactly as `docs/api/gridview-api-v1.yaml` defines it.
///
/// The generated fragment is the *input* to the existing snapshot generation, not
/// a new endpoint and not a new contract. `/v1/content/manifest` stays what it is
/// — version metadata only — and deliberately does not gain an asset inventory
/// just because the publication pipeline has richer internal data. Publication
/// inputs live in validated repository content; the public contract remains
/// authoritative for what Flutter synchronises.
export interface MediaAssetFragment {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly category: string;
  readonly format: string;
  readonly variants: Readonly<
    Partial<Record<MediaVariantSlot, MediaVariantFragment | null>>
  >;
  readonly aspectRatio: number;
  readonly version: string;
  readonly attribution: string | null;
  readonly license: string;
  readonly fallbackCategory: string;
}

/// Builds the contract fragment for one processed asset.
///
/// [publicBaseUrl] is always supplied by the operator: no production host is
/// hardcoded, because a fabricated host would put URLs into a manifest that
/// nothing serves.
export function manifestFragment(
  asset: ProcessedAsset,
  publicBaseUrl: string,
): MediaAssetFragment {
  const variants: Partial<Record<MediaVariantSlot, MediaVariantFragment>> = {};
  for (const variant of asset.variants) {
    variants[variant.slot] = {
      url: mediaPublicUrl(publicBaseUrl, variant.objectKey),
      width: variant.width,
      height: variant.height,
    };
  }

  return {
    id: asset.record.assetId,
    entityType: asset.record.entityType,
    entityId: asset.record.entityId,
    category: asset.record.category,
    format: asset.format,
    variants,
    aspectRatio: asset.aspectRatio,
    version: asset.record.version,
    // The credit exactly as the rights record supplies it. Never invented, and
    // never a placeholder for an absent one.
    attribution: asset.record.attribution,
    license: asset.record.licenceBasis,
    fallbackCategory: asset.record.category,
  };
}

/// Every produced object key with its content hash, sorted.
///
/// The record an operator inspects before an upload and the input to the
/// immutable-overwrite check.
export function objectInventory(assets: readonly ProcessedAsset[]): {
  readonly objectKey: string;
  readonly contentHash: string;
  readonly bytes: number;
}[] {
  return assets
    .flatMap((asset) =>
      asset.variants.map((variant) => ({
        objectKey: variant.objectKey,
        contentHash: variant.contentHash,
        bytes: variant.bytes.byteLength,
      })),
    )
    .sort((a, b) => a.objectKey.localeCompare(b.objectKey));
}
