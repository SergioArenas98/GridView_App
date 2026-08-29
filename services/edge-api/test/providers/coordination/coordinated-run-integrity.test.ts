/**
 * Two invariants that decide whether a coordinated run may publish at all.
 *
 * 1. **A completed round needs an actual classification.** A race result
 *    document exists for every round, because the public contract requires a
 *    not-yet-run session to answer with a meaningful absence rather than a
 *    fabricated empty classification. So the presence of a *document* proves
 *    nothing: only `final` or `provisional` proves a race was classified, and
 *    only that may satisfy a completed round's completeness.
 * 2. **A same-source transport contradiction taints the whole run.** Two
 *    outcomes claiming one physical request with different endings cannot both
 *    be true. A healthy candidate from the other source must not be able to
 *    paper over that: the run's accounting is already corrupted, and publishing
 *    a complete-looking season on top of it hides an impossible adapter
 *    history.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  isClassifiedResult,
  type CoordinatedResource,
  type CoordinationRun,
  type ProviderResourceOutcome,
} from '../../../src/providers/coordination';
import { RESULT_STATUSES } from '../../../src/contract/enums';
import type { ResultStatus } from '../../../src/contract/enums';
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
  rounds,
  seasonFixture,
  seasonResources,
  testOnlyProvisionalBound,
  type PublicationHarness,
} from './support';

const VERSION = 'v1';

function sourceWith(
  source: ProviderSeasonSource,
  overrides: Partial<ProviderSeasonSource>,
): ProviderSeasonSource {
  return { ...source, ...overrides };
}

/** The round the curated season has actually classified. */
function classifiedRound(source: ProviderSeasonSource): number {
  const result = source.results.find(
    (candidate) => candidate.status === 'final',
  );
  if (result === undefined) throw new Error('fixture gap');
  return result.round;
}

/**
 * The curated season with one round completed and carrying a race result of the
 * given status, and its `hasResults` flag set truthfully for that status.
 *
 * The flag is derived from the production predicate rather than hard-coded, so
 * this fixture cannot drift away from the rule it is meant to probe.
 */
async function completedRoundWith(
  status: ResultStatus,
): Promise<{ source: ProviderSeasonSource; round: number }> {
  const base = await seasonFixture();
  const round = classifiedRound(base);
  const classified = isClassifiedResult(status);
  return {
    round,
    source: sourceWith(base, {
      calendar: base.calendar.map((event) =>
        event.round === round
          ? { ...event, status: 'completed' as const, hasResults: classified }
          : event,
      ),
      results: base.results.map((result) =>
        result.round === round
          ? {
              ...result,
              status,
              entries: classified ? result.entries : [],
              fastestLap: classified ? result.fastestLap : null,
            }
          : result,
      ),
    }),
  };
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

describe('a completed round needs a real classification', () => {
  it('classifies exactly final and provisional, and nothing else', () => {
    const classified = RESULT_STATUSES.filter((status) =>
      isClassifiedResult(status),
    );
    expect([...classified].sort()).toEqual(['final', 'provisional']);
    // An unrecognised value is not a classification either.
    expect(isClassifiedResult('not-a-status' as ResultStatus)).toBe(false);
  });

  for (const status of ['final', 'provisional'] as const) {
    it(`accepts a completed round classified as ${status}`, async () => {
      const { source } = await completedRoundWith(status);
      const harness = publicationHarness();

      const run = await coordinate(source, fullPlan(source).resources);
      const assembly = assembleSeasonSource(run, metadataFor(source));
      const outcome = await publish(harness, run, source);

      expect(assembly.complete, status).toBe(true);
      expect(outcome.outcome, status).toBe('published');
      expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);
    });
  }

  for (const status of ['unavailable', 'unknown'] as const) {
    it(`withholds a completed round whose result is ${status}`, async () => {
      const { source, round } = await completedRoundWith(status);
      const harness = publicationHarness();

      const run = await coordinate(source, fullPlan(source).resources);
      const assembly = assembleSeasonSource(run, metadataFor(source));
      const outcome = await publish(harness, run, source);

      expect(assembly.complete, status).toBe(false);
      if (!assembly.complete) {
        expect(assembly.gap, status).toBe('missing-round-classification');
        expect(
          assembly.missing.map((resource) =>
            resource.kind === 'session-classification' ? resource.round : null,
          ),
          status,
        ).toEqual([round]);
      }
      expect(outcome.outcome, status).toBe('withheld');
      expect(harness.publishCalls, status).toBe(0);
      expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
    });
  }

  it('keeps an unavailable result as a meaningful absence for a future round', async () => {
    // The unchanged curated season is exactly this shape: one classified round
    // and four non-completed rounds carrying `unavailable` documents.
    const source = await seasonFixture();
    const harness = publicationHarness();

    const run = await coordinate(source, fullPlan(source).resources);
    const outcome = await publish(harness, run, source);

    expect(outcome.outcome).toBe('published');
    const absent = source.results.filter(
      (result) => result.status === 'unavailable',
    );
    expect(absent.length).toBeGreaterThan(0);
    for (const result of absent) {
      // The document is still published: absence is meaningful, not omitted.
      const stored = await harness.storage.readVersionedDocument(
        SEASON,
        VERSION,
        `grand-prix:${result.round}:results`,
      );
      expect(stored, `round ${result.round}`).not.toBeNull();
    }
  });

  it('preserves last-known-good when a completed classification is missing', async () => {
    const healthy = await seasonFixture();
    const harness = publicationHarness();
    const good = await coordinate(healthy, fullPlan(healthy).resources);
    await publish(harness, good, healthy);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);

    const { source } = await completedRoundWith('unavailable');
    const run = await coordinate(source, fullPlan(source).resources);
    const outcome = await publish(harness, run, source, 'v2');

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(1);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);
  });

  it('is deterministic under reversed plan order', async () => {
    const { source } = await completedRoundWith('unavailable');
    const forward = fullPlan(source).resources;

    for (const plan of [forward, [...forward].reverse()]) {
      const harness = publicationHarness();
      const run = await coordinate(source, plan);
      const outcome = await publish(harness, run, source);
      expect(outcome.outcome).toBe('withheld');
      expect(harness.publishCalls).toBe(0);
    }
  });
});

