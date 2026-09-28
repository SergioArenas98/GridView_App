/**
 * Standings round coherence (ADR 0023 amendment A3.5).
 *
 * A candidate season may carry driver and constructor standings only when both
 * tables describe the latest selected, classified race round. Before any race
 * is classified both tables must be the source's empty answer with no round
 * stated. Anything else - a table ahead of or behind that horizon, two tables
 * that disagree, an empty table after a race was classified, rows before one
 * was - withholds the **whole** candidate as `standings-round-incoherent`.
 *
 * Every case runs the real coordinator and `assembleSeasonSource`; the
 * publication cases add the real `CoordinatedSeasonPublication` and the real
 * guarded sequenced service over both sequencer transports. The data is the
 * synthetic split season; nothing here is provider data and nothing reaches a
 * network. The standings tables are the fixture's own rows: only the internal
 * round beside them, or their emptiness, is varied.
 */

import { describe, expect, it } from 'vitest';

import type {
  ConstructorStanding,
  DriverStanding,
} from '../../../src/contract/types';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  type CoordinatedPublicationOutcome,
  type CoordinatedStandingsRound,
  type SeasonAssembly,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  SEED_VERSION,
  sequencerTransports,
  type SequencerTransport,
} from '../../publication/sequenced/support';
import {
  FIXED_NOW,
  FakePort,
  SEASON,
  attempt,
  completePort,
  fullPlan,
  metadataFor,
  publicationHarness,
  seasonFixture,
  standingsRoundFor,
  type PublicationHarness,
} from './support';
import { splitSeasonFixture } from './split-participation-support';

/** A candidate ordering input later than the seed's. */
const CANDIDATE_AT = '2026-07-18T12:00:00.000Z';

/** The split season's latest classified race round. */
const HORIZON = 13;

/**
 * The split season with a final race classification at `classified` only.
 * Every other round is `unavailable` and keeps the mock calendar's own
 * non-completed status, so it is a future round rather than a gap.
 */
async function splitSeason(
  classified: readonly number[] = [1, 11, 12, 13],
): Promise<ProviderSeasonSource> {
  const split = await splitSeasonFixture();
  const mock = await seasonFixture();
  const kept = new Set(classified);
  return {
    ...split,
    calendar: split.calendar.map((event, index) =>
      kept.has(event.round)
        ? event
        : { ...event, status: mock.calendar[index]!.status, hasResults: false },
    ),
    results: split.results.map((result) =>
      kept.has(result.round)
        ? result
        : { ...result, status: 'unavailable' as const, entries: [] },
    ),
  };
}

/**
 * The split season before its first race: every round scheduled, every race
 * classification unavailable and both standings tables empty.
 */
async function preSeason(): Promise<ProviderSeasonSource> {
  const split = await splitSeason([]);
  return {
    ...split,
    calendar: split.calendar.map((event) => ({
      ...event,
      status: 'scheduled' as const,
      hasResults: false,
    })),
    driverStandings: [],
    constructorStandings: [],
  };
}

/** One standings contribution: its internal round, and its rows or none. */
interface Table {
  readonly round: CoordinatedStandingsRound;
  readonly rows: 'fixture' | 'empty';
}

const at = (round: CoordinatedStandingsRound): Table => ({
  round,
  rows: 'fixture',
});
const empty = (round: CoordinatedStandingsRound = null): Table => ({
  round,
  rows: 'empty',
});

/**
 * A Jolpica port that answers every resource from `source`, except the two
 * standings tables, which carry the source's own rows (or none) beside the
 * given internal round.
 */
function jolpicaPort(
  source: ProviderSeasonSource,
  drivers: Table,
  constructors: Table,
): FakePort {
  const complete = completePort('jolpica', source);
  return new FakePort('jolpica', (request) => {
    switch (request.resource.kind) {
      case 'driver-standings':
        return {
          outcome: 'candidate',
          attempts: [attempt('j-driver-standings')],
          payload: {
            kind: 'driver-standings',
            round: drivers.round,
            standings:
              drivers.rows === 'empty'
                ? ([] as DriverStanding[])
                : source.driverStandings,
          },
        };
      case 'constructor-standings':
        return {
          outcome: 'candidate',
          attempts: [attempt('j-constructor-standings')],
          payload: {
            kind: 'constructor-standings',
            round: constructors.round,
            standings:
              constructors.rows === 'empty'
                ? ([] as ConstructorStanding[])
                : source.constructorStandings,
          },
        };
      default:
        return complete.fetchResource(request);
    }
  });
}

function coordinate(
  source: ProviderSeasonSource,
  drivers: Table,
  constructors: Table,
) {
  return new MultiSourceCoordinator({
    ports: [jolpicaPort(source, drivers, constructors)],
    logger: new CapturingLogger(),
  }).coordinate({ plan: fullPlan(source) });
}

