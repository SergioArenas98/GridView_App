/**
 * A local harness for the observation orchestration. Nothing here can reach a
 * provider or Cloudflare:
 *
 * - the transport is a local function that answers from memory, routing by
 *   path onto the synthetic Jolpica envelopes the port tests already use
 *   (every provider identity is read from committed curated content);
 * - the limiter is a scripted in-memory double that records every
 *   reservation;
 * - the ledger is the real C1 store over one in-memory host. Every run builds
 *   a **fresh** ledger client and store over that host, so each run restarts
 *   from committed state and nothing survives between runs but the host;
 * - the authority is the real local sequencer, seeded and activated from a
 *   mock release by the sequenced-publication test support;
 * - `publishGuarded` is a spy that fails the test if it is ever called.
 */

import { vi } from 'vitest';

import { CapturingLogger } from '../../../../src/logging/logger';
import type { GuardedPublicationCommands } from '../../../../src/publication/commands';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../../../src/providers/http/provider-rate-limiter';
import type { ProviderTransport } from '../../../../src/providers/http/provider-http-client';
import type { RealProviderSourceId } from '../../../../src/providers/http/reservation-engine';
import { MemorySequencerHost } from '../../../../src/publication/sequencer/hosts';
import type { SeasonPublicationSequencerPort } from '../../../../src/publication/sequencer/port';
import type { SnapshotStorage } from '../../../../src/storage/types';
import {
  LocalReconciliationLedger,
  ReconciliationLedgerStore,
  type ClassificationRecord,
  type LedgerSnapshot,
  type SeasonRecord,
} from '../../../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import {
  observeCoordinatedSeason,
  type CoordinatedObservationDependencies,
  type CoordinatedObservationOutcome,
} from '../../../../src/sync/coordinated/observation';
import type { RunTrigger } from '../../../../src/sync/coordinated/policy';
import {
  circuitsEnvelope,
  fullSeasonCircuitRows,
} from '../../../providers/jolpica/circuits-support';
import {
  constructorsEnvelope,
  driversEnvelope,
  fullSeasonConstructorRows,
  fullSeasonDriverRows,
} from '../../../providers/jolpica/participants-support';
import {
  baseRows,
  locatorFor,
  resultsEnvelope,
} from '../../../providers/jolpica/results-support';
import {
  baseConstructorRows,
  baseDriverRows,
  constructorStandingsEnvelope,
  driverStandingsEnvelope,
} from '../../../providers/jolpica/standings-support';
import { envelope, fullSeasonRaces } from '../../../providers/jolpica/support';
import { sequencedContext } from '../../../publication/sequenced/support';
import { MutableClock } from '../../../publication/sequencer/support';

export const SEASON = 2026;
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
export const ORIGIN = 'https://api.jolpi.ca/ergast/f1/2026';

/** The fixture calendar puts round `r` at 12:00 UTC, one week apart from 1 March. */
export function anchorOf(round: number): Date {
  return new Date(Date.UTC(2026, 2, 1, 12) + (round - 1) * 7 * DAY);
}

/** `hours` after round `round`'s anchor, at minute 17. */
export function tickAfter(round: number, hours: number): string {
  return new Date(
    anchorOf(round).getTime() + hours * HOUR + 17 * 60 * 1000,
  ).toISOString();
}

/** A pre-season tick, before any race is eligible. */
export const PRE_SEASON = '2026-02-20T03:17:00.000Z';

/** The paths each resource is served at, in the planner's request order. */
export const paths = {
  calendar: '/races/',
  circuits: '/circuits/',
  drivers: '/drivers/',
  constructors: '/constructors/',
  driverStandings: '/driverstandings/',
  constructorStandings: '/constructorstandings/',
  results: (round: number) => `/${round}/results/`,
} as const;

/** The six season-level requests of a publication run, in order. */
export const seasonPaths: readonly string[] = [
  paths.calendar,
  paths.circuits,
  paths.drivers,
  paths.constructors,
  paths.driverStandings,
  paths.constructorStandings,
];

/** A synthetic classification. Each variant is a different revision. */
export type ResultVariant = 'A' | 'B' | 'C';

