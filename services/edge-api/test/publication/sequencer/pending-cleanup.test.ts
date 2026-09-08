/**
 * Bounded cleanup reachability across operation replacement (ADR 0025 D5,
 * review finding on `coordinator.ts`).
 *
 * Reproduced defect: a `prepare` that displaced an expired or cancelled
 * operation overwrote the sole durable record its (possibly partially written)
 * candidate needed for cleanup authorization, so `authorizeCleanup` could never
 * name it again - repeated crash/expiry cycles left permanently uncollectable
 * Workers KV versions.
 *
 * The correction: the retiring operation's identity is moved into a single
 * constant-size pending-cleanup record in the same atomic transaction, so it
 * stays authorizable and acknowledgeable; a second retirement while that slot
 * is occupied is refused with explicit backpressure rather than overwriting it.
 */

import { describe, expect, it } from 'vitest';

import {
  SEASON,
  SEED_ACTIVE_VERSION,
  activeSequencer,
  commitment,
  counterSource,
  hexCounterSource,
  keyRevision,
  prepareRequest,
  rev,
  type Harness,
} from './support';
import {
  pendingCleanupStorageKey,
  readPendingCleanupRecord,
  SeasonPublicationCoordinator,
} from '../../../src/publication/sequencer';

/** A fresh coordinator over the same committed bytes, as a restart would see. */
function restarted(harness: Harness): SeasonPublicationCoordinator {
  return new SeasonPublicationCoordinator(harness.host.restart(), {
    token: counterSource('restarted-'),
    opaqueVersionComponent: hexCounterSource(),
  });
}

/** The tokenless pending-slot cleanup request a `RetiredCleanupHandle` yields. */
function retiredRequestFor(handle: {
  operationEpoch: number;
  candidateVersion: string;
}) {
  return {
    season: SEASON,
    operationEpoch: handle.operationEpoch,
    candidateVersion: handle.candidateVersion,
  };
}

const MANIFEST = commitment('manifest-1');

function prepared(harness: Harness, overrides = {}) {
  const outcome = harness.sequencer.prepare(prepareRequest(overrides));
  if (outcome.outcome !== 'prepared') {
    throw new Error(`expected prepared, got ${JSON.stringify(outcome)}`);
  }
  return outcome;
}

function cleanupRequestFor(operation: {
  operationEpoch: number;
  operationToken: string;
  candidateVersion: string;
}) {
  return {
    season: SEASON,
    operationEpoch: operation.operationEpoch,
    operationToken: operation.operationToken,
    candidateVersion: operation.candidateVersion,
  };
}

const changedCalendar = (tag: string) => ({
  perKeyRevisions: [keyRevision('calendar', rev(`calendar-${tag}`))],
});

describe('cancellation then another prepare', () => {
  it('keeps the cancelled candidate authorizable from the pending slot', () => {
    const harness = activeSequencer();
    const a = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(a));
    const b = prepared(harness, changedCalendar('b'));
    expect(b.retiredCleanup).toEqual({
      operationEpoch: a.operationEpoch,
      candidateVersion: a.candidateVersion,
    });
    expect(harness.sequencer.authorizeCleanup(cleanupRequestFor(a))).toEqual({
      outcome: 'authorized',
      candidateVersion: a.candidateVersion,
    });
  });
});

describe('expiry then another prepare', () => {
  it('retires the expired prepared operation into the pending slot', () => {
    const harness = activeSequencer({ preparationTtlMs: 60_000 });
    const a = prepared(harness);
    harness.clock.advance(60_001);
    const b = prepared(harness, changedCalendar('b'));
    expect(b.retiredCleanup).toEqual({
      operationEpoch: a.operationEpoch,
      candidateVersion: a.candidateVersion,
    });
    expect(
      harness.sequencer.authorizeCleanup(cleanupRequestFor(a)),
    ).toMatchObject({ outcome: 'authorized' });
  });
});

