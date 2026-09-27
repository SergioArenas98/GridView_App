/**
 * The guarded bridge to the guarded sequenced publication boundary, and
 * last-known-good under every source-failure combination.
 *
 * Required cases 28-31. The harness is the real `SequencedPublicationService`
 * over an active, seeded sequencer; the legacy authority is present only as
 * the seed's author and is never reached by coordination.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  coordinatedResourceKinds,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import type { StoredSnapshot } from '../../../src/storage/types';
import {
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

const GENERATED_AT = '2026-07-20T12:00:00.000Z';

async function coordinate(
  ports: FakePort[],
  resources: readonly CoordinatedResource[],
  bound?: unknown,
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports,
    logger: new CapturingLogger(),
    ...(bound === undefined ? {} : { provisionalSessionEndBound: bound }),
  }).coordinate({ plan: { season: SEASON, resources } });
}

describe('a complete run publishes exactly once', () => {
  // Case 29
  it('assembles the season and calls guarded publication a single time', async () => {
    const source = await seasonFixture();
    const run = await coordinate(
      [completePort('jolpica', source)],
      fullPlan(source).resources,
    );
    const harness = await publicationHarness();
    const publication = new CoordinatedSeasonPublication({
      commands: harness.commands,
      logger: harness.logger,
    });

    const outcome = await publication.publish(
      run,
      metadataFor(source),
      GENERATED_AT,
      'release-1',
    );

    expect(run.counts.unavailable).toBe(0);
    expect(outcome.outcome).toBe('published');
    if (outcome.outcome !== 'published') throw new Error('unreachable');
    expect(outcome.result.status).toBe('applied');
    expect(outcome.result.previousVersion).toBe(harness.seedVersion);
    expect(harness.publishCalls).toBe(1);
    expect(harness.legacyPublishCalls).toBe(0);
    // The sequencer allocated the committed version, not the caller.
    expect(outcome.result.version).not.toBe('release-1');
    expect(harness.activeVersion()).toBe(outcome.result.version);
  });

  it('assembles the same season the whole-season provider would', async () => {
    const source = await seasonFixture();
    const run = await coordinate(
      [completePort('jolpica', source)],
      fullPlan(source).resources,
    );

    const assembly = assembleSeasonSource(run, metadataFor(source));

    expect(assembly.complete).toBe(true);
    if (!assembly.complete) throw new Error('unreachable');
    expect(assembly.source.calendar.map((event) => event.round)).toEqual(
      source.calendar.map((event) => event.round),
    );
    expect(assembly.source.results).toHaveLength(source.results.length);
    expect(assembly.source.drivers).toEqual(source.drivers);
    expect(assembly.source.sourceUpdatedAt).toBe(source.sourceUpdatedAt);
  });

  it('applies a selected event schedule without merging it field by field', async () => {
    const source = await seasonFixture();
    const replacement = {
      kind: 'event-schedule' as const,
      round: 12,
      sessions: [],
    };
    const port = new FakePort('jolpica', (request) => {
      if (request.resource.kind === 'event-schedule') {
        return {
          outcome: 'candidate',
          attempts: [attempt('j-schedule')],
          payload: replacement,
        };
      }
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return {
        outcome: 'candidate',
        attempts: [
          attempt(
            `j-${request.resource.kind}-${'round' in request.resource ? request.resource.round : 0}`,
          ),
        ],
        payload,
      };
    });

    const run = await coordinate(
      [port],
      [
        ...fullPlan(source).resources,
        { kind: 'event-schedule', season: SEASON, round: 12 },
      ],
    );
    const assembly = assembleSeasonSource(run, metadataFor(source));

    expect(assembly.complete).toBe(true);
    if (!assembly.complete) throw new Error('unreachable');
    const round12 = assembly.source.calendar.find(
      (event) => event.round === 12,
    );
    const untouched = assembly.source.calendar.find(
      (event) => event.round === 13,
    );
    expect(round12?.sessions).toEqual([]);
    expect(untouched?.sessions.length).toBeGreaterThan(0);
  });
});

describe('an incomplete run never reaches publication', () => {
  // Case 28
  it('withholds publication for every incompleteness', async () => {
    const source = await seasonFixture();
    const full = fullPlan(source).resources;

    const cases: {
      name: string;
      resources: readonly CoordinatedResource[];
      port: FakePort;
      gap: string;
    }[] = [
      {
        name: 'a planned resource produced no candidate',
        resources: full,
        port: new FakePort('jolpica', (request) =>
          request.resource.kind === 'driver-standings'
            ? ({
                outcome: 'failed',
                attempts: [attempt('j-fail', 'failed')],
                reason: 'provider-unavailable',
              } satisfies ProviderResourceOutcome)
            : ({
                outcome: 'candidate',
                attempts: [attempt(`j-${request.resource.kind}`)],
                payload: payloadFor(source, request.resource) ?? {
                  kind: 'season-circuits',
                  circuits: [],
                },
              } satisfies ProviderResourceOutcome),
        ),
        gap: 'resource-unavailable',
      },
      {
        name: 'a required season resource was never planned',
        resources: full.filter(
          (resource) => resource.kind !== 'season-circuits',
        ),
        port: completePort('jolpica', source),
        gap: 'missing-required-resource',
      },
      {
        // Round 12 is the season's only *completed* event, so it is the only
        // one whose classification is required. Planning none at all leaves
        // exactly that one unmet; the upcoming, postponed and cancelled rounds
        // are legitimately without a result and must not create a gap.
        name: 'a completed calendar round has no race classification',
        resources: [...seasonResources],
        port: completePort('jolpica', source),
        gap: 'missing-round-classification',
      },
    ];

    for (const scenario of cases) {
      const run = await coordinate([scenario.port], scenario.resources);
      const harness = await publicationHarness();
      const publication = new CoordinatedSeasonPublication({
        commands: harness.commands,
        logger: harness.logger,
      });

      const outcome = await publication.publish(
        run,
        metadataFor(source),
        GENERATED_AT,
        'release-x',
      );

      expect(outcome.outcome, scenario.name).toBe('withheld');
      if (outcome.outcome !== 'withheld') throw new Error('unreachable');
      expect(outcome.gap, scenario.name).toBe(scenario.gap);
      expect(outcome.missing.length, scenario.name).toBeGreaterThan(0);
      expect(harness.publishCalls, scenario.name).toBe(0);
      expect(harness.activeVersion()).toBe(harness.seedVersion);
    }
  });

  it('bounds the withheld signal however much went missing', async () => {
    const source = await seasonFixture();
    // Every round is planned and every one fails, so `missing` is as long as
    // the calendar - which is adapter-supplied data, not a bounded quantity.
    // The log line must stay bounded by the closed resource-kind union.
    const run = await coordinate(
      [
        new FakePort('jolpica', () => ({
          outcome: 'failed',
          attempts: [attempt('j-fail', 'failed')],
          reason: 'provider-unavailable',
        })),
      ],
      fullPlan(source).resources,
    );
    const harness = await publicationHarness();

    const outcome = await new CoordinatedSeasonPublication({
      commands: harness.commands,
      logger: harness.logger,
    }).publish(run, metadataFor(source), GENERATED_AT, 'release-y');

    expect(outcome.outcome).toBe('withheld');
    if (outcome.outcome !== 'withheld') throw new Error('unreachable');
    expect(outcome.missing.length).toBe(fullPlan(source).resources.length);

    const withheld = harness.logger.events.find(
      (event) => event.coordinationOutcome === 'withheld',
    );
    const logged = withheld?.coordinationMissing as string[];
    expect(logged.length).toBeLessThan(outcome.missing.length);
    expect(new Set(logged).size).toBe(logged.length);
    expect(logged.length).toBeLessThanOrEqual(coordinatedResourceKinds.length);
    for (const kind of logged) {
      expect(coordinatedResourceKinds as readonly string[]).toContain(kind);
    }
    expect(harness.publishCalls).toBe(0);
  });

  it('withholds a rejected plan without touching publication', async () => {
    const source = await seasonFixture();
    const run = await coordinate(
      [completePort('jolpica', source)],
      [raceResource(12), raceResource(12)],
    );
    const harness = await publicationHarness();
    const publication = new CoordinatedSeasonPublication({
      commands: harness.commands,
      logger: harness.logger,
    });

    const outcome = await publication.publish(
      run,
      metadataFor(source),
      GENERATED_AT,
      'release-x',
    );

    expect(run.status).toBe('plan-rejected');
    expect(outcome).toMatchObject({
      outcome: 'withheld',
      gap: 'run-not-completed',
    });
    expect(harness.publishCalls).toBe(0);
  });
});

/** Storage whose versioned writes fail, so publication fails after `prepare`. */
class WriteFailingStorage extends MemorySnapshotStorage {
  failing = false;

