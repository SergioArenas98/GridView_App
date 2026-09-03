/**
 * What the coordinator does with a payload that fails the normalized contract.
 *
 * The whole point of validating here rather than trusting an adapter is that
 * the failure has to be *contained*: counted honestly, never selected, never
 * assembled, never published, never allowed to take a healthy fallback or an
 * independent resource down with it, and never logged as content. Every one of
 * those is asserted against the real coordinator, the real assembler and the
 * real publisher over in-memory storage.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  MultiSourceCoordinator,
  assembleSeasonSource,
  attemptedFailureReasons,
  type CoordinatedPayload,
  type CoordinatedResource,
  type CoordinationRun,
} from '../../../src/providers/coordination';
import {
  FakePort,
  SEASON,
  attempt,
  completePort,
  fullPlan,
  metadataFor,
  payloadFor,
  raceResource,
  seasonFixture,
  seasonResources,
  testOnlyProvisionalBound,
} from './support';

/** A calendar payload whose first event breaks one field of the contract. */
function corruptCalendar(events: readonly unknown[]): CoordinatedPayload {
  return { kind: 'season-calendar', events } as unknown as CoordinatedPayload;
}

function coordinatorWith(
  ports: FakePort[],
  logger: CapturingLogger,
  bound: unknown = null,
): MultiSourceCoordinator {
  return new MultiSourceCoordinator({
    ports,
    logger,
    provisionalSessionEndBound: bound,
  });
}

function coordinationOf(run: CoordinationRun, kind: string) {
  return run.resources.find((resource) => resource.resource.kind === kind);
}

describe('an invalid payload is an attempted, contained failure', () => {
  it('produces the existing invalid-payload reason and no new vocabulary', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('jolpica-1'),
      payload: corruptCalendar([{ ...source.calendar[0]!, round: 0 }]),
    }));

    const run = await coordinatorWith([port], logger).coordinate({
      plan: { season: SEASON, resources: [seasonResources[0]!] },
    });

    const resource = coordinationOf(run, 'season-calendar');
    const contribution = resource?.contributions[0];

    expect(contribution?.status).toBe('failed');
    expect(contribution?.reason).toBe('invalid-payload');
    expect(attemptedFailureReasons).toContain('invalid-payload');
  });

  it('stays attempted, because the request really left GridView', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('jolpica-1'),
      payload: corruptCalendar([{ ...source.calendar[0]!, round: 0 }]),
    }));

    const run = await coordinatorWith([port], logger).coordinate({
      plan: { season: SEASON, resources: [seasonResources[0]!] },
    });

    expect(
      coordinationOf(run, 'season-calendar')?.contributions[0]?.attempted,
    ).toBe(true);
  });

  it('counts the transport exactly once', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('jolpica-shared'),
      payload: corruptCalendar([{ ...source.calendar[0]!, round: 0 }]),
    }));

    const run = await coordinatorWith([port], logger).coordinate({
      plan: { season: SEASON, resources: [seasonResources[0]!] },
    });

    expect(run.counts.attempted).toBe(1);
  });

  it('does not select it', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('jolpica-1'),
      payload: corruptCalendar([{ ...source.calendar[0]!, round: 0 }]),
    }));

    const run = await coordinatorWith([port], logger).coordinate({
      plan: { season: SEASON, resources: [seasonResources[0]!] },
    });

    expect(coordinationOf(run, 'season-calendar')?.selection.outcome).toBe(
      'unavailable',
    );
  });

  it('does not assemble a season from it', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', (request) => {
      const payload =
        request.resource.kind === 'season-calendar'
          ? corruptCalendar([{ ...source.calendar[0]!, round: 0 }])
          : payloadFor(source, request.resource);
      return payload === null
        ? {
            outcome: 'failed',
            attempt: attempt('x', 'failed'),
            reason: 'invalid-payload',
          }
        : {
            outcome: 'candidate',
            attempt: attempt(`ref-${request.resource.kind}`),
            payload,
          };
    });

    const run = await coordinatorWith([port], logger).coordinate({
      plan: fullPlan(source),
    });
    const assembly = assembleSeasonSource(run, metadataFor(source));

    expect(assembly.complete).toBe(false);
    expect(assembly.complete === false && assembly.gap).toBe(
      'resource-unavailable',
    );
  });

  it('never reaches a log line with the offending value', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('jolpica-1'),
      payload: corruptCalendar([
        { ...source.calendar[0]!, round: 0, name: 'SECRET-UPSTREAM-VALUE' },
      ]),
    }));

    await coordinatorWith([port], logger).coordinate({
      plan: { season: SEASON, resources: [seasonResources[0]!] },
    });

    const serialized = logger.serialized();
    expect(serialized).not.toContain('SECRET-UPSTREAM-VALUE');
    expect(serialized).not.toContain('events');
    expect(serialized).toContain('invalid-payload');
  });
});

