/**
 * Recovering an already committed cutover seed (PR #19 review F1,
 * ADR 0025 D12 step 10).
 *
 * `recoverCutoverSeed` is a read-only, request-bound operation: it returns the
 * committed seed only for the exact season and fingerprint asked about, so a
 * caller can retry an identical checkpoint without recomputing a high-water
 * mark from a later clock. It is not a second authority - it writes nothing,
 * answers only what `seedCutover` already committed, and never answers for a
 * different fingerprint - and a durable state it cannot fully reconcile is
 * `state-corrupt`, never a partial seed.
 *
 * Its Durable Object response is decoded completely, cross-checked, and bound
 * to the originating request before a caller sees it, exactly like every other
 * transport response.
 */

import { describe, expect, it } from 'vitest';

import {
  DurableObjectSeasonPublicationSequencer,
  LocalSeasonPublicationSequencer,
  SeasonPublicationSequencer,
  decodeCutoverSeedRecovery,
  type SequencerDurableHost,
  type SequencerNamespace,
} from '../../../src/publication/sequencer';
import {
  FINGERPRINT,
  OTHER_SEASON,
  SEASON,
  SEED_HIGH_WATER_MARK,
  keyState,
  makeSequencer,
  rev,
  seedFor,
} from './support';

const request = { season: SEASON, cutoverFingerprint: FINGERPRINT };

function durableState(host: ReturnType<typeof makeSequencer>['host']) {
  return host.committedKeys().map((key) => [key, host.peek(key)]);
}

