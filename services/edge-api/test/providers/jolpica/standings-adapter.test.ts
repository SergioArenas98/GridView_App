/**
 * The dormant Jolpica standings port (ADR 0023 amendment A3).
 *
 * Every fixture is synthetic (`standings-support.ts`); no captured response
 * and no captured row is committed. Every candidate is checked against the
 * production validators, never against a copy of the contract.
 */

import { describe, expect, it } from 'vitest';

import {
  validateConstructorStanding,
  validateDriverStanding,
} from '../../../src/contract/normalized';
import type {
  ConstructorStanding,
  DriverStanding,
} from '../../../src/contract/types';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  coordinatedResourceKinds,
  coordinationFor,
  isWellFormedOutcome,
  payloadMatchesResource,
  validateCoordinatedPayload,
  type CoordinatedResource,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import { gridViewUserAgent } from '../../../src/providers/http/provider-http-client';
import {
  parseStandingPoints,
  standingsPageLimit,
} from '../../../src/providers/jolpica';
import type { ProviderMappingRegistry } from '../../../src/providers/mappings';
import { editedRegistry } from './participants-support';
import {
  baseConstructorRows,
  baseDriverRows,
  constructorMapping,
  constructorMappingFor,
  constructorStandingRow,
  constructorStandingsEnvelope,
  constructorStandingsUrl,
  driverMapping,
  driverStandingRow,
  driverStandingsEnvelope,
  driverStandingsUrl,
  emptyStandingsEnvelope,
  standingsHarness,
  syntheticStandingsMarkers,
  type StandingsEnvelopeOptions,
  type StandingsHarnessOptions,
} from './standings-support';
import { LIMIT, SEASON } from './support';

const DRIVERS: CoordinatedResource = {
  kind: 'driver-standings',
  season: SEASON,
};
const CONSTRUCTORS: CoordinatedResource = {
  kind: 'constructor-standings',
  season: SEASON,
};

async function fetchStandings(
  resource: CoordinatedResource,
  options: StandingsHarnessOptions = {},
  signal?: AbortSignal,
) {
  const harness = standingsHarness(options);
  const outcome = await harness.port.fetchResource({
    source: 'jolpica',
    resource,
    ...(signal ? { signal } : {}),
  });
  return { ...harness, outcome };
}

type Run = Awaited<ReturnType<typeof fetchStandings>>;

const withDriverBody = (body: unknown, options: StandingsHarnessOptions = {}) =>
  fetchStandings(DRIVERS, { ...options, steps: [{ kind: 'json', body }] });
const withConstructorBody = (
  body: unknown,
  options: StandingsHarnessOptions = {},
) =>
  fetchStandings(CONSTRUCTORS, { ...options, steps: [{ kind: 'json', body }] });

/** Runs the driver port against the base rows, edited, in an envelope. */
function withDriverRows(
  edit: (rows: Record<string, unknown>[]) => unknown,
  envelope: StandingsEnvelopeOptions = {},
  options: StandingsHarnessOptions = {},
) {
  const rows = baseDriverRows();
  const edited = edit(rows) ?? rows;
  return withDriverBody(driverStandingsEnvelope(edited, envelope), options);
}

/** Runs the constructor port against the base rows, edited. */
function withConstructorRows(
  edit: (rows: Record<string, unknown>[]) => unknown,
  envelope: StandingsEnvelopeOptions = {},
  options: StandingsHarnessOptions = {},
) {
  const rows = baseConstructorRows();
  const edited = edit(rows) ?? rows;
  return withConstructorBody(
    constructorStandingsEnvelope(edited, envelope),
    options,
  );
}

function driverTable(outcome: ProviderResourceOutcome): DriverStanding[] {
  if (outcome.outcome !== 'candidate') {
    throw new Error(`expected a candidate, got ${outcome.outcome}`);
  }
  if (outcome.payload.kind !== 'driver-standings') {
    throw new Error('expected a driver standings payload');
  }
  return [...outcome.payload.standings];
}

function constructorTable(
  outcome: ProviderResourceOutcome,
): ConstructorStanding[] {
  if (outcome.outcome !== 'candidate') {
    throw new Error(`expected a candidate, got ${outcome.outcome}`);
  }
  if (outcome.payload.kind !== 'constructor-standings') {
    throw new Error('expected a constructor standings payload');
  }
  return [...outcome.payload.standings];
}

function attemptOutcomes(outcome: ProviderResourceOutcome): string[] {
  return 'attempts' in outcome
    ? outcome.attempts.map((attempt) => attempt.outcome)
    : [];
}

