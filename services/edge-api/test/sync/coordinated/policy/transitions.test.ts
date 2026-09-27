/**
 * The §10.4.1 transition table for one race classification, and ADR 0020
 * D2.1-D2.9, observed one step at a time through `applyClassificationCheck`.
 */

import { describe, expect, it } from 'vitest';

import type { ClassificationRecord } from '../../../../src/sync/coordinated/ledger';
import {
  applyClassificationCheck,
  checkTime,
  newClassificationRecord,
  type CheckOutcome,
  type ClassificationCheck,
  type ClassificationStep,
} from '../../../../src/sync/coordinated/policy';
import {
  ANCHOR,
  anchorOf,
  classification,
  deepFreeze,
  failed,
  observed,
  rev,
} from './support';

const A = rev('A');
const B = rev('B');
const C = rev('C');
const D = rev('D');
const slotTime = (slot: number) => checkTime(ANCHOR, slot);
const iso = (slot: number) => slotTime(slot).toISOString();

/** A record T0 wrote at slot 1, and `checkIndex` slots have run since. */
function unsettled(
  overrides: Partial<Record<keyof ClassificationRecord, unknown>> = {},
): ClassificationRecord {
  return deepFreeze(
    classification(1, {
      anchor: ANCHOR,
      checkIndex: 1,
      nextDueAt: iso(2),
      lastAttemptedAt: iso(1),
      lastSuccessfulObservationAt: iso(1),
      contentRevision: A,
      consecutiveConfirmations: 1,
      provenance: 'reconciled',
      reviewState: 'unsettled',
      sourceObservedAt: iso(1),
      ...overrides,
    }),
  );
}

function settled(
  overrides: Partial<Record<keyof ClassificationRecord, unknown>> = {},
): ClassificationRecord {
  return unsettled({
    checkIndex: 4,
    nextDueAt: null,
    consecutiveConfirmations: 4,
    reviewState: 'settled',
    settledAt: iso(4),
    terminalReason: 'settled',
    lastSweptAt: iso(4),
    ...overrides,
  });
}

function pending(
  base: ClassificationRecord,
  revision: string,
  seenAt: string,
): ClassificationRecord {
  return deepFreeze({
    ...base,
    candidateRevision: revision,
    candidateFirstSeenAt: seenAt,
    consecutiveConfirmations: 0,
    markers: ['pending'],
  });
}

function check(
  record: ClassificationRecord,
  kind: ClassificationCheck,
  outcome: CheckOutcome,
  now: Date,
  backlogAvailable = true,
): ClassificationStep {
  return applyClassificationCheck(record, {
    check: kind,
    outcome,
    now,
    backlogAvailable,
  });
}

const cadence = (
  record: ClassificationRecord,
  slot: number,
  outcome: CheckOutcome,
  backlogAvailable = true,
) =>
  check(
    record,
    { kind: 'cadence', slot },
    outcome,
    slotTime(slot),
    backlogAvailable,
  );

const categories = (step: ClassificationStep) =>
  step.events.map((event) => event.category);

/** Every field on the review axis and the revision history. */
function reviewAxis(record: ClassificationRecord) {
  return {
    contentRevision: record.contentRevision,
    candidateRevision: record.candidateRevision,
    candidateFirstSeenAt: record.candidateFirstSeenAt,
    consecutiveConfirmations: record.consecutiveConfirmations,
    provenance: record.provenance,
    reviewState: record.reviewState,
    markers: record.markers,
    stagedCorrection: record.stagedCorrection,
    competingCorrection: record.competingCorrection,
    supersededRevisions: record.supersededRevisions,
    sourceObservedAt: record.sourceObservedAt,
    settledAt: record.settledAt,
    terminalReason: record.terminalReason,
    unstableSightings: record.unstableSightings,
  };
}

