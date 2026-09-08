/**
 * Restart persistence, transactional atomicity, fail-closed durable reads, and
 * the capacity obligation (ADR 0025 D3, D4, D9).
 *
 * ADR 0025 D9 records the capacity obligation rather than assuming it away: the
 * Mechanism PR must demonstrate the chosen SQLite-backed representation handles
 * the largest supported release inventory **without relying on one oversized
 * serialized blob**. These tests take the first of the two permitted routes -
 * bounded per-key records updated atomically inside the single transaction -
 * so no serialized-state size limit is needed.
 */

import { describe, expect, it } from 'vitest';

import {
  MemorySequencerHost,
  SeasonPublicationCoordinator,
  authorityStorageKey,
  committedKeyPrefix,
  operationStorageKey,
  preparedKeyPrefix,
  type SequencerHost,
  type SequencerRecordStore,
} from '../../../src/publication/sequencer';
import {
  FINGERPRINT,
  SEASON,
  SEED_ACTIVE_VERSION,
  SEED_HIGH_WATER_MARK,
  activeSequencer,
  commitment,
  keyRevision,
  keyState,
  makeSequencer,
  prepareRequest,
  rev,
  seedFor,
} from './support';

const MANIFEST = commitment('manifest-1');

describe('restart persistence', () => {
  it('resumes a prepared operation with every value finalize needs', () => {
    const first = activeSequencer({ now: '2026-09-10T00:00:00.000Z' });
    const operation = first.sequencer.prepare(
      prepareRequest({
        sourceOrderingInput: '2026-09-10T00:00:00.000Z',
        perKeyRevisions: [
          keyRevision('calendar', rev('calendar-1')),
          keyRevision('standings:drivers', rev('standings-CHANGED')),
        ],
      }),
    );
    if (operation.outcome !== 'prepared') throw new Error('expected prepared');

    // A restart: a fresh coordinator over the same committed bytes, with no
    // in-memory state carried across.
    const restarted = makeSequencer({
      host: first.host.restart(),
      now: '2026-09-10T00:05:00.000Z',
    });
    const committed = restarted.sequencer.finalize({
      season: SEASON,
      operationEpoch: operation.operationEpoch,
      operationToken: operation.operationToken,
      completionAttestation: { manifestCommitment: MANIFEST },
    });
    expect(committed).toMatchObject({
      outcome: 'committed',
      replayed: false,
      result: { activeVersion: operation.candidateVersion },
    });
    // Exactly the per-key assignments the original `prepare` recorded.
    expect(restarted.host.peek('committed/standings:drivers')).toEqual({
      revision: rev('standings-CHANGED'),
      observedAt: operation.assignedTimestamps.find(
        (state) => state.documentName === 'standings:drivers',
      )?.observedAt,
    });
    // And the expected manifest commitment survived the restart, so a wrong
    // attestation is still rejected after one.
    const other = makeSequencer({ host: first.host.restart() });
    expect(
      other.sequencer.finalize({
        season: SEASON,
        operationEpoch: operation.operationEpoch,
        operationToken: operation.operationToken,
        completionAttestation: {
          manifestCommitment: commitment('other-manifest'),
        },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'manifest-commitment-mismatch' });
  });

  it('resumes a committed operation and replays its recorded result', () => {
    const first = activeSequencer();
    const operation = first.sequencer.prepare(prepareRequest());
    if (operation.outcome !== 'prepared') throw new Error('expected prepared');
    const identity = {
      season: SEASON,
      operationEpoch: operation.operationEpoch,
      operationToken: operation.operationToken,
      completionAttestation: { manifestCommitment: MANIFEST },
    };
    const original = first.sequencer.finalize(identity);
    const restarted = makeSequencer({ host: first.host.restart() });
    expect(restarted.sequencer.finalize(identity)).toEqual({
      outcome: 'committed',
      replayed: true,
      result: original.outcome === 'committed' ? original.result : undefined,
    });
  });

  it('resumes a cancelled operation as cancelled', () => {
    const first = activeSequencer();
    const operation = first.sequencer.prepare(prepareRequest());
    if (operation.outcome !== 'prepared') throw new Error('expected prepared');
    first.sequencer.cancel({
      season: SEASON,
      operationEpoch: operation.operationEpoch,
      operationToken: operation.operationToken,
    });
    const restarted = makeSequencer({ host: first.host.restart() });
    expect(
      restarted.sequencer.authorizeCleanup({
        season: SEASON,
        operationEpoch: operation.operationEpoch,
        operationToken: operation.operationToken,
        candidateVersion: operation.candidateVersion,
      }),
    ).toMatchObject({ outcome: 'authorized' });
  });
});

/** A host that fails the n-th write inside a transaction, to force a rollback. */
class FailingHost implements SequencerHost {
  constructor(
    private readonly inner: MemorySequencerHost,
    private readonly failOnWrite: number,
  ) {}

  transactionSync<T>(run: (store: SequencerRecordStore) => T): T {
    let writes = 0;
    return this.inner.transactionSync((store) =>
      run({
        get: (key) => store.get(key),
        list: (prefix) => store.list(prefix),
        delete: (key) => store.delete(key),
        put: (key, value) => {
          writes += 1;
          if (writes === this.failOnWrite) {
            throw new Error('injected durable write failure');
          }
          store.put(key, value);
        },
      }),
    );
  }
}

describe('transactional atomicity', () => {
  it('discards every write when a transition fails part-way', () => {
    const inner = new MemorySequencerHost();
    const seeded = new SeasonPublicationCoordinator(inner);
    seeded.seedCutover(seedFor());
    seeded.activateCutover({
      season: SEASON,
      cutoverFingerprint: FINGERPRINT,
    });
    const before = inner.committedKeys().map((key) => [key, inner.peek(key)]);

    // `prepare` writes the staged per-key rows, then the operation record, then
    // the authority record. Failing on the second write must leave none of
    // them behind.
    const failing = new SeasonPublicationCoordinator(new FailingHost(inner, 2));
    expect(() => failing.prepare(prepareRequest())).toThrow(
      'injected durable write failure',
    );
    expect(inner.committedKeys().map((key) => [key, inner.peek(key)])).toEqual(
      before,
    );
  });

  it('discards a partial commit, leaving the previous release authoritative', () => {
    const inner = new MemorySequencerHost();
    const coordinator = new SeasonPublicationCoordinator(inner);
    coordinator.seedCutover(seedFor());
    coordinator.activateCutover({
      season: SEASON,
      cutoverFingerprint: FINGERPRINT,
    });
    const operation = coordinator.prepare(prepareRequest());
    if (operation.outcome !== 'prepared') throw new Error('expected prepared');
    const before = inner.committedKeys().map((key) => [key, inner.peek(key)]);

    const failing = new SeasonPublicationCoordinator(new FailingHost(inner, 2));
    expect(() =>
      failing.finalize({
        season: SEASON,
        operationEpoch: operation.operationEpoch,
        operationToken: operation.operationToken,
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toThrow('injected durable write failure');
    expect(inner.committedKeys().map((key) => [key, inner.peek(key)])).toEqual(
      before,
    );
    expect(inner.peek(authorityStorageKey)).toMatchObject({
      activeVersion: SEED_ACTIVE_VERSION,
    });
  });
});

describe('corrupt durable state fails closed', () => {
  it('never repairs, resets or relabels an unreconcilable record', () => {
    const harness = activeSequencer();
    harness.host.poke(authorityStorageKey, { season: 'not-a-season' });
    expect(harness.sequencer.readAuthority(SEASON)).toEqual({
      cutoverState: 'unavailable',
      authoritative: false,
    });
    expect(harness.sequencer.prepare(prepareRequest())).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
    // Left exactly as found.
    expect(harness.host.peek(authorityStorageKey)).toEqual({
      season: 'not-a-season',
    });
  });

  it('fails closed on an operation record no defined transition produces', () => {
    const harness = activeSequencer();
    const operation = harness.sequencer.prepare(prepareRequest());
    if (operation.outcome !== 'prepared') throw new Error('expected prepared');
    // `committed` without its recorded result cannot replay.
    harness.host.poke(operationStorageKey, {
      ...(harness.host.peek(operationStorageKey) as object),
      phase: 'committed',
    });
    expect(
      harness.sequencer.finalize({
        season: SEASON,
        operationEpoch: operation.operationEpoch,
        operationToken: operation.operationToken,
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
  });

  it('fails closed on a corrupt per-key record', () => {
    const harness = activeSequencer();
    harness.host.poke(`${committedKeyPrefix}calendar`, { revision: 42 });
    expect(harness.sequencer.prepare(prepareRequest())).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
  });
});

describe('capacity: the largest supported release manifest', () => {
  /**
   * A manifest at the scale a full season actually reaches: 24 Grand Prix
   * detail routes and their results, plus driver, constructor and circuit
   * profiles, the collections, both standings and the fixed documents.
   */
  function releaseManifest(suffix: string) {
    const names: string[] = [
      'bootstrap',
      'home',
      'season',
      'calendar',
      'drivers',
      'constructors',
      'circuits',
      'standings:drivers',
      'standings:constructors',
      'content:manifest',
    ];
    for (let round = 1; round <= 24; round += 1) {
      names.push(`grand-prix:${round}`, `grand-prix:${round}:results`);
    }
    for (let index = 0; index < 22; index += 1) names.push(`driver:d${index}`);
    for (let index = 0; index < 10; index += 1) {
      names.push(`constructor:c${index}`);
    }
    for (let index = 0; index < 24; index += 1) names.push(`circuit:t${index}`);
    return names.map((name) => keyRevision(name, rev(`${name}-${suffix}`)));
  }

  it('stores one bounded record per key, never one oversized serialized value', () => {
    const manifest = releaseManifest('a');
    const harness = activeSequencer(
      { now: '2026-09-10T00:00:00.000Z' },
      seedFor({
        perKeyState: manifest.map((entry) =>
          keyState(entry.documentName, entry.revision, SEED_HIGH_WATER_MARK),
        ),
      }),
    );
    const changed = releaseManifest('b');
    const operation = harness.sequencer.prepare(
      prepareRequest({
        sourceOrderingInput: '2026-09-10T00:00:00.000Z',
        perKeyRevisions: changed,
      }),
    );
    if (operation.outcome !== 'prepared') throw new Error('expected prepared');
    expect(
      harness.sequencer.finalize({
        season: SEASON,
        operationEpoch: operation.operationEpoch,
        operationToken: operation.operationToken,
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toMatchObject({ outcome: 'committed' });

    const keys = harness.host.committedKeys();
    const perKey = keys.filter((key) => key.startsWith(committedKeyPrefix));
    expect(perKey).toHaveLength(changed.length);
    expect(changed.length).toBeGreaterThan(100);
    // Nothing is staged after the commit, and the whole durable footprint is
    // the authority record, the operation record and one row per current key.
    expect(keys.filter((key) => key.startsWith(preparedKeyPrefix))).toEqual([]);
    expect(keys).toHaveLength(perKey.length + 2);

    // The per-season authority record stays constant-size regardless of the
    // manifest: the high-water mark, the committed ordering input and the
    // cutover fields each add exactly one scalar to the same transaction.
    const authority = harness.host.peek(authorityStorageKey) as Record<
      string,
      unknown
    >;
    expect(Object.keys(authority).sort()).toEqual([
      'activeVersion',
      'committedSourceOrderingInput',
      'cutoverFingerprint',
      'cutoverState',
      'lastOperationEpoch',
      'previousVersion',
      'season',
      'seasonSnapshotObservedAtHighWaterMark',
    ]);
    // Each per-key record carries a revision and a timestamp, nothing more.
    for (const key of perKey) {
      expect(Object.keys(harness.host.peek(key) as object).sort()).toEqual([
        'observedAt',
        'revision',
      ]);
    }
  });

  it('keeps the authority record the same size after many withdraw/restore cycles', () => {
    const harness = activeSequencer({ now: '2026-09-10T00:00:00.000Z' });
    const sizeOf = () =>
      JSON.stringify(harness.host.peek(authorityStorageKey)).length;
    const baseline = sizeOf();
    for (let cycle = 0; cycle < 5; cycle += 1) {
      for (const manifest of [
        [keyRevision('calendar', rev(`calendar-${cycle}`))],
        [
          keyRevision('calendar', rev(`calendar-${cycle}`)),
          keyRevision('standings:drivers', rev(`standings-${cycle}`)),
        ],
      ]) {
        harness.clock.advance(1000);
        const operation = harness.sequencer.prepare(
          prepareRequest({
            sourceOrderingInput: '2026-09-10T00:00:00.000Z',
            perKeyRevisions: manifest,
          }),
        );
        if (operation.outcome !== 'prepared') {
          throw new Error('expected prepared');
        }
        harness.sequencer.finalize({
          season: SEASON,
          operationEpoch: operation.operationEpoch,
          operationToken: operation.operationToken,
          completionAttestation: { manifestCommitment: MANIFEST },
        });
      }
    }
    // No tombstone history accumulates: the record's shape is unchanged and its
    // size varies only with the literal length of the values it holds.
    expect(
      Object.keys(harness.host.peek(authorityStorageKey) as object),
    ).toHaveLength(8);
    expect(Math.abs(sizeOf() - baseline)).toBeLessThan(32);
  });
});
