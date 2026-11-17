import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import {
  mkdtemp,
  readdir,
  stat,
  mkdir,
  writeFile,
  readFile,
} from 'node:fs/promises';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { performance } from 'node:perf_hooks';
import console from 'node:console';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, vi } from 'vitest';
import { hashIdentityProjection } from '../../../src/identity/discovery/keys';
import { catalogValidatorVersion } from '../../../src/identity/catalog/activation';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { context, driverInput, driversEnvelope } from '../discovery/support';

let scriptPromise, seedPromise;
const nativeFetch = globalThis.fetch;
let externalAttempts;
export function guardNetwork() {
  externalAttempts = vi.fn(() => {
    throw Error('U8 external network forbidden');
  });
  vi.stubGlobal('fetch', (input, init) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url,
    );
    // Miniflare's readiness/bridge use host loopback HTTP. All Worker outbound
    // requests are independently blocked by outboundService below.
    if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      return nativeFetch(input, init);
    return externalAttempts(input, init);
  });
}
export function assertNoExternalNetwork() {
  expect(externalAttempts).not.toHaveBeenCalled();
}
// The byte-identical regeneration is a separate mandatory preflight. Exercise
// the reviewed package itself here; U5 independently validates it on import.
export const seedR0 = () =>
  (seedPromise ??= readFile(
    resolve(
      import.meta.dirname,
      '../../../../../docs/operations/identity-seed-r0/seed.json',
    ),
    'utf8',
  ).then(JSON.parse));
