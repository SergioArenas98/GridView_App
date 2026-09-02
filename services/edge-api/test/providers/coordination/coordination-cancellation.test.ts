/**
 * Cancellation, bounded concurrency and determinism under reordering.
 *
 * Required cases 24-27.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  defaultMaxConcurrentOperations,
  maxAllowedConcurrentOperations,
  type CoordinatedResource,
  type CoordinationRun,
} from '../../../src/providers/coordination';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  FakePort,
  SEASON,
  attempt,
  fullPlan,
  metadataFor,
  payloadFor,
  publicationHarness,
  raceResource,
  seasonFixture,
  seasonResources,
} from './support';

function delay(millis: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

function coordinator(ports: FakePort[], concurrency?: number) {
  const logger = new CapturingLogger();
  return {
    logger,
    subject: new MultiSourceCoordinator({
      ports,
      logger,
      ...(concurrency === undefined
        ? {}
        : { maxConcurrentOperations: concurrency }),
    }),
  };
}

function candidatePort(
  source: ProviderSeasonSource,
  pauseFor: (resource: CoordinatedResource) => number = () => 0,
  onCall?: (calls: number) => void,
): FakePort {
  let calls = 0;
  return new FakePort('jolpica', async (request) => {
    calls += 1;
    onCall?.(calls);
    const pause = pauseFor(request.resource);
    if (pause > 0) await delay(pause);
    const payload = payloadFor(source, request.resource);
    if (payload === null) throw new Error('fixture gap');
    return { outcome: 'candidate', attempt: attempt(`j-${calls}`), payload };
  });
}

describe('cancellation performs and publishes nothing', () => {
  // Case 24
  it('does no work at all when the caller was already gone', async () => {
    const source = await seasonFixture();
    const port = candidatePort(source);
    const { subject } = coordinator([port]);
    const controller = new AbortController();
    controller.abort();

    const run = await subject.coordinate({
      plan: fullPlan(source),
      signal: controller.signal,
    });

    expect(port.requests).toHaveLength(0);
    expect(run.status).toBe('cancelled');
    expect(run.accounting.lifetime.total).toBe(0);
    expect(run.counts.attempted).toBe(0);
    expect(run.counts.selected).toBe(0);
    for (const resource of run.resources) {
      expect(resource.selection.outcome).toBe('unavailable');
      const contribution = resource.contributions.find(
        (entry) => entry.source === 'jolpica',
      );
      expect(contribution?.status).toBe('skipped');
      expect(contribution?.reason).toBe('cancelled');
    }
  });

  // Case 25
  it('schedules nothing further once cancelled mid-run, and never publishes', async () => {
    const source = await seasonFixture();
    const controller = new AbortController();
    const port = candidatePort(source, undefined, (calls) => {
      if (calls === 1) controller.abort();
    });
    const { subject } = coordinator([port]);
    const harness = publicationHarness();

    const run = await subject.coordinate({
      plan: fullPlan(source),
      signal: controller.signal,
    });

    // Exactly the operation that was already in flight, and nothing after it.
    expect(port.requests).toHaveLength(1);
    expect(run.status).toBe('cancelled');
    expect(run.accounting.lifetime.total).toBe(1);

    const publication = new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    });
    const outcome = await publication.publish(
      run,
      metadataFor(source),
      '2026-07-20T12:00:00.000Z',
      'cancelled-run',
    );

    expect(outcome).toMatchObject({
      outcome: 'withheld',
      gap: 'run-not-completed',
    });
    expect(harness.publishCalls).toBe(0);
    expect(await harness.storage.getActiveVersion(SEASON)).toBeNull();
  });

  it('claims no further work once cancellation is observed, at full concurrency', async () => {
    // A deterministic race: every operation parks on a deferred promise, so
    // the pool is provably saturated and the cursor provably has entries left
    // when the abort happens. Nothing is timing-dependent.
    const source = await seasonFixture();
    const resources: CoordinatedResource[] = [
      raceResource(12),
      raceResource(13),
      raceResource(14),
      raceResource(15),
      raceResource(16),
      raceResource(17),
      raceResource(18),
      raceResource(19),
    ];
    const gates: (() => void)[] = [];
    let started = 0;
    let saturated: () => void = () => {};
    const saturation = new Promise<void>((resolve) => {
      saturated = resolve;
    });

    const port = new FakePort('jolpica', async (request) => {
      started += 1;
      const sequence = started;
      if (started === maxAllowedConcurrentOperations) saturated();
      await new Promise<void>((resolve) => gates.push(resolve));
      const payload = payloadFor(source, request.resource);
      if (payload === null) throw new Error('fixture gap');
      return {
        outcome: 'candidate',
        attempt: attempt(`j-${sequence}`),
        payload,
      };
    });

    const controller = new AbortController();
    const { subject } = coordinator([port], maxAllowedConcurrentOperations);
    const pending = subject.coordinate({
      plan: { season: SEASON, resources },
      signal: controller.signal,
    });

    await saturation;
    expect(port.requests).toHaveLength(maxAllowedConcurrentOperations);

    // Cancel while the pool is full and six operations remain unclaimed, then
    // release the in-flight work. Each released worker must observe the abort
    // and stop rather than claim the next index.
    controller.abort();
    for (const release of gates) release();
    const run = await pending;

    expect(port.requests).toHaveLength(maxAllowedConcurrentOperations);
    expect(port.peakInFlight).toBeLessThanOrEqual(
      maxAllowedConcurrentOperations,
    );
    expect(run.status).toBe('cancelled');
    // The four that were already in flight are honoured; nothing after them.
    expect(run.accounting.lifetime.total).toBe(maxAllowedConcurrentOperations);
    expect(run.counts.attempted).toBe(maxAllowedConcurrentOperations);
    const cancelled = run.resources.filter((resource) =>
      resource.contributions.some(
        (contribution) =>
          contribution.source === 'jolpica' &&
          contribution.reason === 'cancelled',
      ),
    );
    expect(cancelled).toHaveLength(
      resources.length - maxAllowedConcurrentOperations,
    );
  });

  it('propagates the caller signal to the port, not a substitute', async () => {
    const source = await seasonFixture();
    const controller = new AbortController();
    const port = candidatePort(source);
    const { subject } = coordinator([port]);

    await subject.coordinate({
      plan: { season: SEASON, resources: [raceResource(12)] },
      signal: controller.signal,
    });

    expect(port.requests[0]?.signal).toBe(controller.signal);
  });

  it('omits the signal entirely when the caller supplied none', async () => {
    const source = await seasonFixture();
    const port = candidatePort(source);
    const { subject } = coordinator([port]);

    await subject.coordinate({
      plan: { season: SEASON, resources: [raceResource(12)] },
    });

    expect(port.requests[0]).not.toHaveProperty('signal');
  });
});

describe('concurrency is explicitly bounded', () => {
  // Case 26
  it('never exceeds the configured bound, and defaults to sequential', async () => {
    const source = await seasonFixture();
    const resources: CoordinatedResource[] = [
      ...seasonResources,
      raceResource(12),
      raceResource(13),
      raceResource(14),
    ];

    for (const bound of [1, 2, maxAllowedConcurrentOperations]) {
      const port = candidatePort(source, () => 5);
      const { subject } = coordinator([port], bound);
      await subject.coordinate({ plan: { season: SEASON, resources } });

      expect(port.requests).toHaveLength(resources.length);
      expect(port.peakInFlight).toBeLessThanOrEqual(bound);
      expect(port.peakInFlight).toBeGreaterThan(0);
    }

    expect(defaultMaxConcurrentOperations).toBe(1);
    const sequentialPort = candidatePort(source, () => 5);
    const { subject } = coordinator([sequentialPort]);
    await subject.coordinate({ plan: { season: SEASON, resources } });
    expect(sequentialPort.peakInFlight).toBe(1);
  });

  it('reaches the bound when there is enough independent work', async () => {
    const source = await seasonFixture();
    const port = candidatePort(source, () => 10);
    const { subject } = coordinator([port], 2);

    await subject.coordinate({
      plan: {
        season: SEASON,
        resources: [
          raceResource(12),
          raceResource(13),
          raceResource(14),
          raceResource(15),
        ],
      },
    });

    expect(port.peakInFlight).toBe(2);
  });
});

describe('the result is deterministic under reordering', () => {
  // Case 27
  it('is byte-identical when operations complete in the opposite order', async () => {
    const source = await seasonFixture();
    const resources: CoordinatedResource[] = [
      raceResource(12),
      raceResource(13),
      raceResource(14),
      raceResource(15),
    ];
    const roundOf = (resource: CoordinatedResource): number =>
      'round' in resource ? resource.round : 0;

    const ascending = await coordinateWith(
      candidatePort(source, (resource) => (roundOf(resource) - 11) * 5),
      resources,
    );
    const descending = await coordinateWith(
      candidatePort(source, (resource) => (16 - roundOf(resource)) * 5),
      resources,
    );

    expect(JSON.stringify(ascending.resources)).toEqual(
      JSON.stringify(descending.resources),
    );
    expect(ascending.counts).toEqual(descending.counts);
    expect(ascending.accounting).toEqual(descending.accounting);
  });

  async function coordinateWith(
    port: FakePort,
    resources: readonly CoordinatedResource[],
  ): Promise<CoordinationRun> {
    const { subject } = coordinator([port], maxAllowedConcurrentOperations);
    return subject.coordinate({ plan: { season: SEASON, resources } });
  }
});
