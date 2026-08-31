/**
 * The coordinator owns a **detached snapshot** of every accepted candidate.
 *
 * `payloadMatchesResource` decides whether an answer belongs to the question
 * that was asked. That decision is only worth anything if the value it decided
 * about is the value that is later selected, assembled and published - which is
 * not true of a reference the adapter still holds. An adapter that keeps its
 * payload object, reuses one buffer across requests, or answers through an
 * accessor can let a 2026 standings payload pass validation and become a 2025
 * payload before assembly copies its rows.
 *
 * The invariant this file pins:
 *
 * > The payload stored in a contribution and later assembled is the same
 * > detached value that passed resource-binding validation.
 *
 * It is a **time-of-check/time-of-use and aliasing** property, deliberately
 * distinct from deep normalized-contract validation, which stays an adapter
 * responsibility and an activation gate (ADR 0023 D14).
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  payloadMatchesResource,
  type CoordinatedPayload,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
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

/**
 * A deep copy used **only** to state expectations, never by production code.
 *
 * Deliberately not the mechanism under test: an expectation built with the same
 * primitive as the implementation could hide a normalization both share.
 */
function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A port that answers every resource with one supplied payload object. */
function payloadPort(payload: unknown, reference = 'j-1'): FakePort {
  return new FakePort(
    'jolpica',
    () =>
      ({
        outcome: 'candidate',
        attempt: attempt(reference),
        payload,
      }) as ProviderResourceOutcome,
  );
}

/** The payload the coordinator retained for one resource kind, or `null`. */
function selectedPayload(
  run: CoordinationRun,
  resource: CoordinatedResource,
): CoordinatedPayload | null {
  for (const coordination of run.resources) {
    if (coordination.resource.kind !== resource.kind) continue;
    if (coordination.selection.outcome !== 'selected') continue;
    return coordination.selection.payload;
  }
  return null;
}

function seasonsOf(value: unknown): unknown[] {
  return Array.isArray(value)
    ? value.map((entry) => (entry as Record<string, unknown>).season)
    : [];
}

function contributionOf(
  run: CoordinationRun,
  source: string,
): CoordinationRun['resources'][number]['contributions'][number] | undefined {
  return run.resources[0]?.contributions.find(
    (entry) => entry.source === source,
  );
}

