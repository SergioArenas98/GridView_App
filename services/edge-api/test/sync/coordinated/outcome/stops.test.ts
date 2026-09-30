/**
 * Operator holds and durable blocks end to end (PR-E1; OD-3, OD-5), over the
 * real policy, store, composition, bridge, guarded sequenced publication and
 * sequencer - in process and through both Durable Object clients. Only the
 * transport, the limiter double and the clock are synthetic.
 *
 * Every path that could publish - a cadence check, the weekly refresh, a due
 * publication, drift, a manual run and recovery - is driven into a stopped
 * season, and none of them publishes or erases the stop. The hold-gated
 * rollback (OD-3) runs the real rollback through the D14/D15 guard.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LEASE_TTL_MS,
  type LeaseToken,
  type OperatorTransitionOutcome,
  type SeasonOperatorAction,
} from '../../../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { rollbackUnderHold } from '../../../../src/sync/coordinated/operator';
import { sequencerTransports } from '../../../publication/sequenced/support';
import {
  OTHER_SEASON,
  commitRequest,
  rev,
  stagedClassification,
  write,
} from '../ledger/support';
import {
  HOUR,
  ObservationHarness,
  PRE_SEASON,
  SEASON,
  paths,
  seasonPaths,
  tickAfter,
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
const OP = [
  '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  '1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e',
  '2c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5e6f',
  '3d4e5f6a-7b8c-4d9e-bf0a-2b3c4d5e6f7a',
] as const;

/** A run that observed and stopped, with no reservation or publication. */
const stoppedRun = [
  'acquireLease',
  'reconcilePublishedRevisions',
  'commit',
  'releaseLease',
];

/** `target` with some methods replaced; the rest still reach `target`. */
function overriding<T extends object>(target: T, methods: Partial<T>): T {
  return Object.assign(Object.create(target) as T, methods);
}

/** Runs `use` under a fresh lease on the harness ledger, then releases it. */
async function underLease<T>(
  harness: ObservationHarness,
  at: string,
  use: (
    ledger: ReconciliationLedgerPort,
    token: LeaseToken,
    version: number,
  ) => Promise<T>,
  season = SEASON,
): Promise<T> {
  harness.clock.set(at);
  const ledger = harness.freshLedger();
  const acquired = await ledger.acquireLease(season);
  if (acquired.outcome !== 'acquired') {
    throw new Error(`lease refused: ${JSON.stringify(acquired)}`);
  }
  const token = { season, fence: acquired.lease.fence };
  try {
    return await use(
      ledger,
      token,
      acquired.snapshot.seasonRecord?.version ?? 0,
    );
  } finally {
    await ledger.releaseLease(token);
  }
}

/** One season-level operator action, as a later route would make it. */
function operate(
  harness: ObservationHarness,
  at: string,
  action: SeasonOperatorAction,
  operationId: string,
): Promise<OperatorTransitionOutcome> {
  return underLease(harness, at, (ledger, lease, expectedVersion) =>
    ledger.operate({
      lease,
      action,
      operationId,
      authMethod: 'shared-admin-token',
      expectedVersion,
    }),
  );
}

/** A publication made due at `at` by an ordinary commit, as a change would. */
function makeDue(harness: ObservationHarness, at: string): Promise<unknown> {
  return underLease(harness, at, async (ledger, lease, version) => {
    const read = await ledger.readSeason(SEASON);
    if (read.outcome !== 'read') throw new Error('read refused');
    const stored = read.snapshot.seasonRecord!.record;
    const outcome = await ledger.commit(
      commitRequest(lease, {
        seasonRecord: write({ ...stored, publicationDueAt: at }, version),
      }),
    );
    if (outcome.outcome !== 'committed') throw new Error('not committed');
  });
}

