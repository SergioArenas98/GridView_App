/**
 * Shared fixtures for the reconciliation operator route tests (PR-E2).
 *
 * The routes are driven through the real Worker entry point. The only
 * substitution is the ledger the resolver answers: each test file that needs
 * one replaces `resolveReconciliationLedger` with `vi.mock`, answering from a
 * `vi.hoisted` holder. No environment field or test hook supplies a ledger,
 * so a file that does not mock the module runs the real, `null` resolver.
 *
 * Each request builds a fresh ledger client over one in-memory host, as a
 * fresh Worker isolate would: in process, or through the Durable Object
 * client over a fresh `ReconciliationLedger` object. Nothing here can reach a
 * provider or Cloudflare.
 */

import worker, { type Env } from '../../src/index';
import { MemoryCachePurgeAdapter } from '../../src/cache/purge';
import { CapturingLogger } from '../../src/logging/logger';
import { MemorySequencerHost } from '../../src/publication/sequencer/hosts';
import { MemorySnapshotStorage } from '../../src/storage/local';
import {
  DurableObjectReconciliationLedger,
  LocalReconciliationLedger,
  ReconciliationLedger,
  ReconciliationLedgerStore,
  type ClassificationRecord,
  type LeaseToken,
  type LedgerCommitRequest,
  type SeasonRecord,
  ledgerKeys,
} from '../../src/sync/coordinated/ledger';
import type { ReconciliationLedgerPort } from '../../src/sync/coordinated/ledger-port';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import type { SequencerTransport } from '../publication/sequenced/support';
import { MutableClock } from '../publication/sequencer/support';
import { durableStateOver } from '../sync/coordinated/observation/support';

export const ADMIN_TOKEN = 'local-test-token';
export const PUBLIC_BASE_URL = 'https://api.gridview.test';
export const NOW = '2026-09-30T12:00:00.000Z';

export const ledgerMethods = [
  'readSeason',
  'acquireLease',
  'releaseLease',
  'commit',
  'reconcilePublishedRevisions',
  'operate',
  'dispose',
  'verify',
] as const;
export type LedgerMethod = (typeof ledgerMethods)[number];

/**
 * One ledger host, reached through either transport, with every operation
 * any client made recorded in order.
 */
export class OperatorLedger {
  readonly host = new MemorySequencerHost();
  readonly calls: LedgerMethod[] = [];
  /** Replaces one operation on every client this fixture hands out. */
  readonly overrides = new Map<
    LedgerMethod,
    (base: ReconciliationLedgerPort, request: never) => Promise<unknown>
  >();

  constructor(
    readonly transport: SequencerTransport,
    readonly clock: MutableClock = new MutableClock(new Date(NOW)),
  ) {}

  /** A fresh, recorded client over the host. */
  client(): ReconciliationLedgerPort {
    const base = this.bare();
    const wrapped = Object.create(base) as Record<string, unknown>;
    for (const method of ledgerMethods) {
      wrapped[method] = (request: never) => {
        this.calls.push(method);
        const override = this.overrides.get(method);
        if (override !== undefined) return override(base, request);
        return (base[method] as (request: never) => unknown).call(
          base,
          request,
        );
      };
    }
    return wrapped as unknown as ReconciliationLedgerPort;
  }

  /** A fresh client that records nothing: for test setup and reads. */
  bare(): ReconciliationLedgerPort {
    if (this.transport === 'local') {
      return new LocalReconciliationLedger(
        new ReconciliationLedgerStore(this.host, { clock: this.clock }),
      );
    }
    const object = new ReconciliationLedger(durableStateOver(this.host), {
      clock: this.clock,
    });
    return new DurableObjectReconciliationLedger({
      idFromName: (name) => name,
      get: () => ({
        fetch: (url: string, init: RequestInit) =>
          object.fetch(new Request(url, init)),
      }),
    });
  }

  /**
   * Writes `record` straight into the host at `version`, bypassing the
   * store: only for a competing correction, which only `verify` can create.
   */
  plant(record: ClassificationRecord, version = 1): void {
    this.host.transactionSync((store) =>
      store.put(ledgerKeys.classification(record.season, record.round), {
        version,
        record,
      }),
    );
  }