describe('lost response and retry', () => {
  it('re-authorizes the same identity idempotently until acknowledged', () => {
    const harness = activeSequencer();
    const a = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(a));
    prepared(harness, changedCalendar('b'));
    const first = harness.sequencer.authorizeCleanup(cleanupRequestFor(a));
    const second = harness.sequencer.authorizeCleanup(cleanupRequestFor(a));
    expect(first).toEqual(second);
    expect(first).toMatchObject({ outcome: 'authorized' });
    // Still there for another retry until an explicit acknowledgement.
    expect(harness.host.peek(pendingCleanupStorageKey)).toMatchObject({
      operationEpoch: a.operationEpoch,
    });
  });

  it('a deletion-failure retry is still authorized, and acknowledgement is idempotent', () => {
    const harness = activeSequencer();
    const a = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(a));
    prepared(harness, changedCalendar('b'));
    // caller's external delete fails; it retries authorization, then succeeds
    expect(
      harness.sequencer.authorizeCleanup(cleanupRequestFor(a)),
    ).toMatchObject({ outcome: 'authorized' });
    expect(harness.sequencer.acknowledgeCleanup(cleanupRequestFor(a))).toEqual({
      outcome: 'acknowledged',
    });
    // acknowledging again is still fine
    expect(harness.sequencer.acknowledgeCleanup(cleanupRequestFor(a))).toEqual({
      outcome: 'acknowledged',
    });
    expect(harness.host.peek(pendingCleanupStorageKey)).toBeUndefined();
    // and authorization now refuses - nothing left to clean
    expect(harness.sequencer.authorizeCleanup(cleanupRequestFor(a))).toEqual({
      outcome: 'refused',
      reason: 'identity-not-current',
    });
  });
});

describe('acknowledgement identity', () => {
  it('refuses a wrong-identity acknowledgement so the slot cannot be freed for the wrong orphan', () => {
    const harness = activeSequencer();
    const a = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(a));
    prepared(harness, changedCalendar('b'));
    expect(
      harness.sequencer.acknowledgeCleanup({
        ...cleanupRequestFor(a),
        candidateVersion: 'pm1-0000000000099-abcdef01',
      }),
    ).toEqual({ outcome: 'rejected', reason: 'identity-not-current' });
    expect(
      harness.sequencer.acknowledgeCleanup({
        ...cleanupRequestFor(a),
        operationEpoch: a.operationEpoch + 5,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'identity-not-current' });
    // the real one still works
    expect(harness.sequencer.acknowledgeCleanup(cleanupRequestFor(a))).toEqual({
      outcome: 'acknowledged',
    });
  });

  it('acknowledges a cancelled current record directly, clearing it', () => {
    const harness = activeSequencer();
    const a = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(a));
    expect(harness.sequencer.acknowledgeCleanup(cleanupRequestFor(a))).toEqual({
      outcome: 'acknowledged',
    });
    expect(harness.host.peek('operation')).toBeUndefined();
    // the next prepare starts clean, no pending slot used
    const b = prepared(harness, changedCalendar('b'));
    expect(b.retiredCleanup).toBeUndefined();
  });
});

describe('backpressure', () => {
  it('refuses a second retirement while the pending slot is occupied', () => {
    const harness = activeSequencer({ preparationTtlMs: 60_000 });
    const a = prepared(harness);
    harness.clock.advance(60_001);
    const b = prepared(harness, changedCalendar('b'));
    harness.clock.advance(60_001);
    const blocked = harness.sequencer.prepare(
      prepareRequest(changedCalendar('c')),
    );
    expect(blocked).toEqual({
      outcome: 'rejected',
      reason: 'pending-cleanup-required',
      pendingCleanup: {
        operationEpoch: a.operationEpoch,
        candidateVersion: a.candidateVersion,
      },
    });
    // clear the first orphan, and the blocked prepare now proceeds - retiring b
    harness.sequencer.authorizeCleanup(cleanupRequestFor(a));
    harness.sequencer.acknowledgeCleanup(cleanupRequestFor(a));
    const c = prepared(harness, changedCalendar('c'));
    expect(c.retiredCleanup).toEqual({
      operationEpoch: b.operationEpoch,
      candidateVersion: b.candidateVersion,
    });
  });

  it('stays constant-size under repeated crash/expiry cycles', () => {
    const run = (rounds: number): string[] => {
      const harness = activeSequencer({ preparationTtlMs: 60_000 });
      for (let i = 0; i < rounds; i += 1) {
        const p = harness.sequencer.prepare(
          prepareRequest(changedCalendar(`round-${i}`)),
        );
        if (p.outcome === 'rejected') {
          expect(p.reason).toBe('pending-cleanup-required');
          if (p.pendingCleanup) {
            // The pending slot is drained with a tokenless request built
            // straight from the handle - no fabricated token.
            const req = retiredRequestFor(p.pendingCleanup);
            harness.sequencer.authorizeCleanup(req);
            harness.sequencer.acknowledgeCleanup(req);
          }
          continue;
        }
        harness.clock.advance(60_001);
      }
      return harness.host.committedKeys();
    };
    // 20 crash/expiry cycles produce no more durable keys than 3: no
    // retired-operation history, never more than one pending-cleanup slot.
    const allowed = new Set([
      'authority',
      'committed/calendar',
      'committed/standings:drivers',
      'operation',
      pendingCleanupStorageKey,
      'prepared/calendar',
    ]);
    const few = run(3);
    const many = run(20);
    for (const keys of [few, many]) {
      expect(keys.every((k) => allowed.has(k))).toBe(true);
      expect(
        keys.filter((k) => k === pendingCleanupStorageKey).length,
      ).toBeLessThanOrEqual(1);
    }
    expect(many.length).toBeLessThanOrEqual(few.length + 1);
  });
});

