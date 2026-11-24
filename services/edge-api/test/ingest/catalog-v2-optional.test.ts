/**
 * U10: private batch-v2 `optional-driver-inventory-v1` provenance from offline
 * generation to guarded ingest (design §9.2, ADR 0031 D4; matrix T21, T23,
 * T25, T29, T32).
 *
 * Real SQLite `IdentityCatalog` (node:sqlite host), real durable batch
 * admission and run pins, real season-batch generator over replayed recorded
 * bodies, real guarded sequenced publisher. Synthetic identities only; the
 * global `fetch` throws.
 */

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import { loadCorpus } from '../../scripts/identity/corpus.mjs';
import { generateSeasonBatch } from '../../scripts/season-batch/generate';
import { prepareSeed } from '../../src/identity/catalog/seed';
import { hashIdentityProjection } from '../../src/identity/discovery/keys';
import { IdentityCatalog } from '../../src/identity/durable-object';
import { decodeSubmission } from '../../src/ingest/submission';
import { sqliteHost } from '../identity/catalog/sqlite-support';
import {
  installation,
  setup,
  validateAndActivate,
} from '../identity/catalog/u4-support';
import { profileProposal } from '../identity/catalog/u6-support';
import {
  driverRow,
  driversEnvelope,
  fullSeasonDriverRows,
} from '../providers/jolpica/participants-support';
import { providerDrivers } from '../providers/jolpica/results-support';
import { ledgerFixture } from '../sync/coordinated/ledger/support';
import { MutableClock } from '../publication/sequencer/support';
import { fixtureCapture, inputFor } from '../season-batch/support';
import {
  ingestContext,
  ingestFor,
  reanchored,
  SEED_VERSION,
  type Json,
} from './support';

const UNKNOWN = 'synthetic_u10_batch_unknown';
const OPTIONAL = 'optional-driver-inventory-v1';
type Batch = { manifest: Json; artifact: Json; manifestSha256: string };

let seed: Awaited<ReturnType<typeof prepareSeed>>;
let host: ReturnType<typeof sqliteHost>;
let f: Awaited<ReturnType<typeof setup>>;
let context: Awaited<ReturnType<typeof ingestContext>>;
let catalogBytes: Uint8Array;

