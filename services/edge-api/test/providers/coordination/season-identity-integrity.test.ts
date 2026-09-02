/**
 * Cross-resource agreement and identity uniqueness in an assembled season.
 *
 * Two things the preflight has to settle that structural validation cannot:
 *
 * 1. **`hasResults` is an assertion about another resource.** The calendar says
 *    whether a round's classification exists, and the results collection either
 *    contains it or does not. Those are selected independently, so they can
 *    disagree - and the disagreement is not cosmetic: the client uses the flag
 *    to decide whether to request the classification at all.
 * 2. **A stable identity backs a stored row.** Where the domain model defines an
 *    identity and persistence keys on it, two payloads sharing that identity
 *    means one silently overwrites the other. Which one wins would be an
 *    ordering accident, so neither is allowed to.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  seasonRelations,
  validateSeasonReferences,
  type CoordinatedResource,
  type CoordinationRun,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  FIXED_NOW,
  SEASON,
  completePort,
  fullPlan,
  metadataFor,
  publicationHarness,
  raceResource,
  rounds,
  seasonFixture,
  seasonResources,
  type PublicationHarness,
} from './support';

const VERSION = 'v1';

function sourceWith(
  source: ProviderSeasonSource,
  overrides: Partial<ProviderSeasonSource>,
): ProviderSeasonSource {
  return { ...source, ...overrides };
}

/**
 * The round whose result is an actual classification, and one whose result is
 * the contract's meaningful absence (`status: 'unavailable'`, no entries).
 *
 * The curated season contains both, which is what makes the two mismatch
 * directions testable without inventing data.
 */
function classifiedRound(source: ProviderSeasonSource): number {
  const result = source.results.find(
    (candidate) => candidate.status === 'final',
  );
  if (result === undefined) throw new Error('fixture gap');
  return result.round;
}

