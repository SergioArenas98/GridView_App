/**
 * Season assembly owns `GrandPrix.hasResults` (ADR 0022 A7, ADR 0026 D12
 * item 6).
 *
 * A calendar contribution's flag is provisional and evidence in neither
 * direction. Assembly derives the final value: `true` exactly when the round
 * has a **selected** race classification carrying `final` or `provisional`.
 * An `unavailable` or `unknown` document, a non-race classification, a
 * candidate that was considered but not selected, the calendar status and the
 * clock establish nothing. The flag is derived, not repaired: no
 * classification is fabricated, discarded or altered, and the unchanged
 * `event-has-results` and `result-event` relations still guard the assembled
 * candidate.
 *
 * Every case runs the production path - the real coordinator,
 * `assembleSeasonSource`, the integrity preflight and, where it matters, the
 * guarded sequenced publication - over the synthetic split season (`splitSeasonFixture`):
 * rounds 1, 11, 12 and 13 carry a `final` Jolpica race classification and
 * round 14 carries the `unavailable` absence document.
 */

import { describe, expect, it } from 'vitest';

import { canonicalRaceResultId } from '../../../src/contract/identity';
import type { GrandPrix, RaceResult } from '../../../src/contract/types';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  validateSeasonReferences,
  type CoordinatedResource,
  type CoordinationPlan,
  type CoordinationRun,
  type ProviderResourcePort,
  type SeasonAssembly,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  FIXED_NOW,
  FakePort,
  SEASON,
  attempt,
  completePort,
  fullPlan,
  metadataFor,
  publicationHarness,
  testOnlyProvisionalBound,
} from './support';
import { splitSeasonFixture } from './split-participation-support';

const UNCLASSIFIED_ROUND = 14;

async function coordinate(
  source: ProviderSeasonSource,
  options: {
    plan?: CoordinationPlan;
    ports?: ProviderResourcePort[];
    provisional?: boolean;
  } = {},
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports: options.ports ?? [completePort('jolpica', source)],
    logger: new CapturingLogger(),
    ...(options.provisional === true
      ? { provisionalSessionEndBound: testOnlyProvisionalBound }
      : {}),
  }).coordinate({ plan: options.plan ?? fullPlan(source) });
}

function assembled(assembly: SeasonAssembly): ProviderSeasonSource {
  if (!assembly.complete) {
    throw new Error(`not assembled: ${JSON.stringify(assembly)}`);
  }
  return assembly.source;
}

async function assemble(
  source: ProviderSeasonSource,
  options: Parameters<typeof coordinate>[1] = {},
): Promise<SeasonAssembly> {
  return assembleSeasonSource(
    await coordinate(source, options),
    metadataFor(source),
  );
}

/** `round -> hasResults` for an assembled calendar, in calendar order. */
function flags(source: ProviderSeasonSource): [number, boolean][] {
  return source.calendar.map((event) => [event.round, event.hasResults]);
}

function flagOf(source: ProviderSeasonSource, round: number): boolean {
  const event = source.calendar.find((candidate) => candidate.round === round);
  if (event === undefined) throw new Error(`fixture gap: round ${round}`);
  return event.hasResults;
}

/** A copy of `source` whose calendar events are mapped. */
function withEvents(
  source: ProviderSeasonSource,
  map: (event: GrandPrix) => GrandPrix,
): ProviderSeasonSource {
  return { ...source, calendar: source.calendar.map(map) };
}

/** A copy of `source` whose race result for one round is mapped. */
function withRaceResult(
  source: ProviderSeasonSource,
  round: number,
  map: (result: RaceResult) => RaceResult,
): ProviderSeasonSource {
  return {
    ...source,
    results: source.results.map((result) =>
      result.round === round && result.sessionType === 'race'
        ? map(result)
        : result,
    ),
  };
}

function raceResultOf(source: ProviderSeasonSource, round: number): RaceResult {
  const result = source.results.find(
    (candidate) =>
      candidate.round === round && candidate.sessionType === 'race',
  );
  if (result === undefined) throw new Error(`fixture gap: round ${round}`);
  return result;
}

/**
 * A `final`, fully populated non-race classification for the unclassified
 * round, built from round 13's rows and the shared identity constructor. It is
 * a perfectly valid coordination result that must still not set the flag.
 */
function nonRaceClassification(
  source: ProviderSeasonSource,
  sessionType: 'qualifying' | 'sprint' | 'sprint_qualifying',
): RaceResult {
  const event = source.calendar.find(
    (candidate) => candidate.round === UNCLASSIFIED_ROUND,
  )!;
  return {
    ...raceResultOf(source, 13),
    id: canonicalRaceResultId(event.id, sessionType),
    round: UNCLASSIFIED_ROUND,
    grandPrixId: event.id,
    sessionType,
    status: 'final',
  };
}

