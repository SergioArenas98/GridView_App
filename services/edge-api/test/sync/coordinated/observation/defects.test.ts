/**
 * A coordination the orchestration cannot believe fails closed.
 *
 * The real ports and coordinator already refuse every payload that would make
 * these cases reachable, so the answers are produced here by wrapping the
 * real composed runtime: the real coordinator still runs and still sends its
 * requests, and only the run it reports is altered before the orchestration
 * reads it. Everything else - the ledger, the lease, the authority - is real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CoordinationRun,
  ResourceCoordination,
} from '../../../../src/providers/coordination';
import { composeCoordinatedRuntime } from '../../../../src/sync/coordinated/composition';
import {
  HOUR,
  ObservationHarness,
  PRE_SEASON,
  SEASON,
  paths,
  seasonPaths,
  tickAfter,
} from './support';

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

const compose = vi.mocked(composeCoordinatedRuntime);
const realCompose = compose.getMockImplementation()!;

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  compose.mockImplementation(realCompose);
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

const FIRST_CHECK = tickAfter(1, 5);
const RETRY = new Date(Date.parse(FIRST_CHECK) + 30 * 60 * 1000).toISOString();
const firstCheckRequests = [...seasonPaths, paths.results(1)];

/** Composes the real runtime, then alters what its coordinator reports. */
function tamperWith(alter: (run: CoordinationRun) => CoordinationRun): void {
  compose.mockImplementationOnce((dependencies) => {
    const composition = realCompose(dependencies);
    if (composition.kind !== 'composed') return composition;
    const { runtime } = composition;
    return {
      kind: 'composed',
      runtime: {
        ...runtime,
        coordinator: Object.assign(Object.create(runtime.coordinator), {
          coordinate: async (
            request: Parameters<typeof runtime.coordinator.coordinate>[0],
          ) => alter(await runtime.coordinator.coordinate(request)),
        }),
      },
    };
  });
}

/** `run` with one resource's coordination replaced. */
function replacing(
  run: CoordinationRun,
  kind: string,
  replace: (coordination: ResourceCoordination) => ResourceCoordination,
): CoordinationRun {
  return {
    ...run,
    resources: run.resources.map((coordination) =>
      coordination.resource.kind === kind
        ? replace(coordination)
        : coordination,
    ),
  };
}

function selectedPayload(coordination: ResourceCoordination) {
  if (coordination.selection.outcome !== 'selected') {
    throw new Error('expected a selection');
  }
  return coordination.selection.payload;
}

async function startedSeason(): Promise<ObservationHarness> {
  const harness = await ObservationHarness.create();
  await harness.run(PRE_SEASON);
  await harness.run(new Date(Date.parse(PRE_SEASON) + HOUR).toISOString());
  harness.server.results.set(1, 'A');
  return harness;
}

const cases: readonly [
  string,
  (run: CoordinationRun) => CoordinationRun,
  'coordination' | 'observation',
  string,
][] = [
  [
    'a run that reports a violated invariant',
    (run) => ({ ...run, status: 'invariant-violated' }),
    'coordination',
    'coordination-defect',
  ],
  [
    'a run that reports its plan rejected',
    (run) => ({ ...run, status: 'plan-rejected' }),
    'coordination',
    'coordination-rejected',
  ],
  [
    'a planned resource missing from the run',
    (run) => ({
      ...run,
      resources: run.resources.filter(
        (coordination) => coordination.resource.kind !== 'season-circuits',
      ),
    }),
    'observation',
    'coordination-defect',
  ],
  [
    'an adapter that threw instead of answering',
    (run) =>
      replacing(run, 'session-classification', (coordination) => ({
        ...coordination,
        selection: { outcome: 'unavailable', reason: 'no-usable-candidate' },
        contributions: coordination.contributions.map((contribution) =>
          contribution.source === 'jolpica'
            ? {
                ...contribution,
                status: 'failed',
                attempted: false,
                reason: 'adapter-error',
                payload: null,
              }
            : contribution,
        ),
      })),
    'observation',
    'coordination-defect',
  ],
  [
    'a selected classification for another round',
    (run) =>
      replacing(run, 'session-classification', (coordination) => {
        const payload = selectedPayload(coordination);
        if (payload.kind !== 'session-classification') throw new Error('kind');
        return {
          ...coordination,
          selection: {
            outcome: 'selected',
            source: 'jolpica',
            role: 'reconciled',
            payload: { ...payload, result: { ...payload.result, round: 2 } },
          },
        };
      }),
    'observation',
    'selection-malformed',
  ],
  [
    'a selected calendar whose race has no start',
    (run) =>
      replacing(run, 'season-calendar', (coordination) => {
        const payload = selectedPayload(coordination);
        if (payload.kind !== 'season-calendar') throw new Error('kind');
        const [first, ...rest] = payload.events;
        return {
          ...coordination,
          selection: {
            outcome: 'selected',
            source: 'jolpica',
            role: 'reconciled',
            payload: {
              ...payload,
              events: [
                {
                  ...first!,
                  sessions: first!.sessions.map((session) =>
                    session.type === 'race'
                      ? { ...session, startTime: null }
                      : session,
                  ),
                },
                ...rest,
              ],
            },
          },
        };
      }),
    'observation',
    'selection-malformed',
  ],
  [
    'a selected payload that is not plain data',
    (run) =>
      replacing(run, 'driver-standings', (coordination) => {
        const payload = selectedPayload(coordination);
        return {
          ...coordination,
          selection: {
            outcome: 'selected',
            source: 'jolpica',
            role: 'reconciled',
            payload: { ...payload, round: Number.NaN } as typeof payload,
          },
        };
      }),
    'observation',
    'selection-malformed',
  ],
];

describe('a coordination the orchestration cannot believe', () => {
  for (const [name, alter, stage, reason] of cases) {
    it(`${name}: commits nothing, publishes nothing, releases the lease`, async () => {
      const harness = await startedSeason();
      const before = harness.observationState();
      tamperWith(alter);

      const run = await harness.run(FIRST_CHECK);

      // The requests really were made; their results are not trusted.
      expect(run.requests).toEqual(firstCheckRequests);
      expect(run.outcome).toEqual({
        season: SEASON,
        trigger: 'scheduled',
        status: 'failed',
        stage,
        failure: reason,
        ledgerRejection: null,
        providerRequests: 7,
        leaseRelease: 'released',
      });
      expect(harness.observationState()).toBe(before);
      expect(harness.publishGuarded).not.toHaveBeenCalled();

      const retry = await harness.run(RETRY);
      expect(retry.outcome).toMatchObject({
        status: 'observed',
        events: { 'classification.first-write': 1 },
      });
      expect(retry.requests).toEqual(firstCheckRequests);
    });
  }
});
