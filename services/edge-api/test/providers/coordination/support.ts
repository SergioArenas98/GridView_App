/**
 * Shared helpers for the multi-source coordination tests.
 *
 * Every fixture here is derived from the **checked-in curated content**, read
 * through the existing deterministic mock provider, so no test duplicates
 * production assembly logic, invents a season or depends on the calendar.
 * Nothing in this directory reads the network, needs a Cloudflare binding or
 * can reach a provider: the ports are local fakes and there is no transport at
 * all.
 */

import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import { CapturingLogger } from '../../../src/logging/logger';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import { SnapshotPublisher } from '../../../src/publication/publisher';
import { FixedClock } from '../../../src/runtime/clock';
import { MemorySnapshotStorage } from '../../../src/storage/local';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import type {
  CoordinationPlan,
  CoordinatedPayload,
  CoordinatedResource,
  CoordinatedSourceId,
  ProviderResourceOutcome,
  ProviderResourcePort,
  ProviderResourceRequest,
  ProviderTransportAttempt,
  SeasonSnapshotMetadata,
} from '../../../src/providers/coordination';
import type { ProviderAttemptOutcome } from '../../../src/providers/provider-metrics';

export const SEASON = 2026;
export const FIXED_NOW = '2026-07-20T12:00:00.000Z';

/** The curated season, read through the production mock provider. */
export async function seasonFixture(): Promise<ProviderSeasonSource> {
  const provider = new MockFormulaOneProvider({
    clock: new FixedClock(new Date(FIXED_NOW)),
    sourceUpdatedAt: '2026-07-18T11:55:00.000Z',
    contentVersion: '2026.07.18.1',
  });
  return provider.fetchSeasonSource(SEASON, ['season-calendar']);
}

/** The publication metadata a caller supplies. Never derived by coordination. */
export function metadataFor(
  source: ProviderSeasonSource,
): SeasonSnapshotMetadata {
  return {
    contentVersion: source.contentVersion,
    mediaVersion: source.mediaVersion,
    attributionVersion: source.attributionVersion,
    sourceUpdatedAt: source.sourceUpdatedAt,
    seasonLabel: source.seasonLabel,
  };
}

export function rounds(source: ProviderSeasonSource): number[] {
  return source.calendar.map((event) => event.round);
}

/** Season-scoped resources, in a fixed order. */
export const seasonResources: readonly CoordinatedResource[] = [
  { kind: 'season-calendar', season: SEASON },
  { kind: 'season-participants', season: SEASON },
  { kind: 'season-circuits', season: SEASON },
  { kind: 'driver-standings', season: SEASON },
  { kind: 'constructor-standings', season: SEASON },
];

export function raceResource(round: number): CoordinatedResource {
  return {
    kind: 'session-classification',
    season: SEASON,
    round,
    sessionType: 'race',
  };
}

/** Everything a publishable season needs, and nothing else. */
export function fullPlan(source: ProviderSeasonSource): CoordinationPlan {
  return {
    season: SEASON,
    resources: [
      ...seasonResources,
      ...rounds(source).map((round) => raceResource(round)),
    ],
  };
}

/**
 * The payload a source would contribute for one resource.
 *
 * Returns `null` when the fixture has nothing for that identity, which is what
 * lets a test model a genuine absence without inventing data.
 */
export function payloadFor(
  source: ProviderSeasonSource,
  resource: CoordinatedResource,
): CoordinatedPayload | null {
  switch (resource.kind) {
    case 'season-calendar':
      return { kind: 'season-calendar', events: source.calendar };
    case 'season-participants':
      return {
        kind: 'season-participants',
        drivers: source.drivers,
        constructors: source.constructors,
        driverEntries: source.driverEntries,
        constructorEntries: source.constructorEntries,
      };
    case 'season-circuits':
      return { kind: 'season-circuits', circuits: source.circuits };
    case 'driver-standings':
      return { kind: 'driver-standings', standings: source.driverStandings };
    case 'constructor-standings':
      return {
        kind: 'constructor-standings',
        standings: source.constructorStandings,
      };
    case 'event-schedule': {
      const event = source.calendar.find(
        (candidate) => candidate.round === resource.round,
      );
      return event === undefined
        ? null
        : {
            kind: 'event-schedule',
            round: resource.round,
            sessions: event.sessions,
          };
    }
    case 'session-classification': {
      const result = source.results.find(
        (candidate) =>
          candidate.round === resource.round &&
          candidate.sessionType === resource.sessionType,
      );
      return result === null || result === undefined
        ? null
        : { kind: 'session-classification', result };
    }
  }
}

