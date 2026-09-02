/**
 * The complete reconciled/provisional selection matrix, pinned row by row.
 *
 * Required cases 7-13.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  coordinationFor,
  rolePrecedenceOf,
  sourceRoles,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  FakePort,
  SEASON,
  attempt,
  payloadFor,
  raceResource,
  seasonFixture,
  seasonResources,
  testOnlyProvisionalBound,
} from './support';

const RACE = raceResource(12);
const CALENDAR = seasonResources[0] as CoordinatedResource;

function delay(millis: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

function candidatePort(
  sourceId: 'jolpica' | 'openf1',
  source: ProviderSeasonSource,
  reference: string,
  pause = 0,
): FakePort {
  return new FakePort(sourceId, async (request) => {
    if (pause > 0) await delay(pause);
    const payload = payloadFor(source, request.resource);
    if (payload === null) throw new Error('fixture gap');
    return { outcome: 'candidate', attempt: attempt(reference), payload };
  });
}

function outcomePort(
  sourceId: 'jolpica' | 'openf1',
  outcome: ProviderResourceOutcome,
  pause = 0,
): FakePort {
  return new FakePort(sourceId, async () => {
    if (pause > 0) await delay(pause);
    return outcome;
  });
}

function run(
  ports: FakePort[],
  resources: readonly CoordinatedResource[],
  options: { bound?: unknown; concurrency?: number } = {},
): Promise<CoordinationRun> {
  const coordinator = new MultiSourceCoordinator({
    ports,
    logger: new CapturingLogger(),
    ...(options.bound === undefined
      ? {}
      : { provisionalSessionEndBound: options.bound }),
    ...(options.concurrency === undefined
      ? {}
      : { maxConcurrentOperations: options.concurrency }),
  });
  return coordinator.coordinate({ plan: { season: SEASON, resources } });
}

/** Every terminal outcome the provisional source can produce for one resource. */
function provisionalTerminalOutcomes(): ProviderResourceOutcome[] {
  return [
    {
      outcome: 'not-attempted',
      reason: 'rate-limit-deferred',
      retryAt: '2026-07-20T12:00:30.000Z',
    },
    { outcome: 'not-attempted', reason: 'limiter-unavailable' },
    { outcome: 'not-attempted', reason: 'source-unavailable' },
    {
      outcome: 'failed',
      attempt: attempt('p-1', 'failed'),
      reason: 'provider-unavailable',
    },
    {
      outcome: 'failed',
      attempt: attempt('p-2', 'failed'),
      reason: 'invalid-payload',
    },
    {
      outcome: 'failed',
      attempt: attempt('p-3', 'rate-limited'),
      reason: 'provider-rate-limited',
      retryAfter: '2026-07-20T12:01:00.000Z',
    },
    { outcome: 'mapping-failure', attempt: attempt('p-4') },
  ];
}

