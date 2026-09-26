/**
 * The dormant Jolpica race-results port (ADR 0023 amendment A2).
 *
 * Every fixture is synthetic (`results-support.ts`); no captured response and
 * no captured row is committed. Every candidate is checked against the
 * production validators, never against a copy of the contract.
 */

import { describe, expect, it } from 'vitest';

import { validateRaceResult } from '../../../src/contract/normalized';
import type { RaceResult, RaceResultEntry } from '../../../src/contract/types';
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
  parseFastestLapTime,
  resultStatusTable,
  resultsPageLimit,
} from '../../../src/providers/jolpica';
import type { ProviderMappingRegistry } from '../../../src/providers/mappings';
import { editedRegistry } from './participants-support';
import {
  ROUND,
  WINNER_LAPS,
  WINNER_MILLIS,
  baseRows,
  canonicalDriver,
  emptyResultsEnvelope,
  locatorFor,
  providerDrivers,
  resultRow,
  resultsEnvelope,
  resultsHarness,
  resultsUrl,
  syntheticResultMarkers,
  type ResultsEnvelopeOptions,
  type ResultsHarnessOptions,
} from './results-support';
import { LIMIT, SEASON } from './support';

const RACE: CoordinatedResource = {
  kind: 'session-classification',
  season: SEASON,
  round: ROUND,
  sessionType: 'race',
};

async function fetchResults(
  options: ResultsHarnessOptions = {},
  signal?: AbortSignal,
) {
  const harness = resultsHarness(options);
  const outcome = await harness.port.fetchResource({
    source: 'jolpica',
    resource: RACE,
    ...(signal ? { signal } : {}),
  });
  return { ...harness, outcome };
}

/** Runs the port against one synthetic response body. */
function withBody(body: unknown, options: ResultsHarnessOptions = {}) {
  return fetchResults({ ...options, steps: [{ kind: 'json', body }] });
}

/** Runs the port against the base rows, edited, in a default envelope. */
function withRows(
  edit: (rows: Record<string, unknown>[]) => unknown,
  envelope: ResultsEnvelopeOptions = {},
) {
  const rows = baseRows();
  const edited = edit(rows) ?? rows;
  return withBody(resultsEnvelope(edited, envelope));
}

function resultOf(outcome: ProviderResourceOutcome): RaceResult {
  if (outcome.outcome !== 'candidate') {
    throw new Error(`expected a candidate, got ${outcome.outcome}`);
  }
  if (outcome.payload.kind !== 'session-classification') {
    throw new Error('expected a classification payload');
  }
  return outcome.payload.result;
}

function attemptOutcomes(outcome: ProviderResourceOutcome): string[] {
  return 'attempts' in outcome
    ? outcome.attempts.map((attempt) => attempt.outcome)
    : [];
}

function entryAt(result: RaceResult, index: number): RaceResultEntry {
  const entry = result.entries[index];
  if (entry === undefined) throw new Error(`no entry ${index}`);
  return entry;
}

type Run = Awaited<ReturnType<typeof fetchResults>>;

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
      (event) => event.operation === 'provider.results.invalid_payload',
    )?.failureCategory,
  ).toBe(problem);
}

const baseDrivers = () => providerDrivers(8).map(canonicalDriver);