describe('containment does not spread', () => {
  it('lets a healthy fallback carry the same resource', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const broken = new FakePort('openf1', () => ({
      outcome: 'candidate',
      attempt: attempt('openf1-1'),
      payload: {
        kind: 'driver-standings',
        standings: [{ ...source.driverStandings[0]!, position: 0 }],
      } as unknown as CoordinatedPayload,
    }));
    const healthy = completePort('jolpica', source);

    const run = await coordinatorWith(
      [healthy, broken],
      logger,
      testOnlyProvisionalBound,
    ).coordinate({
      plan: { season: SEASON, resources: [seasonResources[3]!] },
    });

    const resource = coordinationOf(run, 'driver-standings');
    expect(resource?.selection.outcome).toBe('selected');
    expect(
      resource?.selection.outcome === 'selected' && resource.selection.source,
    ).toBe('jolpica');
    expect(
      resource?.contributions.filter((c) => c.reason === 'invalid-payload'),
    ).toHaveLength(1);
  });

  it('never lets a provisional invalid payload displace a reconciled valid one', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const broken = new FakePort('openf1', () => ({
      outcome: 'candidate',
      attempt: attempt('openf1-1'),
      payload: {
        kind: 'driver-standings',
        standings: [{ ...source.driverStandings[0]!, points: Number.NaN }],
      } as unknown as CoordinatedPayload,
    }));

    const run = await coordinatorWith(
      [completePort('jolpica', source), broken],
      logger,
      testOnlyProvisionalBound,
    ).coordinate({
      plan: { season: SEASON, resources: [seasonResources[3]!] },
    });

    const selection = coordinationOf(run, 'driver-standings')?.selection;
    expect(selection?.outcome === 'selected' && selection.payload.kind).toBe(
      'driver-standings',
    );
    expect(
      selection?.outcome === 'selected' &&
        selection.payload.kind === 'driver-standings' &&
        selection.payload.standings.every((s) => Number.isFinite(s.points)),
    ).toBe(true);
  });

  it('does not block an independent valid resource', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', (request) => {
      if (request.resource.kind === 'season-calendar') {
        return {
          outcome: 'candidate',
          attempt: attempt('bad'),
          payload: corruptCalendar([{ ...source.calendar[0]!, round: 0 }]),
        };
      }
      const payload = payloadFor(source, request.resource);
      return payload === null
        ? {
            outcome: 'failed',
            attempt: attempt('n', 'failed'),
            reason: 'invalid-payload',
          }
        : {
            outcome: 'candidate',
            attempt: attempt(`ok-${request.resource.kind}`),
            payload,
          };
    });

    const run = await coordinatorWith([port], logger).coordinate({
      plan: {
        season: SEASON,
        resources: [seasonResources[0]!, seasonResources[3]!],
      },
    });

    expect(coordinationOf(run, 'season-calendar')?.selection.outcome).toBe(
      'unavailable',
    );
    expect(coordinationOf(run, 'driver-standings')?.selection.outcome).toBe(
      'selected',
    );
    expect(run.status).toBe('completed');
  });

  it('does not taint the run status', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('jolpica-1'),
      payload: corruptCalendar([{ ...source.calendar[0]!, round: 0 }]),
    }));

    const run = await coordinatorWith([port], logger).coordinate({
      plan: { season: SEASON, resources: [seasonResources[0]!] },
    });

    expect(run.status).toBe('completed');
  });
});

