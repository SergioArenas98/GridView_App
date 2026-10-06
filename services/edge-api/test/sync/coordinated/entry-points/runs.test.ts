/**
 * The Worker's two coordinated entry points - `worker.scheduled` and
 * `POST /internal/admin/sync/full` - run the one §6.6 orchestration through
 * `runCoordinatedSync`, over both sequencer and ledger transports.
 *
 * The only substitution below the entry points is the resolver's answer
 * (`vi.mock`): a fresh ledger client per call, or `null`, the answer every
 * environment gets. Spies on the composition, the orchestration and the
 * whole-season service show which path each call took. A global `fetch` stub
 * fails the test if anything reaches the network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { composeCoordinatedRuntime } from '../../../../src/sync/coordinated/composition';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { observeCoordinatedSeason } from '../../../../src/sync/coordinated/observation';
import { runCoordinatedSync } from '../../../../src/sync/coordinated/run';
import { SynchronizationService } from '../../../../src/sync/sync-service';
import { envelope, fullSeasonRaces } from '../../../providers/jolpica/support';
import { readStoredPublicationMetadata } from '../../../../src/publication/publication-metadata';
import { sequencerTransports } from '../../../publication/sequenced/support';
import { paced, paths, seasonPaths, tickAfter } from '../observation/support';
import {
  EntryPointHarness,
  FIRST_PUBLICATION,
  HOUR,
  MINUTE,
  PRE_SEASON,
  SEASON,
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
vi.mock(
  '../../../../src/sync/coordinated/composition',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/sync/coordinated/composition')
      >();
    return {
      ...actual,
      composeCoordinatedRuntime: vi.fn(actual.composeCoordinatedRuntime),
    };
  },
);
vi.mock(
  '../../../../src/sync/coordinated/observation',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/sync/coordinated/observation')
      >();
    return {
      ...actual,
      observeCoordinatedSeason: vi.fn(actual.observeCoordinatedSeason),
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

const compose = vi.mocked(composeCoordinatedRuntime);
const observe = vi.mocked(observeCoordinatedSeason);
const runSync = vi.mocked(runCoordinatedSync);
const SHA = /^sha256:[0-9a-f]{64}$/;

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});
let wholeSeason: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  injected.ledger = null;
  compose.mockClear();
  observe.mockClear();
  runSync.mockClear();
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
  wholeSeason = vi.spyOn(SynchronizationService.prototype, 'run');
});

afterEach(() => {
  // No call in this file may take the whole-season path or the network.
  expect(wholeSeason).not.toHaveBeenCalled();
  expect(globalFetch).not.toHaveBeenCalled();
  wholeSeason.mockRestore();
  vi.unstubAllGlobals();
});

const bind = (binding: LedgerBinding) => {
  injected.ledger = binding;
};

/** The outcome `runCoordinatedSync` answered for the `index`th call. */
async function outcomeOf(index = -1): Promise<Record<string, unknown>> {
  const results = runSync.mock.results;
  const result = results.at(index);
  if (result === undefined) throw new Error('runCoordinatedSync not called');
  return (await result.value) as Record<string, unknown>;
}

const scheduledRun = {
  trigger: 'scheduled',
  forcedPublication: false,
  advancesSchedule: true,
};
const manualRun = {
  trigger: 'manual',
  forcedPublication: true,
  advancesSchedule: false,
};

