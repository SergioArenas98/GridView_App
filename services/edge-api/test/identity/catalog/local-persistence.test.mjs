import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { context, driverInput, driversEnvelope } from '../discovery/support';
const installation = '33333333-3333-4333-8333-333333333333';
let root, script, mf;
async function start(fail = false) {
  mf = new Miniflare({
    modules: true,
    script,
    compatibilityDate: '2026-07-01',
    bindings: { IDENTITY_INSTALLATION_ID: installation, TEST_FAIL: fail },
    durableObjects: {
      IDENTITY_CATALOG: { className: 'IdentityCatalog', useSQLite: true },
    },
    durableObjectsPersist: root,
    outboundService: () => {
      throw Error('U2 network forbidden');
    },
  });
}
async function call(command, payload = {}) {
  const response = await mf.dispatchFetch('http://local/call', {
    method: 'POST',
    body: JSON.stringify({
      schemaVersion: 1,
      installationId: installation,
      command,
      payload,
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()).data;
}
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gridview-u2-sqlite-'));
  const result = await build({
    absWorkingDir: resolve(import.meta.dirname, '../../..'),
    entryPoints: ['test/identity/catalog/local-worker.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2024',
  });
  script = result.outputFiles[0].text;
  await start();
});
afterAll(async () => {
  await mf?.dispose();
  // Delete only the exact temporary directory created by this suite.
  if (
    root &&
    resolve(root).startsWith(resolve(tmpdir()) + '\\') &&
    basename(root).startsWith('gridview-u2-sqlite-')
  )
    await rm(root, { recursive: true, force: true });
});
describe('actual workerd SQLite Durable Object disk recovery', () => {
  it('keeps acknowledged observations and backlog state through complete runtime shutdown', async () => {
    const body = driversEnvelope([
      { driverId: 'synthetic_local', givenName: 'Synthetic' },
    ]);
    const o = (
      await extractJolpicaObservations(
        driverInput(body),
        body,
        context,
        providerMappingRegistry(),
      )
    ).observations[0];
    expect(await call('observe-batch', { observations: [o] })).toMatchObject({
      persisted: 1,
      created: 1,
    });
    await call('acknowledge', {
      request: { candidateId: o.candidateId, notificationGeneration: 1 },
      principal: {
        principalId: 'local-test-reader',
        credentialId: 'local-test-credential',
        role: 'reader',
      },
    });
    await mf.dispose();
    await start();
    const detail = await call('inspect', {
      candidateId: o.candidateId,
      section: 'observations',
      cursor: null,
      limit: 16,
    });
    expect(detail.candidate).toMatchObject({
      observationCount: 1,
      acknowledgedNotificationGeneration: 1,
    });
    expect(detail.notification.acknowledgedBy).toBe('local-test-reader');
    expect(detail.items).toHaveLength(1);
    expect(await call('observe-batch', { observations: [o] })).toMatchObject({
      persisted: 0,
      replayed: 1,
    });
    expect((await call('health')).unread).toBe(0);
    const files = await readdir(root, { recursive: true });
    expect(files.some((path) => path.endsWith('.sqlite'))).toBe(true);
  });
  it('rolls back a failure inside a real DO transaction, then recovers after restart', async () => {
    const before = await call('health');
    await mf.dispose();
    await start(true);
    const body = driversEnvelope([
      { driverId: 'synthetic_rollback', givenName: 'Synthetic' },
    ]);
    const o = (
      await extractJolpicaObservations(
        driverInput(body),
        body,
        context,
        providerMappingRegistry(),
      )
    ).observations[0];
    const failed = await mf.dispatchFetch('http://local/call', {
      method: 'POST',
      body: JSON.stringify({
        schemaVersion: 1,
        installationId: installation,
        command: 'observe-batch',
        payload: { observations: [o] },
      }),
    });
    expect(failed.status).toBe(503);
    await mf.dispose();
    await start();
    expect((await call('health')).candidates).toBe(before.candidates);
    expect((await call('health')).observations).toBe(before.observations);
    expect(await call('observe-batch', { observations: [o] })).toMatchObject({
      persisted: 1,
      created: 1,
    });
    // Lose the response after commit, restart, then replay the exact occurrence.
    await mf.dispose();
    await start();
    expect(await call('observe-batch', { observations: [o] })).toMatchObject({
      persisted: 0,
      replayed: 1,
    });
  });
  it('rejects malformed batch atomically and offers no approval or activation command', async () => {
    const before = await call('health');
    for (const command of ['activate', 'approve', 'observe-batch']) {
      const response = await mf.dispatchFetch('http://local/call', {
        method: 'POST',
        body: JSON.stringify({
          schemaVersion: 1,
          installationId: installation,
          command,
          payload: { observations: [{}] },
        }),
      });
      expect(response.status).toBe(400);
    }
    expect((await call('health')).observations).toBe(before.observations);
  });
});
