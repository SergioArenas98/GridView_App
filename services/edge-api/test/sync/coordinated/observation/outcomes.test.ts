/**
 * The exact table from a coordinated contribution to a C2 check outcome.
 * Only a completed request is a check: a deferral records its `retryAt` and
 * nothing else, and a cancellation or a request never reached is not
 * attempted. A coordinator-side defect refuses the whole mapping.
 */

import { describe, expect, it } from 'vitest';

import type {
  CoordinationRun,
  ResourceCoordination,
  SourceContribution,
} from '../../../../src/providers/coordination';
import { observationOutcomes } from '../../../../src/sync/coordinated/observation';
import type { PlannedResource } from '../../../../src/sync/coordinated/policy';

const SEASON = 2026;
const race: PlannedResource = {
  kind: 'session-classification',
  season: SEASON,
  round: 3,
  sessionType: 'race',
};
const circuits: PlannedResource = { kind: 'season-circuits', season: SEASON };

function contribution(
  resource: PlannedResource,
  fields: Partial<SourceContribution>,
): SourceContribution {
  return {
    source: 'jolpica',
    role: 'reconciled',
    resource,
    jobCategory: 'results',
    status: 'failed',
    attempted: true,
    reason: null,
    retryAt: null,
    retryAfter: null,
    payload: null,
    ...fields,
  } as SourceContribution;
}

function unavailable(
  resource: PlannedResource,
  contributions: readonly SourceContribution[],
): ResourceCoordination {
  return {
    resource,
    jobCategory: 'results',
    selection: { outcome: 'unavailable', reason: 'no-usable-candidate' },
    contributions,
  } as ResourceCoordination;
}

function run(resources: readonly ResourceCoordination[]): CoordinationRun {
  return {
    season: SEASON,
    status: 'completed',
    planProblem: null,
    resources,
    accounting: {
      lifetime: { total: 0, successful: 0, failed: 0, rateLimited: 0 },
      bySource: {},
      byJobCategory: {},
    },
    counts: {
      planned: resources.length,
      selected: 0,
      unavailable: resources.length,
      attempted: 0,
      notAttempted: 0,
    },
  };
}

async function outcomeFor(fields: Partial<SourceContribution>) {
  const mapped = await observationOutcomes(
    [race],
    run([unavailable(race, [contribution(race, fields)])]),
  );
  return mapped.kind === 'mapped'
    ? mapped.classificationOutcomes.get(3)
    : mapped.reason;
}

