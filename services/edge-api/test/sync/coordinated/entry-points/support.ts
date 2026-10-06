/**
 * The coordinated orchestration driven through the real Worker entry points:
 * `worker.scheduled` and `POST /internal/admin/sync/full`.
 *
 * Everything below the entry points is the real code a deployment would run:
 * the mode check, the publication surface `buildPublicationCommands` builds
 * (the concrete guarded `SequencedPublicationService` over the sequencer),
 * the gate, the composition, the lease, the planner, the coordinator, the
 * outcome commit and the attention line. Only these are local:
 *
 * - the Jolpica transport (`__PROVIDER_TRANSPORT`), the limiter
 *   (`__PROVIDER_RATE_LIMITER`), the pacer's sleep (`__PACER_SLEEP`) and the
 *   clock - the C3 orchestration harness's doubles;
 * - the sequencer and storage, seeded and activated by the sequenced
 *   publication test support, in process or through the Durable Object
 *   client;
 * - the ledger the resolver answers. No environment field or test hook
 *   supplies one, so each test file replaces `resolveReconciliationLedger`
 *   with `vi.mock` and answers from a `vi.hoisted` holder: a fresh client
 *   over one in-memory host per Worker call, as a fresh isolate would build.
 *
 * Nothing here can reach a provider or Cloudflare.
 */

import worker, { type Env } from '../../../../src/index';
import { MemoryCachePurgeAdapter } from '../../../../src/cache/purge';
import type { LogEvent } from '../../../../src/logging/logger';
import { MockFormulaOneProvider } from '../../../../src/providers/mock/mock-provider';
import type { SeasonPublicationSequencerPort } from '../../../../src/publication/sequencer/port';
import type { SnapshotStorage } from '../../../../src/storage/types';
import type {
  LedgerSnapshot,
  SeasonOperatorAction,
} from '../../../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { runtimeSnapshotValidator } from '../../../../src/validation/snapshot-validator';
import { providerCalls } from '../../../support/edge-harness';
import type { SequencerTransport } from '../../../publication/sequenced/support';
import {
  OTHER_SEASON,
  commitRequest,
  rev,
  stagedClassification,
  write,
} from '../ledger/support';
import {
  HOUR,
  ObservationHarness,
  PRE_SEASON,
  SEASON,
} from '../observation/support';

export const ADMIN_TOKEN = 'local-test-token';
export const PUBLIC_BASE_URL = 'https://api.gridview.test';
export const MINUTE = 60 * 1000;
export const OPERATION = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

export const later = (at: string, millis: number): string =>
  new Date(Date.parse(at) + millis).toISOString();

/** The first publication run: one hour after the bootstrap. */
export const FIRST_PUBLICATION = later(PRE_SEASON, HOUR);

/** What the resolver answers: a fresh ledger client per call, or `null`. */
export type LedgerBinding = (() => ReconciliationLedgerPort) | null;

/** The publication writes a Worker call could make. */
const storageWrites = [
  'writeVersionedDocument',
  'writeVersionInventory',
  'writePublicationMetadata',
  'deletePublicationMetadata',
  'setActiveVersion',
  'setPreviousVersion',
  'setCurrentSeason',
  'setSyncState',
  'setQuotaState',
  'setContentMetadata',
  'deleteUnpublishedVersion',
] as const;

/** What one Worker call did, beyond its own answer. */
export interface CallRecord {
  readonly requests: readonly string[];
  readonly reservations: number;
  readonly prepares: number;
  readonly finalizes: number;
  readonly storageWrites: number;
  readonly ledgerCalls: readonly string[];
  readonly logs: readonly LogEvent[];
  readonly mockProviderCalls: number;
}

export interface ManualAnswer extends CallRecord {
  readonly status: number;
  readonly cacheControl: string | null;
  readonly body: { readonly data?: Record<string, unknown> };
}

/**
 * One staging Worker with `coordinated` selected over one orchestration
 * harness. `bind` sets what the resolver answers; each Worker call this
 * harness makes applies its own binding first.
 */
export class EntryPointHarness {
  readonly env: Env;
  readonly provider: MockFormulaOneProvider;
  private prepares = 0;
  private finalizes = 0;
  private writes = 0;
  /** What the resolver answers for this harness's calls. */
  private binding: LedgerBinding = null;
  /** Called before each `prepare` the Worker's sequencer port receives. */
  onPrepare: () => void = () => {};

