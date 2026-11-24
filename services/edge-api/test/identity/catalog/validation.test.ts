import { beforeAll, afterEach, describe, it, expect, vi } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { validateSeed } from '../../../src/identity/catalog/validate';
import { importSeed } from '../../../src/identity/catalog/export';
import { sha256Hex, utf8 } from '../../../src/ingest/canonical-json';
import type {
  SeedArtifact,
  Document,
} from '../../../src/identity/catalog/model';
let original: SeedArtifact;
beforeAll(async () => {
  original = await prepareSeed(loadCorpus());
});
afterEach(() => vi.unstubAllGlobals());
describe('whole R0 rejection', () => {
  it.each([
    ['missing driver', (s: SeedArtifact) => s.snapshot.drivers.pop()],
    [
      'duplicate canonical',
      (s: SeedArtifact) => s.snapshot.drivers.push(s.snapshot.drivers[0]!),
    ],
    [
      'missing target',
      (s: SeedArtifact) => {
        s.snapshot.bindings[0]!.targetId = 'not-a-driver';
      },
    ],
    [
      'wrong entity',
      (s: SeedArtifact) => {
        s.snapshot.bindings[0]!.targetEntity = 'driver';
        Object.assign(s.snapshot.bindings[0]!.key, { entity: 'circuit' });
      },
    ],
    [
      'duplicate binding',
      (s: SeedArtifact) => s.snapshot.bindings.push(s.snapshot.bindings[0]!),
    ],
    [
      'conflicting target',
      (s: SeedArtifact) => {
        s.snapshot.bindings.push({
          ...s.snapshot.bindings[0]!,
          targetId: 'conflicting',
        });
      },
    ],
    ['missing evidence', (s: SeedArtifact) => s.snapshot.evidence.pop()],
    [
      'missing profile evidence',
      (s: SeedArtifact) => {
        s.snapshot.drivers[0]!.evidenceIds = [];
      },
    ],
    [
      'malformed profile',
      (s: SeedArtifact) => {
        s.snapshot.drivers[0]!.profile.fullName = '';
      },
    ],
    [
      'invalid schema',
      (s: SeedArtifact) => {
        Object.assign(s, { catalogSchemaVersion: 2 });
      },
    ],
    [
      'wrong season',
      (s: SeedArtifact) => {
        s.snapshot.seasonContent[0]!.season = 2027;
      },
    ],
    [
      'changed dataset',
      (s: SeedArtifact) => {
        s.snapshot.seasonContent[0]!.datasetVersion = '2026.11.14.1';
      },
    ],
    [
      'hash corruption',
      (s: SeedArtifact) => {
        s.contentHash = ('sha256:' + 'a'.repeat(64)) as typeof s.contentHash;
      },
    ],
    [
      'missing registry',
      (s: SeedArtifact) => {
        s.snapshot.circuits = [];
      },
    ],
    [
      'unknown field',
      (s: SeedArtifact) => Object.assign(s.snapshot, { active: true }),
    ],
    ['unresolved promoted', (s: SeedArtifact) => s.snapshot.unresolved.pop()],
    [
      'source byte tampering',
      (s: SeedArtifact) => {
        s.sources[0]!.text += ' ';
      },
    ],
    ['incomplete source import', (s: SeedArtifact) => s.sources.pop()],
  ] as const)('rejects %s', async (_, change) => {
    const copy = structuredClone(original);
    change(copy);
    await expect(validateSeed(copy)).rejects.toThrow();
  });

  it.each([
    [
      'driver-registry',
      (d: Document) => {
        (d.drivers as Document[])[0]!.fullName = '';
      },
    ],
    [
      'driver-registry',
      (d: Document) => {
        (d.drivers as Document[])[0]!.biography = 'x'.repeat(8001);
      },
    ],
    [
      'driver-registry',
      (d: Document) => {
        (d.drivers as Document[])[1]!.id = (d.drivers as Document[])[0]!.id!;
      },
    ],
    [
      'provider-mappings',
      (d: Document) => {
        (d.mappings as Document[])[0]!.gridviewId = 'missing';
      },
    ],
    [
      'provider-mappings',
      (d: Document) => {
        (d.mappings as Document[])[1] = { ...(d.mappings as Document[])[0]! };
      },
    ],
    [
      'provider-evidence',
      (d: Document) => {
        (d.identities as Document[]).pop();
      },
    ],
    [
      'provider-evidence',
      (d: Document) => {
        (d.identities as Document[])[4]!.evidence =
          'Synthetic fixture cannot approve a real driver';
      },
    ],
    [
      'season-metadata',
      (d: Document) => {
        d.datasetVersion = '2026.11.14.1';
      },
    ],
  ] as const)(
    'revalidates changed %s through shared source rules',
    async (kind, change) => {
      const inputs = loadCorpus(),
        s = inputs.find((s) => JSON.parse(s.text).kind === kind)!;
      const d = JSON.parse(s.text);
      change(d);
      s.text = JSON.stringify(d);
      s.fileHash = `sha256:${await sha256Hex(utf8(s.text))}`;
      s.exactCommit = null;
      s.documentVersion = d.schemaVersion ?? d.datasetVersion ?? null;
      await expect(prepareSeed(inputs)).rejects.toThrow();
    },
  );
  it('refuses oversized export, accessors and unsupported prototypes without executing them', async () => {
    await expect(importSeed(' '.repeat(2 * 1024 * 1024 + 1))).rejects.toThrow(
      'export-capacity',
    );
    const getter = vi.fn(() => original.snapshot),
      bad = { ...original };
    Object.defineProperty(bad, 'snapshot', { get: getter, enumerable: true });
    await expect(validateSeed(bad)).rejects.toThrow('property');
    expect(getter).not.toHaveBeenCalled();
    await expect(validateSeed(Object.create(original))).rejects.toThrow(
      'prototype',
    );
  });
});
