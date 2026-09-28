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

import type { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import type { CapturingLogger } from '../../../src/logging/logger';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import type { GuardedPublicationCommands } from '../../../src/publication/commands';
import { FixedClock } from '../../../src/runtime/clock';
import {
  generateSnapshotSet,
  type GeneratedSnapshotSet,
} from '../../../src/snapshots/generator';
import type { MemorySnapshotStorage } from '../../../src/storage/local';
import type {
  SnapshotDocumentName,
  StoredSnapshot,
} from '../../../src/storage/types';
import {
  SEED_ORDERING_INPUT,
  SEED_VERSION,
  sequencedContext,
  type SequencedContext,
  type SequencerTransport,
} from '../../publication/sequenced/support';
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

/**
 * The curated season, read through the production mock provider, with its
 * participation restricted to the spans its own classification supports.
 *
 * The mock line-up is authored, not derived from results (ADR 0026,
 * "Non-conforming development data"): it holds spans - Russell's, and the
 * round 1-9 and round 10+ alpine seats - that no classified race row in this
 * calendar observes. A coordinated candidate must prove participation against
 * its selected classifications in both directions (`result-entry-span`,
 * `driver-entry-support`), so the fixture keeps exactly the entries whose
 * driver has a row in a classified race, and nothing is invented. The public
 * mock snapshots are unaffected: they are generated from the provider source
 * directly.
 *
 * Those entries are what season assembly derives from this calendar, written
 * out rather than computed: its only classified race is its first round, so
 * every span opens and stays open there (null/null), carries no race number or
 * short code (ADR 0026 D8), and the collection is ordered by driver. No port
 * contributes them - see `payloadFor`.
 */
export async function seasonFixture(): Promise<ProviderSeasonSource> {
  const provider = new MockFormulaOneProvider({
    clock: new FixedClock(new Date(FIXED_NOW)),
    sourceUpdatedAt: '2026-07-18T11:55:00.000Z',
    contentVersion: '2026.07.18.1',
  });
  const source = await provider.fetchSeasonSource(SEASON, ['season-calendar']);
  const classified = new Set(
    source.results
      .filter(
        (result) =>
          result.sessionType === 'race' &&
          (result.status === 'final' || result.status === 'provisional'),
      )
      .flatMap((result) => result.entries.map((entry) => entry.driverId)),
  );
  const driverEntries = source.driverEntries
    .filter((entry) => classified.has(entry.driverId))
    .map((entry) => ({ ...entry, raceNumber: null, shortCode: null }))
    .sort((left, right) => (left.driverId < right.driverId ? -1 : 1));
  if (
    driverEntries.some(
      (entry) =>
        entry.startRound !== null ||
        entry.endRound !== null ||
        entry.role !== 'race',
    )
  ) {
    throw new Error('fixture gap: the mock line-up changed shape');
  }
  return { ...source, driverEntries };
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
 * The internal round a fixture's standings describe (ADR 0023 A3.5): its
 * latest classified race round, or `null` when none is classified. A fixture
 * is authored as one coherent season, so its tables are read as describing
 * exactly that round; a test that needs another round states it explicitly.
 */
export function standingsRoundFor(source: ProviderSeasonSource): number | null {
  const rounds = source.results
    .filter(
      (result) =>
        result.sessionType === 'race' &&
        (result.status === 'final' || result.status === 'provisional'),
    )
    .map((result) => result.round);
  return rounds.length === 0 ? null : Math.max(...rounds);
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
      // Like the Jolpica participants port, the contribution carries no
      // participation spans: season assembly derives them from the selected
      // race classifications (ADR 0026 D11).
      return {
        kind: 'season-participants',
        drivers: source.drivers,
        constructors: source.constructors,
        driverEntries: [],
        constructorEntries: source.constructorEntries,
      };
    case 'season-circuits':
      return { kind: 'season-circuits', circuits: source.circuits };
    case 'driver-standings':
      return {
        kind: 'driver-standings',
        round: standingsRoundFor(source),
        standings: source.driverStandings,
      };
    case 'constructor-standings':
      return {
        kind: 'constructor-standings',
        round: standingsRoundFor(source),
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
        attempts: [attempt(`${referencePrefix}-${sequence}`, 'failed')],
        reason: 'invalid-payload',
      };
    }
    return {
      outcome: 'candidate',
      attempts: [attempt(`${referencePrefix}-${sequence}`)],
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
      attempts: [
        attempt(
          `${referencePrefix}-${sequence}`,
          reason === 'provider-rate-limited' ? 'rate-limited' : 'failed',
        ),
      ],
      reason,
    };
  });
}