/** Asserts an invalid-payload outcome for exactly one closed problem code. */
function expectInvalid(run: Run, problem: string): void {
  expect(run.outcome.outcome).toBe('failed');
  expect(run.outcome.outcome === 'failed' && run.outcome.reason).toBe(
    'invalid-payload',
  );
  expect('payload' in run.outcome).toBe(false);
  expect(attemptOutcomes(run.outcome)).toEqual(['successful']);
  expect(run.calls).toHaveLength(1);
  expect(isWellFormedOutcome(run.outcome)).toBe(true);
  expect(
    run.logger.events.find(
      (event) => event.operation === 'provider.standings.invalid_payload',
    )?.failureCategory,
  ).toBe(problem);
}

function expectMappingFailure(run: Run): void {
  expect(run.outcome.outcome).toBe('mapping-failure');
  expect(attemptOutcomes(run.outcome)).toEqual(['successful']);
  expect('payload' in run.outcome).toBe(false);
  expect(run.calls).toHaveLength(1);
  expect(isWellFormedOutcome(run.outcome)).toBe(true);
}

const d = (index: number) => driverMapping(index);
const c = (index: number) => constructorMapping(index);

/** Sets one field of the driver row at `index`. */
const setDriverField =
  (index: number, key: string, value: unknown) =>
  (rows: Record<string, unknown>[]) => {
    (rows[index] as Record<string, unknown>)[key] = value;
  };

