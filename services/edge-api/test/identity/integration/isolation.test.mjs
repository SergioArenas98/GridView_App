import { afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import { localInstallation, evidence, seedR0, ids } from './support.mjs';
import { verifyCatalogFile } from '../../../scripts/identity/catalog-file';
import { generateSeasonBatch } from '../../../scripts/season-batch/generate';
import { inputFor } from '../../season-batch/support';
import { guardNetwork, assertNoExternalNetwork } from './support.mjs';
const hosts = [];
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  for (const h of hosts.splice(0)) await h.stop();
});

const installations = [],
  operations = [],
  pins = [];
describe.sequential('U8 installation isolation', () => {
  it.each([0, 1, 2])(
    'initializes isolated SQLite installation %s',
    async (index) => {
      guardNetwork();
      const h = await localInstallation(index);
      hosts.push(h);
      installations.push(h);
      operations.push(await h.initialize());
      pins.push(await h.pin());
    },
  );
  it('refuses cross-credential, artifact, operation, namespace and batch authority', async () => {
    guardNetwork();
    expect(new Set(installations.map((h) => h.root)).size).toBe(3);
    expect(new Set(installations.map((h) => h.namespace)).size).toBe(3);
    const [a, b, c] = installations,
      revision = operations[0].proposal.proposedRevisionId;
    const wrapper = await a.export(revision);
    for (const other of [b, c]) {
      expect(
        (await other.raw('/health', undefined, a.person.token)).status,
      ).toBe(401);
      const old = operations[0].activation;
      expect((await other.raw(old.path, old.request)).status).not.toBe(200);
      expect(
        (
          await other.admin(
            '/operations/' + old.request.operationId + '?family=activate',
          )
        ).state,
      ).toBe('unknown');
      expect((await other.catalog('run-pin', pins[0].pin.request)).status).toBe(
        422,
      );
      await expect(
        verifyCatalogFile(new TextEncoder().encode(JSON.stringify(wrapper)), {
          installationId: other.installation,
          season: 2026,
        }),
      ).rejects.toThrow();
      expect((await other.inspect()).rows.identity_run_pins).toHaveLength(1);
    }
    const batch = await generateSeasonBatch({
      ...inputFor(),
      identityMode: 'runtime',
      installationId: a.installation,
      catalogExport: new TextEncoder().encode(JSON.stringify(wrapper)),
    });
    expect(batch.ok).toBe(true);
    expect((await (await b.fetch('/__test/genesis')).json()).outcome).toBe(
      'created',
    );
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
    const refused = await b.ingest(submission);
    expect(refused.status).toBe(422);
    expect(refused.value.data).toMatchObject({
      outcome: 'refused',
      reason: 'catalog-reference-mismatch',
    });
    expect((await b.fetch('/v1/seasons/2026/drivers')).status).not.toBe(200);
  });
  it('refuses wrong object/namespace and persisted installation identity through restart', async () => {
    guardNetwork();
    const [a] = installations,
      revision = operations[0].proposal.proposedRevisionId;
    // Correct request, wrong object name selects an empty store, never a global head.
    expect(
      (await a.catalog('run-pin', a.pinRequest(), 'identity:' + ids[1])).status,
    ).toBe(422);
    // Wrong UUID with the SAME persisted object cannot initialize over its identity.
    await a.stop();
    await a.start({ IDENTITY_INSTALLATION_ID: ids[1] });
    try {
      const refused = await a.catalog(
        'run-pin',
        { ...a.pinRequest(), installationId: ids[1] },
        'identity:' + ids[0],
      );
      expect(refused.status).toBe(500);
    } finally {
      await a.stop();
      await a.start();
    }
    expect((await a.admin('/health')).activeRevisionId).toBe(revision);
    await evidence('isolation', {
      installations: installations.map((h, i) => ({
        installationId: h.installation,
        namespace: h.namespace,
        root: h.root,
        activeRevisionId: operations[i].proposal.proposedRevisionId,
        pinRevision: pins[i].pin.revisionId,
      })),
      crossCredential: 'refused',
      crossSubmission: 'refused before publication',
      wrongPersistedInstallation: 'refused',
    });
    assertNoExternalNetwork();
  });
});

it('U8 production-equivalent validation rejects synthetic import decisions, and a populated store cannot be implicitly seeded', async () => {
  guardNetwork();
  const h = installations[0],
    s = operations[0];
  const reseed = { ...s.request, operationId: crypto.randomUUID() };
  expect((await h.raw('/seed', reseed)).status).toBe(409);
  const production = await localInstallation(2, {
    bindings: { U8_REJECT_SYNTHETIC: true },
  });
  hosts.push(production);
  const payload = {
    ...s.request,
    installationId: production.installation,
    operationId: crypto.randomUUID(),
  };
  const refused = await production.raw('/seed', payload);
  expect(refused.status).toBe(422);
  expect((await production.admin('/health')).activeRevisionId).toBeNull();
  expect((await seedR0()).snapshot.unresolved).toHaveLength(7);
});
