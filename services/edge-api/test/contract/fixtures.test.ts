import { describe, expect, it } from 'vitest';

import manifest from '../fixtures/api/v1/manifest.json';
import {
  isGridViewId,
  validateErrorEnvelope,
  validateSuccessEnvelope,
  type MetaKind,
} from '../../src/contract/validation';

interface ManifestEntry {
  file: string;
  type: 'envelope' | 'error' | 'entity';
  data?: string;
  dataKind?: 'single' | 'array';
  meta?: MetaKind;
  expectValid?: boolean;
  note?: string;
}

const entries = manifest as unknown as ManifestEntry[];

// Load every fixture from disk.
const modules = import.meta.glob('../fixtures/api/v1/**/*.json', {
  eager: true,
});
const fixtures = new Map<string, unknown>();
for (const [path, mod] of Object.entries(modules)) {
  const marker = '/api/v1/';
  const rel = path.slice(path.indexOf(marker) + marker.length);
  if (rel === 'manifest.json') continue;
  fixtures.set(rel, mod.default);
}

const PROVIDER_ID = /mock-(drv|con|cir)-\d+|"providerIds?"/;

describe('fixture manifest coverage', () => {
  it('the manifest lists exactly the fixtures on disk', () => {
    const listed = new Set(entries.map((e) => e.file));
    const onDisk = [...fixtures.keys()];
    for (const file of onDisk) {
      expect(listed.has(file), `${file} is missing from manifest.json`).toBe(
        true,
      );
    }
    expect(entries.length).toBe(onDisk.length);
  });
});

describe('every fixture', () => {
  it.each(entries.map((e) => e.file))(
    '%s loads and contains no provider ID',
    (file) => {
      const body = fixtures.get(file);
      expect(body, `${file} was not loaded`).toBeDefined();
      expect(PROVIDER_ID.test(JSON.stringify(body))).toBe(false);
    },
  );

  it.each(entries.filter((e) => e.type === 'envelope'))(
    '$file has a valid $meta success envelope',
    (entry) => {
      expect(
        validateSuccessEnvelope(
          fixtures.get(entry.file),
          entry.meta as MetaKind,
        ),
      ).toEqual([]);
    },
  );

  it.each(entries.filter((e) => e.type === 'error'))(
    '$file has a valid error envelope',
    (entry) => {
      expect(validateErrorEnvelope(fixtures.get(entry.file))).toEqual([]);
    },
  );

  it.each(entries.filter((e) => e.type === 'entity'))(
    '$file entities carry valid GridView IDs',
    (entry) => {
      const body = fixtures.get(entry.file) as Array<{ id: string }>;
      expect(Array.isArray(body)).toBe(true);
      for (const item of body) {
        expect(
          isGridViewId(item.id),
          `${item.id} is not a valid GridView ID`,
        ).toBe(true);
      }
    },
  );
});
