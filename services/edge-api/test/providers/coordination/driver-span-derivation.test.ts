/**
 * Assembly-owned driver participation spans (ADR 0026 D3-D8, D11, D12 item 11).
 *
 * The first half drives the pure derivation with hand-written classifications,
 * one rule at a time. The second half drives the **production path** - the
 * real coordinator, `assembleSeasonSource`, the integrity preflight and the
 * real publisher with its runtime snapshot validator - over the synthetic
 * split season, whose participants contribution carries no spans at all.
 * Nothing here is provider data and nothing reaches a network.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  canonicalGrandPrixId,
  canonicalRaceResultId,
} from '../../../src/contract/identity';
import { validateDriverSeasonEntry } from '../../../src/contract/normalized';
import type {
  DriverSeasonEntry,
  RaceResult,
  RaceResultEntry,
} from '../../../src/contract/types';
import type { FinishStatus, ResultStatus } from '../../../src/contract/enums';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  deriveDriverSeasonEntries,
  validateSeasonReferences,
  type CoordinationRun,
  type SeasonAssembly,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  FakePort,
  FIXED_NOW,
  SEASON,
  attempt,
  completePort,
  fullPlan,
  metadataFor,
  payloadFor,
  publicationHarness,
  testOnlyProvisionalBound,
} from './support';
import {
  splitEntry,
  splitRow,
  splitSeasonFixture,
  withRoundRows,
} from './split-participation-support';

// --- Pure derivation --------------------------------------------------------

type Row = readonly [driverId: string, constructorId: string, FinishStatus?];

function row([driverId, constructorId, status]: Row): RaceResultEntry {
  return {
    ...splitRow(driverId, constructorId, 1),
    status: status ?? 'finished',
  };
}

/** A hand-written classification. Only its round, type, status and rows matter. */
function classification(
  round: number,
  rows: readonly Row[],
  options: {
    sessionType?: RaceResult['sessionType'];
    status?: ResultStatus;
  } = {},
): RaceResult {
  const sessionType = options.sessionType ?? 'race';
  const grandPrixId = canonicalGrandPrixId(SEASON, `event-${round}`);
  return {
    id: canonicalRaceResultId(grandPrixId, sessionType),
    season: SEASON,
    round,
    grandPrixId,
    sessionType,
    status: options.status ?? 'final',
    entries: rows.map(row),
    fastestLap: null,
  };
}

function derive(
  calendarRounds: readonly number[],
  classifications: readonly RaceResult[],
): DriverSeasonEntry[] {
  const derivation = deriveDriverSeasonEntries(
    SEASON,
    calendarRounds,
    classifications,
  );
  if (derivation.outcome !== 'derived') {
    throw new Error(`not derived: ${JSON.stringify(derivation)}`);
  }
  return derivation.entries;
}

