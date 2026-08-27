/**
 * Plan validation, source capability and the fail-closed provisional gate.
 *
 * Required cases 1-6 and 14.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatorConfigurationError,
  MultiSourceCoordinator,
  coordinatedSourceIds,
  coordinationFor,
  decideProvisionalEligibility,
  isCoordinatedResource,
  jobCategoryForResource,
  maxAllowedConcurrentOperations,
  recordedProvisionalSessionEndBound,
  sourceRoleOf,
  sourceSupportsResource,
  sourceUnlockedByPolicy,
  coordinatedResourceKinds,
  type CoordinatedResource,
} from '../../../src/providers/coordination';
import {
  FakePort,
  SEASON,
  completePort,
  fullPlan,
  raceResource,
  seasonFixture,
  seasonResources,
  testOnlyProvisionalBound,
} from './support';

function coordinator(
  ports: FakePort[],
  options: { bound?: unknown; concurrency?: number } = {},
) {
  const logger = new CapturingLogger();
  return {
    logger,
    subject: new MultiSourceCoordinator({
      ports,
      logger,
      ...(options.bound === undefined
        ? {}
        : { provisionalSessionEndBound: options.bound }),
      ...(options.concurrency === undefined
        ? {}
        : { maxConcurrentOperations: options.concurrency }),
    }),
  };
}

describe('a plan is validated before anything is executed', () => {
  // Case 1
  it('performs no adapter call for an empty plan', async () => {
    const source = await seasonFixture();
    const reconciled = completePort('jolpica', source);
    const { subject } = coordinator([reconciled]);

    const run = await subject.coordinate({
      plan: { season: SEASON, resources: [] },
    });

    expect(run.status).toBe('completed');
    expect(reconciled.requests).toHaveLength(0);
    expect(run.accounting.lifetime.total).toBe(0);
    expect(run.counts).toEqual({
      planned: 0,
      selected: 0,
      unavailable: 0,
      attempted: 0,
      notAttempted: 0,
    });
  });

  // Case 14
  it('rejects a duplicate logical resource with nothing attempted', async () => {
    const source = await seasonFixture();
    const reconciled = completePort('jolpica', source);
    const { subject } = coordinator([reconciled]);

    const run = await subject.coordinate({
      plan: {
        season: SEASON,
        resources: [raceResource(12), raceResource(12)],
      },
    });

    expect(run.status).toBe('plan-rejected');
    expect(run.planProblem).toBe('duplicate-resource');
    // Fail closed as a whole: no adapter call, no accounting, no partial
    // subset that could conceal the violation.
    expect(reconciled.requests).toHaveLength(0);
    expect(run.resources).toEqual([]);
    expect(run.accounting.lifetime.total).toBe(0);
    expect(run.accounting.bySource).toEqual({});
  });

  it('treats a differently scoped resource as distinct, not duplicate', async () => {
    const source = await seasonFixture();
    const reconciled = completePort('jolpica', source);
    const { subject } = coordinator([reconciled]);

    const run = await subject.coordinate({
      plan: { season: SEASON, resources: [raceResource(12), raceResource(13)] },
    });

    expect(run.status).toBe('completed');
    expect(run.counts.selected).toBe(2);
  });

  it('rejects a malformed or cross-season resource identity', async () => {
    const source = await seasonFixture();
    const reconciled = completePort('jolpica', source);
    const { subject } = coordinator([reconciled]);

    const malformed = await subject.coordinate({
      plan: {
        season: SEASON,
        resources: [{ kind: 'telemetry', season: SEASON } as never],
      },
    });
    const crossSeason = await subject.coordinate({
      plan: {
        season: SEASON,
        resources: [{ kind: 'season-calendar', season: 2025 }],
      },
    });

    expect(malformed.planProblem).toBe('invalid-resource');
    expect(crossSeason.planProblem).toBe('season-mismatch');
    expect(reconciled.requests).toHaveLength(0);
  });

  it('rejects an identity carrying a scope its kind does not have', async () => {
    const source = await seasonFixture();
    const reconciled = completePort('jolpica', source);
    const { subject } = coordinator([reconciled]);

    // The same logical resource wearing an extra property. Tolerating it would
    // let one resource enter a plan twice under two identities, so it is
    // rejected outright rather than ignored.
    const twin = {
      kind: 'season-calendar',
      season: SEASON,
      round: 3,
    } as unknown as CoordinatedResource;

    expect(isCoordinatedResource(twin)).toBe(false);
    expect(
      isCoordinatedResource({
        kind: 'event-schedule',
        season: SEASON,
        round: 3,
        sessionType: 'race',
      }),
    ).toBe(false);

    const run = await subject.coordinate({
      plan: {
        season: SEASON,
        resources: [{ kind: 'season-calendar', season: SEASON }, twin],
      },
    });

    expect(run.planProblem).toBe('invalid-resource');
    expect(run.status).toBe('plan-rejected');
    expect(reconciled.requests).toHaveLength(0);
    expect(run.accounting.lifetime.total).toBe(0);
  });

  it('never throws on a hostile value inside a plan entry', async () => {
    const source = await seasonFixture();
    const reconciled = completePort('jolpica', source);
    const { subject } = coordinator([reconciled]);

    const hostile: unknown[] = [
      {
        kind: 'season-circuits',
        season: SEASON,
        round: {
          toString: () => {
            throw new Error('boom');
          },
        },
      },
      {
        kind: 'season-calendar',
        season: SEASON,
        sessionType: 'x'.repeat(5000),
      },
      { kind: 'event-schedule', season: SEASON, round: Symbol('round') },
      {
        kind: 'session-classification',
        season: SEASON,
        round: 1,
        sessionType: {
          toString: () => {
            throw new Error('boom');
          },
        },
      },
    ];

    for (const resource of hostile) {
      const run = await subject.coordinate({
        plan: { season: SEASON, resources: [resource as CoordinatedResource] },
      });
      expect(run.planProblem).toBe('invalid-resource');
      expect(run.resources).toEqual([]);
    }
    expect(reconciled.requests).toHaveLength(0);
  });

  it('reports the same problem however the entries are ordered', async () => {
    const source = await seasonFixture();
    const reconciled = completePort('jolpica', source);
    const { subject } = coordinator([reconciled]);

    const invalid = { kind: 'telemetry', season: SEASON } as never;
    const duplicated = raceResource(12);
    const forwards = await subject.coordinate({
      plan: { season: SEASON, resources: [invalid, duplicated, duplicated] },
    });
    const backwards = await subject.coordinate({
      plan: { season: SEASON, resources: [duplicated, duplicated, invalid] },
    });

    expect(forwards.planProblem).toBe('invalid-resource');
    expect(backwards.planProblem).toBe(forwards.planProblem);
    expect(backwards.status).toBe(forwards.status);
    expect(reconciled.requests).toHaveLength(0);
  });

  it('validates identity contents, not just declared shape', () => {
    expect(
      isCoordinatedResource({ kind: 'season-calendar', season: 2026 }),
    ).toBe(true);
    for (const invalid of [
      { kind: 'season-calendar', season: Number.NaN },
      { kind: 'season-calendar', season: 2026.5 },
      { kind: 'season-calendar', season: 1000 },
      { kind: 'event-schedule', season: 2026 },
      { kind: 'event-schedule', season: 2026, round: 0 },
      { kind: 'session-classification', season: 2026, round: 1 },
      {
        kind: 'session-classification',
        season: 2026,
        round: 1,
        sessionType: 'practice_1',
      },
      { kind: 'home-rebuild', season: 2026 },
      null,
      [],
      'season-calendar',
    ]) {
      expect(isCoordinatedResource(invalid)).toBe(false);
    }
  });
});

describe('source capability is owned above the adapters', () => {
  // Case 2
  it('lets each source succeed independently', async () => {
    const source = await seasonFixture();
    const reconciledOnly = coordinator([completePort('jolpica', source)]);
    const provisionalOnly = coordinator([completePort('openf1', source)], {
      bound: testOnlyProvisionalBound,
    });
    const plan = { season: SEASON, resources: [raceResource(12)] };

    const fromReconciled = await reconciledOnly.subject.coordinate({ plan });
    const fromProvisional = await provisionalOnly.subject.coordinate({ plan });

    expect(fromReconciled.resources[0]?.selection).toMatchObject({
      outcome: 'selected',
      source: 'jolpica',
      role: 'reconciled',
    });
    expect(fromProvisional.resources[0]?.selection).toMatchObject({
      outcome: 'selected',
      source: 'openf1',
      role: 'provisional',
    });
  });

  // Case 3
  it('never shows one adapter the other adapter or its outcome', async () => {
    const source = await seasonFixture();
    const reconciled = completePort('jolpica', source);
    const provisional = completePort('openf1', source);
    const { subject } = coordinator([reconciled, provisional], {
      bound: testOnlyProvisionalBound,
    });

    await subject.coordinate({
      plan: { season: SEASON, resources: [raceResource(12)] },
    });

    for (const port of [reconciled, provisional]) {
      for (const request of port.requests) {
        // The request carries exactly the source, the resource and the signal.
        expect(Object.keys(request).sort()).toEqual(['resource', 'source']);
        expect(request.source).toBe(port.sourceId);
      }
    }
  });

  // Case 4
  it('rejects a capability violation before the adapter is called', async () => {
    const source = await seasonFixture();
    const provisional = completePort('openf1', source);
    const { subject } = coordinator([provisional], {
      bound: testOnlyProvisionalBound,
    });

    const run = await subject.coordinate({
      plan: {
        season: SEASON,
        resources: [seasonResources[0] as CoordinatedResource],
      },
    });

    expect(provisional.requests).toHaveLength(0);
    const contribution = run.resources[0]?.contributions.find(
      (entry) => entry.source === 'openf1',
    );
    expect(contribution?.status).toBe('skipped');
    expect(contribution?.reason).toBe('resource-unsupported');
    expect(contribution?.attempted).toBe(false);
    expect(run.accounting.lifetime.total).toBe(0);
  });

  it('declares the documented capability sets and nothing more', () => {
    expect(sourceRoleOf('jolpica')).toBe('reconciled');
    expect(sourceRoleOf('openf1')).toBe('provisional');

    for (const kind of coordinatedResourceKinds) {
      expect(sourceSupportsResource('jolpica', kind)).toBe(true);
    }
    const provisionalKinds = coordinatedResourceKinds.filter((kind) =>
      sourceSupportsResource('openf1', kind),
    );
    expect([...provisionalKinds].sort()).toEqual(
      [
        'constructor-standings',
        'driver-standings',
        'session-classification',
      ].sort(),
    );
  });

  it('never turns a derived job into a provider request', () => {
    for (const kind of coordinatedResourceKinds) {
      expect(jobCategoryForResource(kind)).not.toBe('home-rebuild');
    }
    expect(
      isCoordinatedResource({ kind: 'home-rebuild', season: SEASON }),
    ).toBe(false);
  });
});

describe('the provisional source is locked closed by default', () => {
  // Case 5
  it('skips the provisional source because no bound is recorded', async () => {
    const source = await seasonFixture();
    const reconciled = completePort('jolpica', source);
    const provisional = completePort('openf1', source);
    const { subject } = coordinator([reconciled, provisional]);

    const run = await subject.coordinate({
      plan: { season: SEASON, resources: [raceResource(12)] },
    });
    const contribution = coordinationFor(
      run,
      raceResource(12),
    )?.contributions.find((entry) => entry.source === 'openf1');

    expect(recordedProvisionalSessionEndBound).toBeNull();
    expect(sourceUnlockedByPolicy('openf1')).toBe(false);
    expect(contribution?.status).toBe('skipped');
    expect(contribution?.reason).toBe('source-locked');
  });

  // Case 6
  it('reserves nothing, sends nothing and counts nothing when locked', async () => {
    const source = await seasonFixture();
    const provisional = completePort('openf1', source);
    const { subject } = coordinator([provisional]);

    const run = await subject.coordinate({
      plan: {
        season: SEASON,
        resources: [
          raceResource(12),
          { kind: 'driver-standings', season: SEASON },
        ],
      },
    });

    // The port is the only path to a reservation or to transport, and it was
    // never reached at all.
    expect(provisional.requests).toHaveLength(0);
    expect(run.accounting.lifetime.total).toBe(0);
    expect(run.accounting.bySource).toEqual({});
    expect(run.counts.attempted).toBe(0);
    for (const resource of run.resources) {
      expect(resource.selection.outcome).toBe('unavailable');
    }
  });

  it('reads absence, malformation and an out-of-range bound as locked', () => {
    for (const value of [
      undefined,
      null,
      7200,
      'session-end-bound-recorded',
      {},
      { kind: 'session-end-bound-recorded' },
      { kind: 'something-else', boundSeconds: 7200 },
      { kind: 'session-end-bound-recorded', boundSeconds: 0 },
      { kind: 'session-end-bound-recorded', boundSeconds: -1 },
      { kind: 'session-end-bound-recorded', boundSeconds: 1.5 },
      { kind: 'session-end-bound-recorded', boundSeconds: 10 ** 9 },
      { kind: 'session-end-bound-recorded', boundSeconds: 7200, extra: true },
      [{ kind: 'session-end-bound-recorded', boundSeconds: 7200 }],
    ]) {
      expect(decideProvisionalEligibility(value)).toEqual({
        eligible: false,
        reason: 'bound-unavailable',
      });
    }
    expect(decideProvisionalEligibility(testOnlyProvisionalBound)).toEqual({
      eligible: true,
      boundSeconds: 7200,
    });
  });
});

describe('coordinator wiring fails closed', () => {
  it('refuses two ports for one source', async () => {
    const source = await seasonFixture();
    expect(
      () =>
        new MultiSourceCoordinator({
          ports: [
            completePort('jolpica', source),
            completePort('jolpica', source),
          ],
          logger: new CapturingLogger(),
        }),
    ).toThrow(CoordinatorConfigurationError);
  });

  it('refuses an unbounded or nonsensical concurrency', async () => {
    const source = await seasonFixture();
    for (const concurrency of [
      0,
      -1,
      1.5,
      Number.NaN,
      maxAllowedConcurrentOperations + 1,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(
        () =>
          new MultiSourceCoordinator({
            ports: [completePort('jolpica', source)],
            logger: new CapturingLogger(),
            maxConcurrentOperations: concurrency,
          }),
      ).toThrow(CoordinatorConfigurationError);
    }
  });

  it('coordinates exactly the two real sources', () => {
    expect([...coordinatedSourceIds]).toEqual(['jolpica', 'openf1']);
  });

  it('plans a publishable season without naming a derived document', async () => {
    const source = await seasonFixture();
    const plan = fullPlan(source);
    expect(plan.resources).toHaveLength(5 + source.calendar.length);
    for (const resource of plan.resources) {
      expect(isCoordinatedResource(resource)).toBe(true);
    }
  });
});