// Synthetic corpus preparation and SQLite setup are slow on Windows; this is
// a test-harness hook limit, not an operational deadline.
beforeAll(async () => {
  seed = await prepareSeed(loadCorpus('p0'));
}, 120000);
beforeEach(async () => {
  vi.stubGlobal('fetch', () => {
    throw Error('U10 provider network forbidden');
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
    JSON.stringify({
      ...wrapper,
      exportHash: await hashIdentityProjection(wrapper),
    }),
  );
  context = await ingestContext();
  vi.spyOn(Date, 'now').mockReturnValue(context.clock.now().getTime());
}, 120000);
afterEach(() => {
  host.db.close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The recorded capture with its drivers page replaced. */
function captureWithDrivers(rows: unknown[]) {
  const capture = fixtureCapture();
  const drivers = capture.responses.find((r) => r.file === 'drivers.json')!;
  drivers.body = new TextEncoder().encode(
    JSON.stringify(driversEnvelope(rows)),
  );
  return inputFor(capture);
}
const unknownInventory = () =>
  captureWithDrivers([...fullSeasonDriverRows(), driverRow(UNKNOWN)]);
/** The first results driver, absent from the provider's inventory. */
const debutantInventory = () =>
  captureWithDrivers(
    fullSeasonDriverRows().filter(
      (row) => row.driverId !== providerDrivers(1)[0],
    ),
  );

async function generate(
  input: ReturnType<typeof inputFor>,
  inventoryPolicy?: string,
  identityMode: 'runtime' | 'bundled' = 'runtime',
) {
  return generateSeasonBatch({
    ...input,
    identityMode,
    ...(identityMode === 'runtime'
      ? { installationId: installation, catalogExport: catalogBytes }
      : {}),
    ...(inventoryPolicy === undefined ? {} : { inventoryPolicy }),
  });
}

async function batchOf(
  input: ReturnType<typeof inputFor>,
  inventoryPolicy?: string,
): Promise<Batch> {
  const result = await generate(input, inventoryPolicy);
  if (!result.ok) throw Error(result.failure + ' ' + (result.detail ?? ''));
  return {
    artifact: JSON.parse(result.artifact.text),
    manifest: JSON.parse(result.manifest.text),
    manifestSha256: result.manifest.sha256,
  };
}

function service(inventoryMode: 'strict' | 'optional-drivers') {
  const ledger = ledgerFixture(
    undefined,
    new MutableClock(context.clock.now()),
  ).ledger;
  let object = new IdentityCatalog(
    { storage: host.storage },
    { IDENTITY_INSTALLATION_ID: installation },
    true,
  );
  const calls: string[] = [];
  const refusals: string[] = [];
  const config = {
    mode: 'runtime' as const,
    installationId: installation,
    inventoryMode,
    namespace: {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (url: string, init?: RequestInit) => {
          calls.push(url);
          const response = await object.fetch(new Request(url, init));
          // Diagnostic only: a refused admission's closed error body.
          if (!response.ok) refusals.push(await response.clone().text());
          return response;
        },
      }),
    },
  };
  return {
    calls,
    refusals,
    ingest: ingestFor(context, context.service, {
      identityMode: 'runtime',
      identity: config,
      ledger,
      recovery: { port: context.port, storage: context.storage },
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

function submission(value: Batch, operationId = crypto.randomUUID()) {
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

async function run(s: ReturnType<typeof service>, input: unknown) {
  const a = s.ingest.admit();
  if (typeof a === 'string') throw Error(a);
  return s.ingest.ingest(a, input as ReturnType<typeof submission>);
}

const pinRequests = () =>
  (
    host.db.prepare('SELECT request FROM identity_run_pins').all() as {
      request: string;
    }[]
  ).map((r) => JSON.parse(r.request) as Json);

// ---------------------------------------------------------------------------
// Offline generation
// ---------------------------------------------------------------------------

it('refuses optional generation outside runtime authority and unknown policy labels', async () => {
  expect(await generate(inputFor(), OPTIONAL, 'bundled')).toMatchObject({
    ok: false,
    failure: 'inventory-policy-invalid',
  });
  for (const label of ['optional', 'strict', 'optional-drivers', ' strict-v1'])
    expect(await generate(inputFor(), label)).toMatchObject({
      ok: false,
      failure: 'inventory-policy-invalid',
    });
});

it('strict generation still withholds unknown inventory and absent debutants', async () => {
  for (const input of [unknownInventory(), debutantInventory()]) {
    const result = await generate(input);
    expect(result).toMatchObject({ ok: false, failure: 'assembly-withheld' });
  }
});

it('T23: optional generation accounts the unknown row privately and binds the policy in artifact and manifest', async () => {
  const first = await generate(unknownInventory(), OPTIONAL);
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  expect(await generate(unknownInventory(), OPTIONAL)).toEqual(first);
  const artifact = JSON.parse(first.artifact.text);
  const manifest = JSON.parse(first.manifest.text);
  expect(artifact.identityCatalog.inventoryPolicy).toBe(OPTIONAL);
  expect(manifest.identityCatalog).toEqual(artifact.identityCatalog);
  // The canonical U5 export commitment is unchanged by the policy.
  expect(artifact.identityCatalog.exportSha256).toBe(
    JSON.parse(new TextDecoder().decode(catalogBytes)).exportHash,
  );
  const publicText = JSON.stringify({
    source: artifact.source,
    documents: artifact.documents,
  });
  for (const marker of [
    'driverInventory',
    'candidateId',
    'observationKeyHash',
    'inventoryPolicy',
    UNKNOWN,
  ])
    expect(publicText, marker).not.toContain(marker);
  // The verified inventory profiles are exactly the curated drivers.
  const strict = await batchOf(inputFor());
  expect((artifact.source.drivers as Json[]).map((d) => d.id)).toEqual(
    ((strict.artifact.source as Json).drivers as Json[]).map((d) => d.id),
  );
});

it('T25: optional generation supplements the curated debutant from the same export, appended after inventory', async () => {
  const batch = await batchOf(debutantInventory(), OPTIONAL);
  const strict = await batchOf(inputFor());
  const ids = ((batch.artifact.source as Json).drivers as Json[]).map(
    (d) => d.id as string,
  );
  const strictIds = ((strict.artifact.source as Json).drivers as Json[]).map(
    (d) => d.id as string,
  );
  const debutant = strictIds.find((id) => !ids.slice(0, -1).includes(id))!;
  expect(ids.at(-1)).toBe(debutant);
  expect([...ids].sort()).toEqual([...strictIds].sort());
  // Participation is unchanged: it comes from the race rows only.
  expect((batch.artifact.source as Json).driverEntries).toEqual(
    (strict.artifact.source as Json).driverEntries,
  );
});

// ---------------------------------------------------------------------------
// Guarded ingest
// ---------------------------------------------------------------------------

it('T23: an optional installation publishes the optional batch through the guarded path and replays the receipt after restart', async () => {
  const s = service('optional-drivers');
  const input = submission(await batchOf(unknownInventory(), OPTIONAL));
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
  // The durable pin and receipt record the policy; strict v1 shape is not reused.
  const pins = pinRequests();
  expect(pins).toHaveLength(1);
  expect(pins[0]).toMatchObject({
    schemaVersion: 2,
    inventoryPolicy: OPTIONAL,
    purpose: 'season-batch',
  });
  const receipt = host.db
    .prepare('SELECT request FROM identity_batch_receipts')
    .get() as { request: string };
  expect(JSON.parse(receipt.request)).toMatchObject({
    schemaVersion: 2,
    inventoryPolicy: OPTIONAL,
  });
});

it('T25: an optional installation publishes the supplemented debutant batch', async () => {
  const s = service('optional-drivers');
  const result = await run(
    s,
    submission(await batchOf(debutantInventory(), OPTIONAL)),
  );
  expect(result, JSON.stringify([result, s.refusals, s.calls])).toMatchObject({
    outcome: 'publication',
    publication: { status: 'applied' },
  });
});

it('discriminates strict-v1 and optional-v1 artifacts by installation policy in both directions', async () => {
  const strictBatch = await batchOf(inputFor());
  const optionalBatch = await batchOf(unknownInventory(), OPTIONAL);
  expect(
    await run(service('optional-drivers'), submission(strictBatch)),
  ).toMatchObject({
    outcome: 'refused',
    stage: 'verification',
    reason: 'catalog-reference-mismatch',
  });
  expect(await run(service('strict'), submission(optionalBatch))).toMatchObject(
    {
      outcome: 'refused',
      stage: 'verification',
      reason: 'catalog-reference-mismatch',
    },
  );
});

it('refuses a relabeled reviewed artifact unless it is re-anchored and re-reviewed as a new manifest', async () => {
  const strictBatch = await batchOf(inputFor());
  // Artifact label edited, manifest untouched: the reviewed digests disagree.
  const artifactOnly = structuredClone(strictBatch);
  (artifactOnly.artifact.identityCatalog as Json).inventoryPolicy = OPTIONAL;
  const refusedArtifact = await run(
    service('optional-drivers'),
    submission(artifactOnly),
  );
  expect(refusedArtifact.outcome).toBe('refused');
  // Both labels edited without updating the reviewed manifest digest.
  const unreviewed = structuredClone(strictBatch);
  (unreviewed.artifact.identityCatalog as Json).inventoryPolicy = OPTIONAL;
  (unreviewed.manifest.identityCatalog as Json).inventoryPolicy = OPTIONAL;
  const refusedManifest = await run(
    service('optional-drivers'),
    submission(unreviewed),
  );
  expect(refusedManifest.outcome).toBe('refused');
  // A strict installation never admits the optional label, re-anchored or not.
  const reanchoredOptional = structuredClone(strictBatch);
  const ref = reanchoredOptional.manifest.identityCatalog as Json;
  ref.inventoryPolicy = OPTIONAL;
  reanchoredOptional.artifact.identityCatalog = structuredClone(ref);
  expect(
    await run(
      service('strict'),
      submission(
        reanchored(reanchoredOptional.manifest, reanchoredOptional.artifact),
      ),
    ),
  ).toMatchObject({ outcome: 'refused', reason: 'catalog-reference-mismatch' });
});

it('fails closed when one operation ID is reused under a different installation policy', async () => {
  const strictBatch = await batchOf(inputFor());
  const input = submission(strictBatch);
  expect(await run(service('strict'), input)).toMatchObject({
    outcome: 'publication',
  });
  // Same durable operation, now presented under the optional policy.
  expect(await run(service('optional-drivers'), input)).toMatchObject({
    outcome: 'refused',
    reason: 'catalog-admission-refused',
  });
  expect(
    host.db.prepare('SELECT COUNT(*) n FROM identity_batch_receipts').get(),
  ).toEqual({ n: 1 });
});

it('never gives new v1 (legacy) ingestion an optional-policy path', async () => {
  const legacy = await generateSeasonBatch({ ...inputFor() });
  if (!legacy.ok) throw Error(legacy.failure);
  const s = service('optional-drivers');
  const input = {
    kind: 'gridview-season-batch-submission',
    schemaVersion: 1,
    season: 2026,
    expectedActiveVersion: SEED_VERSION,
    reviewedManifestSha256: legacy.manifest.sha256,
    manifest: JSON.parse(legacy.manifest.text),
    artifact: JSON.parse(legacy.artifact.text),
  };
  const decoded = decodeSubmission(input);
  expect(decoded).not.toBeNull();
  expect(await run(s, decoded)).toMatchObject({
    outcome: 'refused',
    reason: 'runtime-batch-requires-u7',
  });
  // Refused before any catalog admission or pin.
  expect(s.calls).toEqual([]);
});

it('refuses a stale-revision optional batch after a later activation', async () => {
  const optionalBatch = await batchOf(unknownInventory(), OPTIONAL);
  const revision = await profileProposal(f);
  await validateAndActivate(f, revision.revisionId);
  expect(
    await run(service('optional-drivers'), submission(optionalBatch)),
  ).toMatchObject({ outcome: 'refused', reason: 'catalog-reference-mismatch' });
});
