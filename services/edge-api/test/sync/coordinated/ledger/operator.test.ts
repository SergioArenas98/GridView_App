/**
 * The operator transitions and the invariants that keep them the operator's
 * (PR-E1): the season-level hold, release and block clearing (`operate`), the
 * T12 disposition (`dispose`), and the commit rules that stop an ordinary
 * run from clearing a staged correction, a backlog entry, a hold or a
 * durable block, or from reserving a publication through a stop.
 *
 * Every refusal leaves storage byte-for-byte unchanged.
 */

import { describe, expect, it } from 'vitest';

import {
  SUPERSEDED_REVISION_CAPACITY,
  ledgerKeys,
  type ClassificationRecord,
  type DispositionRequest,
  type LeaseToken,
  type OperatorActionRequest,
  type SeasonOperatorAction,
  type SeasonRecord,
} from '../../../../src/sync/coordinated/ledger';
import {
  decodeClassificationRecord,
  decodeSeasonRecord,
} from '../../../../src/sync/coordinated/ledger/records';
import {
  SEASON,
  START,
  classification,
  commitRequest,
  committedBytes,
  lease,
  ledgerFixture,
  plantClassification,
  rev,
  seasonRecord,
  stagedClassification,
  write,
  type LedgerFixture,
} from './support';

const OP = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-9222-222222222222',
  '33333333-3333-4333-a333-333333333333',
  '44444444-4444-4444-b444-444444444444',
] as const;

function action(
  token: LeaseToken,
  kind: SeasonOperatorAction,
  operationId: string,
  expectedVersion: number,
): OperatorActionRequest {
  return {
    lease: token,
    action: kind,
    operationId,
    authMethod: 'shared-admin-token',
    expectedVersion,
  };
}

async function applied(fixture: LedgerFixture, request: OperatorActionRequest) {
  const outcome = await fixture.ledger.operate(request);
  if (outcome.outcome !== 'applied') {
    throw new Error(`not applied: ${JSON.stringify(outcome)}`);
  }
  return outcome.snapshot;
}

describe('the operator state schema', () => {
  it('accepts a hold, a durable block and the last operator action', () => {
    const record = seasonRecord({
      operatorHold: { since: START, operationId: OP[0] },
      durableBlock: { since: START, reason: 'backlog-capacity-exceeded' },
      lastOperatorAction: {
        operationId: OP[0],
        action: 'hold',
        at: START,
        authMethod: 'shared-admin-token',
      },
    });
    expect(decodeSeasonRecord(record)).toEqual({ ok: true, value: record });
  });

  it.each([
    ['an uppercase operation ID', { operationId: OP[2].toUpperCase() }],
    [
      'a version 1 UUID',
      { operationId: '11111111-1111-1111-8111-111111111111' },
    ],
    ['a free-form name', { operationId: 'alice' }],
    ['an extra key', { operationId: OP[0], actor: 'alice' }],
  ])('refuses a hold with %s', (_, hold) => {
    expect(
      decodeSeasonRecord(
        seasonRecord({ operatorHold: { since: START, ...hold } }),
      ),
    ).toEqual({ ok: false, reason: 'invalid-record' });
  });

  it.each([
    // The method is closed: no token, no person, no free text.
    ['a token-like method', { authMethod: 'Bearer abc123' }],
    ['a person', { authMethod: 'alice@example.com' }],
    ['an unknown action', { action: 'publish' }],
  ])('refuses a last operator action with %s', (_, fields) => {
    expect(
      decodeSeasonRecord(
        seasonRecord({
          lastOperatorAction: {
            operationId: OP[0],
            action: 'hold',
            at: START,
            authMethod: 'shared-admin-token',
            ...fields,
          },
        }),
      ),
    ).toEqual({ ok: false, reason: 'invalid-record' });
  });

  it('refuses a durable block for a reason no run records', () => {
    expect(
      decodeSeasonRecord(
        seasonRecord({
          durableBlock: { since: START, reason: 'classification-staged' },
        }),
      ),
    ).toEqual({ ok: false, reason: 'invalid-record' });
  });

  it('accepts a disposition record and refuses one carrying a payload', () => {
    const lastDisposition = {
      operationId: OP[0],
      action: 'retain-published',
      at: START,
      authMethod: 'shared-admin-token',
      stagedRevision: rev('staged'),
    };
    const record = classification(1, { lastDisposition });
    expect(decodeClassificationRecord(record)).toEqual({
      ok: true,
      value: record,
    });
    expect(
      decodeClassificationRecord(
        classification(1, {
          lastDisposition: { ...lastDisposition, stagedRevision: 'P1 VER' },
        }),
      ),
    ).toEqual({ ok: false, reason: 'invalid-record' });
  });
});

