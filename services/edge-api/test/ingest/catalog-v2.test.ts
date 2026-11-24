import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { loadCorpus } from '../../scripts/identity/corpus.mjs';
import { prepareSeed } from '../../src/identity/catalog/seed';
import { hashIdentityProjection } from '../../src/identity/discovery/keys';
import { sqliteHost } from '../identity/catalog/sqlite-support';
import {
  setup,
  installation,
  validateAndActivate,
} from '../identity/catalog/u4-support';
import { profileProposal } from '../identity/catalog/u6-support';
import { IdentityCatalog } from '../../src/identity/durable-object';
import { generateSeasonBatch } from '../../scripts/season-batch/generate';
import { inputFor } from '../season-batch/support';
import {
  ingestContext,
  ingestFor,
  reanchored,
  SEED_VERSION,
  syntheticBatch,
  type Json,
} from './support';
import { MutableClock } from '../publication/sequencer/support';
import { decodeSubmission } from '../../src/ingest/submission';
import { ledgerFixture } from '../sync/coordinated/ledger/support';
import { canonicalJson } from '../../src/ingest/canonical-json';
import { approvedR0Hash } from '../../src/identity/catalog/batch-admission';

/** The P0 seed content hash (docs/operations/identity-seed-p0/manifest.json). */
const p0Hash =
  'sha256:0a1b093a150605221606bb7dd65d7204d074ec4fef031537af100f5c0ab7de91';