  private constructor(
    readonly harness: ObservationHarness,
    private readonly bind: (binding: LedgerBinding) => void,
    overrides: Partial<Env>,
  ) {
    this.provider = new MockFormulaOneProvider({
      clock: harness.clock,
      sourceUpdatedAt: '2026-07-18T11:55:00.000Z',
      contentVersion: '2026.07.18.1',
    });
    this.env = {
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'coordinated',
      PUBLIC_BASE_URL,
      ADMIN_TOKEN,
      SEASON_PUBLICATION_AUTHORITY: 'sequencer',
      SEASON_PUBLICATION_CUTOVER_CONTROL: 'activate:2026',
      __SEASON_PUBLICATION_SEQUENCER: this.countingPort(harness.sequencer),
      __LOCAL_STORAGE: this.countingStorage(harness.storage),
      __CACHE_PURGER: new MemoryCachePurgeAdapter(),
      __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
      __CLOCK: harness.clock,
      __LOGGER: harness.logger,
      __PROVIDER: this.provider,
      __PROVIDER_RATE_LIMITER: harness.limiter,
      __PROVIDER_TRANSPORT: harness.server.transport,
      __PACER_SLEEP: async (millis) => harness.clock.advance(millis),
      ...overrides,
    };
    this.bindLedger();
  }

  static async create(
    transport: SequencerTransport,
    bind: (binding: LedgerBinding) => void,
    options: {
      readonly seed?: 'mock' | 'unclassified';
      readonly env?: Partial<Env>;
    } = {},
  ): Promise<EntryPointHarness> {
    const harness = await ObservationHarness.create({
      transport,
      seed: options.seed ?? 'unclassified',
    });
    return new EntryPointHarness(harness, bind, options.env ?? {});
  }

  get clock() {
    return this.harness.clock;
  }

  get server() {
    return this.harness.server;
  }

  get limiter() {
    return this.harness.limiter;
  }

  /** The resolver answers a fresh, recorded client over the harness host. */
  bindLedger(): void {
    this.binding = () => this.harness.recorded(this.harness.freshLedger());
  }

  /** The resolver answers `null`, as it does in every environment. */
  unbindLedger(): void {
    this.binding = null;
  }

  /** The resolver answers `ledger` itself, for a fault on one operation. */
  bindExactly(ledger: () => ReconciliationLedgerPort): void {
    this.binding = () => this.harness.recorded(ledger());
  }

  /** One scheduled invocation at `at`. */
  async scheduled(at: string): Promise<CallRecord> {
    return this.record(at, async () => {
      await worker.scheduled?.({} as ScheduledController, this.env);
    });
  }

  /**
   * One authenticated `POST /internal/admin/sync/full` at `at`, optionally
   * carrying the client's own `signal` - its connection.
   */
  async manual(
    at: string,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<ManualAnswer> {
    let answer: Pick<ManualAnswer, 'status' | 'cacheControl' | 'body'> | null =
      null;
    const record = await this.record(at, async () => {
      const response = await worker.fetch(
        new Request(`${PUBLIC_BASE_URL}/internal/admin/sync/full?season=2026`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
          ...(options.signal ? { signal: options.signal } : {}),
        }),
        this.env,
      );
      answer = {
        status: response.status,
        cacheControl: response.headers.get('Cache-Control'),
        body: (await response.json()) as ManualAnswer['body'],
      };
    });
    return { ...record, ...answer! };
  }

  /** The version the sequencer serves, read from its committed record. */
  activeVersion(): string | null {
    return this.harness.activeVersion();
  }

  async snapshot(): Promise<LedgerSnapshot> {
    return this.harness.snapshot();
  }

  async season() {
    return this.harness.season();
  }

  async round(round: number) {
    return this.harness.record(round);
  }

  /** Runs `use` under a fresh lease on `season`, outside any Worker call. */
  async underLease(
    at: string,
    season: number,
    use: (
      ledger: ReconciliationLedgerPort,
      lease: { season: number; fence: number },
      snapshot: LedgerSnapshot,
    ) => Promise<unknown>,
  ): Promise<void> {
    this.clock.set(at);
    const ledger = this.harness.freshLedger();
    const acquired = await ledger.acquireLease(season);
    if (acquired.outcome !== 'acquired') throw new Error('lease refused');
    const lease = { season, fence: acquired.lease.fence };
    try {
      await use(ledger, lease, acquired.snapshot);
    } finally {
      await ledger.releaseLease(lease);
    }
  }

