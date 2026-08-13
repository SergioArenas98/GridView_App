import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  MEDIA_VARIANT_MAX_WIDTH,
  assertKeySegment,
  mediaObjectKey,
  mediaPublicUrl,
  ownerSegment,
} from '../../scripts/media/object-keys.ts';
import {
  MediaProcessingError,
  outputFormatFor,
  processMaster,
  roundRatio,
} from '../../scripts/media/process.ts';
import {
  rightsRecord,
  rotatedSyntheticMaster,
  syntheticMaster,
} from './support.ts';

describe('immutable object keys', () => {
  it('uses the established owner-scoped versioned layout', () => {
    expect(
      mediaObjectKey({
        entityType: 'driver',
        entityId: 'test-shape',
        version: 'v1',
        variant: 'thumbnail',
        format: 'webp',
      }),
    ).toBe('media/drivers/test-shape/v1/thumbnail.webp');
  });

  it('maps every owner type to its path segment', () => {
    expect(ownerSegment('driver')).toBe('drivers');
    expect(ownerSegment('constructor')).toBe('constructors');
    expect(ownerSegment('circuit')).toBe('circuits');
    // The wire token is `grand_prix`; the path segment is kebab-case.
    expect(ownerSegment('grand_prix')).toBe('grand-prix');
  });

  it('keys a Grand Prix by its stable edition id', () => {
    expect(
      mediaObjectKey({
        entityType: 'grand_prix',
        entityId: '2026-belgian-grand-prix',
        version: 'v2',
        variant: 'hero',
        format: 'webp',
      }),
    ).toBe('media/grand-prix/2026-belgian-grand-prix/v2/hero.webp');
  });

  it('gives every version and every variant a distinct key', () => {
    const keys = new Set(
      (['v1', 'v2'] as const).flatMap((version) =>
        (['thumbnail', 'card', 'detail', 'hero'] as const).map((variant) =>
          mediaObjectKey({
            entityType: 'driver',
            entityId: 'test-shape',
            version,
            variant,
            format: 'webp',
          }),
        ),
      ),
    );
    expect(keys.size).toBe(8);
  });

  it('rejects a segment that could break stability or escape the prefix', () => {
    expect(() => assertKeySegment('../etc', 'entityId')).toThrow();
    expect(() => assertKeySegment('Test Shape', 'entityId')).toThrow();
    expect(() => assertKeySegment('', 'version')).toThrow();
  });

  it('joins a public URL without doubling the separator', () => {
    expect(mediaPublicUrl('https://m.test/', 'media/a/b.webp')).toBe(
      'https://m.test/media/a/b.webp',
    );
    expect(mediaPublicUrl('https://m.test', 'media/a/b.webp')).toBe(
      'https://m.test/media/a/b.webp',
    );
  });
});