describe('validation happens on the value that would be published', () => {
  it('validates the detached snapshot, not the adapter object', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    // The adapter answers with a contract-valid calendar, keeps the array it
    // handed over, and corrupts it once the run is done. Validation, selection
    // and everything downstream all read the coordinator's own detached copy,
    // so the corruption reaches none of them.
    const events: Record<string, unknown>[] = [{ ...source.calendar[0]! }];
    const port = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('jolpica-1'),
      payload: {
        kind: 'season-calendar',
        events,
      } as unknown as CoordinatedPayload,
    }));

    const run = await coordinatorWith([port], logger).coordinate({
      plan: { season: SEASON, resources: [seasonResources[0]!] },
    });
    events[0]!.round = 0;

    const selection = coordinationOf(run, 'season-calendar')?.selection;
    expect(selection?.outcome).toBe('selected');
    expect(
      selection?.outcome === 'selected' &&
        selection.payload.kind === 'season-calendar' &&
        selection.payload.events[0]?.round,
    ).toBe(source.calendar[0]!.round);
  });

  it('rejects a payload the adapter corrupted before the coordinator saw it', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    // The mirror case: the value that arrives is the value judged, so a
    // corruption present at the boundary is caught rather than assumed away.
    const port = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('jolpica-1'),
      payload: corruptCalendar([{ ...source.calendar[0]!, round: 0 }]),
    }));

    const run = await coordinatorWith([port], logger).coordinate({
      plan: { season: SEASON, resources: [seasonResources[0]!] },
    });

    expect(
      coordinationOf(run, 'season-calendar')?.contributions[0]?.reason,
    ).toBe('invalid-payload');
  });

  it('runs after resource binding, so a mismatched payload is still malformed-outcome', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', () => ({
      outcome: 'candidate',
      attempt: attempt('jolpica-1'),
      // Answers the wrong question *and* breaks the contract. Binding decides
      // first, so the reported reason stays the established one.
      payload: {
        kind: 'season-calendar',
        events: [{ ...source.calendar[0]!, season: 1999, round: 0 }],
      } as unknown as CoordinatedPayload,
    }));

    const run = await coordinatorWith([port], logger).coordinate({
      plan: { season: SEASON, resources: [seasonResources[0]!] },
    });

    expect(
      coordinationOf(run, 'season-calendar')?.contributions[0]?.reason,
    ).toBe('malformed-outcome');
  });
});

describe('a fully valid run is unchanged', () => {
  it('still selects, assembles and reports every resource', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();

    const run = await coordinatorWith(
      [completePort('jolpica', source)],
      logger,
    ).coordinate({
      plan: fullPlan(source),
    });
    const assembly = assembleSeasonSource(run, metadataFor(source));

    expect(run.status).toBe('completed');
    expect(
      run.resources.every(
        (resource) => resource.selection.outcome === 'selected',
      ),
    ).toBe(true);
    expect(assembly.complete).toBe(true);
  });

  it('adds no issue for a resource whose payload is contract-valid', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const resources: CoordinatedResource[] = [
      ...seasonResources,
      raceResource(source.calendar[0]!.round),
    ];

    const run = await coordinatorWith(
      [completePort('jolpica', source)],
      logger,
    ).coordinate({
      plan: { season: SEASON, resources },
    });

    expect(
      run.resources.flatMap((resource) =>
        resource.contributions.filter((c) => c.reason === 'invalid-payload'),
      ),
    ).toEqual([]);
  });
});