describe('driver standings', () => {
  it('makes exactly one request, to the exact driver standings URL, with limit=100', async () => {
    const { outcome, calls, reservations } = await fetchStandings(DRIVERS);

    expect(standingsPageLimit).toBe(100);
    expect(calls.map((call) => call.url)).toEqual([driverStandingsUrl()]);
    expect(driverStandingsUrl()).toBe(
      `https://api.jolpi.ca/ergast/f1/2026/driverstandings/?limit=${LIMIT}`,
    );
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.headers['user-agent']).toBe(gridViewUserAgent);
    expect(calls[0]?.hasBody).toBe(false);
    expect(reservations).toEqual(['jolpica']);
    expect(attemptOutcomes(outcome)).toEqual(['successful']);
    expect(isWellFormedOutcome(outcome)).toBe(true);
  });

  it('builds the request from the requested season, never a constant', async () => {
    const { calls } = await fetchStandings({ ...DRIVERS, season: 2031 });
    expect(calls.map((call) => call.url)).toEqual([driverStandingsUrl(2031)]);
  });

  it('passes the production validators and matches the requested resource', async () => {
    const { outcome } = await fetchStandings(DRIVERS);
    if (outcome.outcome !== 'candidate') throw new Error('no candidate');

    expect(payloadMatchesResource(DRIVERS, outcome.payload)).toBe(true);
    expect(validateCoordinatedPayload(outcome.payload)).toEqual([]);
    for (const standing of driverTable(outcome)) {
      expect(validateDriverStanding(standing, 'standing')).toEqual([]);
    }
  });

  it('normalizes every row, in provider order, under canonical identities only', async () => {
    const table = driverTable((await fetchStandings(DRIVERS)).outcome);

    expect(table).toEqual([
      {
        season: SEASON,
        driverId: d(0).gridviewId,
        constructorId: c(0).gridviewId,
        position: 1,
        points: 120,
        wins: 3,
        podiums: null,
        provisional: false,
      },
      {
        season: SEASON,
        driverId: d(1).gridviewId,
        constructorId: null,
        position: 2,
        points: 64,
        wins: 1,
        podiums: null,
        provisional: false,
      },
      {
        season: SEASON,
        driverId: d(2).gridviewId,
        constructorId: c(1).gridviewId,
        position: 3,
        points: 40,
        wins: 0,
        podiums: null,
        provisional: false,
      },
      {
        season: SEASON,
        driverId: d(3).gridviewId,
        constructorId: c(2).gridviewId,
        position: 4,
        points: 7,
        wins: 0,
        podiums: null,
        provisional: false,
      },
      {
        season: SEASON,
        driverId: d(4).gridviewId,
        constructorId: c(2).gridviewId,
        position: 5,
        points: 7,
        wins: 0,
        podiums: null,
        provisional: false,
      },
    ]);
  });

  it('publishes no team for a row listing two constructors, in either order (S-3)', async () => {
    for (const order of [
      [c(1).providerValue, c(0).providerValue],
      [c(0).providerValue, c(1).providerValue],
    ]) {
      const run = await withDriverRows((rows) => {
        (rows[1] as Record<string, unknown>).Constructors = order.map(
          (constructorId) => ({ constructorId }),
        );
      });
      const row = driverTable(run.outcome)[1];
      expect(row?.constructorId, order.join()).toBeNull();
      // S-4: the one season total is kept, never split between the teams.
      expect(row?.points, order.join()).toBe(64);
    }
  });

  it('publishes no team for a row listing three constructors (S-3)', async () => {
    const run = await withDriverRows((rows) => {
      (rows[0] as Record<string, unknown>).Constructors = [0, 1, 2].map(
        (index) => ({ constructorId: c(index).providerValue }),
      );
    });
    expect(driverTable(run.outcome)[0]?.constructorId).toBeNull();
  });

  it('never infers a podium count (S-7)', async () => {
    const run = await withDriverRows((rows) => {
      for (const row of rows) row.podiums = '4';
    });
    for (const row of driverTable(run.outcome)) {
      expect(row.podiums).toBeNull();
    }
  });

  it('keeps provisional false as policy and reads no planted finality field (S-8)', async () => {
    const plain = driverTable((await fetchStandings(DRIVERS)).outcome);
    const planted = await withDriverRows(
      (rows) => {
        for (const row of rows) {
          row.provisional = 'true';
          row.status = 'provisional';
        }
      },
      { listExtra: { provisional: 'true', status: 'final' } },
    );

    expect(driverTable(planted.outcome)).toEqual(plain);
    for (const row of plain) expect(row.provisional).toBe(false);
  });

  it('validates the round, then drops it from the payload (S-2)', async () => {
    const at9 = await fetchStandings(DRIVERS);
    const at15 = await withDriverRows(() => undefined, {
      round: '15',
      listRound: '15',
    });
    if (at9.outcome.outcome !== 'candidate') throw new Error('no candidate');

    expect(driverTable(at15.outcome)).toEqual(driverTable(at9.outcome));
    expect(JSON.stringify(at9.outcome.payload)).not.toContain('round');
  });

  it('preserves equal points at distinct positions in provider order', async () => {
    const table = driverTable((await fetchStandings(DRIVERS)).outcome);
    expect(table.slice(3).map((row) => [row.position, row.points])).toEqual([
      [4, 7],
      [5, 7],
    ]);
  });

  it('accepts strictly increasing positions that are not contiguous (S-5)', async () => {
    const run = await withDriverRows((rows) => {
      setDriverField(3, 'position', '6')(rows);
      setDriverField(3, 'positionText', '6')(rows);
      setDriverField(4, 'position', '7')(rows);
      setDriverField(4, 'positionText', '7')(rows);
    });
    expect(driverTable(run.outcome).map((row) => row.position)).toEqual([
      1, 2, 3, 6, 7,
    ]);
  });

  it('accepts fractional and zero-padded fractional points exactly (S-6)', async () => {
    const run = await withDriverRows((rows) => {
      setDriverField(2, 'points', '40.5')(rows);
      setDriverField(3, 'points', '7.50')(rows);
      setDriverField(4, 'points', '7.0')(rows);
    });
    expect(driverTable(run.outcome).map((row) => row.points)).toEqual([
      120, 64, 40.5, 7.5, 7,
    ]);
  });

  it('carries no provider-descriptive value and no provider identity', async () => {
    const serialized = JSON.stringify(
      driverTable((await fetchStandings(DRIVERS)).outcome),
    );
    for (const marker of syntheticStandingsMarkers) {
      expect(serialized).not.toContain(marker);
    }
    const canonical = new Set(
      [0, 1, 2, 3, 4].map((index) => d(index).gridviewId),
    );
    for (const index of [0, 1, 2, 3, 4]) {
      const providerValue = d(index).providerValue;
      if (canonical.has(providerValue)) continue;
      expect(serialized).not.toContain(`"${providerValue}"`);
    }
  });

  it('is selected, counted once and attributed to standings through the coordinator', async () => {
    const harness = standingsHarness();
    const run = await new MultiSourceCoordinator({
      ports: [harness.port],
      logger: new CapturingLogger(),
    }).coordinate({ plan: { season: SEASON, resources: [DRIVERS] } });

    expect(coordinationFor(run, DRIVERS)?.selection.outcome).toBe('selected');
    expect(run.accounting.lifetime).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(run.accounting.byJobCategory).toEqual({
      standings: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
    });
  });
});