describe('a same-source transport contradiction taints the whole run', () => {
  const contradictions: [
    'successful' | 'failed' | 'rate-limited',
    'successful' | 'failed' | 'rate-limited',
  ][] = [
    ['successful', 'failed'],
    ['successful', 'rate-limited'],
    ['failed', 'rate-limited'],
  ];

  /**
   * A reconciled port that reuses one reference with two different endings
   * across the calendar and the circuits resource, and a provisional port that
   * answers everything correctly.
   */
  function conflictingPorts(
    source: ProviderSeasonSource,
    first: 'successful' | 'failed' | 'rate-limited',
    second: 'successful' | 'failed' | 'rate-limited',
  ): [ReturnType<typeof completePort>, ReturnType<typeof completePort>] {
    const outcomeFor = (
      resource: CoordinatedResource,
      ending: 'successful' | 'failed' | 'rate-limited',
    ): ProviderResourceOutcome => {
      if (ending === 'successful') {
        const payload = payloadFor(source, resource);
        if (payload === null) throw new Error('fixture gap');
        return {
          outcome: 'candidate',
          attempt: attempt('shared-token', 'successful'),
          payload,
        };
      }
      return {
        outcome: 'failed',
        attempt: attempt('shared-token', ending),
        reason:
          ending === 'rate-limited'
            ? 'provider-rate-limited'
            : 'provider-unavailable',
      };
    };

    const conflicting = new FakePort('jolpica', (request) => {
      if (request.resource.kind === 'season-calendar') {
        return outcomeFor(request.resource, first);
      }
      if (request.resource.kind === 'season-circuits') {
        return outcomeFor(request.resource, second);
      }
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return {
        outcome: 'candidate',
        attempt: attempt(`j-${request.resource.kind}`),
        payload,
      };
    });
    return [conflicting, completePort('openf1', source)];
  }

  for (const [first, second] of contradictions) {
    it(`fails the run for ${first} versus ${second}`, async () => {
      const source = await seasonFixture();
      const harness = publicationHarness();
      const ports = conflictingPorts(source, first, second);

      const run = await new MultiSourceCoordinator({
        ports,
        logger: harness.logger,
        provisionalSessionEndBound: testOnlyProvisionalBound,
      }).coordinate({ plan: fullPlan(source) });
      const assembly = assembleSeasonSource(run, metadataFor(source));
      const outcome = await publish(harness, run, source);

      expect(run.status, `${first}/${second}`).toBe('invariant-violated');
      expect(assembly.complete).toBe(false);
      expect(outcome.outcome).toBe('withheld');
      expect(harness.publishCalls, 'publisher must never be called').toBe(0);
      expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
    });
  }

  it('taints the run whichever contribution order the conflict arrives in', async () => {
    const source = await seasonFixture();
    for (const [first, second] of [
      ['successful', 'failed'],
      ['failed', 'successful'],
    ] as const) {
      const harness = publicationHarness();
      const run = await new MultiSourceCoordinator({
        ports: conflictingPorts(source, first, second),
        logger: harness.logger,
        provisionalSessionEndBound: testOnlyProvisionalBound,
        maxConcurrentOperations: 2,
      }).coordinate({ plan: fullPlan(source) });

      expect(run.status, `${first}/${second}`).toBe('invariant-violated');
      expect(harness.publishCalls).toBe(0);
    }
  });

  it('keeps the same textual reference valid across different sources', async () => {
    const source = await seasonFixture();
    const harness = publicationHarness();
    // Both adapters mint the identical token for genuinely separate requests.
    const ports = [
      completePort('jolpica', source, 'jolpica'),
      completePort('openf1', source, 'jolpica'),
    ];

    const run = await new MultiSourceCoordinator({
      ports,
      logger: harness.logger,
      provisionalSessionEndBound: testOnlyProvisionalBound,
    }).coordinate({ plan: fullPlan(source) });
    const outcome = await publish(harness, run, source);

    expect(run.status).toBe('completed');
    expect(outcome.outcome).toBe('published');
  });

  it('keeps identical repeated same-source claims deduplicated', async () => {
    const source = await seasonFixture();
    const harness = publicationHarness();
    const port = new (
      Object.getPrototypeOf(completePort('jolpica', source))
        .constructor as typeof import('./support').FakePort
    )('jolpica', (request) => {
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return {
        outcome: 'candidate',
        attempt: attempt('one-request', 'successful'),
        payload,
      };
    });

    const run = await new MultiSourceCoordinator({
      ports: [port],
      logger: harness.logger,
    }).coordinate({ plan: fullPlan(source) });
    const outcome = await publish(harness, run, source);

    expect(run.status).toBe('completed');
    expect(run.accounting.lifetime.total).toBe(1);
    expect(outcome.outcome).toBe('published');
  });

  it('preserves accounting already established and never double-counts', async () => {
    const source = await seasonFixture();
    const harness = publicationHarness();
    const run = await new MultiSourceCoordinator({
      ports: conflictingPorts(source, 'successful', 'failed'),
      logger: harness.logger,
      provisionalSessionEndBound: testOnlyProvisionalBound,
    }).coordinate({ plan: fullPlan(source) });

    // The first claim is a real request and stays counted once. The
    // contradicting claim invents nothing.
    const shared = run.accounting.bySource.jolpica;
    expect(shared).toBeDefined();
    expect(run.accounting.lifetime.total).toBeGreaterThan(0);
    const conflicted = run.resources
      .flatMap((resource) => resource.contributions)
      .filter((entry) => entry.reason === 'coordination-invariant');
    expect(conflicted.length).toBe(1);
    expect(conflicted[0]?.attempted).toBe(false);
  });

  it('never writes a raw transport reference into a log line', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    await new MultiSourceCoordinator({
      ports: conflictingPorts(source, 'successful', 'rate-limited'),
      logger,
      provisionalSessionEndBound: testOnlyProvisionalBound,
    }).coordinate({ plan: fullPlan(source) });

    const serialized = logger.serialized();
    expect(serialized).not.toContain('shared-token');
    expect(serialized).not.toContain('reference');
  });

  it('leaves an ordinary provider failure publishable', async () => {
    const source = await seasonFixture();
    const harness = publicationHarness();
    // A plain failure from one source with a healthy fallback is *not* an
    // invariant violation and must keep working.
    const failing = new (
      Object.getPrototypeOf(completePort('openf1', source))
        .constructor as typeof import('./support').FakePort
    )('openf1', () => ({
      outcome: 'failed',
      attempt: attempt('o-1', 'failed'),
      reason: 'provider-unavailable',
    }));

    const run = await new MultiSourceCoordinator({
      ports: [completePort('jolpica', source), failing],
      logger: harness.logger,
      provisionalSessionEndBound: testOnlyProvisionalBound,
    }).coordinate({ plan: fullPlan(source) });
    const outcome = await publish(harness, run, source);

    expect(run.status).toBe('completed');
    expect(outcome.outcome).toBe('published');
  });

  it('leaves an unrelated round list and rounds helper untouched', async () => {
    const source = await seasonFixture();
    expect(rounds(source).length).toBeGreaterThan(0);
    expect(seasonResources.length).toBeGreaterThan(0);
    expect(raceResource(rounds(source)[0] ?? 12).kind).toBe(
      'session-classification',
    );
  });
});
