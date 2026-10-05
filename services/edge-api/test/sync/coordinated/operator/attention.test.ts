/**
 * The level-triggered attention line (PR-E2; OD-1, OD-8), over the real
 * orchestration, store and sequencer - in process and through both Durable
 * Object clients. Only the transport, the limiter double and the clock are
 * synthetic.
 *
 * A held or durably blocked season, and a review backlog at 48 or 60 of its
 * 60 slots, raise one bounded line on **every** scheduled tick while the
 * condition lasts - not only on the tick that caused it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LogEvent } from '../../../../src/logging/logger';
import {
  BACKLOG_CAPACITY,
  type DurableBlockReason,
  type LedgerSnapshot,
  type SeasonOperatorAction,
} from '../../../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { observeCoordinatedSeason } from '../../../../src/sync/coordinated/observation';
import { seasonAttention } from '../../../../src/sync/coordinated/operator';
import { sequencerTransports } from '../../../publication/sequenced/support';
import {
  OTHER_SEASON,
  commitRequest,
  rev,
  seasonRecord,
  stagedClassification,
  write,
} from '../ledger/support';
import {
  HOUR,
  ObservationHarness,
  PRE_SEASON,
  SEASON,
} from '../observation/support';

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

const MINUTE = 60 * 1000;
const later = (at: string, millis: number) =>
  new Date(Date.parse(at) + millis).toISOString();
const FIRST_PUBLICATION = later(PRE_SEASON, HOUR);
const OPERATION = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function snapshotWith(
  overrides: {
    hold?: boolean;
    block?: DurableBlockReason;
    backlog?: number;
  } = {},
): LedgerSnapshot {
  return {
    season: SEASON,
    seasonRecord: {
      version: 1,
      record: seasonRecord({
        operatorHold: overrides.hold
          ? { since: PRE_SEASON, operationId: OPERATION }
          : null,
        durableBlock:
          overrides.block === undefined
            ? null
            : { since: PRE_SEASON, reason: overrides.block },
      }),
    },
    classifications: [],
    published: null,
    lease: null,
    backlog: {
      count: overrides.backlog ?? 0,
      capacity: BACKLOG_CAPACITY,
      entries: [],
    },
  };
}

describe('the attention conditions', () => {
  it('are nothing for a clean season or a missing season record', () => {
    expect(seasonAttention(snapshotWith())).toBeNull();
    expect(
      seasonAttention({ ...snapshotWith(), seasonRecord: null }),
    ).toBeNull();
  });

  it('warn at 48 of the 60 backlog slots, and are an error at capacity', () => {
    expect(
      [0, 47, 48, 59, 60].map((backlog) => {
        const attention = seasonAttention(snapshotWith({ backlog }));
        return [backlog, attention?.conditions ?? [], attention?.level ?? null];
      }),
    ).toEqual([
      [0, [], null],
      [47, [], null],
      [48, ['backlog-warning'], 'warn'],
      [59, ['backlog-warning'], 'warn'],
      [60, ['backlog-full'], 'error'],
    ]);
  });

  it('name a hold and a durable block independently, in a fixed order', () => {
    expect(seasonAttention(snapshotWith({ hold: true }))).toEqual({
      season: SEASON,
      conditions: ['operator-hold'],
      durableBlockReason: null,
      backlogCount: 0,
      backlogCapacity: 60,
      level: 'warn',
    });
    expect(
      seasonAttention(
        snapshotWith({
          hold: true,
          block: 'backlog-capacity-exceeded',
          backlog: 60,
        }),
      ),
    ).toEqual({
      season: SEASON,
      conditions: ['operator-hold', 'durable-block', 'backlog-full'],
      durableBlockReason: 'backlog-capacity-exceeded',
      backlogCount: 60,
      backlogCapacity: 60,
      level: 'error',
    });
  });
});

describe.each(sequencerTransports)(
  'the attention line over the %s transport',
  (transport) => {
    async function published(): Promise<ObservationHarness> {
      const harness = await ObservationHarness.create({
        transport,
        seed: 'unclassified',
      });
      await harness.run(PRE_SEASON);
      await harness.run(FIRST_PUBLICATION);
      expect(harness.releases()).toHaveLength(1);
      return harness;
    }

    /** Runs `use` under a fresh lease on the harness ledger. */
    async function underLease(
      harness: ObservationHarness,
      at: string,
      season: number,
      use: (
        ledger: ReconciliationLedgerPort,
        lease: { season: number; fence: number },
        snapshot: LedgerSnapshot,
      ) => Promise<unknown>,
    ): Promise<void> {
      harness.clock.set(at);
      const ledger = harness.freshLedger();
      const acquired = await ledger.acquireLease(season);
      if (acquired.outcome !== 'acquired') throw new Error('lease refused');
      const lease = { season, fence: acquired.lease.fence };
      try {
        await use(ledger, lease, acquired.snapshot);
      } finally {
        await ledger.releaseLease(lease);
      }
    }

    function operate(
      harness: ObservationHarness,
      at: string,
      action: SeasonOperatorAction,
    ) {
      return underLease(harness, at, SEASON, async (ledger, lease, snap) => {
        const outcome = await ledger.operate({
          lease,
          action,
          operationId: OPERATION.replace('0a', action === 'hold' ? '0a' : '9a'),
          authMethod: 'shared-admin-token',
          expectedVersion: snap.seasonRecord?.version ?? 0,
        });
        expect(outcome.outcome).toBe('applied');
      });
    }

    /** A run records a durable block, as an outcome commit would. */
    function block(harness: ObservationHarness, at: string) {
      return underLease(harness, at, SEASON, async (ledger, lease, snap) => {
        const stored = snap.seasonRecord!;
        const outcome = await ledger.commit(
          commitRequest(lease, {
            seasonRecord: write(
              {
                ...stored.record,
                durableBlock: {
                  since: at,
                  reason: 'classification-superseded',
                },
              },
              stored.version,
            ),
          }),
        );
        expect(outcome.outcome).toBe('committed');
      });
    }

    /** Another season fills `count` backlog slots. */
    function fillBacklog(
      harness: ObservationHarness,
      at: string,
      count: number,
    ) {
      return underLease(harness, at, OTHER_SEASON, async (ledger, lease) => {
        const rounds = Array.from({ length: count }, (_, index) => index + 1);
        const outcome = await ledger.commit(
          commitRequest(lease, {
            classifications: rounds.map((round) =>
              write(
                stagedClassification(
                  round,
                  rev(`other-${round}`),
                  OTHER_SEASON,
                ),
              ),
            ),
            backlogInsertions: rounds.map((round) => ({
              round,
              revision: rev(`other-${round}`),
            })),
          }),
        );
        expect(outcome.outcome).toBe('committed');
      });
    }

    function attentionLines(harness: ObservationHarness): LogEvent[] {
      return harness.logger.events.filter(
        (event) => event.operation === 'reconciliation.attention',
      );
    }

    /** The attention lines one scheduled tick at `at` wrote. */
    async function tick(
      harness: ObservationHarness,
      at: string,
      options: Parameters<ObservationHarness['run']>[1] = {},
    ) {
      const before = attentionLines(harness).length;
      const run = await harness.run(at, options);
      return { run, lines: attentionLines(harness).slice(before) };
    }

    it('writes nothing for a clean season', async () => {
      const harness = await published();

      const { lines } = await tick(harness, later(PRE_SEASON, 2 * HOUR));

      expect(lines).toEqual([]);
    });

    it('raises a hold on every scheduled tick while it lasts, and never on a manual run', async () => {
      const harness = await published();
      await operate(harness, later(FIRST_PUBLICATION, MINUTE), 'hold');

      for (const hours of [2, 3, 4]) {
        const { run, lines } = await tick(
          harness,
          later(PRE_SEASON, hours * HOUR),
        );
        expect(run.outcome).toMatchObject({ status: 'nothing-due' });
        // Exactly the closed, bounded fields: no revision, round or instant.
        expect(lines).toEqual([
          {
            level: 'warn',
            operation: 'reconciliation.attention',
            season: SEASON,
            syncTrigger: 'scheduled',
            reconciliationAttention: ['operator-hold'],
            backlogCount: 0,
            backlogCapacity: 60,
          },
        ]);
      }
      const manual = await tick(harness, later(PRE_SEASON, 5 * HOUR), {
        trigger: 'manual',
      });
      expect(manual.run.outcome).toMatchObject({
        reason: 'publication-stopped',
      });
      expect(manual.lines).toEqual([]);

      // Released: the next ticks are quiet again.
      await operate(harness, later(PRE_SEASON, 6 * HOUR), 'release-hold');
      await harness.run(later(PRE_SEASON, 7 * HOUR));
      const quiet = await tick(harness, later(PRE_SEASON, 8 * HOUR));
      expect(quiet.lines).toEqual([]);
      expect(harness.logger.serialized()).not.toMatch(
        /"reconciliationAttention"[^}]*sha256:/,
      );
    });

    it('raises a durable block with its closed reason on every tick', async () => {
      const harness = await published();
      await block(harness, later(FIRST_PUBLICATION, MINUTE));

      for (const hours of [2, 3]) {
        const { lines } = await tick(harness, later(PRE_SEASON, hours * HOUR));
        expect(lines).toEqual([
          expect.objectContaining({
            level: 'warn',
            reconciliationAttention: ['durable-block'],
            durableBlockReason: 'classification-superseded',
          }),
        ]);
      }
    });

    it('still raises a hold when a run holds the lease', async () => {
      const harness = await published();
      await operate(harness, later(FIRST_PUBLICATION, MINUTE), 'hold');
      // Taken at the tick's own instant, so it is still valid then.
      const at = later(PRE_SEASON, 2 * HOUR);
      harness.clock.set(at);
      const running = await harness.freshLedger().acquireLease(SEASON);
      expect(running.outcome).toBe('acquired');

      const { run, lines } = await tick(harness, at);

      expect(run.outcome).toMatchObject({ status: 'run-in-progress' });
      expect(lines).toEqual([
        expect.objectContaining({ reconciliationAttention: ['operator-hold'] }),
      ]);
    });

    it('still raises a hold when another dependency is missing, but not on a manual run or without a ledger', async () => {
      const harness = await published();
      await operate(harness, later(FIRST_PUBLICATION, MINUTE), 'hold');
      harness.clock.set(later(PRE_SEASON, 2 * HOUR));
      const requests = harness.server.requests.length;
      const reservations = harness.limiter.reservations.length;
      const publishes = harness.publishGuarded.mock.calls.length;
      const degraded = (trigger: 'scheduled' | 'manual', bound = true) =>
        observeCoordinatedSeason(
          { season: SEASON, trigger },
          {
            ...harness.dependencies(bound ? {} : { ledger: null }),
            limiter: null,
          },
        );

      const scheduled = await degraded('scheduled');
      const lines = attentionLines(harness);
      const manual = await degraded('manual');
      const unbound = await degraded('scheduled', false);

      expect(scheduled).toMatchObject({
        status: 'coordinated-runtime-unavailable',
        reasons: ['limiter-unbound'],
        providerRequests: 0,
      });
      expect(lines).toEqual([
        expect.objectContaining({
          level: 'warn',
          reconciliationAttention: ['operator-hold'],
        }),
      ]);
      expect(manual).toMatchObject({ reasons: ['limiter-unbound'] });
      expect(unbound).toMatchObject({
        reasons: ['limiter-unbound', 'ledger-unbound'],
      });
      expect(attentionLines(harness)).toEqual(lines);
      expect(harness.server.requests).toHaveLength(requests);
      expect(harness.limiter.reservations).toHaveLength(reservations);
      expect(harness.publishGuarded).toHaveBeenCalledTimes(publishes);
    });

    it.each([
      [47, null, null],
      [48, ['backlog-warning'], 'warn'],
      [59, ['backlog-warning'], 'warn'],
      [60, ['backlog-full'], 'error'],
    ] as const)(
      'with %i backlog slots taken, raises %j',
      async (count, conditions, level) => {
        const harness = await published();
        await fillBacklog(harness, later(FIRST_PUBLICATION, MINUTE), count);

        for (const hours of [2, 3]) {
          const { lines } = await tick(
            harness,
            later(PRE_SEASON, hours * HOUR),
          );
          expect(lines).toEqual(
            conditions === null
              ? []
              : [
                  expect.objectContaining({
                    level,
                    reconciliationAttention: conditions,
                    backlogCount: count,
                    backlogCapacity: 60,
                  }),
                ],
          );
        }
      },
    );

    it('writes no line, and leaves the run unchanged, when the ledger cannot be read', async () => {
      const harness = await published();
      await operate(harness, later(FIRST_PUBLICATION, MINUTE), 'hold');
      const base = harness.freshLedger();
      const unreadable = Object.assign(
        Object.create(base) as ReconciliationLedgerPort,
        { readSeason: async () => ({ outcome: 'unavailable' as const }) },
      );

      const { run, lines } = await tick(harness, later(PRE_SEASON, 2 * HOUR), {
        ledger: unreadable,
      });

      expect(run.outcome).toMatchObject({ status: 'nothing-due' });
      expect(lines).toEqual([]);
    });
  },
);