describe('T0: a first valid write', () => {
  it('is accepted without corroboration and counts its own check', () => {
    const record = newClassificationRecord(2026, anchorOf(1, ANCHOR));
    const step = cadence(record, 1, observed(A));

    expect(step.record).toMatchObject({
      contentRevision: A,
      provenance: 'reconciled',
      reviewState: 'unsettled',
      consecutiveConfirmations: 1,
      sourceObservedAt: iso(1),
      checkIndex: 1,
      nextDueAt: iso(2),
      publishedRevision: null,
    });
    expect(categories(step)).toEqual(['classification.first-write']);
  });

  it('counts no confirmation and consumes no slot when manual', () => {
    const record = newClassificationRecord(2026, anchorOf(1, ANCHOR));
    const step = check(record, { kind: 'manual' }, observed(A), slotTime(3));

    expect(step.record).toMatchObject({
      contentRevision: A,
      consecutiveConfirmations: 0,
      checkIndex: 0,
      nextDueAt: record.nextDueAt,
      sourceObservedAt: iso(3),
    });
  });
});

describe('T1 and D2.6: an identical revision is idempotent', () => {
  it('confirms without touching the content or its first observation', () => {
    const step = cadence(unsettled(), 2, observed(A));

    expect(step.record).toMatchObject({
      contentRevision: A,
      consecutiveConfirmations: 2,
      sourceObservedAt: iso(1),
      lastSuccessfulObservationAt: iso(2),
    });
    expect(categories(step)).toEqual(['classification.confirmed']);
  });

  it('discards a pending revision that failed to reappear', () => {
    const step = cadence(
      pending(unsettled({ checkIndex: 2 }), B, iso(2)),
      3,
      observed(A),
    );

    expect(step.record.candidateRevision).toBeNull();
    expect(step.record.markers).toEqual([]);
    expect(step.record.contentRevision).toBe(A);
    expect(categories(step)).toEqual([
      'classification.pending-discarded',
      'classification.confirmed',
    ]);
  });
});

describe('D2.1: a differing unsettled revision needs two consecutive checks', () => {
  it('T2 records one sighting and applies nothing', () => {
    const step = cadence(unsettled(), 2, observed(B));

    expect(step.record).toMatchObject({
      contentRevision: A,
      candidateRevision: B,
      candidateFirstSeenAt: iso(2),
      consecutiveConfirmations: 0,
      markers: ['pending'],
    });
    expect(categories(step)).toEqual(['classification.pending-observed']);
  });

  it('T3 applies it on the next check, dated from its first sighting', () => {
    const step = cadence(
      pending(unsettled({ checkIndex: 2 }), B, iso(2)),
      3,
      observed(B),
    );

    expect(step.record).toMatchObject({
      contentRevision: B,
      supersededRevisions: [A],
      sourceObservedAt: iso(2),
      consecutiveConfirmations: 2,
      candidateRevision: null,
      markers: [],
    });
    expect(categories(step)).toEqual(['classification.overwrite']);
  });

  it('T4 replaces an uncorroborated pending revision and flags an unstable source at the third', () => {
    let record = pending(unsettled({ checkIndex: 2 }), B, iso(2));
    const seen: string[][] = [];
    for (const [slot, revision] of [
      [3, C],
      [4, D],
      [5, B],
      [6, C],
    ] as const) {
      const step = cadence(record, slot, observed(revision));
      seen.push(categories(step));
      record = step.record;
    }

    expect(record.contentRevision).toBe(A);
    expect(record.candidateRevision).toBe(C);
    expect(record.unstableSightings).toBe(3);
    expect(seen).toEqual([
      ['classification.pending-replaced'],
      ['classification.pending-replaced'],
      ['classification.unstable-source', 'classification.pending-replaced'],
      // Raised once, when the count reaches three.
      ['classification.pending-replaced'],
    ]);
  });

  it('never orders revisions by their hash values (D2.4)', () => {
    const [low, high] = [A, B].sort();
    const run = (first: string, second: string) => {
      const base = unsettled({ contentRevision: first });
      const sighted = cadence(base, 2, observed(second));
      const applied = cadence(sighted.record, 3, observed(second));
      return [
        categories(sighted),
        categories(applied),
        applied.record.contentRevision === second,
      ];
    };

    expect(run(low!, high!)).toEqual(run(high!, low!));
  });
});