  /** An operator hold or release, through the E1 operation. */
  operate(at: string, action: SeasonOperatorAction): Promise<void> {
    return this.underLease(at, SEASON, async (ledger, lease, snapshot) => {
      const outcome = await ledger.operate({
        lease,
        action,
        operationId: OPERATION.replace('0a', action === 'hold' ? '0a' : '9a'),
        authMethod: 'shared-admin-token',
        expectedVersion: snapshot.seasonRecord?.version ?? 0,
      });
      if (outcome.outcome !== 'applied') throw new Error('not applied');
    });
  }

  /** A durable block, recorded as an outcome commit would record it. */
  block(at: string): Promise<void> {
    return this.underLease(at, SEASON, async (ledger, lease, snapshot) => {
      const stored = snapshot.seasonRecord!;
      const outcome = await ledger.commit(
        commitRequest(lease, {
          seasonRecord: write(
            {
              ...stored.record,
              durableBlock: { since: at, reason: 'classification-superseded' },
            },
            stored.version,
          ),
        }),
      );
      if (outcome.outcome !== 'committed') throw new Error('not committed');
    });
  }

  /** Another season fills `count` slots of the global review backlog. */
  fillBacklog(at: string, count: number): Promise<void> {
    return this.underLease(at, OTHER_SEASON, async (ledger, lease) => {
      const rounds = Array.from({ length: count }, (_, index) => index + 1);
      const outcome = await ledger.commit(
        commitRequest(lease, {
          classifications: rounds.map((round) =>
            write(
              stagedClassification(round, rev(`other-${round}`), OTHER_SEASON),
            ),
          ),
          backlogInsertions: rounds.map((round) => ({
            round,
            revision: rev(`other-${round}`),
          })),
        }),
      );
      if (outcome.outcome !== 'committed') throw new Error('not committed');
    });
  }

  /** The bootstrap calendar observation and the first publication. */
  async published(): Promise<string> {
    await this.scheduled(PRE_SEASON);
    await this.scheduled(FIRST_PUBLICATION);
    const release = this.activeVersion();
    if (release === null) throw new Error('nothing was published');
    return release;
  }

  private async record(
    at: string,
    call: () => Promise<void>,
  ): Promise<CallRecord> {
    this.clock.set(at);
    // The resolver's holder is shared by the test file: every call applies
    // this harness's own binding first.
    this.bind(this.binding);
    this.harness.ledgerCalls.length = 0;
    const requests = this.server.requests.length;
    const reservations = this.limiter.reservations.length;
    const logs = this.harness.logger.events.length;
    const [prepares, finalizes, writes] = [
      this.prepares,
      this.finalizes,
      this.writes,
    ];
    const mock = providerCalls(this.provider);
    await call();
    return {
      requests: this.server.requests.slice(requests),
      reservations: this.limiter.reservations.length - reservations,
      prepares: this.prepares - prepares,
      finalizes: this.finalizes - finalizes,
      storageWrites: this.writes - writes,
      ledgerCalls: [...this.harness.ledgerCalls],
      logs: this.harness.logger.events.slice(logs),
      mockProviderCalls: providerCalls(this.provider) - mock,
    };
  }

  /** The Worker's sequencer port, counting `prepare` and `finalize`. */
  private countingPort(
    port: SeasonPublicationSequencerPort,
  ): SeasonPublicationSequencerPort {
    const counted = Object.create(port) as Record<string, unknown>;
    counted.prepare = (request: never) => {
      this.prepares += 1;
      this.onPrepare();
      return port.prepare(request);
    };
    counted.finalize = (request: never) => {
      this.finalizes += 1;
      return port.finalize(request);
    };
    return counted as unknown as SeasonPublicationSequencerPort;
  }

  /** The Worker's storage, counting every publication write. */
  private countingStorage(storage: SnapshotStorage): SnapshotStorage {
    const counted = Object.create(storage) as Record<string, unknown>;
    for (const method of storageWrites) {
      counted[method] = (...args: never[]) => {
        this.writes += 1;
        return (storage[method] as (...a: never[]) => unknown).apply(
          storage,
          args,
        );
      };
    }
    return counted as unknown as SnapshotStorage;
  }
}

/** The lines one call wrote for `operation`. */
export function linesOf(
  record: Pick<CallRecord, 'logs'>,
  operation: string,
): LogEvent[] {
  return record.logs.filter((event) => event.operation === operation);
}

export { HOUR, PRE_SEASON, SEASON };