const winnerPoints: Readonly<Record<ResultVariant, string>> = {
  A: '25',
  B: '26',
  C: '27',
};

export function resultsBody(
  round: number,
  variant: ResultVariant = 'A',
): Record<string, unknown> {
  const locator = locatorFor(round);
  const rows = baseRows();
  rows[0] = { ...rows[0], points: winnerPoints[variant] };
  return resultsEnvelope(rows, {
    round: String(round),
    raceRound: String(round),
    raceName: locator.raceName,
    circuitId: locator.circuitId,
  });
}

/** What the server answers for one path: a body, a status, or a network error. */
export type Answer =
  | { readonly kind: 'json'; readonly body: unknown }
  | { readonly kind: 'status'; readonly status: number }
  | { readonly kind: 'network' };

/** The local Jolpica double. Every request is recorded by its path. */
export class JolpicaServer {
  readonly requests: string[] = [];
  /** Per-path overrides; the default is the synthetic resource. */
  readonly answers = new Map<string, () => Answer>();
  /** The variant each round's classification is served as. */
  readonly results = new Map<number, ResultVariant>();
  /** Called after each request is recorded, before it is answered. */
  onRequest: (path: string) => void = () => {};

  readonly transport: ProviderTransport = async (request) => {
    const url = new URL(request.url);
    if (!url.href.startsWith(ORIGIN)) {
      throw new Error(`unexpected origin ${url.origin}`);
    }
    const path = url.pathname.slice('/ergast/f1/2026'.length);
    this.requests.push(path);
    this.onRequest(path);
    const answer = this.answers.get(path)?.() ?? this.defaultAnswer(path);
    if (answer.kind === 'network') throw new TypeError('network');
    if (answer.kind === 'status') {
      return new Response('{}', {
        status: answer.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(answer.body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  private defaultAnswer(path: string): Answer {
    const json = (body: unknown): Answer => ({ kind: 'json', body });
    switch (path) {
      case paths.calendar:
        return json(envelope(fullSeasonRaces()));
      case paths.circuits:
        return json(circuitsEnvelope(fullSeasonCircuitRows()));
      case paths.drivers:
        return json(driversEnvelope(fullSeasonDriverRows()));
      case paths.constructors:
        return json(constructorsEnvelope(fullSeasonConstructorRows()));
      case paths.driverStandings:
        return json(
          driverStandingsEnvelope(baseDriverRows(), {
            round: '1',
            listRound: '1',
          }),
        );
      case paths.constructorStandings:
        return json(
          constructorStandingsEnvelope(baseConstructorRows(), {
            round: '1',
            listRound: '1',
          }),
        );
    }
    const round = /^\/(\d+)\/results\/$/.exec(path);
    if (round !== null) {
      const variant = this.results.get(Number(round[1]));
      if (variant !== undefined) {
        return json(resultsBody(Number(round[1]), variant));
      }
      return { kind: 'status', status: 503 };
    }
    return { kind: 'status', status: 404 };
  }
}

export type LimiterAnswer =
  'allowed' | 'unavailable' | { readonly deferredUntil: string };

/** A limiter that answers by call index and records every reservation. */
export class ScriptedLimiter implements ProviderRateLimiterClient {
  readonly reservations: string[] = [];
  script: (call: number) => LimiterAnswer = () => 'allowed';

  async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    this.reservations.push(sourceId);
    const answer = this.script(this.reservations.length);
    if (answer === 'allowed') {
      return { outcome: 'allowed', sourceId, headroom: [] };
    }
    if (answer === 'unavailable') {
      return {
        outcome: 'unavailable',
        sourceId,
        reason: 'limiter-unreachable',
      };
    }
    return {
      outcome: 'deferred',
      sourceId,
      retryAt: answer.deferredUntil,
      limitingWindows: [],
      headroom: [],
    };
  }
}

export interface RunOptions {
  readonly trigger?: RunTrigger;
  readonly signal?: AbortSignal;
  /** Replaces the sequencer the authority is read from. */
  readonly sequencer?: SeasonPublicationSequencerPort;
  /** Replaces the ledger client; the default is a fresh one over the host. */
  readonly ledger?: ReconciliationLedgerPort | null;
  readonly storage?: SnapshotStorage;
}

export interface RunRecord {
  readonly outcome: CoordinatedObservationOutcome;
  /** Paths requested by this run, in order. */
  readonly requests: readonly string[];
  /** Reservations asked by this run. */
  readonly reservations: number;
}

export class ObservationHarness {
  readonly clock = new MutableClock(new Date(PRE_SEASON));
  readonly host = new MemorySequencerHost();
  readonly server = new JolpicaServer();
  readonly limiter = new ScriptedLimiter();
  readonly logger = new CapturingLogger();
  readonly publishGuarded = vi.fn(async () => {
    throw new Error('publishGuarded must not be called');
  });
  readonly guarded: GuardedPublicationCommands = {
    publishGuarded: this.publishGuarded,
  };

  private constructor(
    readonly sequencer: SeasonPublicationSequencerPort,
    readonly storage: SnapshotStorage,
  ) {}

  static async create(
    cutover: 'active' | 'seeded' | 'none' = 'active',
  ): Promise<ObservationHarness> {
    const context = await sequencedContext({ cutover });
    return new ObservationHarness(context.port, context.storage);
  }

  /** A fresh ledger client and store over the durable host: a restart. */
  freshLedger(): LocalReconciliationLedger {
    return new LocalReconciliationLedger(
      new ReconciliationLedgerStore(this.host, { clock: this.clock }),
    );
  }

  dependencies(options: RunOptions = {}): CoordinatedObservationDependencies {
    return {
      limiter: this.limiter,
      authorityMode: 'sequencer',
      guarded: this.guarded,
      purgeOrigin: 'https://api.gridview.test',
      ledger:
        options.ledger === undefined ? this.freshLedger() : options.ledger,
      transport: this.server.transport,
      sleep: async (millis) => this.clock.advance(millis),
      logger: this.logger,
      clock: this.clock,
      sequencer: options.sequencer ?? this.sequencer,
      storage: options.storage ?? this.storage,
    };
  }

  /** One run at `at`, recording exactly what it asked for. */
  async run(at: string, options: RunOptions = {}): Promise<RunRecord> {
    this.clock.set(at);
    const requests = this.server.requests.length;
    const reservations = this.limiter.reservations.length;
    const outcome = await observeCoordinatedSeason(
      {
        season: SEASON,
        trigger: options.trigger ?? 'scheduled',
        ...(options.signal ? { signal: options.signal } : {}),
      },
      this.dependencies(options),
    );
    return {
      outcome,
      requests: this.server.requests.slice(requests),
      reservations: this.limiter.reservations.length - reservations,
    };
  }

  async snapshot(): Promise<LedgerSnapshot> {
    const read = await this.freshLedger().readSeason(SEASON);
    if (read.outcome !== 'read') throw new Error('ledger read refused');
    return read.snapshot;
  }

  async season(): Promise<SeasonRecord> {
    const record = (await this.snapshot()).seasonRecord?.record;
    if (record === undefined) throw new Error('no season record');
    return record;
  }

  async record(round: number): Promise<ClassificationRecord | null> {
    return (
      (await this.snapshot()).classifications.find(
        (entry) => entry.record.round === round,
      )?.record ?? null
    );
  }

  /**
   * The committed observation state - season, classification and backlog
   * records - for byte comparison. The lease record and the reconciliation
   * stamp (`published:`), which every run under a lease rewrites, are left
   * out and asserted on their own.
   */
  observationState(): string {
    return JSON.stringify(
      this.host
        .committedKeys()
        .filter(
          (key) => !key.startsWith('lease:') && !key.startsWith('published:'),
        )
        .map((key) => [key, this.host.peek(key)]),
    );
  }
}

/** The fields a record changed from `before` to `after`, sorted. */
export function changedFields(
  before: object | null,
  after: object | null,
): string[] {
  const left = (before ?? {}) as Record<string, unknown>;
  const right = (after ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys]
    .filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]))
    .sort();
}