  /** Every committed key and value, for byte-for-byte comparison. */
  bytes(): string {
    return JSON.stringify(
      this.host.committedKeys().map((key) => [key, this.host.peek(key)]),
    );
  }

  /** Commits `parts` under a fresh lease on `season`, then releases it. */
  async seed(
    parts: Partial<Omit<LedgerCommitRequest, 'lease'>>,
    season: number,
  ): Promise<void> {
    const ledger = this.bare();
    const acquired = await ledger.acquireLease(season);
    if (acquired.outcome !== 'acquired') throw new Error('lease refused');
    const lease: LeaseToken = { season, fence: acquired.lease.fence };
    const outcome = await ledger.commit({
      lease,
      seasonRecord: null,
      classifications: [],
      backlogInsertions: [],
      backlogRemovals: [],
      ...parts,
    });
    await ledger.releaseLease(lease);
    if (outcome.outcome !== 'committed') {
      throw new Error(`seed refused: ${JSON.stringify(outcome)}`);
    }
  }

  async season(season: number): Promise<SeasonRecord | null> {
    const read = await this.bare().readSeason(season);
    if (read.outcome !== 'read') throw new Error('read refused');
    return read.snapshot.seasonRecord?.record ?? null;
  }

  async round(
    season: number,
    round: number,
  ): Promise<ClassificationRecord | null> {
    const read = await this.bare().readSeason(season);
    if (read.outcome !== 'read') throw new Error('read refused');
    return (
      read.snapshot.classifications.find(
        (entry) => entry.record.round === round,
      )?.record ?? null
    );
  }
}

/** A staging Worker with `coordinated` selected and every surface local. */
export function coordinatedEnv(
  clock: MutableClock,
  overrides: Partial<Env> = {},
): { env: Env; logger: CapturingLogger } {
  const logger = new CapturingLogger();
  const env: Env = {
    ENVIRONMENT: 'staging',
    PROVIDER_MODE: 'coordinated',
    PUBLIC_BASE_URL,
    ADMIN_TOKEN,
    __LOCAL_STORAGE: new MemorySnapshotStorage(),
    __CACHE_PURGER: new MemoryCachePurgeAdapter(),
    __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
    __CLOCK: clock,
    __LOGGER: logger,
    ...overrides,
  };
  return { env, logger };
}

export interface RouteAnswer {
  readonly status: number;
  readonly cacheControl: string | null;
  readonly allow: string | null;
  readonly body: {
    readonly data?: Record<string, unknown>;
    readonly error?: { readonly code: string; readonly message: string };
  };
}

/** One request through the Worker's `fetch` entry point. */
export async function call(
  env: Env,
  method: string,
  path: string,
  body?: unknown,
  token: string | null = ADMIN_TOKEN,
): Promise<RouteAnswer> {
  const headers: Record<string, string> = {};
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  let payload: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const response = await worker.fetch(
    new Request(`${PUBLIC_BASE_URL}${path}`, {
      method,
      headers,
      ...(payload === undefined ? {} : { body: payload }),
    }),
    env,
  );
  return {
    status: response.status,
    cacheControl: response.headers.get('Cache-Control'),
    allow: response.headers.get('Allow'),
    body: (await response.json()) as RouteAnswer['body'],
  };
}

export const paths = {
  inspect: (season: number | string) =>
    `/internal/admin/reconciliation?season=${season}`,
  hold: '/internal/admin/reconciliation/hold',
  releaseHold: '/internal/admin/reconciliation/release-hold',
  clearBlock: '/internal/admin/reconciliation/clear-block',
  disposition: '/internal/admin/reconciliation/disposition',
  verification: '/internal/admin/reconciliation/verification',
  rollback: (season: number) => `/internal/admin/rollback?season=${season}`,
} as const;

export const OP = [
  '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  '1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e',
  '2c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5e6f',
  '3d4e5f6a-7b8c-4d9e-bf0a-2b3c4d5e6f7a',
  '4e5f6a7b-8c9d-4e0f-8a1b-3c4d5e6f7a8b',
] as const;