async function assemble(
  source: ProviderSeasonSource,
  drivers: Table,
  constructors: Table = drivers,
): Promise<SeasonAssembly> {
  const run = await coordinate(source, drivers, constructors);
  // Both tables were selected: whatever follows is assembly's own decision.
  for (const resource of run.resources) {
    expect(resource.selection.outcome).toBe('selected');
  }
  return assembleSeasonSource(run, metadataFor(source));
}

function expectIncoherent(assembly: SeasonAssembly): void {
  expect(assembly).toEqual({
    complete: false,
    gap: 'standings-round-incoherent',
    missing: [],
    relations: [],
  });
}

function completed(assembly: SeasonAssembly): ProviderSeasonSource {
  expect(assembly.complete).toBe(true);
  if (!assembly.complete) throw new Error(`withheld: ${assembly.gap}`);
  return assembly.source;
}

describe('season assembly publishes standings only at the race horizon', () => {
  it('publishes both tables when both describe the latest classified race round', async () => {
    const source = await splitSeason();
    expect(standingsRoundFor(source)).toBe(HORIZON);

    const published = completed(await assemble(source, at(HORIZON)));

    expect(published.driverStandings).toEqual(source.driverStandings);
    expect(published.constructorStandings).toEqual(source.constructorStandings);
    // The internal round goes no further than assembly.
    for (const row of [
      ...published.driverStandings,
      ...published.constructorStandings,
    ]) {
      expect(Object.keys(row)).not.toContain('round');
    }
  });

  it('holds for the curated mock season at its own horizon', async () => {
    const source = await seasonFixture();
    const horizon = standingsRoundFor(source);
    expect(horizon).not.toBeNull();

    completed(await assemble(source, at(horizon)));
    expectIncoherent(await assemble(source, at(horizon! + 1)));
  });

  it.each([
    ['both tables ahead', HORIZON + 1, HORIZON + 1],
    ['both tables behind', HORIZON - 1, HORIZON - 1],
    ['the driver table ahead', HORIZON + 1, HORIZON],
    ['the driver table behind', HORIZON - 1, HORIZON],
    ['the constructor table ahead', HORIZON, HORIZON + 1],
    ['the constructor table behind', HORIZON, HORIZON - 1],
    ['the tables disagreeing across the horizon', HORIZON - 1, HORIZON + 1],
    ['a table far ahead of the horizon', 999, HORIZON],
    ['a table at the first round only', 1, HORIZON],
  ])(
    'withholds the whole season with %s',
    async (_label, drivers, constructors) => {
      const source = await splitSeason();
      expectIncoherent(await assemble(source, at(drivers), at(constructors)));
    },
  );

  it('withholds a table with rows but no stated round', async () => {
    const source = await splitSeason();
    expectIncoherent(await assemble(source, at(null), at(HORIZON)));
    expectIncoherent(await assemble(source, at(HORIZON), at(null)));
  });

  it.each([
    ['an empty driver table', empty(), at(HORIZON)],
    ['an empty constructor table', at(HORIZON), empty()],
    ['an empty table naming the horizon', empty(HORIZON), at(HORIZON)],
    ['both tables empty', empty(), empty()],
  ])(
    'withholds %s once a race is classified',
    async (_label, drivers, constructors) => {
      const source = await splitSeason();
      expectIncoherent(await assemble(source, drivers, constructors));
    },
  );

  it('never substitutes an earlier table: the season is withheld, not trimmed', async () => {
    const source = await splitSeason();
    const assembly = await assemble(source, at(HORIZON + 1), at(HORIZON));
    expectIncoherent(assembly);
    expect(assembly).not.toHaveProperty('source');
  });
});

describe('a later table waits for its matching race classification', () => {
  it('withholds standings that already reflect the next round, then publishes them once its race is classified', async () => {
    // Standings bound to round 13 - after its sprint, or after its race -
    // while only rounds 1-12 are classified.
    const lagging = await splitSeason([1, 11, 12]);
    expect(standingsRoundFor(lagging)).toBe(12);
    expectIncoherent(await assemble(lagging, at(13)));

    // The round-13 race classification arrives: the same tables publish.
    const arrived = await splitSeason([1, 11, 12, 13]);
    const published = completed(await assemble(arrived, at(13)));
    expect(published.driverStandings).toEqual(arrived.driverStandings);
    expect(published.constructorStandings).toEqual(
      arrived.constructorStandings,
    );
  });
});

describe('before any race is classified', () => {
  it('publishes the empty answer with no round stated as empty tables', async () => {
    const source = await preSeason();
    expect(standingsRoundFor(source)).toBeNull();

    const published = completed(await assemble(source, empty()));

    expect(published.driverStandings).toEqual([]);
    expect(published.constructorStandings).toEqual([]);
    expect(published.calendar.every((event) => !event.hasResults)).toBe(true);
  });

  it.each([
    ['an empty driver table stating a round', empty(1), empty()],
    ['an empty constructor table stating a round', empty(), empty(1)],
    ['a driver table with rows', at(null), empty()],
    ['a constructor table with rows', empty(), at(null)],
    ['both tables with rows at a first round', at(1), at(1)],
  ])('withholds %s', async (_label, drivers, constructors) => {
    // The split season's own rows stand in for a table published too early.
    const rows = await splitSeason();
    const source = {
      ...(await preSeason()),
      driverStandings: rows.driverStandings,
      constructorStandings: rows.constructorStandings,
    };
    expectIncoherent(await assemble(source, drivers, constructors));
  });
});

