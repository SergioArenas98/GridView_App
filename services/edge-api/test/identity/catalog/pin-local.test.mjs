import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative, isAbsolute, basename } from 'node:path';
import { expect, it } from 'vitest';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { contextFromPin } from '../../../src/identity/catalog/run-context';
import { hashIdentityProjection } from '../../../src/identity/discovery/keys';
const installation = '33333333-3333-4333-8333-333333333333';
it('persists acknowledged pins in actual SQLite DO files and recovers the exact receipt after workerd restart and lost response', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gridview-u6-pin-'));
  const bundle = await build({
    absWorkingDir: resolve(import.meta.dirname, '../../..'),
    entryPoints: ['test/identity/catalog/u4-local-worker.ts'],
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
      bindings: { IDENTITY_INSTALLATION_ID: installation },
      durableObjects: {
        IDENTITY_CATALOG: { className: 'U4TestHost', useSQLite: true },
      },
      durableObjectsPersist: root,
      outboundService() {
        throw Error('U6 external network forbidden');
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
  const pin = async (request) =>
    mf.dispatchFetch('http://local/run-pin', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  try {
    mf = start();
    const seed = await prepareSeed(loadCorpus());
    const r = await call('seed', seed, {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      expectedActiveRevisionId: null,
      expectedActivationSequence: 0,
    });
    const cmd = {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      revisionId: r.revisionId,
      expectedActiveRevisionId: null,
      expectedActivationSequence: 0,
    };
    const certificate = await call('validate', cmd);
    await call('activate', {
      ...cmd,
      operationId: crypto.randomUUID(),
      certificateId: certificate.certificateId,
    });
    const request = {
      schemaVersion: 1,
      runId: crypto.randomUUID(),
      installationId: installation,
      season: 2026,
      purpose: 'manual',
      leaseFence: 7,
    };
    const started = performance.now();
    const original = await pin(request);
    expect(original.status).toBe(200);
    const wire = await original.json();
    const coldMs = performance.now() - started;
    const profile = {
      ...r.snapshot.drivers[0].profile,
      fullName: 'Synthetic Persisted U6 Profile',
    };
    const evidence = await call('evidence', {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      dossier: {
        claims: [
          { field: 'fullName', value: profile.fullName, sourceField: null },
        ],
        references: [
          {
            kind: 'citation',
            httpsUrl: 'https://example.invalid/u6-persisted',
            claimSummary: 'Isolated synthetic persistence fixture.',
          },
        ],
        rationale: 'Synthetic local profile.',
        synthetic: true,
      },
    });
    const reviewed = await call('review', {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      expectedActiveRevisionId: r.revisionId,
      expectedActivationSequence: 1,
      action: 'approve-profile',
      candidateId: null,
      expectedCandidateVersion: null,
      proposedBindingKey: null,
      targetId: profile.id,
      profile,
      evidenceIds: [evidence.evidenceId],
      evidenceHead: await hashIdentityProjection([evidence]),
      reasonCode: 'no-approved-provider-mapping',
      rationale: 'Synthetic U6 review.',
      duplicateReview: null,
    });
    const nextCmd = {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      revisionId: reviewed.revision.revisionId,
      expectedActiveRevisionId: r.revisionId,
      expectedActivationSequence: 1,
    };
    const nextCertificate = await call('validate', nextCmd);
    await call('activate', {
      ...nextCmd,
      operationId: crypto.randomUUID(),
      certificateId: nextCertificate.certificateId,
    });
    // Deliberately discard the caller's success. Recover by identical request,
    // never by the active head or a new run identifier.
    await mf.dispose();
    mf = start();
    const restarted = performance.now();
    const response = await pin(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(wire);
    const restartMs = performance.now() - restarted;
    const contextStarted = performance.now();
    const context = await contextFromPin(wire, request);
    const contextLoadMs = performance.now() - contextStarted;
    expect(context.revisionId).toBe(r.revisionId);
    const laterRequest = { ...request, runId: crypto.randomUUID() };
    const laterResponse = await pin(laterRequest);
    expect(laterResponse.status).toBe(200);
    const later = await contextFromPin(
      await laterResponse.json(),
      laterRequest,
    );
    expect(later.revisionId).toBe(reviewed.revision.revisionId);
    expect(later.participants.driverById(profile.id).fullName).toBe(
      profile.fullName,
    );
    expect(context.participants.driverById(profile.id).fullName).not.toBe(
      profile.fullName,
    );
    expect((await pin({ ...request, purpose: 'scheduled' })).status).toBe(422);
    expect(
      (await pin({ ...request, installationId: crypto.randomUUID() })).status,
    ).toBe(422);
    const files = await readdir(root, { recursive: true });
    expect(files.some((f) => f.endsWith('.sqlite'))).toBe(true);
    console.info('U6 isolated workerd pin latency ms', {
      coldMs: Math.round(coldMs),
      restartMs: Math.round(restartMs),
      contextLoadMs: Math.round(contextLoadMs),
    });
  } finally {
    await mf?.dispose();
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (
      !isAbsolute(rel) &&
      !rel.startsWith('..') &&
      basename(root).startsWith('gridview-u6-pin-')
    )
      await rm(root, { recursive: true, force: true });
  }
});