let seed: Awaited<ReturnType<typeof prepareSeed>>;
let host: ReturnType<typeof sqliteHost>;
let f: Awaited<ReturnType<typeof setup>>;
let context: Awaited<ReturnType<typeof ingestContext>>;
let batch: { manifest: Json; artifact: Json; manifestSha256: string };
let catalogBytes: Uint8Array;
beforeAll(async () => {
  seed = await prepareSeed(loadCorpus('p0'));
});
beforeEach(async () => {
  vi.stubGlobal('fetch', () => {
    throw Error('U7 provider network forbidden');
  });
  host = sqliteHost();
  f = await setup(host.storage, seed);
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
  catalogBytes = new TextEncoder().encode(
    JSON.stringify(
      { ...wrapper, exportHash: await hashIdentityProjection(wrapper) },
      null,
      2,
    ) + '\n',
  );
  const result = await generateSeasonBatch({
    ...inputFor(),
    identityMode: 'runtime',
    installationId: installation,
    catalogExport: catalogBytes,
  });
  if (!result.ok) throw Error(result.failure);
  batch = {
    artifact: JSON.parse(result.artifact.text),
    manifest: JSON.parse(result.manifest.text),
    manifestSha256: result.manifest.sha256,
  };
  context = await ingestContext();
  vi.spyOn(Date, 'now').mockReturnValue(context.clock.now().getTime());
});
afterEach(() => {
  host.db.close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function service(
  options: {
    compatibility?: boolean;
    afterAdmit?: () => Promise<void>;
    loseCompletion?: boolean;
    admissionFault?: 'before' | 'after' | 'timeout';
    losePrepared?: boolean;
  } = {},
) {
  const ledger = ledgerFixture(
    undefined,
    new MutableClock(context.clock.now()),
  ).ledger;
  let object = new IdentityCatalog(
    { storage: host.storage },
    { IDENTITY_INSTALLATION_ID: installation },
    true,
  );
  let admissionLost = false;
  const config = {
    mode: 'runtime' as const,
    installationId: installation,
    namespace: {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (url: string, init?: RequestInit) => {
          if (
            url.endsWith('/batch-admit') &&
            options.admissionFault === 'before'
          )
            throw Error('synthetic admission unavailable');
          if (
            url.endsWith('/batch-transition') &&
            options.losePrepared &&
            JSON.parse(String(init?.body)).result?.candidateVersion
          )
            throw Error('synthetic prepared receipt unavailable');
          if (
            options.loseCompletion &&
            url.endsWith('/batch-transition') &&
            JSON.parse(String(init?.body)).state === 'complete'
          )
            throw Error('synthetic lost completion');
          const response = await object.fetch(new Request(url, init));
          if (
            url.endsWith('/batch-admit') &&
            options.admissionFault &&
            !admissionLost
          ) {
            admissionLost = true;
            if (options.admissionFault === 'timeout')
              return new Promise<Response>(() => {});
            throw Error('synthetic lost committed admission');
          }
          if (url.endsWith('/batch-admit')) await options.afterAdmit?.();
          return response;
        },
      }),
    },
  };
  return {
    ledger,
    ingest: ingestFor(context, context.service, {
      identityMode: 'runtime',
      identity: config,
      ledger,
      recovery: { port: context.port, storage: context.storage },
      compatibilityInstallation: options.compatibility
        ? installation
        : undefined,
    }),
    restart: () => {
      object = new IdentityCatalog(
        { storage: host.storage },
        { IDENTITY_INSTALLATION_ID: installation },
        true,
      );
    },
  };
}
function submission(value = batch, operationId = crypto.randomUUID()) {
  const decoded = decodeSubmission({
    kind: 'gridview-season-batch-submission',
    schemaVersion: 2,
    operationId,
    season: 2026,
    expectedActiveVersion: SEED_VERSION,
    reviewedManifestSha256: value.manifestSha256,
    manifest: value.manifest,
    artifact: value.artifact,
  });
  if (!decoded) throw Error('decode failed');
  return decoded;
}
async function run(s: ReturnType<typeof service>, input = submission()) {
  const a = s.ingest.admit();
  if (typeof a === 'string') throw Error(a);
  return s.ingest.ingest(a, input);
}
it('uses the real guarded publisher, persists one result, and recovers an identical committed retry after object restart', async () => {
  const s = service(),
    input = submission();
  const first = await run(s, input);
  expect(first).toMatchObject({
    outcome: 'publication',
    publication: { status: 'applied' },
  });
  s.restart();
  expect(await run(s, input)).toEqual(first);
  expect(
    host.db.prepare('SELECT COUNT(*) n FROM identity_batch_receipts').get(),
  ).toEqual({ n: 1 });
});
it.each([
  'installationId',
  'revisionId',
  'catalogHash',
  'seasonProjectionHash',
  'datasetVersion',
  'baseContentDigest',
  'inventoryPolicy',
])('rejects forged %s on the guarded ingest path', async (field) => {
  const m = structuredClone(batch.manifest),
    a = structuredClone(batch.artifact);
  const ref = m.identityCatalog as Json;
  ref[field] = field.endsWith('Id')
    ? crypto.randomUUID()
    : field === 'datasetVersion'
      ? '2026.11.15.999'
      : field === 'inventoryPolicy'
        ? 'optional-driver-inventory-v1'
        : 'sha256:' + '0'.repeat(64);
  a.identityCatalog = structuredClone(ref);
  const result = await run(service(), submission(reanchored(m, a)));
  expect(result).toMatchObject({
    outcome: 'refused',
    stage: 'verification',
    reason: 'catalog-reference-mismatch',
  });
});
it.each(['driver', 'constructor', 'circuit', 'event', 'media'])(
  'rejects forged %s with re-anchored file digests before publication',
  async (kind) => {
    const m = structuredClone(batch.manifest),
      a = structuredClone(batch.artifact),
      source = a.source as Record<string, Json[]>;
    if (kind === 'driver') source.drivers![0]!.fullName = 'Forged Profile';
    if (kind === 'constructor')
      source.constructors![0]!.name = 'Forged Constructor';
    if (kind === 'circuit') source.circuits![0]!.name = 'Forged Circuit';
    if (kind === 'event') source.calendar![0]!.name = 'Forged Event';
    if (kind === 'media') source.drivers![0]!.media = [];
    expect(await run(service(), submission(reanchored(m, a)))).toMatchObject({
      outcome: 'refused',
      stage: 'verification',
      reason: 'catalog-profile-mismatch',
    });
  },
);
it('rejects catalog disagreement and conflicting reuse of an admitted operation', async () => {
  const s = service(),
    input = submission();
  const first = await run(s, input);
  expect(first.outcome).toBe('publication');
  const changed = { ...input, expectedActiveVersion: 'another-version' };
  expect(await run(s, changed)).toMatchObject({
    outcome: 'refused',
    reason: 'catalog-admission-refused',
  });
  const a = structuredClone(batch.artifact);
  (a.identityCatalog as Json).exportSha256 = 'sha256:' + '0'.repeat(64);
  expect(
    await run(service(), submission(reanchored(batch.manifest, a))),
  ).toMatchObject({ outcome: 'refused', reason: 'catalog-reference-mismatch' });
});
it('refuses new old-revision batches after activation and retains the irreversible U4 v1 closure', async () => {
  // The current repository corpus is P0 (R0 plus the reviewed Rafael Câmara
  // identity); runtime batches are generated from its export.
  expect(seed.contentHash).toBe(p0Hash);
  expect(seed.contentHash).not.toBe(approvedR0Hash);
  const revision = await profileProposal(f);
  await validateAndActivate(f, revision.revisionId);
  expect(f.workflow.head()).toMatchObject({
    hasRuntimeOnlyActivation: true,
    legacyV1AdmissionEnabled: false,
  });
  expect(await run(service())).toMatchObject({
    outcome: 'refused',
    reason: 'catalog-reference-mismatch',
  });
  expect(canonicalJson(batch.manifest)).toContain(f.root.revisionId);
});

