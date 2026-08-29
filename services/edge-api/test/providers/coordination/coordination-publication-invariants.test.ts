/**
 * The two invariants that stand between a *coordinated* season and a
 * *publishable* one.
 *
 * 1. **The Grand Prix results resource is the race classification.** OpenAPI
 *    defines `/v1/seasons/{season}/grand-prix/{round}/results` as the race
 *    classification, and the generator picks that document with a lookup by
 *    round alone. Only a `race` classification may therefore enter
 *    `ProviderSeasonSource.results`; a qualifying or sprint classification is
 *    a perfectly valid coordination result that this phase simply cannot
 *    publish through that resource.
 * 2. **Independently valid payloads must also be mutually consistent.** Every
 *    resource is selected on its own, so nothing upstream compares a calendar
 *    event against the circuits collection or a standing against the driver
 *    profiles. Snapshot generation assumes those references resolve - some by
 *    throwing, some by silently publishing a dangling identifier - so the
 *    references are checked once, before generation, and the whole candidate
 *    is withheld if any of them fails.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  validateSeasonReferences,
  type CoordinatedResource,
  type CoordinationRun,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import type { RaceResult } from '../../../src/contract/types';
import {
  FIXED_NOW,
  SEASON,
  completePort,
  fullPlan,
  metadataFor,
  publicationHarness,
  raceResource,
  seasonFixture,
  seasonResources,
  type PublicationHarness,
} from './support';

const VERSION = 'v1';

function classificationResource(
  round: number,
  sessionType: 'qualifying' | 'sprint' | 'sprint_qualifying' | 'race',
): CoordinatedResource {
  return { kind: 'session-classification', season: SEASON, round, sessionType };
}

/** A new source with one collection replaced. Never mutates the fixture. */
function sourceWith(
  source: ProviderSeasonSource,
  overrides: Partial<ProviderSeasonSource>,
): ProviderSeasonSource {
  return { ...source, ...overrides };
}

/** The fixture's race classification for one round. */
function raceResultFor(
  source: ProviderSeasonSource,
  round: number,
): RaceResult {
  const result = source.results.find(
    (candidate) =>
      candidate.round === round && candidate.sessionType === 'race',
  );
  if (result === undefined) throw new Error('fixture gap');
  return result;
}

/**
 * A non-race classification for one round, derived from that round's real race
 * classification so nothing about it is invented beyond its session type.
 */
function nonRaceResultFor(
  source: ProviderSeasonSource,
  round: number,
  sessionType: 'qualifying' | 'sprint' | 'sprint_qualifying',
): RaceResult {
  const race = raceResultFor(source, round);
  return { ...race, id: `${race.id}-${sessionType}`, sessionType };
}

function coordinate(
  source: ProviderSeasonSource,
  resources: readonly CoordinatedResource[],
  logger = new CapturingLogger(),
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports: [completePort('jolpica', source)],
    logger,
  }).coordinate({ plan: { season: SEASON, resources } });
}

async function publish(
  harness: PublicationHarness,
  run: CoordinationRun,
  source: ProviderSeasonSource,
  generatedAt = FIXED_NOW,
): Promise<Awaited<ReturnType<CoordinatedSeasonPublication['publish']>>> {
  return new CoordinatedSeasonPublication({
    publisher: harness.publisher,
    logger: harness.logger,
  }).publish(run, metadataFor(source), generatedAt, VERSION);
}

/** Every round of the fixture calendar, in calendar order. */
function rounds(source: ProviderSeasonSource): number[] {
  return source.calendar.map((event) => event.round);
}

