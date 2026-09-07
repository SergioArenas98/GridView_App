/**
 * Every instant the sequencer accepts must stay safely orderable and usable by
 * every later operation - no exception, no `NaN`, no silently skipped value, no
 * lost ordering precision (ADR 0025 D4, review finding on `rules.ts`).
 *
 * The reproduced defect: `isInstant` (via `canonicalInstant`) accepts a leap
 * second such as `1998-12-31T23:59:60Z`, but the arithmetic behind it used
 * `Date.parse`, which returns `NaN` for that value - so a later `prepare`
 * touching a changed key reached `new Date(NaN).toISOString()` and threw
 * instead of returning a bounded outcome, and `highestInstant` dropped the
 * value entirely.
 */

import { describe, expect, it } from 'vitest';

import {
  SEASON,
  activeSequencer,
  commitment,
  keyRevision,
  makeSequencer,
  prepareRequest,
  rev,
  seedFor,
} from './support';
import { compareInstants } from '../../../src/publication/canonical/instant';

const MANIFEST = commitment('manifest-1');

describe('leap-second and high-precision instants', () => {
  it('assigns a fresh timestamp above a leap-second high-water mark without throwing', () => {
    const harness = activeSequencer(
      { now: '2026-09-02T00:00:00.000Z' },
      seedFor({
        seasonSnapshotObservedAtHighWaterMark: '2030-12-31T23:59:60Z',
      }),
    );
    const outcome = harness.sequencer.prepare(
      prepareRequest({
        perKeyRevisions: [keyRevision('calendar', rev('calendar-CHANGED'))],
      }),
    );
    if (outcome.outcome !== 'prepared') {
      throw new Error(`expected prepared, got ${JSON.stringify(outcome)}`);
    }
    const fresh = outcome.assignedTimestamps[0]!.observedAt;
    // Exactly one millisecond above the leap-second floor, still a valid
    // RFC 3339 instant, and strictly greater by canonical comparison.
    expect(fresh).toBe('2030-12-31T23:59:60.001Z');
    expect(compareInstants(fresh, '2030-12-31T23:59:60Z')).toBe(1);
  });

  it('advances the high-water mark past a leap-second-derived assignment on finalize', () => {
    const harness = activeSequencer(
      { now: '2026-09-02T00:00:00.000Z' },
      seedFor({
        seasonSnapshotObservedAtHighWaterMark: '2030-12-31T23:59:60Z',
      }),
    );
    const prepared = harness.sequencer.prepare(
      prepareRequest({
        perKeyRevisions: [keyRevision('calendar', rev('calendar-CHANGED'))],
      }),
    );
    if (prepared.outcome !== 'prepared') throw new Error('expected prepared');
    harness.sequencer.finalize({
      season: SEASON,
      operationEpoch: prepared.operationEpoch,
      operationToken: prepared.operationToken,
      completionAttestation: { manifestCommitment: MANIFEST },
    });
    const authority = harness.host.peek('authority') as Record<string, unknown>;
    expect(authority.seasonSnapshotObservedAtHighWaterMark).toBe(
      '2030-12-31T23:59:60.001Z',
    );
  });

  it('rejects a genuinely older leap-second ordering input, and admits an equal one', () => {
    const harness = activeSequencer();
    // Committed ordering input is the seed's 2026-09-01T00:00:00.000Z.
    expect(
      harness.sequencer.prepare(
        prepareRequest({ sourceOrderingInput: '2026-08-31T23:59:60Z' }),
      ),
    ).toMatchObject({
      outcome: 'rejected',
      reason: 'older-source-ordering-input',
    });
    expect(
      harness.sequencer.prepare(
        prepareRequest({ sourceOrderingInput: '2026-09-01T00:00:00Z' }),
      ),
    ).toMatchObject({ outcome: 'prepared' });
  });

  it('separates sub-millisecond ordering inputs Date.parse would conflate', () => {
    const harness = activeSequencer(
      {},
      seedFor({ committedSourceOrderingInput: '2026-09-01T00:00:00.1005Z' }),
    );
    // `.1001` and `.1005` both truncate to `.100` under Date.parse, so the old
    // code admitted this genuinely-older value; canonical comparison rejects it.
    expect(
      harness.sequencer.prepare(
        prepareRequest({ sourceOrderingInput: '2026-09-01T00:00:00.1001Z' }),
      ),
    ).toMatchObject({
      outcome: 'rejected',
      reason: 'older-source-ordering-input',
    });
    // The equal value, in a longer-but-equivalent spelling, is still admitted.
    expect(
      harness.sequencer.prepare(
        prepareRequest({ sourceOrderingInput: '2026-09-01T00:00:00.10050Z' }),
      ),
    ).toMatchObject({ outcome: 'prepared' });
  });
});

describe('invalid injected clock', () => {
  it('fails closed on prepare with no durable mutation', () => {
    const harness = activeSequencer();
    harness.clock.set('not-a-real-instant');
    expect(harness.sequencer.prepare(prepareRequest())).toEqual({
      outcome: 'rejected',
      reason: 'state-corrupt',
    });
    // The operation slot was never written.
    expect(harness.host.peek('operation')).toBeUndefined();
    expect(harness.host.committedKeys()).toEqual([
      'authority',
      'committed/calendar',
      'committed/standings:drivers',
    ]);
  });

  it('fails closed on finalize with no durable mutation', () => {
    const harness = activeSequencer();
    const prepared = harness.sequencer.prepare(prepareRequest());
    if (prepared.outcome !== 'prepared') throw new Error('expected prepared');
    const before = harness.host
      .committedKeys()
      .map((key) => [key, harness.host.peek(key)]);
    harness.clock.set('Invalid Date');
    expect(
      harness.sequencer.finalize({
        season: SEASON,
        operationEpoch: prepared.operationEpoch,
        operationToken: prepared.operationToken,
        completionAttestation: { manifestCommitment: MANIFEST },
      }),
    ).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
    expect(
      harness.host.committedKeys().map((key) => [key, harness.host.peek(key)]),
    ).toEqual(before);
  });

  it('never lets a broken clock reach an operation-carrying state', () => {
    const harness = makeSequencer();
    harness.sequencer.seedCutover(seedFor());
    harness.sequencer.activateCutover({
      season: SEASON,
      cutoverFingerprint: seedFor().cutoverFingerprint,
    });
    harness.clock.set('nonsense');
    const outcome = harness.sequencer.prepare(prepareRequest());
    expect(outcome).toEqual({ outcome: 'rejected', reason: 'state-corrupt' });
  });
});