describe('T5 and D2.2: a superseded revision is never applied again', () => {
  it('is rejected however many consecutive checks return it', () => {
    let record = unsettled({ contentRevision: B, supersededRevisions: [A] });
    for (const slot of [2, 3, 4, 5]) {
      const step = cadence(record, slot, observed(A));
      expect(categories(step)).toEqual(['classification.rejected-superseded']);
      record = step.record;
    }

    expect(record).toMatchObject({
      contentRevision: B,
      candidateRevision: null,
      consecutiveConfirmations: 0,
      supersededRevisions: [A],
    });
  });

  it('breaks a pending revision run, so it cannot corroborate across it', () => {
    const base = pending(
      unsettled({
        contentRevision: B,
        supersededRevisions: [A],
        checkIndex: 2,
      }),
      C,
      iso(2),
    );
    const rejected = cadence(base, 3, observed(A));
    const again = cadence(rejected.record, 4, observed(C));

    expect(rejected.record.candidateRevision).toBeNull();
    expect(again.record.contentRevision).toBe(B);
    expect(categories(again)).toEqual(['classification.pending-observed']);
  });

  it('fails closed when the history is full: the change stays pending', () => {
    const history = Array.from({ length: 16 }, (_, index) =>
      rev(`old-${index}`),
    );
    const base = pending(
      unsettled({ supersededRevisions: history, checkIndex: 2 }),
      B,
      iso(2),
    );
    const step = cadence(base, 3, observed(B));

    expect(step.record.contentRevision).toBe(A);
    expect(step.record.candidateRevision).toBe(B);
    expect(step.record.supersededRevisions).toEqual(history);
    expect(categories(step)).toEqual([
      'classification.revision-history-capacity',
    ]);
  });
});

describe('T6: failure is never a state change', () => {
  it.each([
    ['an unsettled record', unsettled({ checkIndex: 2 })],
    ['a pending record', pending(unsettled({ checkIndex: 2 }), B, iso(2))],
    [
      'a first write not yet made',
      newClassificationRecord(2026, anchorOf(1, ANCHOR)),
    ],
  ])(
    'leaves every review field of %s unchanged, and still consumes the slot',
    (_label, record) => {
      const step = cadence(record, 3, failed);

      expect(reviewAxis(step.record)).toEqual(reviewAxis(record));
      expect(step.record.checkIndex).toBe(3);
      expect(step.record.lastAttemptedAt).toBe(iso(3));
      expect(step.record.lastSuccessfulObservationAt).toBe(
        record.lastSuccessfulObservationAt,
      );
      expect(categories(step)).toEqual(['classification.check-failed']);
    },
  );

  it('never settles on a failed check, even with enough confirmations', () => {
    const step = cadence(
      unsettled({ checkIndex: 3, consecutiveConfirmations: 3 }),
      4,
      failed,
    );

    expect(step.record.reviewState).toBe('unsettled');
    expect(step.record.nextDueAt).toBe(iso(5));
  });

  it('keeps a failed slow-path read from holding its place in the rotation', () => {
    const record = pending(settled(), B, iso(5));
    const now = new Date('2026-11-01T10:17:00.000Z');
    const step = check(record, { kind: 'reread' }, failed, now);

    expect(reviewAxis(step.record)).toEqual(reviewAxis(record));
    expect(step.record.lastSweptAt).toBe(now.toISOString());
    expect(step.record.lastPriorityAttemptAt).toBe(now.toISOString());
  });
});

describe('a check that was not attempted changes nothing', () => {
  it('a limiter deferral records only when to retry', () => {
    const record = unsettled({ checkIndex: 2 });
    const retryAt = '2026-10-05T04:17:30.000Z';
    const step = cadence(record, 3, { status: 'deferred', retryAt });

    expect(step.record).toEqual({ ...record, limiterDeferralUntil: retryAt });
    expect(categories(step)).toEqual(['classification.check-deferred']);
  });

  it('a cancelled check leaves the record identical', () => {
    const record = pending(unsettled({ checkIndex: 2 }), B, iso(2));
    const step = cadence(record, 3, { status: 'not-attempted' });

    expect(step.record).toEqual(record);
    expect(step.backlogInsertion).toBeNull();
  });
});