/**
 * A **test-only** eligibility fixture that unlocks the provisional source.
 *
 * This is not a recorded maximum-session-duration bound and must never be read
 * as one: no official source or access date supports it, and
 * `recordedProvisionalSessionEndBound` in the production policy is still
 * `null`. It exists so the provisional half of the selection matrix can be
 * exercised offline against fake ports, exactly as ADR 0020 D5.5 permits.
 */
export const testOnlyProvisionalBound = {
  kind: 'session-end-bound-recorded',
  boundSeconds: 7200,
} as const;

export function attempt(
  reference: string,
  outcome: ProviderAttemptOutcome = 'successful',
): ProviderTransportAttempt {
  return { reference, outcome };
}

/**
 * A local fake port.
 *
 * It records every request it receives, so a test can prove that a guard fired
 * *before* the adapter rather than merely that the result looked right.
 */
export class FakePort implements ProviderResourcePort {
  readonly requests: ProviderResourceRequest[] = [];
  /** Peak simultaneous in-flight calls, for the concurrency bound. */
  peakInFlight = 0;
  private inFlight = 0;

  constructor(
    readonly sourceId: CoordinatedSourceId,
    private readonly answer: (
      request: ProviderResourceRequest,
    ) => ProviderResourceOutcome | Promise<ProviderResourceOutcome>,
  ) {}

  async fetchResource(
    request: ProviderResourceRequest,
  ): Promise<ProviderResourceOutcome> {
    this.requests.push(request);
    this.inFlight += 1;
    this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
    try {
      return await this.answer(request);
    } finally {
      this.inFlight -= 1;
    }
  }
}

/** A port that answers every supported resource from the curated fixture. */
export function completePort(
  sourceId: CoordinatedSourceId,
  source: ProviderSeasonSource,
  referencePrefix = sourceId,
): FakePort {
  let sequence = 0;
  return new FakePort(sourceId, (request) => {
    const payload = payloadFor(source, request.resource);
    sequence += 1;
    if (payload === null) {
      return {
        outcome: 'failed',
        attempt: attempt(`${referencePrefix}-${sequence}`, 'failed'),
        reason: 'invalid-payload',
      };
    }
    return {
      outcome: 'candidate',
      attempt: attempt(`${referencePrefix}-${sequence}`),
      payload,
    };
  });
}

/** A port that never contributes anything, for the unavailable-source cases. */
export function failingPort(
  sourceId: CoordinatedSourceId,
  reason:
    'provider-unavailable' | 'provider-rate-limited' = 'provider-unavailable',
  referencePrefix = `${sourceId}-fail`,
): FakePort {
  let sequence = 0;
  return new FakePort(sourceId, () => {
    sequence += 1;
    return {
      outcome: 'failed',
      attempt: attempt(
        `${referencePrefix}-${sequence}`,
        reason === 'provider-rate-limited' ? 'rate-limited' : 'failed',
      ),
      reason,
    };
  });
}

export interface PublicationHarness {
  storage: MemorySnapshotStorage;
  publisher: SnapshotPublisher;
  purger: MemoryCachePurgeAdapter;
  logger: CapturingLogger;
  publishCalls: number;
}

/**
 * The **real** publisher over in-memory storage, with a counter around it so a
 * test can prove publication happened at most once.
 */
export function publicationHarness(): PublicationHarness {
  const storage = new MemorySnapshotStorage();
  const purger = new MemoryCachePurgeAdapter();
  const logger = new CapturingLogger();
  const publisher = new SnapshotPublisher(
    storage,
    runtimeSnapshotValidator,
    purger,
    logger,
    'https://api.gridview.test',
  );
  const harness: PublicationHarness = {
    storage,
    publisher,
    purger,
    logger,
    publishCalls: 0,
  };
  const real = publisher.publish.bind(publisher);
  publisher.publish = async (set) => {
    harness.publishCalls += 1;
    return real(set);
  };
  return harness;
}
