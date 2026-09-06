/**
 * `finalize`: the total identity/outcome contract, and the one authoritative
 * transition this design has (ADR 0025 D4, D9).
 *
 * **What these tests prove, and what they do not.** Each one proves a value
 * comparison and a durable-storage transition internal to this component.
 * None of them proves anything about Workers KV contents, document
 * completeness or global visibility - the component cannot observe those, and
 * `finalize` is never described here as checking them.
 */

import { describe, expect, it } from 'vitest';

import {
  SEASON,
  SEED_ACTIVE_VERSION,
  SEED_HIGH_WATER_MARK,
  activeSequencer,
  commitment,
  keyRevision,
  prepareRequest,
  rev,
  type Harness,
} from './support';

const MANIFEST = commitment('manifest-1');

function prepared(harness: Harness, overrides = {}) {
  const outcome = harness.sequencer.prepare(prepareRequest(overrides));
  if (outcome.outcome !== 'prepared') {
    throw new Error(`expected prepared, got ${JSON.stringify(outcome)}`);
  }
  return outcome;
}

function identityOf(operation: {
  operationEpoch: number;
  operationToken: string;
}) {
  return {
    season: SEASON,
    operationEpoch: operation.operationEpoch,
    operationToken: operation.operationToken,
  };
}

function attest(manifestCommitment = MANIFEST) {
  return { completionAttestation: { manifestCommitment } };
}