describe('a complete race classification', () => {
  it('makes exactly one request, to the exact results URL, with limit=100', async () => {
    const { outcome, calls, reservations } = await fetchResults();

    expect(resultsPageLimit).toBe(100);
    expect(calls.map((call) => call.url)).toEqual([resultsUrl()]);
    expect(resultsUrl()).toBe(
      `https://api.jolpi.ca/ergast/f1/2026/1/results/?limit=${LIMIT}`,
    );
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.headers['user-agent']).toBe(gridViewUserAgent);
    expect(calls[0]?.hasBody).toBe(false);
    expect(reservations).toEqual(['jolpica']);
    expect(attemptOutcomes(outcome)).toEqual(['successful']);
    expect(isWellFormedOutcome(outcome)).toBe(true);
  });

  it('builds the request from the requested season and round', async () => {
    const locator = locatorFor(7);
    const harness = resultsHarness({
      steps: [
        {
          kind: 'json',
          body: resultsEnvelope(baseRows(), {
            round: '7',
            raceRound: '7',
            raceName: locator.raceName,
            circuitId: locator.circuitId,
          }),
        },
      ],
    });
    const outcome = await harness.port.fetchResource({
      source: 'jolpica',
      resource: { ...RACE, round: 7 } as CoordinatedResource,
    });

    expect(harness.calls.map((call) => call.url)).toEqual([resultsUrl(7)]);
    expect(resultOf(outcome).round).toBe(7);
  });

  it('passes the production validators and matches the requested resource', async () => {
    const { outcome } = await fetchResults();
    if (outcome.outcome !== 'candidate') throw new Error('no candidate');

    expect(payloadMatchesResource(RACE, outcome.payload)).toBe(true);
    expect(validateCoordinatedPayload(outcome.payload)).toEqual([]);
    expect(validateRaceResult(resultOf(outcome), 'result')).toEqual([]);
  });

  it('is a final race document with the canonical identities (C-1)', async () => {
    const result = resultOf((await fetchResults()).outcome);

    expect(result).toMatchObject({
      id: '2026-australian-grand-prix-race-results',
      season: SEASON,
      round: ROUND,
      grandPrixId: '2026-australian-grand-prix',
      sessionType: 'race',
      status: 'final',
    });
  });

  it('preserves every row, in provider order, under canonical identities only', async () => {
    const result = resultOf((await fetchResults()).outcome);

    expect(result.entries).toHaveLength(8);
    expect(result.entries.map((entry) => entry.driverId)).toEqual(
      baseDrivers(),
    );
    for (const providerValue of providerDrivers(8)) {
      // A provider slug that is not also a canonical id never appears.
      if (baseDrivers().includes(providerValue)) continue;
      expect(JSON.stringify(result)).not.toContain(`"${providerValue}"`);
    }
  });

  it('publishes the winner time only, and never a gap (C-8)', async () => {
    const result = resultOf((await fetchResults()).outcome);

    expect(entryAt(result, 0)).toMatchObject({
      position: 1,
      status: 'finished',
      laps: WINNER_LAPS,
      elapsedTimeMillis: WINNER_MILLIS,
      lapsBehind: null,
      points: 25,
      gridPosition: 3,
    });
    expect(entryAt(result, 1)).toMatchObject({
      position: 2,
      status: 'finished',
      elapsedTimeMillis: null,
      lapsBehind: null,
    });
    for (const entry of result.entries) {
      expect(entry.gapToLeaderMillis).toBeNull();
      expect(entry.gapText).toBeNull();
      expect(entry.dnfReason).toBeNull();
    }
    // The provider's display time text never reaches the document.
    expect(JSON.stringify(result)).not.toMatch(/\+4\.321|\+2\.000|1:30:00/);
  });

  it('derives lapsBehind exactly for classified lapped rows only (C-3)', async () => {
    const result = resultOf((await fetchResults()).outcome);

    expect(entryAt(result, 2)).toMatchObject({
      position: 3,
      status: 'lapped',
      laps: WINNER_LAPS - 1,
      lapsBehind: 1,
      elapsedTimeMillis: null,
      gapToLeaderMillis: null,
    });
    expect(
      result.entries
        .filter((entry) => entry.lapsBehind !== null)
        .map((entry) => entry.position),
    ).toEqual([3, 4]);
  });

  it('keeps a Lapped row displayed as R classified and lapped, never retired (C-2)', async () => {
    const result = resultOf((await fetchResults()).outcome);

    expect(entryAt(result, 3)).toEqual({
      driverId: baseDrivers()[3],
      constructorId: entryAt(result, 3).constructorId,
      position: 4,
      gridPosition: 4,
      points: 12,
      status: 'lapped',
      laps: WINNER_LAPS - 9,
      elapsedTimeMillis: null,
      gapToLeaderMillis: null,
      lapsBehind: 9,
      fastestLap: false,
      dnfReason: null,
      gapText: null,
    });
    // The display token is never copied into the contract.
    expect(JSON.stringify(result)).not.toContain('"R"');
  });

  it('keeps a classified retirement with its position and no time (C-4)', async () => {
    const result = resultOf((await fetchResults()).outcome);

    expect(entryAt(result, 4)).toMatchObject({
      driverId: baseDrivers()[4],
      position: 5,
      status: 'dnf',
      laps: WINNER_LAPS - 3,
      elapsedTimeMillis: null,
      gapToLeaderMillis: null,
      lapsBehind: null,
    });
  });

  it('keeps an unclassified retirement as an unpositioned dnf row', async () => {
    const result = resultOf((await fetchResults()).outcome);

    expect(entryAt(result, 5)).toMatchObject({
      position: null,
      status: 'dnf',
      laps: 10,
      gridPosition: 6,
    });
  });

  it('keeps both DNS rows, with a positive grid preserved and 0 as null (C-6)', async () => {
    const result = resultOf((await fetchResults()).outcome);

    expect(entryAt(result, 6)).toMatchObject({
      driverId: baseDrivers()[6],
      position: null,
      status: 'dns',
      laps: 0,
      gridPosition: 7,
      points: 0,
    });
    expect(entryAt(result, 7)).toMatchObject({
      driverId: baseDrivers()[7],
      position: null,
      status: 'dns',
      laps: 0,
      gridPosition: null,
    });
    expect(
      result.entries.filter((entry) => entry.status === 'dns'),
    ).toHaveLength(2);
  });

  for (const [name, grid] of [
    ['an empty grid', ''],
    ['an absent grid', undefined],
  ] as const) {
    it(`normalizes ${name} on a DNS row to null (C-6)`, async () => {
      const run = await withRows((rows) => {
        rows[6] = resultRow({
          driverId: (rows[6]?.Driver as { driverId: string }).driverId,
          constructorId: (rows[6]?.Constructor as { constructorId: string })
            .constructorId,
          position: '7',
          positionText: 'W',
          status: 'Did not start',
          grid,
          laps: '0',
        });
      });
      expect(entryAt(resultOf(run.outcome), 6)).toMatchObject({
        status: 'dns',
        gridPosition: null,
      });
    });
  }

  it('attributes the session fastest lap from the rank-1 block, exactly (C-7)', async () => {
    const result = resultOf((await fetchResults()).outcome);

    expect(result.fastestLap).toEqual({
      driverId: baseDrivers()[1],
      timeMillis: 80_987,
      lap: 44,
    });
    expect(result.entries.map((entry) => entry.fastestLap)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('keeps the rank-1 lap and driver when its time is absent (C-7)', async () => {
    const run = await withRows((rows) => {
      (rows[1] as Record<string, unknown>).FastestLap = {
        rank: '1',
        lap: '44',
      };
    });
    expect(resultOf(run.outcome).fastestLap).toEqual({
      driverId: baseDrivers()[1],
      timeMillis: null,
      lap: 44,
    });
  });

  it('states nothing about the fastest lap when no row carries a block', async () => {
    const run = await withRows((rows) => {
      for (const row of rows) delete row.FastestLap;
    });
    const result = resultOf(run.outcome);
    expect(result.fastestLap).toBeNull();
    expect(result.entries.every((entry) => entry.fastestLap === null)).toBe(
      true,
    );
  });

  it('parses the observed fastest-lap grammar into exact milliseconds', () => {
    expect(parseFastestLapTime('1:20.987')).toBe(80_987);
    expect(parseFastestLapTime('0:59.999')).toBe(59_999);
    expect(parseFastestLapTime('9:00.001')).toBe(540_001);
    for (const malformed of [
      '1:20.98',
      '1:20.9870',
      '80.987',
      '01:20.987',
      '1:60.000',
      '1:2.987',
      ' 1:20.987',
      '1:20,987',
      '',
      80_987,
      null,
    ]) {
      expect(parseFastestLapTime(malformed), String(malformed)).toBeNull();
    }
  });

  it('accepts fractional points without coercion', async () => {
    const run = await withRows((rows) => {
      (rows[2] as Record<string, unknown>).points = '7.5';
    });
    expect(entryAt(resultOf(run.outcome), 2).points).toBe(7.5);
  });

  it('produces no participation span, season entry or hasResults value', async () => {
    const { outcome } = await fetchResults();
    if (outcome.outcome !== 'candidate') throw new Error('no candidate');

    expect(Object.keys(outcome.payload).sort()).toEqual(['kind', 'result']);
    expect(Object.keys(resultOf(outcome)).sort()).toEqual(
      [
        'entries',
        'fastestLap',
        'grandPrixId',
        'id',
        'round',
        'season',
        'sessionType',
        'status',
      ].sort(),
    );
    const serialized = JSON.stringify(outcome.payload);
    for (const absent of [
      'driverEntries',
      'constructorEntries',
      'startRound',
      'endRound',
      'hasResults',
    ]) {
      expect(serialized).not.toContain(absent);
    }
  });

  it('carries no provider-descriptive value', async () => {
    const serialized = JSON.stringify(resultOf((await fetchResults()).outcome));
    for (const marker of syntheticResultMarkers) {
      expect(serialized).not.toContain(marker);
    }
    expect(serialized).not.toContain('999');
    expect(serialized).not.toContain('1900-01-01');
  });

  it('is selected, counted once and attributed to results through the coordinator', async () => {
    const harness = resultsHarness();
    const run = await new MultiSourceCoordinator({
      ports: [harness.port],
      logger: new CapturingLogger(),
    }).coordinate({ plan: { season: SEASON, resources: [RACE] } });

    expect(coordinationFor(run, RACE)?.selection.outcome).toBe('selected');
    expect(run.accounting.lifetime).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(run.accounting.byJobCategory).toEqual({
      results: { total: 1, successful: 1, failed: 0, rateLimited: 0 },
    });
  });
});

describe('resource refusal and request control', () => {
  it('refuses every other resource before any reservation, request or attempt', async () => {
    for (const kind of coordinatedResourceKinds) {
      if (kind === 'session-classification') continue;
      const resource = (
        kind === 'event-schedule'
          ? { kind, season: SEASON, round: ROUND }
          : { kind, season: SEASON }
      ) as CoordinatedResource;
      const harness = resultsHarness();
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

  it('refuses every non-race session type before any reservation, request or attempt', async () => {
    for (const sessionType of ['qualifying', 'sprint', 'sprint_qualifying']) {
      const harness = resultsHarness();
      const outcome = await harness.port.fetchResource({
        source: 'jolpica',
        resource: { ...RACE, sessionType } as CoordinatedResource,
      });

      expect(outcome, sessionType).toEqual({
        outcome: 'not-attempted',
        reason: 'resource-unsupported',
      });
      expect(harness.calls, sessionType).toHaveLength(0);
      expect(harness.reservations, sessionType).toHaveLength(0);
    }
  });

  it('refuses a cancellation before reserving capacity', async () => {
    const controller = new AbortController();
    controller.abort();
    const { outcome, calls, reservations } = await fetchResults(
      {},
      controller.signal,
    );

    expect(outcome).toEqual({ outcome: 'not-attempted', reason: 'cancelled' });
    expect(calls).toHaveLength(0);
    expect(reservations).toHaveLength(0);
  });

  it('keeps a limiter deferral not attempted', async () => {
    const { outcome, calls } = await fetchResults({ limiter: ['deferred'] });

    expect(outcome.outcome).toBe('not-attempted');
    expect(outcome.outcome === 'not-attempted' && outcome.reason).toBe(
      'rate-limit-deferred',
    );
    expect(calls).toHaveLength(0);
  });

  it('keeps an unavailable limiter not attempted', async () => {
    const { outcome, calls } = await fetchResults({ limiter: ['unavailable'] });

    expect(outcome).toEqual({
      outcome: 'not-attempted',
      reason: 'limiter-unavailable',
    });
    expect(calls).toHaveLength(0);
  });

  it('reports a transport failure as one failed attempt, without retrying', async () => {
    const { outcome, calls } = await fetchResults({
      steps: [{ kind: 'network' }, { kind: 'network' }],
    });

    expect(outcome.outcome === 'failed' && outcome.reason).toBe(
      'provider-unavailable',
    );
    expect(attemptOutcomes(outcome)).toEqual(['failed']);
    expect(calls).toHaveLength(1);
  });

  it('reports a provider 429 with its retry instruction', async () => {
    const { outcome, calls } = await fetchResults({
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

describe('an answer with no classification (C-9)', () => {
  it('is provider-unavailable over one successful attempt, with no document', async () => {
    const run = await withBody(emptyResultsEnvelope());

    expect(run.outcome).toEqual({
      outcome: 'failed',
      attempts: [expect.objectContaining({ outcome: 'successful' })],
      reason: 'provider-unavailable',
    });
    expect(isWellFormedOutcome(run.outcome)).toBe(true);
    expect(run.calls).toHaveLength(1);
    expect(
      run.logger.events.some(
        (event) => event.operation === 'provider.results.no_classification',
      ),
    ).toBe(true);
  });

  it('refuses an empty race list whose total claims rows', async () => {
    expectInvalid(
      await withBody(resultsEnvelope([], { races: [], total: '3' })),
      'incomplete-page',
    );
  });

  it('refuses a listed race with no rows rather than publishing it empty', async () => {
    expectInvalid(
      await withBody(resultsEnvelope([], { total: '0' })),
      'result-collection',
    );
  });

  it('counts the empty answer once and selects nothing through the coordinator', async () => {
    const harness = resultsHarness({
      steps: [{ kind: 'json', body: emptyResultsEnvelope() }],
    });
    const run = await new MultiSourceCoordinator({
      ports: [harness.port],
      logger: new CapturingLogger(),
    }).coordinate({ plan: { season: SEASON, resources: [RACE] } });

    expect(coordinationFor(run, RACE)?.selection.outcome).toBe('unavailable');
    expect(run.accounting.lifetime).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(
      coordinationFor(run, RACE)?.contributions.find(
        (entry) => entry.source === 'jolpica',
      ),
    ).toMatchObject({
      status: 'failed',
      attempted: true,
      reason: 'provider-unavailable',
      payload: null,
    });
  });
});

describe('the status table is closed (C-5)', () => {
  it('holds exactly the six observed pairs', () => {
    expect(
      resultStatusTable.map(
        (entry) => `${entry.status}|${entry.positionText}|${entry.rowClass}`,
      ),
    ).toEqual([
      'Finished|numeric|finished',
      'Lapped|numeric|lapped',
      'Lapped|R|lapped-display-retired',
      'Retired|numeric|retired-classified',
      'Retired|R|retired',
      'Did not start|W|did-not-start',
    ]);
  });

  const unapproved: readonly [string, string][] = [
    ['Disqualified', 'D'],
    ['Excluded', 'E'],
    ['Did not qualify', 'F'],
    ['Not classified', 'N'],
    ['Finished', 'R'],
    ['Retired', 'W'],
    ['Did not start', 'R'],
    ['Did not start', '6'],
    ['+1 Lap', '6'],
    ['Engine', 'R'],
    ['finished', '6'],
    ['Finished ', '6'],
  ];
  for (const [status, positionText] of unapproved) {
    it(`fails the whole resource on ${JSON.stringify(status)} / ${positionText}`, async () => {
      const run = await withRows((rows) => {
        const row = rows[5] as Record<string, unknown>;
        row.status = status;
        row.positionText = positionText;
        delete row.FastestLap;
      });
      expectInvalid(run, 'status');
    });
  }

  it('refuses a numeric positionText that contradicts the position', async () => {
    expectInvalid(
      await withRows((rows) => {
        (rows[2] as Record<string, unknown>).positionText = '4';
      }),
      'status',
    );
  });
});

describe('an invalid payload fails the whole resource', () => {
  const envelopeCases: readonly [string, ResultsEnvelopeOptions, string][] = [
    ['a different limit', { limit: '30' }, 'pagination'],
    ['a non-zero offset', { offset: '1' }, 'pagination'],
    ['a numeric limit', { limit: 100 }, 'pagination'],
    ['a padded total', { total: ' 8' }, 'pagination'],
    ['a signed total', { total: '+8' }, 'pagination'],
    ['a missing total', { total: undefined }, 'pagination'],
    ['a total beyond the page', { total: '101' }, 'incomplete-page'],
    ['a total above the rows', { total: '9' }, 'incomplete-page'],
    ['a total below the rows', { total: '7' }, 'incomplete-page'],
    ['a table for another season', { season: '2025' }, 'season-mismatch'],
    ['a table for another round', { round: '2' }, 'round-mismatch'],
    ['a table without a round', { round: undefined }, 'round-mismatch'],
    ['a race for another season', { raceSeason: '2025' }, 'season-mismatch'],
    ['a race for another round', { raceRound: '2' }, 'round-mismatch'],
    ['a padded race round', { raceRound: '01' }, 'round-mismatch'],
    ['a race list that is not a list', { races: {} }, 'race-collection'],
    ['an empty race name', { raceName: '' }, 'race-name'],
    ['a missing circuit id', { circuitId: undefined }, 'circuit-id'],
  ];
  for (const [name, options, problem] of envelopeCases) {
    it(`refuses ${name}`, async () => {
      expectInvalid(
        await withBody(resultsEnvelope(baseRows(), options)),
        problem,
      );
    });
  }

  it('refuses more than one race', async () => {
    const one = resultsEnvelope(baseRows());
    const races = (
      (one.MRData as Record<string, unknown>).RaceTable as Record<
        string,
        unknown[]
      >
    ).Races as unknown[];
    expectInvalid(
      await withBody(
        resultsEnvelope(baseRows(), { races: [races[0], races[0]] }),
      ),
      'race-collection',
    );
  });

  const rowCases: readonly [
    string,
    (rows: Record<string, unknown>[]) => unknown,
    string,
  ][] = [
    [
      'a duplicate driver row',
      (rows) => {
        (rows[7]?.Driver as Record<string, unknown>).driverId = (
          rows[6]?.Driver as Record<string, unknown>
        ).driverId;
      },
      'duplicate-driver',
    ],
    [
      'a duplicate position',
      (rows) => {
        (rows[7] as Record<string, unknown>).position = '7';
      },
      'duplicate-position',
    ],
    [
      'a duplicate fastest-lap rank',
      (rows) => {
        (rows[2]?.FastestLap as Record<string, unknown>).rank = '1';
      },
      'duplicate-fastest-lap-rank',
    ],
    [
      'positions that are not 1..n',
      (rows) => {
        (rows[7] as Record<string, unknown>).position = '9';
      },
      'position',
    ],
    [
      'a classified row ranked below an unclassified one',
      (rows) => {
        const retired = rows[5] as Record<string, unknown>;
        const classified = rows[4] as Record<string, unknown>;
        retired.position = '5';
        classified.position = '6';
        classified.positionText = '6';
      },
      'position',
    ],
    [
      'a zero position',
      (rows) => {
        (rows[7] as Record<string, unknown>).position = '0';
      },
      'position',
    ],
    [
      'a winner that did not finish',
      (rows) => {
        (rows[0] as Record<string, unknown>).status = 'Lapped';
      },
      'winner',
    ],
    [
      'a winner without a race time',
      (rows) => {
        delete (rows[0] as Record<string, unknown>).Time;
      },
      'winner',
    ],
    [
      'a finisher short of the winner laps',
      (rows) => {
        (rows[1] as Record<string, unknown>).laps = String(WINNER_LAPS - 1);
      },
      'laps',
    ],
    [
      'a lapped row on the winner lap',
      (rows) => {
        (rows[2] as Record<string, unknown>).laps = String(WINNER_LAPS);
      },
      'laps',
    ],
    [
      'a row with more laps than the winner',
      (rows) => {
        (rows[5] as Record<string, unknown>).laps = String(WINNER_LAPS + 1);
      },
      'laps',
    ],
    [
      'malformed laps',
      (rows) => {
        (rows[5] as Record<string, unknown>).laps = '1.5';
      },
      'laps',
    ],
    [
      'a race time on a DNS row',
      (rows) => {
        (rows[6] as Record<string, unknown>).Time = {
          millis: '1',
          time: '',
        };
      },
      'time',
    ],
    [
      'a race time on an unclassified retirement',
      (rows) => {
        (rows[5] as Record<string, unknown>).Time = {
          millis: '1',
          time: '',
        };
      },
      'time',
    ],
    [
      'malformed race-time millis',
      (rows) => {
        (rows[2]?.Time as Record<string, unknown>).millis = '5400000.5';
      },
      'time',
    ],
    [
      'a negative grid slot',
      (rows) => {
        (rows[6] as Record<string, unknown>).grid = '-1';
      },
      'grid',
    ],
    [
      'a padded grid slot',
      (rows) => {
        (rows[6] as Record<string, unknown>).grid = '07';
      },
      'grid',
    ],
    [
      'a signed points value',
      (rows) => {
        (rows[0] as Record<string, unknown>).points = '-25';
      },
      'points',
    ],
    [
      'an exponent points value',
      (rows) => {
        (rows[0] as Record<string, unknown>).points = '2.5e1';
      },
      'points',
    ],
    [
      'a missing points value',
      (rows) => {
        delete (rows[0] as Record<string, unknown>).points;
      },
      'points',
    ],
    [
      'a fastest lap on a DNS row',
      (rows) => {
        (rows[6] as Record<string, unknown>).FastestLap = {
          rank: '7',
          lap: '1',
        };
      },
      'fastest-lap',
    ],
    [
      'a fastest lap beyond the laps completed',
      (rows) => {
        (rows[5]?.FastestLap as Record<string, unknown>).lap = '11';
      },
      'fastest-lap',
    ],
    [
      'a fastest lap without a rank',
      (rows) => {
        delete (rows[2]?.FastestLap as Record<string, unknown>).rank;
      },
      'fastest-lap',
    ],
    [
      'a malformed fastest-lap time (C-7)',
      (rows) => {
        (rows[1]?.FastestLap as Record<string, unknown>).Time = {
          time: '1:20.98',
        };
      },
      'fastest-lap-time',
    ],
    [
      'a fastest-lap time block without text',
      (rows) => {
        (rows[1]?.FastestLap as Record<string, unknown>).Time = {};
      },
      'fastest-lap-time',
    ],
    [
      'a fastest-lap time given only as millis',
      (rows) => {
        (rows[1]?.FastestLap as Record<string, unknown>).Time = {
          millis: '80987',
        };
      },
      'fastest-lap-time',
    ],
    [
      'fastest-lap blocks with no rank-1 lap',
      (rows) => {
        (rows[1]?.FastestLap as Record<string, unknown>).rank = '7';
      },
      'fastest-lap-unattributed',
    ],
    [
      'a row that is not an object',
      (rows) => {
        rows[3] = 'row' as unknown as Record<string, unknown>;
      },
      'result-row',
    ],
    [
      'a row without a driver identity',
      (rows) => {
        delete (rows[3]?.Driver as Record<string, unknown>).driverId;
      },
      'identity',
    ],
  ];
  for (const [name, edit, problem] of rowCases) {
    it(`refuses ${name}`, async () => {
      expectInvalid(await withRows(edit), problem);
    });
  }

  it('refuses two provider drivers resolving to one canonical driver', async () => {
    const [first, second] = providerDrivers(2);
    const registry = editedRegistry((document) => {
      const target = document.mappings.find(
        (mapping) => mapping.providerValue === first,
      );
      const other = document.mappings.find(
        (mapping) => mapping.providerValue === second,
      );
      if (target === undefined || other === undefined)
        throw new Error('fixture');
      (other as { gridviewId: string }).gridviewId = target.gridviewId;
    });
    const run = await fetchResults({ registry });
    expectInvalid(run, 'duplicate-canonical-driver');
  });
});

describe('identity resolution fails the whole resource and drops no row', () => {
  const expectMappingFailure = (run: Run) => {
    expect(run.outcome.outcome).toBe('mapping-failure');
    expect(attemptOutcomes(run.outcome)).toEqual(['successful']);
    expect('payload' in run.outcome).toBe(false);
    expect(run.calls).toHaveLength(1);
    expect(isWellFormedOutcome(run.outcome)).toBe(true);
  };

  it('refuses an unmapped driver', async () => {
    expectMappingFailure(
      await withRows((rows) => {
        (rows[6]?.Driver as Record<string, unknown>).driverId =
          'synthetic_unmapped_driver';
      }),
    );
  });

  it('refuses an unmapped constructor', async () => {
    expectMappingFailure(
      await withRows((rows) => {
        (rows[7]?.Constructor as Record<string, unknown>).constructorId =
          'synthetic_unmapped_constructor';
      }),
    );
  });

  it('refuses an event locator that is not the curated one for the round', async () => {
    const other = locatorFor(2);
    expectMappingFailure(
      await withBody(
        resultsEnvelope(baseRows(), {
          raceName: other.raceName,
          circuitId: other.circuitId,
        }),
      ),
    );
  });

  it('refuses a provider driver whose curated mapping was removed', async () => {
    const [first] = providerDrivers(1);
    const registry: ProviderMappingRegistry = editedRegistry((document) => {
      document.mappings = document.mappings.filter(
        (mapping) => mapping.providerValue !== first,
      );
    });
    expectMappingFailure(await fetchResults({ registry }));
  });

  it('counts a mapping failure once through the coordinator', async () => {
    const harness = resultsHarness({
      steps: [
        {
          kind: 'json',
          body: resultsEnvelope(
            baseRows().map((row, index) =>
              index === 0
                ? {
                    ...row,
                    Driver: { driverId: 'synthetic_unmapped_driver' },
                  }
                : row,
            ),
          ),
        },
      ],
    });
    const run = await new MultiSourceCoordinator({
      ports: [harness.port],
      logger: new CapturingLogger(),
    }).coordinate({ plan: { season: SEASON, resources: [RACE] } });

    expect(coordinationFor(run, RACE)?.selection.outcome).toBe('unavailable');
    expect(run.accounting.lifetime).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(
      coordinationFor(run, RACE)?.contributions.find(
        (entry) => entry.source === 'jolpica',
      ),
    ).toMatchObject({
      status: 'failed',
      attempted: true,
      reason: 'mapping-unresolved',
      payload: null,
    });
  });

  it('counts an invalid payload once through the coordinator', async () => {
    const harness = resultsHarness({
      steps: [
        { kind: 'json', body: resultsEnvelope(baseRows(), { total: '9' }) },
      ],
    });
    const run = await new MultiSourceCoordinator({
      ports: [harness.port],
      logger: new CapturingLogger(),
    }).coordinate({ plan: { season: SEASON, resources: [RACE] } });

    expect(run.accounting.lifetime).toEqual({
      total: 1,
      successful: 1,
      failed: 0,
      rateLimited: 0,
    });
    expect(
      coordinationFor(run, RACE)?.contributions.find(
        (entry) => entry.source === 'jolpica',
      ),
    ).toMatchObject({
      status: 'failed',
      attempted: true,
      reason: 'invalid-payload',
      payload: null,
    });
  });
});

describe('hostile payloads are contained after the attempt is established', () => {
  it('refuses an accessor that throws during decode, without invoking it', async () => {
    let invoked = false;
    const run = await fetchResults({
      successData: () => {
        const body = resultsEnvelope(baseRows());
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
    const run = await fetchResults({
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
    const run = await fetchResults({ registry });
    expectInvalid(run, 'normalization');
  });

  it('refuses an identity inherited from the prototype', async () => {
    const run = await withRows((rows) => {
      const driverId = (rows[0]?.Driver as Record<string, unknown>).driverId;
      (rows[0] as Record<string, unknown>).Driver = Object.create({ driverId });
    });
    expectInvalid(run, 'identity');
  });

  it('refuses a result collection with a hole', async () => {
    const rows: unknown[] = baseRows();
    delete rows[3];
    const run = await fetchResults({
      successData: () => resultsEnvelope(rows),
    });
    expectInvalid(run, 'result-row');
  });
});