describe('recoverCutoverSeed on the coordinator', () => {
  it('reports uninitialized before any seed exists', () => {
    const { sequencer, host } = makeSequencer();
    expect(sequencer.recoverCutoverSeed(request)).toEqual({
      outcome: 'uninitialized',
    });
    expect(host.committedKeys()).toEqual([]);
  });

  it('returns exactly the committed seed, and writes nothing', () => {
    const { sequencer, host } = makeSequencer();
    sequencer.seedCutover(seedFor());
    const before = durableState(host);

    const recovered = sequencer.recoverCutoverSeed(request);
    expect(recovered).toEqual({
      outcome: 'committed',
      cutoverState: 'seeded',
      seed: seedFor(),
    });
    expect(durableState(host)).toEqual(before);
    // Re-presenting it is the ordinary idempotent path.
    if (recovered.outcome !== 'committed') return;
    expect(sequencer.seedCutover(recovered.seed)).toEqual({
      outcome: 'already-seeded',
    });
  });

  it('reports the active state after activation', () => {
    const { sequencer } = makeSequencer();
    sequencer.seedCutover(seedFor());
    sequencer.activateCutover(request);
    expect(sequencer.recoverCutoverSeed(request)).toMatchObject({
      outcome: 'committed',
      cutoverState: 'active',
    });
  });

  it('never answers for a different fingerprint or season', () => {
    const { sequencer } = makeSequencer();
    sequencer.seedCutover(seedFor());
    expect(
      sequencer.recoverCutoverSeed({
        season: SEASON,
        cutoverFingerprint: 'cutover-2026-other',
      }),
    ).toEqual({ outcome: 'rejected', reason: 'conflicting-cutover-seed' });
    expect(
      sequencer.recoverCutoverSeed({
        season: OTHER_SEASON,
        cutoverFingerprint: FINGERPRINT,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'season-mismatch' });
  });

  it('rejects a malformed request before reading anything', () => {
    const { sequencer } = makeSequencer();
    expect(
      sequencer.recoverCutoverSeed({ season: 12, cutoverFingerprint: 'x' }),
    ).toEqual({ outcome: 'rejected', reason: 'invalid-season' });
    expect(
      sequencer.recoverCutoverSeed({
        season: SEASON,
        cutoverFingerprint: 'has space',
      }),
    ).toEqual({ outcome: 'rejected', reason: 'invalid-cutover-fingerprint' });
  });

  it('fails closed on corrupt or incomplete committed state', () => {
    const corruptKey = makeSequencer();
    corruptKey.sequencer.seedCutover(seedFor());
    corruptKey.host.poke('committed/calendar', { revision: 'nope' });
    expect(corruptKey.sequencer.recoverCutoverSeed(request)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });

    const missingKeys = makeSequencer();
    missingKeys.sequencer.seedCutover(seedFor());
    missingKeys.host.transactionSync((store) => {
      for (const [key] of [...store.list('committed/')]) store.delete(key);
    });
    // An authority record whose per-key state is gone is incomplete.
    expect(missingKeys.sequencer.recoverCutoverSeed(request)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });

    const corruptAuthority = makeSequencer();
    corruptAuthority.sequencer.seedCutover(seedFor());
    corruptAuthority.host.poke('authority', { season: SEASON });
    expect(corruptAuthority.sequencer.recoverCutoverSeed(request)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
  });

  it('fails closed when the committed floor is below its own per-key state', () => {
    const { sequencer, host } = makeSequencer();
    sequencer.seedCutover(seedFor());
    host.poke('authority', {
      ...(host.peek('authority') as Record<string, unknown>),
      seasonSnapshotObservedAtHighWaterMark: '2026-01-01T00:00:00.000Z',
    });
    expect(sequencer.recoverCutoverSeed(request)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
  });
});

/** A minimal SQLite-shaped storage for a real Durable Object instance. */
function durableHost(): SequencerDurableHost {
  const values = new Map<string, unknown>();
  return {
    storage: {
      transactionSync: <T>(closure: () => T): T => closure(),
      kv: {
        get: <T>(key: string) => values.get(key) as T | undefined,
        put: <T>(key: string, value: T) => {
          values.set(key, structuredClone(value));
        },
        delete: (key: string) => values.delete(key),
        list: <T>({ prefix = '' }: { prefix?: string } = {}) =>
          [...values.entries()].filter(([key]) => key.startsWith(prefix)) as [
            string,
            T,
          ][],
      },
    },
  };
}

function objectNamespace(): SequencerNamespace {
  const object = new SeasonPublicationSequencer(durableHost());
  return {
    idFromName: (name) => name,
    get: () => ({
      fetch: (url: string, init: RequestInit) =>
        object.fetch(new Request(url, init)),
    }),
  };
}

function responding(body: unknown, status = 200): SequencerNamespace {
  return {
    idFromName: (name) => name,
    get: () => ({
      fetch: async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    }),
  };
}

describe('local and Durable Object transport parity', () => {
  it('answers the same outcomes through both ports', async () => {
    const local = new LocalSeasonPublicationSequencer(
      makeSequencer().sequencer,
    );
    const remote = new DurableObjectSeasonPublicationSequencer(
      objectNamespace(),
    );

    for (const port of [local, remote]) {
      expect(await port.recoverCutoverSeed(request)).toEqual({
        outcome: 'uninitialized',
      });
      await port.seedCutover(seedFor());
      expect(await port.recoverCutoverSeed(request)).toEqual({
        outcome: 'committed',
        cutoverState: 'seeded',
        seed: seedFor(),
      });
      expect(
        await port.recoverCutoverSeed({
          season: SEASON,
          cutoverFingerprint: 'cutover-2026-other',
        }),
      ).toEqual({ outcome: 'rejected', reason: 'conflicting-cutover-seed' });
    }
  });
});

describe('decodeCutoverSeedRecovery', () => {
  const committed = {
    outcome: 'committed',
    cutoverState: 'seeded',
    seed: seedFor(),
  };
  const withSeed = (patch: Record<string, unknown>) => ({
    ...committed,
    seed: { ...seedFor(), ...patch },
  });

  const accepted: [string, unknown][] = [
    ['uninitialized', { outcome: 'uninitialized' }],
    ['a committed seeded seed', committed],
    ['a committed active seed', { ...committed, cutoverState: 'active' }],
    [
      'a known rejection',
      { outcome: 'rejected', reason: 'conflicting-cutover-seed' },
    ],
    ['forward-compatible extra fields', { ...committed, extra: true }],
  ];
  const rejected: [string, unknown][] = [
    ['a non-record', 'committed'],
    ['an unknown outcome', { outcome: 'recovered' }],
    ['an unknown rejection reason', { outcome: 'rejected', reason: 'meh' }],
    ['a committed outcome with no seed', { outcome: 'committed' }],
    [
      'an uninitialized cutover state',
      { ...committed, cutoverState: 'uninitialized' },
    ],
    ['a missing fingerprint', withSeed({ cutoverFingerprint: undefined })],
    ['an invalid season', withSeed({ season: 12 })],
    ['an invalid active version', withSeed({ activeVersion: '' })],
    ['an invalid previous version', withSeed({ previousVersion: 7 })],
    [
      'an unorderable ordering input',
      withSeed({ committedSourceOrderingInput: 'yesterday' }),
    ],
    [
      'an unorderable high-water mark',
      withSeed({ seasonSnapshotObservedAtHighWaterMark: 'soon' }),
    ],
    ['an empty per-key state', withSeed({ perKeyState: [] })],
    [
      'a duplicate per-key entry',
      withSeed({
        perKeyState: [
          keyState('calendar', rev('a'), SEED_HIGH_WATER_MARK),
          keyState('calendar', rev('b'), SEED_HIGH_WATER_MARK),
        ],
      }),
    ],
    [
      'a high-water mark below a per-key timestamp',
      withSeed({
        seasonSnapshotObservedAtHighWaterMark: '2026-01-01T00:00:00.000Z',
      }),
    ],
  ];

  for (const [name, input] of accepted) {
    it(`accepts ${name}`, () => {
      expect(decodeCutoverSeedRecovery(input)).not.toBeNull();
    });
  }
  for (const [name, input] of rejected) {
    it(`rejects ${name}`, () => {
      expect(decodeCutoverSeedRecovery(input)).toBeNull();
    });
  }
});

describe('the client binds a recovered seed to its request', () => {
  it('fails closed on a committed seed for another fingerprint', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding({
        outcome: 'committed',
        cutoverState: 'seeded',
        seed: seedFor({ cutoverFingerprint: 'cutover-2026-other' }),
      }),
    );
    expect(await client.recoverCutoverSeed(request)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
  });

  it('fails closed on a committed seed for another season', async () => {
    const client = new DurableObjectSeasonPublicationSequencer(
      responding({
        outcome: 'committed',
        cutoverState: 'seeded',
        seed: seedFor({ season: OTHER_SEASON }),
      }),
    );
    expect(await client.recoverCutoverSeed(request)).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
  });

  it('maps an undecodable or failed response to the bounded fallback', async () => {
    for (const namespace of [
      responding({ outcome: 'committed', cutoverState: 'seeded' }),
      responding({ error: 'sequencer-unavailable' }, 500),
    ]) {
      const client = new DurableObjectSeasonPublicationSequencer(namespace);
      expect(await client.recoverCutoverSeed(request)).toEqual({
        outcome: 'rejected',
        reason: 'state-corrupt',
      });
    }
  });
});
