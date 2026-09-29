/**
 * A local harness for the coordinated orchestration. Nothing here can reach a
 * provider or Cloudflare:
 *
 * - the transport is a local function that answers from memory, routing by
 *   path onto the synthetic Jolpica envelopes the port tests already use
 *   (every provider identity is read from committed curated content);
 * - the limiter is a scripted in-memory double that records every
 *   reservation;
 * - the ledger is the real C1 store over one in-memory host. Every run builds
 *   a **fresh** ledger client and store over that host, so each run restarts
 *   from committed state and nothing survives between runs but the host.
 *   With the `durable-object` transport the client is the Durable Object
 *   client, over a fresh `ReconciliationLedger` object on that same host;
 * - the authority is the real sequencer - in process, or reached through its
 *   Durable Object client - seeded and activated from a mock release by the
 *   sequenced-publication test support;
 * - `publishGuarded` is the real guarded sequenced publication over that
 *   sequencer, behind a spy that counts every call. `portHooks` can make one
 *   sequencer command lose its answer, for either transport.
 */

import { vi } from 'vitest';

import { CapturingLogger } from '../../../../src/logging/logger';
import type { GuardedPublicationCommands } from '../../../../src/publication/commands';
import type { PublicationResult } from '../../../../src/publication/publisher';
import { SequencedPublicationService } from '../../../../src/publication/sequenced/service';
import type { SequencerDurableHost } from '../../../../src/publication/sequencer/hosts';
import type { SequencerRecordStore } from '../../../../src/publication/sequencer/store';
import type { GeneratedSnapshotSet } from '../../../../src/snapshots/generator';
import { runtimeSnapshotValidator } from '../../../../src/validation/snapshot-validator';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../../../src/providers/http/provider-rate-limiter';
import type { ProviderTransport } from '../../../../src/providers/http/provider-http-client';
import type { RealProviderSourceId } from '../../../../src/providers/http/reservation-engine';
import { minimumReservationSpacingMillis } from '../../../../src/providers/http/reservation-pacer';
import { MemorySequencerHost } from '../../../../src/publication/sequencer/hosts';
import type { SeasonPublicationSequencerPort } from '../../../../src/publication/sequencer/port';
import type { SnapshotStorage } from '../../../../src/storage/types';
import {
  DurableObjectReconciliationLedger,
  LocalReconciliationLedger,
  ReconciliationLedger,
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
  emptyStandingsEnvelope,
} from '../../../providers/jolpica/standings-support';
import { envelope, fullSeasonRaces } from '../../../providers/jolpica/support';
import {
  sequencedContext,
  type SequencedContext,
  type SequencerTransport,
} from '../../../publication/sequenced/support';
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

/**
 * The instant a run started at `at` observes its results: after its
 * reservations, which the pacer spaces `minimumReservationSpacingMillis` apart.
 */