describe('season operator actions', () => {
  it('holds a season no run has observed yet, recording method and operation ID', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);

    const snapshot = await applied(fixture, action(token, 'hold', OP[0], 0));

    expect(snapshot.seasonRecord).toEqual({
      version: 1,
      record: seasonRecord({
        operatorHold: { since: START, operationId: OP[0] },
        lastOperatorAction: {
          operationId: OP[0],
          action: 'hold',
          at: START,
          authMethod: 'shared-admin-token',
        },
      }),
    });
    // Nothing but the method and the ID: no token, no name.
    expect(committedBytes(fixture.host)).not.toMatch(/Bearer|ADMIN_TOKEN/);
  });

  it('keeps every other field of an observed season as it was', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    const stored = seasonRecord({
      publicationDueAt: '2026-09-27T13:17:00.000Z',
      publicationDisposition: {
        state: 'blocked',
        since: START,
        reason: 'guard-round-coverage-regression',
      },
    });
    await fixture.ledger.commit(
      commitRequest(token, { seasonRecord: write(stored) }),
    );

    const held = await applied(fixture, action(token, 'hold', OP[0], 1));

    expect(held.seasonRecord?.record).toEqual({
      ...stored,
      operatorHold: { since: START, operationId: OP[0] },
      lastOperatorAction: expect.objectContaining({ action: 'hold' }),
    });
  });

  it('releases the hold as consent to resume: publication is due now', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await applied(fixture, action(token, 'hold', OP[0], 0));
    fixture.clock.set('2026-09-27T12:05:00.000Z');

    const released = await applied(
      fixture,
      action(token, 'release-hold', OP[1], 1),
    );

    expect(released.seasonRecord?.record).toMatchObject({
      operatorHold: null,
      publicationDueAt: '2026-09-27T12:05:00.000Z',
      lastOperatorAction: { operationId: OP[1], action: 'release-hold' },
    });
  });

  it('clears a durable block only by the operator, and leaves a hold alone', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fixture.ledger.commit(
      commitRequest(token, {
        seasonRecord: write(
          seasonRecord({
            durableBlock: { since: START, reason: 'classification-superseded' },
          }),
        ),
      }),
    );
    await applied(fixture, action(token, 'hold', OP[0], 1));

    const cleared = await applied(
      fixture,
      action(token, 'clear-block', OP[1], 2),
    );

    expect(cleared.seasonRecord?.record).toMatchObject({
      durableBlock: null,
      operatorHold: { operationId: OP[0] },
      publicationDueAt: START,
    });
  });

  it.each([
    ['hold', 'a season already held', true],
    ['release-hold', 'a season not held', false],
    ['clear-block', 'a season not blocked', false],
  ] as const)('refuses %s on %s, changing nothing', async (kind, _, held) => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    if (held) await applied(fixture, action(token, 'hold', OP[0], 0));
    else {
      await fixture.ledger.commit(
        commitRequest(token, { seasonRecord: write(seasonRecord()) }),
      );
    }
    const before = committedBytes(fixture.host);

    expect(await fixture.ledger.operate(action(token, kind, OP[1], 1))).toEqual(
      {
        outcome: 'rejected',
        reason: 'operator-precondition-failed',
      },
    );
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('refuses a stale inspected version', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await fixture.ledger.commit(
      commitRequest(token, { seasonRecord: write(seasonRecord()) }),
    );
    const before = committedBytes(fixture.host);

    for (const expected of [0, 2]) {
      expect(
        await fixture.ledger.operate(action(token, 'hold', OP[0], expected)),
      ).toEqual({ outcome: 'rejected', reason: 'version-conflict' });
    }
    expect(committedBytes(fixture.host)).toBe(before);
  });
});