function credential(principalId) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    entry: {
      principalId,
      credentialId: randomUUID(),
      tokenSha256: createHash('sha256').update(token).digest('hex'),
      roles: ['reader', 'reviewer', 'activator'],
      disabled: false,
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  };
}
export const ids = [
  '88888888-0001-4000-8000-000000000001',
  '88888888-0002-4000-8000-000000000002',
  '88888888-0003-4000-8000-000000000003',
];
export async function localInstallation(index = 0, options = {}) {
  scriptPromise ??= build({
    absWorkingDir: resolve(import.meta.dirname, '../../..'),
    entryPoints: ['test/identity/integration/local-worker.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2024',
  }).then((r) => r.outputFiles[0].text);
  const root =
    options.root ?? (await mkdtemp(join(tmpdir(), 'gridview-u8-sqlite-')));
  const installation = options.installation ?? ids[index];
  const person = options.person ?? credential('u8-local-' + index);
  const operatorToken = randomBytes(32).toString('base64url');
  const namespace = 'u8-local-namespace-' + index;
  let mf;
  const timings = {};
  const h = {
    root,
    installation,
    namespace,
    person,
    operatorToken,
    timings,
    async start(overrides = {}) {
      const started = performance.now();
      mf = new Miniflare({
        modules: true,
        script: await scriptPromise,
        compatibilityDate: '2026-07-01',
        cf: false,
        bindings: {
          ENVIRONMENT: index === 2 ? 'production' : 'staging',
          IDENTITY_INSTALLATION_ID: installation,
          IDENTITY_ADMIN_MODE: 'review',
          IDENTITY_REVIEWER_CREDENTIALS: JSON.stringify([person.entry]),
          IDENTITY_CATALOG_MODE: 'runtime',
          PROVIDER_MODE: 'none',
          SEASON_BATCH_INGEST: '2026',
          SEASON_PUBLICATION_AUTHORITY: 'sequencer',
          ADMIN_TOKEN: operatorToken,
          ...overrides,
        },
        durableObjects: {
          IDENTITY_CATALOG: {
            className: 'IdentityCatalog',
            useSQLite: true,
            unsafeUniqueKey: namespace,
          },
          RECONCILIATION_LEDGER: {
            className: 'ReconciliationLedger',
            useSQLite: true,
            unsafeUniqueKey: namespace + '-leases',
          },
          SEASON_PUBLICATION_SEQUENCER: {
            className: 'SeasonPublicationSequencer',
            useSQLite: true,
            unsafeUniqueKey: namespace + '-publication',
          },
        },
        durableObjectsPersist: join(root, 'do'),
        kvNamespaces: ['GRIDVIEW_DATA'],
        kvPersist: join(root, 'kv'),
        outboundService() {
          throw Error('U8 forbids all outbound requests');
        },
      });
      await mf.ready;
      h.namespaceBinding =
        await mf.getDurableObjectNamespace('IDENTITY_CATALOG');
      timings.startMs = performance.now() - started;
      timings.startSamplesMs ??= [];
      timings.startSamplesMs.push(timings.startMs);
    },
    async stop() {
      await mf?.dispose();
      mf = undefined;
    },
    fetch(path, init) {
      return mf.dispatchFetch('http://127.0.0.1' + path, init);
    },
    async raw(path, body, token = person.token, extra = {}) {
      const response = await h.fetch('/internal/admin/identity' + path, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          ...(body
            ? {
                'Content-Type': 'application/json',
                'Idempotency-Key': body.operationId,
              }
            : {}),
          ...extra,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, value: await response.json() };
    },
    async admin(path, body) {
      const r = await h.raw(path, body);
      expect(r.status, JSON.stringify(r.value)).toBe(200);
      return r.value.data;
    },
    request(head, payload, operationId = randomUUID()) {
      return {
        schemaVersion: 1,
        installationId: installation,
        operationId,
        expectedActiveRevisionId: head.activeRevisionId,
        expectedActivationSequence: head.activationSequence,
        reason: 'U8 isolated local rehearsal; no operational approval.',
        payload,
      };
    },
    async catalog(path, body, name) {
      return h.fetch('/__catalog/' + path, {
        method: body ? 'POST' : 'GET',
        headers: name ? { 'X-U8-Object-Name': name } : {},
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    },
    pinRequest(runId = randomUUID()) {
      return {
        schemaVersion: 1,
        installationId: installation,
        runId,
        season: 2026,
        purpose: 'manual',
        leaseFence: 1,
      };
    },
    async pin(request = h.pinRequest()) {
      const started = performance.now();
      const r = await h.catalog('run-pin', request);
      const v = await r.json();
      timings.pinMs = performance.now() - started;
      expect(r.status, JSON.stringify(v)).toBe(200);
      return v;
    },
    async inspect() {
      return (await h.catalog('__test/inspect')).json();
    },
    async fault(fault) {
      const r = await h.catalog('__test/fault', { fault });
      expect(r.status).toBe(200);
    },
    async seed(input) {
      const seed = input ?? (await seedR0());
      const started = performance.now();
      const head = await h.admin('/health');
      expect(head.activeRevisionId).toBeNull();
      const dossier = {
        claims: [
          {
            field: 'fullName',
            value: 'U8 local R0 migration review',
            sourceField: null,
          },
        ],
        references: [
          {
            kind: 'citation',
            httpsUrl: 'https://example.invalid/u8-reviewed-r0',
            claimSummary:
              'Synthetic local authorization of exact repository R0.',
          },
        ],
        rationale: 'U8 local migration only.',
        synthetic: true,
      };
      const artifact = { format: 'gridview-reviewed-seed/1', seed, dossier };
      const request = h.request(head, {
        seedArtifact: artifact,
        seedArtifactHash: await hashIdentityProjection(artifact),
        approvedImportDossierId: await hashIdentityProjection(dossier),
      });
      const proposal = await h.admin('/seed', request);
      timings.seedImportMs = performance.now() - started;
      return { head, proposal, request };
    },
    async validation(head, proposal) {
      const started = performance.now();
      const v = await h.admin(
        '/revisions/' + proposal.proposedRevisionId + '/validate',
        h.request(head, {
          catalogHash: proposal.catalogHash,
          expectedValidatorVersion: catalogValidatorVersion,
        }),
      );
      timings.validationMs = performance.now() - started;
      return v;
    },
    async activation(head, proposal, validation, lose = false) {
      const request = h.request(head, {
        catalogHash: proposal.catalogHash,
        validationReportHash: validation.reportHash,
      });
      const path = '/revisions/' + proposal.proposedRevisionId + '/activate';
      const r = await h.raw(
        path,
        request,
        person.token,
        lose ? { 'X-U8-Lose-Response': '1' } : {},
      );
      expect(r.status, JSON.stringify(r.value)).toBe(lose ? 503 : 200);
      return { request, path, value: r.value };
    },
    async initialize() {
      const s = await h.seed();
      const validation = await h.validation(s.head, s.proposal);
      const activation = await h.activation(s.head, s.proposal, validation);
      return { ...s, validation, activation };
    },
    async export(revisionId) {
      return h.admin('/revisions/' + revisionId + '/export');
    },
    async ingest(submission, lose = false) {
      const response = await h.fetch('/internal/admin/season/ingest', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + operatorToken,
          ...(lose ? { 'X-U8-Lose-Response': '1' } : {}),
        },
        body: JSON.stringify(submission),
      });
      return { status: response.status, value: await response.json() };
    },
    async files() {
      const files = await readdir(root, { recursive: true });
      return Promise.all(
        files
          .filter((p) => p.endsWith('.sqlite') || p.endsWith('-wal'))
          .map(async (path) => ({
            path: path.replaceAll('\\', '/'),
            bytes: (await stat(join(root, path))).size,
          })),
      );
    },
  };
  await h.start(options.bindings);
  return h;
}

export async function evidence(name, value) {
  const directory = resolve(
    import.meta.dirname,
    '../../../.wrangler/u8-evidence',
  );
  await mkdir(directory, { recursive: true });
  // Preserve every execution's evidence, including intermediate failures.
  const path = join(
    directory,
    name + '-' + Date.now() + '-' + randomUUID() + '.json',
  );
  await writeFile(path, JSON.stringify(value, null, 2));
  console.info('U8 evidence', path);
}

export function namespaceBridge(h) {
  // Miniflare's actual namespace proxy avoids an extra default-Worker HTTP
  // dispatch on each pin. Production's unchanged two-second client is retained.
  const bridge = {
    available: true,
    calls: [],
    idFromName: (name) => h.namespaceBinding.idFromName(name),
    get: (id) => ({
      fetch: (url, init) => {
        bridge.calls.push({ url, body: init.body });
        if (!bridge.available) throw Error('U8 isolated namespace outage');
        return h.namespaceBinding.get(id).fetch(url, init);
      },
    }),
  };
  return bridge;
}

export async function reviewedProfile(
  h,
  wrapper,
  name = 'Synthetic U8 Reviewed Profile',
) {
  const head = await h.admin('/health');
  const driver = wrapper.revision.snapshot.drivers[0];
  const body = driversEnvelope([
    {
      driverId: 'u8_synthetic_review_' + randomUUID(),
      givenName: 'Synthetic',
      familyName: 'U8',
    },
  ]);
  const observations = (
    await extractJolpicaObservations(
      driverInput(body),
      body,
      { ...context, runId: randomUUID() },
      providerMappingRegistry(),
    )
  ).observations;
  expect(
    (
      await h.fetch('/__test/observe', {
        method: 'POST',
        body: JSON.stringify({ observations }),
      })
    ).status,
  ).toBe(200);
  const candidate = (
    await h.admin('/candidates/' + observations[0].candidateId)
  ).candidate;
  const dossier = await h.admin(
    '/evidence',
    h.request(head, {
      candidate: {
        candidateId: candidate.candidateId,
        expectedCandidateVersion: candidate.recordVersion,
        expectedEvidenceHead: candidate.evidenceHead,
      },
      kind: 'review-dossier',
      claims: [
        { field: 'fullName', value: name, sourceField: null },
        {
          field: 'canonical-association',
          value: { key: candidate.key, targetId: driver.profile.id },
          sourceField: null,
        },
      ],
      references: [
        { kind: 'observation', observationId: observations[0].observationId },
      ],
      duplicateReview: null,
    }),
  );
  const { id, ...profile } = driver.profile;
  const proposal = await h.admin(
    '/drivers/' + id + '/profiles',
    h.request(head, {
      expectedProfileHash: driver.profileHash,
      profile: { ...profile, fullName: name },
      support: {
        evidenceIds: [dossier.evidenceId],
        dossierId: dossier.evidenceId,
        rationale: 'U8 isolated synthetic profile review only.',
      },
    }),
  );
  const validation = await h.validation(head, proposal);
  return { head, proposal, validation, observations };
}