describe('only a race classification is published as the Grand Prix result', () => {
  it('publishes the race when qualifying and race are both coordinated', async () => {
    const base = await seasonFixture();
    const round = rounds(base)[0];
    if (round === undefined) throw new Error('fixture gap');
    const qualifying = nonRaceResultFor(base, round, 'qualifying');
    const source = sourceWith(base, {
      results: [qualifying, ...base.results],
    });
    const harness = publicationHarness();

    const run = await coordinate(source, [
      ...fullPlan(base).resources,
      classificationResource(round, 'qualifying'),
    ]);
    const outcome = await publish(harness, run, source);

    expect(outcome.outcome).toBe('published');
    const document = await harness.storage.readVersionedDocument(
      SEASON,
      VERSION,
      `grand-prix:${round}:results`,
    );
    expect((document?.data as RaceResult).sessionType).toBe('race');
    expect((document?.data as RaceResult).id).toBe(
      raceResultFor(base, round).id,
    );
  });

  it('keeps every non-race session type out of the published results', async () => {
    const base = await seasonFixture();
    const round = rounds(base)[0];
    if (round === undefined) throw new Error('fixture gap');

    for (const sessionType of [
      'qualifying',
      'sprint',
      'sprint_qualifying',
    ] as const) {
      const extra = nonRaceResultFor(base, round, sessionType);
      const source = sourceWith(base, { results: [extra, ...base.results] });
      const harness = publicationHarness();

      const run = await coordinate(source, [
        ...fullPlan(base).resources,
        classificationResource(round, sessionType),
      ]);
      const outcome = await publish(harness, run, source);

      expect(outcome.outcome, sessionType).toBe('published');
      const document = await harness.storage.readVersionedDocument(
        SEASON,
        VERSION,
        `grand-prix:${round}:results`,
      );
      expect((document?.data as RaceResult).sessionType, sessionType).toBe(
        'race',
      );
    }
  });

  it('never lets a non-race classification satisfy race completeness', async () => {
    const base = await seasonFixture();
    const round = rounds(base)[0];
    if (round === undefined) throw new Error('fixture gap');
    // The round's race classification is removed and replaced by qualifying,
    // so the only thing that could complete the round is a non-race session.
    const qualifying = nonRaceResultFor(base, round, 'qualifying');
    const source = sourceWith(base, {
      results: [
        qualifying,
        ...base.results.filter((result) => result.round !== round),
      ],
    });
    const harness = publicationHarness();

    const run = await coordinate(source, [
      ...seasonResources,
      ...rounds(base)
        .filter((candidate) => candidate !== round)
        .map((candidate) => raceResource(candidate)),
      classificationResource(round, 'qualifying'),
    ]);
    const assembly = assembleSeasonSource(run, metadataFor(source));
    const outcome = await publish(harness, run, source);

    expect(assembly.complete).toBe(false);
    if (!assembly.complete) {
      expect(assembly.gap).toBe('missing-round-classification');
    }
    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });

  it('selects the same race classification whichever plan order is used', async () => {
    const base = await seasonFixture();
    const round = rounds(base)[0];
    if (round === undefined) throw new Error('fixture gap');
    const qualifying = nonRaceResultFor(base, round, 'qualifying');
    const source = sourceWith(base, {
      results: [qualifying, ...base.results],
    });
    const expected = raceResultFor(base, round).id;

    for (const order of [
      [
        classificationResource(round, 'qualifying'),
        ...fullPlan(base).resources,
      ],
      [
        ...fullPlan(base).resources,
        classificationResource(round, 'qualifying'),
      ],
    ]) {
      const harness = publicationHarness();
      const run = await coordinate(source, order);
      await publish(harness, run, source);

      const document = await harness.storage.readVersionedDocument(
        SEASON,
        VERSION,
        `grand-prix:${round}:results`,
      );
      expect((document?.data as RaceResult).id).toBe(expected);
    }
  });
});