describe('an unselected contribution', () => {
  const table: readonly [string, Partial<SourceContribution>, unknown][] = [
    [
      'a deferral with an instant',
      {
        status: 'deferred',
        attempted: false,
        reason: 'rate-limit-deferred',
        retryAt: '2026-03-01T18:00:00Z',
      },
      { status: 'deferred', retryAt: '2026-03-01T18:00:00.000Z' },
    ],
    [
      'a deferral without an instant',
      { status: 'deferred', attempted: false, reason: 'rate-limit-deferred' },
      { status: 'not-attempted' },
    ],
    [
      'a deferral with an unreadable instant',
      {
        status: 'deferred',
        attempted: false,
        reason: 'rate-limit-deferred',
        retryAt: 'soon',
      },
      { status: 'not-attempted' },
    ],
    [
      'a cancellation before sending',
      { status: 'skipped', attempted: false, reason: 'cancelled' },
      { status: 'not-attempted' },
    ],
    [
      'a limiter that could not answer',
      { status: 'skipped', attempted: false, reason: 'limiter-unavailable' },
      { status: 'not-attempted' },
    ],
    [
      'an execution interrupted by a deferral',
      {
        status: 'interrupted',
        reason: 'rate-limit-deferred',
        retryAt: '2026-03-01T18:00:00.000Z',
      },
      { status: 'deferred', retryAt: '2026-03-01T18:00:00.000Z' },
    ],
    [
      'an execution interrupted by a cancellation',
      { status: 'interrupted', reason: 'cancelled' },
      { status: 'not-attempted' },
    ],
    [
      'an execution interrupted by an unavailable limiter',
      { status: 'interrupted', reason: 'limiter-unavailable' },
      { status: 'not-attempted' },
    ],
    [
      'an upstream failure',
      { status: 'failed', reason: 'provider-unavailable' },
      { status: 'failed' },
    ],
    [
      'an upstream 429',
      { status: 'failed', reason: 'provider-rate-limited' },
      { status: 'failed' },
    ],
    [
      'an invalid payload',
      { status: 'failed', reason: 'invalid-payload' },
      { status: 'failed' },
    ],
    [
      'an unresolved identity',
      { status: 'failed', reason: 'mapping-unresolved' },
      { status: 'failed' },
    ],
    [
      'an adapter that threw',
      { status: 'failed', attempted: false, reason: 'adapter-error' },
      'coordination-defect',
    ],
    [
      'a malformed answer',
      { status: 'failed', attempted: true, reason: 'malformed-outcome' },
      'coordination-defect',
    ],
    [
      'a violated invariant',
      { status: 'failed', attempted: false, reason: 'coordination-invariant' },
      'coordination-defect',
    ],
    [
      'a candidate that was not selected',
      { status: 'candidate', reason: null },
      'coordination-defect',
    ],
  ];

  for (const [name, fields, expected] of table) {
    it(`${name}`, async () => {
      expect(await outcomeFor(fields)).toEqual(expected);
    });
  }

  it('is a defect when Jolpica made no contribution, or two', async () => {
    for (const contributions of [
      [contribution(race, { source: 'openf1' as never })],
      [
        contribution(race, { reason: 'provider-unavailable' }),
        contribution(race, { reason: 'provider-unavailable' }),
      ],
    ]) {
      expect(
        await observationOutcomes(
          [race],
          run([unavailable(race, contributions)]),
        ),
      ).toEqual({ kind: 'refused', reason: 'coordination-defect' });
    }
  });
});

describe('a selection', () => {
  it('from any source but Jolpica is a defect', async () => {
    const coordination = {
      resource: circuits,
      jobCategory: 'profiles',
      selection: {
        outcome: 'selected',
        source: 'openf1',
        role: 'provisional',
        payload: { kind: 'season-circuits', circuits: [] },
      },
      contributions: [],
    } as unknown as ResourceCoordination;
    expect(await observationOutcomes([circuits], run([coordination]))).toEqual({
      kind: 'refused',
      reason: 'coordination-defect',
    });
  });

  it('of another kind than planned is malformed', async () => {
    const coordination = {
      resource: circuits,
      jobCategory: 'profiles',
      selection: {
        outcome: 'selected',
        source: 'jolpica',
        role: 'reconciled',
        payload: { kind: 'season-participants', drivers: [] },
      },
      contributions: [],
    } as unknown as ResourceCoordination;
    expect(await observationOutcomes([circuits], run([coordination]))).toEqual({
      kind: 'refused',
      reason: 'selection-malformed',
    });
  });

  it('is keyed by refresh resource and by round', async () => {
    const coordination = {
      resource: circuits,
      jobCategory: 'profiles',
      selection: {
        outcome: 'selected',
        source: 'jolpica',
        role: 'reconciled',
        payload: { kind: 'season-circuits', circuits: [] },
      },
      contributions: [],
    } as unknown as ResourceCoordination;
    const mapped = await observationOutcomes(
      [circuits, race],
      run([
        coordination,
        unavailable(race, [contribution(race, { reason: 'invalid-payload' })]),
      ]),
    );
    expect(mapped).toEqual({
      kind: 'mapped',
      seasonOutcomes: {
        circuits: {
          status: 'observed',
          revision: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        },
      },
      classificationOutcomes: new Map([[3, { status: 'failed' }]]),
    });
  });
});
