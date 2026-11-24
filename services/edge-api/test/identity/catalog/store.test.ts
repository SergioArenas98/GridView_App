import { describe, it, expect } from 'vitest';
import { IdentityStore } from '../../../src/identity/store';
import { sqliteHost } from './sqlite-support';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { context, driverInput, driversEnvelope } from '../discovery/support';
export const installation = '33333333-3333-4333-8333-333333333333';
export async function observation(name = 'Synthetic', ordinal = 1) {
  const body = driversEnvelope([
    { driverId: 'synthetic_unknown', givenName: name },
  ]);
  const result = await extractJolpicaObservations(
    driverInput(body),
    body,
    { ...context, requestOrdinal: ordinal },
    providerMappingRegistry(),
  );
  return JSON.parse(JSON.stringify(result.observations[0]));
}
describe('real SQLite candidate transactions', () => {
  it('persists a first observation and replays it without new evidence or notifications', async () => {
    const host = sqliteHost();
    const store = new IdentityStore(host.storage, installation);
    const o = await observation();
    const request = { observations: [o] };
    expect(await store.observe(request)).toMatchObject({
      persisted: 1,
      created: 1,
      replayed: 0,
    });
    expect(await store.observe(request)).toMatchObject({
      persisted: 0,
      created: 0,
      replayed: 1,
    });
    const c = store.inspect({
      candidateId: o.candidateId,
      section: 'candidate',
      cursor: null,
      limit: 16,
    });
    expect(c.candidate).toMatchObject({
      observationCount: 1,
      distinctEvidenceCount: 1,
      notificationGeneration: 1,
      state: 'unresolved',
    });
    host.db.close();
  });
  it('rolls candidate creation and notification back when an observation insert fails', async () => {
    const host = sqliteHost();
    const store = new IdentityStore(host.storage, installation);
    host.failObservation(true);
    await expect(
      store.observe({ observations: [await observation()] }),
    ).rejects.toThrow();
    expect(store.health().candidates).toBe(0);
    host.db.close();
  });
  it('deduplicates concurrent creation and accumulates new material evidence', async () => {
    const host = sqliteHost();
    const store = new IdentityStore(host.storage, installation);
    const a = await observation(),
      b = await observation('Other', 2);
    await Promise.all([
      store.observe({ observations: [a] }),
      store.observe({ observations: [b] }),
    ]);
    expect(store.health().candidates).toBe(1);
    expect(
      store.inspect({
        candidateId: a.candidateId,
        section: 'candidate',
        cursor: null,
        limit: 16,
      }).candidate,
    ).toMatchObject({
      observationCount: 2,
      distinctEvidenceCount: 2,
      notificationGeneration: 1,
      newEvidence: true,
    });
    host.db.close();
  });
});
