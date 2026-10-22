/**
 * The automatic-updates release gate's stage (ADR 0028 D10;
 * `docs/release/automatic-updates.md` gate AU-3).
 *
 * One Worker, configured exactly as a committed environment plus the
 * activation delta, driven only by its **scheduled** handler and by public
 * GETs - never by an admin route, a capture or a submission:
 *
 * - **Configuration.** The committed `[env.staging]` or `[env.production]`
 *   variables, read through Wrangler's own reader, plus
 *   `AUTOMATIC_ACTIVATION_DELTA`: `PROVIDER_MODE = "coordinated"` and a bound
 *   `RECONCILIATION_LEDGER`. The hourly cron is the stage's `hourly()`.
 * - **Real code below the entry points.** The Worker module, the coordinated
 *   orchestration, the Jolpica ports and hardened client, the real
 *   `ReservationCoordinator` (4/s, 500/h) on the stage's clock, the
 *   reconciliation ledger and sequencer Durable Object classes reached
 *   through their clients, the guarded sequenced publication, and the public
 *   router.
 * - **Controlled data.** `ControlledJolpica` answers from the synthetic
 *   season the port tests use (every identity is curated content): a result
 *   is "not yet available" (an empty race list, as Jolpica answers) until the
 *   instant the scenario makes it available, can be served as an incomplete
 *   page first, can change to a corrected variant, and can be made to fail.
 *
 * Nothing here can reach a provider or Cloudflare: the global `fetch` is
 * stubbed to throw by every test that uses it.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { unstable_readConfig } from 'wrangler';

import worker, { type Env } from '../../../src/index';
import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import type { ControlledSourceStore } from '../../../src/providers/controlled/source';
import type { LogEvent } from '../../../src/logging/logger';
import {
  ReservationCoordinator,
  type ReservationHost,
} from '../../../src/providers/http/provider-rate-limiter';
import { ReconciliationLedger } from '../../../src/sync/coordinated/ledger';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import { emptyResultsEnvelope } from '../../providers/jolpica/results-support';
import {
  HOUR,
  JolpicaServer,
  ObservationHarness,
  PRE_SEASON,
  anchorOf,
  durableStateOver,
  resultsBody,
  type ResultVariant,
} from '../../sync/coordinated/observation/support';

export { HOUR, PRE_SEASON, anchorOf };
export const MINUTE = 60 * 1000;
/** When staging's starting release was published: before the season. */
export const SEED_RELEASE_AT = '2026-02-01T00:00:00.000Z';
export const DAY = 24 * HOUR;

/**
 * What activation adds to a committed environment (ADR 0028 D2; runbook
 * "Automatic updates activation"). The ledger binding and the schedule are
 * configuration the stage supplies itself: the binding as a namespace over
 * the real `ReconciliationLedger` class, the schedule as `hourly()`.
 */
export const AUTOMATIC_ACTIVATION_DELTA = Object.freeze({
  PROVIDER_MODE: 'coordinated',
  ledgerBinding: 'RECONCILIATION_LEDGER',
  cron: '17 * * * *',
});

/**
 * What the isolated demonstration Worker (`env.e2e` in the runbook) sets on
 * top of committed staging and the activation delta: its own season is born
 * by genesis, it reads the controlled source, and it ingests nothing.
 */
export const DEMONSTRATION_DELTA = Object.freeze({
  SEASON_PUBLICATION_CUTOVER_CONTROL: 'genesis:2026',
  CONTROLLED_PROVIDER_SOURCE: 'kv',
  SEASON_BATCH_INGEST: '',
  PUBLIC_BASE_URL: 'https://gridview-api-e2e.sejuma18.workers.dev',
});

const configPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'wrangler.toml',
);

/** The committed variables of `environment`, as the Worker receives them. */
export function committedVars(
  environment: 'staging' | 'production',
): Record<string, string> {
  const config = unstable_readConfig(
    { config: configPath, env: environment },
    { hideWarnings: true },
  );
  return Object.fromEntries(
    Object.entries(config.vars).map(([name, value]) => [name, String(value)]),
  );
}

/** `at` + `millis`, as an instant string. */
export const later = (at: string, millis: number): string =>
  new Date(Date.parse(at) + millis).toISOString();

/** Minute 17 of the hour `hours` after round `round`'s race start. */
export function tickAfterRace(round: number, hours: number): string {
  return new Date(
    anchorOf(round).getTime() + hours * HOUR + 17 * MINUTE,
  ).toISOString();
}

/**
 * What one round's classification serves: a variant, a structurally
 * incomplete page (`total` counts a row the page does not carry, as a page
 * read while Jolpica is still loading the result would), or nothing yet.
 */
export type ServedResult = ResultVariant | 'incomplete' | null;

/** One availability change of one round's classification. */
interface ResultChange {
  readonly at: number;
  readonly variant: ServedResult;
}

