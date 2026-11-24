import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdentityStore } from '../../../src/identity/store';
import { IdentityCatalog } from '../../../src/identity/durable-object';
import { IdentityClient } from '../../../src/identity/client';
import { resolveIdentityDiscoveryMode } from '../../../src/config/environment';
import { decodeIdentityResponse } from '../../../src/identity/response-decoders';
import { safeCopy } from '../../../src/identity/wire-decoders';
import { sqliteHost } from './sqlite-support';
import { context, driverInput, driversEnvelope } from '../discovery/support';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
const installation = '33333333-3333-4333-8333-333333333333';
async function observation(id = 'synthetic_boundary', ordinal = 1) {
  const body = driversEnvelope([{ driverId: id, givenName: 'Synthetic' }]);
  return JSON.parse(
    JSON.stringify(
      (
        await extractJolpicaObservations(
          driverInput(body),
          body,
          { ...context, requestOrdinal: ordinal },
          providerMappingRegistry(),
        )
      ).observations[0],
    ),
  );
}
afterEach(() => vi.useRealTimers());
describe('identity admission and protocol boundaries', () => {
  it('replays a reordered batch even after its occurrence-detail cap was applied', async () => {
    const h = sqliteHost(),
      s = new IdentityStore(h.storage, installation);
    const observations = [];
    for (let i = 1; i <= 100; i++)
      observations.push(await observation('synthetic_boundary', i));
    await s.observe({ observations });
    expect(s.health().observations).toBe(64);
    expect(
      await s.observe({ observations: [...observations].reverse() }),
    ).toMatchObject({ persisted: 0, replayed: 100 });
    expect(
      s.inspect({
        candidateId: observations[0].candidateId,
        section: 'candidate',
        cursor: null,
        limit: 16,
      }).candidate.observationCount,
    ).toBe(100);
    h.db.close();
  });
  it('defaults off and admits only the two reviewed discovery modes', () => {
    expect(resolveIdentityDiscoveryMode(undefined)).toBe('off');
    expect(resolveIdentityDiscoveryMode('off')).toBe('off');
    expect(resolveIdentityDiscoveryMode('shadow')).toBe('shadow');
    for (const s of ['', 'runtime', 'SHADOW', 'true'])
      expect(() => resolveIdentityDiscoveryMode(s)).toThrow();
  });
  it('does not execute JSON accessors or unsafe array elements', () => {
    const getter = vi.fn(() => {
      throw Error('sensitive');
    });
    const input = Object.defineProperty({}, 'observations', {
      enumerable: true,
      get: getter,
    });
    expect(() => safeCopy(input)).toThrow();
    expect(getter).not.toHaveBeenCalled();
    const rows = new Array(1);
    Object.defineProperty(rows, '0', { get: getter });
    expect(() => safeCopy(rows)).toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(() => safeCopy({ value: 'x'.repeat(256 * 1024 + 1) })).toThrow();
  });
  it('rejects mixed valid/invalid batches atomically and conflicting immutable occurrences', async () => {
    const h = sqliteHost(),
      s = new IdentityStore(h.storage, installation),
      o = await observation();
    await expect(s.observe({ observations: [o, {}] })).rejects.toThrow();
    expect(s.health().candidates).toBe(0);
    await s.observe({ observations: [o] });
    await expect(
      s.observe({
        observations: [{ ...o, observedAt: '2026-11-15T00:00:00Z' }],
      }),
    ).rejects.toThrow('conflict');
    expect(s.health().observations).toBe(1);
    expect(s.health().persisted).toBe(1);
    h.db.close();
  });
  it('resumes persisted housekeeping progress and retains original evidence provenance', async () => {
    const h = sqliteHost();
    let now = Date.parse(context.observedAt);
    const s = new IdentityStore(h.storage, installation, () => now);
    const observations = [];
    for (let i = 0; i < 51; i++)
      observations.push(await observation('synthetic_' + i));
    await s.observe({ observations });
    now += 366 * 86400000;
    const first = s.maintain();
    expect(first.processed).toBe(50);
    expect(first.more).toBe(true);
    const restarted = new IdentityStore(h.storage, installation, () => now);
    expect(restarted.health().maintenanceCursor).toBe(first.cursor);
    expect(restarted.maintain()).toMatchObject({
      processed: 1,
      more: false,
      cursor: '',
    });
    const detail = restarted.inspect({
      candidateId: observations[0].candidateId,
      section: 'evidence',
      cursor: null,
      limit: 16,
    });
    expect(detail.candidate.state).toBe('archived');
    expect(restarted.health().observations).toBe(0);
    expect(detail.items[0]).toMatchObject({
      source: {
        observationId: observations[0].observationId,
        provenance: { synthetic: true, transportKind: 'controlled' },
      },
    });
    h.db.close();
  });
  it.each(['rejected', 'quarantined', 'resolved', 'approved-pending'])(
    'archives only eligible inactive state %s',
    async (state) => {
      const h = sqliteHost();
      let now = Date.parse(context.observedAt);
      const s = new IdentityStore(h.storage, installation, () => now),
        o = await observation();
      await s.observe({ observations: [o] });
      h.db
        .prepare(
          "UPDATE identity_candidates SET body=json_set(body,'$.state',?)",
        )
        .run(state);
      h.db.prepare('UPDATE identity_observations SET protected=1').run();
      h.db.prepare('UPDATE identity_evidence SET protected=1').run();
      now += 366 * 86400000;
      s.maintain();
      const c = s.inspect({
        candidateId: o.candidateId,
        section: 'candidate',
        cursor: null,
        limit: 16,
      }).candidate;
      expect(c.state).toBe(
        state === 'rejected' || state === 'quarantined' ? 'archived' : state,
      );
      expect(s.health()).toMatchObject({ observations: 1, evidence: 1 });
      h.db.close();
    },
  );
  it('refuses new occurrences when all retained history is protected', async () => {
    const h = sqliteHost(),
      s = new IdentityStore(h.storage, installation);
    const batch = [];
    for (let i = 1; i <= 64; i++)
      batch.push(await observation('synthetic_boundary', i));
    await s.observe({ observations: batch });
    h.db.prepare('UPDATE identity_observations SET protected=1').run();
    expect(
      await s.observe({
        observations: [await observation('synthetic_boundary', 65)],
      }),
    ).toMatchObject({ persisted: 0, dropped: 1 });
    expect(s.health().observations).toBe(64);
    h.db.close();
  });
  it('does not postpone maintenance alarms on repeated admission', async () => {
    const h = sqliteHost();
    let alarm: number | null = null;
    const setAlarm = vi.fn(async (at: number) => {
      alarm = at;
    });
    const object = new IdentityCatalog(
      { storage: { ...h.storage, getAlarm: async () => alarm, setAlarm } },
      { IDENTITY_INSTALLATION_ID: installation },
    );
    const o = await observation();
    const call = () =>
      object.fetch(
        new Request('http://local', {
          method: 'POST',
          body: JSON.stringify({
            schemaVersion: 1,
            installationId: installation,
            command: 'observe-batch',
            payload: { observations: [o] },
          }),
        }),
      );
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    expect(setAlarm).toHaveBeenCalledTimes(1);
    await object.alarm();
    expect(setAlarm).toHaveBeenCalledTimes(2);
    h.db.close();
  });
  it('rejects oversized internal bodies and unsupported methods without writes', async () => {
    const h = sqliteHost();
    const object = new IdentityCatalog(
      { storage: h.storage },
      { IDENTITY_INSTALLATION_ID: installation },
    );
    expect((await object.fetch(new Request('http://local'))).status).toBe(400);
    expect(
      (
        await object.fetch(
          new Request('http://local', {
            method: 'POST',
            body: 'x'.repeat(256 * 1024 + 1),
          }),
        )
      ).status,
    ).toBe(400);
    expect(new IdentityStore(h.storage, installation).health().candidates).toBe(
      0,
    );
    h.db.close();
  });
  it('rejects unknown response fields and wrong installation envelopes', async () => {
    await expect(
      decodeIdentityResponse('observe-batch', {
        persisted: 1,
        replayed: 0,
        created: 1,
        dropped: 0,
        raw: 'private',
      }),
    ).rejects.toThrow();
    const c = new IdentityClient(
      {
        idFromName: (s) => s,
        get: () => ({
          fetch: async () =>
            Response.json({
              schemaVersion: 1,
              installationId: 'wrong',
              command: 'health',
              data: {},
            }),
        }),
      },
      installation,
    );
    await expect(c.health()).rejects.toThrow();
  });
});
