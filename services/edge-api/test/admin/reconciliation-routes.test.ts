/**
 * The reconciliation operator routes through the real Worker entry point
 * (PR-E2), over an injected ledger reached in process and through the
 * Durable Object client.
 *
 * The only substitution is the resolver's answer (`vi.mock`); the router,
 * authentication, decoding, the operator transitions, the store and its
 * transaction are the real ones. A global `fetch` stub fails the test if any
 * provider or Cloudflare request is attempted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LEASE_TTL_MS } from '../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../src/sync/coordinated/ledger-port';
import { sequencerTransports } from '../publication/sequenced/support';
import {
  rev,
  seasonRecord,
  stagedClassification,
  write,
} from '../sync/coordinated/ledger/support';
import {
  NOW,
  OP,
  OperatorLedger,
  call,
  coordinatedEnv,
  paths,
} from './reconciliation-support';

const injected = vi.hoisted(() => ({
  ledger: null as null | (() => unknown),
}));

vi.mock('../../src/sync/coordinated/ledger-port', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../src/sync/coordinated/ledger-port')
    >();
  return {
    ...actual,
    resolveReconciliationLedger: () =>
      (injected.ledger?.() ?? null) as ReconciliationLedgerPort | null,
  };
});

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  injected.ledger = null;
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

const SEASON = 2026;
const OTHER_SEASON = 2025;
const STAGED = rev('staged-3');
const COMPETING = rev('competing-3');
const BLOCKED_SINCE = '2026-09-29T03:17:00.000Z';

/** Every key path in `value`, recursively, with array items as `[]`. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => keyPaths(item, `${prefix}[]`));
  }
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return [path, ...keyPaths(child, path)];
  });
}

const seasonKeys = [
  'season',
  'seasonRecordVersion',
  'operatorHold',
  'operatorHold.since',
  'operatorHold.operationId',
  'durableBlock',
  'durableBlock.reason',
  'durableBlock.since',
  'publicationDisposition',
  'publicationDisposition.state',
  'publicationDisposition.reason',
  'publicationDisposition.since',
  'publicationDisposition.reserved',
  'publicationDueAt',
  'lastPublication',
  'lastPublication.activeVersion',
  'lastPublication.publishedAt',
  'lastPublication.confirmedAt',
  'lastOperatorAction',
  'lastOperatorAction.operationId',
  'lastOperatorAction.action',
  'lastOperatorAction.at',
  'lastOperatorAction.authMethod',
];
const roundKeys = [
  'round',
  'recordVersion',
  'reviewState',
  'markers',
  'terminalReason',
  'contentRevision',
  'publishedRevision',
  'candidateRevision',
  'stagedCorrection',
  'stagedCorrection.revision',
  'stagedCorrection.firstSeenAt',
  'stagedCorrection.uncorroborated',
  'competingCorrection',
  'competingCorrection.revision',
  'competingCorrection.firstSeenAt',
  'competingCorrection.uncorroborated',
  'supersededCount',
  'lastDisposition',
  'lastDisposition.operationId',
  'lastDisposition.action',
  'lastDisposition.at',
  'lastDisposition.authMethod',
  'lastDisposition.stagedRevision',
  'verificationCount',
  'lastVerification',
  'lastVerification.operationId',
  'lastVerification.at',
  'lastVerification.authMethod',
  'lastVerification.stagedRevision',
  'lastVerification.transition',
];
const inspectionKeys = new Set([
  'status',
  ...seasonKeys,
  'lease',
  'lease.state',
  'lease.expiresAt',
  'publishedReconciliation',
  'publishedReconciliation.activeVersion',
  'publishedReconciliation.reconciledAt',
  'backlog',
  'backlog.count',
  'backlog.capacity',
  'backlog.level',
  'backlog.entries',
  'backlog.entries[].round',
  'backlog.entries[].revision',
  'backlog.entries[].enteredAt',
  'rounds',
  ...roundKeys.map((key) => `rounds[].${key}`),
]);

describe.each(sequencerTransports)(
  'the reconciliation routes over the %s ledger transport',
  (transport) => {
    function setup(overrides: Parameters<typeof coordinatedEnv>[1] = {}) {
      const ledger = new OperatorLedger(transport);
      injected.ledger = () => ledger.client();
      const { env, logger } = coordinatedEnv(ledger.clock, overrides);
      return { ledger, env, logger };
    }

    /** A season with round 3 staged and in the backlog, blocked for it. */
    async function staged(
      ledger: OperatorLedger,
      competing: string | null = null,
    ) {
      await ledger.seed(
        {
          seasonRecord: write(
            seasonRecord({
              publicationDisposition: {
                state: 'blocked',
                since: BLOCKED_SINCE,
                reason: competing
                  ? 'classification-review-locked'
                  : 'classification-staged',
              },
            }),
          ),
          classifications: [write(stagedClassification(3, STAGED, SEASON))],
          backlogInsertions: [{ round: 3, revision: STAGED }],
        },
        SEASON,
      );
      if (competing === null) return;
      // Only `verify` can create a competing correction (PR-E3); planted,
      // so these tests exercise the operator routes alone.
      ledger.plant(
        stagedClassification(3, STAGED, SEASON, {
          markers: ['review_locked', 'staged'],
          competingCorrection: {
            revision: competing,
            firstSeenAt: '2026-04-02T04:00:00.000Z',
            uncorroborated: false,
          },
        }),
      );
    }

    function holdBody(expected: number, operationId: string = OP[0]) {
      return {
        season: SEASON,
        expectedSeasonRecordVersion: expected,
        operationId,
      };
    }

    function disposition(
      action: string,
      expected: Partial<Record<string, unknown>> = {},
      operationId: string = OP[1],
    ) {
      return {
        season: SEASON,
        round: 3,
        action,
        operationId,
        expected: {
          recordVersion: 1,
          contentRevision: rev('content-3'),
          stagedRevision: STAGED,
          competingRevision: null,
          ...expected,
        },
      };
    }

    const everyRoute = (): readonly [string, string, unknown?][] => [
      ['GET', paths.inspect(SEASON)],
      ['POST', paths.hold, holdBody(0)],
      ['POST', paths.releaseHold, holdBody(0)],
      ['POST', paths.clearBlock, holdBody(0)],
      ['POST', paths.disposition, disposition('accept-staged')],
      ['POST', paths.rollback(SEASON), {}],
    ];

    describe('authentication', () => {
      it('refuses a missing or wrong token on every route before the ledger is reached', async () => {
        const { ledger, env } = setup();
        await staged(ledger);
        const before = ledger.bytes();

        for (const token of [null, 'wrong-token', '']) {
          for (const [method, path, body] of everyRoute()) {
            const answer = await call(env, method, path, body, token);
            expect(answer.status, `${method} ${path}`).toBe(401);
            expect(answer.body.error?.code).toBe('UNAUTHORIZED');
            expect(answer.cacheControl).toBe('no-store');
          }
        }

        // Not one ledger operation, read or write.
        expect(ledger.calls).toEqual([]);
        expect(ledger.bytes()).toBe(before);
      });
    });

    describe('methods and malformed input', () => {
      it('refuses the wrong method before reading anything', async () => {
        const { ledger, env } = setup();

        const inspect = await call(env, 'POST', paths.inspect(SEASON), {});
        expect(inspect).toMatchObject({ status: 405, allow: 'GET' });
        for (const path of [
          paths.hold,
          paths.releaseHold,
          paths.clearBlock,
          paths.disposition,
        ]) {
          const answer = await call(env, 'GET', path);
          expect(answer, path).toMatchObject({
            status: 405,
            allow: 'POST',
            cacheControl: 'no-store',
          });
        }
        expect(ledger.calls).toEqual([]);
      });

      it.each([
        ['no season', '/internal/admin/reconciliation'],
        ['a word', paths.inspect('abcd')],
        ['two digits', paths.inspect('26')],
        ['five digits', paths.inspect('20261')],
        ['a season out of range', paths.inspect('1899')],
        ['an extra parameter', `${paths.inspect(SEASON)}&round=3`],
        ['a repeated season', `${paths.inspect(SEASON)}&season=2025`],
      ])('refuses an inspection with %s', async (_, path) => {
        const { ledger, env } = setup();
        const answer = await call(env, 'GET', path);
        expect(answer.status).toBe(400);
        expect(answer.body.error).toMatchObject({
          code: 'INVALID_PARAMETER',
          message: 'invalid-season',
        });
        expect(ledger.calls).toEqual([]);
      });

      const valid = holdBody(0);
      it.each([
        ['text that is not JSON', 'hold please', 'invalid-body'],
        ['an array', [valid], 'invalid-body'],
        ['null', null, 'invalid-body'],
        [
          'a missing key',
          { season: SEASON, operationId: OP[0] },
          'invalid-body',
        ],
        ['an extra key', { ...valid, force: true }, 'invalid-body'],
        ['a season string', { ...valid, season: '2026' }, 'invalid-body'],
        ['a season out of range', { ...valid, season: 1899 }, 'invalid-body'],
        [
          'a negative version',
          { ...valid, expectedSeasonRecordVersion: -1 },
          'invalid-body',
        ],
        [
          'a fractional version',
          { ...valid, expectedSeasonRecordVersion: 1.5 },
          'invalid-body',
        ],
        [
          'an uppercase operation ID',
          { ...valid, operationId: OP[0].toUpperCase() },
          'invalid-body',
        ],
        [
          'a UUID v1 operation ID',
          { ...valid, operationId: 'c232ab00-9414-11ec-b3c8-9e6bdeced846' },
          'invalid-body',
        ],
        [
          'an oversized body',
          `${JSON.stringify(valid)}${' '.repeat(3000)}`,
          'body-too-large',
        ],
      ])('refuses a season action with %s', async (_, body, problem) => {
        const { ledger, env } = setup();
        for (const path of [paths.hold, paths.releaseHold, paths.clearBlock]) {
          const answer = await call(env, 'POST', path, body);
          expect(answer.status, path).toBe(400);
          expect(answer.body.error).toMatchObject({
            code: 'INVALID_PARAMETER',
            message: problem,
          });
        }
        expect(ledger.calls).toEqual([]);
      });

      it.each([
        ['round 0', { ...disposition('accept-staged'), round: 0 }],
        ['round 101', { ...disposition('accept-staged'), round: 101 }],
        ['an unknown action', disposition('publish')],
        [
          'no competing key',
          {
            ...disposition('accept-staged'),
            expected: {
              recordVersion: 1,
              contentRevision: rev('content-3'),
              stagedRevision: STAGED,
            },
          },
        ],
        [
          'record version 0',
          disposition('accept-staged', { recordVersion: 0 }),
        ],
        [
          'a revision that is not a hash',
          disposition('accept-staged', { contentRevision: 'v1' }),
        ],
        [
          'an uppercase hash',
          disposition('accept-staged', {
            stagedRevision: STAGED.toUpperCase(),
          }),
        ],
        [
          'an extra expected key',
          disposition('accept-staged', { payload: { rows: [] } }),
        ],
      ])('refuses a disposition with %s', async (_, body) => {
        const { ledger, env } = setup();
        const answer = await call(env, 'POST', paths.disposition, body);
        expect(answer.status).toBe(400);
        expect(answer.body.error).toMatchObject({
          code: 'INVALID_PARAMETER',
          message: 'invalid-body',
        });
        expect(ledger.calls).toEqual([]);
      });
    });

    describe('availability', () => {
      it.each(['mock', 'none'])(
        'refuses every operator route under %s, with a ledger injected, before reaching it',
        async (providerMode) => {
          const { ledger, env } = setup({ PROVIDER_MODE: providerMode });

          for (const [method, path, body] of everyRoute().slice(0, 5)) {
            const answer = await call(env, method, path, body);
            expect(answer.status, path).toBe(503);
            expect(answer.body.data).toEqual({
              status: 'reconciliation-unavailable',
              reasons: ['provider-mode-not-coordinated'],
            });
          }
          expect(ledger.calls).toEqual([]);
        },
      );
    });

    describe('inspection (read-only)', () => {
      it('reads an empty season with every field present and bounded', async () => {
        const { ledger, env } = setup();

        const answer = await call(env, 'GET', paths.inspect(SEASON));

        expect(answer.status).toBe(200);
        expect(answer.cacheControl).toBe('no-store');
        expect(answer.body.data).toEqual({
          status: 'read',
          season: SEASON,
          seasonRecordVersion: 0,
          operatorHold: null,
          durableBlock: null,
          publicationDisposition: null,
          publicationDueAt: null,
          lastPublication: null,
          lastOperatorAction: null,
          lease: null,
          publishedReconciliation: null,
          backlog: { count: 0, capacity: 60, level: 'normal', entries: [] },
          rounds: [],
        });
        expect(ledger.calls).toEqual(['readSeason']);
      });

      it('writes nothing, takes no lease, and answers while a run holds the lease', async () => {
        const { ledger, env, logger } = setup();
        await staged(ledger, COMPETING);
        const running = ledger.bare();
        const acquired = await running.acquireLease(SEASON);
        expect(acquired.outcome).toBe('acquired');
        const before = ledger.bytes();

        const answer = await call(env, 'GET', paths.inspect(SEASON));

        expect(answer.status).toBe(200);
        expect(ledger.calls).toEqual(['readSeason']);
        // Byte for byte: the lease record, its fence and every record.
        expect(ledger.bytes()).toBe(before);
        const data = answer.body.data!;
        expect(data.lease).toMatchObject({ state: 'held' });
        expect(data.publicationDisposition).toEqual({
          state: 'blocked',
          reason: 'classification-review-locked',
          since: BLOCKED_SINCE,
        });
        expect(data.backlog).toEqual({
          count: 1,
          capacity: 60,
          level: 'normal',
          entries: [{ round: 3, revision: STAGED, enteredAt: NOW }],
        });
        expect(data.rounds).toEqual([
          expect.objectContaining({
            round: 3,
            recordVersion: 1,
            markers: ['review_locked', 'staged'],
            contentRevision: rev('content-3'),
            stagedCorrection: {
              revision: STAGED,
              firstSeenAt: '2026-04-01T04:00:00.000Z',
              uncorroborated: false,
            },
            competingCorrection: expect.objectContaining({
              revision: COMPETING,
            }),
            supersededCount: 0,
          }),
        ]);
        // Closed keys, recursively: nothing beyond the reviewed view.
        for (const path of keyPaths(data)) {
          expect(inspectionKeys.has(path), path).toBe(true);
        }
        // One info line, with no revision in it.
        const lines = logger.events.filter((event) =>
          event.operation.startsWith('reconciliation.'),
        );
        expect(lines).toEqual([
          {
            level: 'info',
            operation: 'reconciliation.inspect',
            requestId: expect.any(String),
            season: SEASON,
            operatorAction: 'inspect',
            operatorOutcome: 'read',
          },
        ]);
        expect(logger.serialized()).not.toContain('sha256:');
      });
    });

    describe('hold, release and clear-block', () => {
      it('places a hold on a season no run has observed, and records the action', async () => {
        const { ledger, env, logger } = setup();

        const answer = await call(env, 'POST', paths.hold, holdBody(0));

        expect(answer.status).toBe(200);
        expect(answer.cacheControl).toBe('no-store');
        expect(answer.body.data).toEqual({
          status: 'applied',
          action: 'hold',
          operationId: OP[0],
          season: SEASON,
          state: expect.objectContaining({
            seasonRecordVersion: 1,
            operatorHold: { since: NOW, operationId: OP[0] },
            durableBlock: null,
            publicationDueAt: null,
            lastOperatorAction: {
              operationId: OP[0],
              action: 'hold',
              at: NOW,
              authMethod: 'shared-admin-token',
            },
          }),
          leaseRelease: 'released',
        });
        expect(ledger.calls).toEqual([
          'acquireLease',
          'operate',
          'releaseLease',
        ]);
        expect(
          logger.events.filter(
            (event) => event.operation === 'reconciliation.operator-action',
          ),
        ).toEqual([
          {
            level: 'warn',
            operation: 'reconciliation.operator-action',
            requestId: expect.any(String),
            season: SEASON,
            operatorAction: 'hold',
            operationId: OP[0],
            operatorAuthMethod: 'shared-admin-token',
            operatorOutcome: 'applied',
            leaseRelease: 'released',
          },
        ]);
        expect(logger.serialized()).not.toContain('local-test-token');
      });

      it('answers a resent operation ID as already-applied and writes nothing', async () => {
        const { ledger, env } = setup();
        await call(env, 'POST', paths.hold, holdBody(0));
        const held = await ledger.season(SEASON);

        const resent = await call(env, 'POST', paths.hold, holdBody(0));

        expect(resent.status).toBe(200);
        expect(resent.body.data).toMatchObject({
          status: 'already-applied',
          state: { seasonRecordVersion: 1 },
        });
        expect(await ledger.season(SEASON)).toEqual(held);
      });

      it('refuses a stale version, a reused operation ID and an action the state does not allow', async () => {
        const { ledger, env } = setup();
        await call(env, 'POST', paths.hold, holdBody(0));

        const stale = await call(env, 'POST', paths.hold, holdBody(0, OP[1]));
        const again = await call(env, 'POST', paths.hold, holdBody(1, OP[1]));
        const reused = await call(
          env,
          'POST',
          paths.releaseHold,
          holdBody(1, OP[0]),
        );
        const noBlock = await call(
          env,
          'POST',
          paths.clearBlock,
          holdBody(1, OP[2]),
        );

        for (const [answer, reason] of [
          [stale, 'version-conflict'],
          [again, 'operator-precondition-failed'],
          [reused, 'operation-id-reused'],
          [noBlock, 'operator-precondition-failed'],
        ] as const) {
          expect(answer.status, reason).toBe(409);
          expect(answer.body.data).toMatchObject({
            status: 'refused',
            reason,
            leaseRelease: 'released',
          });
        }
        const record = await ledger.season(SEASON);
        expect(record?.operatorHold).toEqual({
          since: NOW,
          operationId: OP[0],
        });
        expect(record?.lastOperatorAction?.operationId).toBe(OP[0]);
      });

      it('refuses while a run holds the lease, before any operator write', async () => {
        const { ledger, env } = setup();
        const acquired = await ledger.bare().acquireLease(SEASON);
        expect(acquired.outcome).toBe('acquired');

        const answer = await call(env, 'POST', paths.hold, holdBody(0));

        expect(answer.status).toBe(409);
        expect(answer.body.data).toEqual({
          status: 'run-in-progress',
          action: 'hold',
          operationId: OP[0],
          season: SEASON,
        });
        expect(ledger.calls).toEqual(['acquireLease']);
        expect(await ledger.season(SEASON)).toBeNull();
      });

      it('refuses under a lease that expired before the action committed', async () => {
        const { ledger, env } = setup();
        ledger.overrides.set('operate', (base, request) => {
          ledger.clock.advance(LEASE_TTL_MS);
          return base.operate(request);
        });

        const answer = await call(env, 'POST', paths.hold, holdBody(0));

        expect(answer.status).toBe(409);
        expect(answer.body.data).toMatchObject({
          status: 'refused',
          reason: 'lease-expired',
          leaseRelease: 'refused',
        });
        expect(await ledger.season(SEASON)).toBeNull();
      });

      it('reports a lost answer as outcome-unknown, and a resend settles it without a second write', async () => {
        const { ledger, env } = setup();
        ledger.overrides.set('operate', async (base, request) => {
          await base.operate(request);
          return { outcome: 'uncertain' };
        });

        const lost = await call(env, 'POST', paths.hold, holdBody(0));
        ledger.overrides.clear();
        const resent = await call(env, 'POST', paths.hold, holdBody(0));

        expect(lost.status).toBe(503);
        expect(lost.body.data).toMatchObject({ status: 'outcome-unknown' });
        expect(resent.status).toBe(200);
        expect(resent.body.data).toMatchObject({
          status: 'already-applied',
          state: { seasonRecordVersion: 1 },
        });
      });

      it('keeps a hold and a durable block independent: each clears only itself', async () => {
        const { ledger, env } = setup();
        const block = {
          since: BLOCKED_SINCE,
          reason: 'classification-superseded',
        } as const;
        await ledger.seed(
          { seasonRecord: write(seasonRecord({ durableBlock: block })) },
          SEASON,
        );

        const hold = await call(env, 'POST', paths.hold, holdBody(1));
        expect(hold.body.data).toMatchObject({
          status: 'applied',
          state: { operatorHold: { operationId: OP[0] }, durableBlock: block },
        });

        const release = await call(
          env,
          'POST',
          paths.releaseHold,
          holdBody(2, OP[1]),
        );
        expect(release.body.data).toMatchObject({
          status: 'applied',
          state: {
            operatorHold: null,
            durableBlock: block,
            publicationDueAt: NOW,
          },
        });

        const rehold = await call(env, 'POST', paths.hold, holdBody(3, OP[2]));
        expect(rehold.status).toBe(200);
        const clear = await call(
          env,
          'POST',
          paths.clearBlock,
          holdBody(4, OP[3]),
        );
        expect(clear.body.data).toMatchObject({
          status: 'applied',
          state: {
            operatorHold: { operationId: OP[2] },
            durableBlock: null,
            seasonRecordVersion: 5,
          },
        });
      });

      it('acts on the season named in the body, never another', async () => {
        const { ledger, env } = setup();

        await call(env, 'POST', paths.hold, {
          ...holdBody(0),
          season: OTHER_SEASON,
        });

        expect(await ledger.season(SEASON)).toBeNull();
        expect((await ledger.season(OTHER_SEASON))?.operatorHold).toEqual({
          since: NOW,
          operationId: OP[0],
        });
      });
    });

    describe('disposition (T12)', () => {
      it('accepts the staged revision, releases its backlog entry and lifts the review block', async () => {
        const { ledger, env, logger } = setup();
        await staged(ledger);

        const answer = await call(
          env,
          'POST',
          paths.disposition,
          disposition('accept-staged'),
        );

        expect(answer.status).toBe(200);
        expect(answer.body.data).toMatchObject({
          status: 'applied',
          action: 'accept-staged',
          operationId: OP[1],
          season: SEASON,
          round: 3,
          state: {
            publicationDisposition: null,
            publicationDueAt: NOW,
            round: {
              round: 3,
              recordVersion: 2,
              contentRevision: STAGED,
              stagedCorrection: null,
              competingCorrection: null,
              markers: [],
              supersededCount: 1,
              lastDisposition: {
                operationId: OP[1],
                action: 'accept-staged',
                at: NOW,
                authMethod: 'shared-admin-token',
                stagedRevision: STAGED,
              },
            },
            backlog: { count: 0, level: 'normal', entries: [] },
          },
          leaseRelease: 'released',
        });
        expect(ledger.calls).toEqual([
          'acquireLease',
          'dispose',
          'releaseLease',
        ]);
        const line = logger.events.find(
          (event) => event.operation === 'reconciliation.operator-action',
        );
        expect(line).toMatchObject({
          level: 'warn',
          season: SEASON,
          round: 3,
          operatorAction: 'accept-staged',
          operationId: OP[1],
          operatorOutcome: 'applied',
        });
        expect(logger.serialized()).not.toContain('sha256:');
      });

      it('retains the published revision and rejects the exact staged one permanently (OD-4)', async () => {
        const { ledger, env } = setup();
        await staged(ledger);

        const answer = await call(
          env,
          'POST',
          paths.disposition,
          disposition('retain-published'),
        );

        expect(answer.status).toBe(200);
        const record = await ledger.round(SEASON, 3);
        expect(record?.contentRevision).toBe(rev('content-3'));
        expect(record?.supersededRevisions).toEqual([STAGED]);
        expect(record?.stagedCorrection).toBeNull();
      });

      it('accepts a competing revision only when one is recorded', async () => {
        const { ledger, env } = setup();
        await staged(ledger, COMPETING);

        const wrong = await call(
          env,
          'POST',
          paths.disposition,
          disposition('accept-competing'),
        );
        const right = await call(
          env,
          'POST',
          paths.disposition,
          disposition('accept-competing', { competingRevision: COMPETING }),
        );

        expect(wrong.status).toBe(409);
        expect(wrong.body.data).toMatchObject({
          reason: 'operator-precondition-failed',
        });
        expect(right.status).toBe(200);
        expect((await ledger.round(SEASON, 3))?.contentRevision).toBe(
          COMPETING,
        );
      });

      it('refuses a stale version or revision, and a resend is already-applied', async () => {
        const { ledger, env } = setup();
        await staged(ledger);
        const before = ledger.bytes();

        const staleVersion = await call(
          env,
          'POST',
          paths.disposition,
          disposition('accept-staged', { recordVersion: 2 }),
        );
        const staleStaged = await call(
          env,
          'POST',
          paths.disposition,
          disposition('accept-staged', { stagedRevision: rev('other') }),
        );
        expect(staleVersion.body.data).toMatchObject({
          status: 'refused',
          reason: 'version-conflict',
        });
        expect(staleStaged.body.data).toMatchObject({
          status: 'refused',
          reason: 'operator-precondition-failed',
        });
        // Only the lease records moved.
        const leaseFree = (bytes: string) =>
          (JSON.parse(bytes) as [string, unknown][]).filter(
            ([key]) => !key.startsWith('lease:'),
          );
        expect(leaseFree(ledger.bytes())).toEqual(leaseFree(before));

        const applied = await call(
          env,
          'POST',
          paths.disposition,
          disposition('accept-staged'),
        );
        const resent = await call(
          env,
          'POST',
          paths.disposition,
          disposition('accept-staged'),
        );
        const reused = await call(
          env,
          'POST',
          paths.disposition,
          disposition('retain-published', { recordVersion: 2 }),
        );
        expect(applied.body.data).toMatchObject({ status: 'applied' });
        expect(resent.body.data).toMatchObject({ status: 'already-applied' });
        expect(reused.body.data).toMatchObject({
          status: 'refused',
          reason: 'operation-id-reused',
        });
      });

      it('disposes under a hold and leaves the hold in force', async () => {
        const { ledger, env } = setup();
        await staged(ledger);
        const hold = await call(env, 'POST', paths.hold, holdBody(1));
        expect(hold.status).toBe(200);

        const answer = await call(
          env,
          'POST',
          paths.disposition,
          disposition('accept-staged'),
        );

        expect(answer.body.data).toMatchObject({
          status: 'applied',
          state: {
            operatorHold: { operationId: OP[0] },
            publicationDisposition: null,
          },
        });
      });

      it('refuses while a run holds the lease', async () => {
        const { ledger, env } = setup();
        await staged(ledger);
        await ledger.bare().acquireLease(SEASON);

        const answer = await call(
          env,
          'POST',
          paths.disposition,
          disposition('accept-staged'),
        );

        expect(answer.status).toBe(409);
        expect(answer.body.data).toMatchObject({ status: 'run-in-progress' });
        expect(
          (await ledger.round(SEASON, 3))?.stagedCorrection,
        ).not.toBeNull();
      });
    });
  },
);
