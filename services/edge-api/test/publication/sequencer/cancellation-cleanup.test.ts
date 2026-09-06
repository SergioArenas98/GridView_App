/**
 * Cancellation, expiry, supersession, and the cleanup authorization that
 * depends on them (ADR 0025 D5).
 *
 * The sequencer **authorizes** cleanup; it never deletes anything. Nothing here
 * asserts atomicity between a durable authorization and an external Workers KV
 * deletion, because no such cross-product atomicity exists. What the tests do
 * prove is the one-directional safety property the design actually rests on: a
 * candidate version belongs to exactly one epoch for its whole existence, so a
 * delayed deletion can only ever remove artifacts of the operation that owned
 * them.
 */

import { describe, expect, it } from 'vitest';

import {
  SEASON,
  SEED_ACTIVE_VERSION,
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

describe('cancellation and expiry', () => {
  it('cancels a prepared operation and discards its staged per-key rows', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    expect(harness.sequencer.cancel(identityOf(operation))).toEqual({
      outcome: 'cancelled',
      candidateVersion: operation.candidateVersion,
    });
    expect(harness.host.peek('operation')).toMatchObject({
      phase: 'cancelled',
    });
    expect(harness.host.peek('prepared/calendar')).toBeUndefined();
  });

  it('is idempotent, and cancelled is terminal for that epoch', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    harness.sequencer.cancel(identityOf(operation));
    expect(harness.sequencer.cancel(identityOf(operation))).toEqual({
      outcome: 'already-cancelled',
      candidateVersion: operation.candidateVersion,
    });
    // No path returns a cancelled epoch to `prepared` or `committed`.
    expect(
      harness.sequencer.finalize({
        ...identityOf(operation),
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'operation-not-prepared' });
  });

  it('durably cancels an expired prepared operation when asked to', () => {
    const harness = activeSequencer({ preparationTtlMs: 60_000 });
    const operation = prepared(harness);
    harness.clock.advance(60_001);
    expect(harness.sequencer.cancel(identityOf(operation))).toMatchObject({
      outcome: 'cancelled',
    });
    expect(harness.host.peek('operation')).toMatchObject({
      phase: 'cancelled',
    });
  });

  it('leaves the committed baseline and the high-water mark untouched', () => {
    const harness = activeSequencer();
    const before = harness.host.peek('authority');
    const operation = prepared(harness, {
      sourceOrderingInput: '2026-09-20T00:00:00.000Z',
      perKeyRevisions: [keyRevision('calendar', rev('calendar-CHANGED'))],
    });
    harness.sequencer.cancel(identityOf(operation));
    const after = harness.host.peek('authority') as Record<string, unknown>;
    expect(after.committedSourceOrderingInput).toEqual(
      (before as Record<string, unknown>).committedSourceOrderingInput,
    );
    expect(after.seasonSnapshotObservedAtHighWaterMark).toEqual(
      (before as Record<string, unknown>).seasonSnapshotObservedAtHighWaterMark,
    );
  });

  it('rejects a committed identity, and resolves a lower epoch to superseded', () => {
    const harness = activeSequencer();
    const first = prepared(harness);
    harness.sequencer.finalize({
      ...identityOf(first),
      completionAttestation: { manifestCommitment: MANIFEST },
    });
    expect(harness.sequencer.cancel(identityOf(first))).toEqual({
      outcome: 'rejected',
      reason: 'operation-committed',
    });
    const second = prepared(harness, {
      perKeyRevisions: [keyRevision('calendar', rev('calendar-2'))],
    });
    expect(harness.sequencer.cancel(identityOf(first))).toEqual({
      outcome: 'superseded',
      currentOperationEpoch: second.operationEpoch,
    });
  });

  it('fails closed on a malformed, unknown or wrong-token identity', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    expect(
      harness.sequencer.cancel({ ...identityOf(operation), operationEpoch: 0 }),
    ).toEqual({ outcome: 'rejected', reason: 'malformed-identity' });
    expect(
      harness.sequencer.cancel({
        ...identityOf(operation),
        operationEpoch: operation.operationEpoch + 1,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'unknown-epoch' });
    expect(
      harness.sequencer.cancel({
        ...identityOf(operation),
        operationToken: 'not-the-holder',
      }),
    ).toEqual({ outcome: 'rejected', reason: 'stale-identity' });
  });
});