describe('replayed operation IDs', () => {
  it('answers a resent action as already applied, writing nothing', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    const request = action(token, 'hold', OP[0], 0);
    await applied(fixture, request);
    const after = committedBytes(fixture.host);

    // Resent with the version it was first sent with, which has moved on.
    const again = await fixture.ledger.operate(request);
    expect(again.outcome).toBe('already-applied');
    expect(committedBytes(fixture.host)).toBe(after);
    expect(
      again.outcome === 'already-applied' && again.snapshot.seasonRecord,
    ).toMatchObject({ version: 1 });
  });

  it('refuses an operation ID reused for another action', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await applied(fixture, action(token, 'hold', OP[0], 0));
    const after = committedBytes(fixture.host);

    expect(
      await fixture.ledger.operate(action(token, 'release-hold', OP[0], 1)),
    ).toEqual({ outcome: 'rejected', reason: 'operation-id-reused' });
    expect(committedBytes(fixture.host)).toBe(after);
  });

  it('never applies an old ID twice, even after a later action', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await applied(fixture, action(token, 'hold', OP[0], 0));
    await applied(fixture, action(token, 'release-hold', OP[1], 1));
    const after = committedBytes(fixture.host);

    // The hold's ID is no longer the last one: its version check refuses it.
    expect(
      await fixture.ledger.operate(action(token, 'hold', OP[0], 0)),
    ).toEqual({ outcome: 'rejected', reason: 'version-conflict' });
    expect(committedBytes(fixture.host)).toBe(after);
  });
});

describe('fencing and concurrency', () => {
  it('refuses an action without the current, unexpired lease', async () => {
    const fixture = ledgerFixture();
    const first = await lease(fixture);
    await fixture.ledger.releaseLease(first);
    const second = await lease(fixture);

    expect(
      await fixture.ledger.operate(action(first, 'hold', OP[0], 0)),
    ).toEqual({ outcome: 'rejected', reason: 'lease-superseded' });
    await fixture.ledger.releaseLease(second);
    expect(
      await fixture.ledger.operate(action(second, 'hold', OP[0], 0)),
    ).toEqual({ outcome: 'rejected', reason: 'lease-not-held' });

    const third = await lease(fixture);
    fixture.clock.advance(10 * 60 * 1000);
    expect(
      await fixture.ledger.operate(action(third, 'hold', OP[0], 0)),
    ).toEqual({ outcome: 'rejected', reason: 'lease-expired' });
    expect(
      await fixture.ledger.dispose(disposal(third, 1, 'accept-staged', OP[1])),
    ).toEqual({ outcome: 'rejected', reason: 'lease-expired' });
    // Only lease records were ever written.
    expect(fixture.host.committedKeys()).toEqual([ledgerKeys.lease(SEASON)]);
  });

  it('lets one of two concurrent operators act; the other finds the lease held', async () => {
    const fixture = ledgerFixture();
    const winner = await fixture.ledger.acquireLease(SEASON);
    const loser = await fixture.ledger.acquireLease(SEASON);

    expect(winner.outcome).toBe('acquired');
    expect(loser).toEqual({ outcome: 'rejected', reason: 'lease-held' });
  });

  it('survives a restart of the store', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    await applied(fixture, action(token, 'hold', OP[0], 0));

    const restarted = ledgerFixture(fixture.host.restart(), fixture.clock);
    const read = await restarted.ledger.readSeason(SEASON);
    expect(read.outcome === 'read' && read.snapshot.seasonRecord).toMatchObject(
      { record: { operatorHold: { operationId: OP[0] } } },
    );
    // And the resent ID is still recognized after the restart.
    expect(
      (await restarted.ledger.operate(action(token, 'hold', OP[0], 0))).outcome,
    ).toBe('already-applied');
  });
});

