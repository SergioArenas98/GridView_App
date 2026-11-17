/**
 * U10 persistent local integration (design §11.3 step 8, §12 T16-T18, T23-T25,
 * T31, T34-T35): optional-driver inventory over a real workerd SQLite
 * `IdentityCatalog`, with an explicit installation UUID, a durable run pin,
 * the reconciliation ledger lease, controlled recorded provider responses and
 * the real guarded sequenced publisher.
 *
 * Synthetic identities and the reviewed R0 corpus only. Every Worker outbound
 * request throws; the Node `fetch` is guarded; provider bodies come from the
 * in-memory Jolpica double. No real identity is approved.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';
import {
  assertNoExternalNetwork,
  evidence,
  guardNetwork,
  localInstallation,
  namespaceBridge,
  reviewedProfile,
} from './support.mjs';
import { EntryPointHarness } from '../../sync/coordinated/entry-points/support';
import {
  paths,
  resultsBody,
  tickAfter,
} from '../../sync/coordinated/observation/support';
import {
  driverRow,
  driversEnvelope,
  fullSeasonDriverRows,
} from '../../providers/jolpica/participants-support';
import {
  canonicalDriver,
  providerDrivers,
} from '../../providers/jolpica/results-support';
import { composeCoordinatedRuntime } from '../../../src/sync/coordinated/composition';
import { generateSeasonBatch } from '../../../scripts/season-batch/generate';
import { fixtureCapture, inputFor } from '../../season-batch/support';

const injected = vi.hoisted(() => ({ ledger: null }));
vi.mock('../../../src/sync/coordinated/ledger-port', async (original) => ({
  ...(await original()),
  resolveReconciliationLedger: () => injected.ledger?.() ?? null,
}));
vi.mock('../../../src/sync/coordinated/composition', async (original) => {
  const actual = await original();
  return {
    ...actual,
    composeCoordinatedRuntime: vi.fn(actual.composeCoordinatedRuntime),
  };
});

const UNKNOWN = 'synthetic_u10_local_unknown';
const PRIVATE = [
  'driverInventory',
  'candidateId',
  'observationKeyHash',
  'projectionDigest',
  'inventoryPolicy',
  'optional-driver',
  UNKNOWN,
];

let catalog, root, wrapper;
beforeAll(async () => {
  catalog = await localInstallation();
}, 60000);
afterAll(async () => catalog?.stop());
beforeEach(() => {
  guardNetwork();
  vi.mocked(composeCoordinatedRuntime).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

const current = () =>
  vi.mocked(composeCoordinatedRuntime).mock.calls.at(-1)?.[1];

async function documents(h) {
  const version = h.activeVersion();
  if (version === null) return [];
  const names = await h.harness.storage.readVersionInventory(2026, version);
  return Promise.all(
    names.map((name) =>
      h.harness.storage.readVersionedDocument(2026, version, name),
    ),
  );
}

async function harness(inventoryMode, bridge = namespaceBridge(catalog)) {
  const h = await EntryPointHarness.create('durable-object', (binding) => {
    injected.ledger = binding;
  });
  await h.published();
  Object.assign(h.env, {
    IDENTITY_CATALOG_MODE: 'runtime',
    IDENTITY_INSTALLATION_ID: catalog.installation,
    IDENTITY_CATALOG: bridge,
    ...(inventoryMode ? { IDENTITY_INVENTORY_MODE: inventoryMode } : {}),
  });
  return h;
}

const unknownInventory = () => ({
  kind: 'json',
  body: driversEnvelope([...fullSeasonDriverRows(), driverRow(UNKNOWN)]),
});
const debutantProvider = providerDrivers(1)[0];
const debutantInventory = () => ({
  kind: 'json',
  body: driversEnvelope(
    fullSeasonDriverRows().filter((row) => row.driverId !== debutantProvider),
  ),
});
const unknownRaceDriver = () => {
  const replaced = providerDrivers(8)[7];
  return {
    kind: 'json',
    body: JSON.parse(
      JSON.stringify(resultsBody(1, 'A')).replace(
        '"driverId":"' + replaced + '"',
        '"driverId":"' + UNKNOWN + '"',
      ),
    ),
  };
};

function expectNoPrivate(value) {
  const text = JSON.stringify(value);
  for (const marker of PRIVATE) expect(text, marker).not.toContain(marker);
}

async function pinRows() {
  const state = await catalog.inspect();
  return (state.rows.identity_run_pins ?? []).map((r) => JSON.parse(r.request));
}

it('U10 seeds and activates the reviewed synthetic R0 for an explicit installation', async () => {
  root = await catalog.initialize();
  wrapper = await catalog.export(root.proposal.proposedRevisionId);
  expect((await catalog.admin('/health')).activeRevisionId).toBe(
    root.proposal.proposedRevisionId,
  );
}, 120000);

it('T34 strict parity: an unknown inventory-only driver still ends participants before constructors and publishes nothing', async () => {
  const h = await harness('strict');
  h.server.results.set(1, 'A');
  h.server.answers.set(paths.drivers, unknownInventory);
  const before = await documents(h);
  const result = await h.manual(tickAfter(1, 6));
  expect(current().inventoryPolicyVersion).toBe('strict/1');
  expect(result.requests).toContain(paths.drivers);
  expect(result.requests).not.toContain(paths.constructors);
  expect(result.finalizes).toBe(0);
  expect(await documents(h)).toEqual(before);
  // The strict durable pin keeps its exact pre-U10 schema-1 request.
  const strict = (await pinRows()).find((r) => r.runId === current().runId);
  expect(strict).toMatchObject({ schemaVersion: 1 });
  expect(strict).not.toHaveProperty('inventoryPolicy');
  assertNoExternalNetwork();
}, 120000);

it('T23/T35 optional: the real constructors request is made, the season publishes through the guarded sequencer, and nothing private is published', async () => {
  const strict = await harness('strict');
  strict.server.results.set(1, 'A');
  const baseline = await strict.manual(tickAfter(1, 6));

  const h = await harness('optional-drivers');
  h.server.results.set(1, 'A');
  h.server.answers.set(paths.drivers, unknownInventory);
  const result = await h.manual(tickAfter(1, 6));
  const ctx = current();
  expect(ctx.authority).toBe('runtime');
  expect(ctx.inventoryPolicyVersion).toBe('optional-drivers/1');
  expect(ctx.revisionId).toBe(root.proposal.proposedRevisionId);
  // Exact provider accounting: the same endpoint set and order as a fully
  // mapped strict run; the constructors request strict skipped above is real.
  expect(result.requests).toEqual(baseline.requests);
  const drivers = result.requests.indexOf(paths.drivers);
  expect(result.requests[drivers + 1]).toBe(paths.constructors);
  expect(result.reservations).toBe(baseline.reservations);
  expect(result.finalizes).toBe(1);
  const docs = await documents(h);
  expectNoPrivate(docs);
  const publicDrivers = docs.find((d) => d.documentName === 'drivers');
  expect(publicDrivers).toBeDefined();
  // The durable pin records the optional policy for this whole run.
  const pin = (await pinRows()).find((r) => r.runId === ctx.runId);
  expect(pin).toMatchObject({
    schemaVersion: 2,
    inventoryPolicy: 'optional-driver-inventory-v1',
  });
  expectNoPrivate(h.harness.logger.serialized?.() ?? '');
  await evidence('u10-optional-inventory-only', {
    requests: result.requests,
    reservations: result.reservations,
    strictReservations: baseline.reservations,
    finalizes: result.finalizes,
    policy: ctx.inventoryPolicyVersion,
    pinSchema: pin.schemaVersion,
  });
  assertNoExternalNetwork();
}, 180000);

it('T25 optional: a curated debutant absent from the inventory is published with its pinned profile', async () => {
  const h = await harness('optional-drivers');
  h.server.results.set(1, 'A');
  h.server.answers.set(paths.drivers, debutantInventory);
  const result = await h.manual(tickAfter(1, 6));
  expect(result.finalizes).toBe(1);
  const id = canonicalDriver(debutantProvider);
  const docs = await documents(h);
  const summaries = docs.find((d) => d.documentName === 'drivers').data;
  expect(summaries.some((s) => s.driverId === id)).toBe(true);
  expect(docs.some((d) => d.documentName === 'driver:' + id)).toBe(true);
  expectNoPrivate(docs);
}, 180000);

it('T24 optional: an unknown driver in a required race classification still blocks and keeps the release', async () => {
  const h = await harness('optional-drivers');
  h.server.results.set(1, 'A');
  h.server.answers.set(paths.results(1), unknownRaceDriver);
  const before = await documents(h);
  const versionBefore = h.activeVersion();
  const result = await h.manual(tickAfter(1, 6));
  expect(result.finalizes).toBe(0);
  expect(h.activeVersion()).toBe(versionBefore);
  expect(await documents(h)).toEqual(before);
}, 180000);

it('T17 optional: an unavailable or corrupt catalog before admission sends no provider request and publishes nothing', async () => {
  const outage = namespaceBridge(catalog);
  outage.available = false;
  const corrupt = {
    idFromName: (name) => name,
    get: () => ({ fetch: async () => new Response('{"pin":{}}') }),
  };
  for (const bridge of [outage, corrupt]) {
    const h = await harness('optional-drivers', bridge);
    h.server.results.set(1, 'A');
    const result = await h.manual(tickAfter(1, 6));
    expect(result.requests).toEqual([]);
    expect(result.reservations).toBe(0);
    expect(result.finalizes).toBe(0);
  }
}, 180000);

it('T16 optional: mid-run activation and catalog outage after the pin keep the original profiles and policy; the next run adopts the new revision', async () => {
  const h = await harness('optional-drivers');
  h.server.results.set(1, 'A');
  h.server.answers.set(paths.drivers, unknownInventory);
  const next = await reviewedProfile(catalog, wrapper, 'Synthetic U10 Profile');
  const baseTransport = h.server.transport;
  let changed = false;
  h.env.__PROVIDER_TRANSPORT = async (request) => {
    if (!changed) {
      changed = true;
      await catalog.activation(next.head, next.proposal, next.validation);
      // Configuration and catalog availability change mid-run; neither may
      // reach the admitted run.
      h.env.IDENTITY_INVENTORY_MODE = 'strict';
      h.env.IDENTITY_CATALOG.available = false;
    }
    return baseTransport(request);
  };
  const a = await h.manual(tickAfter(1, 6));
  const pinned = current();
  expect(a.finalizes).toBe(1);
  expect(a.requests).toContain(paths.constructors);
  expect(pinned.revisionId).toBe(root.proposal.proposedRevisionId);
  expect(pinned.inventoryPolicyVersion).toBe('optional-drivers/1');
  expect(JSON.stringify(await documents(h))).not.toContain(
    'Synthetic U10 Profile',
  );

  h.env.__PROVIDER_TRANSPORT = baseTransport;
  h.env.IDENTITY_CATALOG.available = true;
  h.env.IDENTITY_INVENTORY_MODE = 'optional-drivers';
  const b = await h.manual(tickAfter(1, 7));
  expect(b.finalizes).toBe(1);
  const adopted = current();
  expect(adopted.revisionId).toBe(next.proposal.proposedRevisionId);
  expect(adopted.inventoryPolicyVersion).toBe('optional-drivers/1');
  expect(JSON.stringify(await documents(h))).toContain('Synthetic U10 Profile');
  await evidence('u10-optional-mid-run-activation', {
    firstRevision: pinned.revisionId,
    secondRevision: adopted.revisionId,
    firstPolicy: pinned.inventoryPolicyVersion,
    secondPolicy: adopted.inventoryPolicyVersion,
  });
  wrapper = await catalog.export(next.proposal.proposedRevisionId);
}, 240000);

it('T18: a retried run ID cannot be reinterpreted under another policy, and pins replay identically across workerd restart', async () => {
  const strictRequest = catalog.pinRequest();
  const first = await catalog.pin(strictRequest);
  const optional = {
    ...strictRequest,
    schemaVersion: 2,
    inventoryPolicy: 'optional-driver-inventory-v1',
  };
  const conflict = await catalog.catalog('run-pin', optional);
  expect(conflict.status).not.toBe(200);
  const optionalRequest = {
    ...catalog.pinRequest(),
    schemaVersion: 2,
    inventoryPolicy: 'optional-driver-inventory-v1',
  };
  const pinned = await catalog.pin(optionalRequest);
  const downgrade = await catalog.catalog('run-pin', {
    ...optionalRequest,
    schemaVersion: 1,
    inventoryPolicy: undefined,
  });
  expect(downgrade.status).not.toBe(200);
  await catalog.stop();
  await catalog.start();
  expect(await catalog.pin(strictRequest)).toEqual(first);
  expect(await catalog.pin(optionalRequest)).toEqual(pinned);
}, 180000);

it('T23/T21: an optional workerd installation ingests the optional batch through the guarded path and recovers the identical receipt after restart', async () => {
  const batchInstallation = await localInstallation(1, {
    bindings: { IDENTITY_INVENTORY_MODE: 'optional-drivers' },
  });
  try {
    const init = await batchInstallation.initialize();
    const exported = await batchInstallation.export(
      init.proposal.proposedRevisionId,
    );
    const capture = fixtureCapture();
    capture.responses.find((r) => r.file === 'drivers.json').body =
      new TextEncoder().encode(
        JSON.stringify(
          driversEnvelope([...fullSeasonDriverRows(), driverRow(UNKNOWN)]),
        ),
      );
    const generate = (input, inventoryPolicy) =>
      generateSeasonBatch({
        ...input,
        identityMode: 'runtime',
        installationId: batchInstallation.installation,
        catalogExport: new TextEncoder().encode(JSON.stringify(exported)),
        ...(inventoryPolicy ? { inventoryPolicy } : {}),
      });
    const optionalBatch = await generate(
      inputFor(capture),
      'optional-driver-inventory-v1',
    );
    expect(optionalBatch.ok).toBe(true);
    const strictBatch = await generate(inputFor());
    expect(strictBatch.ok).toBe(true);
    expect(
      (await (await batchInstallation.fetch('/__test/genesis')).json()).outcome,
    ).toBe('created');
    const submissionOf = (batch) => ({
      kind: 'gridview-season-batch-submission',
      schemaVersion: 2,
      operationId: crypto.randomUUID(),
      season: 2026,
      expectedActiveVersion: null,
      reviewedManifestSha256: batch.manifest.sha256,
      manifest: JSON.parse(batch.manifest.text),
      artifact: JSON.parse(batch.artifact.text),
    });
    const refused = await batchInstallation.ingest(submissionOf(strictBatch));
    expect(refused.value.data).toMatchObject({
      outcome: 'refused',
      reason: 'catalog-reference-mismatch',
    });
    const submission = submissionOf(optionalBatch);
    expect((await batchInstallation.ingest(submission, true)).status).toBe(503);
    const applied = await batchInstallation.ingest(submission);
    expect(applied.value.data).toMatchObject({
      outcome: 'publication',
      publication: { status: 'applied' },
    });
    const publicDrivers = await (
      await batchInstallation.fetch('/v1/seasons/2026/drivers')
    ).json();
    expectNoPrivate(publicDrivers);
    await batchInstallation.stop();
    await batchInstallation.start({
      IDENTITY_INVENTORY_MODE: 'optional-drivers',
    });
    const replay = await batchInstallation.ingest(submission);
    expect(replay.value.data).toEqual(applied.value.data);
    const state = await batchInstallation.inspect();
    expect(state.rows.identity_batch_receipts).toHaveLength(2);
    expect(
      state.rows.identity_run_pins
        .map((r) => JSON.parse(r.request))
        .filter((r) => r.purpose === 'season-batch')
        .every((r) => r.schemaVersion === 2),
    ).toBe(true);
    // Same public content after restart (response metadata may differ).
    expect(
      (await (await batchInstallation.fetch('/v1/seasons/2026/drivers')).json())
        .data,
    ).toEqual(publicDrivers.data);
    assertNoExternalNetwork();
  } finally {
    await batchInstallation.stop();
  }
}, 300000);