describe('cleanup can never delete a live version', () => {
  it('refuses the active and previous versions from the pending slot', () => {
    const harness = activeSequencer();
    const first = prepared(harness);
    harness.sequencer.finalize({
      ...cleanupRequestFor(first),
      completionAttestation: { manifestCommitment: MANIFEST },
    });
    // now activeVersion = first.candidateVersion, previousVersion = seed
    const orphan = prepared(harness, changedCalendar('orphan'));
    harness.sequencer.cancel(cleanupRequestFor(orphan));
    prepared(harness, changedCalendar('next'));
    // orphan is in the pending slot; asking to clean an authoritative version
    // through its identity is refused
    for (const authoritative of [first.candidateVersion, SEED_ACTIVE_VERSION]) {
      expect(
        harness.sequencer.authorizeCleanup({
          ...cleanupRequestFor(orphan),
          candidateVersion: authoritative,
        }),
      ).toEqual({ outcome: 'refused', reason: 'identity-not-current' });
    }
  });

  it('refuses a later prepared operation candidate', () => {
    const harness = activeSequencer();
    const orphan = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(orphan));
    const later = prepared(harness, changedCalendar('later'));
    // orphan sits in the pending slot; the current prepared candidate is not
    // orphaned and cannot be authorized for cleanup.
    expect(
      harness.sequencer.authorizeCleanup(cleanupRequestFor(later)),
    ).toEqual({ outcome: 'refused', reason: 'operation-not-cancelled' });
  });
});

describe('durability', () => {
  it('survives a restart with pending cleanup state intact', () => {
    const harness = activeSequencer();
    const a = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(a));
    prepared(harness, changedCalendar('b'));

    const restarted = harness.host.restart();
    const pending = restarted.transactionSync((store) =>
      readPendingCleanupRecord(store),
    );
    expect(pending).toMatchObject({
      kind: 'value',
      value: { operationEpoch: a.operationEpoch },
    });
  });

  it('fails closed and mutates nothing when the pending record is corrupt', () => {
    const harness = activeSequencer({ preparationTtlMs: 60_000 });
    const a = prepared(harness);
    harness.clock.advance(60_001);
    const b = prepared(harness, changedCalendar('b')); // retires a -> pending
    harness.clock.advance(60_001); // b now retirable, so prepare reaches pending
    harness.host.poke(pendingCleanupStorageKey, { operationEpoch: 'nope' });
    const before = harness.host
      .committedKeys()
      .map((key) => [key, harness.host.peek(key)]);
    expect(harness.sequencer.authorizeCleanup(cleanupRequestFor(a))).toEqual({
      outcome: 'refused',
      reason: 'state-corrupt',
    });
    expect(
      harness.sequencer.prepare(prepareRequest(changedCalendar('c'))),
    ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
    expect(b.retiredCleanup).toBeDefined();
    expect(
      harness.host.committedKeys().map((key) => [key, harness.host.peek(key)]),
    ).toEqual(before);
  });
});

