/**
 * The sequencer's genesis transitions (ADR 0025 D12, "Amendment (2026-10-20):
 * production genesis"): `commitGenesis`, a `genesis` season's first `prepare`
 * against the empty predecessor, the `finalize` that makes it `active`, and
 * every transition genesis must never enable.
 *
 * Deterministic: the clock, tokens and version components are injected, and
 * nothing here touches Workers KV, a binding or the network.
 */

import { describe, expect, it } from 'vitest';

import {
  authorityStorageKey,
  committedKeyPrefix,
  decodeSeasonAuthority,
  decodeSeasonGenesisOutcome,
  DurableObjectSeasonPublicationSequencer,
  MemorySequencerHost,
  operationStorageKey,
  pendingCleanupStorageKey,
  SeasonPublicationSequencer,
  sequencerRequestUrl,
  type ExpectedPredecessor,
  type SeasonGenesisRequest,
  type SequencerDurableHost,
  type SequencerNamespace,
} from '../../../src/publication/sequencer';
import {
  FINGERPRINT,
  OTHER_SEASON,
  SEASON,
  activeSequencer,
  commitment,
  counterSource,
  hexCounterSource,
  keyRevision,
  makeSequencer,
  prepareRequest,
  rev,
  seedFor,
  type Harness,
} from './support';

const GENESIS = 'genesis1:aaaa';
const OTHER_GENESIS = 'genesis1:bbbb';
const EMPTY: ExpectedPredecessor = { activeVersion: null, guardDocuments: [] };

function genesisRequest(
  overrides: Partial<SeasonGenesisRequest> = {},
): SeasonGenesisRequest {
  return { season: SEASON, genesisFingerprint: GENESIS, ...overrides };
}

function genesisSequencer(): Harness {
  const harness = makeSequencer();
  expect(harness.sequencer.commitGenesis(genesisRequest())).toEqual({
    outcome: 'created',
  });
  return harness;
}

function snapshot(host: MemorySequencerHost): [string, unknown][] {
  return host.committedKeys().map((key) => [key, host.peek(key)]);
}

/** Prepares and finalizes the first release against the empty predecessor. */
function commitFirstRelease(harness: Harness): string {
  const prepared = harness.sequencer.prepare(
    prepareRequest({ expectedPredecessor: EMPTY }),
  );
  if (prepared.outcome !== 'prepared') {
    throw new Error(`prepare failed: ${JSON.stringify(prepared)}`);
  }
  const finalized = harness.sequencer.finalize({
    season: SEASON,
    operationEpoch: prepared.operationEpoch,
    operationToken: prepared.operationToken,
    completionAttestation: { manifestCommitment: commitment('manifest-1') },
  });
  if (finalized.outcome !== 'committed') {
    throw new Error(`finalize failed: ${JSON.stringify(finalized)}`);
  }
  return prepared.candidateVersion;
}