/** Variant A with its last row missing, while `total` still counts it. */
function incompletePage(round: number): Record<string, unknown> {
  const body = structuredClone(resultsBody(round, 'A')) as {
    MRData: { RaceTable: { Races: { Results: unknown[] }[] } };
  };
  body.MRData.RaceTable.Races[0]!.Results.pop();
  return body;
}

/**
 * The controlled Jolpica source. Season-level resources are always
 * available; each round's race classification follows its own schedule, and
 * an outage makes every request fail with `503` for a window.
 */
export class ControlledJolpica {
  private readonly changes = new Map<number, ResultChange[]>();
  private readonly outages: { from: number; to: number }[] = [];

  /** Round `round`'s result becomes `variant` from `at` on. */
  available(round: number, at: string, variant: ResultVariant = 'A'): this {
    return this.serve(round, at, variant);
  }

  /** Round `round` serves an incomplete page from `at` on. */
  incomplete(round: number, at: string): this {
    return this.serve(round, at, 'incomplete');
  }

  private serve(round: number, at: string, variant: ServedResult): this {
    const list = this.changes.get(round) ?? [];
    list.push({ at: Date.parse(at), variant });
    list.sort((left, right) => left.at - right.at);
    this.changes.set(round, list);
    return this;
  }

  /** Every request fails with `503` from `from` until `to`. */
  outage(from: string, to: string): this {
    this.outages.push({ from: Date.parse(from), to: Date.parse(to) });
    return this;
  }

  /** What `round` serves at `now`, or `null` while unavailable. */
  variantAt(round: number, now: number): ServedResult {
    let variant: ServedResult = null;
    for (const change of this.changes.get(round) ?? []) {
      if (change.at <= now) variant = change.variant;
    }
    return variant;
  }

  /** The instants at which anything this source serves changes. */
  changeInstants(): number[] {
    const instants = new Set<number>();
    for (const list of this.changes.values()) {
      for (const change of list) instants.add(change.at);
    }
    for (const { from, to } of this.outages) {
      instants.add(from);
      instants.add(to);
    }
    return [...instants].sort((left, right) => left - right);
  }

  /** Points `server` at what this source publishes at `now`. */
  apply(server: JolpicaServer, now: number): void {
    server.results.clear();
    server.answers.clear();
    const down = this.outages.some(({ from, to }) => from <= now && now < to);
    for (let round = 1; round <= 24; round += 1) {
      const variant = this.variantAt(round, now);
      if (variant !== null && variant !== 'incomplete') {
        server.results.set(round, variant);
      }
      const path = `/${round}/results/`;
      server.answers.set(path, () => {
        if (down) return { kind: 'status', status: 503 };
        if (variant === null) {
          return { kind: 'json', body: emptyResultsEnvelope() };
        }
        return variant === 'incomplete'
          ? { kind: 'json', body: incompletePage(round) }
          : { kind: 'json', body: resultsBody(round, variant) };
      });
    }
    if (down) {
      for (const path of [
        '/races/',
        '/circuits/',
        '/drivers/',
        '/constructors/',
        '/driverstandings/',
        '/constructorstandings/',
      ]) {
        server.answers.set(path, () => ({ kind: 'status', status: 503 }));
      }
    }
  }
}