describe('cross-resource references are checked before generation', () => {
  async function withheldFor(broken: Partial<ProviderSeasonSource>): Promise<{
    harness: PublicationHarness;
    outcome: Awaited<ReturnType<CoordinatedSeasonPublication['publish']>>;
  }> {
    const base = await seasonFixture();
    const source = sourceWith(base, broken);
    const harness = publicationHarness();
    const run = await coordinate(source, fullPlan(base).resources);
    const outcome = await publish(harness, run, source);
    return { harness, outcome };
  }

  it('withholds when a calendar event names an absent circuit', async () => {
    const base = await seasonFixture();
    const used = base.calendar[0]?.circuitId;
    expect(used).toBeDefined();
    const { harness, outcome } = await withheldFor({
      circuits: base.circuits.filter((circuit) => circuit.id !== used),
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });

  it('withholds when a participant entry names an absent driver profile', async () => {
    const base = await seasonFixture();
    const used = base.driverEntries[0]?.driverId;
    expect(used).toBeDefined();
    const { harness, outcome } = await withheldFor({
      drivers: base.drivers.filter((driver) => driver.id !== used),
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds when a participant entry names an absent constructor profile', async () => {
    const base = await seasonFixture();
    const used = base.constructorEntries[0]?.constructorId;
    expect(used).toBeDefined();
    const { harness, outcome } = await withheldFor({
      constructors: base.constructors.filter(
        (constructor) => constructor.id !== used,
      ),
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds when a driver entry names an absent constructor', async () => {
    const base = await seasonFixture();
    const first = base.driverEntries[0];
    if (first === undefined) throw new Error('fixture gap');
    const { harness, outcome } = await withheldFor({
      driverEntries: [
        { ...first, constructorId: 'no-such-constructor' },
        ...base.driverEntries.slice(1),
      ],
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds when a constructor line-up names an absent driver', async () => {
    const base = await seasonFixture();
    const entry = base.constructorEntries.find(
      (candidate) =>
        candidate.driverLineup !== null && candidate.driverLineup.length > 0,
    );
    if (entry === undefined) throw new Error('fixture gap');
    const { harness, outcome } = await withheldFor({
      constructorEntries: base.constructorEntries.map((candidate) =>
        candidate === entry
          ? { ...candidate, driverLineup: ['no-such-driver'] }
          : candidate,
      ),
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds when a driver standing names an absent driver', async () => {
    const base = await seasonFixture();
    const first = base.driverStandings[0];
    if (first === undefined) throw new Error('fixture gap');
    const { harness, outcome } = await withheldFor({
      driverStandings: [
        { ...first, driverId: 'no-such-driver' },
        ...base.driverStandings.slice(1),
      ],
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds when a driver standing names an absent constructor', async () => {
    const base = await seasonFixture();
    const first = base.driverStandings[0];
    if (first === undefined) throw new Error('fixture gap');
    const { harness, outcome } = await withheldFor({
      driverStandings: [
        { ...first, constructorId: 'no-such-constructor' },
        ...base.driverStandings.slice(1),
      ],
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds when a constructor standing names an absent constructor', async () => {
    const base = await seasonFixture();
    const first = base.constructorStandings[0];
    if (first === undefined) throw new Error('fixture gap');
    const { harness, outcome } = await withheldFor({
      constructorStandings: [
        { ...first, constructorId: 'no-such-constructor' },
        ...base.constructorStandings.slice(1),
      ],
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds when a race-result entry names an absent driver', async () => {
    const base = await seasonFixture();
    const result = base.results[0];
    const entry = result?.entries[0];
    if (result === undefined || entry === undefined) {
      throw new Error('fixture gap');
    }
    const { harness, outcome } = await withheldFor({
      results: [
        {
          ...result,
          entries: [
            { ...entry, driverId: 'no-such-driver' },
            ...result.entries.slice(1),
          ],
        },
        ...base.results.slice(1),
      ],
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds when a race-result entry names an absent constructor', async () => {
    const base = await seasonFixture();
    const result = base.results[0];
    const entry = result?.entries[0];
    if (result === undefined || entry === undefined) {
      throw new Error('fixture gap');
    }
    const { harness, outcome } = await withheldFor({
      results: [
        {
          ...result,
          entries: [
            { ...entry, constructorId: 'no-such-constructor' },
            ...result.entries.slice(1),
          ],
        },
        ...base.results.slice(1),
      ],
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds when a fastest lap names an absent driver', async () => {
    const base = await seasonFixture();
    const result = base.results.find(
      (candidate) => candidate.fastestLap !== null,
    );
    if (result === undefined) throw new Error('fixture gap');
    const { harness, outcome } = await withheldFor({
      results: base.results.map((candidate) =>
        candidate === result
          ? {
              ...candidate,
              fastestLap: {
                ...(candidate.fastestLap ?? {
                  timeMillis: null,
                  lap: null,
                }),
                driverId: 'no-such-driver',
              },
            }
          : candidate,
      ),
    });

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds a duplicated profile or event identity', async () => {
    const base = await seasonFixture();
    const driver = base.drivers[0];
    const constructor = base.constructors[0];
    const circuit = base.circuits[0];
    const event = base.calendar[0];
    if (
      driver === undefined ||
      constructor === undefined ||
      circuit === undefined ||
      event === undefined
    ) {
      throw new Error('fixture gap');
    }

    for (const broken of [
      { drivers: [...base.drivers, driver] },
      { constructors: [...base.constructors, constructor] },
      { circuits: [...base.circuits, circuit] },
      { calendar: [...base.calendar, event] },
    ] as Partial<ProviderSeasonSource>[]) {
      const { harness, outcome } = await withheldFor(broken);
      expect(outcome.outcome).toBe('withheld');
      expect(harness.publishCalls).toBe(0);
    }
  });

  it('rejects two race classifications for one round instead of picking one', async () => {
    const base = await seasonFixture();
    const round = rounds(base)[0];
    if (round === undefined) throw new Error('fixture gap');
    const race = raceResultFor(base, round);

    // Coordination cannot currently produce this: one plan holds each resource
    // identity at most once, and a classification payload is bound to its
    // identity's round and session type. The guard is defence in depth, so it
    // is proven directly against the production validator rather than through
    // a path that cannot reach it.
    expect(
      validateSeasonReferences(
        sourceWith(base, {
          results: [{ ...race, id: `${race.id}-duplicate` }, ...base.results],
        }),
      ),
    ).toContain('duplicate-identity');
    expect(validateSeasonReferences(base)).toEqual([]);
  });

  it('reports the failure with bounded relations and no identifier', async () => {
    const base = await seasonFixture();
    const used = base.driverEntries[0]?.driverId;
    if (used === undefined) throw new Error('fixture gap');
    const source = sourceWith(base, {
      drivers: base.drivers.filter((driver) => driver.id !== used),
    });
    const harness = publicationHarness();

    const run = await coordinate(source, fullPlan(base).resources);
    const assembly = assembleSeasonSource(run, metadataFor(source));
    await publish(harness, run, source);
    const serialized = harness.logger.serialized();

    expect(assembly.complete).toBe(false);
    if (!assembly.complete) {
      expect(assembly.gap).toBe('inconsistent-references');
      expect(assembly.relations).toContain('driver-entry-driver');
      for (const relation of assembly.relations) {
        expect(typeof relation).toBe('string');
        expect(relation.length).toBeLessThan(40);
      }
    }
    // The failing identity never leaves the boundary.
    expect(serialized).not.toContain(used);
  });

  it('withholds the whole candidate for one broken relation', async () => {
    const base = await seasonFixture();
    const used = base.calendar[0]?.circuitId;
    if (used === undefined) throw new Error('fixture gap');
    const source = sourceWith(base, {
      circuits: base.circuits.filter((circuit) => circuit.id !== used),
    });
    const harness = publicationHarness();

    const run = await coordinate(source, fullPlan(base).resources);
    await publish(harness, run, source);

    // Not one document of the otherwise healthy season is written.
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
    expect(
      await harness.storage.readVersionedDocument(SEASON, VERSION, 'season'),
    ).toBeNull();
  });

  it('leaves a prior active release serving when preflight fails', async () => {
    const base = await seasonFixture();
    const good = publicationHarness();
    const healthy = await coordinate(base, fullPlan(base).resources);
    await publish(good, healthy, base);
    expect(await good.storage.getActiveVersion(SEASON)).toBe(VERSION);

    const used = base.driverEntries[0]?.driverId;
    if (used === undefined) throw new Error('fixture gap');
    const broken = sourceWith(base, {
      drivers: base.drivers.filter((driver) => driver.id !== used),
    });
    const run = await coordinate(broken, fullPlan(base).resources);
    const outcome = await new CoordinatedSeasonPublication({
      publisher: good.publisher,
      logger: good.logger,
    }).publish(run, metadataFor(broken), FIXED_NOW, 'v2');

    expect(outcome.outcome).toBe('withheld');
    expect(good.publishCalls).toBe(1);
    expect(await good.storage.getActiveVersion(SEASON)).toBe(VERSION);
  });

  it('still publishes a fully consistent season exactly once', async () => {
    const base = await seasonFixture();
    const harness = publicationHarness();
    const run = await coordinate(base, fullPlan(base).resources);
    const outcome = await publish(harness, run, base);

    expect(outcome.outcome).toBe('published');
    expect(harness.publishCalls).toBe(1);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);
  });
});

describe('snapshot generation cannot throw out of publication', () => {
  it('contains an unexpected generator failure as a bounded withheld outcome', async () => {
    const base = await seasonFixture();
    const harness = publicationHarness();
    const run = await coordinate(base, fullPlan(base).resources);

    // A malformed `generatedAt` is a caller input the assembled source cannot
    // vouch for: the generator derives `staleAfter` from it and throws
    // `RangeError: Invalid time value` before a single document exists.
    const outcome = await publish(harness, run, base, 'not-a-timestamp');

    expect(outcome.outcome).toBe('withheld');
    if (outcome.outcome === 'withheld') {
      expect(outcome.gap).toBe('generation-failed');
    }
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });

  it('never lets the exception text or a payload reach the logs', async () => {
    const base = await seasonFixture();
    const harness = publicationHarness();
    const run = await coordinate(base, fullPlan(base).resources);

    await publish(harness, run, base, 'not-a-timestamp');
    const serialized = harness.logger.serialized();

    expect(serialized).not.toContain('Invalid time value');
    expect(serialized).not.toContain('RangeError');
    expect(serialized).not.toContain('not-a-timestamp');
    expect(serialized).not.toContain('max-verstappen');
  });

  it('leaves a prior active release serving when generation fails', async () => {
    const base = await seasonFixture();
    const harness = publicationHarness();
    const healthy = await coordinate(base, fullPlan(base).resources);
    await publish(harness, healthy, base);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);

    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(healthy, metadataFor(base), 'not-a-timestamp', 'v2');

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(1);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);
  });

  it('still reports a publisher failure as a publication outcome', async () => {
    const base = await seasonFixture();
    const harness = publicationHarness();
    const run = await coordinate(base, fullPlan(base).resources);
    // The guard is around generation only: once the publisher has been
    // reached, its own result is returned unchanged and never reinterpreted.
    harness.publisher.publish = async () => {
      harness.publishCalls += 1;
      return {
        status: 'failed' as const,
        season: SEASON,
        version: VERSION,
        previousVersion: null,
        reason: 'storage-write' as const,
        cachePurgeOk: true,
        cachePurge: 'not-required' as const,
        purgedUrls: [],
      };
    };
    const outcome = await publish(harness, run, base);

    expect(outcome.outcome).toBe('published');
    if (outcome.outcome === 'published') {
      expect(outcome.result.status).toBe('failed');
      expect(outcome.result.reason).toBe('storage-write');
    }
  });

  it('never publishes a cancelled run, and does not call it a generation failure', async () => {
    const base = await seasonFixture();
    const harness = publicationHarness();
    const controller = new AbortController();
    controller.abort();
    const run = await new MultiSourceCoordinator({
      ports: [completePort('jolpica', base)],
      logger: harness.logger,
    }).coordinate({ plan: fullPlan(base), signal: controller.signal });
    const outcome = await publish(harness, run, base);

    expect(run.status).toBe('cancelled');
    expect(outcome.outcome).toBe('withheld');
    if (outcome.outcome === 'withheld') {
      expect(outcome.gap).toBe('run-not-completed');
    }
    expect(harness.publishCalls).toBe(0);
  });
});
