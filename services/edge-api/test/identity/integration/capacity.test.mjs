import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
  it,
  vi,
} from 'vitest';
import {
  localInstallation,
  evidence,
  guardNetwork,
  assertNoExternalNetwork,
} from './support.mjs';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { context, driverInput, driversEnvelope } from '../discovery/support';
let h, before, observations, beforeShared;
const pinMs = [];
beforeAll(async () => {
  h = await localInstallation();
}, 30000);
afterAll(async () => h?.stop());
beforeEach(guardNetwork);
afterEach(() => vi.unstubAllGlobals());
it('U8 initializes real R0 for a controlled larger operational history', async () => {
  await h.initialize();
  before = await h.inspect();
  beforeShared = (await h.admin('/health')).capacity.logicalBytes;
});
it.each([0, 1, 2, 3])(
  'U8 measures bounded group %s of eight immutable pins',
  async () => {
    for (let n = 0; n < 8; n++) {
      await h.pin();
      pinMs.push(h.timings.pinMs);
    }
  },
);
it('U8 measures bounded candidate, notification and receipt deduplication', async () => {
  const body = driversEnvelope(
    Array.from({ length: 64 }, (_, n) => ({
      driverId: 'u8_capacity_' + n,
      givenName: 'Synthetic',
      familyName: 'Capacity',
    })),
  );
  observations = (
    await extractJolpicaObservations(
      driverInput(body),
      body,
      { ...context, runId: crypto.randomUUID() },
      providerMappingRegistry(),
    )
  ).observations;
  expect(observations).toHaveLength(64);
  const observe = () =>
    h.fetch('/__test/observe', {
      method: 'POST',
      body: JSON.stringify({ observations }),
    });
  expect((await observe()).status).toBe(200);
  const first = await h.inspect();
  expect(first.rows.identity_candidates).toHaveLength(
    before.rows.identity_candidates.length + 64,
  );
  expect(first.rows.identity_observations).toHaveLength(
    before.rows.identity_observations.length + 64,
  );
  expect(first.rows.identity_notifications).toHaveLength(
    before.rows.identity_notifications.length + 64,
  );
  expect((await observe()).status).toBe(200);
  const replay = await h.inspect();
  const shared = (await h.admin('/health')).capacity.logicalBytes;
  for (const name of [
    'identity_candidates',
    'identity_evidence',
    'identity_observations',
    'identity_notifications',
    'identity_receipts',
  ])
    expect(replay.rows[name].length).toBe(first.rows[name].length);
  expect(replay.rows.identity_run_pins).toHaveLength(32);
  expect(replay.logicalBytes).toBeGreaterThan(before.logicalBytes);
  await evidence('capacity', {
    pins: 32,
    syntheticCandidateObservations: 64,
    maxPinMs: Math.max(...pinMs),
    minPinMs: Math.min(...pinMs),
    meanPinMs: pinMs.reduce((a, b) => a + b, 0) / pinMs.length,
    beforeLogicalBytes: before.logicalBytes,
    afterLogicalBytes: replay.logicalBytes,
    accountingScope:
      'catalog/optional operational tables; full shared accounting recorded separately',
    beforeSharedLogicalBytes: beforeShared,
    afterSharedLogicalBytes: shared,
    physicalDatabaseBytes: replay.databaseSize,
    files: await h.files(),
    rows: Object.fromEntries(
      Object.entries(replay.rows).map(([k, v]) => [k, v.length]),
    ),
    scope: 'R0 plus small operational history; not near maximum capacity',
  });
  assertNoExternalNetwork();
});
it('U8 acknowledged discovery and notification generations survive real workerd restart without duplicate observations', async () => {
  const before = await h.inspect();
  await h.stop();
  await h.start();
  expect(
    (
      await h.fetch('/__test/observe', {
        method: 'POST',
        body: JSON.stringify({ observations }),
      })
    ).status,
  ).toBe(200);
  const after = await h.inspect();
  expect(after.rows.identity_notifications).toEqual(
    before.rows.identity_notifications,
  );
  expect(after.rows.identity_observations).toEqual(
    before.rows.identity_observations,
  );
  expect(after.rows.identity_receipts).toEqual(before.rows.identity_receipts);
});

it('U8 real SQLite migration interruption leaves no partially created catalog; restart completes transactionally', async () => {
  const interrupted = await localInstallation(1, {
    bindings: { U8_INTERRUPT_MIGRATION: true },
  });
  try {
    expect((await interrupted.raw('/health')).status).toBe(503);
    const state = await interrupted.inspect();
    expect(state.rows.identity_meta).toHaveLength(1);
    expect(
      Object.keys(state.rows).filter((k) => k.startsWith('identity_catalog_')),
    ).toEqual([]);
    await interrupted.stop();
    await interrupted.start();
    const health = await interrupted.admin('/health');
    expect(health.activeRevisionId).toBeNull();
    expect(health.activationSequence).toBe(0);
    const recovered = await interrupted.inspect();
    expect(recovered.rows.identity_catalog_migrations).toHaveLength(1);
    expect(recovered.rows.identity_catalog_revisions).toEqual([]);
  } finally {
    await interrupted.stop();
  }
});