describe('commitGenesis', () => {
  it('records an authoritative season with no release and nothing else', () => {
    const { host, sequencer } = genesisSequencer();
    expect(sequencer.readAuthority(SEASON)).toEqual({
      cutoverState: 'genesis',
      authoritative: true,
      activeVersion: null,
      previousVersion: null,
      cutoverFingerprint: GENESIS,
    });
    expect(host.committedKeys()).toEqual([authorityStorageKey]);
    expect(host.peek(authorityStorageKey)).toEqual({
      season: SEASON,
      cutoverState: 'genesis',
      activeVersion: null,
      previousVersion: null,
      committedSourceOrderingInput: null,
      seasonSnapshotObservedAtHighWaterMark: null,
      lastOperationEpoch: 0,
      cutoverFingerprint: GENESIS,
    });
  });

  it('answers an identical retry from durable state and writes nothing', () => {
    const { host, sequencer } = genesisSequencer();
    const before = snapshot(host);
    expect(sequencer.commitGenesis(genesisRequest())).toEqual({
      outcome: 'already-genesis',
    });
    expect(snapshot(host)).toEqual(before);
  });

  it('reports a retry after the first release as already active', () => {
    const harness = genesisSequencer();
    commitFirstRelease(harness);
    const before = snapshot(harness.host);
    expect(harness.sequencer.commitGenesis(genesisRequest())).toEqual({
      outcome: 'already-active',
    });
    expect(snapshot(harness.host)).toEqual(before);
  });

  it('refuses a genesis under another fingerprint and keeps the first', () => {
    const { host, sequencer } = genesisSequencer();
    const before = snapshot(host);
    expect(
      sequencer.commitGenesis(
        genesisRequest({ genesisFingerprint: OTHER_GENESIS }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'sequencer-state-present' });
    expect(snapshot(host)).toEqual(before);
  });

  it('refuses a season with a seed or a migrated release', () => {
    for (const harness of [
      (() => {
        const seeded = makeSequencer();
        seeded.sequencer.seedCutover(seedFor());
        return seeded;
      })(),
      activeSequencer(),
    ]) {
      const before = snapshot(harness.host);
      expect(harness.sequencer.commitGenesis(genesisRequest())).toEqual({
        outcome: 'rejected',
        reason: 'sequencer-state-present',
      });
      // The seed's own fingerprint is never a genesis fingerprint, so a
      // migrated season can never be answered as an existing genesis.
      expect(
        harness.sequencer.commitGenesis(
          genesisRequest({ genesisFingerprint: FINGERPRINT }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'invalid-genesis-fingerprint' });
      expect(snapshot(harness.host)).toEqual(before);
    }
  });

  it.each([
    ['an operation record', operationStorageKey],
    ['a pending cleanup', pendingCleanupStorageKey],
    ['a committed per-key row', `${committedKeyPrefix}calendar`],
    ['a prepared per-key row', 'prepared/calendar'],
  ])('refuses an object holding %s without an authority record', (_l, key) => {
    const { host, sequencer } = makeSequencer();
    host.poke(key, { anything: true });
    const before = snapshot(host);
    expect(sequencer.commitGenesis(genesisRequest())).toEqual({
      outcome: 'rejected',
      reason: 'sequencer-state-present',
    });
    expect(snapshot(host)).toEqual(before);
  });

  it('never overwrites a corrupt authority record', () => {
    const { host, sequencer } = makeSequencer();
    host.poke(authorityStorageKey, { season: SEASON, cutoverState: 'bogus' });
    const before = snapshot(host);
    expect(sequencer.commitGenesis(genesisRequest())).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
    expect(snapshot(host)).toEqual(before);
  });

  it('refuses another season and malformed input before any write', () => {
    const { host, sequencer } = genesisSequencer();
    const before = snapshot(host);
    expect(
      sequencer.commitGenesis(genesisRequest({ season: OTHER_SEASON })),
    ).toEqual({ outcome: 'rejected', reason: 'season-mismatch' });
    expect(
      makeSequencer().sequencer.commitGenesis(genesisRequest({ season: 26 })),
    ).toEqual({ outcome: 'rejected', reason: 'invalid-season' });
    for (const genesisFingerprint of [
      '',
      'has space',
      `genesis1:${'x'.repeat(120)}`,
      'cutover1:aaaa',
      'genesis1:',
    ]) {
      expect(
        makeSequencer().sequencer.commitGenesis(
          genesisRequest({ genesisFingerprint }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'invalid-genesis-fingerprint' });
    }
    expect(snapshot(host)).toEqual(before);
  });

  it('writes nothing when the transaction fails', () => {
    const host = new MemorySequencerHost();
    const failing = {
      transactionSync<T>(
        run: Parameters<MemorySequencerHost['transactionSync']>[0],
      ): T {
        return host.transactionSync((store) => {
          run(store);
          throw new Error('simulated storage failure');
        }) as T;
      },
    };
    const { sequencer } = makeSequencer({
      host: failing as MemorySequencerHost,
    });
    expect(() => sequencer.commitGenesis(genesisRequest())).toThrow();
    expect(host.committedKeys()).toEqual([]);
    // A retry on healthy storage then succeeds exactly once.
    const healthy = makeSequencer({ host });
    expect(healthy.sequencer.commitGenesis(genesisRequest())).toEqual({
      outcome: 'created',
    });
  });

  it('serializes overlapping genesis requests: one creates, the same identity replays', () => {
    const { sequencer } = makeSequencer();
    expect(sequencer.commitGenesis(genesisRequest())).toEqual({
      outcome: 'created',
    });
    expect(sequencer.commitGenesis(genesisRequest())).toEqual({
      outcome: 'already-genesis',
    });
    expect(
      sequencer.commitGenesis(
        genesisRequest({ genesisFingerprint: OTHER_GENESIS }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'sequencer-state-present' });
  });
});

describe('a genesis season publishes against the empty predecessor', () => {
  it('prepares the first release with no prior version', () => {
    const { sequencer } = genesisSequencer();
    const prepared = sequencer.prepare(
      prepareRequest({ expectedPredecessor: EMPTY }),
    );
    expect(prepared).toMatchObject({
      outcome: 'prepared',
      operationEpoch: 1,
      priorVersion: null,
    });
  });

  it('refuses a named predecessor, and a null one naming results documents', () => {
    const { host, sequencer } = genesisSequencer();
    const before = snapshot(host);
    expect(
      sequencer.prepare(
        prepareRequest({
          expectedPredecessor: {
            activeVersion: 'v-imagined',
            guardDocuments: [],
          },
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'stale-predecessor' });
    expect(
      sequencer.prepare(
        prepareRequest({
          expectedPredecessor: {
            activeVersion: null,
            guardDocuments: [
              keyRevision('grand-prix:1:results', rev('results-1')),
            ],
          },
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'invalid-expected-predecessor' });
    expect(snapshot(host)).toEqual(before);
  });

  it('refuses a rollback before any release exists', () => {
    const { host, sequencer } = genesisSequencer();
    const before = snapshot(host);
    expect(
      sequencer.prepare(
        prepareRequest({
          operationKind: 'rollback-republication',
          expectedPredecessor: EMPTY,
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'no-committed-release' });
    expect(snapshot(host)).toEqual(before);
  });

  it('commits the first release as active with no previous version', () => {
    const harness = genesisSequencer();
    const version = commitFirstRelease(harness);
    expect(harness.sequencer.readAuthority(SEASON)).toEqual({
      cutoverState: 'active',
      authoritative: true,
      activeVersion: version,
      previousVersion: null,
      cutoverFingerprint: GENESIS,
    });
    expect(harness.host.peek(authorityStorageKey)).toMatchObject({
      cutoverState: 'active',
      committedSourceOrderingInput: '2026-09-02T00:00:00.000Z',
      seasonSnapshotObservedAtHighWaterMark: '2026-09-02T00:00:00.000Z',
      lastOperationEpoch: 1,
    });
  });

  it('refuses a retry against the empty predecessor once the first release committed', () => {
    const harness = genesisSequencer();
    const version = commitFirstRelease(harness);
    expect(
      harness.sequencer.prepare(prepareRequest({ expectedPredecessor: EMPTY })),
    ).toEqual({ outcome: 'rejected', reason: 'stale-predecessor' });
    // The next release names the first one, as any active season's does.
    expect(
      harness.sequencer.prepare(
        prepareRequest({
          expectedPredecessor: { activeVersion: version, guardDocuments: [] },
        }),
      ),
    ).toMatchObject({ outcome: 'prepared', priorVersion: version });
  });

  it('admits one of two concurrent first releases', () => {
    const { sequencer } = genesisSequencer();
    const first = sequencer.prepare(
      prepareRequest({ expectedPredecessor: EMPTY }),
    );
    const second = sequencer.prepare(
      prepareRequest({ expectedPredecessor: EMPTY }),
    );
    expect(first.outcome).toBe('prepared');
    expect(second).toMatchObject({
      outcome: 'rejected',
      reason: 'operation-in-progress',
    });
  });

  it('keeps the season in genesis after a cancelled first release', () => {
    const { sequencer } = genesisSequencer();
    const prepared = sequencer.prepare(
      prepareRequest({ expectedPredecessor: EMPTY }),
    );
    if (prepared.outcome !== 'prepared') throw new Error('not prepared');
    expect(
      sequencer.cancel({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
      }),
    ).toMatchObject({ outcome: 'cancelled' });
    expect(sequencer.readAuthority(SEASON).cutoverState).toBe('genesis');
    // The cancelled candidate is collectable, and the next attempt prepares.
    expect(
      sequencer.authorizeCleanup({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
        candidateVersion: prepared.candidateVersion,
      }),
    ).toEqual({
      outcome: 'authorized',
      candidateVersion: prepared.candidateVersion,
    });
    expect(
      sequencer.prepare(prepareRequest({ expectedPredecessor: EMPTY })),
    ).toMatchObject({ outcome: 'prepared', operationEpoch: 2 });
  });

  it('stays in genesis when the first finalize fails', () => {
    const harness = genesisSequencer();
    const prepared = harness.sequencer.prepare(
      prepareRequest({ expectedPredecessor: EMPTY }),
    );
    if (prepared.outcome !== 'prepared') throw new Error('not prepared');
    expect(
      harness.sequencer.finalize({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
        completionAttestation: { manifestCommitment: commitment('other') },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'manifest-commitment-mismatch' });
    expect(harness.sequencer.readAuthority(SEASON).cutoverState).toBe(
      'genesis',
    );
  });
});

describe('genesis enables no other transition', () => {
  it('reserves the genesis prefix: no seed may carry it', () => {
    const { host, sequencer } = makeSequencer();
    expect(
      sequencer.seedCutover(seedFor({ cutoverFingerprint: GENESIS })),
    ).toEqual({ outcome: 'rejected', reason: 'invalid-cutover-fingerprint' });
    expect(host.committedKeys()).toEqual([]);
  });

  it('is never activated, seeded or recovered as a seed', () => {
    const { host, sequencer } = genesisSequencer();
    const before = snapshot(host);
    expect(
      sequencer.activateCutover({
        season: SEASON,
        cutoverFingerprint: GENESIS,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'cutover-not-seeded' });
    expect(sequencer.seedCutover(seedFor())).toEqual({
      outcome: 'rejected',
      reason: 'conflicting-cutover-seed',
    });
    expect(
      sequencer.recoverCutoverSeed({
        season: SEASON,
        cutoverFingerprint: GENESIS,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'conflicting-cutover-seed' });
    expect(snapshot(host)).toEqual(before);
  });

  it('reads a genesis record carrying any version or floor as corrupt', () => {
    for (const field of [
      { activeVersion: 'v-1' },
      { previousVersion: 'v-0' },
      { committedSourceOrderingInput: '2026-09-01T00:00:00.000Z' },
      { seasonSnapshotObservedAtHighWaterMark: '2026-09-01T00:00:00.000Z' },
      { cutoverFingerprint: null },
    ]) {
      const { host, sequencer } = genesisSequencer();
      host.poke(authorityStorageKey, {
        ...(host.peek(authorityStorageKey) as object),
        ...field,
      });
      expect(sequencer.readAuthority(SEASON)).toEqual({
        cutoverState: 'unavailable',
        authoritative: false,
      });
      expect(
        sequencer.prepare(prepareRequest({ expectedPredecessor: EMPTY })),
      ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
    }
  });
});

describe('the wire never accepts an impossible genesis answer', () => {
  it('decodes exactly the genesis authority shape', () => {
    const valid = {
      cutoverState: 'genesis',
      authoritative: true,
      activeVersion: null,
      previousVersion: null,
      cutoverFingerprint: GENESIS,
    };
    expect(decodeSeasonAuthority(valid)).toEqual(valid);
    for (const tampered of [
      { ...valid, authoritative: false },
      { ...valid, activeVersion: 'v-1' },
      { ...valid, previousVersion: 'v-0' },
      { ...valid, cutoverFingerprint: '' },
    ]) {
      expect(decodeSeasonAuthority(tampered)).toBeNull();
    }
  });

  it('decodes the closed genesis outcomes and never `uncertain`', () => {
    for (const outcome of ['created', 'already-genesis', 'already-active']) {
      expect(decodeSeasonGenesisOutcome({ outcome })).toEqual({ outcome });
    }
    expect(
      decodeSeasonGenesisOutcome({
        outcome: 'rejected',
        reason: 'sequencer-state-present',
      }),
    ).toEqual({ outcome: 'rejected', reason: 'sequencer-state-present' });
    expect(decodeSeasonGenesisOutcome({ outcome: 'uncertain' })).toBeNull();
    expect(
      decodeSeasonGenesisOutcome({ outcome: 'rejected', reason: 'nope' }),
    ).toBeNull();
  });
});

/** An in-memory SQLite-shaped host, as `durable-object-port.test.ts` uses. */
function durableHost(): SequencerDurableHost {
  let committed = new Map<string, unknown>();
  let working: Map<string, unknown> | null = null;
  const current = () => working ?? committed;
  return {
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

/** One object; `loseNext` drops the next answer after the object applied it. */
function namespaceOverOneObject(): SequencerNamespace & { loseNext: boolean } {
  const object = new SeasonPublicationSequencer(durableHost(), {
    token: counterSource('token-'),
    opaqueVersionComponent: hexCounterSource(),
  });
  const namespace = {
    loseNext: false,
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (url: string, init: RequestInit) => {
        const response = await object.fetch(new Request(url, init));
        if (namespace.loseNext) {
          namespace.loseNext = false;
          throw new Error('simulated lost answer');
        }
        return response;
      },
    }),
  };
  return namespace;
}

describe('genesis over the Durable Object transport', () => {
  it('creates, replays and reports the genesis authority', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      namespaceOverOneObject(),
    );
    expect(await client.commitGenesis(genesisRequest())).toEqual({
      outcome: 'created',
    });
    expect(await client.commitGenesis(genesisRequest())).toEqual({
      outcome: 'already-genesis',
    });
    expect(await client.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'genesis',
      activeVersion: null,
    });
  });

  it('turns a lost answer into uncertain, never a rejection', async () => {
    const namespace = namespaceOverOneObject();
    const client = new DurableObjectSeasonPublicationSequencer(namespace);
    namespace.loseNext = true;
    expect(await client.commitGenesis(genesisRequest())).toEqual({
      outcome: 'uncertain',
    });
    // The write did land; the read that reconciles it sees the genesis.
    expect((await client.readAuthority(SEASON)).cutoverState).toBe('genesis');
  });

  it('binds a first prepare to the null predecessor end to end', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      namespaceOverOneObject(),
    );
    await client.commitGenesis(genesisRequest());
    expect(
      await client.prepare(prepareRequest({ expectedPredecessor: EMPTY })),
    ).toMatchObject({ outcome: 'prepared', priorVersion: null });
  });

  it('answers the command over the raw object interface', async () => {
    const object = new SeasonPublicationSequencer(durableHost());
    const response = await object.fetch(
      new Request(sequencerRequestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'commit-genesis',
          payload: genesisRequest(),
        }),
      }),
    );
    expect(await response.json()).toEqual({ outcome: 'created' });
  });
});
