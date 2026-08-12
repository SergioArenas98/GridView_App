import { createHash } from 'node:crypto';
import sharp from 'sharp';

import {
  MEDIA_VARIANT_MAX_WIDTH,
  MEDIA_VARIANT_SLOTS,
  mediaObjectKey,
  type MediaOutputFormat,
  type MediaVariantSlot,
} from './object-keys.ts';
import type { MediaRightsRecord } from './rights.ts';

/// Fixed encoder settings.
///
/// Every option is pinned explicitly rather than left to a default, because a
/// default that changes between sharp releases would silently change output
/// bytes and break the immutable-key guarantee. `effort` in particular is the
/// difference between "same input, same bytes" and "same input, whatever this
/// build felt like".
const WEBP_OPTIONS = {
  quality: 82,
  effort: 4,
  smartSubsample: false,
} as const;

const PNG_OPTIONS = {
  compressionLevel: 9,
  effort: 7,
  palette: false,
} as const;

/// Categories whose imagery is line art or needs transparency.
///
/// PNG is preserved only for these. Everything else converts to WebP, which is
/// the default output format; AVIF is deliberately not produced in Phase 8B,
/// because adding a third format costs storage and encode time on every asset and
/// no measurement yet shows it is worth that.
const PNG_CATEGORIES = new Set<string>(['logo', 'circuit_layout']);

export interface ProcessedVariant {
  readonly slot: MediaVariantSlot;
  readonly objectKey: string;
  readonly format: MediaOutputFormat;
  readonly width: number;
  readonly height: number;
  readonly bytes: Buffer;
  /// SHA-256 of [bytes], hex. The content identity used to detect an attempted
  /// immutable overwrite with different content.
  readonly contentHash: string;
}

export interface ProcessedAsset {
  readonly assetId: string;
  readonly record: MediaRightsRecord;
  readonly format: MediaOutputFormat;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly aspectRatio: number;
  readonly variants: readonly ProcessedVariant[];
  /// Slots skipped because producing them would have required upscaling.
  readonly skippedSlots: readonly MediaVariantSlot[];
}

export class MediaProcessingError extends Error {}

/// Which output format an asset's category calls for.
export function outputFormatFor(category: string): MediaOutputFormat {
  return PNG_CATEGORIES.has(category) ? 'png' : 'webp';
}

/// Processes one approved master into its publishable variants.
///
/// The rights gate runs before this; nothing here re-decides permission. What it
/// does guarantee is that processing is deterministic and never invents pixels:
///
/// - orientation is normalised from EXIF, so a rotated master produces the same
///   output as an already-upright one;
/// - all metadata is stripped, because an EXIF block can carry GPS coordinates,
///   camera serial numbers and timestamps, none of which belong in a published
///   asset and any of which would make output bytes vary run to run;
/// - a variant is produced only when the master is at least as wide as the
///   target, so nothing is ever upscaled;
/// - encoder options are pinned rather than defaulted.
export async function processMaster(
  source: Buffer,
  record: MediaRightsRecord,
): Promise<ProcessedAsset> {
  const format = outputFormatFor(record.category);

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(source).metadata();
  } catch (error: unknown) {
    throw new MediaProcessingError(
      `Source master for "${record.assetId}" could not be read as an image.`,
      { cause: error },
    );
  }

  // After `rotate()` the reported dimensions may swap, so the *upright*
  // dimensions are what the no-upscale rule must be judged against.
  const upright = await sharp(source).rotate().toBuffer({
    resolveWithObject: true,
  });
  const sourceWidth = upright.info.width;
  const sourceHeight = upright.info.height;
  if (!sourceWidth || !sourceHeight) {
    throw new MediaProcessingError(
      `Source master for "${record.assetId}" reported no usable dimensions (format: ${metadata.format ?? 'unknown'}).`,
    );
  }

  const variants: ProcessedVariant[] = [];
  const skippedSlots: MediaVariantSlot[] = [];

  for (const slot of MEDIA_VARIANT_SLOTS) {
    const target = MEDIA_VARIANT_MAX_WIDTH[slot];
    if (sourceWidth < target) {
      // Never upscale. A master smaller than the target simply has no variant at
      // that slot, and the app's selector handles a missing slot by design.
      skippedSlots.push(slot);
      continue;
    }
    const bytes = await encode(source, target, format);
    const info = await sharp(bytes).metadata();
    if (!info.width || !info.height) {
      throw new MediaProcessingError(
        `Encoded ${slot} variant for "${record.assetId}" reported no dimensions.`,
      );
    }
    variants.push({
      slot,
      objectKey: mediaObjectKey({
        entityType: record.entityType,
        entityId: record.entityId,
        version: record.version,
        variant: slot,
        format,
      }),
      format,
      width: info.width,
      height: info.height,
      bytes,
      contentHash: sha256(bytes),
    });
  }

  if (variants.length === 0) {
    throw new MediaProcessingError(
      `Source master for "${record.assetId}" is ${sourceWidth}px wide, smaller than every variant target, so nothing publishable could be produced without upscaling.`,
    );
  }

  return {
    assetId: record.assetId,
    record,
    format,
    sourceWidth,
    sourceHeight,
    aspectRatio: roundRatio(sourceWidth / sourceHeight),
    variants,
    skippedSlots,
  };
}

async function encode(
  source: Buffer,
  targetWidth: number,
  format: MediaOutputFormat,
): Promise<Buffer> {
  const pipeline = sharp(source)
    // EXIF orientation applied, then discarded with everything else.
    .rotate()
    .resize({
      width: targetWidth,
      withoutEnlargement: true,
      fit: 'inside',
      kernel: 'lanczos3',
    })
    // Strip metadata: `sharp` drops it unless `withMetadata()` is called, and not
    // calling it is the intent, stated here so it is not "fixed" later.
    .toColourspace('srgb');

  return format === 'webp'
    ? pipeline.webp(WEBP_OPTIONS).toBuffer()
    : pipeline.png(PNG_OPTIONS).toBuffer();
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/// Aspect ratio rounded to four decimals, so the value written into a manifest is
/// stable rather than carrying float noise that would differ between runs.
export function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}
