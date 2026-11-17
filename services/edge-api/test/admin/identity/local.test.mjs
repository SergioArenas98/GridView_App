import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename, sep } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { syntheticSeed, credential, installation } from './support';
import { hashIdentityProjection } from '../../../src/identity/discovery/keys';
import { catalogValidatorVersion } from '../../../src/identity/catalog/activation';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import {
  context,
  driverInput,
  driversEnvelope,
} from '../../identity/discovery/support';
let root, script, mf, seed, person;
async function start() {
  mf = new Miniflare({
    modules: true,
    script,
    compatibilityDate: '2026-07-01',
    bindings: {
      IDENTITY_INSTALLATION_ID: installation,
      IDENTITY_ADMIN_MODE: 'review',
      IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify([person.entry]),
    },
    durableObjects: {
      IDENTITY_CATALOG: { className: 'IdentityCatalog', useSQLite: true },
    },
    durableObjectsPersist: root,
    outboundService: () => {
      throw Error('U5 provider/network access forbidden');
    },
  });
}
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gridview-u5-http-sqlite-'));
  person = credential();
  seed = await syntheticSeed();
  const result = await build({
    absWorkingDir: resolve(import.meta.dirname, '../../..'),
    entryPoints: ['test/admin/identity/local-worker.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2024',
  });
  script = result.outputFiles[0].text;
  await start();
}, 30000);
afterAll(async () => {
  await mf?.dispose();
  if (
    root &&
    resolve(root).startsWith(resolve(tmpdir()) + sep) &&
    basename(root).startsWith('gridview-u5-http-sqlite-')
  )
    await rm(root, { recursive: true, force: true });
});
async function call(path, body, loseResponse = false) {
  const response = await mf.dispatchFetch(
    'http://127.0.0.1/internal/admin/identity' + path,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: 'Bearer ' + person.token,
        ...(loseResponse ? { 'X-Test-Lose-Response': '1' } : {}),
        ...(body
          ? {
              'Content-Type': 'application/json',
              'Idempotency-Key': body.operationId,
            }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const value = await response.json();
  expect(response.status, JSON.stringify(value)).toBe(loseResponse ? 503 : 200);
  if (loseResponse)
    expect(value).toEqual({ error: { code: 'TEST_RESPONSE_LOST' } });
  return value;
}
const request = (head, payload) => ({
  schemaVersion: 1,
  installationId: installation,
  operationId: crypto.randomUUID(),
  expectedActiveRevisionId: head.activeRevisionId,
  expectedActivationSequence: head.activationSequence,
  reason: 'Synthetic local durable U5 review.',
  payload,
});
async function activate(head, revision, hash, loseResponse = false) {
  const validation = await call(
    '/revisions/' + revision + '/validate',
    request(head, {
      catalogHash: hash,
      expectedValidatorVersion: catalogValidatorVersion,
    }),
  );
  const activation = request(head, {
    catalogHash: hash,
    validationReportHash: validation.data.reportHash,
  });
  const response = await call(
    '/revisions/' + revision + '/activate',
    activation,
    loseResponse,
  );
  return { request: activation, response };
}
it('reviews and separately activates over local HTTP, loses the activation response, shuts workerd down, then recovers exact SQLite receipts and immutable attribution', async () => {
  let head = (await call('/health')).data;
  const dossier = {
    claims: [
      { field: 'fullName', value: 'Synthetic Seed Dossier', sourceField: null },
    ],
    references: [
      {
        kind: 'citation',
        httpsUrl: 'https://example.invalid/seed-u5',
        claimSummary: 'Synthetic local fixture.',
      },
    ],
    rationale: 'Synthetic local bootstrap.',
    synthetic: true,
  };
  const artifact = { format: 'gridview-reviewed-seed/1', seed, dossier };
  const rootProposal = (
    await call(
      '/seed',
      request(head, {
        seedArtifact: artifact,
        seedArtifactHash: await hashIdentityProjection(artifact),
        approvedImportDossierId: await hashIdentityProjection(dossier),
      }),
    )
  ).data;
  await activate(
    head,
    rootProposal.proposedRevisionId,
    rootProposal.catalogHash,
  );
  head = (await call('/health')).data;
  const body = driversEnvelope([
    {
      driverId: 'synthetic_u5_durable_key',
      givenName: 'Synthetic',
      familyName: 'Durable',
    },
  ]);
  const observation = (
    await extractJolpicaObservations(
      driverInput(body),
      body,
      context,
      providerMappingRegistry(),
    )
  ).observations[0];
  expect(
    (
      await mf.dispatchFetch('http://127.0.0.1/__test/observe', {
        method: 'POST',
        body: JSON.stringify({ observations: [observation] }),
      })
    ).status,
  ).toBe(200);
  const candidate = (await call('/candidates/' + observation.candidateId)).data
    .candidate;
  const ref = {
    candidateId: candidate.candidateId,
    expectedCandidateVersion: candidate.recordVersion,
    expectedEvidenceHead: candidate.evidenceHead,
  };
  const evidence = (
    await call(
      '/evidence',
      request(head, {
        candidate: ref,
        kind: 'review-dossier',
        claims: [
          { field: 'fullName', value: 'Synthetic Driver 1', sourceField: null },
          {
            field: 'canonical-association',
            value: { key: candidate.key, targetId: 'synthetic-driver-1' },
            sourceField: null,
          },
        ],
        references: [
          { kind: 'observation', observationId: observation.observationId },
        ],
        duplicateReview: null,
      }),
    )
  ).data;
  const approval = request(head, {
    candidate: {
      ...ref,
      expectedCandidateVersion: evidence.candidateVersion,
      expectedEvidenceHead: evidence.evidenceHead,
    },
    targetDriverId: 'synthetic-driver-1',
    support: {
      evidenceIds: [evidence.evidenceId],
      dossierId: evidence.evidenceId,
      rationale: 'Explicit synthetic association.',
    },
  });
  const proposal = (await call('/bindings/approve', approval)).data;
  expect((await call('/health')).data.activeRevisionId).toBe(
    head.activeRevisionId,
  );
  const activated = await activate(
    head,
    proposal.proposedRevisionId,
    proposal.catalogHash,
    true,
  );
  await mf.dispose();
  await start();
  const recovered = await call(
    '/operations/' + activated.request.operationId + '?family=activate',
  );
  expect(recovered.data.state).toBe('committed');
  const committed = recovered.data.result.data;
  expect(committed).toMatchObject({
    activeRevisionId: proposal.proposedRevisionId,
    activationSequence: 2,
    catalogHash: proposal.catalogHash,
    datasetVersions: proposal.datasetVersions,
  });
  expect(
    await call(
      '/revisions/' + proposal.proposedRevisionId + '/activate',
      activated.request,
    ),
  ).toMatchObject({ data: committed, replayed: true });
  const conflict = await mf.dispatchFetch(
    'http://127.0.0.1/internal/admin/identity/revisions/' +
      proposal.proposedRevisionId +
      '/activate',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + person.token,
        'Content-Type': 'application/json',
        'Idempotency-Key': activated.request.operationId,
      },
      body: JSON.stringify({
        ...activated.request,
        reason: 'Conflicting reuse after restart',
      }),
    },
  );
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toMatchObject({
    error: { code: 'IDEMPOTENCY_CONFLICT' },
  });
  expect((await call('/health')).data.activeRevisionId).toBe(
    proposal.proposedRevisionId,
  );
  const history = (
    await call('/history?principalId=' + person.entry.principalId)
  ).data.items;
  expect(
    history.some(
      (e) =>
        e.credentialId === person.entry.credentialId &&
        e.eventType === 'identity.catalog.activated',
    ),
  ).toBe(true);
  expect(
    history.filter(
      (e) =>
        e.eventType === 'identity.catalog.activated' &&
        e.subject.revisionId === proposal.proposedRevisionId,
    ),
  ).toHaveLength(1);
  const info = (await call('/revisions/' + proposal.proposedRevisionId)).data;
  expect(info.activationEvents).toHaveLength(1);
  expect(info.revision.snapshot.seasonContent).toEqual(
    proposal.datasetVersions,
  );
  const files = await readdir(root, { recursive: true });
  const sqlite = files.filter((p) => p.endsWith('.sqlite'));
  expect(sqlite.length).toBeGreaterThan(0);
  for (const path of sqlite) {
    const disk = await readFile(join(root, path));
    expect(disk.includes(Buffer.from(person.token))).toBe(false);
    expect(disk.includes(Buffer.from(person.entry.tokenSha256))).toBe(false);
  }
}, 30000);