describe('finalize: the authoritative commit', () => {
  it('writes the whole authoritative state together', () => {
    const harness = activeSequencer({ now: '2026-09-10T00:00:00.000Z' });
    const operation = prepared(harness, {
      sourceOrderingInput: '2026-09-10T00:00:00.000Z',
      perKeyRevisions: [
        keyRevision('calendar', rev('calendar-1')),
        keyRevision('standings:drivers', rev('standings-CHANGED')),
      ],
    });
    const outcome = harness.sequencer.finalize({
      ...identityOf(operation),
      ...attest(),
    });
    expect(outcome).toEqual({
      outcome: 'committed',
      replayed: false,
      result: {
        activeVersion: operation.candidateVersion,
        previousVersion: SEED_ACTIVE_VERSION,
        operationKind: 'ordinary-publication',
        committedAt: '2026-09-10T00:00:00.000Z',
      },
    });
    expect(harness.host.peek('authority')).toMatchObject({
      activeVersion: operation.candidateVersion,
      previousVersion: SEED_ACTIVE_VERSION,
      committedSourceOrderingInput: '2026-09-10T00:00:00.000Z',
      seasonSnapshotObservedAtHighWaterMark: '2026-09-10T00:00:00.000Z',
    });
    // The unchanged key keeps its seeded timestamp; the changed one carries the
    // fresh activation `prepare` assigned - nothing recomputed at commit time.
    expect(harness.host.peek('committed/calendar')).toEqual({
      revision: rev('calendar-1'),
      observedAt: SEED_HIGH_WATER_MARK,
    });
    expect(harness.host.peek('committed/standings:drivers')).toEqual({
      revision: rev('standings-CHANGED'),
      observedAt: '2026-09-10T00:00:00.000Z',
    });
    // The prepared staging rows are gone once promoted.
    expect(harness.host.peek('prepared/calendar')).toBeUndefined();
  });

  it('commits exactly the timestamps prepare recorded, nothing recomputed', () => {
    const harness = activeSequencer({ now: '2026-09-10T00:00:00.000Z' });
    const operation = prepared(harness, {
      sourceOrderingInput: '2026-09-10T00:00:00.000Z',
      perKeyRevisions: [keyRevision('calendar', rev('calendar-CHANGED'))],
    });
    const assigned = operation.assignedTimestamps[0]?.observedAt;
    // Time moves between prepare and finalize. The committed value must still
    // be the one prepare assigned.
    harness.clock.advance(5 * 60 * 1000);
    expect(
      harness.sequencer.finalize({ ...identityOf(operation), ...attest() })
        .outcome,
    ).toBe('committed');
    expect(harness.host.peek('committed/calendar')).toMatchObject({
      observedAt: assigned,
    });
  });

  it('retires per-key state for a key the incoming manifest no longer names', () => {
    const harness = activeSequencer();
    const operation = prepared(harness, {
      perKeyRevisions: [keyRevision('calendar', rev('calendar-1'))],
    });
    harness.sequencer.finalize({ ...identityOf(operation), ...attest() });
    expect(harness.host.peek('committed/standings:drivers')).toBeUndefined();
    // The season-wide floor is not retired with it - that is what a later
    // restoration of the withdrawn key needs.
    expect(harness.host.peek('authority')).toMatchObject({
      seasonSnapshotObservedAtHighWaterMark: SEED_HIGH_WATER_MARK,
    });
  });

  it('leaves the high-water mark untouched when no key changed', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    harness.sequencer.finalize({ ...identityOf(operation), ...attest() });
    expect(harness.host.peek('authority')).toMatchObject({
      seasonSnapshotObservedAtHighWaterMark: SEED_HIGH_WATER_MARK,
    });
  });

  it('advances the high-water mark monotonically across operations', () => {
    const harness = activeSequencer({ now: '2026-09-10T00:00:00.000Z' });
    for (const [index, at] of [
      '2026-09-10T00:00:00.000Z',
      '2026-09-11T00:00:00.000Z',
    ].entries()) {
      harness.clock.set(at);
      const operation = prepared(harness, {
        sourceOrderingInput: at,
        perKeyRevisions: [keyRevision('calendar', rev(`calendar-${index}`))],
      });
      harness.sequencer.finalize({ ...identityOf(operation), ...attest() });
      expect(harness.host.peek('authority')).toMatchObject({
        seasonSnapshotObservedAtHighWaterMark: at,
      });
    }
    // A later operation whose clock has gone backwards never lowers the floor.
    harness.clock.set('2026-09-01T00:00:00.000Z');
    const late = prepared(harness, {
      sourceOrderingInput: '2026-09-11T00:00:00.000Z',
      perKeyRevisions: [keyRevision('calendar', rev('calendar-LATE'))],
    });
    expect(late.assignedTimestamps[0]?.observedAt).toBe(
      '2026-09-11T00:00:00.001Z',
    );
    harness.sequencer.finalize({ ...identityOf(late), ...attest() });
    expect(harness.host.peek('authority')).toMatchObject({
      seasonSnapshotObservedAtHighWaterMark: '2026-09-11T00:00:00.001Z',
    });
  });

  it('gives a restored key a timestamp above every value the season ever committed', () => {
    const harness = activeSequencer({ now: '2026-09-10T00:00:00.000Z' });
    // 1. Withdraw `standings:drivers` from the active inventory.
    const withdraw = prepared(harness, {
      sourceOrderingInput: '2026-09-10T00:00:00.000Z',
      perKeyRevisions: [keyRevision('calendar', rev('calendar-1'))],
    });
    harness.sequencer.finalize({ ...identityOf(withdraw), ...attest() });

    // 2. An unrelated intervening publication advances the floor.
    harness.clock.set('2026-09-12T00:00:00.000Z');
    const intervening = prepared(harness, {
      sourceOrderingInput: '2026-09-12T00:00:00.000Z',
      perKeyRevisions: [keyRevision('calendar', rev('calendar-CHANGED'))],
    });
    const interveningValue = intervening.assignedTimestamps[0]?.observedAt;
    harness.sequencer.finalize({ ...identityOf(intervening), ...attest() });

    // 3. Restore the withdrawn key with its *original* content.
    harness.clock.set('2026-09-13T00:00:00.000Z');
    const restore = prepared(harness, {
      sourceOrderingInput: '2026-09-13T00:00:00.000Z',
      perKeyRevisions: [
        keyRevision('calendar', rev('calendar-CHANGED')),
        keyRevision('standings:drivers', rev('standings-1')),
      ],
    });
    const restored = restore.assignedTimestamps.find(
      (state) => state.documentName === 'standings:drivers',
    );
    // Never "unchanged" merely because the content matches an earlier revision:
    // its only comparison base is the revision currently active for that key,
    // and a withdrawn key has none.
    expect(Date.parse(restored!.observedAt)).toBeGreaterThan(
      Date.parse(interveningValue!),
    );
    expect(Date.parse(restored!.observedAt)).toBeGreaterThan(
      Date.parse(SEED_HIGH_WATER_MARK),
    );
  });

  it('commits a rollback’s own historical ordering input as the new baseline', () => {
    const harness = activeSequencer({ now: '2026-09-10T00:00:00.000Z' });
    const rollback = prepared(harness, {
      operationKind: 'rollback-republication',
      sourceOrderingInput: '2026-08-01T00:00:00.000Z',
      perKeyRevisions: [keyRevision('calendar', rev('calendar-OLD'))],
    });
    harness.sequencer.finalize({ ...identityOf(rollback), ...attest() });
    // Deliberately not a monotonic upstream high-water mark: the committed
    // baseline moves backward with the rollback.
    expect(harness.host.peek('authority')).toMatchObject({
      committedSourceOrderingInput: '2026-08-01T00:00:00.000Z',
    });
    // A later ordinary candidate is measured against the rollback's value.
    const after = harness.sequencer.prepare(
      prepareRequest({ sourceOrderingInput: '2026-07-01T00:00:00.000Z' }),
    );
    expect(after).toEqual({
      outcome: 'rejected',
      reason: 'older-source-ordering-input',
    });
  });
});