it('uses the admitted old pin through mid-batch activation and rejects the next stale submission', async () => {
  const revision = await profileProposal(f);
  let activated = false;
  const s = service({
    afterAdmit: async () => {
      if (!activated) {
        activated = true;
        await validateAndActivate(f, revision.revisionId);
      }
    },
  });
  const first = await run(s);
  expect(first).toMatchObject({
    outcome: 'publication',
    publication: { status: 'applied' },
  });
  expect(await run(service())).toMatchObject({
    outcome: 'refused',
    reason: 'catalog-reference-mismatch',
  });
});

it('recovers a committed candidate from the existing sequencer and sidecar when completion persistence is lost', async () => {
  const input = submission();
  expect(await run(service({ loseCompletion: true }), input)).toMatchObject({
    outcome: 'refused',
    reason: 'catalog-admission-refused',
  });
  const before = await context.port.readAuthority(2026);
  const result = await run(service(), input);
  expect(result).toMatchObject({
    outcome: 'publication',
    publication: { status: 'applied', recovered: true },
  });
  expect(await context.port.readAuthority(2026)).toEqual(before);
  expect(await run(service(), input)).toEqual(result);
});

it('does not need the current catalog to replay an identical complete receipt', async () => {
  const input = submission(),
    first = await run(service(), input);
  host.db.prepare("UPDATE identity_catalog_revisions SET body='{}'").run();
  expect(await run(service(), input)).toEqual(first);
  expect(await run(service())).toMatchObject({
    outcome: 'refused',
    reason: 'catalog-admission-refused',
  });
});

it.each(['before', 'after', 'timeout'] as const)(
  'handles %s admission failure through the same SQLite receipt and releases the season lease',
  async (fault) => {
    const s = service({ admissionFault: fault });
    const result = await run(s);
    expect(result).toMatchObject(
      fault === 'before'
        ? { outcome: 'refused', reason: 'catalog-admission-refused' }
        : { outcome: 'publication', publication: { status: 'applied' } },
    );
    const state = await s.ledger.readSeason(2026);
    expect(state.outcome).toBe('read');
    if (state.outcome !== 'read') throw Error('ledger unreadable');
    expect(state.snapshot.lease?.state).toBe('released');
    if (fault === 'before')
      expect(await context.port.readAuthority(2026)).toMatchObject({
        activeVersion: SEED_VERSION,
      });
  },
);

it('cancels the existing sequencer preparation if its private prepared receipt cannot persist', async () => {
  const input = submission(),
    before = await context.port.readAuthority(2026),
    s = service({ losePrepared: true });
  const result = await run(s, input);
  expect(result).toMatchObject({
    outcome: 'publication',
    publication: { status: 'failed', reason: 'storage-write' },
  });
  expect(await context.port.readAuthority(2026)).toEqual(before);
  expect(await run(service(), input)).toEqual(result);
});

it.each(['drivers', 'constructors', 'circuits', 'calendar'] as const)(
  'refuses an unknown canonical ID in %s without publishing',
  async (collection) => {
    const a = structuredClone(batch.artifact);
    ((a.source as Json)[collection] as Json[])[0]!.id =
      'synthetic-unknown-canonical-id';
    const before = await context.port.readAuthority(2026);
    expect(
      (await run(service(), submission(reanchored(batch.manifest, a)))).outcome,
    ).toBe('refused');
    expect(await context.port.readAuthority(2026)).toEqual(before);
  },
);

