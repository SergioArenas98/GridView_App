/**
 * The run budget (RB-1 to RB-8) through the Worker's two coordinated entry
 * points, over both sequencer and ledger transports.
 *
 * The budget's deadline is timed by `__RUN_BUDGET_TIMER`, which these tests
 * fire from the harness clock: a run is aborted exactly when its clock has
 * passed the deadline and the test says so. The ledger, the transport and the
 * Worker's sequencer port are wrapped only to move that clock at a chosen
 * point of the run. Everything else is the real code a deployment would run.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LeaseAcquisition } from '../../../../src/sync/coordinated/ledger/model';
import { LEASE_TTL_MS } from '../../../../src/sync/coordinated/ledger/model';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { runCoordinatedSync } from '../../../../src/sync/coordinated/run';
import {
  COORDINATION_DEADLINE_MS,
  INTENT_DEADLINE_MS,
  PUBLICATION_LEASE_RESERVE_MS,
  type RunBudgetTimer,
} from '../../../../src/sync/coordinated/run-budget';
import { envelope, fullSeasonRaces } from '../../../providers/jolpica/support';
import { sequencerTransports } from '../../../publication/sequenced/support';
import { paths, seasonPaths, tickAfter } from '../observation/support';
import {
  EntryPointHarness,
  HOUR,
  MINUTE,
  PRE_SEASON,
  later,
  linesOf,
  type LedgerBinding,
} from './support';

const injected = vi.hoisted(() => ({
  ledger: null as null | (() => unknown),
}));

vi.mock(
  '../../../../src/sync/coordinated/ledger-port',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/sync/coordinated/ledger-port')
      >();
    return {
      ...actual,
      resolveReconciliationLedger: () =>
        (injected.ledger?.() ?? null) as ReconciliationLedgerPort | null,
    };
  },
);
vi.mock('../../../../src/sync/coordinated/run', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../../src/sync/coordinated/run')
    >();
  return { ...actual, runCoordinatedSync: vi.fn(actual.runCoordinatedSync) };
});

const runSync = vi.mocked(runCoordinatedSync);

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  injected.ledger = null;
  runSync.mockClear();
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  expect(globalFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

const bind = (binding: LedgerBinding) => {
  injected.ledger = binding;
};

const triggers = ['scheduled', 'manual'] as const;
type Trigger = (typeof triggers)[number];

/** A run budget timer on the harness clock, fired only when a test says so. */
class BudgetTimers {
  private readonly entries: {
    readonly due: number;
    readonly expire: () => void;
    live: boolean;
  }[] = [];

  constructor(private readonly clock: { now(): Date }) {}

  readonly timer: RunBudgetTimer = (delay, expire) => {
    const entry = {
      due: this.clock.now().getTime() + delay,
      expire,
      live: true,
    };
    this.entries.push(entry);
    return () => {
      entry.live = false;
    };
  };

  /** Timers armed so far. */
  get armed(): number {
    return this.entries.length;
  }

  /** Timers still armed. */
  get live(): number {
    return this.entries.filter((entry) => entry.live).length;
  }

  /** Fires every live timer whose instant the clock has reached. */
  fire(): void {
    for (const entry of this.entries) {
      if (entry.live && this.clock.now().getTime() >= entry.due) {
        entry.live = false;
        entry.expire();
      }
    }
  }
}

interface Budgeted {
  readonly harness: EntryPointHarness;
  readonly timers: BudgetTimers;
}

async function budgeted(
  transport: (typeof sequencerTransports)[number],
): Promise<Budgeted> {
  const harness = await EntryPointHarness.create(transport, bind);
  const timers = new BudgetTimers(harness.clock);
  harness.env.__RUN_BUDGET_TIMER = timers.timer;
  return { harness, timers };
}

/** When a publication is due and nothing else: the calendar moved a race. */
const RUN = later(PRE_SEASON, 9 * HOUR);

async function publicationDue(
  transport: (typeof sequencerTransports)[number],
): Promise<Budgeted & { readonly due: string; readonly release: string }> {
  const setup = await budgeted(transport);
  const { harness } = setup;
  const release = await harness.published();
  const races = [...fullSeasonRaces()];
  races[22] = { ...races[22], time: '14:00:00Z' };
  harness.server.answers.set(paths.calendar, () => ({
    kind: 'json',
    body: envelope(races),
  }));
  await harness.scheduled(later(PRE_SEASON, 8 * HOUR));
  const due = (await harness.season()).publicationDueAt;
  if (due === null) throw new Error('no publication is due');
  return { ...setup, due, release };
}