describe('what an ordinary commit may not do to operator state', () => {
  async function held(fixture: LedgerFixture) {
    const token = await lease(fixture);
    const snapshot = await applied(fixture, action(token, 'hold', OP[0], 0));
    return { token, stored: snapshot.seasonRecord! };
  }

  it('cannot clear, change or forge a hold or the last action', async () => {
    const fixture = ledgerFixture();
    const { token, stored } = await held(fixture);
    const before = committedBytes(fixture.host);

    for (const change of [
      { operatorHold: null },
      { operatorHold: { since: START, operationId: OP[1] } },
      { lastOperatorAction: null },
      {
        lastOperatorAction: {
          ...stored.record.lastOperatorAction!,
          action: 'release-hold',
        },
      },
    ]) {
      expect(
        await fixture.ledger.commit(
          commitRequest(token, {
            seasonRecord: write(
              { ...stored.record, ...change } as SeasonRecord,
              1,
            ),
          }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'operator-state-immutable' });
    }
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('cannot set a hold, even on the first write', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          seasonRecord: write(
            seasonRecord({
              operatorHold: { since: START, operationId: OP[0] },
            }),
          ),
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'operator-state-immutable' });
  });

  it('may set a durable block, but never change or clear one', async () => {
    const fixture = ledgerFixture();
    const token = await lease(fixture);
    const blocked = seasonRecord({
      durableBlock: { since: START, reason: 'classification-superseded' },
    });
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, { seasonRecord: write(blocked) }),
        )
      ).outcome,
    ).toBe('committed');
    const before = committedBytes(fixture.host);

    for (const durableBlock of [
      null,
      { since: START, reason: 'backlog-capacity-exceeded' },
      {
        since: '2026-09-27T12:01:00.000Z',
        reason: 'classification-superseded',
      },
    ]) {
      expect(
        await fixture.ledger.commit(
          commitRequest(token, {
            seasonRecord: write(
              { ...blocked, durableBlock } as SeasonRecord,
              1,
            ),
          }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'operator-state-immutable' });
    }
    expect(committedBytes(fixture.host)).toBe(before);
    // An unrelated change keeps the block exactly as it is.
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, {
            seasonRecord: write({ ...blocked, publicationDueAt: START }, 1),
          }),
        )
      ).outcome,
    ).toBe('committed');
  });

  it.each([
    ['a hold', 'hold'],
    ['a durable block', 'block'],
  ] as const)(
    'refuses a publication reservation through %s',
    async (_, kind) => {
      const fixture = ledgerFixture();
      let token: LeaseToken;
      let stored;
      if (kind === 'hold') {
        ({ token, stored } = await held(fixture));
      } else {
        token = await lease(fixture);
        const outcome = await fixture.ledger.commit(
          commitRequest(token, {
            seasonRecord: write(
              seasonRecord({
                durableBlock: {
                  since: START,
                  reason: 'backlog-capacity-exceeded',
                },
              }),
            ),
          }),
        );
        if (outcome.outcome !== 'committed') throw new Error('not committed');
        stored = outcome.snapshot.seasonRecord!;
      }
      const before = committedBytes(fixture.host);
      const publishing = (digest: string | null) =>
        ({
          state: 'publishing',
          since: START,
          digest,
          orderingInput: digest === null ? null : START,
        }) as const;

      expect(
        await fixture.ledger.commit(
          commitRequest(token, {
            seasonRecord: write(
              {
                ...stored.record,
                lastOrderingInput: START,
                publicationDisposition: publishing(rev('digest')),
              },
              stored.version,
            ),
          }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'publication-stopped' });
      expect(committedBytes(fixture.host)).toBe(before);
      // Marking an unreserved publication is not a reservation.
      expect(
        (
          await fixture.ledger.commit(
            commitRequest(token, {
              seasonRecord: write(
                { ...stored.record, publicationDisposition: publishing(null) },
                stored.version,
              ),
            }),
          )
        ).outcome,
      ).toBe('committed');
    },
  );
});