/** The real limiter logic over an in-memory host, on the stage's clock. */
function realLimiter(now: () => Date): ReservationCoordinator {
  const values = new Map<string, unknown>();
  let queue: Promise<unknown> = Promise.resolve();
  const host: ReservationHost = {
    storage: {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async <T>(key: string, value: T) => {
        values.set(key, structuredClone(value));
      },
    },
    blockConcurrencyWhile: <T>(callback: () => Promise<T>) => {
      const next = queue.then(callback);
      queue = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  } as ReservationHost;
  return new ReservationCoordinator(host, now);
}

/** What one scheduled tick did. */
export interface TickRecord {
  readonly at: string;
  readonly requests: readonly string[];
  readonly logs: readonly LogEvent[];
  readonly releasesBefore: number;
  readonly releasesAfter: number;
}

export class AutomaticUpdateStage {
  readonly source = new ControlledJolpica();
  readonly ticks: TickRecord[] = [];
  /** Every request the stage sent to the Worker, by path. */
  readonly workerRequests: string[] = [];

  private constructor(
    readonly harness: ObservationHarness,
    readonly env: Env,
  ) {}

  /**
   * `environment`'s committed configuration plus the activation delta.
   * Staging starts from an active release (the seeded baseline stands for
   * the batch-born release staging serves); production starts at genesis.
   */
  static async create(
    environment: 'staging' | 'production' | 'demonstration',
    options: {
      /** The KV namespace a `demonstration` Worker reads its source from. */
      readonly controlledSource?: ControlledSourceStore;
    } = {},
  ): Promise<AutomaticUpdateStage> {
    const harness = await ObservationHarness.create({
      transport: 'durable-object',
      ...(environment !== 'staging'
        ? { cutover: 'genesis' as const }
        : {
            seed: 'unclassified' as const,
            // Before the season, as staging's batch-born release is.
            seedAt: SEED_RELEASE_AT,
          }),
    });
    const clock = harness.clock;
    const demonstration = environment === 'demonstration';
    if (demonstration && options.controlledSource === undefined) {
      throw new Error('a demonstration Worker needs its controlled source');
    }
    const env: Env = {
      ...committedVars(demonstration ? 'staging' : environment),
      ...(demonstration ? DEMONSTRATION_DELTA : {}),
      PROVIDER_MODE: AUTOMATIC_ACTIVATION_DELTA.PROVIDER_MODE,
      ADMIN_TOKEN: 'never-used-by-the-gate',
      RECONCILIATION_LEDGER: {
        idFromName: (name: string) => name,
        get: () => {
          const object = new ReconciliationLedger(
            durableStateOver(harness.host),
            { clock },
          );
          return {
            fetch: (url: string, init: RequestInit) =>
              object.fetch(new Request(url, init)),
          };
        },
      } as unknown as DurableObjectNamespace,
      __SEASON_PUBLICATION_SEQUENCER: harness.sequencer,
      __LOCAL_STORAGE: harness.storage,
      __CACHE_PURGER: new MemoryCachePurgeAdapter(),
      __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
      __CLOCK: clock,
      __LOGGER: harness.logger,
      __PROVIDER_RATE_LIMITER: realLimiter(() => clock.now()),
      ...(demonstration
        ? {
            // The real controlled transport over the Worker's own namespace.
            GRIDVIEW_DATA: options.controlledSource as unknown as KVNamespace,
          }
        : { __PROVIDER_TRANSPORT: harness.server.transport }),
      __PACER_SLEEP: async (millis) => clock.advance(millis),
    };
    return new AutomaticUpdateStage(harness, env);
  }

  get clock() {
    return this.harness.clock;
  }

  /** The release the sequencer serves, or `null` before the first. */
  activeVersion(): string | null {
    return this.harness.activeVersion();
  }

  /** Every release the scheduled runs committed, in order. */
  releases(): string[] {
    return this.committed;
  }

  private readonly committed: string[] = [];

  /** One scheduled invocation at `at`, exactly as a Cron Trigger makes it. */
  async tick(at: string): Promise<TickRecord> {
    this.clock.set(at);
    this.source.apply(this.harness.server, Date.parse(at));
    const requests = this.harness.server.requests.length;
    const logs = this.harness.logger.events.length;
    const releasesBefore = this.releases().length;
    const before = this.activeVersion();
    await worker.scheduled?.({} as ScheduledController, this.env);
    const after = this.activeVersion();
    if (after !== null && after !== before) this.committed.push(after);
    const record: TickRecord = {
      at,
      requests: this.harness.server.requests.slice(requests),
      logs: this.harness.logger.events.slice(logs),
      releasesBefore,
      releasesAfter: this.releases().length,
    };
    this.ticks.push(record);
    return record;
  }

  /** The hourly cron (`17 * * * *`) from `from` to `to`, both included. */
  async hourly(from: string, to: string): Promise<TickRecord[]> {
    const records: TickRecord[] = [];
    let at = Date.parse(from);
    const end = Date.parse(to);
    if (new Date(at).getUTCMinutes() !== 17) {
      throw new Error(`${from} is not minute 17`);
    }
    while (at <= end) {
      records.push(await this.tick(new Date(at).toISOString()));
      at += HOUR;
    }
    return records;
  }

  /**
   * One public request at the stage's current instant. An internal path is
   * refused before it reaches the Worker: the gate's whole point is that no
   * admin request, capture or submission is ever needed.
   */
  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    if (path.startsWith('/internal/')) {
      throw new Error(`the gate never calls an admin route: ${path}`);
    }
    this.workerRequests.push(path);
    return worker.fetch(
      new Request(`https://api.gridview.test${path}`, init),
      this.env,
    );
  }
}

/**
 * A client that refreshes like the app: conditionally, with the ETag it
 * stored, and keeps the last body it accepted. The Flutter data layer itself
 * is exercised against the same stage by the app half of the gate
 * (`app-gate.test.ts`).
 */
export class ConditionalClient {
  private readonly etags = new Map<string, string>();
  private readonly bodies = new Map<string, unknown>();
  readonly statuses: { path: string; status: number }[] = [];

  constructor(private readonly stage: AutomaticUpdateStage) {}

  async refresh(path: string): Promise<number> {
    const etag = this.etags.get(path);
    const response = await this.stage.fetch(path, {
      headers: etag === undefined ? {} : { 'If-None-Match': etag },
    });
    this.statuses.push({ path, status: response.status });
    if (response.status === 200) {
      this.etags.set(path, response.headers.get('ETag') ?? '');
      this.bodies.set(path, await response.json());
    }
    return response.status;
  }

  body<T = { data: unknown; meta: Record<string, unknown> }>(
    path: string,
  ): T | undefined {
    return this.bodies.get(path) as T | undefined;
  }
}

export { PRE_SEASON as SEASON_START };
