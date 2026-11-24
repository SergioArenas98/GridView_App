import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdentityStore } from '../../../src/identity/store';
import { IdentityError, identityLimits } from '../../../src/identity/port';
import { sqliteHost } from './sqlite-support';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import {
  context,
  driverInput,
  driversEnvelope,
  forbidNetwork,
} from '../discovery/support';
const installation = '33333333-3333-4333-8333-333333333333';
async function observation(
  name = 'Synthetic',
  ordinal = 1,
  id = 'synthetic_unknown',
) {
  const body = driversEnvelope([{ driverId: id, givenName: name }]);
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
afterEach(() => vi.unstubAllGlobals());
describe('bounded retention, lifecycle and wire validation', () => {
  it('separates material review versions from repeated sightings and survives host reconstruction', async () => {
    forbidNetwork();
    const h = sqliteHost();
    const s = new IdentityStore(h.storage, installation);
    const a = await observation();
    await s.observe({ observations: [a] });
    const detail = () =>
      s.inspect({
        candidateId: a.candidateId,
        section: 'candidate',
        cursor: null,
        limit: 16,
      }).candidate;
    const version = detail().recordVersion,
      head = detail().evidenceHead;
    await s.observe({ observations: [await observation('Synthetic', 2)] });
    expect(detail()).toMatchObject({
      recordVersion: version,
      evidenceHead: head,
      observationCount: 2,
      distinctEvidenceCount: 1,
      notificationGeneration: 1,
    });
    const restarted = new IdentityStore(h.storage, installation);
    expect(restarted.health().observations).toBe(2);
    h.db.close();
  });
  it('caps projections, quarantines unresolved overflow and retains all admitted evidence', async () => {
    const h = sqliteHost();
    const s = new IdentityStore(h.storage, installation);
    const batch = [];
    for (let i = 0; i < 33; i++)
      batch.push(await observation('Synthetic ' + i, i + 1));
    expect(await s.observe({ observations: batch })).toMatchObject({
      persisted: 32,
      dropped: 1,
    });
    const detail = s.inspect({
      candidateId: batch[0].candidateId,
      section: 'evidence',
      cursor: null,
      limit: 16,
    });
    expect(detail.candidate).toMatchObject({
      state: 'quarantined',
      overflowed: true,
      distinctEvidenceCount: 32,
    });
    expect(s.health().evidence).toBe(32);
    expect(detail.items).toHaveLength(16);
    expect(
      s.inspect({
        candidateId: batch[0].candidateId,
        section: 'evidence',
        cursor: detail.cursor,
        limit: 16,
      }).items,
    ).toHaveLength(16);
    h.db.close();
  });
  it.each(['rejected', 'quarantined', 'archived'])(
    'never reopens %s on new sightings',
    async (state) => {
      const h = sqliteHost();
      const s = new IdentityStore(h.storage, installation);
      const a = await observation();
      await s.observe({ observations: [a] });
      h.db
        .prepare(
          "UPDATE identity_candidates SET body=json_set(body,'$.state',?)",
        )
        .run(state);
      await s.observe({ observations: [await observation('New', 2)] });
      expect(
        s.inspect({
          candidateId: a.candidateId,
          section: 'candidate',
          cursor: null,
          limit: 16,
        }).candidate,
      ).toMatchObject({ state, notificationGeneration: 1, newEvidence: true });
      h.db.close();
    },
  );
  it('limits occurrences to 64, prunes 90-day detail and archives after 365 days without removing protected history', async () => {
    const h = sqliteHost();
    let now = Date.parse(context.observedAt);
    const s = new IdentityStore(h.storage, installation, () => now);
    const batch = [];
    for (let i = 0; i < 70; i++)
      batch.push(await observation('Synthetic', i + 1));
    await s.observe({ observations: batch });
    expect(s.health().observations).toBe(64);
    h.db
      .prepare(
        'UPDATE identity_observations SET protected=1 WHERE id=(SELECT id FROM identity_observations LIMIT 1)',
      )
      .run();
    h.db.prepare('UPDATE identity_evidence SET protected=1').run();
    now += 91 * 86400000;
    s.maintain();
    expect(s.health().observations).toBe(1);
    expect(s.health().evidence).toBe(1);
    expect(
      h.db.prepare('SELECT COUNT(*) n FROM identity_receipts').get()?.n,
    ).toBe(0);
    now += 275 * 86400000;
    s.maintain();
    const c = s.inspect({
      candidateId: batch[0].candidateId,
      section: 'candidate',
      cursor: null,
      limit: 16,
    }).candidate;
    expect(c).toMatchObject({
      state: 'archived',
      archivedState: 'unresolved',
      observationCount: 70,
    });
    h.db.close();
  });
  it('keeps notification acknowledgement durable and refuses stale generations', async () => {
    const h = sqliteHost();
    const s = new IdentityStore(h.storage, installation);
    const a = await observation();
    await s.observe({ observations: [a] });
    const actor = {
      principalId: 'reader-a',
      credentialId: 'credential-a',
      role: 'reader',
    } as const;
    expect(() =>
      s.acknowledge(
        { candidateId: a.candidateId, notificationGeneration: 2 },
        actor,
      ),
    ).toThrow(IdentityError);
    s.acknowledge(
      { candidateId: a.candidateId, notificationGeneration: 1 },
      actor,
    );
    const restart = new IdentityStore(h.storage, installation);
    await restart.observe({ observations: [await observation('New', 2)] });
    expect(
      restart.list({ cursor: null, limit: 50, unread: true }).items,
    ).toEqual([]);
    expect(
      restart.inspect({
        candidateId: a.candidateId,
        section: 'candidate',
        cursor: null,
        limit: 16,
      }).notification.acknowledgedBy,
    ).toBe('reader-a');
    h.db.close();
  });
  it('refuses installation and unsupported schema changes without overwriting metadata', () => {
    const h = sqliteHost();
    new IdentityStore(h.storage, installation);
    expect(
      () =>
        new IdentityStore(h.storage, '44444444-4444-4444-8444-444444444444'),
    ).toThrow('installation-mismatch');
    h.db.prepare('UPDATE identity_meta SET version=2').run();
    expect(() => new IdentityStore(h.storage, installation)).toThrow(
      'schema-version',
    );
    expect(
      h.db.prepare('SELECT version FROM identity_meta').get()?.version,
    ).toBe(2);
    h.db.close();
  });
  it('refuses a new key at the scope cap atomically without evicting tombstones', async () => {
    const h = sqliteHost();
    const s = new IdentityStore(h.storage, installation);
    const a = await observation();
    await s.observe({ observations: [a] });
    // Populate capacity state using SQL, independently of the admission algorithm.
    h.db.exec(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1023) INSERT INTO identity_candidates SELECT 'capacity-'||x,'capacity-key-'||x,2026,'jolpica',1,'2000-01-01','{}',2 FROM n",
    );
    expect(s.health().warning).toBe(true);
    await expect(
      s.observe({
        observations: [await observation('Other', 1, 'synthetic_other')],
      }),
    ).rejects.toThrow('capacity');
    expect(s.health().candidates).toBe(identityLimits.candidatesPerScope);
    expect(s.health().observations).toBe(1);
    h.db.close();
  });
  it('rolls back new data when the total logical budget is exhausted', async () => {
    const h = sqliteHost();
    const s = new IdentityStore(h.storage, installation);
    h.db
      .prepare('INSERT INTO identity_receipts VALUES(?,?,?,?)')
      .run('capacity', '2100-01-01', '{}', identityLimits.logicalBytes);
    await expect(
      s.observe({ observations: [await observation()] }),
    ).rejects.toThrow('capacity');
    expect(s.health().candidates).toBe(0);
    h.db.close();
  });
  it('rejects forged identifiers, extra evidence and oversized batches before writes', async () => {
    const h = sqliteHost();
    const s = new IdentityStore(h.storage, installation);
    const a = await observation();
    for (const bad of [
      { ...a, candidateId: 'sha256:' + '0'.repeat(64) },
      { ...a, evidence: { ...a.evidence, headers: 'secret' } },
      { ...a, extra: 'secret' },
      { ...a, provenance: { ...a.provenance, synthetic: false } },
    ])
      await expect(s.observe({ observations: [bad] })).rejects.toThrow();
    await expect(
      s.observe({ observations: Array(101).fill(a) }),
    ).rejects.toThrow();
    expect(s.health().candidates).toBe(0);
    h.db.close();
  });
});