describe('an accepted candidate is detached from the adapter that produced it', () => {
  it('keeps driver standings the adapter mutates after coordination', async () => {
    const source = await seasonFixture();
    const payload = deepCopy(fixturePayload(source, DRIVER_STANDINGS));
    const expected = deepCopy(payload);
    expect(payloadMatchesResource(DRIVER_STANDINGS, payload)).toBe(true);

    const run = await coordinate([payloadPort(payload)], [DRIVER_STANDINGS]);
    expect(run.resources[0]?.selection.outcome).toBe('selected');

    // The adapter still holds its own object and rewrites every row's season
    // after the contribution was classified.
    const rows = (
      payload as unknown as { standings: Record<string, unknown>[] }
    ).standings;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) row.season = OTHER_SEASON;

    const stored = selectedPayload(run, DRIVER_STANDINGS);
    expect(stored).toEqual(expected);
    expect(
      seasonsOf((stored as unknown as { standings: unknown }).standings).every(
        (season) => season === SEASON,
      ),
    ).toBe(true);
  });

  it('keeps constructor standings the adapter mutates after coordination', async () => {
    const source = await seasonFixture();
    const payload = deepCopy(fixturePayload(source, CONSTRUCTOR_STANDINGS));
    const expected = deepCopy(payload);

    const run = await coordinate(
      [payloadPort(payload)],
      [CONSTRUCTOR_STANDINGS],
    );
    expect(run.resources[0]?.selection.outcome).toBe('selected');

    const rows = (
      payload as unknown as { standings: Record<string, unknown>[] }
    ).standings;
    const first = rows[0];
    if (first === undefined) throw new Error('fixture gap');
    first.season = OTHER_SEASON;
    first.points = -1;

    expect(selectedPayload(run, CONSTRUCTOR_STANDINGS)).toEqual(expected);
  });

  it('keeps a calendar whose nested session arrays are rewritten afterwards', async () => {
    const source = await seasonFixture();
    const payload = deepCopy(fixturePayload(source, CALENDAR));
    const expected = deepCopy(payload);

    const run = await coordinate([payloadPort(payload)], [CALENDAR]);
    expect(run.resources[0]?.selection.outcome).toBe('selected');

    const events = (payload as unknown as { events: Record<string, unknown>[] })
      .events;
    const event = events[0];
    if (event === undefined) throw new Error('fixture gap');
    expect(Array.isArray(event.sessions)).toBe(true);
    (event.sessions as unknown[]).length = 0;
    (event.sessions as unknown[]).push({ hostile: true });
    event.season = OTHER_SEASON;

    expect(selectedPayload(run, CALENDAR)).toEqual(expected);
  });

  it('keeps a race classification whose nested entries are rewritten afterwards', async () => {
    const source = await seasonFixture();
    const round = source.calendar[0]?.round;
    if (round === undefined) throw new Error('fixture gap');
    const resource = raceResource(round);
    const payload = deepCopy(fixturePayload(source, resource));
    const expected = deepCopy(payload);

    const run = await coordinate([payloadPort(payload)], [resource]);
    expect(run.resources[0]?.selection.outcome).toBe('selected');

    const result = (payload as unknown as { result: Record<string, unknown> })
      .result;
    (result.entries as unknown[]).length = 0;
    result.season = OTHER_SEASON;

    expect(selectedPayload(run, resource)).toEqual(expected);
  });

  it('keeps season participants whose nested entry collections are rewritten', async () => {
    const source = await seasonFixture();
    const payload = deepCopy(fixturePayload(source, PARTICIPANTS));
    const expected = deepCopy(payload);

    const run = await coordinate([payloadPort(payload)], [PARTICIPANTS]);
    expect(run.resources[0]?.selection.outcome).toBe('selected');

    const record = payload as unknown as Record<
      string,
      Record<string, unknown>[]
    >;
    for (const entry of record.driverEntries ?? []) entry.season = OTHER_SEASON;
    for (const driver of record.drivers ?? []) driver.fullName = 'rewritten';

    expect(selectedPayload(run, PARTICIPANTS)).toEqual(expected);
  });

  it('assembles the season from the validated snapshot, not from mutated adapter data', async () => {
    const source = await seasonFixture();
    const run = await coordinate(
      [completePort('jolpica', source)],
      fullPlan(source).resources,
    );
    expect(run.status).toBe('completed');

    // Everything the fake handed over is still reachable from the fixture the
    // port answered from. Rewriting it now must not reach assembly.
    for (const standing of source.driverStandings) {
      (standing as { season: number }).season = OTHER_SEASON;
    }
    for (const event of source.calendar) {
      (event as { season: number }).season = OTHER_SEASON;
    }

    const assembly = assembleSeasonSource(run, metadataFor(source));
    expect(assembly.complete).toBe(true);
    if (!assembly.complete) return;
    expect(
      assembly.source.driverStandings.every(
        (standing) => standing.season === SEASON,
      ),
    ).toBe(true);
    expect(
      assembly.source.calendar.every((event) => event.season === SEASON),
    ).toBe(true);
  });
});