/** One Worker call of `trigger` at `at`, with the outcome it answered. */
async function call(harness: EntryPointHarness, trigger: Trigger, at: string) {
  const runs = runSync.mock.results.length;
  const record =
    trigger === 'scheduled'
      ? { ...(await harness.scheduled(at)), status: null }
      : await harness.manual(at);
  const result = runSync.mock.results[runs];
  const outcome =
    result === undefined
      ? null
      : ((await result.value) as Record<string, unknown>);
  return { ...record, outcome };
}

interface LedgerHooks {
  /** After the lease is acquired, with the instant the ledger says it expires. */
  readonly afterAcquire?: (expiresAt: string) => void;
  /** A ledger clock ahead of the Worker's: the grant reports a later expiry. */
  readonly skewMillis?: number;
  readonly afterReconcile?: () => void;
  /** After each commit of the call, numbered from 1. */
  readonly afterCommit?: (index: number) => void;
}

/** The resolver answers a ledger that moves the clock at chosen points. */
function hookLedger(harness: EntryPointHarness, hooks: LedgerHooks): void {
  harness.bindExactly(() => {
    const base = harness.harness.freshLedger();
    let commits = 0;
    return Object.assign(Object.create(base) as ReconciliationLedgerPort, {
      acquireLease: async (season: number): Promise<LeaseAcquisition> => {
        const acquired = await base.acquireLease(season);
        if (acquired.outcome !== 'acquired') return acquired;
        hooks.afterAcquire?.(acquired.lease.expiresAt);
        return hooks.skewMillis === undefined
          ? acquired
          : {
              ...acquired,
              lease: {
                ...acquired.lease,
                expiresAt: later(acquired.lease.expiresAt, hooks.skewMillis),
              },
            };
      },
      reconcilePublishedRevisions: async (
        request: Parameters<
          ReconciliationLedgerPort['reconcilePublishedRevisions']
        >[0],
      ) => {
        const outcome = await base.reconcilePublishedRevisions(request);
        hooks.afterReconcile?.();
        return outcome;
      },
      commit: async (
        request: Parameters<ReconciliationLedgerPort['commit']>[0],
      ) => {
        const outcome = await base.commit(request);
        commits += 1;
        hooks.afterCommit?.(commits);
        return outcome;
      },
    });
  });
}

/**
 * The transport passes the deadline while `path` is in flight: the clock
 * reaches the coordination deadline of a run that started at `at`, and the
 * timer fires. A transport that honours the abort then rejects, as `fetch`
 * does; one that does not answers late.
 */
