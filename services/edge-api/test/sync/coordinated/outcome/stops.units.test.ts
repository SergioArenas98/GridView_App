/**
 * The publication half's PR-E1 rules, one at a time: which conditions stop a
 * season durably instead of looping hourly (OD-5), what a stopped or durably
 * blocked ending writes, and that recovery never erases a stop.
 */

import { describe, expect, it } from 'vitest';

import { MemorySnapshotStorage } from '../../../../src/storage/local';
import type {
  ClassificationRecord,
  SeasonRecord,
} from '../../../../src/sync/coordinated/ledger';
import {
  durableBlockReason,
  recoverUnfinishedPublication,
  settleSeasonRecord,
  withheldByPolicy,
  type SettlementDecision,
} from '../../../../src/sync/coordinated/outcome';
import type {
  CheckOutcome,
  PlannedCheck,
} from '../../../../src/sync/coordinated/policy';
import { classification, rev, seasonRecord } from '../ledger/support';
import { anchorOf } from '../policy/support';

const NOW = new Date('2026-09-28T10:17:00.000Z');
const OPERATION = '7d1e2f3a-4b5c-4d6e-8f7a-8b9c0d1e2f3a';
const A = rev('A');
const B = rev('B');

const check = (round: number): PlannedCheck => ({
  round,
  anchor: anchorOf(round, '2026-03-01T12:00:00.000Z'),
  check: 'reread',
});
const observed = (revision: string): CheckOutcome => ({
  status: 'observed',
  revision,
});

/** Round 1, accepted as B after A was superseded. */
const superseding = (
  overrides: Partial<Record<keyof ClassificationRecord, unknown>> = {},
) =>
  classification(1, {
    contentRevision: B,
    supersededRevisions: [A],
    provenance: 'reconciled',
    reviewState: 'settled',
    terminalReason: 'settled',
    ...overrides,
  });

describe('the OD-5 conditions that would loop hourly', () => {
  const input = (
    record: ClassificationRecord,
    outcome: CheckOutcome,
    capacityExceeded = false,
  ) => ({
    checks: [check(1)],
    records: new Map([[1, record]]),
    outcomes: new Map([[1, outcome]]),
    capacityExceeded,
  });

  it('stop a settled round serving a superseded revision', () => {
    expect(durableBlockReason(input(superseding(), observed(A)))).toBe(
      'classification-superseded',
    );
  });

  it('leave an unsettled round serving one to its own bounded cadence', () => {
    expect(
      durableBlockReason(
        input(superseding({ reviewState: 'unsettled' }), observed(A)),
      ),
    ).toBeNull();
  });

  it('are not raised by an accepted or merely unavailable reread', () => {
    expect(durableBlockReason(input(superseding(), observed(B)))).toBeNull();
    expect(
      durableBlockReason(input(superseding(), { status: 'failed' })),
    ).toBeNull();
  });

  it('stop a season whose correction the full backlog could not take', () => {
    expect(durableBlockReason(input(superseding(), observed(B), true))).toBe(
      'backlog-capacity-exceeded',
    );
  });

  it('take precedence over every other withholding decision', () => {
    for (const reasons of [
      ['classification-staged'],
      ['classification-pending'],
      ['season-resource-unavailable'],
    ] as const) {
      expect(
        withheldByPolicy(reasons, [], 'classification-superseded'),
      ).toEqual({
        decision: 'durably-blocked',
        reason: 'classification-superseded',
      });
    }
    // Without one, the earlier decisions are unchanged.
    expect(withheldByPolicy(['classification-superseded'], [])).toEqual({
      decision: 'cadence',
      records: [],
    });
  });
});

describe('the outcome commit of a stopped or durably blocked run', () => {
  const hold = { since: '2026-09-27T00:00:00.000Z', operationId: OPERATION };
  const previousBlock = {
    state: 'blocked',
    since: '2026-09-27T00:00:00.000Z',
    reason: 'guard-round-coverage-regression',
  } as const;
  const record: SeasonRecord = seasonRecord({
    publicationDueAt: '2026-09-28T09:00:00.000Z',
    operatorHold: hold,
    publicationDisposition: {
      state: 'publishing',
      since: '2026-09-28T10:00:00.000Z',
      digest: null,
      orderingInput: null,
    },
  });
  const settle = (
    decision: SettlementDecision,
    advancesSchedule: boolean,
    previous: SeasonRecord['publicationDisposition'] = null,
  ) =>
    settleSeasonRecord({
      record,
      previous,
      decision,
      now: NOW,
      advancesSchedule,
    });

  it('stopped: keeps the hold and any earlier block, and sets no due time', () => {
    expect(settle({ decision: 'stopped' }, true, previousBlock)).toEqual({
      ...record,
      publicationDisposition: previousBlock,
      publicationDueAt: null,
    });
    // A manual run moves no due time (O-8).
    expect(settle({ decision: 'stopped' }, false)).toEqual({
      ...record,
      publicationDisposition: null,
    });
  });

  it('durably blocked: records the block with its reason and instant', () => {
    const decision = {
      decision: 'durably-blocked',
      reason: 'backlog-capacity-exceeded',
    } as const;
    expect(settle(decision, true)).toEqual({
      ...record,
      publicationDisposition: null,
      durableBlock: {
        since: NOW.toISOString(),
        reason: 'backlog-capacity-exceeded',
      },
      publicationDueAt: null,
    });
    expect(settle(decision, false, previousBlock)).toMatchObject({
      publicationDisposition: previousBlock,
      publicationDueAt: '2026-09-28T09:00:00.000Z',
    });
  });

  it('never touches the hold, whatever the ending', () => {
    const decisions: SettlementDecision[] = [
      {
        decision: 'completed',
        release: { digest: rev('d'), activeVersion: 'v-1', published: true },
      },
      { decision: 'retry' },
      { decision: 'cadence', records: [] },
      { decision: 'blocked', reason: 'classification-staged' },
      { decision: 'durably-blocked', reason: 'classification-superseded' },
      { decision: 'stopped' },
      { decision: 'resolve' },
    ];
    for (const decision of decisions) {
      for (const advancesSchedule of [true, false]) {
        expect(settle(decision, advancesSchedule).operatorHold).toEqual(hold);
      }
    }
  });
});

describe('recovery under a stop', () => {
  it('resolves an unfinished publication and keeps the hold and the block', async () => {
    const stored = seasonRecord({
      operatorHold: {
        since: '2026-09-27T00:00:00.000Z',
        operationId: OPERATION,
      },
      durableBlock: {
        since: '2026-09-27T00:00:00.000Z',
        reason: 'classification-superseded',
      },
      publicationDisposition: {
        state: 'publishing',
        since: '2026-09-28T09:17:01.300Z',
        digest: rev('digest'),
        orderingInput: '2026-09-28T09:17:01.300Z',
      },
    });
    const storage = Object.assign(
      Object.create(new MemorySnapshotStorage()) as MemorySnapshotStorage,
      {
        readPublicationMetadata: async () => ({
          schemaVersion: 1,
          sourceOrderingInput: '2026-09-28T09:17:01.300Z',
        }),
      },
    );

    const recovery = await recoverUnfinishedPublication({
      record: stored,
      activeVersion: 'pm1-active',
      storage,
      now: NOW,
    });

    expect(recovery).toMatchObject({
      kind: 'resolved',
      resolution: 'published',
      record: {
        operatorHold: stored.operatorHold,
        durableBlock: stored.durableBlock,
        publicationDisposition: null,
      },
    });
  });
});
