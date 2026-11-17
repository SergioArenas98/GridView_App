import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { loadCorpus } from '../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../src/identity/catalog/seed';
import { hashIdentityProjection } from '../../src/identity/discovery/keys';
import { sqliteHost } from '../identity/catalog/sqlite-support';
import { setup, installation } from '../identity/catalog/u4-support';
import { verifyCatalogFile } from '../../scripts/identity/catalog-file';
import { generateSeasonBatch } from '../../scripts/season-batch/generate';
import { inputFor } from './support';
import { sha256Hex } from '../../src/ingest/canonical-json';
import { buildSubmission } from '../../scripts/season-batch/submission';
import { convertSeasonBatch } from '../../scripts/season-batch/fixtures';
import { decodeSubmission } from '../../src/ingest/submission';
import { decodeCatalogReference } from '../../src/ingest/catalog-reference';

let bytes: Uint8Array;
beforeAll(async () => {
  const h = sqliteHost();
  try {
    const f = await setup(h.storage, await prepareSeed(loadCorpus()));
    const lineage = JSON.parse(
      await f.workflow.exportRevision(f.root.revisionId),
    );
    const wrapper = {
      schemaVersion: 1,
      format: 'gridview-identity-admin-export/1',
      installationId: installation,
      revision: lineage.revision,
      decisions: lineage.decisions,
      evidence: [],
      lineage,
    };
    bytes = new TextEncoder().encode(
      JSON.stringify(
        { ...wrapper, exportHash: await hashIdentityProjection(wrapper) },
        null,
        2,
      ) + '\n',
    );
  } finally {
    h.db.close();
  }
});
afterEach(() => vi.unstubAllGlobals());