describe('D2.5: what an ordinary commit may not do to a staged correction', () => {
  const competing = {
    revision: rev('competing'),
    firstSeenAt: '2026-04-02T04:00:00.000Z',
    uncorroborated: false,
  };

  async function stagedRound(fixture: LedgerFixture, withCompeting = false) {
    const token = await lease(fixture);
    const staged = stagedClassification(1, rev('staged'), SEASON);
    await fixture.ledger.commit(
      commitRequest(token, {
        classifications: [write(staged)],
        backlogInsertions: [{ round: 1, revision: rev('staged') }],
      }),
    );
    if (!withCompeting) return { token, record: staged };
    // Only `verify` can create it; planted, so this tests `commit` alone.
    const record: ClassificationRecord = {
      ...staged,
      competingCorrection: competing,
      markers: ['review_locked', 'staged'],
    };
    plantClassification(fixture.host, record);
    return { token, record };
  }

  it.each([
    ['clears the staged slot', { stagedCorrection: null, markers: [] }],
    [
      'replaces the staged revision',
      {
        stagedCorrection: {
          revision: rev('other'),
          firstSeenAt: '2026-04-01T04:00:00.000Z',
          uncorroborated: false,
        },
      },
    ],
    [
      'marks it corroborated',
      {
        stagedCorrection: {
          revision: rev('staged'),
          firstSeenAt: '2026-04-01T04:00:00.000Z',
          uncorroborated: true,
        },
      },
    ],
    [
      'forges a disposition',
      {
        lastDisposition: {
          operationId: OP[0],
          action: 'accept-staged' as const,
          at: START,
          authMethod: 'shared-admin-token' as const,
          stagedRevision: rev('staged'),
        },
      },
    ],
  ])('refuses a commit that %s', async (_, change) => {
    const fixture = ledgerFixture();
    const { token, record } = await stagedRound(fixture);
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [write({ ...record, ...change }, 1)],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'staged-correction-immutable' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('refuses a commit that clears or changes a competing correction', async () => {
    const fixture = ledgerFixture();
    const { token, record } = await stagedRound(fixture, true);
    const before = committedBytes(fixture.host);

    for (const competingCorrection of [
      null,
      { ...competing, revision: rev('third') },
    ]) {
      expect(
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: [write({ ...record, competingCorrection }, 1)],
          }),
        ),
      ).toEqual({ outcome: 'rejected', reason: 'staged-correction-immutable' });
    }
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('refuses a commit that creates a competing correction: only verify may lock a record (PR-E3)', async () => {
    const fixture = ledgerFixture();
    const { token, record } = await stagedRound(fixture);
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [
            write(
              {
                ...record,
                competingCorrection: competing,
                markers: ['review_locked', 'staged'],
              },
              1,
            ),
          ],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'staged-correction-immutable' });
    // Not on a record's first write either.
    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [
            write(classification(2, { competingCorrection: competing })),
          ],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'staged-correction-immutable' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it.each([
    [
      'sets a candidate on a staged record',
      {
        candidateRevision: rev('candidate'),
        candidateFirstSeenAt: START,
        markers: ['pending', 'staged'] as ClassificationRecord['markers'],
      },
    ],
    [
      'forges a verification',
      {
        lastVerification: {
          operationId: OP[0],
          at: START,
          authMethod: 'shared-admin-token' as const,
          stagedRevision: rev('staged'),
          transition: 'candidate-observed' as const,
        },
      },
    ],
  ])('refuses a commit that %s (PR-E3)', async (_, change) => {
    const fixture = ledgerFixture();
    const { token, record } = await stagedRound(fixture);
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          classifications: [write({ ...record, ...change }, 1)],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'staged-correction-immutable' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('still lets a commit change scheduling fields of a staged record', async () => {
    const fixture = ledgerFixture();
    const { token, record } = await stagedRound(fixture);

    const outcome = await fixture.ledger.commit(
      commitRequest(token, {
        classifications: [write({ ...record, lastSweptAt: START }, 1)],
      }),
    );
    expect(outcome.outcome).toBe('committed');
  });

  it('refuses a commit that removes the backlog entry', async () => {
    const fixture = ledgerFixture();
    const { token } = await stagedRound(fixture);
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.commit(
        commitRequest(token, {
          backlogRemovals: [{ round: 1, revision: rev('staged') }],
        }),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'staged-correction-immutable' });
    expect(committedBytes(fixture.host)).toBe(before);
  });
});

function disposal(
  token: LeaseToken,
  round: number,
  kind: DispositionRequest['action'],
  operationId: string,
  expected: Partial<DispositionRequest['expected']> = {},
): DispositionRequest {
  return {
    lease: token,
    round,
    action: kind,
    operationId,
    authMethod: 'shared-admin-token',
    expected: {
      recordVersion: 1,
      contentRevision: rev(`content-${round}`),
      stagedRevision: rev(`staged-${round}`),
      competingRevision: null,
      ...expected,
    },
  };
}

describe('T12: dispose', () => {
  const competing = {
    revision: rev('competing-1'),
    firstSeenAt: '2026-04-02T04:00:00.000Z',
    uncorroborated: false,
  };

  /** Rounds staged for review, and the season blocked for them. */
  async function review(
    fixture: LedgerFixture,
    rounds: readonly number[] = [1],
    options: {
      competing?: boolean;
      season?: Parameters<typeof seasonRecord>[0];
      history?: readonly string[];
    } = {},
  ) {
    const token = await lease(fixture);
    await fixture.ledger.commit(
      commitRequest(token, {
        seasonRecord: write(
          seasonRecord({
            publicationDisposition: {
              state: 'blocked',
              since: START,
              reason: 'classification-staged',
            },
            ...options.season,
          }),
        ),
        classifications: rounds.map((round) =>
          write(
            stagedClassification(round, rev(`staged-${round}`), SEASON, {
              supersededRevisions: options.history ?? [],
            }),
          ),
        ),
        backlogInsertions: rounds.map((round) => ({
          round,
          revision: rev(`staged-${round}`),
        })),
      }),
    );
    if (options.competing && rounds.includes(1)) {
      // Only `verify` can create it; planted, so this tests `dispose` alone.
      plantClassification(
        fixture.host,
        stagedClassification(1, rev('staged-1'), SEASON, {
          supersededRevisions: options.history ?? [],
          competingCorrection: competing,
          markers: ['review_locked', 'staged'],
        }),
      );
    }
    return token;
  }

  async function disposed(fixture: LedgerFixture, request: DispositionRequest) {
    const outcome = await fixture.ledger.dispose(request);
    if (outcome.outcome !== 'applied') {
      throw new Error(`not applied: ${JSON.stringify(outcome)}`);
    }
    return outcome.snapshot;
  }

  const disposition = (kind: string, operationId: string, staged: string) => ({
    operationId,
    action: kind,
    at: START,
    authMethod: 'shared-admin-token',
    stagedRevision: staged,
  });

  it('accepts the staged revision and supersedes the one it displaces', async () => {
    const fixture = ledgerFixture();
    const token = await review(fixture);

    const snapshot = await disposed(
      fixture,
      disposal(token, 1, 'accept-staged', OP[0]),
    );

    expect(snapshot.classifications[0]).toEqual({
      version: 2,
      record: stagedClassification(1, rev('staged-1'), SEASON, {
        contentRevision: rev('staged-1'),
        sourceObservedAt: '2026-04-01T04:00:00.000Z',
        supersededRevisions: [rev('content-1')],
        stagedCorrection: null,
        markers: [],
        lastDisposition: disposition('accept-staged', OP[0], rev('staged-1')),
      }),
    });
    expect(snapshot.backlog.count).toBe(0);
    // The last round waiting for review: the season's review block lifts.
    expect(snapshot.seasonRecord).toMatchObject({
      version: 2,
      record: { publicationDisposition: null, publicationDueAt: START },
    });
  });

  it('keeps published: the exact staged revision is rejected permanently (OD-4)', async () => {
    const fixture = ledgerFixture();
    const token = await review(fixture);

    const snapshot = await disposed(
      fixture,
      disposal(token, 1, 'retain-published', OP[0]),
    );

    expect(snapshot.classifications[0]!.record).toMatchObject({
      contentRevision: rev('content-1'),
      sourceObservedAt: null,
      supersededRevisions: [rev('staged-1')],
      stagedCorrection: null,
      competingCorrection: null,
      candidateRevision: null,
      markers: [],
      lastDisposition: disposition('retain-published', OP[0], rev('staged-1')),
    });
    // D2.2: it can never be staged, pending or accepted again.
    const record = snapshot.classifications[0]!.record;
    for (const change of [
      { candidateRevision: rev('staged-1'), candidateFirstSeenAt: START },
      { contentRevision: rev('staged-1') },
    ]) {
      expect(
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: [write({ ...record, ...change }, 2)],
          }),
        ),
      ).toEqual({
        outcome: 'rejected',
        reason: 'superseded-revision-reapplied',
      });
    }
    // A different later revision may follow the normal review rules.
    expect(
      (
        await fixture.ledger.commit(
          commitRequest(token, {
            classifications: [
              write(
                {
                  ...record,
                  candidateRevision: rev('later'),
                  candidateFirstSeenAt: START,
                  markers: ['pending'],
                },
                2,
              ),
            ],
          }),
        )
      ).outcome,
    ).toBe('committed');
  });

  it('accepts a competing revision, clearing both slots', async () => {
    const fixture = ledgerFixture();
    const token = await review(fixture, [1], { competing: true });

    const snapshot = await disposed(
      fixture,
      disposal(token, 1, 'accept-competing', OP[0], {
        competingRevision: rev('competing-1'),
      }),
    );

    expect(snapshot.classifications[0]!.record).toMatchObject({
      contentRevision: rev('competing-1'),
      sourceObservedAt: '2026-04-02T04:00:00.000Z',
      supersededRevisions: [rev('content-1')],
      stagedCorrection: null,
      competingCorrection: null,
      markers: [],
    });
  });

  it('lifts the review block only at the last round waiting for review', async () => {
    const fixture = ledgerFixture();
    const token = await review(fixture, [1, 2]);

    const first = await disposed(
      fixture,
      disposal(token, 1, 'accept-staged', OP[0]),
    );
    expect(first.seasonRecord).toMatchObject({
      version: 1,
      record: {
        publicationDisposition: { reason: 'classification-staged' },
        publicationDueAt: null,
      },
    });
    expect(first.backlog.count).toBe(1);

    const second = await disposed(
      fixture,
      disposal(token, 2, 'retain-published', OP[1]),
    );
    expect(second.seasonRecord?.record).toMatchObject({
      publicationDisposition: null,
      publicationDueAt: START,
    });
    expect(second.backlog.count).toBe(0);
  });

  it('never lifts a hold, a durable block or any other block', async () => {
    // Another block reason is not a review block: the season is untouched.
    const guarded = ledgerFixture();
    const guardedToken = await review(guarded, [1], {
      season: {
        publicationDisposition: {
          state: 'blocked',
          since: START,
          reason: 'guard-round-coverage-regression',
        },
      },
    });
    const before = await guarded.ledger.readSeason(SEASON);
    const unchanged = await disposed(
      guarded,
      disposal(guardedToken, 1, 'accept-staged', OP[0]),
    );
    expect(unchanged.seasonRecord).toEqual(
      before.outcome === 'read' ? before.snapshot.seasonRecord : null,
    );

    // The review block lifts; a durable block stays exactly as it was.
    const blocked = ledgerFixture();
    const blockedToken = await review(blocked, [1], {
      season: {
        durableBlock: { since: START, reason: 'backlog-capacity-exceeded' },
      },
    });
    const lifted = await disposed(
      blocked,
      disposal(blockedToken, 1, 'accept-staged', OP[0]),
    );
    expect(lifted.seasonRecord?.record).toMatchObject({
      publicationDisposition: null,
      durableBlock: { since: START, reason: 'backlog-capacity-exceeded' },
    });

    const fixture = ledgerFixture();
    const token = await review(fixture);
    await applied(fixture, action(token, 'hold', OP[1], 1));

    const snapshot = await disposed(
      fixture,
      disposal(token, 1, 'accept-staged', OP[0]),
    );
    // The review block lifts; the hold stays exactly as it was.
    expect(snapshot.seasonRecord?.record).toMatchObject({
      publicationDisposition: null,
      operatorHold: { operationId: OP[1] },
    });
  });

  it('answers a resent disposition as already applied, and refuses a reused ID', async () => {
    const fixture = ledgerFixture();
    const token = await review(fixture);
    const request = disposal(token, 1, 'accept-staged', OP[0]);
    await disposed(fixture, request);
    const after = committedBytes(fixture.host);

    expect((await fixture.ledger.dispose(request)).outcome).toBe(
      'already-applied',
    );
    expect(
      await fixture.ledger.dispose(
        disposal(token, 1, 'retain-published', OP[0]),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'operation-id-reused' });
    expect(committedBytes(fixture.host)).toBe(after);
  });

  it.each([
    ['a stale record version', { recordVersion: 2 }, 'version-conflict'],
    [
      'another accepted revision',
      { contentRevision: rev('other') },
      'operator-precondition-failed',
    ],
    [
      'another staged revision',
      { stagedRevision: rev('other') },
      'operator-precondition-failed',
    ],
    [
      'a competing revision that is not there',
      { competingRevision: rev('competing-1') },
      'operator-precondition-failed',
    ],
  ] as const)('refuses %s, changing nothing', async (_, expected, reason) => {
    const fixture = ledgerFixture();
    const token = await review(fixture);
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.dispose(
        disposal(token, 1, 'accept-staged', OP[0], expected),
      ),
    ).toEqual({ outcome: 'rejected', reason });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('refuses a round with nothing staged, or no competing slot to accept', async () => {
    const fixture = ledgerFixture();
    const token = await review(fixture);
    await fixture.ledger.commit(
      commitRequest(token, {
        classifications: [
          write(classification(2, { contentRevision: rev('content-2') })),
        ],
      }),
    );
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.dispose(disposal(token, 2, 'accept-staged', OP[0])),
    ).toEqual({ outcome: 'rejected', reason: 'operator-precondition-failed' });
    expect(
      await fixture.ledger.dispose(
        disposal(token, 1, 'accept-competing', OP[0]),
      ),
    ).toEqual({ outcome: 'rejected', reason: 'operator-precondition-failed' });
    expect(
      await fixture.ledger.dispose(disposal(token, 9, 'accept-staged', OP[0])),
    ).toEqual({ outcome: 'rejected', reason: 'operator-precondition-failed' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('refuses a staged slot whose backlog entry is missing', async () => {
    const fixture = ledgerFixture();
    const token = await review(fixture);
    // Removed outside the store: the pairing D2.5 relies on is broken.
    fixture.host.transactionSync((store) =>
      store.delete(ledgerKeys.backlog(SEASON, 1)),
    );
    const before = committedBytes(fixture.host);

    expect(
      await fixture.ledger.dispose(disposal(token, 1, 'accept-staged', OP[0])),
    ).toEqual({ outcome: 'rejected', reason: 'backlog-entry-missing' });
    expect(committedBytes(fixture.host)).toBe(before);
  });

  it('refuses a disposition that would overflow the history, evicting nothing', async () => {
    const fixture = ledgerFixture();
    const history = Array.from(
      { length: SUPERSEDED_REVISION_CAPACITY },
      (_, index) => rev(`old-${index}`),
    );
    const token = await review(fixture, [1], { history });
    const before = committedBytes(fixture.host);

    for (const kind of ['accept-staged', 'retain-published'] as const) {
      expect(
        await fixture.ledger.dispose(disposal(token, 1, kind, OP[0])),
      ).toEqual({ outcome: 'rejected', reason: 'revision-history-capacity' });
    }
    expect(committedBytes(fixture.host)).toBe(before);
  });
});
