/**
 * The offline catalog file bound (`scripts/identity/catalog-file.ts`).
 *
 * A complete export carries decisions and evidence beside the lineage, so a
 * catalog whose revision export is within `catalogLimits.exportBytes` can
 * produce a larger file: staging's catalog R2 (2026-11-23) exported 2,581,990
 * bytes and was refused as `catalog-file-capacity`. Files up to twice the
 * revision bound - what the runtime pin response accepts - pass the size check
 * and are then judged on their content.
 */

import { describe, expect, it } from 'vitest';

import { catalogLimits } from '../../../src/identity/catalog/model';
import { verifyCatalogFile } from '../../../scripts/identity/catalog-file';

const expected = {
  installationId: 'c45d60b8-a723-4b6e-8530-750592af2b94',
  season: 2026,
};

/** `{"x":"…"}` padded to exactly `size` bytes: valid JSON, not a catalog. */
function paddedJson(size: number): Uint8Array {
  const prefix = '{"x":"';
  const suffix = '"}';
  return new TextEncoder().encode(
    prefix + 'a'.repeat(size - prefix.length - suffix.length) + suffix,
  );
}

async function failureOf(bytes: Uint8Array): Promise<string> {
  try {
    await verifyCatalogFile(bytes, expected);
  } catch (error) {
    return String(error);
  }
  return 'accepted';
}

describe('offline catalog file capacity', () => {
  it('judges a file above one revision export bound on its content, not its size', async () => {
    const failure = await failureOf(paddedJson(catalogLimits.exportBytes + 1));
    expect(failure).not.toContain('catalog-file-capacity');
    expect(failure).not.toBe('accepted');
  });

  it('accepts exactly twice the revision bound by size', async () => {
    const failure = await failureOf(paddedJson(catalogLimits.exportBytes * 2));
    expect(failure).not.toContain('catalog-file-capacity');
  });

  it('refuses a file above twice the revision bound, and an empty file', async () => {
    expect(
      await failureOf(paddedJson(catalogLimits.exportBytes * 2 + 1)),
    ).toContain('catalog-file-capacity');
    expect(await failureOf(new Uint8Array())).toContain(
      'catalog-file-capacity',
    );
  });
});
