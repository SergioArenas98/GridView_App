import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { approvedAssetIds } from '../../scripts/media/rights.ts';
import type { MediaRightsRegister } from '../../scripts/media/rights.ts';
import { presentMaster, testUse } from './support.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..', '..');
const productionRegisterPath = join(
  repoRoot,
  'content',
  'media',
  'media-rights.json',
);

async function loadProductionRegister(): Promise<MediaRightsRegister> {
  const raw = JSON.parse(
    await readFile(productionRegisterPath, 'utf8'),
  ) as Record<string, unknown>;
  delete raw.$schema;
  return raw as unknown as MediaRightsRegister;
}

async function filesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if ((await stat(full)).isDirectory()) {
      out.push(...(await filesUnder(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

/// Synthetic test media must never become a production publication inventory.
///
/// The two live in different places on purpose: approved production content is
/// `content/media/`, and everything a test uses is generated inside the test run.
/// These assertions exist so that separation is enforced rather than merely
/// intended - a fixture that drifted into the production directory would
/// otherwise be indistinguishable from a real approval.
describe('test and production media isolation', () => {
  it('ships an authoritative production register that is empty', async () => {
    // Empty is the accurate state: no Formula 1 media rights have been cleared.
    const register = await loadProductionRegister();
    expect(register.kind).toBe('media-rights');
    expect(register.status).toBe('authoritative');
    expect(register.assets).toEqual([]);
  });

  it('approves nothing for publication from production content', async () => {
    // The consequence that matters: with an empty register the gate approves no
    // asset, so nothing can be processed, uploaded or referenced by a manifest.
    const register = await loadProductionRegister();
    expect(await approvedAssetIds(register, testUse, presentMaster)).toEqual(
      [],
    );
  });

  it('keeps every test rights record out of content/', async () => {
    const contentFiles = await filesUnder(join(repoRoot, 'content'));
    for (const file of contentFiles) {
      if (!file.endsWith('.json')) continue;
      const raw = await readFile(file, 'utf8');
      expect(
        raw.includes('test-shape'),
        `${relative(repoRoot, file)} contains a synthetic test asset id`,
      ).toBe(false);
    }
  });

  it('commits no image binaries under content/', async () => {
    // A committed master would be an asset distributed by the repository, which
    // is exactly the thing the rights gate exists to control.
    const contentFiles = await filesUnder(join(repoRoot, 'content'));
    const images = contentFiles.filter((file) =>
      /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(file),
    );
    expect(images.map((f) => relative(repoRoot, f))).toEqual([]);
  });

  it('keeps synthetic fixtures inside the test tree', async () => {
    const supportPath = join(here, 'support.ts');
    expect(
      relative(repoRoot, supportPath).startsWith(
        `services${sep}edge-api${sep}test`,
      ),
    ).toBe(true);
  });

  it('states the mock media metadata is non-authoritative', async () => {
    // The development media metadata is deliberately marked `mock` and points at
    // a non-routable host, so it can never be mistaken for a publication source.
    const mock = JSON.parse(
      await readFile(
        join(repoRoot, 'content', 'media', 'media-assets.mock.json'),
        'utf8',
      ),
    ) as {
      status: string;
      assets: { variants: Record<string, { url?: string } | null> }[];
    };
    expect(mock.status).toBe('mock');
    for (const asset of mock.assets) {
      for (const variant of Object.values(asset.variants)) {
        if (variant?.url == null) continue;
        expect(new URL(variant.url).hostname.endsWith('.local')).toBe(true);
      }
    }
  });
});