describe('a reused adapter buffer cannot change an already-classified contribution', () => {
  it('does not let a later request rewrite an earlier accepted payload', async () => {
    const source = await seasonFixture();
    const driverRows = deepCopy([
      ...source.driverStandings,
    ]) as unknown as Record<string, unknown>[];
    const constructorRows = deepCopy([
      ...source.constructorStandings,
    ]) as unknown as Record<string, unknown>[];
    const expectedDrivers = deepCopy(driverRows);
    const expectedConstructors = deepCopy(constructorRows);

    // One array instance, refilled in place for every request.
    const buffer: Record<string, unknown>[] = [];
    let sequence = 0;
    const port = new FakePort('jolpica', (request) => {
      sequence += 1;
      buffer.length = 0;
      buffer.push(
        ...(request.resource.kind === 'driver-standings'
          ? driverRows
          : constructorRows),
      );
      return {
        outcome: 'candidate',
        attempt: attempt(`j-${sequence}`),
        payload: { kind: request.resource.kind, standings: buffer },
      } as unknown as ProviderResourceOutcome;
    });

    const run = await coordinate(
      [port],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
    );
    expect(run.counts.selected).toBe(2);

    const drivers = selectedPayload(run, DRIVER_STANDINGS) as unknown as {
      standings: unknown[];
    };
    const constructors = selectedPayload(
      run,
      CONSTRUCTOR_STANDINGS,
    ) as unknown as { standings: unknown[] };
    expect(drivers.standings).toEqual(expectedDrivers);
    expect(constructors.standings).toEqual(expectedConstructors);
    // Two contributions built from one adapter buffer must not alias.
    expect(drivers.standings).not.toBe(constructors.standings);
  });

  it('does not let a fallback candidate mutate the selected one', async () => {
    const source = await seasonFixture();
    const shared = deepCopy(
      fixturePayload(source, DRIVER_STANDINGS),
    ) as unknown as { standings: Record<string, unknown>[] };
    const expected = deepCopy(shared);

    const reconciled = payloadPort(shared, 'j-1');
    const provisional = new FakePort('openf1', () => {
      // The provisional adapter hands back the *same* object graph and then
      // rewrites it, which must not reach the reconciled selection.
      for (const row of shared.standings) row.season = OTHER_SEASON;
      return {
        outcome: 'candidate',
        attempt: attempt('o-1'),
        payload: shared,
      } as unknown as ProviderResourceOutcome;
    });

    const run = await new MultiSourceCoordinator({
      ports: [reconciled, provisional],
      logger: new CapturingLogger(),
      provisionalSessionEndBound: testOnlyProvisionalBound,
    }).coordinate({ plan: { season: SEASON, resources: [DRIVER_STANDINGS] } });

    const selection = run.resources[0]?.selection;
    expect(selection?.outcome).toBe('selected');
    if (selection?.outcome !== 'selected') return;
    expect(selection.source).toBe('jolpica');
    expect(selection.payload).toEqual(expected);
  });

  it('detaches identically whichever order the plan lists its resources in', async () => {
    const source = await seasonFixture();
    const forward = await coordinate(
      [completePort('jolpica', await seasonFixture())],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS, CIRCUITS],
    );
    const reversed = await coordinate(
      [completePort('jolpica', await seasonFixture())],
      [CIRCUITS, CONSTRUCTOR_STANDINGS, DRIVER_STANDINGS],
    );

    expect(selectedPayload(forward, DRIVER_STANDINGS)).toEqual(
      selectedPayload(reversed, DRIVER_STANDINGS),
    );
    expect(selectedPayload(forward, CIRCUITS)).toEqual(
      selectedPayload(reversed, CIRCUITS),
    );
    expect(selectedPayload(forward, DRIVER_STANDINGS)).toEqual(
      deepCopy(fixturePayload(source, DRIVER_STANDINGS)),
    );
  });
});

