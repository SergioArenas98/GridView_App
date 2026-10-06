/**
 * The `ReconciliationLedger` Durable Object seam: the class, its command
 * surface, and the client a later change would hold.
 *
 * The whole seam is exercised without any provisioned resource: a fake
 * namespace dispatches to a real object instance over an in-memory,
 * transactional host with the `transactionSync`/`kv` shape SQLite-backed
 * Durable Object storage exposes. Nothing here proves Cloudflare platform
 * behaviour - the input gate, hibernation or eviction.
 */

import { describe, expect, it } from 'vitest';

import type { SequencerDurableHost } from '../../../../src/publication/sequencer/hosts';
import {
  DurableObjectReconciliationLedger,
  LEASE_TTL_MS,
  RECONCILIATION_LEDGER_OBJECT_NAME,
  ReconciliationLedger,
  ledgerCommands,
  ledgerRequestUrl,
  type LedgerNamespace,
} from '../../../../src/sync/coordinated/ledger';
import { MutableClock } from '../../../publication/sequencer/support';
import {
  OTHER_SEASON,
  SEASON,
  START,
  classification,
  commitRequest,
  rev,
  stagedClassification,
  write,
} from './support';

function durableHost(): SequencerDurableHost & { keys(): string[] } {
  let committed = new Map<string, unknown>();
  let working: Map<string, unknown> | null = null;
  const current = () => working ?? committed;
  return {
    keys: () => [...committed.keys()].sort(),
    storage: {
      transactionSync<T>(closure: () => T): T {
        working = new Map(committed);
        try {
          const result = closure();
          committed = working;
          return result;
        } finally {
          working = null;
        }
      },
      kv: {
        get: <T>(key: string) => current().get(key) as T | undefined,
        put: <T>(key: string, value: T) => {
          current().set(key, structuredClone(value));
        },
        delete: (key: string) => current().delete(key),
        list: <T>({ prefix = '' }: { prefix?: string } = {}) =>
          [...current().entries()].filter(([key]) =>
            key.startsWith(prefix),
          ) as [string, T][],
      },
    },
  };
}

/**
 * A namespace holding objects by name. `restart()` replaces every object
 * instance over the same durable storage, as an eviction or redeploy would.
 */
function fakeNamespace(clock: MutableClock) {
  const hosts = new Map<string, ReturnType<typeof durableHost>>();
  let objects = new Map<string, ReconciliationLedger>();
  const names: string[] = [];
  const namespace: LedgerNamespace & {
    hosts: typeof hosts;
    names: string[];
    restart(): void;
  } = {
    hosts,
    names,
    idFromName: (name: string) => {
      names.push(name);
      return name;
    },
    get: (id: unknown) => {
      const name = String(id);
      if (!hosts.has(name)) hosts.set(name, durableHost());
      if (!objects.has(name)) {
        objects.set(
          name,
          new ReconciliationLedger(hosts.get(name)!, { clock }),
        );
      }
      const object = objects.get(name)!;
      return {
        fetch: (url: string, init: RequestInit) =>
          object.fetch(new Request(url, init)),
      };
    },
    restart: () => {
      objects = new Map();
    },
  };
  return namespace;
}