describe('a restarted replacement caller drains the pending slot without a token (R2)', () => {
  it('recovers from the retiredCleanup handle a displacing prepare returned', () => {
    const harness = activeSequencer();
    const a = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(a));
    const b = prepared(harness, changedCalendar('b'));
    if (b.retiredCleanup === undefined)
      throw new Error('expected retiredCleanup');

    // Everything about A - including its token - is gone; the process restarts.
    const coordinator = restarted(harness);
    const request = retiredRequestFor(b.retiredCleanup);
    expect('operationToken' in request).toBe(false);

    expect(coordinator.authorizeCleanup(request)).toEqual({
      outcome: 'authorized',
      candidateVersion: a.candidateVersion,
    });
    expect(coordinator.acknowledgeCleanup(request)).toEqual({
      outcome: 'acknowledged',
    });
    // The slot is drained.
    expect(coordinator.authorizeCleanup(request)).toEqual({
      outcome: 'refused',
      reason: 'identity-not-current',
    });
  });

  it('recovers from a pending-cleanup-required result the same way', () => {
    const harness = activeSequencer({ preparationTtlMs: 60_000 });
    const a = prepared(harness);
    harness.clock.advance(60_001);
    prepared(harness, changedCalendar('b')); // retires a -> pending slot
    harness.clock.advance(60_001);
    const blocked = harness.sequencer.prepare(
      prepareRequest(changedCalendar('c')),
    );
    if (
      blocked.outcome !== 'rejected' ||
      blocked.pendingCleanup === undefined
    ) {
      throw new Error(
        `expected pending-cleanup-required, got ${JSON.stringify(blocked)}`,
      );
    }

    const coordinator = restarted(harness);
    const request = retiredRequestFor(blocked.pendingCleanup);
    expect(coordinator.authorizeCleanup(request)).toEqual({
      outcome: 'authorized',
      candidateVersion: a.candidateVersion,
    });
    expect(coordinator.acknowledgeCleanup(request)).toEqual({
      outcome: 'acknowledged',
    });
  });

  it('a tokenless request cannot authorize the still-current cancelled operation', () => {
    const harness = activeSequencer();
    const a = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(a));
    // `a` is still the current record - not displaced into the pending slot.
    const tokenless = retiredRequestFor(a);
    expect(harness.sequencer.authorizeCleanup(tokenless)).toEqual({
      outcome: 'refused',
      reason: 'identity-not-current',
    });
    expect(harness.sequencer.acknowledgeCleanup(tokenless)).toEqual({
      outcome: 'rejected',
      reason: 'identity-not-current',
    });
    // The full-triple request still works - the record is untouched.
    expect(harness.sequencer.authorizeCleanup(cleanupRequestFor(a))).toEqual({
      outcome: 'authorized',
      candidateVersion: a.candidateVersion,
    });
  });

  it('a wrong token cannot authorize the current cancelled operation', () => {
    const harness = activeSequencer();
    const a = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(a));
    expect(
      harness.sequencer.authorizeCleanup({
        ...cleanupRequestFor(a),
        operationToken: 'not-the-holder',
      }),
    ).toEqual({ outcome: 'refused', reason: 'identity-not-current' });
  });

  it('a mismatched pending epoch or version cannot clear the slot', () => {
    const harness = activeSequencer();
    const a = prepared(harness);
    harness.sequencer.cancel(cleanupRequestFor(a));
    const b = prepared(harness, changedCalendar('b'));
    if (b.retiredCleanup === undefined)
      throw new Error('expected retiredCleanup');
    const handle = b.retiredCleanup;

    expect(
      harness.sequencer.acknowledgeCleanup({
        ...retiredRequestFor(handle),
        operationEpoch: handle.operationEpoch + 5,
      }),
    ).toEqual({ outcome: 'rejected', reason: 'identity-not-current' });
    expect(
      harness.sequencer.acknowledgeCleanup({
        ...retiredRequestFor(handle),
        candidateVersion: 'pm1-0000000000099-abcdef01',
      }),
    ).toEqual({ outcome: 'rejected', reason: 'identity-not-current' });
    // The slot is still occupied by the real orphan.
    expect(harness.host.peek(pendingCleanupStorageKey)).toMatchObject({
      operationEpoch: a.operationEpoch,
    });
  });
});

describe('the happy path never touches the pending slot', () => {
  it('stays constant-size across many prepare/finalize cycles', () => {
    const harness = activeSequencer();
    let keyCount = 0;
    for (let i = 0; i < 10; i += 1) {
      const p = prepared(harness, changedCalendar(`cycle-${i}`));
      harness.sequencer.finalize({
        ...cleanupRequestFor(p),
        completionAttestation: { manifestCommitment: MANIFEST },
      });
      const keys = harness.host.committedKeys();
      expect(keys).not.toContain(pendingCleanupStorageKey);
      if (i > 0) expect(keys.length).toBe(keyCount);
      keyCount = keys.length;
    }
  });
});