function unavailableRound(source: ProviderSeasonSource): number {
  const result = source.results.find(
    (candidate) => candidate.status === 'unavailable',
  );
  if (result === undefined) throw new Error('fixture gap');
  return result.round;
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

function publish(
  harness: PublicationHarness,
  run: CoordinationRun,
  source: ProviderSeasonSource,
  version = VERSION,
): Promise<Awaited<ReturnType<CoordinatedSeasonPublication['publish']>>> {
  return new CoordinatedSeasonPublication({
    publisher: harness.publisher,
    logger: harness.logger,
  }).publish(run, metadataFor(source), FIXED_NOW, version);
}

describe('hasResults matches the selected race result exactly', () => {
  it('accepts a season whose flags agree in both directions', async () => {
    const source = await seasonFixture();
    expect(validateSeasonReferences(source)).toEqual([]);

    const harness = publicationHarness();
    const run = await coordinate(source, fullPlan(source).resources);
    const outcome = await publish(harness, run, source);

    expect(outcome.outcome).toBe('published');
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);
  });

  it('rejects a published classification under an event flagged false', async () => {
    const base = await seasonFixture();
    const round = classifiedRound(base);
    // The classification exists and will be published, but the calendar says
    // it does not - so a fresh client never asks for it.
    const source = sourceWith(base, {
      calendar: base.calendar.map((event) =>
        event.round === round ? { ...event, hasResults: false } : event,
      ),
    });

    expect(validateSeasonReferences(source)).toContain('event-has-results');

    const harness = publicationHarness();
    const run = await coordinate(source, fullPlan(base).resources);
    const outcome = await publish(harness, run, source);

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });

  it('rejects an event flagged true with no classification', async () => {
    const base = await seasonFixture();
    const round = unavailableRound(base);
    // The inverse: a classification is advertised that does not exist. The
    // round's result document is the contract's meaningful absence, which is
    // not a classification.
    const advertised = sourceWith(base, {
      calendar: base.calendar.map((event) =>
        event.round === round ? { ...event, hasResults: true } : event,
      ),
    });

    expect(validateSeasonReferences(advertised)).toContain('event-has-results');

    // The same holds when the result document is missing altogether.
    const absent = sourceWith(advertised, {
      results: base.results.filter((result) => result.round !== round),
    });
    expect(validateSeasonReferences(absent)).toContain('event-has-results');

    const harness = publicationHarness();
    const run = await coordinate(advertised, fullPlan(base).resources);
    const outcome = await publish(harness, run, advertised);

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('treats an unavailable result as no classification, not as one', async () => {
    const base = await seasonFixture();
    // Every non-classified round already carries an `unavailable` document and
    // a false flag: that pairing is the contract's meaningful absence and must
    // stay valid, or a season could never publish before its first race.
    const unavailable = base.results.filter(
      (result) => result.status === 'unavailable',
    );
    expect(unavailable.length).toBeGreaterThan(0);
    for (const result of unavailable) {
      const event = base.calendar.find((item) => item.round === result.round);
      expect(event?.hasResults, `round ${result.round}`).toBe(false);
    }
    expect(validateSeasonReferences(base)).toEqual([]);
  });

  it('keeps a future round with no result and a false flag valid', async () => {
    const base = await seasonFixture();
    const all = rounds(base);
    const future = all[all.length - 1];
    if (future === undefined) throw new Error('fixture gap');
    const classified = classifiedRound(base);
    const source = sourceWith(base, {
      calendar: base.calendar.map((event) =>
        event.round === future
          ? { ...event, status: 'scheduled' as const, hasResults: false }
          : {
              ...event,
              // Only the genuinely classified round may be completed; a
              // completed round without a classification blocks publication.
              status:
                event.round === classified
                  ? ('completed' as const)
                  : event.status,
              hasResults: event.round === classified,
            },
      ),
      results: base.results.filter((result) => result.round !== future),
    });

    expect(validateSeasonReferences(source)).toEqual([]);

    const harness = publicationHarness();
    const run = await coordinate(source, [
      ...seasonResources,
      ...all.filter((round) => round !== future).map((r) => raceResource(r)),
    ]);
    const outcome = await publish(harness, run, source);

    expect(outcome.outcome).toBe('published');
  });

  it('leaves the prior release serving when the flags disagree', async () => {
    const base = await seasonFixture();
    const harness = publicationHarness();
    const healthy = await coordinate(base, fullPlan(base).resources);
    await publish(harness, healthy, base);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);

    const round = classifiedRound(base);
    const broken = sourceWith(base, {
      calendar: base.calendar.map((event) =>
        event.round === round ? { ...event, hasResults: false } : event,
      ),
    });
    const run = await coordinate(broken, fullPlan(base).resources);
    const outcome = await publish(harness, run, broken, 'v2');

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(1);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);
  });

  it('reports only a bounded relation name', async () => {
    const base = await seasonFixture();
    const round = classifiedRound(base);
    const source = sourceWith(base, {
      calendar: base.calendar.map((event) =>
        event.round === round ? { ...event, hasResults: false } : event,
      ),
    });
    const harness = publicationHarness();
    const run = await coordinate(source, fullPlan(base).resources);
    const assembly = assembleSeasonSource(run, metadataFor(source));
    await publish(harness, run, source);

    expect(assembly.complete).toBe(false);
    if (!assembly.complete) {
      for (const relation of assembly.relations) {
        expect(seasonRelations as readonly string[]).toContain(relation);
      }
    }
    const serialized = harness.logger.serialized();
    const event = source.calendar.find((item) => item.round === round);
    expect(serialized).not.toContain(event?.id ?? 'unreachable');
  });
});