describe('selection uses declared role and typed identity only', () => {
  // Case 7
  it('selects the reconciled source when both succeed', async () => {
    const source = await seasonFixture();
    const result = await run(
      [
        candidatePort('jolpica', source, 'j-1'),
        candidatePort('openf1', source, 'o-1'),
      ],
      [RACE],
      { bound: testOnlyProvisionalBound },
    );

    expect(result.resources[0]?.selection).toMatchObject({
      outcome: 'selected',
      source: 'jolpica',
      role: 'reconciled',
    });
  });

  // Case 11
  it('never lets a provisional payload overwrite the reconciled one', async () => {
    const source = await seasonFixture();
    const provisionalResult = {
      ...(source.results[0] as (typeof source.results)[number]),
      status: 'provisional' as const,
    };
    const provisional = new FakePort('openf1', () => ({
      outcome: 'candidate',
      attempt: attempt('o-1'),
      payload: { kind: 'session-classification', result: provisionalResult },
    }));

    const result = await run(
      [candidatePort('jolpica', source, 'j-1'), provisional],
      [RACE],
      { bound: testOnlyProvisionalBound },
    );
    const selection = result.resources[0]?.selection;

    expect(selection).toMatchObject({ source: 'jolpica', role: 'reconciled' });
    if (selection?.outcome !== 'selected')
      throw new Error('expected selection');
    if (selection.payload.kind !== 'session-classification') {
      throw new Error('expected a classification');
    }
    // The reconciled payload wins wholesale; nothing was merged from the
    // provisional one.
    expect(selection.payload.result.status).not.toBe('provisional');
    // ...and the provisional contribution is still visible as a candidate.
    const contributions = result.resources[0]?.contributions ?? [];
    expect(
      contributions.find((entry) => entry.source === 'openf1')?.status,
    ).toBe('candidate');
  });

  // Case 8
  it('still selects the reconciled source against every provisional failure', async () => {
    const source = await seasonFixture();
    for (const outcome of provisionalTerminalOutcomes()) {
      const result = await run(
        [
          candidatePort('jolpica', source, 'j-1'),
          outcomePort('openf1', outcome),
        ],
        [RACE],
        { bound: testOnlyProvisionalBound },
      );

      expect(result.resources[0]?.selection).toMatchObject({
        outcome: 'selected',
        source: 'jolpica',
      });
      // The diagnostic outcome is retained rather than discarded.
      const provisional = result.resources[0]?.contributions.find(
        (entry) => entry.source === 'openf1',
      );
      expect(provisional).toBeDefined();
      expect(provisional?.status).not.toBe('candidate');
      expect(provisional?.reason).not.toBeNull();
    }
  });

  // Case 9
  it('yields a provisional candidate when the reconciled source fails', async () => {
    const source = await seasonFixture();
    const result = await run(
      [
        outcomePort('jolpica', {
          outcome: 'failed',
          attempt: attempt('j-1', 'failed'),
          reason: 'provider-unavailable',
        }),
        candidatePort('openf1', source, 'o-1'),
      ],
      [RACE],
      { bound: testOnlyProvisionalBound },
    );

    expect(result.resources[0]?.selection).toMatchObject({
      outcome: 'selected',
      source: 'openf1',
      role: 'provisional',
    });
    // It is never relabelled as reconciled.
    expect(JSON.stringify(result.resources[0]?.selection)).not.toContain(
      'reconciled',
    );
  });

  it('yields nothing provisional for a resource the provisional source cannot serve', async () => {
    const source = await seasonFixture();
    const provisional = candidatePort('openf1', source, 'o-1');
    const result = await run(
      [
        outcomePort('jolpica', {
          outcome: 'failed',
          attempt: attempt('j-1', 'failed'),
          reason: 'provider-unavailable',
        }),
        provisional,
      ],
      [CALENDAR],
      { bound: testOnlyProvisionalBound },
    );

    expect(provisional.requests).toHaveLength(0);
    expect(result.resources[0]?.selection).toEqual({
      outcome: 'unavailable',
      reason: 'no-usable-candidate',
    });
  });

  // Matrix row: provisional locked, reconciled succeeds.
  it('is an ordinary reconciled-only success when the provisional source is locked', async () => {
    const source = await seasonFixture();
    const provisional = candidatePort('openf1', source, 'o-1');
    const result = await run(
      [candidatePort('jolpica', source, 'j-1'), provisional],
      [RACE],
    );

    expect(provisional.requests).toHaveLength(0);
    expect(result.resources[0]?.selection).toMatchObject({
      outcome: 'selected',
      source: 'jolpica',
    });
    expect(result.accounting.bySource).toEqual({
      jolpica: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
    });
  });

  // Case 10
  it('returns no usable candidate when both sources are unavailable', async () => {
    const result = await run(
      [
        outcomePort('jolpica', {
          outcome: 'failed',
          attempt: attempt('j-1', 'failed'),
          reason: 'provider-unavailable',
        }),
        outcomePort('openf1', {
          outcome: 'not-attempted',
          reason: 'limiter-unavailable',
        }),
      ],
      [RACE],
      { bound: testOnlyProvisionalBound },
    );

    expect(result.status).toBe('completed');
    expect(result.resources[0]?.selection).toEqual({
      outcome: 'unavailable',
      reason: 'no-usable-candidate',
    });
    expect(result.counts).toMatchObject({ selected: 0, unavailable: 1 });
  });

  it('declares reconciled as outranking provisional, and nothing else', () => {
    expect([...sourceRoles]).toEqual(['reconciled', 'provisional']);
    expect(rolePrecedenceOf('reconciled')).toBeLessThan(
      rolePrecedenceOf('provisional'),
    );
  });
});

describe('selection is independent of ordering', () => {
  // Case 12
  it('is unchanged when the sources complete in the opposite order', async () => {
    const source = await seasonFixture();
    const slowReconciled = await run(
      [
        candidatePort('jolpica', source, 'j-1', 20),
        candidatePort('openf1', source, 'o-1', 0),
      ],
      [RACE],
      { bound: testOnlyProvisionalBound, concurrency: 2 },
    );
    const slowProvisional = await run(
      [
        candidatePort('jolpica', source, 'j-1', 0),
        candidatePort('openf1', source, 'o-1', 20),
      ],
      [RACE],
      { bound: testOnlyProvisionalBound, concurrency: 2 },
    );

    expect(slowReconciled.resources[0]?.selection).toMatchObject({
      source: 'jolpica',
    });
    expect(JSON.stringify(slowReconciled.resources)).toEqual(
      JSON.stringify(slowProvisional.resources),
    );
  });

  // Case 13
  it('is unchanged when the plan order is reversed', async () => {
    const source = await seasonFixture();
    const resources = [RACE, raceResource(13), CALENDAR];
    const ports = () => [
      candidatePort('jolpica', source, 'j-1'),
      candidatePort('openf1', source, 'o-1'),
    ];

    const forward = await run(ports(), resources, {
      bound: testOnlyProvisionalBound,
    });
    const reversed = await run(ports(), [...resources].reverse(), {
      bound: testOnlyProvisionalBound,
    });

    for (const resource of resources) {
      expect(JSON.stringify(coordinationFor(forward, resource))).toEqual(
        JSON.stringify(coordinationFor(reversed, resource)),
      );
    }
  });
});