/** Spans as `[id, constructorId, startRound, endRound]`, for compact assertions. */
function spans(entries: readonly DriverSeasonEntry[]) {
  return entries.map((entry) => [
    entry.id,
    entry.constructorId,
    entry.startRound,
    entry.endRound,
  ]);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

describe('deriveDriverSeasonEntries', () => {
  it('keeps one uninterrupted seat as one open span from the season start', () => {
    const entries = derive(
      [1, 2, 3],
      [1, 2, 3].map((round) => classification(round, [['ada', 'alpha']])),
    );

    expect(entries).toEqual([
      {
        id: '2026-ada',
        season: SEASON,
        driverId: 'ada',
        constructorId: 'alpha',
        raceNumber: null,
        role: 'race',
        shortCode: null,
        startRound: null,
        endRound: null,
      },
    ]);
  });

  it('closes a span on a direct constructor change and opens a suffixed one', () => {
    const entries = derive(
      [1, 2, 3, 4],
      [
        classification(1, [['ada', 'alpha']]),
        classification(2, [['ada', 'alpha']]),
        classification(3, [['ada', 'beta']]),
        classification(4, [['ada', 'beta']]),
      ],
    );

    expect(spans(entries)).toEqual([
      ['2026-ada', 'alpha', null, 2],
      ['2026-ada-3', 'beta', 3, null],
    ]);
  });

  it('closes a span at the last observed round when the driver disappears', () => {
    const entries = derive(
      [1, 2, 3],
      [
        classification(1, [
          ['ada', 'alpha'],
          ['bea', 'alpha'],
        ]),
        classification(2, [
          ['ada', 'alpha'],
          ['bea', 'alpha'],
        ]),
        classification(3, [['ada', 'alpha']]),
      ],
    );

    expect(spans(entries)).toEqual([
      ['2026-ada', 'alpha', null, null],
      ['2026-bea', 'alpha', null, 2],
    ]);
  });

  it('suffixes a first appearance after the season start (D7)', () => {
    const entries = derive(
      [1, 2, 3],
      [
        classification(1, [['ada', 'alpha']]),
        classification(2, [
          ['ada', 'alpha'],
          ['cy', 'beta'],
        ]),
        classification(3, [
          ['ada', 'alpha'],
          ['cy', 'beta'],
        ]),
      ],
    );

    expect(spans(entries)).toEqual([
      ['2026-ada', 'alpha', null, null],
      ['2026-cy-2', 'beta', 2, null],
    ]);
  });

  it('never bridges an absence, even for a same-constructor return', () => {
    const entries = derive(
      [1, 2, 3, 4],
      [
        classification(1, [['ada', 'alpha']]),
        classification(2, [['ada', 'alpha']]),
        classification(3, [['bea', 'alpha']]),
        classification(4, [
          ['ada', 'alpha'],
          ['bea', 'alpha'],
        ]),
      ],
    );

    expect(spans(entries)).toEqual([
      ['2026-ada', 'alpha', null, 2],
      ['2026-ada-4', 'alpha', 4, null],
      ['2026-bea-3', 'alpha', 3, null],
    ]);
  });

  it('counts a did-not-start row, and every other finishing status, as participation', () => {
    const entries = derive(
      [1, 2],
      [
        classification(1, [
          ['ada', 'alpha', 'dns'],
          ['bea', 'alpha', 'dsq'],
        ]),
        classification(2, [['ada', 'alpha', 'dnf']]),
      ],
    );

    expect(spans(entries)).toEqual([
      ['2026-ada', 'alpha', null, null],
      ['2026-bea', 'alpha', null, 1],
    ]);
  });

  it('derives nothing from sprint, qualifying or unavailable classifications', () => {
    const entries = derive(
      [1, 2],
      [
        classification(1, [['ada', 'alpha']]),
        classification(1, [['sam', 'beta']], { sessionType: 'sprint' }),
        classification(2, [['quinn', 'beta']], { sessionType: 'qualifying' }),
        classification(2, [['ada', 'alpha']]),
        classification(3, [['una', 'beta']], { status: 'unavailable' }),
      ],
    );

    expect(spans(entries)).toEqual([['2026-ada', 'alpha', null, null]]);
  });

  it('accepts a provisional race classification as an observation (D3)', () => {
    const entries = derive(
      [1, 2],
      [
        classification(1, [['ada', 'alpha']]),
        classification(2, [['ada', 'beta']], { status: 'provisional' }),
      ],
    );

    expect(spans(entries)).toEqual([
      ['2026-ada', 'alpha', null, 1],
      ['2026-ada-2', 'beta', 2, null],
    ]);
  });

  it('derives an empty collection before the first classified race (D9)', () => {
    expect(derive([1, 2], [])).toEqual([]);
    expect(
      derive([1], [classification(1, [], { status: 'unavailable' })]),
    ).toEqual([]);
  });

  it('keeps the latest observed span open however complete the calendar is', () => {
    // Round 3 is the last calendar round and it is classified: the season is
    // over, and still no later round has established an exit (D6).
    const entries = derive(
      [1, 2, 3],
      [1, 2, 3].map((round) => classification(round, [['ada', 'alpha']])),
    );

    expect(entries.map((entry) => entry.endRound)).toEqual([null]);
  });

  it('treats unclassified rounds after the latest classified one as future', () => {
    const entries = derive(
      [1, 2, 3, 4],
      [
        classification(1, [['ada', 'alpha']]),
        classification(2, [['ada', 'alpha']]),
        classification(3, [], { status: 'unavailable' }),
      ],
    );

    expect(spans(entries)).toEqual([['2026-ada', 'alpha', null, null]]);
  });

  it('refuses to bridge an unaccounted round instead of deriving across it', () => {
    const classifications = [
      classification(1, [['ada', 'alpha']]),
      classification(2, [], { status: 'unavailable' }),
      classification(3, [['ada', 'alpha']]),
    ];

    expect(
      deriveDriverSeasonEntries(SEASON, [1, 2, 3, 4], classifications),
    ).toEqual({ outcome: 'unaccounted-rounds', rounds: [2] });
    // A round with no classification document at all is unaccounted too.
    expect(
      deriveDriverSeasonEntries(
        SEASON,
        [3, 1, 2, 5, 4],
        [
          classification(1, [['ada', 'alpha']]),
          classification(4, [['ada', 'alpha']]),
        ],
      ),
    ).toEqual({ outcome: 'unaccounted-rounds', rounds: [2, 3] });
  });

  it('orders entries by driver, then start, whatever order rows arrive in', () => {
    const forward = [
      classification(1, [
        ['cy', 'beta'],
        ['ada', 'alpha'],
        ['bea', 'gamma'],
      ]),
      classification(2, [
        ['ada', 'beta'],
        ['cy', 'beta'],
        ['bea', 'gamma'],
      ]),
      classification(3, [
        ['bea', 'gamma'],
        ['ada', 'alpha'],
      ]),
    ];
    const reversed = [...forward]
      .reverse()
      .map((result) => ({ ...result, entries: [...result.entries].reverse() }));

    const expected = [
      ['2026-ada', 'alpha', null, 1],
      ['2026-ada-2', 'beta', 2, 2],
      ['2026-ada-3', 'alpha', 3, null],
      ['2026-bea', 'gamma', null, null],
      ['2026-cy', 'beta', null, 2],
    ];
    expect(spans(derive([1, 2, 3], forward))).toEqual(expected);
    expect(derive([3, 2, 1], reversed)).toEqual(derive([1, 2, 3], forward));
  });

  it('never repairs two constructors for one driver in one round', () => {
    // Contradictory input (D5 rule 9) yields overlapping spans for the driver,
    // which the integrity preflight refuses; nothing is dropped or merged.
    const entries = derive(
      [1, 2],
      [
        classification(1, [['ada', 'alpha']]),
        classification(2, [
          ['ada', 'alpha'],
          ['ada', 'beta'],
        ]),
      ],
    );

    expect(spans(entries)).toEqual([
      ['2026-ada', 'alpha', null, null],
      ['2026-ada-2', 'beta', 2, null],
    ]);
  });

  it('does not mutate its inputs', () => {
    const calendarRounds = deepFreeze([1, 2, 3]);
    const classifications = deepFreeze([
      classification(1, [['ada', 'alpha']]),
      classification(2, [['ada', 'beta', 'dns']]),
      classification(3, [['ada', 'beta']]),
    ]);
    const before = structuredClone(classifications);

    expect(() =>
      deriveDriverSeasonEntries(SEASON, calendarRounds, classifications),
    ).not.toThrow();
    expect(classifications).toEqual(before);
  });
});

// --- Production path --------------------------------------------------------

async function coordinate(
  source: ProviderSeasonSource,
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports: [completePort('jolpica', source)],
    logger: new CapturingLogger(),
  }).coordinate({ plan: fullPlan(source) });
}