describe('stable identities are unique where persistence keys on them', () => {
  it('rejects two rounds sharing one Grand Prix id', async () => {
    const base = await seasonFixture();
    const [first, second] = base.calendar;
    if (first === undefined || second === undefined) {
      throw new Error('fixture gap');
    }
    // Different rounds, one identity: `grand_prix.id` is the primary key, so
    // the later row would overwrite the earlier and the season lose a round.
    const source = sourceWith(base, {
      calendar: base.calendar.map((event) =>
        event.round === second.round ? { ...event, id: first.id } : event,
      ),
    });

    expect(validateSeasonReferences(source)).toContain('duplicate-identity');

    const harness = publicationHarness();
    const run = await coordinate(source, fullPlan(base).resources);
    const outcome = await publish(harness, run, source);

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });

  it('still rejects a duplicated round', async () => {
    const base = await seasonFixture();
    const first = base.calendar[0];
    if (first === undefined) throw new Error('fixture gap');
    expect(
      validateSeasonReferences(
        sourceWith(base, { calendar: [...base.calendar, first] }),
      ),
    ).toContain('duplicate-identity');
  });

  it('rejects every sibling identity persistence keys on', async () => {
    const base = await seasonFixture();
    const firstDriver = base.drivers[0];
    const firstConstructor = base.constructors[0];
    const firstResult = base.results[0];
    const firstEntry = firstResult?.entries[0];
    const firstDriverEntry = base.driverEntries[0];
    const firstConstructorEntry = base.constructorEntries[0];
    const firstStanding = base.driverStandings[0];
    const firstCStanding = base.constructorStandings[0];
    const firstEvent = base.calendar[0];
    const firstSession = firstEvent?.sessions[0];
    if (
      firstDriver === undefined ||
      firstConstructor === undefined ||
      firstResult === undefined ||
      firstEntry === undefined ||
      firstDriverEntry === undefined ||
      firstConstructorEntry === undefined ||
      firstStanding === undefined ||
      firstCStanding === undefined ||
      firstEvent === undefined ||
      firstSession === undefined
    ) {
      throw new Error('fixture gap');
    }

    const cases: { label: string; broken: Partial<ProviderSeasonSource> }[] = [
      {
        label: 'session id across events',
        broken: {
          calendar: base.calendar.map((event, index) =>
            index === 1
              ? { ...event, sessions: [...event.sessions, firstSession] }
              : event,
          ),
        },
      },
      {
        label: 'race result id',
        broken: {
          results: base.results.map((result, index) =>
            index === 1 ? { ...result, id: firstResult.id } : result,
          ),
        },
      },
      {
        label: 'race result entry driver',
        broken: {
          results: base.results.map((result, index) =>
            index === 0
              ? { ...result, entries: [...result.entries, firstEntry] }
              : result,
          ),
        },
      },
      {
        label: 'driver standing participant',
        broken: {
          driverStandings: [...base.driverStandings, firstStanding],
        },
      },
      {
        label: 'constructor standing participant',
        broken: {
          constructorStandings: [...base.constructorStandings, firstCStanding],
        },
      },
      {
        label: 'driver season entry id',
        broken: { driverEntries: [...base.driverEntries, firstDriverEntry] },
      },
      {
        label: 'constructor season entry constructor',
        broken: {
          constructorEntries: [
            ...base.constructorEntries,
            firstConstructorEntry,
          ],
        },
      },
    ];

    for (const entry of cases) {
      expect(
        validateSeasonReferences(sourceWith(base, entry.broken)),
        entry.label,
      ).toContain('duplicate-identity');
    }
  });

  it('keeps documented valid multiplicity accepted', async () => {
    const base = await seasonFixture();
    const first = base.driverEntries[0];
    if (first === undefined) throw new Error('fixture gap');
    // Mid-season participation is modelled as split spans: one driver may hold
    // several entries, as long as each entry has its own identity.
    // A real split closes the first span before the second opens. Leaving the
    // first open-ended would be two seats covering round 14 for one driver,
    // which the local write rejects (`driver-entry-span`).
    const split = sourceWith(base, {
      driverEntries: [
        ...base.driverEntries.map((entry) =>
          entry === first ? { ...entry, startRound: 1, endRound: 13 } : entry,
        ),
        { ...first, id: `${first.id}-second-span`, startRound: 14 },
      ],
    });

    expect(validateSeasonReferences(split)).toEqual([]);
  });

  it('gives the same verdict under reversed calendar order', async () => {
    const base = await seasonFixture();
    const [first, second] = base.calendar;
    if (first === undefined || second === undefined) {
      throw new Error('fixture gap');
    }
    const collided = base.calendar.map((event) =>
      event.round === second.round ? { ...event, id: first.id } : event,
    );

    const forward = validateSeasonReferences(
      sourceWith(base, { calendar: collided }),
    );
    const reversed = validateSeasonReferences(
      sourceWith(base, { calendar: [...collided].reverse() }),
    );
    expect(forward).toEqual(reversed);
    expect(forward).toContain('duplicate-identity');
  });
});
