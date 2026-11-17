import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative, isAbsolute, basename } from 'node:path';
import { expect, it } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { hashIdentityProjection } from '../../../src/identity/discovery/keys';
import { generateSeasonBatch } from '../../../scripts/season-batch/generate';
import { inputFor } from '../../season-batch/support';
import {
  canonicalJson,
  sha256Hex,
  utf8,
} from '../../../src/ingest/canonical-json';
const installation = '33333333-3333-4333-8333-333333333333';
it('U7 publishes through authenticated Worker ingest with SQLite catalog/lease/sequencer and recovers the identical receipt after workerd restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gridview-u7-batch-'));
  const bundle = await build({
    absWorkingDir: resolve(import.meta.dirname, '../../..'),
    entryPoints: ['test/identity/catalog/u7-local-worker.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2024',
  });
  const start = () =>
    new Miniflare({
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: '2026-07-01',
      bindings: {
        IDENTITY_INSTALLATION_ID: installation,
        IDENTITY_CATALOG_MODE: 'runtime',
        ENVIRONMENT: 'staging',
        PROVIDER_MODE: 'none',
        SEASON_BATCH_INGEST: '2026',
        SEASON_PUBLICATION_AUTHORITY: 'sequencer',
        ADMIN_TOKEN: 'synthetic-local-u7-operator',
      },
      durableObjects: {
        IDENTITY_CATALOG: { className: 'U4TestHost', useSQLite: true },
        RECONCILIATION_LEDGER: {
          className: 'ReconciliationLedger',
          useSQLite: true,
        },
        SEASON_PUBLICATION_SEQUENCER: {
          className: 'SeasonPublicationSequencer',
          useSQLite: true,
        },
      },
      durableObjectsPersist: join(root, 'do'),
      kvNamespaces: ['GRIDVIEW_DATA'],
      kvPersist: join(root, 'kv'),
      outboundService() {
        throw Error('U7 external network forbidden');
      },
    });
  let mf;
  const call = async (method, input, command) => {
    const response = await mf.dispatchFetch('http://local/u4', {
      method: 'POST',
      body: JSON.stringify({ method, input, command }),
    });
    expect(response.status).toBe(200);
    return (await response.json()).result;
  };
  try {
    mf = start();
    const seed = await prepareSeed(loadCorpus());
    const revision = await call('seed', seed, {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      expectedActiveRevisionId: null,
      expectedActivationSequence: 0,
    });
    const command = {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      revisionId: revision.revisionId,
      expectedActiveRevisionId: null,
      expectedActivationSequence: 0,
    };
    const cert = await call('validate', command);
    await call('activate', {
      ...command,
      operationId: crypto.randomUUID(),
      certificateId: cert.certificateId,
    });
    const lineage = JSON.parse(await call('export', revision.revisionId));
    const wrapper = {
      schemaVersion: 1,
      format: 'gridview-identity-admin-export/1',
      installationId: installation,
      revision: lineage.revision,
      decisions: lineage.decisions,
      evidence: [],
      lineage,
    };
    const exportHash = await hashIdentityProjection(wrapper);
    // Equivalent compact JSON (without U5 CLI's final LF) must bind the same catalog.
    const bytes = new TextEncoder().encode(
      JSON.stringify({ ...wrapper, exportHash }),
    );
    const batch = await generateSeasonBatch({
      ...inputFor(),
      identityMode: 'runtime',
      installationId: installation,
      catalogExport: bytes,
    });
    expect(batch.ok).toBe(true);
    expect(JSON.parse(batch.artifact.text).identityCatalog.exportSha256).toBe(
      exportHash,
    );
    expect(JSON.parse(batch.manifest.text).identityCatalog.exportSha256).toBe(
      exportHash,
    );
    const genesis = await mf.dispatchFetch('http://local/test-genesis');
    expect((await genesis.json()).outcome).toBe('created');
    const submission = {
      kind: 'gridview-season-batch-submission',
      schemaVersion: 2,
      operationId: crypto.randomUUID(),
      season: 2026,
      expectedActiveVersion: null,
      reviewedManifestSha256: batch.manifest.sha256,
      manifest: JSON.parse(batch.manifest.text),
      artifact: JSON.parse(batch.artifact.text),
    };
    const ingest = () =>
      mf.dispatchFetch('http://local/internal/admin/season/ingest', {
        method: 'POST',
        headers: { Authorization: 'Bearer synthetic-local-u7-operator' },
        body: JSON.stringify(submission),
      });
    const forged = structuredClone(submission);
    forged.operationId = crypto.randomUUID();
    forged.artifact.identityCatalog.exportSha256 = 'sha256:' + '0'.repeat(64);
    forged.manifest.identityCatalog.exportSha256 =
      forged.artifact.identityCatalog.exportSha256;
    const forgedArtifact = utf8(canonicalJson(forged.artifact));
    forged.manifest.artifact.sha256 = await sha256Hex(forgedArtifact);
    forged.manifest.artifact.byteLength = forgedArtifact.byteLength;
    forged.reviewedManifestSha256 = await sha256Hex(
      utf8(canonicalJson(forged.manifest)),
    );
    const refused = await mf.dispatchFetch(
      'http://local/internal/admin/season/ingest',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer synthetic-local-u7-operator' },
        body: JSON.stringify(forged),
      },
    );
    expect(refused.status).toBe(422);
    expect((await refused.json()).data).toMatchObject({
      outcome: 'refused',
      reason: 'catalog-reference-mismatch',
    });
    const started = performance.now();
    const response = await ingest(),
      first = await response.json();
    expect(first.data).toMatchObject({
      outcome: 'publication',
      publication: { status: 'applied' },
    });
    expect(response.status).toBe(200);
    const firstMs = performance.now() - started;
    await mf.dispose();
    mf = start();
    const recovered = await ingest(),
      second = await recovered.json();
    expect(recovered.status).toBe(200);
    expect(second.data).toEqual(first.data);
    submission.expectedActiveVersion = 'conflicting-reuse';
    expect((await ingest()).status).toBe(409);
    const files = await readdir(root, { recursive: true });
    expect(
      files.filter((f) => f.endsWith('.sqlite')).length,
    ).toBeGreaterThanOrEqual(3);
    console.info(
      'U7 isolated SQLite admission/publication ms',
      Math.round(firstMs),
    );
  } finally {
    await mf?.dispose();
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (
      !isAbsolute(rel) &&
      !rel.startsWith('..') &&
      basename(root).startsWith('gridview-u7-batch-')
    )
      await rm(root, { recursive: true, force: true });
  }
});