async function assemble(source: ProviderSeasonSource): Promise<SeasonAssembly> {
  return assembleSeasonSource(await coordinate(source), metadataFor(source));
}

function assembled(assembly: SeasonAssembly): ProviderSeasonSource {
  if (!assembly.complete) {
    throw new Error(`not assembled: ${JSON.stringify(assembly)}`);
  }
  return assembly.source;
}

/** The split season's derived spans, exactly (D7 IDs, D8 fields, order). */
const splitSpans = [
  splitEntry('isack-hadjar', 'red-bull', null, 11),
  splitEntry('liam-lawson', 'racing-bulls', null, 11),
  splitEntry('liam-lawson', 'red-bull', 12, null),
  splitEntry('max-verstappen', 'red-bull', null, null),
  splitEntry('yuki-tsunoda', 'racing-bulls', 12, null),
];

describe('season assembly derives the driver entries', () => {
  it('derives the split season from its classifications alone', async () => {
    const source = await splitSeasonFixture();
    // The contribution carries no span: `payloadFor` sends an empty list.
    const participants = payloadFor(source, {
      kind: 'season-participants',
      season: SEASON,
    });
    expect(participants).toMatchObject({ driverEntries: [] });

    const result = assembled(await assemble(source));

    // Verstappen one open span from round 1; Hadjar gone after round 11;
    // Lawson's direct change at round 12; Tsunoda's first appearance at 12.
    // Round 14 is unclassified and future, so the round-13 spans stay open.
    expect(result.driverEntries).toEqual(splitSpans);
  });

  it('gives an identity-only driver no entry', async () => {
    const source = await splitSeasonFixture();
    const raced = new Set(
      source.results.flatMap((result) =>
        result.entries.map((entry) => entry.driverId),
      ),
    );
    const identityOnly = source.drivers.filter(
      (driver) => !raced.has(driver.id),
    );
    expect(identityOnly.length).toBeGreaterThan(0);

    const result = assembled(await assemble(source));

    expect(result.drivers).toEqual(source.drivers);
    for (const driver of identityOnly) {
      expect(result.driverEntries.map((entry) => entry.driverId)).not.toContain(
        driver.id,
      );
    }
  });

  it('opens a new span for a same-constructor return after an absence', async () => {
    // Hadjar sits out rounds 12 and returns to red-bull at round 13.
    const source = withRoundRows(await splitSeasonFixture(), 13, (entries) => [
      ...entries,
      splitRow('isack-hadjar', 'red-bull', entries.length + 1),
    ]);

    const result = assembled(await assemble(source));

    expect(
      result.driverEntries.filter((entry) => entry.driverId === 'isack-hadjar'),
    ).toEqual([
      splitEntry('isack-hadjar', 'red-bull', null, 11),
      splitEntry('isack-hadjar', 'red-bull', 13, null),
    ]);
  });

  it('counts a did-not-start row as participation', async () => {
    // Tsunoda's only round-13 row is a non-start; his span still reaches 13.
    const source = withRoundRows(await splitSeasonFixture(), 13, (entries) =>
      entries.map((entry) =>
        entry.driverId === 'yuki-tsunoda'
          ? { ...entry, position: null, status: 'dns' as const }
          : entry,
      ),
    );

    const result = assembled(await assemble(source));

    expect(result.driverEntries).toContainEqual(
      splitEntry('yuki-tsunoda', 'racing-bulls', 12, null),
    );
  });

  it('never closes the latest observed span on a completed calendar', async () => {
    // Every calendar round is completed and classified: the season is over.
    const base = await splitSeasonFixture();
    const calendar = base.calendar.map((event) => ({
      ...event,
      status: 'completed' as const,
      hasResults: true,
    }));
    const round13 = base.results.find((result) => result.round === 13)!;
    const results = base.results.map((result) =>
      result.round === 14
        ? { ...result, status: 'final' as const, entries: round13.entries }
        : result,
    );

    const result = assembled(await assemble({ ...base, calendar, results }));

    expect(
      result.driverEntries.filter((entry) => entry.endRound === null),
    ).toEqual([
      splitEntry('liam-lawson', 'red-bull', 12, null),
      splitEntry('max-verstappen', 'red-bull', null, null),
      splitEntry('yuki-tsunoda', 'racing-bulls', 12, null),
    ]);
  });

  it('assembles the same entries whatever order rows arrive in', async () => {
    const base = await splitSeasonFixture();
    const shuffled = {
      ...base,
      results: base.results.map((result) => ({
        ...result,
        entries: [...result.entries].reverse(),
      })),
    };

    expect(assembled(await assemble(shuffled)).driverEntries).toEqual(
      assembled(await assemble(base)).driverEntries,
    );
  });

  it('withholds rather than bridging an unaccounted round', async () => {
    // Round 11 has no classification while rounds 12 and 13 do: deriving would
    // bridge it. Its calendar status is no excuse - not even `cancelled`,
    // since no curated cancellation record exists (D4).
    for (const status of ['unknown', 'cancelled'] as const) {
      const base = await splitSeasonFixture();
      const source = {
        ...base,
        calendar: base.calendar.map((event) =>
          event.round === 11 ? { ...event, status, hasResults: false } : event,
        ),
        results: base.results.map((result) =>
          result.round === 11
            ? { ...result, status: 'unavailable' as const, entries: [] }
            : result,
        ),
      };

      const assembly = await assemble(source);

      expect(assembly).toEqual({
        complete: false,
        gap: 'missing-round-classification',
        missing: [
          {
            kind: 'session-classification',
            season: SEASON,
            round: 11,
            sessionType: 'race',
          },
        ],
        relations: [],
      });
    }
  });

  it('refuses a global entry-ID collision across drivers (D12 item 11)', async () => {
    // A driver whose ID ends in a numeric segment, racing from round 1, has
    // the base ID `2026-yuki-tsunoda-12` - the same ID D7 gives Tsunoda's
    // round-12 span. Neither entry is dropped, merged or renamed.
    const base = await splitSeasonFixture();
    const template = base.drivers.find(
      (driver) => driver.id === 'yuki-tsunoda',
    )!;
    const source = withRoundRows(
      {
        ...base,
        drivers: [...base.drivers, { ...template, id: 'yuki-tsunoda-12' }],
      },
      1,
      (entries) => [...entries, splitRow('yuki-tsunoda-12', 'red-bull', 4)],
    );
    const withRound11 = withRoundRows(source, 11, (entries) => [
      ...entries,
      splitRow('yuki-tsunoda-12', 'red-bull', 4),
    ]);

    const assembly = await assemble(withRound11);

    expect(assembly.complete).toBe(false);
    if (!assembly.complete) {
      expect(assembly.gap).toBe('inconsistent-references');
      expect(assembly.relations).toEqual(['duplicate-identity']);
    }
    // The derivation itself kept both entries, colliding IDs and all.
    const derivation = deriveDriverSeasonEntries(
      SEASON,
      withRound11.calendar.map((event) => event.round),
      withRound11.results,
    );
    expect(
      derivation.outcome === 'derived' &&
        derivation.entries.filter(
          (entry) => entry.id === '2026-yuki-tsunoda-12',
        ).length,
    ).toBe(2);
  });

  it('withholds a participants contribution that carries any span', async () => {
    // Even the exact spans assembly would derive: the contribution is not
    // participation evidence (D11), and nothing it carries is discarded.
    const source = await splitSeasonFixture();
    const port = new FakePort('jolpica', (request) => {
      const payload = payloadFor(source, request.resource)!;
      return {
        outcome: 'candidate',
        attempts: [attempt(`j-${request.resource.kind}`)],
        payload:
          payload.kind === 'season-participants'
            ? { ...payload, driverEntries: splitSpans }
            : payload,
      };
    });
    const run = await new MultiSourceCoordinator({
      ports: [port],
      logger: new CapturingLogger(),
    }).coordinate({ plan: fullPlan(source) });

    const assembly = assembleSeasonSource(run, metadataFor(source));

    expect(assembly.complete).toBe(false);
    if (!assembly.complete) {
      expect(assembly.gap).toBe('inconsistent-references');
      expect(assembly.relations).toContain('driver-entry-span');
    }
  });

  it('withholds a classified race selected from a source other than Jolpica', async () => {
    // ADR 0026 D3: only Jolpica rows create participation. Round 13 is
    // selected from a provisional OpenF1 fallback whose rows agree exactly
    // with the Jolpica seats, so without the refusal they would sit inside the
    // open spans and the preflight would pass.
    const source = await splitSeasonFixture();
    const round13 = source.results.find((result) => result.round === 13)!;
    const jolpica = completePort('jolpica', source);
    const reconciled = new FakePort('jolpica', (request) =>
      request.resource.kind === 'session-classification' &&
      request.resource.round === 13
        ? {
            outcome: 'failed',
            attempts: [attempt('j-13', 'failed')],
            reason: 'provider-unavailable',
          }
        : jolpica.fetchResource(request),
    );
    const openf1 = new FakePort('openf1', (request) =>
      request.resource.kind === 'session-classification' &&
      request.resource.round === 13
        ? {
            outcome: 'candidate',
            attempts: [attempt('o-13')],
            payload: {
              kind: 'session-classification',
              result: { ...round13, status: 'provisional' },
            },
          }
        : {
            outcome: 'failed',
            attempts: [attempt(`o-${request.resource.kind}`, 'failed')],
            reason: 'provider-unavailable',
          },
    );
    const run = await new MultiSourceCoordinator({
      ports: [reconciled, openf1],
      logger: new CapturingLogger(),
      provisionalSessionEndBound: testOnlyProvisionalBound,
    }).coordinate({ plan: fullPlan(source) });
    const selection = run.resources.find(
      (resource) =>
        resource.resource.kind === 'session-classification' &&
        resource.resource.round === 13,
    )?.selection;
    expect(selection).toMatchObject({ outcome: 'selected', source: 'openf1' });

    const assembly = assembleSeasonSource(run, metadataFor(source));

    expect(assembly).toEqual({
      complete: false,
      gap: 'inconsistent-references',
      missing: [],
      relations: ['result-entry-span'],
    });
  });

  it('does not mutate the selected payloads', async () => {
    const source = await splitSeasonFixture();
    const run = await coordinate(source);
    const before = structuredClone(run);

    assembled(assembleSeasonSource(run, metadataFor(source)));

    expect(run).toEqual(before);
  });

  it('publishes a candidate that passes the contract and integrity validators', async () => {
    const source = await splitSeasonFixture();
    const run = await coordinate(source);
    const result = assembled(assembleSeasonSource(run, metadataFor(source)));

    result.driverEntries.forEach((entry, index) => {
      expect(
        validateDriverSeasonEntry(entry, `driverEntries[${index}]`),
      ).toEqual([]);
    });
    expect(validateSeasonReferences(result)).toEqual([]);

    const harness = publicationHarness();
    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(run, metadataFor(source), FIXED_NOW, 'v-split');

    expect(outcome.outcome).toBe('published');
    expect(harness.publishCalls).toBe(1);
  });
});