describe('media processing', () => {
  it('produces every variant a large master supports', async () => {
    const asset = await processMaster(
      await syntheticMaster(1600, 900),
      rightsRecord(),
    );
    expect(asset.variants.map((v) => v.slot)).toEqual([
      'thumbnail',
      'card',
      'detail',
      'hero',
    ]);
    expect(asset.skippedSlots).toEqual([]);
  });

  it('never upscales: a small master yields only the slots it can fill', async () => {
    // A 700px master must not become a 960px detail or a 1440px hero. Upscaling
    // invents detail that was never photographed.
    const asset = await processMaster(
      await syntheticMaster(700, 700),
      rightsRecord(),
    );
    expect(asset.variants.map((v) => v.slot)).toEqual(['thumbnail', 'card']);
    expect(asset.skippedSlots).toEqual(['detail', 'hero']);
    for (const variant of asset.variants) {
      expect(variant.width).toBeLessThanOrEqual(700);
    }
  });

  it('emits variants at exactly the documented maximum widths', async () => {
    const asset = await processMaster(
      await syntheticMaster(2000, 1000),
      rightsRecord(),
    );
    for (const variant of asset.variants) {
      expect(variant.width).toBe(MEDIA_VARIANT_MAX_WIDTH[variant.slot]);
    }
  });

  it('refuses a master too small for any variant rather than upscaling', async () => {
    await expect(
      processMaster(await syntheticMaster(80, 80), rightsRecord()),
    ).rejects.toBeInstanceOf(MediaProcessingError);
  });

  it('refuses a corrupt source', async () => {
    await expect(
      processMaster(Buffer.from('not an image at all'), rightsRecord()),
    ).rejects.toBeInstanceOf(MediaProcessingError);
  });

  it('outputs WebP by default', async () => {
    const asset = await processMaster(
      await syntheticMaster(1000, 1000),
      rightsRecord({ category: 'portrait' }),
    );
    expect(asset.format).toBe('webp');
    for (const variant of asset.variants) {
      expect(variant.objectKey.endsWith('.webp')).toBe(true);
      expect((await sharp(variant.bytes).metadata()).format).toBe('webp');
    }
  });

  it.each(['logo', 'circuit_layout'] as const)(
    'preserves PNG for %s, where line art and transparency matter',
    async (category) => {
      const asset = await processMaster(
        await syntheticMaster(1000, 1000, { alpha: true }),
        rightsRecord({ category }),
      );
      expect(asset.format).toBe('png');
      expect(outputFormatFor(category)).toBe('png');
      expect((await sharp(asset.variants[0]!.bytes).metadata()).format).toBe(
        'png',
      );
    },
  );

  it('emits no AVIF', async () => {
    // Phase 8B does not add a third format without measured evidence.
    const asset = await processMaster(
      await syntheticMaster(1600, 900),
      rightsRecord(),
    );
    for (const variant of asset.variants) {
      expect(variant.objectKey).not.toContain('.avif');
      expect(variant.format).not.toBe('avif');
    }
  });

  it('records the width, height and aspect ratio of what it produced', async () => {
    const asset = await processMaster(
      await syntheticMaster(1600, 900),
      rightsRecord(),
    );
    expect(asset.sourceWidth).toBe(1600);
    expect(asset.sourceHeight).toBe(900);
    expect(asset.aspectRatio).toBe(roundRatio(1600 / 900));
    for (const variant of asset.variants) {
      const meta = await sharp(variant.bytes).metadata();
      expect(variant.width).toBe(meta.width);
      expect(variant.height).toBe(meta.height);
    }
  });

  it('normalises orientation, so a rotated master produces upright output', async () => {
    // EXIF orientation 6 means "rotate 90°": the stored 1200x600 becomes an
    // upright 600x1200, and the no-upscale rule must be judged on the upright
    // dimensions rather than the stored ones.
    const asset = await processMaster(
      await rotatedSyntheticMaster(1200, 600),
      rightsRecord(),
    );
    expect(asset.sourceWidth).toBe(600);
    expect(asset.sourceHeight).toBe(1200);
    expect(asset.variants.map((v) => v.slot)).toEqual(['thumbnail', 'card']);
  });

  it('strips metadata from every output', async () => {
    // An EXIF block can carry GPS coordinates, camera serials and timestamps.
    // None belongs in a published asset, and a timestamp would make bytes differ
    // between runs.
    const asset = await processMaster(
      await rotatedSyntheticMaster(1600, 900),
      rightsRecord(),
    );
    for (const variant of asset.variants) {
      const meta = await sharp(variant.bytes).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    }
  });

  it('is deterministic: the same input twice produces identical bytes and hashes', async () => {
    // Byte-for-byte reproducibility on one platform with a pinned toolchain. No
    // cross-platform claim is made here: native image tooling can differ between
    // platforms, so Linux CI is the canonical processing environment.
    const source = await syntheticMaster(1600, 900);
    const first = await processMaster(source, rightsRecord());
    const second = await processMaster(source, rightsRecord());

    expect(second.variants.map((v) => v.contentHash)).toEqual(
      first.variants.map((v) => v.contentHash),
    );
    expect(second.variants.map((v) => v.objectKey)).toEqual(
      first.variants.map((v) => v.objectKey),
    );
    expect(second.variants.map((v) => [v.width, v.height])).toEqual(
      first.variants.map((v) => [v.width, v.height]),
    );
    for (let i = 0; i < first.variants.length; i++) {
      expect(second.variants[i]!.bytes.equals(first.variants[i]!.bytes)).toBe(
        true,
      );
    }
  });

  it('gives different content different hashes', async () => {
    const a = await processMaster(
      await syntheticMaster(1600, 900),
      rightsRecord(),
    );
    const b = await processMaster(
      await syntheticMaster(1600, 901),
      rightsRecord(),
    );
    expect(a.variants[0]!.contentHash).not.toBe(b.variants[0]!.contentHash);
  });
});