describe('the multi-constructor standing is carried unchanged', () => {
  it('publishes a coherent table whose multi-team row has no constructor', async () => {
    const source = await splitSeason();
    const [first, ...rest] = source.driverStandings;
    if (first === undefined) throw new Error('fixture gap');
    // As the Jolpica normalizer publishes a row listing several constructors
    // (S-3): the season total, with no constructor guessed.
    const multiTeam = { ...first, constructorId: null };
    const candidate = { ...source, driverStandings: [multiTeam, ...rest] };

    const published = completed(await assemble(candidate, at(HORIZON)));

    expect(published.driverStandings[0]).toEqual(multiTeam);
  });
});

describe.each(sequencerTransports)(
  'standings coherence at publication over the %s sequencer transport',
  (transport: SequencerTransport) => {
    /** What coordination would publish for `source`: a coherent predecessor. */
    async function seededWith(
      classified: readonly number[],
    ): Promise<PublicationHarness> {
      const source = await splitSeason(classified);
      const seed = completed(
        await assemble(source, at(standingsRoundFor(source))),
      );
      return publicationHarness({ transport, seedSource: seed });
    }

    async function publishThrough(
      harness: PublicationHarness,
      source: ProviderSeasonSource,
      drivers: Table,
      constructors: Table = drivers,
    ): Promise<CoordinatedPublicationOutcome> {
      return new CoordinatedSeasonPublication({
        commands: harness.commands,
        logger: harness.logger,
      }).publish(
        await coordinate(source, drivers, constructors),
        { ...metadataFor(source), sourceUpdatedAt: CANDIDATE_AT },
        FIXED_NOW,
        'caller-version',
      );
    }

    async function expectSeedServing(
      harness: PublicationHarness,
    ): Promise<void> {
      expect(harness.activeVersion()).toBe(SEED_VERSION);
      expect(await harness.storage.listVersions(SEASON)).toEqual([
        SEED_VERSION,
      ]);
      for (const name of [
        'standings:drivers',
        'standings:constructors',
      ] as const) {
        const document = await harness.activeDocument(name);
        expect((document?.data as unknown[]).length).toBeGreaterThan(0);
      }
    }

    it('never hands an incoherent candidate to publication', async () => {
      const harness = await seededWith([1, 11, 12, 13]);

      const outcome = await publishThrough(
        harness,
        await splitSeason(),
        at(HORIZON + 1),
        at(HORIZON),
      );

      expect(outcome).toEqual({
        outcome: 'withheld',
        gap: 'standings-round-incoherent',
        missing: [],
        relations: [],
      });
      expect(harness.publishCalls).toBe(0);
      expect(harness.legacyPublishCalls).toBe(0);
      await expectSeedServing(harness);
      // Only closed values reach the log.
      const serialized = harness.logger.serialized();
      expect(serialized).toContain('standings-round-incoherent');
      expect(serialized).not.toContain('max-verstappen');
    });

    it('lets D14 refuse a pre-season candidate with empty standings over classified rounds', async () => {
      const harness = await seededWith([1, 11, 12, 13]);
      const candidate = await preSeason();

      // The candidate is coherent on its own terms, so assembly admits it...
      completed(await assemble(candidate, empty()));

      // ...and the D14 round-coverage guard is what refuses it.
      const outcome = await publishThrough(harness, candidate, empty());

      expect(outcome.outcome).toBe('published');
      if (outcome.outcome !== 'published') return;
      expect(outcome.result).toMatchObject({
        status: 'rejected',
        reason: 'guard-round-coverage-regression',
        previousVersion: SEED_VERSION,
      });
      expect(harness.publishCalls).toBe(1);
      await expectSeedServing(harness);
    });

    it('publishes previously withheld standings once the matching race result arrives', async () => {
      const harness = await seededWith([1, 11, 12]);

      const early = await publishThrough(
        harness,
        await splitSeason([1, 11, 12]),
        at(13),
      );
      expect(early).toMatchObject({
        outcome: 'withheld',
        gap: 'standings-round-incoherent',
      });
      expect(harness.publishCalls).toBe(0);
      await expectSeedServing(harness);

      const arrived = await splitSeason([1, 11, 12, 13]);
      const outcome = await publishThrough(harness, arrived, at(13));

      expect(outcome.outcome).toBe('published');
      if (outcome.outcome !== 'published') return;
      expect(outcome.result.status).toBe('applied');
      expect(harness.activeVersion()).toBe(harness.lastCommitted());
      const drivers = await harness.activeDocument('standings:drivers');
      expect(drivers?.data).toEqual(arrived.driverStandings);
    });
  },
);