describe('constructor standings', () => {
  const constructorScript = (): StandingsHarnessOptions => ({
    steps: [
      {
        kind: 'json',
        body: constructorStandingsEnvelope(baseConstructorRows()),
      },
    ],
  });

  it('makes exactly one request, to the exact constructor standings URL', async () => {
    const { outcome, calls, reservations } = await fetchStandings(
      CONSTRUCTORS,
      constructorScript(),
    );

    expect(calls.map((call) => call.url)).toEqual([constructorStandingsUrl()]);
    expect(constructorStandingsUrl()).toBe(
      `https://api.jolpi.ca/ergast/f1/2026/constructorstandings/?limit=${LIMIT}`,
    );
    expect(calls[0]?.method).toBe('GET');
    expect(reservations).toEqual(['jolpica']);
    expect(attemptOutcomes(outcome)).toEqual(['successful']);
  });

  it('passes the production validators and normalizes every row in order', async () => {
    const { outcome } = await fetchStandings(CONSTRUCTORS, constructorScript());
    if (outcome.outcome !== 'candidate') throw new Error('no candidate');

    expect(payloadMatchesResource(CONSTRUCTORS, outcome.payload)).toBe(true);
    expect(validateCoordinatedPayload(outcome.payload)).toEqual([]);
    const table = constructorTable(outcome);
    for (const standing of table) {
      expect(validateConstructorStanding(standing, 'standing')).toEqual([]);
    }
    expect(table).toEqual(
      [
        [0, 1, 150, 3],
        [1, 2, 90, 1],
        [2, 3, 14, 0],
        [3, 4, 0, 0],
      ].map(([index, position, points, wins]) => ({
        season: SEASON,
        constructorId: c(index as number).gridviewId,
        position,
        points,
        wins,
        provisional: false,
      })),
    );
  });

  it('resolves a constructor whose provider value is not its canonical ID', async () => {
    // The committed three-layer naming case: a stable canonical `sauber`
    // reached from a different provider value.
    const sauber = constructorMappingFor('sauber');
    expect(sauber.providerValue).not.toBe('sauber');

    const run = await withConstructorRows((rows) => [
      constructorStandingRow(sauber.providerValue, {
        position: '1',
        points: '17',
        wins: '0',
      }),
      ...rows.slice(1),
    ]);
    const table = constructorTable(run.outcome);
    expect(table[0]?.constructorId).toBe('sauber');
    expect(JSON.stringify(table)).not.toContain(`"${sauber.providerValue}"`);
  });

  it('is counted once and attributed to standings through the coordinator', async () => {
    const harness = standingsHarness(constructorScript());
    const run = await new MultiSourceCoordinator({
      ports: [harness.port],
      logger: new CapturingLogger(),
    }).coordinate({ plan: { season: SEASON, resources: [CONSTRUCTORS] } });

    expect(coordinationFor(run, CONSTRUCTORS)?.selection.outcome).toBe(
      'selected',
    );
    expect(run.accounting.byJobCategory).toEqual({
      standings: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
    });
  });

  it('refuses a driver standings body served for a constructor request', async () => {
    expectInvalid(
      await withConstructorBody(driverStandingsEnvelope(baseDriverRows())),
      'standings-collection',
    );
  });
});

