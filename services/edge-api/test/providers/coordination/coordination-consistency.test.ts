/**
 * Request-to-payload binding and candidate/attempt consistency.
 *
 * Two separate promises the coordinator makes about a candidate:
 *
 * 1. A selected payload answers the **exact** logical resource it was selected
 *    for, including every identity field the normalized contract carries. A
 *    2026 standings request cannot be answered with 2025 rows.
 * 2. A `candidate` outcome is usable only when its own transport attempt says
 *    the request succeeded. An outcome claiming usable data while its attempt
 *    record says the transport failed describes no possible run.
 *
 * Both fail **closed as a whole contribution**: nothing is filtered, no valid
 * subset is published, and the affected resource becomes unavailable.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  coordinationFor,
  isWellFormedOutcome,
  payloadMatchesResource,
  type CoordinatedPayload,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import type { ProviderAttemptOutcome } from '../../../src/providers/provider-metrics';
import {
  FIXED_NOW,
  FakePort,
  SEASON,
  attempt,
  completePort,
  fullPlan,
  metadataFor,
  payloadFor,
  publicationHarness,
  raceResource,
  seasonFixture,
  seasonResources,
  testOnlyProvisionalBound,
} from './support';

const CALENDAR = seasonResources[0] as CoordinatedResource;
const PARTICIPANTS = seasonResources[1] as CoordinatedResource;
const CIRCUITS = seasonResources[2] as CoordinatedResource;
const DRIVER_STANDINGS = seasonResources[3] as CoordinatedResource;
const CONSTRUCTOR_STANDINGS = seasonResources[4] as CoordinatedResource;

const OTHER_SEASON = SEASON - 1;

function coordinate(
  ports: FakePort[],
  resources: readonly CoordinatedResource[],
  logger = new CapturingLogger(),
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({ ports, logger }).coordinate({
    plan: { season: SEASON, resources },
  });
}

/** The curated payload for one resource. Never hand-written. */
function fixturePayload(
  source: ProviderSeasonSource,
  resource: CoordinatedResource,
): CoordinatedPayload {
  const payload = payloadFor(source, resource);
  if (payload === null) throw new Error('fixture gap');
  return payload;
}

/** A port that answers every resource with one supplied payload. */
function payloadPort(
  payload: unknown,
  attemptOutcome: ProviderAttemptOutcome = 'successful',
): FakePort {
  return new FakePort(
    'jolpica',
    () =>
      ({
        outcome: 'candidate',
        attempt: attempt('j-1', attemptOutcome),
        payload,
      }) as ProviderResourceOutcome,
  );
}

/** Replaces the `season` of exactly one entry of a curated collection. */
function withSeasonAt<T extends { season: number }>(
  entries: readonly T[],
  index: number,
  season: unknown,
): T[] {
  return entries.map((entry, position) =>
    position === index ? { ...entry, season: season as number } : { ...entry },
  );
}

/** Replaces the `season` of every entry of a curated collection. */
function withSeasonEverywhere<T extends { season: number }>(
  entries: readonly T[],
  season: unknown,
): T[] {
  return entries.map((entry) => ({ ...entry, season: season as number }));
}

/** Drops the `season` property entirely, keeping every other field. */
function withoutSeason<T extends { season: number }>(
  entries: readonly T[],
): Record<string, unknown>[] {
  return entries.map((entry) => {
    const copy: Record<string, unknown> = { ...entry };
    delete copy.season;
    return copy;
  });
}