describe.each(sequencerTransports)(
  'the coordinated entry points over the %s transport',
  (transport) => {
    const create = (seed: 'mock' | 'unclassified' = 'unclassified') =>
      EntryPointHarness.create(transport, bind, { seed });

    describe('without a ledger, which is every environment', () => {
      it('refuses a manual run before any lease, reservation, request or publication write', async () => {
        const harness = await create();
        harness.unbindLedger();
        const before = harness.activeVersion();

        const answer = await harness.manual(PRE_SEASON);

        expect(answer.status).toBe(503);
        expect(answer.cacheControl).toBe('no-store');
        expect(answer.body.data).toEqual({
          status: 'coordinated-runtime-unavailable',
          season: SEASON,
          run: manualRun,
          reasons: ['ledger-unbound'],
          providerRequests: 0,
        });
        expect(answer).toMatchObject({
          requests: [],
          reservations: 0,
          prepares: 0,
          finalizes: 0,
          storageWrites: 0,
          ledgerCalls: [],
          mockProviderCalls: 0,
        });
        // Refused at the gate: nothing was composed or orchestrated.
        expect(runSync).toHaveBeenCalledTimes(1);
        expect(compose).not.toHaveBeenCalled();
        expect(observe).not.toHaveBeenCalled();
        expect(harness.activeVersion()).toBe(before);
        expect(linesOf(answer, 'sync.coordinated.withheld')).toEqual([
          {
            level: 'warn',
            operation: 'sync.coordinated.withheld',
            season: SEASON,
            syncTrigger: 'manual',
            coordinationStatus: 'coordinated-runtime-unavailable',
            failureCategory: 'coordinated-runtime-unavailable',
            coordinationMissingDependencies: ['ledger-unbound'],
            providerOperationCallCount: 0,
          },
        ]);
      });

      it('gives a scheduled run its bounded withheld outcome, and no attention line', async () => {
        const harness = await create();
        harness.unbindLedger();

        const record = await harness.scheduled(PRE_SEASON);

        expect(await outcomeOf()).toEqual({
          status: 'coordinated-runtime-unavailable',
          season: SEASON,
          run: scheduledRun,
          reasons: ['ledger-unbound'],
          providerRequests: 0,
        });
        expect(record).toMatchObject({
          requests: [],
          reservations: 0,
          prepares: 0,
          storageWrites: 0,
          ledgerCalls: [],
        });
        expect(compose).not.toHaveBeenCalled();
        expect(observe).not.toHaveBeenCalled();
        expect(record.logs.map((line) => line.operation)).toEqual([
          'sync.coordinated.withheld',
        ]);
      });
    });

    describe('with a ledger bound', () => {
      it('runs a due bootstrap observation, which publishes nothing', async () => {
        const harness = await create();

        const bootstrap = await harness.scheduled(PRE_SEASON);

        expect(observe).toHaveBeenCalledTimes(1);
        expect(observe.mock.calls[0]?.[0]).toEqual({
          season: SEASON,
          trigger: 'scheduled',
        });
        expect(await outcomeOf()).toEqual({
          status: 'observed',
          season: SEASON,
          run: scheduledRun,
          plan: 'observation',
          coordination: 'completed',
          providerRequests: 1,
          committed: true,
          events: { 'refresh.first-observation': 1 },
          publication: 'not-attempted',
          leaseRelease: 'released',
        });
        expect(bootstrap).toMatchObject({
          requests: [paths.calendar],
          reservations: 1,
          prepares: 0,
          storageWrites: 0,
          mockProviderCalls: 0,
        });
        expect((await harness.season()).calendarAnchors).not.toBeNull();
        expect(
          bootstrap.logs
            .filter((line) => /^(sync|reconciliation)\./.test(line.operation))
            .map((line) => [line.operation, line.level]),
        ).toEqual([['sync.coordinated.observation', 'info']]);
      });

      it('sends nothing when nothing is due', async () => {
        const harness = await create();
        await harness.published();

        const idle = await harness.scheduled(later(PRE_SEASON, 2 * HOUR));

        expect(await outcomeOf()).toEqual({
          status: 'nothing-due',
          season: SEASON,
          run: scheduledRun,
          reason: 'no-work',
          providerRequests: 0,
          leaseRelease: 'released',
        });
        expect(idle).toMatchObject({
          requests: [],
          reservations: 0,
          prepares: 0,
          storageWrites: 0,
        });
        expect(idle.ledgerCalls).toEqual([
          'acquireLease',
          'reconcilePublishedRevisions',
          'releaseLease',
          'readSeason',
        ]);
      });

      it('publishes once through the guarded sequenced publication, with curated metadata and the ordering input', async () => {
        const harness = await create();
        await harness.scheduled(PRE_SEASON);
        const baseline = harness.activeVersion();

        const run = await harness.scheduled(FIRST_PUBLICATION);

        const release = harness.activeVersion();
        expect(release).not.toBe(baseline);
        expect(await outcomeOf()).toEqual({
          status: 'observed',
          season: SEASON,
          run: scheduledRun,
          plan: 'publication',
          coordination: 'completed',
          providerRequests: 6,
          committed: true,
          events: { 'refresh.first-observation': 4, 'refresh.unchanged': 1 },
          publication: {
            outcome: 'published',
            releaseVersion: release,
            reason: null,
            publishCalls: 1,
            next: 'completed',
          },
          leaseRelease: 'released',
        });
        expect(run.requests).toEqual(seasonPaths);
        expect(run.reservations).toBe(6);
        // One two-phase publication by the Worker's own guarded service.
        expect([run.prepares, run.finalizes]).toEqual([1, 1]);
        expect(run.mockProviderCalls).toBe(0);
        expect(run.ledgerCalls).toEqual([
          'acquireLease',
          'reconcilePublishedRevisions',
          'commit',
          'commit',
          'commit',
          'releaseLease',
          'readSeason',
        ]);

        const observed = paced(FIRST_PUBLICATION, 6);
        const season = await harness.season();
        expect(season.lastOrderingInput).toBe(observed);
        expect(season.lastPublication).toEqual({
          digest: expect.stringMatching(SHA),
          activeVersion: release,
          publishedAt: observed,
          confirmedAt: observed,
        });
        expect(season.publicationDisposition).toBeNull();
        expect(
          await readStoredPublicationMetadata(
            harness.harness.storage,
            SEASON,
            release!,
          ),
        ).toMatchObject({
          kind: 'record',
          record: { sourceOrderingInput: observed },
        });
        const manifest = await harness.harness.storage.readVersionedDocument(
          SEASON,
          release!,
          'content:manifest',
        );
        expect(manifest?.data).toMatchObject({
          contentVersion: '2026.09.29.1',
          mediaVersion: null,
          attributionVersion: 'data-sources-v1',
        });
      });

      it('confirms unchanged content on a manual run without publishing, and answers 200', async () => {
        const harness = await create();
        const release = await harness.published();
        const before = await harness.season();
        const at = later(PRE_SEASON, 2 * HOUR);

        const answer = await harness.manual(at);

        expect(answer.status).toBe(200);
        expect(answer.cacheControl).toBe('no-store');
        expect(answer.body.data).toEqual({
          status: 'observed',
          season: SEASON,
          run: manualRun,
          plan: 'publication',
          coordination: 'completed',
          providerRequests: 6,
          committed: true,
          events: { 'refresh.unchanged': 5 },
          publication: {
            outcome: 'unchanged',
            publishCalls: 0,
            next: 'completed',
          },
          leaseRelease: 'released',
        });
        expect(observe.mock.calls.at(-1)?.[0]).toEqual({
          season: SEASON,
          trigger: 'manual',
        });
        expect([answer.prepares, answer.finalizes]).toEqual([0, 0]);
        expect(answer.storageWrites).toBe(0);
        expect(harness.activeVersion()).toBe(release);
        // A manual run reads no attention.
        expect(answer.ledgerCalls).toEqual([
          'acquireLease',
          'reconcilePublishedRevisions',
          'commit',
          'commit',
          'releaseLease',
        ]);
        const after = await harness.season();
        expect(after.lastOrderingInput).toBe(before.lastOrderingInput);
        expect(after.lastPublication).toEqual({
          ...before.lastPublication,
          confirmedAt: paced(at, 6),
        });
        // O-8: no due time moved.
        expect(after.refresh).toEqual(
          Object.fromEntries(
            Object.entries(before.refresh).map(([resource, refresh]) => [
              resource,
              {
                ...refresh,
                lastAttemptedAt: paced(at, 6),
                lastSuccessAt: paced(at, 6),
              },
            ]),
          ),
        );
        expect(after.publicationDueAt).toBe(before.publicationDueAt);
      });

      it('keeps scheduled and manual confirmation accounting apart', async () => {
        const manualFirst = await create();
        const scheduledFirst = await create();
        for (const harness of [manualFirst, scheduledFirst]) {
          await harness.published();
          harness.server.results.set(1, 'A');
        }
        const at = tickAfter(1, 5);

        const manual = await manualFirst.manual(at);
        await scheduledFirst.scheduled(at);

        expect(manual.body.data).toMatchObject({
          plan: 'publication',
          events: { 'classification.first-write': 1 },
          publication: { outcome: 'published' },
        });
        // A manual first write counts no confirmation and consumes no slot.
        expect(await manualFirst.round(1)).toMatchObject({
          checkIndex: 0,
          consecutiveConfirmations: 0,
        });
        expect(await scheduledFirst.round(1)).toMatchObject({
          checkIndex: 1,
          consecutiveConfirmations: 1,
        });

        // The slot the manual run left is still served by the next tick.
        const tick = await manualFirst.scheduled(later(at, MINUTE));
        expect(tick.requests).toEqual([...seasonPaths, paths.results(1)]);
        expect(await manualFirst.round(1)).toMatchObject({
          checkIndex: 1,
          consecutiveConfirmations: 1,
        });

        // A manual sighting of another revision is not applied.
        manualFirst.server.results.set(1, 'B');
        const differing = await manualFirst.manual(later(at, 2 * HOUR));
        expect(differing.body.data).toMatchObject({
          events: { 'classification.observation-not-applied': 1 },
        });
        expect(await manualFirst.round(1)).toMatchObject({
          checkIndex: 1,
          consecutiveConfirmations: 1,
          candidateRevision: null,
        });
      });

      it('retries a cancelled scheduled publication in an hour; a cancelled manual run moves no due time', async () => {
        const scheduled = await create();
        const manual = await create();
        for (const harness of [scheduled, manual]) {
          await harness.published();
          // The calendar's next observation moves the last race, which makes
          // a publication due at the next tick and nothing else.
          const races = [...fullSeasonRaces()];
          races[22] = { ...races[22], time: '14:00:00Z' };
          harness.server.answers.set(paths.calendar, () => ({
            kind: 'json',
            body: envelope(races),
          }));
          await harness.scheduled(later(PRE_SEASON, 8 * HOUR));
        }
        const cancelling = (harness: EntryPointHarness) => {
          const controller = new AbortController();
          harness.server.onRequest = (path) => {
            if (path === paths.drivers) controller.abort();
          };
          harness.env.__COORDINATED_RUN_SIGNAL = controller.signal;
        };
        const due = (await manual.season()).publicationDueAt;
        expect(due).not.toBeNull();

        cancelling(scheduled);
        const tick = await scheduled.scheduled(later(PRE_SEASON, 9 * HOUR));
        const scheduledOutcome = await outcomeOf();
        cancelling(manual);
        const answer = await manual.manual(later(PRE_SEASON, 9 * HOUR));

        for (const outcome of [scheduledOutcome, answer.body.data]) {
          expect(outcome).toMatchObject({
            status: 'observed',
            plan: 'publication',
            coordination: 'cancelled',
            publication: {
              outcome: 'withheld',
              cause: 'cancelled',
              publishCalls: 0,
              next: 'retry',
            },
            leaseRelease: 'released',
          });
        }
        expect(answer.status).toBe(200);
        for (const record of [tick, answer]) {
          expect([record.prepares, record.storageWrites]).toEqual([0, 0]);
        }
        const settledAt = scheduled.clock.now().toISOString();
        expect((await scheduled.season()).publicationDueAt).toBe(
          later(settledAt, HOUR),
        );
        expect((await manual.season()).publicationDueAt).toBe(due);
      });

      it('honours a limiter deferral on scheduled ticks only; a manual run still asks', async () => {
        const harness = await create();
        await harness.published();
        harness.server.results.set(1, 'A');
        await harness.scheduled(tickAfter(1, 5));
        const at = tickAfter(1, 9);
        const retryAt = later(at, 90 * MINUTE);
        const base = harness.limiter.reservations.length;
        harness.limiter.script = (call) =>
          call === base + 7 ? { deferredUntil: retryAt } : 'allowed';

        const deferring = await harness.scheduled(at);

        expect(deferring.reservations).toBe(7);
        expect(await outcomeOf()).toMatchObject({
          status: 'observed',
          providerRequests: 6,
          events: { 'classification.check-deferred': 1 },
        });
        expect((await harness.round(1))?.limiterDeferralUntil).toBe(retryAt);

        const waiting = await harness.scheduled(later(at, HOUR));
        expect(await outcomeOf()).toMatchObject({
          status: 'nothing-due',
          reason: 'limiter-deferred',
          providerRequests: 0,
        });
        expect([waiting.requests, waiting.reservations]).toEqual([[], 0]);

        harness.limiter.script = () => 'allowed';
        const forced = await harness.manual(later(at, HOUR));
        expect(forced.status).toBe(200);
        expect(forced.requests).toEqual([...seasonPaths, paths.results(1)]);
      });

      it('withholds a run whose provider request failed, and publishes nothing', async () => {
        const harness = await create();
        const release = await harness.published();
        harness.server.answers.set(paths.drivers, () => ({
          kind: 'status',
          status: 503,
        }));

        const answer = await harness.manual(later(PRE_SEASON, 2 * HOUR));

        expect(answer.status).toBe(200);
        expect(answer.body.data).toMatchObject({
          status: 'observed',
          plan: 'publication',
          coordination: 'completed',
          publication: { outcome: 'withheld', publishCalls: 0 },
        });
        expect([answer.prepares, answer.storageWrites]).toEqual([0, 0]);
        expect(harness.activeVersion()).toBe(release);
      });

      it('reports a ledger that cannot commit as a failed run, and sends no publication', async () => {
        const harness = await create();
        const release = await harness.published();
        harness.bindExactly(() => {
          const base = harness.harness.freshLedger();
          return Object.assign(
            Object.create(base) as ReconciliationLedgerPort,
            {
              commit: async () => ({ outcome: 'unavailable' as const }),
            },
          );
        });

        const answer = await harness.manual(later(PRE_SEASON, 2 * HOUR));

        expect(answer.status).toBe(200);
        expect(answer.body.data).toEqual({
          status: 'failed',
          season: SEASON,
          run: manualRun,
          stage: 'commit',
          failure: 'ledger-unavailable',
          ledgerRejection: null,
          providerRequests: 6,
          leaseRelease: 'released',
        });
        expect([answer.prepares, answer.storageWrites]).toEqual([0, 0]);
        expect(harness.activeVersion()).toBe(release);
        expect(
          linesOf(answer, 'sync.coordinated.observation').map(
            (line) => line.level,
          ),
        ).toEqual(['warn']);
      });

      it('answers run-in-progress, with no request, while another run holds the lease', async () => {
        const harness = await create();
        await harness.published();
        const at = later(PRE_SEASON, 2 * HOUR);
        harness.clock.set(at);
        const held = await harness.harness.freshLedger().acquireLease(SEASON);
        expect(held.outcome).toBe('acquired');

        const answer = await harness.manual(at);

        expect(answer.status).toBe(200);
        expect(answer.body.data).toEqual({
          status: 'run-in-progress',
          season: SEASON,
          run: manualRun,
          providerRequests: 0,
        });
        expect([answer.requests, answer.reservations]).toEqual([[], 0]);
      });
    });
  },
);