describe('the settling predicate', () => {
  it('is never evaluated before the +24h check', () => {
    const step = cadence(
      unsettled({ checkIndex: 2, consecutiveConfirmations: 2 }),
      3,
      observed(A),
    );

    expect(step.record.consecutiveConfirmations).toBe(3);
    expect(step.record.reviewState).toBe('unsettled');
  });

  it('settles at three confirmations from +24h, leaving the cadence for the slow path', () => {
    const step = cadence(
      unsettled({ checkIndex: 3, consecutiveConfirmations: 2 }),
      4,
      observed(A),
    );

    expect(step.record).toMatchObject({
      reviewState: 'settled',
      terminalReason: 'settled',
      settledAt: iso(4),
      nextDueAt: null,
      lastSweptAt: iso(4),
    });
    expect(categories(step)).toEqual([
      'classification.confirmed',
      'classification.settled',
    ]);
  });

  it('does not settle while a revision is pending', () => {
    const step = cadence(
      pending(unsettled({ checkIndex: 5 }), B, iso(5)),
      6,
      observed(C),
    );

    expect(step.record.reviewState).toBe('unsettled');
  });
});

describe('the 14-day ceiling', () => {
  it('settles on deadline whatever the confirmation count', () => {
    const step = cadence(
      unsettled({ checkIndex: 16, consecutiveConfirmations: 1 }),
      17,
      observed(A),
    );

    expect(step.record).toMatchObject({
      reviewState: 'settled',
      terminalReason: 'settled-on-deadline',
      consecutiveConfirmations: 2,
      nextDueAt: null,
    });
    expect(categories(step)).toEqual([
      'classification.confirmed',
      'classification.settled-on-deadline',
    ]);
  });

  it('stages a pending revision uncorroborated rather than dropping or applying it', () => {
    const step = cadence(unsettled({ checkIndex: 16 }), 17, observed(B));

    expect(step.record).toMatchObject({
      contentRevision: A,
      candidateRevision: null,
      stagedCorrection: {
        revision: B,
        firstSeenAt: iso(17),
        uncorroborated: true,
      },
      markers: ['staged'],
      terminalReason: 'settled-on-deadline',
    });
    expect(step.backlogInsertion).toBe(B);
    expect(categories(step)).toEqual([
      'classification.pending-observed',
      'classification.settled-on-deadline',
      'classification.staged-uncorroborated',
    ]);
  });

  it('is a time rule: it fires at the final slot even when that check fails', () => {
    const record = pending(unsettled({ checkIndex: 16 }), B, iso(16));
    const step = cadence(record, 17, failed);

    expect(step.record.contentRevision).toBe(A);
    expect(step.record.consecutiveConfirmations).toBe(
      record.consecutiveConfirmations,
    );
    expect(step.record.terminalReason).toBe('settled-on-deadline');
    expect(step.record.stagedCorrection).toEqual({
      revision: B,
      firstSeenAt: iso(16),
      uncorroborated: true,
    });
  });

  it('stops polling a round that was never reconciled, and flags it', () => {
    const record = newClassificationRecord(2026, anchorOf(1, ANCHOR));
    const step = cadence(record, 17, failed);

    expect(step.record).toMatchObject({
      terminalReason: 'never-reconciled-abandoned',
      reviewState: 'absent',
      contentRevision: null,
      nextDueAt: null,
    });
    expect(categories(step)).toEqual([
      'classification.check-failed',
      'classification.never-reconciled',
    ]);
  });
});

describe('a round abandoned as never reconciled', () => {
  it('settles on deadline at once when a manual run finds its first result', () => {
    const abandoned = deepFreeze({
      ...newClassificationRecord(2026, anchorOf(1, ANCHOR)),
      checkIndex: 17,
      nextDueAt: null,
      terminalReason: 'never-reconciled-abandoned',
    } as ClassificationRecord);
    const now = new Date('2026-11-01T10:17:00.000Z');
    const step = check(abandoned, { kind: 'manual' }, observed(A), now);

    expect(step.record).toMatchObject({
      contentRevision: A,
      reviewState: 'settled',
      terminalReason: 'settled-on-deadline',
      settledAt: now.toISOString(),
      checkIndex: 17,
      nextDueAt: null,
    });
    expect(categories(step)).toEqual([
      'classification.first-write',
      'classification.settled-on-deadline',
    ]);
  });
});