describe('a season-scoped candidate is bound to the requested season', () => {
  it('accepts driver standings whose every entry names the requested season', async () => {
    const source = await seasonFixture();
    const payload = fixturePayload(source, DRIVER_STANDINGS);

    expect(source.driverStandings.length).toBeGreaterThan(0);
    expect(payloadMatchesResource(DRIVER_STANDINGS, payload)).toBe(true);

    const run = await coordinate([payloadPort(payload)], [DRIVER_STANDINGS]);
    expect(run.resources[0]?.selection.outcome).toBe('selected');
  });

  it('accepts constructor standings whose every entry names the requested season', async () => {
    const source = await seasonFixture();
    const payload = fixturePayload(source, CONSTRUCTOR_STANDINGS);

    expect(source.constructorStandings.length).toBeGreaterThan(0);
    expect(payloadMatchesResource(CONSTRUCTOR_STANDINGS, payload)).toBe(true);

    const run = await coordinate(
      [payloadPort(payload)],
      [CONSTRUCTOR_STANDINGS],
    );
    expect(run.resources[0]?.selection.outcome).toBe('selected');
  });

  it('rejects standings whose every entry belongs to another season', async () => {
    const source = await seasonFixture();
    const wrong = {
      kind: 'driver-standings',
      standings: withSeasonEverywhere(source.driverStandings, OTHER_SEASON),
    };

    expect(payloadMatchesResource(DRIVER_STANDINGS, wrong)).toBe(false);

    const run = await coordinate([payloadPort(wrong)], [DRIVER_STANDINGS]);
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    expect(run.resources[0]?.contributions[0]?.reason).toBe(
      'malformed-outcome',
    );
  });

  it('rejects the whole contribution for one wrong-season row', async () => {
    const source = await seasonFixture();
    const wrong = {
      kind: 'constructor-standings',
      standings: withSeasonAt(source.constructorStandings, 0, OTHER_SEASON),
    };

    expect(source.constructorStandings.length).toBeGreaterThan(1);
    expect(payloadMatchesResource(CONSTRUCTOR_STANDINGS, wrong)).toBe(false);

    const run = await coordinate([payloadPort(wrong)], [CONSTRUCTOR_STANDINGS]);
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
  });

  it('never turns a mixed-season collection into a filtered partial candidate', async () => {
    const source = await seasonFixture();
    const wrong = {
      kind: 'driver-standings',
      standings: withSeasonAt(source.driverStandings, 1, OTHER_SEASON),
    };

    const run = await coordinate([payloadPort(wrong)], [DRIVER_STANDINGS]);
    const contribution = run.resources[0]?.contributions[0];

    // No valid subset survives: the payload is dropped whole.
    expect(contribution?.status).toBe('failed');
    expect(contribution?.payload).toBeNull();
    expect(JSON.stringify(run)).not.toContain(String(OTHER_SEASON));
  });

  it('rejects season-bearing participant entries from another season', async () => {
    const source = await seasonFixture();
    const wrong = {
      kind: 'season-participants',
      drivers: source.drivers,
      constructors: source.constructors,
      driverEntries: withSeasonEverywhere(source.driverEntries, OTHER_SEASON),
      constructorEntries: source.constructorEntries,
    };

    expect(source.driverEntries.length).toBeGreaterThan(0);
    expect(payloadMatchesResource(PARTICIPANTS, wrong)).toBe(false);

    const run = await coordinate([payloadPort(wrong)], [PARTICIPANTS]);
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
  });

  it('rejects the whole participants contribution for one wrong-season entry', async () => {
    const source = await seasonFixture();
    const wrong = {
      kind: 'season-participants',
      drivers: source.drivers,
      constructors: source.constructors,
      driverEntries: source.driverEntries,
      constructorEntries: withSeasonAt(
        source.constructorEntries,
        0,
        OTHER_SEASON,
      ),
    };

    expect(source.constructorEntries.length).toBeGreaterThan(1);
    expect(payloadMatchesResource(PARTICIPANTS, wrong)).toBe(false);

    const run = await coordinate([payloadPort(wrong)], [PARTICIPANTS]);
    expect(run.resources[0]?.contributions[0]?.payload).toBeNull();
  });

  it('requires an identity field only where the normalized contract carries one', async () => {
    const source = await seasonFixture();

    // A standing without its `season` cannot prove it answers this request.
    const missing = {
      kind: 'driver-standings',
      standings: withoutSeason(source.driverStandings),
    };
    expect(payloadMatchesResource(DRIVER_STANDINGS, missing)).toBe(false);

    // A circuit carries no season in the normalized contract, so none is
    // demanded of it: widening a DTO to create an identity field is not this
    // seam's business.
    expect(
      payloadMatchesResource(CIRCUITS, fixturePayload(source, CIRCUITS)),
    ).toBe(true);
    // Drivers and constructors are season-independent profiles for the same
    // reason; the entry collections beside them carry the season instead.
    expect(
      payloadMatchesResource(
        PARTICIPANTS,
        fixturePayload(source, PARTICIPANTS),
      ),
    ).toBe(true);
  });

  it('fails closed on string, fractional, non-finite and absent season values', async () => {
    const source = await seasonFixture();
    const hostileSeasons: unknown[] = [
      String(SEASON),
      SEASON + 0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      null,
      undefined,
      { valueOf: () => SEASON },
      [SEASON],
      true,
    ];

    for (const season of hostileSeasons) {
      const payload = {
        kind: 'driver-standings',
        standings: withSeasonAt(source.driverStandings, 0, season),
      };
      expect(
        payloadMatchesResource(DRIVER_STANDINGS, payload),
        `season ${String(season)} must not match`,
      ).toBe(false);

      const run = await coordinate([payloadPort(payload)], [DRIVER_STANDINGS]);
      expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    }
  });

  it('contains a throwing identity getter instead of letting it escape', async () => {
    const source = await seasonFixture();
    const first = source.driverStandings[0];
    if (first === undefined) throw new Error('fixture gap');
    const hostileEntry = {
      ...first,
      get season(): number {
        throw new Error('hostile season accessor');
      },
    };
    const payload = {
      kind: 'driver-standings',
      standings: [hostileEntry, ...source.driverStandings.slice(1)],
    };

    const logger = new CapturingLogger();
    const run = await coordinate(
      [payloadPort(payload)],
      [DRIVER_STANDINGS],
      logger,
    );

    expect(run.status).toBe('completed');
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    expect(run.resources[0]?.contributions[0]?.reason).toBe(
      'malformed-outcome',
    );
    expect(logger.serialized()).not.toContain('hostile season accessor');
  });

  it('keeps a rejected payload out of season assembly', async () => {
    const source = await seasonFixture();
    const port = new FakePort(
      'jolpica',
      (request) =>
        ({
          outcome: 'candidate',
          attempt: attempt(`j-${request.resource.kind}`),
          payload:
            request.resource.kind === 'driver-standings'
              ? {
                  kind: 'driver-standings',
                  standings: withSeasonEverywhere(
                    source.driverStandings,
                    OTHER_SEASON,
                  ),
                }
              : fixturePayload(source, request.resource),
        }) as ProviderResourceOutcome,
    );

    const run = await coordinate([port], fullPlan(source).resources);
    const assembly = assembleSeasonSource(run, metadataFor(source));

    expect(assembly.complete).toBe(false);
    if (assembly.complete) return;
    expect(assembly.gap).toBe('resource-unavailable');
    expect(assembly.missing).toEqual([DRIVER_STANDINGS]);
  });

  it('never publishes a rejected payload', async () => {
    const source = await seasonFixture();
    const harness = publicationHarness();
    const port = new FakePort(
      'jolpica',
      (request) =>
        ({
          outcome: 'candidate',
          attempt: attempt(`j-${request.resource.kind}`),
          payload:
            request.resource.kind === 'season-participants'
              ? {
                  kind: 'season-participants',
                  drivers: source.drivers,
                  constructors: source.constructors,
                  driverEntries: withSeasonEverywhere(
                    source.driverEntries,
                    OTHER_SEASON,
                  ),
                  constructorEntries: source.constructorEntries,
                }
              : fixturePayload(source, request.resource),
        }) as ProviderResourceOutcome,
    );

    const run = await new MultiSourceCoordinator({
      ports: [port],
      logger: harness.logger,
    }).coordinate({ plan: fullPlan(source) });
    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(run, metadataFor(source), FIXED_NOW, 'v1');

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });

  it('leaves unrelated resources usable while one is rejected', async () => {
    const source = await seasonFixture();
    const port = new FakePort(
      'jolpica',
      (request) =>
        ({
          outcome: 'candidate',
          attempt: attempt(`j-${request.resource.kind}`),
          payload:
            request.resource.kind === 'driver-standings'
              ? {
                  kind: 'driver-standings',
                  standings: withSeasonEverywhere(
                    source.driverStandings,
                    OTHER_SEASON,
                  ),
                }
              : fixturePayload(source, request.resource),
        }) as ProviderResourceOutcome,
    );

    const run = await coordinate(
      [port],
      [CALENDAR, DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
    );

    expect(coordinationFor(run, CALENDAR)?.selection.outcome).toBe('selected');
    expect(coordinationFor(run, CONSTRUCTOR_STANDINGS)?.selection.outcome).toBe(
      'selected',
    );
    expect(coordinationFor(run, DRIVER_STANDINGS)?.selection.outcome).toBe(
      'unavailable',
    );
  });
});

describe('a candidate requires a successful transport attempt', () => {
  it('accepts a candidate whose attempt succeeded', async () => {
    const source = await seasonFixture();
    const payload = fixturePayload(source, CALENDAR);

    expect(
      isWellFormedOutcome({
        outcome: 'candidate',
        attempt: attempt('j-1', 'successful'),
        payload,
      }),
    ).toBe(true);

    const run = await coordinate([payloadPort(payload)], [CALENDAR]);
    expect(run.resources[0]?.selection.outcome).toBe('selected');
    expect(run.accounting.lifetime.successful).toBe(1);
  });

  it('rejects a candidate whose attempt failed', async () => {
    const source = await seasonFixture();
    const payload = fixturePayload(source, CALENDAR);

    expect(
      isWellFormedOutcome({
        outcome: 'candidate',
        attempt: attempt('j-1', 'failed'),
        payload,
      }),
    ).toBe(false);

    const run = await coordinate([payloadPort(payload, 'failed')], [CALENDAR]);
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    expect(run.resources[0]?.contributions[0]?.reason).toBe(
      'malformed-outcome',
    );
  });

  it('rejects a candidate whose attempt was rate-limited', async () => {
    const source = await seasonFixture();
    const payload = fixturePayload(source, CALENDAR);

    expect(
      isWellFormedOutcome({
        outcome: 'candidate',
        attempt: attempt('j-1', 'rate-limited'),
        payload,
      }),
    ).toBe(false);

    const run = await coordinate(
      [payloadPort(payload, 'rate-limited')],
      [CALENDAR],
    );
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    expect(run.resources[0]?.contributions[0]?.reason).toBe(
      'malformed-outcome',
    );
  });

  it('rejects a candidate for every non-successful attempt outcome', async () => {
    const source = await seasonFixture();
    const payload = fixturePayload(source, CALENDAR);
    const nonSuccess: unknown[] = [
      'failed',
      'rate-limited',
      'Successful',
      'success',
      '',
      null,
      undefined,
      0,
      1,
      true,
    ];

    for (const outcome of nonSuccess) {
      expect(
        isWellFormedOutcome({
          outcome: 'candidate',
          attempt: { reference: 'j-1', outcome },
          payload,
        }),
        `attempt outcome ${String(outcome)} must not admit a candidate`,
      ).toBe(false);
    }
  });

  it('cannot select or publish a contradictory candidate', async () => {
    const source = await seasonFixture();
    const harness = publicationHarness();
    const port = new FakePort(
      'jolpica',
      (request) =>
        ({
          outcome: 'candidate',
          attempt: attempt(
            `j-${request.resource.kind}`,
            request.resource.kind === 'season-circuits'
              ? 'rate-limited'
              : 'successful',
          ),
          payload: fixturePayload(source, request.resource),
        }) as ProviderResourceOutcome,
    );

    const run = await new MultiSourceCoordinator({
      ports: [port],
      logger: harness.logger,
    }).coordinate({ plan: fullPlan(source) });
    const assembly = assembleSeasonSource(run, metadataFor(source));
    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(run, metadataFor(source), FIXED_NOW, 'v1');

    expect(coordinationFor(run, CIRCUITS)?.selection.outcome).toBe(
      'unavailable',
    );
    expect(assembly.complete).toBe(false);
    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });

  it('still classifies an ordinary failed outcome as an attempted failure', async () => {
    const port = new FakePort('jolpica', () => ({
      outcome: 'failed',
      attempt: attempt('j-1', 'failed'),
      reason: 'provider-unavailable',
    }));

    const run = await coordinate([port], [CALENDAR]);
    const contribution = run.resources[0]?.contributions[0];

    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('provider-unavailable');
    expect(contribution?.attempted).toBe(true);
    expect(run.accounting.lifetime.failed).toBe(1);
  });

  it('still classifies an ordinary rate-limited outcome as an attempted failure', async () => {
    const port = new FakePort('jolpica', () => ({
      outcome: 'failed',
      attempt: attempt('j-1', 'rate-limited'),
      reason: 'provider-rate-limited',
      retryAfter: '2026-07-20T12:05:00.000Z',
    }));

    const run = await coordinate([port], [CALENDAR]);
    const contribution = run.resources[0]?.contributions[0];

    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('provider-rate-limited');
    expect(contribution?.attempted).toBe(true);
    expect(contribution?.retryAfter).toBe('2026-07-20T12:05:00.000Z');
    expect(run.accounting.lifetime.rateLimited).toBe(1);
  });

  it('counts no request for a contradictory candidate, and one for a wrong-season one', async () => {
    const source = await seasonFixture();
    const payload = fixturePayload(source, DRIVER_STANDINGS);

    // A contradictory outcome makes its own attempt record unusable: nothing
    // it claims is believed, so no request activity is invented from it. This
    // under-reports rather than over-reports, exactly as ADR 0023 D6 already
    // decides for a coordination failure, and the Durable Object reservation
    // ledger remains the pacing authority.
    for (const outcome of ['failed', 'rate-limited'] as const) {
      const run = await coordinate(
        [payloadPort(payload, outcome)],
        [DRIVER_STANDINGS],
      );
      expect(run.accounting.lifetime.total).toBe(0);
      expect(run.counts.attempted).toBe(0);
      expect(run.resources[0]?.contributions[0]?.attempted).toBe(false);
    }

    // A wrong-season payload is a different case: the outcome is well formed
    // and its separately validated attempt says a request left GridView and
    // was answered, so that request is preserved in the accounting even though
    // the contribution itself is rejected.
    const wrongSeason = await coordinate(
      [
        payloadPort({
          kind: 'driver-standings',
          standings: withSeasonEverywhere(source.driverStandings, OTHER_SEASON),
        }),
      ],
      [DRIVER_STANDINGS],
    );
    expect(wrongSeason.accounting.lifetime.total).toBe(1);
    expect(wrongSeason.accounting.lifetime.successful).toBe(1);
    expect(wrongSeason.counts.attempted).toBe(1);
  });

  it('counts one transport request once when it serves several resources', async () => {
    const source = await seasonFixture();
    const port = new FakePort('jolpica', (request) => ({
      outcome: 'candidate',
      attempt: attempt('shared-reference'),
      payload: fixturePayload(source, request.resource),
    }));

    const run = await coordinate([port], [DRIVER_STANDINGS, CIRCUITS]);

    expect(run.counts.selected).toBe(2);
    expect(run.accounting.lifetime.total).toBe(1);
    expect(run.accounting.lifetime.successful).toBe(1);
  });

  it('keeps a hostile contradictory outcome out of the logs', async () => {
    const hostile = 'https://api.jolpi.ca/2026?token=SECRET';
    const logger = new CapturingLogger();
    const port = new FakePort(
      'jolpica',
      () =>
        ({
          outcome: 'candidate',
          attempt: attempt(hostile, 'failed'),
          payload: {
            kind: 'driver-standings',
            standings: [{ season: hostile }],
          },
        }) as unknown as ProviderResourceOutcome,
    );

    const run = await coordinate([port], [DRIVER_STANDINGS], logger);
    const serialized = logger.serialized();

    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('jolpi.ca');
    expect(serialized).not.toContain('reference');
  });

  it('produces the same result whichever source completes first', async () => {
    const source = await seasonFixture();
    const wrong = {
      kind: 'driver-standings',
      standings: withSeasonEverywhere(source.driverStandings, OTHER_SEASON),
    };
    const yielded = (): Promise<void> =>
      new Promise((resolve) => {
        queueMicrotask(resolve);
      });

    const reconciled = new FakePort('jolpica', async () => {
      await yielded();
      return {
        outcome: 'candidate',
        attempt: attempt('j-1', 'failed'),
        payload: wrong,
      } as ProviderResourceOutcome;
    });
    const provisional = new FakePort(
      'openf1',
      () =>
        ({
          outcome: 'candidate',
          attempt: attempt('o-1'),
          payload: wrong,
        }) as unknown as ProviderResourceOutcome,
    );

    for (const ports of [
      [reconciled, provisional],
      [provisional, reconciled],
    ]) {
      const run = await new MultiSourceCoordinator({
        ports,
        logger: new CapturingLogger(),
        provisionalSessionEndBound: testOnlyProvisionalBound,
        maxConcurrentOperations: 2,
      }).coordinate({
        plan: { season: SEASON, resources: [DRIVER_STANDINGS] },
      });

      // The reconciled contribution is contradictory and the provisional one
      // is bound to the wrong season: neither survives, in either order, and
      // only the provisional source's believable attempt is counted.
      expect(run.resources[0]?.selection.outcome).toBe('unavailable');
      expect(run.accounting.lifetime.total).toBe(1);
    }
  });

  it('keeps reconciled precedence over provisional intact', async () => {
    const source = await seasonFixture();
    const run = await new MultiSourceCoordinator({
      ports: [completePort('jolpica', source), completePort('openf1', source)],
      logger: new CapturingLogger(),
      provisionalSessionEndBound: testOnlyProvisionalBound,
    }).coordinate({
      plan: {
        season: SEASON,
        resources: [DRIVER_STANDINGS, raceResource(12)],
      },
    });

    for (const resource of run.resources) {
      expect(resource.selection.outcome).toBe('selected');
      if (resource.selection.outcome !== 'selected') continue;
      expect(resource.selection.source).toBe('jolpica');
      expect(resource.selection.role).toBe('reconciled');
    }
  });
});