it('never admits runtime v1 on a P0 installation, even with the opt-in, and never reopens after a compensating profile', async () => {
  const archived = await syntheticBatch();
  const v1 = decodeSubmission({
    kind: 'gridview-season-batch-submission',
    schemaVersion: 1,
    season: 2026,
    expectedActiveVersion: SEED_VERSION,
    reviewedManifestSha256: archived.manifestSha256,
    manifest: archived.manifest,
    artifact: archived.artifact,
  })!;
  expect(await run(service(), v1)).toMatchObject({
    outcome: 'refused',
    reason: 'runtime-batch-requires-u7',
  });
  // The U4 v1 compatibility exists only for an exact, sole-activation R0
  // head (batch-admission `legacyAllowed`); a P0 seed never qualifies.
  expect(await run(service({ compatibility: true }), v1)).toMatchObject({
    outcome: 'refused',
    reason: 'runtime-batch-requires-u7',
  });
  const next = await profileProposal(f);
  await validateAndActivate(f, next.revisionId);
  const original = f.root.snapshot.drivers[0]!.profile;
  const evidence = await f.workflow.recordEvidence(
    {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      dossier: {
        claims: [
          { field: 'fullName', value: original.fullName, sourceField: null },
        ],
        references: [
          {
            kind: 'citation',
            httpsUrl: 'https://example.invalid/u7-compensation',
            claimSummary: 'Synthetic compensation only.',
          },
        ],
        rationale: 'Synthetic R0 profile compensation.',
        synthetic: true,
      },
    },
    f.cap,
  );
  const compensated = await f.workflow.review(
    {
      schemaVersion: 1,
      operationId: crypto.randomUUID(),
      expectedActiveRevisionId: next.revisionId,
      expectedActivationSequence: 2,
      action: 'approve-profile',
      candidateId: null,
      expectedCandidateVersion: null,
      proposedBindingKey: null,
      targetId: original.id,
      profile: original,
      evidenceIds: [evidence.evidenceId],
      evidenceHead: await hashIdentityProjection([evidence]),
      reasonCode: 'no-approved-provider-mapping',
      rationale: 'Synthetic compensating profile.',
      duplicateReview: null,
    },
    f.cap,
  );
  await validateAndActivate(f, compensated.revision!.revisionId);
  expect(
    compensated.revision!.snapshot.seasonContent[0]!.seasonProjectionHash,
  ).toBe(seed.snapshot.seasonContent[0]!.seasonProjectionHash);
  expect(
    await run(service({ compatibility: true }), {
      ...v1,
      expectedActiveVersion: 'new-predecessor',
    }),
  ).toMatchObject({ outcome: 'refused', reason: 'runtime-batch-requires-u7' });
  expect(f.workflow.head()).toMatchObject({
    hasRuntimeOnlyActivation: true,
    legacyV1AdmissionEnabled: false,
  });
});

it.each([
  'exportSha256',
  'raw-file-digest',
  'double-hash',
  'unknown-policy',
  'missing-field',
  'future-version',
  'mixed-version',
  'unknown-field',
])('rejects %s in both re-anchored reviewed files', async (fault) => {
  const m = structuredClone(batch.manifest),
    a = structuredClone(batch.artifact);
  if (fault === 'exportSha256') {
    (m.identityCatalog as Json).exportSha256 = 'sha256:' + '0'.repeat(64);
    a.identityCatalog = structuredClone(m.identityCatalog);
  }
  if (fault === 'raw-file-digest' || fault === 'double-hash') {
    (m.identityCatalog as Json).exportSha256 =
      fault === 'raw-file-digest'
        ? '0'.repeat(64)
        : await hashIdentityProjection(
            (m.identityCatalog as Json).exportSha256,
          );
    a.identityCatalog = structuredClone(m.identityCatalog);
  }
  if (fault === 'unknown-policy') {
    (m.identityCatalog as Json).inventoryPolicy = 'strict-v2';
    a.identityCatalog = structuredClone(m.identityCatalog);
  }
  if (fault === 'missing-field') {
    delete (m.identityCatalog as Json).revisionId;
    a.identityCatalog = structuredClone(m.identityCatalog);
  }
  if (fault === 'unknown-field') {
    (m.identityCatalog as Json).extra = true;
    a.identityCatalog = structuredClone(m.identityCatalog);
  }
  if (fault === 'future-version') {
    m.schemaVersion = 3;
    a.schemaVersion = 3;
  }
  if (fault === 'mixed-version') a.schemaVersion = 1;
  const rehashed = reanchored(m, a);
  const input = {
    season: 2026,
    expectedActiveVersion: SEED_VERSION,
    reviewedManifestSha256: rehashed.manifestSha256,
    manifest: rehashed.manifest,
    artifact: rehashed.artifact,
    operationId: crypto.randomUUID(),
  };
  expect((await run(service(), input)).outcome).toBe('refused');
});