describe.each(sequencerTransports)(
  'publication stops over the %s transport',
  (transport) => {
    async function prePublished(): Promise<{
      harness: ObservationHarness;
      release: string;
    }> {
      const harness = await ObservationHarness.create({
        transport,
        seed: 'unclassified',
      });
      await harness.run(PRE_SEASON);
      await harness.run(FIRST_PUBLICATION);
      const [release] = harness.releases();
      if (release === undefined) throw new Error('nothing was published');
      return { harness, release };
    }

    async function held(at: string) {
      const setup = await prePublished();
      const outcome = await operate(setup.harness, at, 'hold', OP[0]);
      expect(outcome.outcome).toBe('applied');
      return setup;
    }

    describe('an operator hold', () => {
      it('lets a cadence check observe, and publishes nothing', async () => {
        const { harness } = await held(later(FIRST_PUBLICATION, MINUTE));
        const before = await harness.season();
        harness.server.results.set(1, 'A');

        const run = await harness.run(tickAfter(1, 5));

        expect(run.outcome).toMatchObject({
          status: 'observed',
          plan: 'publication',
          providerRequests: 7,
          events: { 'classification.first-write': 1 },
          publication: {
            outcome: 'withheld',
            cause: 'operator-hold',
            publishCalls: 0,
            next: 'stopped',
          },
        });
        expect(run.requests).toEqual([...seasonPaths, paths.results(1)]);
        expect(run.publishCalls).toBe(0);
        // No reservation, and no publishing mark to leave behind.
        expect(run.ledgerCalls).toEqual(stoppedRun);
        const after = await harness.season();
        expect(after.operatorHold).toEqual(before.operatorHold);
        expect(after.lastOrderingInput).toBe(before.lastOrderingInput);
        expect(after.publicationDisposition).toBeNull();
        expect((await harness.record(1))?.contentRevision).toMatch(/^sha256:/);
        expect(harness.logger.events.at(-1)).toMatchObject({
          level: 'warn',
          publicationOutcome: 'withheld',
          publicationNextDue: 'stopped',
          publicationReason: 'operator-hold',
        });
        expect(harness.releases()).toHaveLength(1);
      });

      it('lets the weekly refresh observe, and publishes nothing', async () => {
        const { harness } = await held(later(FIRST_PUBLICATION, MINUTE));
        const weekly = (await harness.season()).refresh.circuits.nextDueAt!;

        const run = await harness.run(weekly);

        expect(run.outcome).toMatchObject({
          plan: 'publication',
          publication: { cause: 'operator-hold', next: 'stopped' },
        });
        expect(run.requests).toEqual(seasonPaths);
        expect(run.publishCalls).toBe(0);
        expect(harness.releases()).toHaveLength(1);
      });

      it('refuses a manual run before any provider request', async () => {
        const { harness } = await held(later(FIRST_PUBLICATION, MINUTE));

        const run = await harness.run(later(FIRST_PUBLICATION, HOUR), {
          trigger: 'manual',
        });

        expect(run.outcome).toMatchObject({
          status: 'nothing-due',
          reason: 'publication-stopped',
          providerRequests: 0,
        });
        expect(run.requests).toEqual([]);
        expect(run.reservations).toBe(0);
        expect(run.publishCalls).toBe(0);
        expect(harness.logger.events.at(-1)).toMatchObject({
          level: 'warn',
          coordinationOutcome: 'publication-stopped',
        });
      });

      it('resumes at its release: the next tick publishes through every guard', async () => {
        const { harness } = await held(later(FIRST_PUBLICATION, MINUTE));
        harness.server.results.set(1, 'A');
        await harness.run(tickAfter(1, 5));
        expect(harness.releases()).toHaveLength(1);

        const released = await operate(
          harness,
          tickAfter(1, 6),
          'release-hold',
          OP[1],
        );
        expect(released.outcome).toBe('applied');

        const run = await harness.run(tickAfter(1, 7));
        expect(run.outcome).toMatchObject({
          plan: 'publication',
          publication: { outcome: 'published', publishCalls: 1 },
        });
        expect(harness.releases()).toHaveLength(2);
        expect((await harness.season()).operatorHold).toBeNull();
      });

      it('survives a crash mid-run and a restart, and the next run still publishes nothing', async () => {
        const { harness } = await held(later(FIRST_PUBLICATION, MINUTE));
        const hold = (await harness.season()).operatorHold;
        const publishCalls = harness.publishGuarded.mock.calls.length;
        harness.server.results.set(1, 'A');
        const base = harness.freshLedger();
        const crashing = harness.recorded(
          overriding(base, {
            commit: async (request) => {
              await base.commit(request);
              throw new Error('isolate evicted');
            },
            releaseLease: async () => {
              throw new Error('isolate evicted');
            },
          }),
        );

        await expect(
          harness.run(tickAfter(1, 5), { ledger: crashing }),
        ).rejects.toThrow('isolate evicted');
        expect(harness.publishGuarded.mock.calls.length).toBe(publishCalls);
        expect(await harness.season()).toMatchObject({
          operatorHold: hold,
          publicationDisposition: null,
        });

        // The crashed lease lapses; a fresh ledger client resumes.
        const resumed = await harness.run(later(tickAfter(1, 5), LEASE_TTL_MS));
        expect(resumed.outcome).toMatchObject({ status: 'nothing-due' });
        const cadence = await harness.run(tickAfter(1, 9));
        expect(cadence.outcome).toMatchObject({
          publication: { cause: 'operator-hold' },
        });
        expect(harness.publishGuarded.mock.calls.length).toBe(publishCalls);
        expect((await harness.season()).operatorHold).toEqual(hold);
      });

      it('lets recovery record a publication a crash left unfinished, and publishes nothing more', async () => {
        const { harness } = await prePublished();
        harness.server.results.set(1, 'A');
        // The run publishes, then crashes before its outcome commit.
        const base = harness.freshLedger();
        let commits = 0;
        const crashing = harness.recorded(
          overriding(base, {
            commit: async (request) => {
              commits += 1;
              if (commits === 3) throw new Error('isolate evicted');
              return base.commit(request);
            },
            releaseLease: async () => {
              throw new Error('isolate evicted');
            },
          }),
        );
        await expect(
          harness.run(tickAfter(1, 5), { ledger: crashing }),
        ).rejects.toThrow('isolate evicted');
        const published = harness.releases().at(-1)!;
        expect(harness.releases()).toHaveLength(2);
        expect((await harness.season()).publicationDisposition).toMatchObject({
          state: 'publishing',
        });

        // An operator holds the season as soon as the lease lapses.
        const resumeAt = later(tickAfter(1, 5), LEASE_TTL_MS);
        expect((await operate(harness, resumeAt, 'hold', OP[0])).outcome).toBe(
          'applied',
        );

        const run = await harness.run(later(resumeAt, MINUTE));
        expect(run.outcome).toMatchObject({ status: 'nothing-due' });
        expect(run.publishCalls).toBe(0);
        expect(await harness.season()).toMatchObject({
          operatorHold: { operationId: OP[0] },
          publicationDisposition: null,
          lastPublication: { activeVersion: published },
        });
        expect(harness.releases()).toHaveLength(2);
      });

      it('keeps an operator out while a run holds the lease', async () => {
        const { harness } = await prePublished();
        harness.server.results.set(1, 'A');
        const attempts: string[] = [];
        harness.onPublish = async () => {
          const acquired = await harness.freshLedger().acquireLease(SEASON);
          attempts.push(
            acquired.outcome === 'rejected'
              ? acquired.reason
              : acquired.outcome,
          );
        };

        const run = await harness.run(tickAfter(1, 5));

        expect(attempts).toEqual(['lease-held']);
        expect(run.outcome).toMatchObject({
          publication: { outcome: 'published' },
          leaseRelease: 'released',
        });
      });
    });

    describe('the hold-gated rollback (OD-3)', () => {
      function rollbackDependencies(harness: ObservationHarness) {
        const rollback = vi.fn((season: number, target?: string) =>
          harness.context.service.rollback(season, target),
        );
        return {
          rollback,
          dependencies: {
            ledger: harness.freshLedger(),
            clock: harness.clock,
            rollback,
          },
        };
      }

      it('refuses a season that is not held, before the rollback is reached', async () => {
        const { harness, release } = await prePublished();
        const { rollback, dependencies } = rollbackDependencies(harness);

        const outcome = await rollbackUnderHold(
          { season: SEASON },
          dependencies,
        );

        expect(outcome).toEqual({
          status: 'not-held',
          rollbackCalls: 0,
          leaseRelease: 'released',
        });
        expect(rollback).not.toHaveBeenCalled();
        expect(harness.activeVersion()).toBe(release);
      });

      it('rolls back a held season, and drift never republishes it until the release', async () => {
        const { harness, release } = await held(
          later(FIRST_PUBLICATION, MINUTE),
        );
        const { rollback, dependencies } = rollbackDependencies(harness);

        const outcome = await rollbackUnderHold(
          { season: SEASON },
          dependencies,
        );

        expect(outcome).toMatchObject({
          status: 'attempted',
          rollbackCalls: 1,
          leaseRelease: 'released',
          result: { status: 'applied' },
        });
        expect(rollback).toHaveBeenCalledTimes(1);
        const rolledBack = harness.activeVersion();
        expect(rolledBack).not.toBe(release);

        for (const hours of [2, 3, 4]) {
          const tick = await harness.run(later(PRE_SEASON, hours * HOUR));
          expect(tick.outcome).toMatchObject({ status: 'nothing-due' });
          expect(tick.requests).toEqual([]);
        }
        expect(harness.activeVersion()).toBe(rolledBack);
        expect((await harness.season()).operatorHold).not.toBeNull();

        // Releasing is consent to resume: the rolled-back content returns.
        await operate(
          harness,
          later(PRE_SEASON, 5 * HOUR),
          'release-hold',
          OP[1],
        );
        const resumed = await harness.run(later(PRE_SEASON, 6 * HOUR));
        expect(resumed.outcome).toMatchObject({
          publication: { outcome: 'published' },
        });
        expect(harness.activeVersion()).not.toBe(rolledBack);
      });

      it('still enforces D14: a rollback that drops a classified round is refused, and the hold stays', async () => {
        const { harness } = await prePublished();
        harness.server.results.set(1, 'A');
        await harness.run(tickAfter(1, 5));
        const classified = harness.activeVersion();
        expect(harness.releases()).toHaveLength(2);
        await operate(harness, tickAfter(1, 6), 'hold', OP[0]);
        const { rollback, dependencies } = rollbackDependencies(harness);

        const outcome = await rollbackUnderHold(
          { season: SEASON },
          dependencies,
        );

        expect(outcome).toMatchObject({
          status: 'attempted',
          rollbackCalls: 1,
          result: {
            status: 'rejected',
            reason: 'guard-round-coverage-regression',
          },
        });
        expect(rollback).toHaveBeenCalledTimes(1);
        expect(harness.activeVersion()).toBe(classified);
        expect((await harness.season()).operatorHold).toMatchObject({
          operationId: OP[0],
        });
      });

      it('waits for a run in progress, reaching nothing', async () => {
        const { harness } = await held(later(FIRST_PUBLICATION, MINUTE));
        const { rollback, dependencies } = rollbackDependencies(harness);
        const outcomes: unknown[] = [];
        harness.server.onRequest = async (path) => {
          if (path === paths.calendar) {
            outcomes.push(
              await rollbackUnderHold({ season: SEASON }, dependencies),
            );
          }
        };

        await harness.run(tickAfter(1, 5));

        expect(outcomes).toEqual([
          { status: 'run-in-progress', rollbackCalls: 0 },
        ]);
        expect(rollback).not.toHaveBeenCalled();
      });

      it('refuses under a lease that expired before the rollback could start', async () => {
        const { harness } = await held(later(FIRST_PUBLICATION, MINUTE));
        const { rollback, dependencies } = rollbackDependencies(harness);
        const ahead = {
          now: () =>
            new Date(
              Date.parse(later(FIRST_PUBLICATION, MINUTE)) + LEASE_TTL_MS,
            ),
        };

        const outcome = await rollbackUnderHold(
          { season: SEASON },
          { ...dependencies, clock: ahead },
        );

        expect(outcome).toMatchObject({
          status: 'lease-expired',
          rollbackCalls: 0,
        });
        expect(rollback).not.toHaveBeenCalled();
      });

      it('releases the lease even when the rollback throws', async () => {
        const { harness } = await held(later(FIRST_PUBLICATION, MINUTE));
        const { dependencies } = rollbackDependencies(harness);

        await expect(
          rollbackUnderHold(
            { season: SEASON },
            {
              ...dependencies,
              rollback: async () => {
                throw new Error('storage failed');
              },
            },
          ),
        ).rejects.toThrow('storage failed');
        expect((await harness.freshLedger().acquireLease(SEASON)).outcome).toBe(
          'acquired',
        );
      });
    });

    describe('the durable superseded block (OD-5)', () => {
      /** Round 1 settled on B, with A superseded, and A served again. */
      async function superseded() {
        const { harness } = await prePublished();
        harness.server.results.set(1, 'A');
        await harness.run(tickAfter(1, 5));
        harness.server.results.set(1, 'B');
        for (const hours of [9, 15, 24]) await harness.run(tickAfter(1, hours));
        const record = await harness.record(1);
        expect(record).toMatchObject({ reviewState: 'settled' });
        expect(record!.supersededRevisions).toHaveLength(1);
        harness.server.results.set(1, 'A');
        return harness;
      }

      it('stops the hourly loop until an operator clears it', async () => {
        const harness = await superseded();
        const due = tickAfter(1, 30);
        await makeDue(harness, due);
        const releases = harness.releases().length;

        const blocking = await harness.run(due);

        expect(blocking.outcome).toMatchObject({
          plan: 'publication',
          events: { 'classification.rejected-superseded': 1 },
          publication: {
            outcome: 'withheld',
            cause: 'classification-superseded',
            publishCalls: 0,
            next: 'durably-blocked',
          },
        });
        const season = await harness.season();
        expect(season.durableBlock).toEqual({
          since: expect.any(String),
          reason: 'classification-superseded',
        });
        expect(season.publicationDueAt).toBeNull();

        // No hourly retry: the next hours send nothing at all.
        for (const hours of [31, 32, 33, 34, 35, 36]) {
          const tick = await harness.run(tickAfter(1, hours));
          expect(tick.outcome).toMatchObject({ status: 'nothing-due' });
          expect(tick.requests).toEqual([]);
        }
        // A manual run cannot force it either.
        const manual = await harness.run(tickAfter(1, 37), {
          trigger: 'manual',
        });
        expect(manual.outcome).toMatchObject({ reason: 'publication-stopped' });
        expect(manual.requests).toEqual([]);

        // Cleared while upstream still serves it: blocked again, not looped.
        await operate(harness, tickAfter(1, 38), 'clear-block', OP[0]);
        const again = await harness.run(tickAfter(1, 39));
        expect(again.outcome).toMatchObject({
          publication: { cause: 'classification-superseded' },
        });
        expect((await harness.season()).durableBlock).not.toBeNull();

        // Upstream serves the accepted revision again: clearing resumes it.
        harness.server.results.set(1, 'B');
        await operate(harness, tickAfter(1, 40), 'clear-block', OP[1]);
        const resumed = await harness.run(tickAfter(1, 41));
        expect(resumed.outcome).toMatchObject({
          publication: { next: 'completed' },
        });
        expect(await harness.season()).toMatchObject({
          durableBlock: null,
          publicationDisposition: null,
        });
        expect(harness.releases()).toHaveLength(releases);
      });

      it('is still recorded after its outcome commit failed', async () => {
        const harness = await superseded();
        const due = tickAfter(1, 30);
        await makeDue(harness, due);
        const base = harness.freshLedger();
        let commits = 0;
        const failing = harness.recorded(
          overriding(base, {
            commit: async (request) => {
              commits += 1;
              return commits === 2
                ? { outcome: 'unavailable' }
                : base.commit(request);
            },
          }),
        );

        const failed = await harness.run(due, { ledger: failing });
        expect(failed.outcome).toMatchObject({
          status: 'failed',
          stage: 'outcome',
          publication: { cause: 'classification-superseded' },
        });
        expect((await harness.season()).durableBlock).toBeNull();

        // Recovery makes the owed publication due; that run records the block.
        const next = await harness.run(tickAfter(1, 31));
        expect(next.outcome).toMatchObject({
          publication: { next: 'durably-blocked' },
        });
        expect((await harness.season()).durableBlock).toMatchObject({
          reason: 'classification-superseded',
        });
        const quiet = await harness.run(tickAfter(1, 32));
        expect(quiet.outcome).toMatchObject({ status: 'nothing-due' });
      });
    });

    describe('the durable capacity block (OD-5)', () => {
      it('stops the hourly loop when the full backlog cannot take a correction', async () => {
        const { harness } = await prePublished();
        harness.server.results.set(1, 'A');
        for (const hours of [5, 9, 15, 24])
          await harness.run(tickAfter(1, hours));
        expect(await harness.record(1)).toMatchObject({
          reviewState: 'settled',
        });

        // Another season holds every one of the 60 backlog slots.
        await underLease(
          harness,
          tickAfter(1, 25),
          async (ledger, lease) => {
            const rounds = Array.from({ length: 60 }, (_, index) => index + 1);
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
          },
          OTHER_SEASON,
        );

        // A late correction: sighted once, then corroborated with no room.
        harness.server.results.set(1, 'C');
        await makeDue(harness, tickAfter(1, 30));
        const sighting = await harness.run(tickAfter(1, 30));
        expect(sighting.outcome).toMatchObject({
          publication: { cause: 'classification-pending', next: 'cadence' },
        });
        // The cadence floor is an hour after the paced observation, so the
        // retry falls on the second tick.
        expect((await harness.run(tickAfter(1, 31))).outcome).toMatchObject({
          status: 'nothing-due',
        });
        const full = await harness.run(tickAfter(1, 32));
        expect(full.outcome).toMatchObject({
          events: { 'classification.backlog-capacity-exceeded': 1 },
          publication: {
            cause: 'backlog-capacity-exceeded',
            next: 'durably-blocked',
          },
        });
        expect((await harness.season()).durableBlock).toMatchObject({
          reason: 'backlog-capacity-exceeded',
        });

        for (const hours of [33, 34, 35, 36, 37, 38]) {
          const tick = await harness.run(tickAfter(1, hours));
          expect(tick.outcome).toMatchObject({ status: 'nothing-due' });
          expect(tick.requests).toEqual([]);
        }

        // Room is made by disposing of another season's entry; the stop
        // stays until this season's operator clears it.
        await underLease(
          harness,
          tickAfter(1, 39),
          async (ledger, lease) => {
            const outcome = await ledger.dispose({
              lease,
              round: 1,
              action: 'retain-published',
              operationId: OP[2],
              authMethod: 'shared-admin-token',
              expected: {
                recordVersion: 1,
                contentRevision: rev('content-1'),
                stagedRevision: rev('other-1'),
                competingRevision: null,
              },
            });
            expect(outcome.outcome).toBe('applied');
          },
          OTHER_SEASON,
        );
        // Later ticks may still observe (a standings refresh), never publish.
        const stillStopped = await harness.run(tickAfter(1, 40));
        expect(stillStopped.publishCalls).toBe(0);
        expect((await harness.season()).durableBlock).toMatchObject({
          reason: 'backlog-capacity-exceeded',
        });

        await operate(harness, tickAfter(1, 41), 'clear-block', OP[3]);
        const staged = await harness.run(tickAfter(1, 42));
        expect(staged.outcome).toMatchObject({
          events: { 'classification.staged-correction': 1 },
          publication: { cause: 'classification-staged', next: 'blocked' },
        });
        expect(await harness.season()).toMatchObject({
          publicationDisposition: { reason: 'classification-staged' },
          durableBlock: null,
        });
      });
    });
  },
);