function classificationResource(
  round: number,
  sessionType: 'qualifying' | 'sprint' | 'sprint_qualifying' | 'race',
): CoordinatedResource {
  return { kind: 'session-classification', season: SEASON, round, sessionType };
}

describe('season assembly derives hasResults from selected classifications', () => {
  it('sets true for a round with a selected final race classification', async () => {
    // The contribution says false everywhere; that is evidence of nothing.
    const source = withEvents(await splitSeasonFixture(), (event) => ({
      ...event,
      hasResults: false,
    }));
    expect(raceResultOf(source, 13).status).toBe('final');

    const result = assembled(await assemble(source));

    expect(flagOf(result, 13)).toBe(true);
    expect(validateSeasonReferences(result)).toEqual([]);
  });

  it('sets true for a selected provisional Jolpica race classification', async () => {
    const source = withRaceResult(
      withEvents(await splitSeasonFixture(), (event) => ({
        ...event,
        hasResults: false,
      })),
      13,
      (result) => ({ ...result, status: 'provisional' }),
    );

    const run = await coordinate(source);
    const result = assembled(assembleSeasonSource(run, metadataFor(source)));

    expect(raceResultOf(result, 13).status).toBe('provisional');
    expect(flagOf(result, 13)).toBe(true);
    expect(validateSeasonReferences(result)).toEqual([]);

    const harness = await publicationHarness({
      seedSource: await splitSeasonFixture(),
    });
    const outcome = await new CoordinatedSeasonPublication({
      commands: harness.commands,
      logger: harness.logger,
    }).publish(run, metadataFor(source), FIXED_NOW, 'v-provisional');
    expect(outcome.outcome).toBe('published');
    if (outcome.outcome !== 'published') throw new Error('unreachable');
    expect(outcome.result.status).toBe('applied');
  });

  it('sets false for a selected unavailable race document, which is kept', async () => {
    const source = withEvents(await splitSeasonFixture(), (event) =>
      event.round === UNCLASSIFIED_ROUND
        ? { ...event, hasResults: true }
        : event,
    );
    const document = raceResultOf(source, UNCLASSIFIED_ROUND);
    expect(document.status).toBe('unavailable');

    const result = assembled(await assemble(source));

    expect(flagOf(result, UNCLASSIFIED_ROUND)).toBe(false);
    // The absence document is published unchanged, never discarded.
    expect(raceResultOf(result, UNCLASSIFIED_ROUND)).toEqual(document);
    expect(validateSeasonReferences(result)).toEqual([]);
  });

  it('sets false for a selected unknown race document', async () => {
    const source = withRaceResult(
      withEvents(await splitSeasonFixture(), (event) =>
        event.round === UNCLASSIFIED_ROUND
          ? { ...event, hasResults: true }
          : event,
      ),
      UNCLASSIFIED_ROUND,
      (result) => ({ ...result, status: 'unknown' }),
    );

    const result = assembled(await assemble(source));

    expect(raceResultOf(result, UNCLASSIFIED_ROUND).status).toBe('unknown');
    expect(flagOf(result, UNCLASSIFIED_ROUND)).toBe(false);
    expect(validateSeasonReferences(result)).toEqual([]);
  });

  for (const sessionType of [
    'qualifying',
    'sprint',
    'sprint_qualifying',
  ] as const) {
    it(`never sets true from a selected ${sessionType} classification`, async () => {
      const base = await splitSeasonFixture();
      const source = {
        ...base,
        results: [...base.results, nonRaceClassification(base, sessionType)],
      };
      const run = await coordinate(source, {
        plan: {
          season: SEASON,
          resources: [
            ...fullPlan(base).resources,
            classificationResource(UNCLASSIFIED_ROUND, sessionType),
          ],
        },
      });
      const selected = run.resources.find(
        (resource) =>
          resource.resource.kind === 'session-classification' &&
          resource.resource.sessionType === sessionType,
      )?.selection;
      expect(selected).toMatchObject({ outcome: 'selected' });

      const result = assembled(assembleSeasonSource(run, metadataFor(source)));

      expect(flagOf(result, UNCLASSIFIED_ROUND)).toBe(false);
      expect(validateSeasonReferences(result)).toEqual([]);
    });
  }

  it('never sets true from a considered but unselected race candidate', async () => {
    // Jolpica, the reconciled source, answers round 14 with its absence
    // document and is selected. OpenF1 offers a provisional classification for
    // the same round; it is attempted and a candidate, but not selected.
    const base = await splitSeasonFixture();
    const openf1Result: RaceResult = {
      ...raceResultOf(base, 13),
      id: raceResultOf(base, UNCLASSIFIED_ROUND).id,
      round: UNCLASSIFIED_ROUND,
      grandPrixId: raceResultOf(base, UNCLASSIFIED_ROUND).grandPrixId,
      status: 'provisional',
    };
    const openf1 = new FakePort('openf1', (request) =>
      request.resource.kind === 'session-classification' &&
      request.resource.round === UNCLASSIFIED_ROUND
        ? {
            outcome: 'candidate',
            attempts: [attempt('o-14')],
            payload: { kind: 'session-classification', result: openf1Result },
          }
        : {
            outcome: 'failed',
            attempts: [attempt(`o-${request.resource.kind}`, 'failed')],
            reason: 'provider-unavailable',
          },
    );
    const run = await coordinate(base, {
      ports: [completePort('jolpica', base), openf1],
      provisional: true,
    });
    const round14 = run.resources.find(
      (resource) =>
        resource.resource.kind === 'session-classification' &&
        resource.resource.round === UNCLASSIFIED_ROUND,
    );
    expect(round14?.selection).toMatchObject({
      outcome: 'selected',
      source: 'jolpica',
    });
    expect(
      round14?.contributions.find((item) => item.source === 'openf1'),
    ).toMatchObject({ status: 'candidate', attempted: true });

    const result = assembled(assembleSeasonSource(run, metadataFor(base)));

    expect(flagOf(result, UNCLASSIFIED_ROUND)).toBe(false);
    expect(raceResultOf(result, UNCLASSIFIED_ROUND).status).toBe('unavailable');
  });

  it('derives each event independently of every other', async () => {
    // Every contributed flag is the opposite of the truth.
    const source = withEvents(await splitSeasonFixture(), (event) => ({
      ...event,
      hasResults: event.round === UNCLASSIFIED_ROUND,
    }));

    const result = assembled(await assemble(source));

    expect(flags(result)).toEqual([
      [1, true],
      [11, true],
      [12, true],
      [13, true],
      [14, false],
    ]);
  });

  it('preserves every other event field, the session lists and the order', async () => {
    const source = withEvents(await splitSeasonFixture(), (event) => ({
      ...event,
      hasResults: !event.hasResults,
    }));
    // The contribution arrives in reverse round order.
    const reversed = { ...source, calendar: [...source.calendar].reverse() };
    const plan = fullPlan(source);
    const run = await coordinate(reversed, {
      plan: {
        season: SEASON,
        resources: [
          ...plan.resources,
          { kind: 'event-schedule', season: SEASON, round: 12 },
        ],
      },
    });

    const result = assembled(assembleSeasonSource(run, metadataFor(source)));

    expect(result.calendar.map((event) => event.round)).toEqual([
      1, 11, 12, 13, 14,
    ]);
    for (const event of result.calendar) {
      const supplied = source.calendar.find(
        (candidate) => candidate.round === event.round,
      )!;
      expect(event).toEqual({
        ...supplied,
        hasResults: event.round !== UNCLASSIFIED_ROUND,
      });
    }
  });

  it('mutates neither the calendar contribution nor any selected payload', async () => {
    const source = withEvents(await splitSeasonFixture(), (event) => ({
      ...event,
      hasResults: false,
    }));
    const run = await coordinate(source);
    const before = structuredClone(run);

    const result = assembled(assembleSeasonSource(run, metadataFor(source)));

    expect(flagOf(result, 13)).toBe(true);
    expect(run).toEqual(before);
    const calendar = run.resources.find(
      (resource) => resource.resource.kind === 'season-calendar',
    )?.selection;
    expect(
      calendar?.outcome === 'selected' &&
        calendar.payload.kind === 'season-calendar' &&
        calendar.payload.events.map((event) => event.hasResults),
    ).toEqual([false, false, false, false, false]);
  });
});