export interface PublicationHarness {
  /** The real sequencer, sequenced service and legacy publisher behind it. */
  readonly context: SequencedContext;
  readonly storage: MemorySnapshotStorage;
  /** What the bridge publishes through: the real guarded sequenced service. */
  readonly commands: GuardedPublicationCommands;
  readonly purger: MemoryCachePurgeAdapter;
  readonly logger: CapturingLogger;
  /** The legacy release every harness starts from, and the sequencer's seed. */
  readonly seedVersion: string;
  /** Guarded publication calls the bridge made. */
  publishCalls: number;
  /** `SnapshotPublisher.publish` calls after setup. Coordination must make none. */
  legacyPublishCalls: number;
  /** Every set the bridge handed over, as received, and a copy taken first. */
  readonly handed: {
    readonly set: GeneratedSnapshotSet;
    readonly copy: GeneratedSnapshotSet;
  }[];
  /**
   * The version the season's authority serves: the sequencer's own committed
   * record, read directly rather than through the transport, or `null` while
   * the season is not `active`. The legacy `active:{season}` pointer is never
   * what a guarded publication moves.
   */
  activeVersion(): string | null;
  /** The version the latest `applied` guarded publication committed, if any. */
  lastCommitted(): string | null;
  /** One document of the version the authority serves now. */
  activeDocument(name: SnapshotDocumentName): Promise<StoredSnapshot | null>;
}

/**
 * The **real** guarded publication path over in-memory storage: a
 * `SequencedPublicationService` over the in-process sequencer or its Durable
 * Object client, seeded from a legacy publication of the mock baseline (whose
 * only classified race is round 12, with five participation facts) and, by
 * default, activated. Counters around it let a test prove guarded publication
 * happened at most once and the legacy publisher was never reached.
 *
 * `seedSource` replaces the mock baseline with a release generated from that
 * source, for a test whose candidate must be compared against a predecessor
 * of its own season shape rather than the mock line-up.
 */
export async function publicationHarness(
  options: {
    storage?: MemorySnapshotStorage;
    transport?: SequencerTransport;
    cutover?: 'active' | 'seeded' | 'none';
    seedSource?: ProviderSeasonSource;
  } = {},
): Promise<PublicationHarness> {
  const { seedSource, ...rest } = options;
  const context = await sequencedContext({
    ...rest,
    ...(seedSource === undefined
      ? {}
      : { seedTransform: () => seedSetFrom(seedSource) }),
  });
  const committed: string[] = [];
  const harness: PublicationHarness = {
    context,
    storage: context.storage,
    purger: context.purger,
    logger: context.logger,
    seedVersion: SEED_VERSION,
    publishCalls: 0,
    legacyPublishCalls: 0,
    handed: [],
    commands: {
      publishGuarded: async (set) => {
        harness.publishCalls += 1;
        harness.handed.push({ set, copy: structuredClone(set) });
        const result = await context.service.publishGuarded(set);
        if (result.status === 'applied') committed.push(result.version);
        return result;
      },
    },
    lastCommitted: () => committed.at(-1) ?? null,
    activeDocument: async (name) => {
      const version = harness.activeVersion();
      return version === null
        ? null
        : context.storage.readVersionedDocument(SEASON, version, name);
    },
    activeVersion: () => {
      const authority = context.coordinator.readAuthority(SEASON);
      return authority.cutoverState === 'active'
        ? authority.activeVersion
        : null;
    },
  };
  const legacy = context.legacy.publish.bind(context.legacy);
  context.legacy.publish = async (set) => {
    harness.legacyPublishCalls += 1;
    return legacy(set);
  };
  return harness;
}

/** The release a predecessor seed publishes: `source`, generated as the seed. */
export function seedSetFrom(
  source: ProviderSeasonSource,
): GeneratedSnapshotSet {
  return generateSnapshotSet(
    { ...source, sourceUpdatedAt: SEED_ORDERING_INPUT },
    FIXED_NOW,
    SEED_VERSION,
  );
}