describe('D2.5 and D2.8: a settled record is never changed automatically', () => {
  const later = new Date('2026-11-01T10:17:00.000Z');
  const laterStill = new Date('2026-11-08T10:17:00.000Z');

  it('T8 records a late change once, applying nothing', () => {
    const step = check(settled(), { kind: 'reread' }, observed(B), later);

    expect(step.record).toMatchObject({
      contentRevision: A,
      candidateRevision: B,
      candidateFirstSeenAt: later.toISOString(),
      lastPriorityAttemptAt: later.toISOString(),
      reviewState: 'settled',
    });
    expect(categories(step)).toEqual(['classification.pending-observed']);
  });

  it('T9 stages the corroborated change for review, and never applies it', () => {
    const step = check(
      pending(settled(), B, later.toISOString()),
      { kind: 'reread' },
      observed(B),
      laterStill,
    );

    expect(step.record).toMatchObject({
      contentRevision: A,
      supersededRevisions: [],
      candidateRevision: null,
      stagedCorrection: {
        revision: B,
        firstSeenAt: later.toISOString(),
        uncorroborated: false,
      },
      markers: ['staged'],
    });
    expect(step.backlogInsertion).toBe(B);
    expect(categories(step)).toEqual(['classification.staged-correction']);
  });

  it('fails closed at backlog capacity: nothing is staged and the change stays pending', () => {
    const record = pending(settled(), B, later.toISOString());
    const step = check(
      record,
      { kind: 'reread' },
      observed(B),
      laterStill,
      false,
    );

    expect(step.record.stagedCorrection).toBeNull();
    expect(step.record.candidateRevision).toBe(B);
    expect(step.record.contentRevision).toBe(A);
    expect(step.backlogInsertion).toBeNull();
    expect(categories(step)).toEqual([
      'classification.backlog-capacity-exceeded',
    ]);
  });

  it('T10 clears the pending revision when the accepted one returns', () => {
    const step = check(
      pending(settled(), B, later.toISOString()),
      { kind: 'reread' },
      observed(A),
      laterStill,
    );

    expect(step.record.candidateRevision).toBeNull();
    expect(step.record.contentRevision).toBe(A);
  });

  it('holds a staged or locked record for its operator: no run transitions it', () => {
    const staged = {
      revision: B,
      firstSeenAt: later.toISOString(),
      uncorroborated: false,
    };
    for (const record of [
      deepFreeze({
        ...settled(),
        stagedCorrection: staged,
        markers: ['staged'],
      }),
      deepFreeze({
        ...settled(),
        stagedCorrection: staged,
        competingCorrection: { ...staged, revision: C },
        markers: ['review_locked', 'staged'],
      }),
    ] as ClassificationRecord[]) {
      for (const kind of [{ kind: 'reread' }, { kind: 'manual' }] as const) {
        for (const revision of [A, B, C, D]) {
          const step = check(record, kind, observed(revision), laterStill);
          expect(reviewAxis(step.record)).toEqual(reviewAxis(record));
          expect(categories(step)).toEqual(['classification.backlog-held']);
        }
      }
    }
  });
});

describe('a manual run cannot build corroboration or move the cadence (O-8)', () => {
  it('neither sights, corroborates, confirms, stages nor consumes a slot', () => {
    const now = slotTime(3);
    for (const record of [
      unsettled({ checkIndex: 2 }),
      pending(unsettled({ checkIndex: 2 }), B, iso(2)),
      pending(settled(), B, iso(5)),
    ]) {
      for (const revision of [A, B, C]) {
        const step = check(record, { kind: 'manual' }, observed(revision), now);
        expect(reviewAxis(step.record)).toEqual(reviewAxis(record));
        expect(step.record.checkIndex).toBe(record.checkIndex);
        expect(step.record.nextDueAt).toBe(record.nextDueAt);
        expect(step.backlogInsertion).toBeNull();
      }
    }
  });
});

describe('an unsettled record read between its slots', () => {
  it('is not a reconciliation check: it confirms, sights and corroborates nothing', () => {
    const record = pending(unsettled({ checkIndex: 2 }), B, iso(2));
    for (const revision of [A, B, C]) {
      const step = check(
        record,
        { kind: 'reread' },
        observed(revision),
        slotTime(2),
      );
      expect(reviewAxis(step.record)).toEqual(reviewAxis(record));
      expect(step.record.checkIndex).toBe(2);
    }
  });
});