describe('cleanup authorization', () => {
  function cancelledOperation(harness: Harness) {
    const operation = prepared(harness);
    harness.sequencer.cancel(identityOf(operation));
    return operation;
  }

  it('authorizes exactly the named cancelled operation’s version', () => {
    const harness = activeSequencer();
    const operation = cancelledOperation(harness);
    expect(
      harness.sequencer.authorizeCleanup({
        ...identityOf(operation),
        candidateVersion: operation.candidateVersion,
      }),
    ).toEqual({
      outcome: 'authorized',
      candidateVersion: operation.candidateVersion,
    });
  });

  it('requires the full triple', () => {
    const harness = activeSequencer();
    const operation = cancelledOperation(harness);
    expect(
      harness.sequencer.authorizeCleanup({
        ...identityOf(operation),
        operationToken: 'wrong-token',
        candidateVersion: operation.candidateVersion,
      }),
    ).toEqual({ outcome: 'refused', reason: 'identity-not-current' });
    expect(
      harness.sequencer.authorizeCleanup({
        ...identityOf(operation),
        candidateVersion: 'pm1-0000000000009-abcdef01',
      }),
    ).toEqual({ outcome: 'refused', reason: 'candidate-version-mismatch' });
    expect(
      harness.sequencer.authorizeCleanup({
        ...identityOf(operation),
        candidateVersion: 'has:colons',
      }),
    ).toEqual({ outcome: 'refused', reason: 'malformed-request' });
  });

  it('refuses the current prepared candidate', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    expect(
      harness.sequencer.authorizeCleanup({
        ...identityOf(operation),
        candidateVersion: operation.candidateVersion,
      }),
    ).toEqual({ outcome: 'refused', reason: 'operation-not-cancelled' });
  });

  it('refuses the current committed candidate', () => {
    const harness = activeSequencer();
    const operation = prepared(harness);
    harness.sequencer.finalize({
      ...identityOf(operation),
      completionAttestation: { manifestCommitment: MANIFEST },
    });
    expect(
      harness.sequencer.authorizeCleanup({
        ...identityOf(operation),
        candidateVersion: operation.candidateVersion,
      }),
    ).toEqual({ outcome: 'refused', reason: 'operation-not-cancelled' });
  });

  it('refuses the active and the previous version', () => {
    const harness = activeSequencer();
    // Commit once, so `previousVersion` is the seeded version and
    // `activeVersion` is the committed candidate.
    const committed = prepared(harness);
    harness.sequencer.finalize({
      ...identityOf(committed),
      completionAttestation: { manifestCommitment: MANIFEST },
    });
    const cancelled = cancelledOperation(harness);
    expect(harness.host.peek('authority')).toMatchObject({
      activeVersion: committed.candidateVersion,
      previousVersion: SEED_ACTIVE_VERSION,
    });
    for (const authoritative of [
      committed.candidateVersion,
      SEED_ACTIVE_VERSION,
    ]) {
      // Two independent rules refuse this, and the triple's ownership check
      // fires first: the cancelled record does not own the authoritative
      // version, because a version belongs to exactly one epoch for its whole
      // existence. The `version-is-authoritative` guard behind it is
      // defence-in-depth against a state that ownership already makes
      // unreachable.
      expect(
        harness.sequencer.authorizeCleanup({
          ...identityOf(cancelled),
          candidateVersion: authoritative,
        }),
      ).toEqual({ outcome: 'refused', reason: 'candidate-version-mismatch' });
    }
  });

  it('refuses once a later prepare has superseded the named record', () => {
    // "Recheck the current epoch" means checking the *named* epoch against the
    // current durable record, never accepting whichever epoch happens to be
    // current.
    const harness = activeSequencer();
    const cancelled = cancelledOperation(harness);
    const later = prepared(harness, {
      perKeyRevisions: [keyRevision('calendar', rev('calendar-2'))],
    });
    expect(later.operationEpoch).toBeGreaterThan(cancelled.operationEpoch);
    expect(
      harness.sequencer.authorizeCleanup({
        ...identityOf(cancelled),
        candidateVersion: cancelled.candidateVersion,
      }),
    ).toEqual({ outcome: 'refused', reason: 'identity-not-current' });
  });

  it('proves the review race is impossible: B can never be given A’s version', () => {
    const harness = activeSequencer();
    // Epoch A is prepared for version V, then cancelled.
    const a = prepared(harness);
    harness.sequencer.cancel(identityOf(a));
    // A stale authorization obtained while A was still current.
    const staleAuthorization = harness.sequencer.authorizeCleanup({
      ...identityOf(a),
      candidateVersion: a.candidateVersion,
    });
    expect(staleAuthorization).toMatchObject({ outcome: 'authorized' });

    // Epoch B is admitted afterwards and writes its artifacts.
    const b = prepared(harness, {
      perKeyRevisions: [keyRevision('calendar', rev('calendar-2'))],
    });
    expect(b.candidateVersion).not.toBe(a.candidateVersion);

    // Acting on the stale authorization can only ever delete A's version. B's
    // artifacts are under a different version by construction, so B's later
    // finalize commits onto documents nothing could have removed.
    expect(
      staleAuthorization.outcome === 'authorized'
        ? staleAuthorization.candidateVersion
        : null,
    ).toBe(a.candidateVersion);
    expect(
      harness.sequencer.finalize({
        ...identityOf(b),
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toMatchObject({ outcome: 'committed' });

    // And a fresh request for the same, now-superseded, identity is refused.
    expect(
      harness.sequencer.authorizeCleanup({
        ...identityOf(a),
        candidateVersion: a.candidateVersion,
      }),
    ).toEqual({ outcome: 'refused', reason: 'identity-not-current' });
  });

  it('never mutates durable state, whatever the external deletion does', () => {
    const harness = activeSequencer();
    const operation = cancelledOperation(harness);
    const before = harness.host
      .committedKeys()
      .map((key) => [key, harness.host.peek(key)]);
    harness.sequencer.authorizeCleanup({
      ...identityOf(operation),
      candidateVersion: operation.candidateVersion,
    });
    // The authorization is a decision, not a write, and the durable `cancelled`
    // state is unaffected by whether a later external deletion succeeds.
    expect(
      harness.host.committedKeys().map((key) => [key, harness.host.peek(key)]),
    ).toEqual(before);
  });
});