describe('calendar status never establishes result availability', () => {
  it('derives true under an unknown status from a selected Jolpica classification', async () => {
    // The Jolpica calendar shape: every status unknown, every flag false (A6).
    const source = withEvents(await splitSeasonFixture(), (event) => ({
      ...event,
      status: 'unknown',
      hasResults: false,
    }));

    const result = assembled(await assemble(source));

    expect(flags(result)).toEqual([
      [1, true],
      [11, true],
      [12, true],
      [13, true],
      [14, false],
    ]);
    expect(result.calendar.every((event) => event.status === 'unknown')).toBe(
      true,
    );
    expect(validateSeasonReferences(result)).toEqual([]);
  });

  it('withholds a completed round without a classified race result', async () => {
    // `completed` requires a classification (ADR 0023 D11). It does not make
    // the flag true: the existing completeness rule withholds the season.
    const source = withEvents(await splitSeasonFixture(), (event) =>
      event.round === UNCLASSIFIED_ROUND
        ? { ...event, status: 'completed', hasResults: true }
        : event,
    );

    const assembly = await assemble(source);

    expect(assembly).toEqual({
      complete: false,
      gap: 'missing-round-classification',
      missing: [classificationResource(UNCLASSIFIED_ROUND, 'race')],
      relations: [],
    });
  });

  it('derives false for an unclassified round whatever its status', async () => {
    for (const status of [
      'scheduled',
      'upcoming',
      'in_progress',
      'postponed',
      'cancelled',
      'unknown',
    ] as const) {
      const source = withEvents(await splitSeasonFixture(), (event) =>
        event.round === UNCLASSIFIED_ROUND
          ? { ...event, status, hasResults: true }
          : event,
      );

      const result = assembled(await assemble(source));

      expect(flagOf(result, UNCLASSIFIED_ROUND), status).toBe(false);
    }
  });
});