/** A namespace whose one object answers with a fixed response. */
function answering(
  response: () => Response | Promise<Response>,
): LedgerNamespace {
  return {
    idFromName: (name) => name,
    get: () => ({ fetch: async () => response() }),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ReconciliationLedger durable object', () => {
  it('is one global object, addressed by the stable name reconciliation', async () => {
    const clock = new MutableClock(new Date(START));
    const namespace = fakeNamespace(clock);
    const ledger = new DurableObjectReconciliationLedger(namespace);

    await ledger.acquireLease(SEASON);
    await ledger.acquireLease(OTHER_SEASON);
    await ledger.readSeason(SEASON);

    expect(RECONCILIATION_LEDGER_OBJECT_NAME).toBe('reconciliation');
    expect(new Set(namespace.names)).toEqual(new Set(['reconciliation']));
    expect([...namespace.hosts.keys()]).toEqual(['reconciliation']);
    expect(ledgerCommands).toEqual([
      'read-season',
      'acquire-lease',
      'release-lease',
      'commit',
      'reconcile-published',
      'operate',
      'dispose',
      'verify',
      'rotate-verifications',
    ]);
  });

  it('answers the whole storage protocol through the client', async () => {
    const clock = new MutableClock(new Date(START));
    const namespace = fakeNamespace(clock);
    const ledger = new DurableObjectReconciliationLedger(namespace);

    const acquired = await ledger.acquireLease(SEASON);
    expect(acquired.outcome).toBe('acquired');
    if (acquired.outcome !== 'acquired') return;
    const token = { season: SEASON, fence: acquired.lease.fence };
    expect(await ledger.acquireLease(SEASON)).toEqual({
      outcome: 'rejected',
      reason: 'lease-held',
    });

    const committed = await ledger.commit(
      commitRequest(token, {
        classifications: [write(stagedClassification(1, rev('staged')))],
        backlogInsertions: [{ round: 1, revision: rev('staged') }],
      }),
    );
    expect(committed.outcome).toBe('committed');

    const reconciled = await ledger.reconcilePublishedRevisions({
      lease: token,
      activeVersion: 'v-1',
      revisions: [
        { round: 1, revision: rev('r1') },
        { round: 4, revision: rev('r4') },
      ],
    });
    expect(
      reconciled.outcome === 'reconciled' && reconciled.unrecordedRounds,
    ).toEqual([4]);

    expect(await ledger.releaseLease(token)).toEqual({ outcome: 'released' });
    expect(
      await ledger.commit(
        commitRequest(token, {
          classifications: [write(classification(2))],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'lease-not-held' });
  });

  it('keeps every record across an object restart over the same storage', async () => {
    const clock = new MutableClock(new Date(START));
    const namespace = fakeNamespace(clock);
    const ledger = new DurableObjectReconciliationLedger(namespace);
    const acquired = await ledger.acquireLease(SEASON);
    if (acquired.outcome !== 'acquired') throw new Error('not acquired');
    const token = { season: SEASON, fence: acquired.lease.fence };
    await ledger.commit(
      commitRequest(token, { classifications: [write(classification(1))] }),
    );
    const before = await ledger.readSeason(SEASON);

    namespace.restart();

    expect(await ledger.readSeason(SEASON)).toEqual(before);
    // The lease survived too: the restarted object still fences.
    expect(await ledger.acquireLease(SEASON)).toEqual({
      outcome: 'rejected',
      reason: 'lease-held',
    });
    clock.advance(LEASE_TTL_MS);
    const retaken = await ledger.acquireLease(SEASON);
    expect(retaken.outcome === 'acquired' && retaken.lease.fence).toBe(2);
    expect(
      await ledger.commit(
        commitRequest(token, {
          classifications: [write(classification(1, { checkIndex: 1 }), 1)],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'lease-superseded' });
  });

  it('refuses malformed calls without touching storage', async () => {
    const host = durableHost();
    const object = new ReconciliationLedger(host);
    const post = (body: string) =>
      object.fetch(new Request(ledgerRequestUrl, { method: 'POST', body }));

    expect((await object.fetch(new Request(ledgerRequestUrl))).status).toBe(
      405,
    );
    expect((await post('{not json')).status).toBe(400);
    expect((await post(JSON.stringify({ command: 'drop-all' }))).status).toBe(
      400,
    );
    expect((await post('[]')).status).toBe(400);
    const refused = await post(
      JSON.stringify({ command: 'commit', payload: { lease: 'x' } }),
    );
    expect(refused.status).toBe(200);
    expect(await refused.json()).toEqual({
      outcome: 'rejected',
      reason: 'invalid-request',
    });
    expect(host.keys()).toEqual([]);
  });

  it('answers a storage failure as unavailable without leaking the error', async () => {
    const host = durableHost();
    host.storage.transactionSync = () => {
      throw new Error('SQLITE_FULL at key lease:2026');
    };
    const object = new ReconciliationLedger(host);
    const response = await object.fetch(
      new Request(ledgerRequestUrl, {
        method: 'POST',
        body: JSON.stringify({
          command: 'acquire-lease',
          payload: { season: SEASON },
        }),
      }),
    );
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: 'ledger-unavailable' });
    expect(text).not.toContain('SQLITE');
  });
});

describe('the client fails closed', () => {
  const token = { season: SEASON, fence: 1 };
  const commit = commitRequest(token, {
    classifications: [write(classification(1))],
  });
  const reconcile = { lease: token, activeVersion: 'v-1', revisions: [] };

  it.each([
    ['a transport failure', () => Promise.reject(new Error('network'))],
    ['a 500', () => json({ error: 'ledger-unavailable' }, 500)],
    ['a non-JSON body', () => new Response('<html>')],
    ['an unknown outcome', () => json({ outcome: 'maybe' })],
    [
      'an unknown rejection reason',
      () => json({ outcome: 'rejected', reason: 'because' }),
    ],
    [
      'a rejection with an extra field',
      () => json({ outcome: 'rejected', reason: 'lease-held', detail: 'x' }),
    ],
  ])(
    'maps %s to unavailable for reads and uncertain for writes',
    async (_label, respond) => {
      const ledger = new DurableObjectReconciliationLedger(
        answering(respond as () => Response),
      );
      expect(await ledger.readSeason(SEASON)).toEqual({
        outcome: 'unavailable',
      });
      expect(await ledger.acquireLease(SEASON)).toEqual({
        outcome: 'unavailable',
      });
      expect(await ledger.releaseLease(token)).toEqual({
        outcome: 'unavailable',
      });
      expect(await ledger.commit(commit)).toEqual({ outcome: 'uncertain' });
      expect(await ledger.reconcilePublishedRevisions(reconcile)).toEqual({
        outcome: 'uncertain',
      });
    },
  );

  it('never acts on a snapshot of another season', async () => {
    const clock = new MutableClock(new Date(START));
    const real = fakeNamespace(clock);
    const other = await new DurableObjectReconciliationLedger(real).readSeason(
      OTHER_SEASON,
    );
    if (other.outcome !== 'read') throw new Error('not read');

    const skewed = new DurableObjectReconciliationLedger(
      answering(() => json({ outcome: 'read', snapshot: other.snapshot })),
    );
    expect(await skewed.readSeason(SEASON)).toEqual({ outcome: 'unavailable' });

    const committedSkew = new DurableObjectReconciliationLedger(
      answering(() => json({ outcome: 'committed', snapshot: other.snapshot })),
    );
    expect(await committedSkew.commit(commit)).toEqual({
      outcome: 'uncertain',
    });
  });

  it('never acts on a snapshot carrying a value outside the model', async () => {
    const clock = new MutableClock(new Date(START));
    const ledger = new DurableObjectReconciliationLedger(fakeNamespace(clock));
    const acquired = await ledger.acquireLease(SEASON);
    if (acquired.outcome !== 'acquired') throw new Error('not acquired');
    const tampered = {
      ...acquired.snapshot,
      classifications: [
        { version: 1, record: { ...classification(1), body: '{"MRData":{}}' } },
      ],
    };
    const client = new DurableObjectReconciliationLedger(
      answering(() => json({ outcome: 'read', snapshot: tampered })),
    );
    expect(await client.readSeason(SEASON)).toEqual({ outcome: 'unavailable' });
  });

  it('passes a decoded rejection through unchanged', async () => {
    const ledger = new DurableObjectReconciliationLedger(
      answering(() =>
        json({ outcome: 'rejected', reason: 'backlog-capacity-exceeded' }),
      ),
    );
    expect(await ledger.commit(commit)).toEqual({
      outcome: 'rejected',
      reason: 'backlog-capacity-exceeded',
    });
  });
});

describe('operator transitions through the client', () => {
  const OPERATION = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d';

  /** `namespace`, but every answer is lost after the object ran it. */
  function losingAnswers(namespace: LedgerNamespace): LedgerNamespace {
    return {
      idFromName: (name) => namespace.idFromName(name),
      get: (id) => ({
        fetch: async (url: string, init: RequestInit) => {
          await namespace.get(id).fetch(url, init);
          throw new TypeError('connection lost');
        },
      }),
    };
  }

  it('applies once: a lost answer is uncertain, and resending it is already applied', async () => {
    const clock = new MutableClock(new Date(START));
    const namespace = fakeNamespace(clock);
    const ledger = new DurableObjectReconciliationLedger(namespace);
    const acquired = await ledger.acquireLease(SEASON);
    if (acquired.outcome !== 'acquired') throw new Error('not acquired');
    const token = { season: SEASON, fence: acquired.lease.fence };
    const hold = {
      lease: token,
      action: 'hold' as const,
      operationId: OPERATION,
      authMethod: 'shared-admin-token' as const,
      expectedVersion: 0,
    };

    const lost = new DurableObjectReconciliationLedger(
      losingAnswers(namespace),
    );
    expect(await lost.operate(hold)).toEqual({ outcome: 'uncertain' });

    const resent = await ledger.operate(hold);
    expect(resent.outcome).toBe('already-applied');
    expect(
      resent.outcome === 'already-applied' && resent.snapshot.seasonRecord,
    ).toMatchObject({
      version: 1,
      record: { operatorHold: { since: START, operationId: OPERATION } },
    });
  });

  it('disposes of a staged correction through the object', async () => {
    const clock = new MutableClock(new Date(START));
    const ledger = new DurableObjectReconciliationLedger(fakeNamespace(clock));
    const acquired = await ledger.acquireLease(SEASON);
    if (acquired.outcome !== 'acquired') throw new Error('not acquired');
    const token = { season: SEASON, fence: acquired.lease.fence };
    await ledger.commit(
      commitRequest(token, {
        classifications: [write(stagedClassification(1, rev('staged')))],
        backlogInsertions: [{ round: 1, revision: rev('staged') }],
      }),
    );

    const outcome = await ledger.dispose({
      lease: token,
      round: 1,
      action: 'retain-published',
      operationId: OPERATION,
      authMethod: 'shared-admin-token',
      expected: {
        recordVersion: 1,
        contentRevision: rev('content-1'),
        stagedRevision: rev('staged'),
        competingRevision: null,
      },
    });
    expect(outcome.outcome).toBe('applied');
    expect(
      outcome.outcome === 'applied' && outcome.snapshot.backlog.count,
    ).toBe(0);
  });

  it('never reads an undecodable or foreign answer as applied', async () => {
    const request = {
      lease: { season: SEASON, fence: 1 },
      action: 'hold' as const,
      operationId: OPERATION,
      authMethod: 'shared-admin-token' as const,
      expectedVersion: 0,
    };
    for (const body of [
      { outcome: 'applied' },
      { outcome: 'applied', snapshot: { season: OTHER_SEASON } },
      { outcome: 'done', snapshot: null },
    ]) {
      const ledger = new DurableObjectReconciliationLedger(
        answering(() => json(body)),
      );
      expect(await ledger.operate(request)).toEqual({ outcome: 'uncertain' });
    }
    const refusing = new DurableObjectReconciliationLedger(
      answering(() =>
        json({ outcome: 'rejected', reason: 'operation-id-reused' }),
      ),
    );
    expect(await refusing.operate(request)).toEqual({
      outcome: 'rejected',
      reason: 'operation-id-reused',
    });
  });
});