function deadlineDuring(
  { harness, timers }: Budgeted,
  path: string,
  at: string,
  honoursAbort: boolean,
): void {
  const answer = harness.server.transport;
  harness.env.__PROVIDER_TRANSPORT = async (request) => {
    const url = new URL(request.url);
    const response = await answer(request);
    if (url.pathname.endsWith(path)) {
      harness.clock.set(later(at, COORDINATION_DEADLINE_MS));
      timers.fire();
      if (honoursAbort && request.signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
    }
    return response;
  };
}

/** The Worker's transport goes back to answering at once. */
function plainTransport({ harness }: Budgeted): void {
  harness.env.__PROVIDER_TRANSPORT = harness.server.transport;
}

/**
 * A round's record without the authority cache, which every run's
 * reconciliation refreshes before it plans: what a check could change.
 */
function checkState(
  record: Awaited<ReturnType<EntryPointHarness['round']>>,
): object | null {
  return record === null ? null : { ...record, publishedRevision: null };
}

const withheld = (cause: string) => ({
  outcome: 'withheld',
  cause,
  publishCalls: 0,
  next: 'retry',
});

describe.each(sequencerTransports)(
  'the run budget at the entry points over the %s transport',
  (transport) => {
    describe('the coordination deadline', () => {
      it.each(triggers)(
        'begins a %s run past its deadline cancelled: nothing is reserved or sent, and its publication retries',
        async (trigger) => {
          const setup = await publicationDue(transport);
          const { harness, timers } = setup;
          hookLedger(harness, {
            afterReconcile: () =>
              harness.clock.advance(COORDINATION_DEADLINE_MS),
          });
          const armed = timers.armed;

          const answer = await call(harness, trigger, RUN);

          expect(answer.outcome).toMatchObject({
            status: 'observed',
            plan: 'publication',
            coordination: 'cancelled',
            providerRequests: 0,
            publication: withheld('cancelled'),
            leaseRelease: 'released',
          });
          expect(answer).toMatchObject({
            requests: [],
            reservations: 0,
            prepares: 0,
            storageWrites: 0,
          });
          if (trigger === 'manual') expect(answer.status).toBe(200);
          // One timer, armed under the lease, never left armed.
          expect([timers.armed - armed, timers.live]).toEqual([1, 0]);
          const season = await harness.season();
          expect(season.publicationDisposition).toBeNull();
          expect(season.publicationDueAt).toBe(
            trigger === 'scheduled'
              ? later(harness.clock.now().toISOString(), HOUR)
              : setup.due,
          );
        },
      );

      it.each(triggers)(
        'aborts a %s run request in flight: it counts as sent, and is a cancelled observation, never a failed check',
        async (trigger) => {
          const setup = await budgeted(transport);
          const { harness } = setup;
          await harness.published();
          harness.server.results.set(1, 'A');
          await harness.scheduled(tickAfter(1, 5));
          const before = await harness.round(1);
          const at = tickAfter(1, 9);
          deadlineDuring(setup, paths.results(1), at, true);

          const answer = await call(harness, trigger, at);

          expect(answer.requests).toEqual([...seasonPaths, paths.results(1)]);
          expect(answer.reservations).toBe(7);
          expect(answer.outcome).toMatchObject({
            status: 'observed',
            coordination: 'cancelled',
            providerRequests: 7,
            events: { 'classification.check-not-attempted': 1 },
            publication: withheld('cancelled'),
          });
          const events = (answer.outcome as { events: object }).events;
          expect(events).not.toHaveProperty(['classification.check-failed']);
          expect(answer.prepares).toBe(0);
          // No attempt, slot, confirmation or review state was recorded.
          expect(checkState(await harness.round(1))).toEqual(
            checkState(before),
          );

          if (trigger === 'scheduled') {
            // The check is still due, and the retry makes it.
            plainTransport(setup);
            const settledAt = harness.clock.now().toISOString();
            await harness.scheduled(later(settledAt, HOUR));
            const after = await harness.round(1);
            expect(after?.lastAttemptedAt).not.toBe(before?.lastAttemptedAt);
            expect(after?.checkIndex).toBeGreaterThan(before!.checkIndex);
          }
        },
      );

      it.each(triggers)(
        'never accepts a response that arrives after the deadline on a %s run',
        async (trigger) => {
          const setup = await budgeted(transport);
          const { harness } = setup;
          await harness.published();
          harness.server.results.set(1, 'A');
          await harness.scheduled(tickAfter(1, 5));
          const before = await harness.round(1);
          // The late answer is a differing revision: accepted, it would be
          // sighted as pending.
          harness.server.results.set(1, 'B');
          const at = tickAfter(1, 9);
          deadlineDuring(setup, paths.results(1), at, false);

          const answer = await call(harness, trigger, at);

          expect(answer.requests).toEqual([...seasonPaths, paths.results(1)]);
          expect(answer.outcome).toMatchObject({
            coordination: 'cancelled',
            providerRequests: 7,
            events: { 'classification.check-not-attempted': 1 },
            publication: withheld('cancelled'),
          });
          expect(checkState(await harness.round(1))).toEqual(
            checkState(before),
          );
        },
      );

      it('never lets a cancelled check reach the 14-day ceiling', async () => {
        const setup = await budgeted(transport);
        const { harness } = setup;
        await harness.published();
        // Round 1 has never had a result; this is its final cadence slot.
        const at = tickAfter(1, 14 * 24);
        deadlineDuring(setup, paths.results(1), at, true);

        const cancelled = await call(harness, 'scheduled', at);

        expect(cancelled.requests).toEqual([...seasonPaths, paths.results(1)]);
        expect(cancelled.outcome).toMatchObject({ coordination: 'cancelled' });
        expect(await harness.round(1)).toBeNull();

        plainTransport(setup);
        const settledAt = harness.clock.now().toISOString();
        await harness.scheduled(later(settledAt, HOUR));
        // The same slot, completed and failed: the ceiling is a time rule.
        expect((await harness.round(1))?.terminalReason).toBe(
          'never-reconciled-abandoned',
        );
      });

      it('still cancels through the linked test hook', async () => {
        const setup = await publicationDue(transport);
        const { harness } = setup;
        const controller = new AbortController();
        harness.server.onRequest = (path) => {
          if (path === paths.drivers) controller.abort();
        };
        harness.env.__COORDINATED_RUN_SIGNAL = controller.signal;

        const answer = await call(harness, 'scheduled', RUN);

        expect(answer.outcome).toMatchObject({
          coordination: 'cancelled',
          providerRequests: 3,
          publication: withheld('cancelled'),
        });
      });
    });

    describe('the intent gate', () => {
      it.each(triggers)(
        'withholds a %s run past the intent deadline as run-budget-exhausted, before any reservation or prepare',
        async (trigger) => {
          const setup = await publicationDue(transport);
          const { harness } = setup;
          // A ledger clock ahead of the Worker's: the lease looks long, so
          // only the elapsed time can close the gate.
          hookLedger(harness, {
            skewMillis: HOUR,
            afterCommit: (index) => {
              if (index === 1) {
                harness.clock.set(later(RUN, INTENT_DEADLINE_MS + 1));
              }
            },
          });

          const answer = await call(harness, trigger, RUN);

          expect(answer.outcome).toMatchObject({
            status: 'observed',
            coordination: 'completed',
            providerRequests: 6,
            publication: withheld('run-budget-exhausted'),
            leaseRelease: 'released',
          });
          expect([
            answer.prepares,
            answer.finalizes,
            answer.storageWrites,
          ]).toEqual([0, 0, 0]);
          // Observation, then the outcome commit: no reservation commit.
          expect(
            answer.ledgerCalls.filter((name) => name === 'commit'),
          ).toHaveLength(2);
          if (trigger === 'manual') expect(answer.status).toBe(200);
          expect(
            linesOf(answer, 'sync.coordinated.observation')[0],
          ).toMatchObject({
            level: 'info',
            publicationOutcome: 'withheld',
            publicationReason: 'run-budget-exhausted',
            publicationNextDue: 'retry',
          });
          const season = await harness.season();
          expect(season.publicationDisposition).toBeNull();
          expect(harness.activeVersion()).toBe(setup.release);

          if (trigger === 'manual') {
            expect(season.publicationDueAt).toBe(setup.due);
            return;
          }
          // The durable retry: due in an hour, and published then, once.
          const settledAt = harness.clock.now().toISOString();
          expect(season.publicationDueAt).toBe(later(settledAt, HOUR));
          harness.bindLedger();
          const early = await call(
            harness,
            'scheduled',
            later(settledAt, 30 * MINUTE),
          );
          expect(early.outcome).toMatchObject({ status: 'nothing-due' });
          const retry = await call(
            harness,
            'scheduled',
            later(settledAt, HOUR),
          );
          expect(retry.outcome).toMatchObject({
            publication: { outcome: 'published', publishCalls: 1 },
          });
          expect(retry.prepares).toBe(1);
        },
      );

      it('is open at the intent deadline itself', async () => {
        const setup = await publicationDue(transport);
        const { harness } = setup;
        hookLedger(harness, {
          skewMillis: HOUR,
          afterCommit: (index) => {
            if (index === 1) harness.clock.set(later(RUN, INTENT_DEADLINE_MS));
          },
        });

        const answer = await call(harness, 'scheduled', RUN);

        expect(answer.outcome).toMatchObject({
          publication: { outcome: 'published', publishCalls: 1 },
        });
        expect(answer.prepares).toBe(1);
      });

      it.each([
        [0, 'published'],
        [1, 'withheld'],
      ] as const)(
        'needs the full lease reserve: %i ms short of it, the run is %s',
        async (shortBy, expected) => {
          const setup = await publicationDue(transport);
          const { harness } = setup;
          let expiresAt = '';
          hookLedger(harness, {
            // The Worker's clock starts the budget 10 s after the ledger's,
            // so the elapsed time is never what decides.
            afterAcquire: (expiry) => {
              expiresAt = expiry;
              harness.clock.advance(10_000);
            },
            afterCommit: (index) => {
              if (index === 1) {
                harness.clock.set(
                  later(expiresAt, shortBy - PUBLICATION_LEASE_RESERVE_MS),
                );
              }
            },
          });

          const answer = await call(harness, 'manual', RUN);

          expect(answer.status).toBe(200);
          expect(answer.outcome).toMatchObject({
            status: 'observed',
            publication: { outcome: expected },
            leaseRelease: 'released',
          });
          expect(answer.prepares).toBe(expected === 'published' ? 1 : 0);
          if (expected === 'withheld') {
            expect(answer.outcome).toMatchObject({
              publication: withheld('run-budget-exhausted'),
            });
            expect(harness.activeVersion()).toBe(setup.release);
          }
        },
      );
    });

    describe('after the intent commit', () => {
      it.each(triggers)(
        'never cancels a %s publication, however late it runs',
        async (trigger) => {
          const setup = await publicationDue(transport);
          const { harness, timers } = setup;
          const live: number[] = [];
          harness.onPrepare = () => {
            // Past both deadlines, with a minute of lease left.
            live.push(timers.live);
            harness.clock.set(later(RUN, LEASE_TTL_MS - MINUTE));
            timers.fire();
          };

          const answer = await call(harness, trigger, RUN);

          expect(live).toEqual([0]);
          expect(answer.outcome).toMatchObject({
            status: 'observed',
            coordination: 'completed',
            publication: { outcome: 'published', publishCalls: 1 },
            leaseRelease: 'released',
          });
          expect([answer.prepares, answer.finalizes]).toEqual([1, 1]);
          expect(harness.activeVersion()).not.toBe(setup.release);
          expect((await harness.season()).publicationDisposition).toBeNull();
          if (trigger === 'manual') expect(answer.status).toBe(200);
        },
      );

      it('leaves a stall that outlives the lease to the existing recovery: no second release', async () => {
        const setup = await publicationDue(transport);
        const { harness } = setup;
        harness.onPrepare = () => {
          harness.clock.set(later(RUN, LEASE_TTL_MS + MINUTE));
        };

        const stalled = await call(harness, 'scheduled', RUN);

        expect(stalled.outcome).toMatchObject({
          status: 'failed',
          stage: 'outcome',
          publication: { outcome: 'published' },
        });
        const release = harness.activeVersion();
        expect(release).not.toBe(setup.release);

        // A forced run recognizes the release through the sidecar, and
        // confirms it instead of publishing it again.
        harness.onPrepare = () => {};
        const next = await call(harness, 'manual', later(RUN, HOUR));
        expect(next.outcome).toMatchObject({
          publication: { outcome: 'unchanged', publishCalls: 0 },
        });
        expect(next.prepares).toBe(0);
        expect(harness.activeVersion()).toBe(release);
      });
    });

    describe('what the budget is not tied to', () => {
      it('arms nothing for a run refused at the gate or by a held lease', async () => {
        const setup = await publicationDue(transport);
        const { harness, timers } = setup;
        const armed = timers.armed;

        harness.unbindLedger();
        const refused = await call(harness, 'manual', RUN);
        const tick = await call(harness, 'scheduled', RUN);
        expect(refused.status).toBe(503);
        expect(tick.requests).toEqual([]);
        expect(timers.armed).toBe(armed);

        harness.bindLedger();
        harness.clock.set(RUN);
        const held = await harness.harness.freshLedger().acquireLease(2026);
        expect(held.outcome).toBe('acquired');
        const busy = await call(harness, 'manual', RUN);
        expect(busy.outcome).toMatchObject({ status: 'run-in-progress' });
        expect(timers.armed).toBe(armed);
      });

      // What this proves is that the Worker never reads the request's signal.
      // A platform stop after a real disconnect is a hard stop, which these
      // tests cannot reproduce; the recovery tests above cover its effects.
      it('never reads the client signal of a manual run (RB-8)', async () => {
        const setup = await publicationDue(transport);
        const { harness } = setup;
        const client = new AbortController();
        harness.server.onRequest = (path) => {
          if (path === paths.drivers) client.abort();
        };

        const answer = await harness.manual(RUN, { signal: client.signal });

        expect(client.signal.aborted).toBe(true);
        expect(answer.status).toBe(200);
        expect(answer.body.data).toMatchObject({
          coordination: 'completed',
          providerRequests: 6,
          publication: { outcome: 'published', publishCalls: 1 },
        });
      });
    });
  },
);