  override async writeVersionedDocument(
    season: number,
    version: string,
    document: StoredSnapshot,
  ): Promise<void> {
    if (this.failing) throw new Error('storage is unavailable');
    return super.writeVersionedDocument(season, version, document);
  }
}

describe('last-known-good survives every failure', () => {
  // Case 30
  it('leaves the active release unchanged when publication fails', async () => {
    const source = await seasonFixture();
    const storage = new WriteFailingStorage();
    const harness = await publicationHarness({ storage });
    const publication = new CoordinatedSeasonPublication({
      commands: harness.commands,
      logger: harness.logger,
    });
    const run = await coordinate(
      [completePort('jolpica', source)],
      fullPlan(source).resources,
    );

    const first = await publication.publish(
      run,
      metadataFor(source),
      GENERATED_AT,
      'release-1',
    );
    expect(first.outcome).toBe('published');
    const active = harness.activeVersion();
    expect(active).toBe(harness.lastCommitted());
    expect(active).not.toBe(harness.seedVersion);

    storage.failing = true;
    const second = await publication.publish(
      run,
      { ...metadataFor(source), contentVersion: '2026.07.19.1' },
      '2026-07-20T13:00:00.000Z',
      'release-2',
    );

    expect(second.outcome).toBe('published');
    if (second.outcome !== 'published') throw new Error('unreachable');
    expect(second.result.status).toBe('failed');
    expect(second.result.reason).toBe('storage-write');
    // The prior release is still the one being served.
    expect(harness.activeVersion()).toBe(active);
    expect(harness.legacyPublishCalls).toBe(0);
  });

  // Case 31
  it('keeps the previous release for every source-failure combination', async () => {
    const source = await seasonFixture();
    const harness = await publicationHarness();
    const publication = new CoordinatedSeasonPublication({
      commands: harness.commands,
      logger: harness.logger,
    });
    const good = await coordinate(
      [completePort('jolpica', source)],
      fullPlan(source).resources,
    );
    await publication.publish(good, metadataFor(source), GENERATED_AT, 'good');
    const active = harness.activeVersion();
    const publishedSoFar = harness.publishCalls;
    expect(active).toBe(harness.lastCommitted());

    const failures: ProviderResourceOutcome[] = [
      { outcome: 'not-attempted', reason: 'rate-limit-deferred' },
      { outcome: 'not-attempted', reason: 'limiter-unavailable' },
      { outcome: 'not-attempted', reason: 'source-unavailable' },
      { outcome: 'not-attempted', reason: 'cancelled' },
      {
        outcome: 'failed',
        attempts: [attempt('f-1', 'failed')],
        reason: 'provider-unavailable',
      },
      {
        outcome: 'failed',
        attempts: [attempt('f-2', 'rate-limited')],
        reason: 'provider-rate-limited',
      },
      {
        outcome: 'failed',
        attempts: [attempt('f-3', 'failed')],
        reason: 'invalid-payload',
      },
      { outcome: 'mapping-failure', attempts: [attempt('f-4')] },
    ];

    for (const jolpicaOutcome of failures) {
      for (const provisional of [true, false]) {
        const ports = [new FakePort('jolpica', () => jolpicaOutcome)];
        if (provisional) {
          ports.push(new FakePort('openf1', () => jolpicaOutcome));
        }
        const run = await coordinate(
          ports,
          fullPlan(source).resources,
          provisional ? testOnlyProvisionalBound : undefined,
        );
        const outcome = await publication.publish(
          run,
          metadataFor(source),
          GENERATED_AT,
          'never-published',
        );

        expect(outcome.outcome).toBe('withheld');
        expect(harness.activeVersion()).toBe(active);
      }
    }

    expect(harness.publishCalls).toBe(publishedSoFar);
  });

  it('never writes an active pointer from the coordinator itself', async () => {
    const source = await seasonFixture();
    const storage = new MemorySnapshotStorage();
    const run = await coordinate(
      [completePort('jolpica', source)],
      fullPlan(source).resources,
    );

    // A completed run on its own changes no published state whatsoever.
    expect(run.status).toBe('completed');
    expect(await storage.getActiveVersion(SEASON)).toBeNull();
    expect(await storage.getCurrentSeason()).toBeNull();
    expect(await storage.listVersions(SEASON)).toEqual([]);
  });
});