describe('finalize: the total identity contract', () => {
  it('replays the recorded result for the current committed identity', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    const first = harness.sequencer.finalize({
      ...identityOf(operation),
      ...attest(),
    });
    const before = harness.host.peek('authority');
    const retry = harness.sequencer.finalize({
      ...identityOf(operation),
      ...attest(),
    });
    expect(retry).toEqual({
      outcome: 'committed',
      replayed: true,
      result: first.outcome === 'committed' ? first.result : undefined,
    });
    // Nothing re-executed: the durable state is byte-identical.
    expect(harness.host.peek('authority')).toEqual(before);
  });

  it('resolves a lower epoch to superseded, with current authoritative state', () => {
    const harness = activeSequencer();
    const first = prepared(harness);
    harness.sequencer.cancel(identityOf(first));
    const second = prepared(harness);

    const before = harness.host
      .committedKeys()
      .map((key) => [key, harness.host.peek(key)]);
    const retry = harness.sequencer.finalize({
      ...identityOf(first),
      ...attest(),
    });
    expect(retry).toEqual({
      outcome: 'superseded',
      currentOperationEpoch: second.operationEpoch,
      activeVersion: SEED_ACTIVE_VERSION,
      previousVersion: null,
    });
    // A superseded epoch performs no storage mutation at all.
    expect(
      harness.host.committedKeys().map((key) => [key, harness.host.peek(key)]),
    ).toEqual(before);
  });

  it('resolves a lower epoch to superseded after the newer operation commits', () => {
    const harness = activeSequencer();
    const first = prepared(harness);
    harness.sequencer.cancel(identityOf(first));
    const second = prepared(harness);
    harness.sequencer.finalize({ ...identityOf(second), ...attest() });

    const retry = harness.sequencer.finalize({
      ...identityOf(first),
      ...attest(),
    });
    expect(retry).toEqual({
      outcome: 'superseded',
      currentOperationEpoch: second.operationEpoch,
      activeVersion: second.candidateVersion,
      previousVersion: SEED_ACTIVE_VERSION,
    });
    // It deliberately does not reproduce the retired response, and says nothing
    // about whether the retired candidate committed before supersession.
    expect(retry).not.toHaveProperty('result');
  });

  it('rejects the current epoch with a non-matching token as a stale identity', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    expect(
      harness.sequencer.finalize({
        ...identityOf(operation),
        operationToken: 'someone-elses-token',
        ...attest(),
      }),
    ).toEqual({ outcome: 'rejected', reason: 'stale-identity' });
  });

  it('fails closed on an epoch this season never allocated', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    expect(
      harness.sequencer.finalize({
        ...identityOf(operation),
        operationEpoch: operation.operationEpoch + 1,
        ...attest(),
      }),
    ).toEqual({ outcome: 'rejected', reason: 'unknown-epoch' });
  });

  it('fails closed on a malformed identity or attestation', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    for (const broken of [
      { operationEpoch: 0 },
      { operationEpoch: 1.5 },
      { operationToken: '' },
      { operationToken: 'has spaces' },
      { season: 12 },
    ]) {
      expect(
        harness.sequencer.finalize({
          ...identityOf(operation),
          ...broken,
          ...attest(),
        }),
      ).toEqual({ outcome: 'rejected', reason: 'malformed-identity' });
    }
    expect(
      harness.sequencer.finalize({
        ...identityOf(operation),
        completionAttestation: { manifestCommitment: 'nope' },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'malformed-identity' });
  });

  it('rejects an attestation naming a manifest other than the one prepared', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    const before = harness.host.peek('authority');
    expect(
      harness.sequencer.finalize({
        ...identityOf(operation),
        ...attest(commitment('a-different-manifest')),
      }),
    ).toEqual({ outcome: 'rejected', reason: 'manifest-commitment-mismatch' });
    expect(harness.host.peek('authority')).toEqual(before);
    expect(harness.host.peek('operation')).toMatchObject({ phase: 'prepared' });
  });

  it('rejects an expired prepared operation without committing anything', () => {
    const harness = activeSequencer({ preparationTtlMs: 60_000 });
    const operation = prepared(harness);
    harness.clock.advance(60_001);
    expect(
      harness.sequencer.finalize({ ...identityOf(operation), ...attest() }),
    ).toEqual({ outcome: 'rejected', reason: 'preparation-expired' });
    expect(harness.host.peek('authority')).toMatchObject({
      activeVersion: SEED_ACTIVE_VERSION,
    });
  });

  it('rejects a cancelled identity and performs no storage mutation', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    harness.sequencer.cancel(identityOf(operation));
    const before = harness.host
      .committedKeys()
      .map((key) => [key, harness.host.peek(key)]);
    expect(
      harness.sequencer.finalize({ ...identityOf(operation), ...attest() }),
    ).toEqual({ outcome: 'rejected', reason: 'operation-not-prepared' });
    expect(
      harness.host.committedKeys().map((key) => [key, harness.host.peek(key)]),
    ).toEqual(before);
  });

  it('resolves two simultaneous same-identity calls to one committed result', () => {
    // The Durable Object input gate serializes delivery, so the second call
    // observes `committed` rather than racing. This is application logic only:
    // it does not, and cannot, prove the platform's gating behaviour.
    const harness = activeSequencer();
    const operation = prepared(harness);
    const call = () =>
      harness.sequencer.finalize({ ...identityOf(operation), ...attest() });
    const [first, second] = [call(), call()];
    expect(first).toMatchObject({ outcome: 'committed', replayed: false });
    expect(second).toMatchObject({ outcome: 'committed', replayed: true });
    if (first.outcome !== 'committed' || second.outcome !== 'committed') {
      throw new Error('unreachable');
    }
    expect(second.result).toEqual(first.result);
  });

  it('rejects a finalize against a season this object does not own', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    expect(
      harness.sequencer.finalize({
        ...identityOf(operation),
        season: 2027,
        ...attest(),
      }),
    ).toEqual({ outcome: 'rejected', reason: 'season-mismatch' });
  });

  it('retains no history of retired results', () => {
    const harness = activeSequencer({ now: '2026-09-10T00:00:00.000Z' });
    for (let index = 0; index < 6; index += 1) {
      harness.clock.advance(1000);
      const operation = prepared(harness, {
        sourceOrderingInput: '2026-09-10T00:00:00.000Z',
        perKeyRevisions: [keyRevision('calendar', rev(`calendar-${index}`))],
      });
      harness.sequencer.finalize({ ...identityOf(operation), ...attest() });
    }
    // One authority record, one operation record, one row per current key.
    expect(harness.host.committedKeys()).toEqual([
      'authority',
      'committed/calendar',
      'operation',
    ]);
    // The single operation record describes the sixth operation only. There is
    // no map of retired results beside it.
    expect(harness.host.peek('operation')).toMatchObject({ epoch: 6 });
  });
});