describe('resource refusal and request control', () => {
  it('refuses every other resource before any reservation, request or attempt', async () => {
    for (const kind of coordinatedResourceKinds) {
      if (kind === 'driver-standings' || kind === 'constructor-standings') {
        continue;
      }
      const resource = {
        kind,
        season: SEASON,
        round: 1,
        sessionType: 'race',
      } as unknown as CoordinatedResource;
      const harness = standingsHarness();
      const outcome = await harness.port.fetchResource({
        source: 'jolpica',
        resource,
      });

      expect(outcome, kind).toEqual({
        outcome: 'not-attempted',
        reason: 'resource-unsupported',
      });
      expect(harness.calls, kind).toHaveLength(0);
      expect(harness.reservations, kind).toHaveLength(0);
    }
  });

  it('refuses a cancellation before reserving capacity', async () => {
    const controller = new AbortController();
    controller.abort();
    for (const resource of [DRIVERS, CONSTRUCTORS]) {
      const { outcome, calls, reservations } = await fetchStandings(
        resource,
        {},
        controller.signal,
      );
      expect(outcome).toEqual({
        outcome: 'not-attempted',
        reason: 'cancelled',
      });
      expect(calls).toHaveLength(0);
      expect(reservations).toHaveLength(0);
    }
  });

  it('keeps a limiter deferral and an unavailable limiter not attempted', async () => {
    const deferred = await fetchStandings(DRIVERS, { limiter: ['deferred'] });
    expect(
      deferred.outcome.outcome === 'not-attempted' && deferred.outcome.reason,
    ).toBe('rate-limit-deferred');
    expect(deferred.calls).toHaveLength(0);

    const unavailable = await fetchStandings(CONSTRUCTORS, {
      limiter: ['unavailable'],
    });
    expect(unavailable.outcome).toEqual({
      outcome: 'not-attempted',
      reason: 'limiter-unavailable',
    });
    expect(unavailable.calls).toHaveLength(0);
  });

  it('reports a transport failure as one failed attempt, without retrying', async () => {
    const { outcome, calls } = await fetchStandings(DRIVERS, {
      steps: [{ kind: 'network' }, { kind: 'network' }],
    });
    expect(outcome.outcome === 'failed' && outcome.reason).toBe(
      'provider-unavailable',
    );
    expect(attemptOutcomes(outcome)).toEqual(['failed']);
    expect(calls).toHaveLength(1);
  });

  it('reports an HTTP error status as one attempt, without retrying', async () => {
    const { outcome, calls } = await fetchStandings(CONSTRUCTORS, {
      steps: [
        { kind: 'status', status: 503 },
        { kind: 'status', status: 503 },
      ],
    });
    expect(outcome.outcome === 'failed' && outcome.reason).toBe(
      'provider-unavailable',
    );
    expect(attemptOutcomes(outcome)).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it('reports a provider 429 with its retry instruction', async () => {
    const { outcome, calls } = await fetchStandings(DRIVERS, {
      steps: [{ kind: 'rate-limited', retryAfterSeconds: 30 }],
    });
    expect(outcome.outcome === 'failed' && outcome.reason).toBe(
      'provider-rate-limited',
    );
    expect(attemptOutcomes(outcome)).toEqual(['rate-limited']);
    expect(outcome.outcome === 'failed' && outcome.retryAfter).toBeTruthy();
    expect(calls).toHaveLength(1);
  });
});

describe('an empty standings answer (S-9, unverified shape)', () => {
  it('is an empty candidate for either kind, only as the exact empty shape', async () => {
    const drivers = await withDriverBody(
      emptyStandingsEnvelope('DriverStandings'),
    );
    const constructors = await withConstructorBody(
      emptyStandingsEnvelope('ConstructorStandings'),
    );

    expect(driverTable(drivers.outcome)).toEqual([]);
    expect(constructorTable(constructors.outcome)).toEqual([]);
    for (const run of [drivers, constructors]) {
      if (run.outcome.outcome !== 'candidate') throw new Error('no candidate');
      expect(validateCoordinatedPayload(run.outcome.payload)).toEqual([]);
      expect(attemptOutcomes(run.outcome)).toEqual(['successful']);
    }
  });

  it('accepts the empty shape with no table round, and refuses a malformed one', async () => {
    const absent = await withDriverBody(
      emptyStandingsEnvelope('DriverStandings', { round: undefined }),
    );
    expect(driverTable(absent.outcome)).toEqual([]);

    expectInvalid(
      await withDriverBody(
        emptyStandingsEnvelope('DriverStandings', { round: '0' }),
      ),
      'round',
    );
  });

  it('refuses an empty list whose total claims rows', async () => {
    expectInvalid(
      await withDriverBody(
        emptyStandingsEnvelope('DriverStandings', { total: '3' }),
      ),
      'incomplete-page',
    );
  });

  it('refuses an empty list on an incomplete or offset page', async () => {
    expectInvalid(
      await withDriverBody(
        emptyStandingsEnvelope('DriverStandings', { offset: '100' }),
      ),
      'pagination',
    );
  });

  it('refuses a standings list present with no rows', async () => {
    expectInvalid(
      await withDriverBody(driverStandingsEnvelope([], { total: '0' })),
      'standings-collection',
    );
  });
});

describe('an invalid payload fails the whole resource', () => {
  const envelopeCases: readonly [string, unknown, string][] = [
    ['a body that is not an object', [], 'envelope'],
    ['a body with no MRData', { MRData: null }, 'envelope'],
    [
      'a missing standings table',
      { MRData: { limit: '100', offset: '0', total: '0' } },
      'envelope',
    ],
  ];
  for (const [name, body, problem] of envelopeCases) {
    it(`refuses ${name}`, async () => {
      expectInvalid(await withDriverBody(body), problem);
    });
  }

  const tableCases: readonly [string, StandingsEnvelopeOptions, string][] = [
    [
      'an echoed limit that is not the requested one',
      { limit: '30' },
      'pagination',
    ],
    ['a nonzero offset', { offset: '1' }, 'pagination'],
    ['a numeric limit', { limit: 100 }, 'pagination'],
    ['a malformed total', { total: 'five' }, 'pagination'],
    ['a padded total', { total: '05' }, 'pagination'],
    ['a total beyond the page', { total: '101' }, 'incomplete-page'],
    ['a total above the rows returned', { total: '6' }, 'incomplete-page'],
    ['a total below the rows returned', { total: '4' }, 'incomplete-page'],
    ['another table season', { season: '2025' }, 'season-mismatch'],
    ['a numeric table season', { season: SEASON }, 'season-mismatch'],
    ['another list season', { listSeason: '2025' }, 'season-mismatch'],
    ['a missing table round', { round: undefined }, 'round'],
    ['a zero table round', { round: '0' }, 'round'],
    ['a malformed table round', { round: 'R9' }, 'round'],
    ['a missing list round', { listRound: undefined }, 'round'],
    ['a padded list round', { listRound: '09' }, 'round'],
    ['a numeric list round', { listRound: 9 }, 'round'],
    [
      'a list round disagreeing with the table',
      { listRound: '8' },
      'round-mismatch',
    ],
    [
      'a standings list collection that is not an array',
      { lists: {} },
      'standings-collection',
    ],
    [
      'a standings list that is not an object',
      { lists: ['x'] },
      'standings-collection',
    ],
  ];
  for (const [name, options, problem] of tableCases) {
    it(`refuses ${name}`, async () => {
      expectInvalid(
        await withDriverBody(
          driverStandingsEnvelope(baseDriverRows(), options),
        ),
        problem,
      );
    });
  }

  it('refuses two standings lists', async () => {
    const list = {
      season: String(SEASON),
      round: '9',
      DriverStandings: baseDriverRows(),
    };
    expectInvalid(
      await withDriverBody(
        driverStandingsEnvelope(baseDriverRows(), { lists: [list, list] }),
      ),
      'standings-collection',
    );
  });

  const rowCases: readonly [
    string,
    (rows: Record<string, unknown>[]) => unknown,
    string,
  ][] = [
    [
      'a row that is not an object',
      (rows) => [null, ...rows.slice(1)],
      'standing-row',
    ],
    ['a missing Driver', setDriverField(0, 'Driver', undefined), 'identity'],
    [
      'an empty driverId',
      setDriverField(0, 'Driver', { driverId: '' }),
      'identity',
    ],
    [
      'a numeric driverId',
      setDriverField(0, 'Driver', { driverId: 7 }),
      'identity',
    ],
    [
      'a missing Constructors list (S-4)',
      setDriverField(0, 'Constructors', undefined),
      'constructor-collection',
    ],
    [
      'an empty Constructors list (S-4)',
      setDriverField(0, 'Constructors', []),
      'constructor-collection',
    ],
    [
      'a Constructors value that is not an array',
      setDriverField(0, 'Constructors', { constructorId: 'x' }),
      'constructor-collection',
    ],
    [
      'a listed constructor with no id',
      setDriverField(0, 'Constructors', [{ name: 'x' }]),
      'identity',
    ],
    [
      'a constructor listed twice in one row',
      (rows) =>
        setDriverField(0, 'Constructors', [
          { constructorId: c(0).providerValue },
          { constructorId: c(0).providerValue },
        ])(rows),
      'duplicate-constructor',
    ],
    ['position "-"', setDriverField(0, 'position', '-'), 'position'],
    ['position "D"', setDriverField(0, 'position', 'D'), 'position'],
    ['an empty position', setDriverField(0, 'position', ''), 'position'],
    [
      'a missing position',
      setDriverField(0, 'position', undefined),
      'position',
    ],
    ['position "0"', setDriverField(0, 'position', '0'), 'position'],
    ['a padded position', setDriverField(0, 'position', '01'), 'position'],
    ['a decimal position', setDriverField(0, 'position', '1.0'), 'position'],
    ['a numeric position', setDriverField(0, 'position', 1), 'position'],
    [
      'a positionText that differs from the position',
      setDriverField(0, 'positionText', '2'),
      'position',
    ],
    ['a positionText "-"', setDriverField(0, 'positionText', '-'), 'position'],
    [
      'a missing positionText',
      setDriverField(0, 'positionText', undefined),
      'position',
    ],
    [
      'rows out of position order',
      (rows) => [rows[1], rows[0], ...rows.slice(2)],
      'position-order',
    ],
    [
      'a repeated position',
      (rows) => {
        setDriverField(2, 'position', '2')(rows);
        setDriverField(2, 'positionText', '2')(rows);
      },
      'duplicate-position',
    ],
    ['negative wins', setDriverField(0, 'wins', '-1'), 'wins'],
    ['decimal wins', setDriverField(0, 'wins', '1.5'), 'wins'],
    ['padded wins', setDriverField(0, 'wins', '03'), 'wins'],
    ['empty wins', setDriverField(0, 'wins', ''), 'wins'],
    ['missing wins', setDriverField(0, 'wins', undefined), 'wins'],
    ['numeric wins', setDriverField(0, 'wins', 3), 'wins'],
    [
      'a driver listed twice',
      (rows) => {
        const repeated = driverStandingRow(
          d(0).providerValue,
          [c(3).providerValue],
          { position: '6', points: '0', wins: '0' },
        );
        return [...rows, repeated];
      },
      'duplicate-driver',
    ],
  ];
  for (const [name, edit, problem] of rowCases) {
    it(`refuses ${name}`, async () => {
      expectInvalid(await withDriverRows(edit), problem);
    });
  }

  const malformedPoints: readonly unknown[] = [
    '-1',
    '+7',
    '7.',
    '.5',
    '1e2',
    '07',
    '',
    ' 7',
    '7 ',
    'Infinity',
    'NaN',
    '0x10',
    '7,5',
    7,
    null,
    undefined,
  ];
  for (const points of malformedPoints) {
    it(`refuses points ${JSON.stringify(points) ?? 'absent'} (S-6)`, async () => {
      expectInvalid(
        await withDriverRows(setDriverField(0, 'points', points)),
        'points',
      );
    });
  }

  it('refuses unsafe and digit-losing points without rounding (S-6)', async () => {
    for (const points of [
      '9007199254740992',
      '9007199254740993',
      '100000000000000000000000',
      '0.300000000000000001',
      '1.0000000000000000001',
    ]) {
      expectInvalid(
        await withDriverRows(setDriverField(0, 'points', points)),
        'points',
      );
    }
  });

  it('refuses a constructor table with a repeated constructor or no identity', async () => {
    expectInvalid(
      await withConstructorRows((rows) => [
        ...rows,
        constructorStandingRow(c(0).providerValue, {
          position: '5',
          points: '0',
          wins: '0',
        }),
      ]),
      'duplicate-constructor',
    );
    expectInvalid(
      await withConstructorRows((rows) => {
        (rows[0] as Record<string, unknown>).Constructor = undefined;
      }),
      'identity',
    );
  });

  it('refuses two provider drivers resolving to one canonical driver (S-10)', async () => {
    const registry = aliasRegistry(d(1).providerValue, d(0).gridviewId);
    expectInvalid(
      await fetchStandings(DRIVERS, { registry }),
      'duplicate-canonical-driver',
    );
  });

  it('refuses two provider constructors resolving to one canonical constructor (S-10)', async () => {
    const registry = aliasRegistry(c(1).providerValue, c(0).gridviewId);
    expectInvalid(
      await withConstructorRows(() => undefined, {}, { registry }),
      'duplicate-canonical-constructor',
    );
    // Inside one driver row too: two listed teams that are one team.
    expectInvalid(
      await fetchStandings(DRIVERS, { registry }),
      'duplicate-canonical-constructor',
    );
  });

  it('logs only bounded codes, with the resource kind', async () => {
    const run = await withDriverRows(setDriverField(0, 'points', '-1'));
    const event = run.logger.events.find(
      (entry) => entry.operation === 'provider.standings.invalid_payload',
    );
    expect(event).toMatchObject({
      coordinationResource: 'driver-standings',
      season: SEASON,
      failureCategory: 'points',
      providerRequestAttempted: true,
    });
    const logged = JSON.stringify(run.logger.events);
    expect(logged).not.toContain(d(0).providerValue);
    for (const marker of syntheticStandingsMarkers) {
      expect(logged).not.toContain(marker);
    }
  });
});

/** A registry in which `providerValue` resolves to `gridviewId` instead. */
function aliasRegistry(
  providerValue: string,
  gridviewId: string,
): ProviderMappingRegistry {
  return editedRegistry((document) => {
    const mapping = document.mappings.find(
      (entry) =>
        entry.source === 'jolpica' && entry.providerValue === providerValue,
    );
    if (mapping === undefined) throw new Error('fixture');
    (mapping as { gridviewId: string }).gridviewId = gridviewId;
  });
}

describe('identity resolution fails the whole resource and drops no row', () => {
  it('refuses an unmapped driver', async () => {
    expectMappingFailure(
      await withDriverRows(
        setDriverField(4, 'Driver', { driverId: 'synthetic_unmapped_driver' }),
      ),
    );
  });

  it('refuses an unmapped constructor on a single-team row', async () => {
    expectMappingFailure(
      await withDriverRows(
        setDriverField(3, 'Constructors', [
          { constructorId: 'synthetic_unmapped_constructor' },
        ]),
      ),
    );
  });

  it('refuses an unmapped second constructor that would not be published (S-3)', async () => {
    expectMappingFailure(
      await withDriverRows(
        setDriverField(1, 'Constructors', [
          { constructorId: c(1).providerValue },
          { constructorId: 'synthetic_unmapped_constructor' },
        ]),
      ),
    );
  });

  it('refuses an unmapped constructor standing', async () => {
    expectMappingFailure(
      await withConstructorRows((rows) => {
        (rows[3] as Record<string, unknown>).Constructor = {
          constructorId: 'synthetic_unmapped_constructor',
        };
      }),
    );
  });

  it('refuses a driver whose curated mapping was removed, and signals it boundedly', async () => {
    const removed = d(2).providerValue;
    const registry = editedRegistry((document) => {
      document.mappings = document.mappings.filter(
        (mapping) => mapping.providerValue !== removed,
      );
    });
    const run = await fetchStandings(DRIVERS, { registry });
    expectMappingFailure(run);
    expect(
      run.logger.events.filter((event) => event.level === 'error'),
    ).toHaveLength(1);
  });

  it('counts a mapping failure once through the coordinator', async () => {
    const harness = standingsHarness({
      steps: [
        {
          kind: 'json',
          body: driverStandingsEnvelope(
            baseDriverRows().map((row, index) =>
              index === 0
                ? { ...row, Driver: { driverId: 'synthetic_unmapped_driver' } }
                : row,
            ),
          ),
        },
      ],
    });
    const run = await new MultiSourceCoordinator({
      ports: [harness.port],
      logger: new CapturingLogger(),
    }).coordinate({ plan: { season: SEASON, resources: [DRIVERS] } });

    expect(coordinationFor(run, DRIVERS)?.selection.outcome).toBe(
      'unavailable',
    );
    expect(run.accounting.lifetime).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(
      coordinationFor(run, DRIVERS)?.contributions.find(
        (entry) => entry.source === 'jolpica',
      ),
    ).toMatchObject({
      status: 'failed',
      attempted: true,
      reason: 'mapping-unresolved',
      payload: null,
    });
  });
});

describe('hostile payloads are contained after the attempt is established', () => {
  it('refuses an accessor that throws during decode, without invoking it', async () => {
    let invoked = false;
    const run = await fetchStandings(DRIVERS, {
      successData: () => {
        const body = driverStandingsEnvelope(baseDriverRows());
        Object.defineProperty(body, 'MRData', {
          enumerable: true,
          get() {
            invoked = true;
            throw new Error('https://example.invalid/hostile');
          },
        });
        return body;
      },
    });
    expectInvalid(run, 'envelope');
    expect(invoked).toBe(false);
    expect(JSON.stringify(run.logger.events)).not.toContain('hostile');
  });

  it('contains a proxy whose traps throw during decode', async () => {
    const run = await fetchStandings(DRIVERS, {
      successData: () =>
        new Proxy(
          {},
          {
            getOwnPropertyDescriptor() {
              throw new Error('hostile');
            },
          },
        ),
    });
    expectInvalid(run, 'envelope');
  });

  it('contains a registry that throws during normalization', async () => {
    const registry = {
      resolve(): never {
        throw new Error('hostile');
      },
    } as unknown as ProviderMappingRegistry;
    expectInvalid(await fetchStandings(DRIVERS, { registry }), 'normalization');
  });

  it('refuses an identity inherited from the prototype', async () => {
    const run = await withDriverRows((rows) => {
      const driverId = (rows[0]?.Driver as Record<string, unknown>).driverId;
      (rows[0] as Record<string, unknown>).Driver = Object.create({ driverId });
    });
    expectInvalid(run, 'identity');
  });

  it('refuses a standings collection with a hole', async () => {
    const rows: unknown[] = baseDriverRows();
    delete rows[2];
    const run = await fetchStandings(DRIVERS, {
      successData: () => driverStandingsEnvelope(rows),
    });
    expectInvalid(run, 'standing-row');
  });

  it('refuses a Constructors list with a hole', async () => {
    const constructors: unknown[] = [
      { constructorId: c(0).providerValue },
      { constructorId: c(1).providerValue },
    ];
    delete constructors[0];
    const rows = baseDriverRows();
    (rows[0] as Record<string, unknown>).Constructors = constructors;
    const run = await fetchStandings(DRIVERS, {
      successData: () => driverStandingsEnvelope(rows),
    });
    expectInvalid(run, 'identity');
  });
});

describe('points parsing (S-6)', () => {
  it('converts strict decimal text exactly', () => {
    expect(
      ['0', '0.0', '7', '7.5', '7.50', '12.25', '1000', '0.5'].map(
        parseStandingPoints,
      ),
    ).toEqual([0, 0, 7, 7.5, 7.5, 12.25, 1000, 0.5]);
    expect(parseStandingPoints(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('refuses malformed, nonfinite, unsafe and digit-losing text', () => {
    for (const value of [
      '-0',
      '-1',
      '1e2',
      '1E2',
      'Infinity',
      '07',
      '.5',
      '5.',
      '9007199254740992',
      '1'.repeat(400),
      '0.300000000000000001',
      '0.0000001',
      7,
      null,
      undefined,
      {},
    ]) {
      expect(parseStandingPoints(value), String(value)).toBeNull();
    }
  });
});