describe('a stateful accessor cannot answer one value to validation and another to assembly', () => {
  it('retains the value that passed validation when a getter changes its answer', async () => {
    const source = await seasonFixture();
    const valid = deepCopy([...source.driverStandings]) as unknown as Record<
      string,
      unknown
    >[];
    const invalid = deepCopy(valid).map((row) => ({
      ...row,
      season: OTHER_SEASON,
    }));
    const expected = deepCopy(valid);

    let reads = 0;
    const payload = {
      kind: 'driver-standings',
      get standings(): unknown {
        reads += 1;
        return reads <= 1 ? valid : invalid;
      },
    };

    const run = await coordinate([payloadPort(payload)], [DRIVER_STANDINGS]);
    expect(run.resources[0]?.selection.outcome).toBe('selected');

    const stored = selectedPayload(run, DRIVER_STANDINGS) as unknown as {
      standings: unknown;
    };
    // Read twice: a retained snapshot answers the same thing every time. The
    // number of getter invocations is not asserted - only that the stored value
    // is stable and is the one that was validated.
    const first = stored.standings;
    const second = stored.standings;
    expect(first).toEqual(expected);
    expect(second).toEqual(expected);
    expect(first).toEqual(second);
    expect(seasonsOf(first).every((season) => season === SEASON)).toBe(true);
  });

  it('never assembles a season from a getter that later answers another season', async () => {
    const source = await seasonFixture();
    const valid = deepCopy([...source.driverStandings]);
    const invalid = deepCopy(valid).map((row) => ({
      ...row,
      season: OTHER_SEASON,
    }));

    let reads = 0;
    const standingsPayload = {
      kind: 'driver-standings',
      get standings(): unknown {
        reads += 1;
        return reads <= 1 ? valid : invalid;
      },
    };

    const complete = completePort('jolpica', source);
    const port = new FakePort('jolpica', (request) =>
      request.resource.kind === 'driver-standings'
        ? ({
            outcome: 'candidate',
            attempt: attempt('j-standings'),
            payload: standingsPayload,
          } as unknown as ProviderResourceOutcome)
        : complete.fetchResource(request),
    );

    const run = await coordinate([port], fullPlan(source).resources);
    const assembly = assembleSeasonSource(run, metadataFor(source));
    expect(assembly.complete).toBe(true);
    if (!assembly.complete) return;
    expect(
      assembly.source.driverStandings.every(
        (standing) => standing.season === SEASON,
      ),
    ).toBe(true);
  });
});

describe('a candidate that cannot be detached fails closed', () => {
  it('contains a function-valued payload field as a malformed contribution', async () => {
    const source = await seasonFixture();
    const payload = {
      ...(deepCopy(fixturePayload(source, DRIVER_STANDINGS)) as object),
      notify: () => undefined,
    };
    const logger = new CapturingLogger();

    const run = await coordinate(
      [payloadPort(payload)],
      [DRIVER_STANDINGS],
      logger,
    );

    const contribution = contributionOf(run, 'jolpica');
    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('malformed-outcome');
    expect(contribution?.attempted).toBe(true);
    expect(contribution?.payload).toBeNull();
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    expect(run.status).toBe('completed');
    // The request really happened, so it is accounted exactly once.
    expect(run.accounting.lifetime.total).toBe(1);
    expect(run.accounting.bySource.jolpica?.total).toBe(1);
    expect(run.accounting.byJobCategory.standings?.total).toBe(1);
    expect(run.counts.attempted).toBe(1);
    expect(logger.serialized()).not.toContain('notify');
  });

  it('contains a function nested inside a payload collection', async () => {
    const source = await seasonFixture();
    const payload = deepCopy(
      fixturePayload(source, DRIVER_STANDINGS),
    ) as unknown as { standings: Record<string, unknown>[] };
    const row = payload.standings[0];
    if (row === undefined) throw new Error('fixture gap');
    row.recompute = () => undefined;

    const run = await coordinate([payloadPort(payload)], [DRIVER_STANDINGS]);
    const contribution = contributionOf(run, 'jolpica');
    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('malformed-outcome');
    expect(contribution?.attempted).toBe(true);
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
  });

  it('contains a hostile proxy payload without throwing out of coordinate()', async () => {
    const source = await seasonFixture();
    const target = deepCopy(fixturePayload(source, DRIVER_STANDINGS));
    const hostile = new Proxy(target as object, {
      ownKeys() {
        throw new Error('ownKeys is hostile');
      },
    });

    const logger = new CapturingLogger();
    const run = await coordinate(
      [payloadPort(hostile)],
      [DRIVER_STANDINGS],
      logger,
    );

    const contribution = contributionOf(run, 'jolpica');
    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('malformed-outcome');
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
    expect(logger.serialized()).not.toContain('hostile');
  });

  it('lets a healthy fallback carry the resource when the reconciled snapshot fails', async () => {
    const source = await seasonFixture();
    const undetachable = {
      ...(deepCopy(fixturePayload(source, DRIVER_STANDINGS)) as object),
      recompute: () => undefined,
    };
    const reconciled = payloadPort(undetachable, 'j-1');
    const provisional = new FakePort('openf1', () => ({
      outcome: 'candidate',
      attempt: attempt('o-1'),
      payload: deepCopy(fixturePayload(source, DRIVER_STANDINGS)),
    }));

    const run = await new MultiSourceCoordinator({
      ports: [reconciled, provisional],
      logger: new CapturingLogger(),
      provisionalSessionEndBound: testOnlyProvisionalBound,
    }).coordinate({ plan: { season: SEASON, resources: [DRIVER_STANDINGS] } });

    const selection = run.resources[0]?.selection;
    expect(selection?.outcome).toBe('selected');
    if (selection?.outcome !== 'selected') return;
    expect(selection.source).toBe('openf1');
    expect(run.status).toBe('completed');
    // Both requests really happened and are both accounted.
    expect(run.accounting.lifetime.total).toBe(2);
  });

  it('withholds publication for a season whose payload could not be detached', async () => {
    const source = await seasonFixture();
    const complete = completePort('jolpica', source);
    const port = new FakePort('jolpica', (request) =>
      request.resource.kind === 'constructor-standings'
        ? ({
            outcome: 'candidate',
            attempt: attempt('j-constructors'),
            payload: {
              ...(fixturePayload(source, CONSTRUCTOR_STANDINGS) as object),
              recompute: () => undefined,
            },
          } as unknown as ProviderResourceOutcome)
        : complete.fetchResource(request),
    );

    const run = await coordinate([port], fullPlan(source).resources);
    const harness = publicationHarness();
    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(run, metadataFor(source), FIXED_NOW, 'v-snapshot-1');

    expect(outcome.outcome).toBe('withheld');
    if (outcome.outcome !== 'withheld') return;
    expect(outcome.gap).toBe('resource-unavailable');
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });
});