it('verifies complete U5 bytes and generates deterministic runtime v2 without network', async () => {
  vi.stubGlobal('fetch', () => {
    throw Error('network forbidden');
  });
  const catalog = await verifyCatalogFile(bytes, {
    installationId: installation,
    season: 2026,
  });
  const exported = JSON.parse(new TextDecoder().decode(bytes));
  expect(catalog.reference.exportSha256).toBe(exported.exportHash);
  expect(catalog.reference.exportSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(catalog.reference.exportSha256).not.toBe(await sha256Hex(bytes));
  expect(catalog.reference.exportSha256).not.toBe(
    await hashIdentityProjection(exported.exportHash),
  );
  expect(
    decodeCatalogReference({
      ...catalog.reference,
      exportSha256: await sha256Hex(bytes),
    }),
  ).toBeNull();
  const input = {
    ...inputFor(),
    identityMode: 'runtime' as const,
    installationId: installation,
    catalogExport: bytes,
  };
  const first = await generateSeasonBatch(input);
  expect(first.ok).toBe(true);
  expect(await generateSeasonBatch(input)).toEqual(first);
  if (!first.ok) throw Error(first.failure);
  const artifact = JSON.parse(first.artifact.text),
    manifest = JSON.parse(first.manifest.text);
  expect(artifact.schemaVersion).toBe(2);
  expect(manifest.schemaVersion).toBe(2);
  expect(manifest.identityCatalog).toEqual(catalog.reference);
  expect(artifact.identityCatalog).toEqual(manifest.identityCatalog);
});

it.each(['truncated', 'hash', 'installation', 'season', 'unknown', 'partial'])(
  'refuses %s exports before output',
  async (change) => {
    let inputBytes = bytes;
    const expected = { installationId: installation, season: 2026 };
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (change === 'truncated') inputBytes = bytes.slice(0, -20);
    if (change === 'hash') value.exportHash = 'sha256:' + '0'.repeat(64);
    if (change === 'installation')
      expected.installationId = crypto.randomUUID();
    if (change === 'season') expected.season = 2025;
    if (change === 'unknown') value.extra = true;
    if (change === 'partial') value.lineage.history = [];
    if (!['truncated', 'installation', 'season'].includes(change))
      inputBytes = new TextEncoder().encode(JSON.stringify(value));
    await expect(verifyCatalogFile(inputBytes, expected)).rejects.toThrow();
  },
);

it.each([
  'catalogHash',
  'projection',
  'dataset',
  'base',
  'driver',
  'mapping',
  'revision',
  'wrapper-decision',
])(
  'rejects internally contradictory %s even with a new valid wrapper digest',
  async (fault) => {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    const revision = value.lineage.revision;
    if (fault === 'catalogHash')
      revision.contentHash = 'sha256:' + '0'.repeat(64);
    if (fault === 'projection')
      revision.snapshot.seasonContent[0].seasonProjectionHash =
        'sha256:' + '0'.repeat(64);
    if (fault === 'dataset')
      revision.snapshot.seasonContent[0].datasetVersion = '2026.11.15.999';
    if (fault === 'base')
      revision.snapshot.seasonContent[0].baseContentDigest =
        'sha256:' + '0'.repeat(64);
    if (fault === 'driver') revision.snapshot.drivers.pop();
    if (fault === 'mapping')
      revision.snapshot.bindings[0].key.providerValue = 123;
    if (fault === 'revision') revision.revisionId = crypto.randomUUID();
    value.revision = structuredClone(revision);
    if (fault === 'wrapper-decision') value.decisions = [];
    const { exportHash: oldHash, ...body } = value;
    void oldHash;
    const changed = new TextEncoder().encode(
      JSON.stringify(
        { ...body, exportHash: await hashIdentityProjection(body) },
        null,
        2,
      ) + '\n',
    );
    await expect(
      verifyCatalogFile(changed, {
        installationId: installation,
        season: 2026,
      }),
    ).rejects.toThrow();
  },
);

it('keeps v2 public documents and Flutter fixture DTOs identical to bundled v1 and carries provenance only in private review files', async () => {
  const v1 = await generateSeasonBatch(inputFor());
  const v2 = await generateSeasonBatch({
    ...inputFor(),
    identityMode: 'runtime',
    installationId: installation,
    catalogExport: bytes,
  });
  if (!v1.ok || !v2.ok) throw Error('generation failed');
  expect(JSON.parse(v2.artifact.text).documents).toEqual(
    JSON.parse(v1.artifact.text).documents,
  );
  const fixture = await convertSeasonBatch({
    manifestBytes: new TextEncoder().encode(v2.manifest.text),
    artifactBytes: new TextEncoder().encode(v2.artifact.text),
    expectedManifestSha256: v2.manifest.sha256,
    origin: 'synthetic',
    catalogExport: bytes,
    installationId: installation,
  });
  expect(fixture.ok).toBe(true);
  if (!fixture.ok) throw Error(fixture.failure);
  expect(JSON.stringify(fixture.files)).not.toMatch(
    /identityCatalog|installationId|seasonProjectionHash|catalogHash|exportSha256/,
  );
  const result = await buildSubmission({
    manifestBytes: new TextEncoder().encode(v2.manifest.text),
    artifactBytes: new TextEncoder().encode(v2.artifact.text),
    reviewedManifestSha256: v2.manifest.sha256,
    expectedActiveVersion: null,
    now: new Date('2026-11-15T00:00:00.000Z'),
    catalogExport: bytes,
    installationId: installation,
    operationId: crypto.randomUUID(),
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.failure);
  const wire = JSON.parse(result.text);
  expect(wire.schemaVersion).toBe(2);
  expect(decodeSubmission(wire)).not.toBeNull();
  expect(decodeSubmission({ ...wire, schemaVersion: 1 })).toBeNull();
  expect(decodeSubmission({ ...wire, schemaVersion: 3 })).toBeNull();
  expect(
    decodeSubmission({
      ...wire,
      artifact: { ...wire.artifact, schemaVersion: 1 },
    }),
  ).toBeNull();
});

it('rejects oversized local files and runtime fallback attempts', async () => {
  await expect(
    verifyCatalogFile(new Uint8Array(2 * 1024 * 1024 + 1), {
      installationId: installation,
      season: 2026,
    }),
  ).rejects.toThrow();
  expect(
    await generateSeasonBatch({
      ...inputFor(),
      identityMode: 'compare',
      catalogExport: bytes,
      installationId: installation,
    }),
  ).toMatchObject({ ok: false, failure: 'catalog-export-mode-mismatch' });
  expect(
    await generateSeasonBatch({
      ...inputFor(),
      identityMode: 'runtime',
      catalogExport: bytes,
      installationId: crypto.randomUUID(),
    }),
  ).toMatchObject({ ok: false, failure: 'catalog-export-invalid' });
});

it.each(['compact', 'tabs-crlf', 'reordered', 'unicode-escapes'])(
  'preserves the verified canonical commitment through %s serialization, generation, submission and fixtures',
  async (format) => {
    vi.stubGlobal('fetch', () => {
      throw Error('catalog export network forbidden');
    });
    const value = JSON.parse(new TextDecoder().decode(bytes));
    const reorder = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(reorder)
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.entries(v)
                .reverse()
                .map(([k, x]) => [k, reorder(x)]),
            )
          : v;
    let text =
      format === 'reordered'
        ? JSON.stringify(reorder(value))
        : JSON.stringify(
            value,
            null,
            format === 'tabs-crlf' ? '\t' : undefined,
          );
    if (format === 'tabs-crlf')
      text = '\r\n ' + text.replaceAll('\n', '\r\n') + ' \r\n';
    if (format === 'unicode-escapes')
      text = text.replaceAll('gridview', '\\u0067ridview');
    const changed = new TextEncoder().encode(text);
    expect(await sha256Hex(changed)).not.toBe(await sha256Hex(bytes));
    const catalog = await verifyCatalogFile(changed, {
      installationId: installation,
      season: 2026,
    });
    expect(catalog.reference.exportSha256).toBe(value.exportHash);
    const input = {
      ...inputFor(),
      identityMode: 'runtime' as const,
      installationId: installation,
    };
    const [original, alternate] = await Promise.all([
      generateSeasonBatch({ ...input, catalogExport: bytes }),
      generateSeasonBatch({ ...input, catalogExport: changed }),
    ]);
    expect(alternate).toEqual(original);
    if (!original.ok) throw Error(original.failure);
    const build = await buildSubmission({
      manifestBytes: new TextEncoder().encode(original.manifest.text),
      artifactBytes: new TextEncoder().encode(original.artifact.text),
      reviewedManifestSha256: original.manifest.sha256,
      expectedActiveVersion: null,
      now: new Date('2026-11-15T00:00:00.000Z'),
      catalogExport: changed,
      installationId: installation,
      operationId: crypto.randomUUID(),
    });
    expect(build.ok).toBe(true);
    expect(
      (
        await convertSeasonBatch({
          manifestBytes: new TextEncoder().encode(original.manifest.text),
          artifactBytes: new TextEncoder().encode(original.artifact.text),
          expectedManifestSha256: original.manifest.sha256,
          origin: 'synthetic',
          catalogExport: changed,
          installationId: installation,
        })
      ).ok,
    ).toBe(true);
  },
);

it('rejects changed content with the unchanged canonical wrapper commitment', async () => {
  const value = JSON.parse(new TextDecoder().decode(bytes));
  value.revision.snapshot.drivers[0].profile.fullName =
    'Unapproved substitution';
  await expect(
    verifyCatalogFile(new TextEncoder().encode(JSON.stringify(value)), {
      installationId: installation,
      season: 2026,
    }),
  ).rejects.toThrow('catalog-file-wrapper');
});