describe('the post-assembly relations stay unchanged', () => {
  it('rejects a mutated assembled candidate in both mismatch directions', async () => {
    const result = assembled(await assemble(await splitSeasonFixture()));
    expect(validateSeasonReferences(result)).toEqual([]);

    // A classification the calendar hides.
    const hidden = withEvents(result, (event) =>
      event.round === 13 ? { ...event, hasResults: false } : event,
    );
    expect(validateSeasonReferences(hidden)).toContain('event-has-results');

    // A classification the calendar advertises but the results do not hold.
    const advertised = withEvents(result, (event) =>
      event.round === UNCLASSIFIED_ROUND
        ? { ...event, hasResults: true }
        : event,
    );
    expect(validateSeasonReferences(advertised)).toContain('event-has-results');
  });

  it('withholds a selected result that names another event at its round', async () => {
    // A7 joins by round; `result-event` is what proves that round's result
    // belongs to the canonical event there. Its own id stays canonical for the
    // event it names, so only the event join is wrong.
    const base = await splitSeasonFixture();
    const elsewhere = 'season-2026-atlantis-grand-prix';
    const source = withRaceResult(base, 13, (result) => ({
      ...result,
      grandPrixId: elsewhere,
      id: canonicalRaceResultId(elsewhere, 'race'),
    }));

    const assembly = await assemble(source);

    expect(assembly).toEqual({
      complete: false,
      gap: 'inconsistent-references',
      missing: [],
      relations: ['result-event'],
    });
  });

  it('still withholds a classified race selected from OpenF1', async () => {
    // A7 may compute `true` for round 14 from the OpenF1 classification, but
    // the Jolpica-only participation rule (ADR 0026 D3) withholds the whole
    // season before any candidate exists, so nothing new becomes publishable.
    const base = await splitSeasonFixture();
    const openf1Result: RaceResult = {
      ...raceResultOf(base, 13),
      id: raceResultOf(base, UNCLASSIFIED_ROUND).id,
      round: UNCLASSIFIED_ROUND,
      grandPrixId: raceResultOf(base, UNCLASSIFIED_ROUND).grandPrixId,
      status: 'provisional',
    };
    const jolpica = completePort('jolpica', base);
    const reconciled = new FakePort('jolpica', (request) =>
      request.resource.kind === 'session-classification' &&
      request.resource.round === UNCLASSIFIED_ROUND
        ? {
            outcome: 'failed',
            attempts: [attempt('j-14', 'failed')],
            reason: 'provider-unavailable',
          }
        : jolpica.fetchResource(request),
    );
    const openf1 = new FakePort('openf1', (request) =>
      request.resource.kind === 'session-classification' &&
      request.resource.round === UNCLASSIFIED_ROUND
        ? {
            outcome: 'candidate',
            attempts: [attempt('o-14')],
            payload: { kind: 'session-classification', result: openf1Result },
          }
        : {
            outcome: 'failed',
            attempts: [attempt(`o-${request.resource.kind}`, 'failed')],
            reason: 'provider-unavailable',
          },
    );
    const run = await coordinate(base, {
      ports: [reconciled, openf1],
      provisional: true,
    });
    expect(
      run.resources.find(
        (resource) =>
          resource.resource.kind === 'session-classification' &&
          resource.resource.round === UNCLASSIFIED_ROUND,
      )?.selection,
    ).toMatchObject({ outcome: 'selected', source: 'openf1' });

    expect(assembleSeasonSource(run, metadataFor(base))).toEqual({
      complete: false,
      gap: 'inconsistent-references',
      missing: [],
      relations: ['result-entry-span'],
    });

    const harness = await publicationHarness();
    const outcome = await new CoordinatedSeasonPublication({
      commands: harness.commands,
      logger: harness.logger,
    }).publish(run, metadataFor(base), FIXED_NOW, 'v-openf1');
    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });
});