describe('ordinary payloads survive detachment unchanged', () => {
  it('preserves every resource kind exactly', async () => {
    const source = await seasonFixture();
    const round = source.calendar[0]?.round;
    if (round === undefined) throw new Error('fixture gap');
    const resources: CoordinatedResource[] = [
      CALENDAR,
      PARTICIPANTS,
      CIRCUITS,
      DRIVER_STANDINGS,
      CONSTRUCTOR_STANDINGS,
      { kind: 'event-schedule', season: SEASON, round },
      raceResource(round),
    ];

    const run = await coordinate([completePort('jolpica', source)], resources);
    expect(run.counts.selected).toBe(resources.length);
    for (const resource of resources) {
      expect(selectedPayload(run, resource)).toEqual(
        deepCopy(fixturePayload(source, resource)),
      );
    }
  });

  it('preserves nulls, zeroes, empty strings and empty collections', async () => {
    const payload = {
      kind: 'driver-standings',
      standings: [
        {
          season: SEASON,
          position: 0,
          points: 0,
          wins: 0,
          driverId: '',
          constructorId: null,
          notes: [],
          detail: { nested: { deeper: [null, 0, ''] } },
        },
      ],
    };
    const expected = deepCopy(payload);

    const run = await coordinate([payloadPort(payload)], [DRIVER_STANDINGS]);
    expect(run.resources[0]?.selection.outcome).toBe('selected');
    expect(selectedPayload(run, DRIVER_STANDINGS)).toEqual(expected);
  });

  it('accepts an empty but valid collection', async () => {
    const payload = { kind: 'driver-standings', standings: [] };
    const run = await coordinate([payloadPort(payload)], [DRIVER_STANDINGS]);
    expect(run.resources[0]?.selection.outcome).toBe('selected');
    expect(selectedPayload(run, DRIVER_STANDINGS)).toEqual(payload);
  });

  it('accepts a frozen payload and a null-prototype payload', async () => {
    const source = await seasonFixture();
    const expected = deepCopy(fixturePayload(source, CIRCUITS));

    const frozen = Object.freeze(
      deepCopy(fixturePayload(source, CIRCUITS)) as object,
    );
    const frozenRun = await coordinate([payloadPort(frozen)], [CIRCUITS]);
    expect(frozenRun.resources[0]?.selection.outcome).toBe('selected');
    expect(selectedPayload(frozenRun, CIRCUITS)).toEqual(expected);

    const bare = Object.assign(
      Object.create(null) as Record<string, unknown>,
      deepCopy(fixturePayload(source, CIRCUITS)),
    );
    const bareRun = await coordinate([payloadPort(bare)], [CIRCUITS]);
    expect(bareRun.resources[0]?.selection.outcome).toBe('selected');
    expect(selectedPayload(bareRun, CIRCUITS)).toEqual(expected);
  });

  it('still rejects a payload that answers another season', async () => {
    const source = await seasonFixture();
    const wrong = {
      kind: 'driver-standings',
      standings: deepCopy([...source.driverStandings]).map((row) => ({
        ...row,
        season: OTHER_SEASON,
      })),
    };
    expect(payloadMatchesResource(DRIVER_STANDINGS, wrong)).toBe(false);

    const run = await coordinate([payloadPort(wrong)], [DRIVER_STANDINGS]);
    const contribution = contributionOf(run, 'jolpica');
    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('malformed-outcome');
    expect(contribution?.attempted).toBe(true);
    expect(run.resources[0]?.selection.outcome).toBe('unavailable');
  });

  it('preserves source-qualified transport deduplication', async () => {
    const source = await seasonFixture();
    // One physical request serving two derived resources: one reference, one
    // counted attempt, two candidates, two independent snapshots.
    const port = new FakePort('jolpica', (request) => {
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return {
        outcome: 'candidate',
        attempt: attempt('shared-reference'),
        payload,
      } as unknown as ProviderResourceOutcome;
    });

    const run = await coordinate(
      [port],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
    );
    expect(run.counts.selected).toBe(2);
    expect(run.accounting.lifetime.total).toBe(1);
    expect(run.accounting.bySource.jolpica?.total).toBe(1);
    expect(run.accounting.byJobCategory.standings?.total).toBe(1);
    expect(selectedPayload(run, DRIVER_STANDINGS)).toEqual(
      deepCopy(fixturePayload(source, DRIVER_STANDINGS)),
    );
  });

  it('keeps role precedence and attribution unchanged for detached candidates', async () => {
    const source = await seasonFixture();
    const run = await new MultiSourceCoordinator({
      ports: [completePort('openf1', source), completePort('jolpica', source)],
      logger: new CapturingLogger(),
      provisionalSessionEndBound: testOnlyProvisionalBound,
    }).coordinate({ plan: { season: SEASON, resources: [DRIVER_STANDINGS] } });

    const selection = run.resources[0]?.selection;
    expect(selection?.outcome).toBe('selected');
    if (selection?.outcome !== 'selected') return;
    expect(selection.source).toBe('jolpica');
    expect(selection.role).toBe('reconciled');
    expect(selection.payload).toEqual(
      deepCopy(fixturePayload(source, DRIVER_STANDINGS)),
    );
    expect(run.accounting.lifetime.total).toBe(2);
  });

  it('still taints a run whose transport references contradict each other', async () => {
    const source = await seasonFixture();
    let sequence = 0;
    const port = new FakePort('jolpica', (request) => {
      sequence += 1;
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return sequence === 1
        ? ({
            outcome: 'candidate',
            attempt: attempt('same-reference', 'successful'),
            payload,
          } as unknown as ProviderResourceOutcome)
        : ({
            outcome: 'failed',
            attempt: attempt('same-reference', 'failed'),
            reason: 'provider-unavailable',
          } as unknown as ProviderResourceOutcome);
    });

    const run = await coordinate(
      [port],
      [DRIVER_STANDINGS, CONSTRUCTOR_STANDINGS],
    );
    expect(run.status).toBe('invariant-violated');
    expect(assembleSeasonSource(run, metadataFor(source)).complete).toBe(false);
  });

  it('publishes a fully detached season through the unchanged publication boundary', async () => {
    const source = await seasonFixture();
    const run = await coordinate(
      [completePort('jolpica', source)],
      fullPlan(source).resources,
    );
    const harness = publicationHarness();
    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(run, metadataFor(source), FIXED_NOW, 'v-snapshot-2');

    expect(outcome.outcome).toBe('published');
    expect(harness.publishCalls).toBe(1);
  });
});