export function paced(at: string, reservations: number): string {
  return new Date(
    Date.parse(at) + (reservations - 1) * minimumReservationSpacingMillis,
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

/**
 * A synthetic classification. Each variant is a different revision; `D` is
 * `A` with its last classified driver gone, which removes a participation
 * fact (ADR 0026 D15).
 */
export type ResultVariant = 'A' | 'B' | 'C' | 'D';

const winnerPoints: Readonly<Record<ResultVariant, string>> = {
  A: '25',
  B: '26',
  C: '27',
  D: '25',
};

export function resultsBody(
  round: number,
  variant: ResultVariant = 'A',
): Record<string, unknown> {
  const locator = locatorFor(round);
  const all = baseRows();
  const rows = variant === 'D' ? all.slice(0, -1) : all;
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

  /**
   * The standings are as of the latest round this server classifies, and
   * empty before it classifies any: the round coherence assembly requires.
   */
  private standingsRound(): string | null {
    const rounds = [...this.results.keys()];
    return rounds.length === 0 ? null : String(Math.max(...rounds));
  }

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
      case paths.driverStandings: {
        const round = this.standingsRound();
        return json(
          round === null
            ? emptyStandingsEnvelope('DriverStandings', { round: undefined })
            : driverStandingsEnvelope(baseDriverRows(), {
                round,
                listRound: round,
              }),
        );
      }
      case paths.constructorStandings: {
        const round = this.standingsRound();
        return json(
          round === null
            ? emptyStandingsEnvelope('ConstructorStandings', {
                round: undefined,
              })
            : constructorStandingsEnvelope(baseConstructorRows(), {
                round,
                listRound: round,
              }),
        );
      }
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
  /** Guarded publications this run asked for. */
  readonly publishCalls: number;
  /** The ledger operations the run made on its default client, in order. */
  readonly ledgerCalls: readonly string[];
}

export interface HarnessOptions {
  readonly cutover?: 'active' | 'seeded' | 'none';
  /** How the sequencer and the ledger are reached. */
  readonly transport?: SequencerTransport;
  /**
   * The release the sequencer is seeded from: the mock baseline, whose round
   * 12 is classified with five participation facts, or that release with no
   * classified round, which any complete candidate contains.
   */
  readonly seed?: 'mock' | 'unclassified';
}

/** Seeded behind every fixture instant, so a coordinated candidate is admitted. */
export const SEED_ORDERING = '2026-01-01T00:00:00.000Z';

/**
 * A sequencer command's hook: return the real answer, or throw to lose it -
 * after the command ran (`run()` first) or before it arrived.
 */
export type PortHook = (run: () => Promise<unknown>) => Promise<unknown>;

export class ObservationHarness {
  readonly host = new MemorySequencerHost();
  readonly server = new JolpicaServer();
  readonly limiter = new ScriptedLimiter();
  readonly logger = new CapturingLogger();
  /** Every guarded publication's answer, in order. */
  readonly published: PublicationResult[] = [];
  /** Per-command hooks on the sequencer port the publication service uses. */
  readonly portHooks = new Map<string, PortHook>();
  /** Called before a guarded publication reaches the sequenced service. */
  onPublish: (set: GeneratedSnapshotSet) => Promise<void> | void = () => {};
  readonly publishGuarded = vi.fn(async (set: GeneratedSnapshotSet) => {
    await this.onPublish(set);
    const result = await this.service.publishGuarded(set);
    this.published.push(result);
    return result;
  });
  readonly guarded: GuardedPublicationCommands = {
    publishGuarded: this.publishGuarded,
  };
  readonly service: SequencedPublicationService;
  /** How many sequencer objects the ledger's Durable Object client reached. */
  ledgerObjects = 0;
  /** Every call a run made on its default ledger client, in order. */
  readonly ledgerCalls: string[] = [];

  private constructor(
    readonly context: SequencedContext,
    readonly transport: SequencerTransport,
    /** One clock for the run, the ledger and the sequencer. */
    readonly clock: MutableClock,
  ) {
    this.service = new SequencedPublicationService({
      port: this.hookedPort(context.port),
      fallback: context.legacy,
      storage: context.storage,
      validator: runtimeSnapshotValidator,
      purger: context.purger,
      logger: context.logger,
      clock: this.clock,
      purgeOrigin: 'https://api.gridview.test',
    });
  }

  get sequencer(): SeasonPublicationSequencerPort {
    return this.context.port;
  }

  get storage(): SnapshotStorage {
    return this.context.storage;
  }

  static async create(
    options: HarnessOptions['cutover'] | HarnessOptions = 'active',
  ): Promise<ObservationHarness> {
    const settings: HarnessOptions =
      typeof options === 'string' ? { cutover: options } : options;
    const transport = settings.transport ?? 'local';
    const clock = new MutableClock(new Date(PRE_SEASON));
    const context = await sequencedContext({
      cutover: settings.cutover ?? 'active',
      transport,
      sequencerClock: clock,
      seedOrderingInput: SEED_ORDERING,
      ...(settings.seed === 'unclassified'
        ? { seedTransform: unclassified }
        : {}),
    });
    return new ObservationHarness(context, transport, clock);
  }

  /**
   * A fresh ledger client over the durable host: a restart. The Durable
   * Object transport also builds a fresh object instance, as an eviction
   * would, and reaches it only through serialized requests.
   */
  freshLedger(): ReconciliationLedgerPort {
    if (this.transport === 'local') {
      return new LocalReconciliationLedger(
        new ReconciliationLedgerStore(this.host, { clock: this.clock }),
      );
    }
    const object = new ReconciliationLedger(durableStateOver(this.host), {
      clock: this.clock,
    });
    this.ledgerObjects += 1;
    return new DurableObjectReconciliationLedger({
      idFromName: (name) => name,
      get: () => ({
        fetch: (url: string, init: RequestInit) =>
          object.fetch(new Request(url, init)),
      }),
    });
  }

  dependencies(options: RunOptions = {}): CoordinatedObservationDependencies {
    return {
      limiter: this.limiter,
      authorityMode: 'sequencer',
      guarded: this.guarded,
      purgeOrigin: 'https://api.gridview.test',
      ledger:
        options.ledger === undefined
          ? this.recorded(this.freshLedger())
          : options.ledger,
      transport: this.server.transport,
      sleep: async (millis) => this.clock.advance(millis),
      logger: this.logger,
      clock: this.clock,
      sequencer: options.sequencer ?? this.sequencer,
      storage: options.storage ?? this.storage,
    };
  }

  /** `ledger`, with every operation recorded in `ledgerCalls`. */
  recorded(ledger: ReconciliationLedgerPort): ReconciliationLedgerPort {
    const wrapped = Object.create(ledger) as Record<string, unknown>;
    for (const method of [
      'readSeason',
      'acquireLease',
      'releaseLease',
      'commit',
      'reconcilePublishedRevisions',
    ] as const) {
      wrapped[method] = (request: never) => {
        this.ledgerCalls.push(method);
        return (ledger[method] as (request: never) => unknown).call(
          ledger,
          request,
        );
      };
    }
    return wrapped as unknown as ReconciliationLedgerPort;
  }

  /** One run at `at`, recording exactly what it asked for. */
  async run(at: string, options: RunOptions = {}): Promise<RunRecord> {
    this.clock.set(at);
    this.ledgerCalls.length = 0;
    const requests = this.server.requests.length;
    const reservations = this.limiter.reservations.length;
    const publishCalls = this.publishGuarded.mock.calls.length;
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
      publishCalls: this.publishGuarded.mock.calls.length - publishCalls,
      ledgerCalls: [...this.ledgerCalls],
    };
  }

  /** Every release a guarded publication committed, in order. */
  releases(): string[] {
    return this.published
      .filter((result) => result.status === 'applied')
      .map((result) => result.version);
  }

  /** The version the sequencer serves, read from its own committed record. */
  activeVersion(): string | null {
    const authority = this.context.coordinator.readAuthority(SEASON);
    return authority.cutoverState === 'active' ? authority.activeVersion : null;
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

  /** The port the publication service uses: `port`, with `portHooks` applied. */
  private hookedPort(
    port: SeasonPublicationSequencerPort,
  ): SeasonPublicationSequencerPort {
    const hooked = Object.create(port) as Record<string, unknown>;
    for (const command of [
      'readAuthority',
      'prepare',
      'finalize',
      'cancel',
      'authorizeCleanup',
      'acknowledgeCleanup',
    ] as const) {
      hooked[command] = (request: unknown) => {
        const run = () =>
          (port[command] as (request: unknown) => Promise<unknown>).call(
            port,
            request,
          );
        const hook = this.portHooks.get(command);
        return hook === undefined ? run() : hook(run);
      };
    }
    return hooked as unknown as SeasonPublicationSequencerPort;
  }
}

/** The mock baseline with its one classified round made unavailable. */
function unclassified(set: GeneratedSnapshotSet): GeneratedSnapshotSet {
  return {
    ...set,
    documents: set.documents.map((document) =>
      /^grand-prix:\d+:results$/.test(document.documentName)
        ? {
            ...document,
            data: {
              ...(document.data as Record<string, unknown>),
              status: 'unavailable',
              entries: [],
              fastestLap: null,
            },
          }
        : document,
    ),
  };
}

/**
 * Durable Object storage's shape over the in-memory host, so the Durable
 * Object ledger and the in-process one share exactly the same committed
 * bytes and the same atomic rollback.
 */
function durableStateOver(host: MemorySequencerHost): SequencerDurableHost {
  let store: SequencerRecordStore | null = null;
  const active = (): SequencerRecordStore => {
    if (store === null) throw new Error('storage used outside a transaction');
    return store;
  };
  return {
    storage: {
      transactionSync: <T>(closure: () => T): T =>
        host.transactionSync((transaction) => {
          store = transaction;
          try {
            return closure();
          } finally {
            store = null;
          }
        }),
      kv: {
        get: <T>(key: string) => active().get(key) as T | undefined,
        put: <T>(key: string, value: T) => active().put(key, value),
        delete: (key: string) => {
          active().delete(key);
          return true;
        },
        list: <T>({ prefix = '' }: { prefix?: string } = {}) =>
          active().list(prefix) as Iterable<readonly [string, T]>,
      },
    },
  };
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
