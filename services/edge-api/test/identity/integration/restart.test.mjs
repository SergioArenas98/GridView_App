import {
  afterEach,
  beforeAll,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { localInstallation, evidence, seedR0 } from './support.mjs';
import { verifyCatalogFile } from '../../../scripts/identity/catalog-file';
import { contextFromPin } from '../../../src/identity/catalog/run-context';
import { guardNetwork, assertNoExternalNetwork } from './support.mjs';
const hosts = [];
afterEach(async () => {
  for (const h of hosts.splice(0)) await h.stop();
  vi.unstubAllGlobals();
});

describe.sequential('U8 real SQLite lifecycle', () => {
  let h, s, validation, lost, pinRequest, original, wrapper, before, verified;
  beforeAll(async () => {
    h = await localInstallation();
  }, 30000);
  afterAll(async () => h?.stop());
  it('initializes an empty installation and imports the reviewed R0 through U5', async () => {
    guardNetwork();
    const cold = performance.now(),
      empty = await h.admin('/health');
    h.timings.emptySchemaAndHealthMs = performance.now() - cold;
    expect(empty).toMatchObject({
      installationId: h.installation,
      activeRevisionId: null,
      activationSequence: 0,
      storageSchemaVersion: 1,
    });
    s = await h.seed();
  });
  it('validates independently then explicitly activates, recovering a lost response', async () => {
    guardNetwork();
    validation = await h.validation(s.head, s.proposal);
    expect((await h.admin('/health')).activeRevisionId).toBeNull();
    lost = await h.activation(s.head, s.proposal, validation, true);
    pinRequest = h.pinRequest();
    original = await h.pin(pinRequest);
  });
  it('exports and independently verifies full R0 closure and canonical commitment', async () => {
    guardNetwork();
    wrapper = await h.export(s.proposal.proposedRevisionId);
    const started = performance.now();
    verified = await verifyCatalogFile(
      new TextEncoder().encode(JSON.stringify(wrapper)),
      { installationId: h.installation, season: 2026 },
    );
    h.timings.exportValidationMs = performance.now() - started;
    expect(verified.reference.exportSha256).toBe(wrapper.exportHash);
    expect(verified.context.catalogHash).toBe(
      'sha256:8a2a62d8412fdfd71cfd5138b4f87682f33a690d21c3d5eec46153bfbda39851',
    );
    expect(verified.context.seasonProjectionHash).toBe(
      'sha256:ab953da8b44e80f7d9bc87fd948a32b0c67785eaa15c4d50348f0a4f8b7cc746',
    );
    expect(wrapper.revision.snapshot).toEqual((await seedR0()).snapshot);
    before = await h.inspect();
  });
  it('recovers exact pin, history and receipts after actual workerd restart', async () => {
    guardNetwork();
    await h.stop();
    await h.start();
    const recoveryStarted = performance.now(),
      receipt = await h.admin(
        '/operations/' + lost.request.operationId + '?family=activate',
      );
    h.timings.restartReceiptMs = performance.now() - recoveryStarted;
    expect(receipt.state).toBe('committed');
    expect((await h.raw(lost.path, lost.request)).value).toMatchObject({
      replayed: true,
      data: receipt.result.data,
    });
    expect(
      (
        await h.raw(lost.path, {
          ...lost.request,
          reason: 'Conflicting content',
        })
      ).status,
    ).toBe(409);
    expect(await h.pin(pinRequest)).toEqual(original);
    const after = await h.inspect();
    for (const name of [
      'identity_catalog_head',
      'identity_catalog_revisions',
      'identity_catalog_decisions',
      'identity_catalog_certificates',
      'identity_run_pins',
      'identity_admin_receipts',
      'identity_catalog_audit',
    ])
      expect(after.rows[name]).toEqual(before.rows[name]);
    const files = await h.files();
    expect(files.some((f) => f.path.endsWith('.sqlite') && f.bytes > 0)).toBe(
      true,
    );
    // Exercise the production pin policy inside workerd, without adding a
    // second host HTTP hop to its two-second namespace deadline.
    const admitted = await h.fetch('/__test/context', {
      method: 'POST',
      body: JSON.stringify(pinRequest),
    });
    const measured = await admitted.json();
    expect(admitted.status, JSON.stringify(measured)).toBe(200);
    h.timings.workerContextMs = measured.elapsedMs;
    const loadStarted = performance.now();
    const context = await contextFromPin(original, pinRequest);
    h.timings.completeContextMs = performance.now() - loadStarted;
    expect(context.authority).toBe('runtime');
    await evidence('restart', {
      timings: h.timings,
      logicalBytes: after.logicalBytes,
      physicalDatabaseBytes: after.databaseSize,
      files,
      counts: Object.fromEntries(
        Object.entries(after.rows).map(([k, v]) => [k, v.length]),
      ),
      catalogHash: context.catalogHash,
      datasetVersion: context.datasetVersion,
    });
    assertNoExternalNetwork();
  });
});

describe.each(['newer-schema', 'invalid-active'])(
  'U8 real persisted %s',
  (fault) => {
    let h, original;
    beforeAll(async () => {
      h = await localInstallation();
    }, 30000);
    it('initializes isolated R0 for the fault', async () => {
      await h.initialize();
      original = await h.pin();
    });
    afterAll(async () => h?.stop());
    it('refuses a new pin after restart without reseeding', async () => {
      guardNetwork();
      await h.fault(fault);
      await h.stop();
      await h.start();
      const refused = await h.catalog('run-pin', h.pinRequest());
      expect(refused.status).toBe(422);
      expect(await refused.json()).toEqual({ error: 'catalog-invalid' });
      const state = await h.inspect();
      expect(state.rows.identity_catalog_revisions).toHaveLength(1);
      expect(state.rows.identity_run_pins).toHaveLength(1);
      expect(JSON.parse(state.rows.identity_run_pins[0].body)).toEqual(
        original.pin,
      );
    });
  },
);
