import type { Logger } from '../logging/logger';
import type { Clock } from '../runtime/clock';
import { generateSnapshotSet } from '../snapshots/generator';
import type { SnapshotPublisher } from '../publication/publisher';
import type {
  QuotaState,
  SnapshotStorage,
  SyncJobCategory,
  SyncState,
} from '../storage/types';
import {
  emptyRequestMetrics,
  metricsDifference,
  totalsBySource,
  type ProviderAttemptCounts,
  type ProviderRequestMetrics,
} from '../providers/provider-metrics';
import type { ProviderSourceId } from '../providers/provider-source';
import { recordProviderAttempt } from '../providers/quota-model';
import {
  ProviderError,
  ProviderRateLimitedError,
  type FormulaOneProvider,
} from '../providers/formula-one-provider';
import { calculateDueJobs } from './scheduler';

export type SyncTrigger =
  'scheduled' | 'manual-full' | 'manual-resource' | 'manual-home';

export interface SyncRequest {
  season: number;
  trigger: SyncTrigger;
  forceJobs?: SyncJobCategory[];
  forceVersion?: string;
}

/**
 * Typed provider request accounting for one synchronization run (gap G6).
 *
 * Two clearly separated totals, because "how many calls" is ambiguous:
 *
 * - `operation` counts only the attempts made **by this run**. This is the
 *   figure quota and cost reasoning needs.
 * - `lifetime` counts every attempt made by the provider instance since it was
 *   constructed. This is the pre-existing `providerCallCount` semantics and is
 *   preserved unchanged.
 *
 * `bySource` and `byJobCategory` are **operation-scoped**, matching
 * `operation`. One attempt serving several job categories counts once against
 * each, so `byJobCategory` does not sum to `operation.total`.
 *
 * **Isolation invariant.** `operation` is the difference between two lifetime
 * snapshots, which is only sound while one provider instance serves one
 * synchronization operation. That holds by construction: `resolveProvider`
 * builds a new provider — and therefore a new ledger — on every `fetch` and
 * every `scheduled` invocation, so concurrent operations never share one.
 * The single exception is the test-only `__PROVIDER` override, which is
 * deliberately shared so a test can observe lifetime totals across runs;
 * tests drive `run()` sequentially. If a future coordinator ever reuses one
 * provider across overlapping runs, this difference must be replaced by a
 * per-operation ledger rather than left to under- or over-count silently.
 */
export interface SyncProviderAccounting {
  operation: ProviderAttemptCounts;
  lifetime: ProviderAttemptCounts;
  bySource: Partial<Record<ProviderSourceId, ProviderAttemptCounts>>;
  byJobCategory: Partial<Record<SyncJobCategory, ProviderAttemptCounts>>;
}

export interface SyncResult {
  status: 'completed' | 'skipped' | 'failed';
  season: number;
  dueJobs: SyncJobCategory[];
  skippedJobs: SyncJobCategory[];
  publicationStatus: string | null;
  releaseVersion: string | null;
  failureCategory: string | null;
  /**
   * Retained for compatibility with the existing internal admin responses:
   * the provider instance's **lifetime** attempt total.
   */
  providerCallCount: number;
  /** Typed detail; the total above is `providerRequests.lifetime.total`. */
  providerRequests: SyncProviderAccounting;
}

export class SynchronizationService {
  constructor(
    private readonly storage: SnapshotStorage,
    private readonly provider: FormulaOneProvider | null,
    private readonly publisher: SnapshotPublisher,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async run(request: SyncRequest): Promise<SyncResult> {
    const startedAt = this.clock.now().toISOString();
    const metricsBefore = this.metrics();
    const existing =
      (await this.storage.getSyncState(request.season)) ??
      emptySyncState(request.season);
    await this.storage.setSyncState(request.season, {
      ...existing,
      lastStartedAt: startedAt,
    });

    const storedQuota = this.provider
      ? await this.storage.getQuotaState(this.provider.sourceId)
      : null;
    const plan = calculateDueJobs(
      this.clock,
      existing,
      storedQuota,
      request.forceJobs,
    );
    if (plan.dueJobs.length === 0) {
      await this.storage.setSyncState(request.season, {
        ...existing,
        lastStartedAt: startedAt,
        lastSkippedJobs: plan.skippedJobs,
        lastPublicationStatus: 'skipped',
      });
      // No job is due, so no provider request is attempted and the accounting
      // difference is zero by construction.
      return {
        status: 'skipped',
        season: request.season,
        dueJobs: [],
        skippedJobs: plan.skippedJobs,
        publicationStatus: 'skipped',
        releaseVersion: null,
        failureCategory: plan.reason,
        ...resultAccounting(this.accounting(metricsBefore)),
      };
    }

    if (!this.provider) {
      return this.fail(
        request.season,
        existing,
        startedAt,
        'provider-unavailable',
        plan,
        metricsBefore,
      );
    }

    this.logger.info({
      operation: 'sync.started',
      season: request.season,
      providerSourceId: this.provider.sourceId,
      providerCallCount: this.metrics().lifetime.total,
    });

    try {
      const source = await this.provider.fetchSeasonSource(
        request.season,
        plan.dueJobs,
      );
      await this.recordQuotaAttempt(
        this.provider.sourceId,
        storedQuota,
        'successful',
        plan.dueJobs,
        null,
      );
      const releaseVersion =
        request.forceVersion ?? releaseVersionFor(this.clock.now());
      const set = generateSnapshotSet(
        source,
        this.clock.now().toISOString(),
        releaseVersion,
      );
      const publication = await this.publisher.publish(set);
      const completedAt = this.clock.now().toISOString();
      const nextState: SyncState = {
        ...existing,
        lastStartedAt: startedAt,
        lastCompletedAt: completedAt,
        lastFailedAt: null,
        lastFailureCategory: null,
        lastSkippedJobs: plan.skippedJobs,
        lastPublicationVersion: publication.version,
        lastPublicationStatus: publication.status,
        lastSuccessByJob: markJobs(
          existing.lastSuccessByJob,
          plan.dueJobs,
          completedAt,
        ),
      };
      await this.storage.setSyncState(request.season, nextState);
      const accounting = this.accounting(metricsBefore);
      this.logger.info({
        operation: 'sync.completed',
        season: request.season,
        releaseVersion: publication.version,
        providerSourceId: this.provider.sourceId,
        providerCallCount: accounting.providerCallCount,
        providerOperationCallCount: accounting.providerRequests.operation.total,
        providerCallsBySource: totalsBySource(accounting.operationMetrics),
      });
      return {
        status: publication.status === 'failed' ? 'failed' : 'completed',
        season: request.season,
        dueJobs: plan.dueJobs,
        skippedJobs: plan.skippedJobs,
        publicationStatus: publication.status,
        releaseVersion: publication.version,
        failureCategory:
          publication.status === 'failed' ? publication.reason : null,
        ...resultAccounting(accounting),
      };
    } catch (error) {
      const rateLimited = error instanceof ProviderRateLimitedError;
      const category = rateLimited
        ? 'provider-rate-limited'
        : error instanceof ProviderError
          ? error.category
          : 'sync-failure';
      await this.recordQuotaAttempt(
        this.provider.sourceId,
        storedQuota,
        rateLimited ? 'rate-limited' : 'failed',
        plan.dueJobs,
        rateLimited ? error.retryAfter : null,
      );
      return this.fail(
        request.season,
        existing,
        startedAt,
        category,
        plan,
        metricsBefore,
      );
    }
  }

  private metrics(): ProviderRequestMetrics {
    // A `null` provider cannot have attempted anything; there is no structural
    // probing and no silent zero for a provider that exists but omitted
    // telemetry, because `requestMetrics()` is required by the contract.
    return this.provider?.requestMetrics() ?? emptyRequestMetrics();
  }

  /**
   * Snapshots the provider's metrics once and derives everything from that
   * single read, so the result body and the log line can never disagree.
   */
  private accounting(before: ProviderRequestMetrics): {
    providerCallCount: number;
    providerRequests: SyncProviderAccounting;
    operationMetrics: ProviderRequestMetrics;
  } {
    const after = this.metrics();
    const operationMetrics = metricsDifference(before, after);
    return {
      providerCallCount: after.lifetime.total,
      providerRequests: {
        operation: operationMetrics.lifetime,
        lifetime: after.lifetime,
        bySource: operationMetrics.bySource,
        byJobCategory: operationMetrics.byJobCategory,
      },
      operationMetrics,
    };
  }

  /**
   * Updates the locally modelled quota for the source that was called.
   *
   * Every attempted request is recorded, whatever the outcome — a failure and
   * a rate-limit rejection both left GridView. Nothing here is read from a
   * provider response header, because neither adopted source publishes one.
   */
  private async recordQuotaAttempt(
    sourceId: ProviderSourceId,
    storedQuota: QuotaState | null,
    outcome: 'successful' | 'failed' | 'rate-limited',
    jobCategories: SyncJobCategory[],
    retryAfter: string | null,
  ): Promise<void> {
    const next = recordProviderAttempt(storedQuota, sourceId, {
      at: this.clock.now(),
      outcome,
      jobCategories,
      retryAfter,
    });
    await this.storage.setQuotaState(sourceId, next);
  }

  private async fail(
    season: number,
    existing: SyncState,
    startedAt: string,
    category: string,
    plan: { dueJobs: SyncJobCategory[]; skippedJobs: SyncJobCategory[] },
    metricsBefore: ProviderRequestMetrics,
  ): Promise<SyncResult> {
    const failedAt = this.clock.now().toISOString();
    await this.storage.setSyncState(season, {
      ...existing,
      lastStartedAt: startedAt,
      lastFailedAt: failedAt,
      lastFailureCategory: category,
      lastSkippedJobs: plan.skippedJobs,
      lastPublicationStatus: 'failed',
      lastFailureByJob: markJobs(
        existing.lastFailureByJob,
        plan.dueJobs,
        failedAt,
      ),
    });
    const accounting = this.accounting(metricsBefore);
    this.logger.warn({
      operation: 'sync.failed',
      season,
      failureCategory: category,
      providerSourceId: this.provider?.sourceId ?? null,
      providerCallCount: accounting.providerCallCount,
      providerOperationCallCount: accounting.providerRequests.operation.total,
      providerCallsBySource: totalsBySource(accounting.operationMetrics),
    });
    return {
      status: 'failed',
      season,
      dueJobs: plan.dueJobs,
      skippedJobs: plan.skippedJobs,
      publicationStatus: 'failed',
      releaseVersion: null,
      failureCategory: category,
      ...resultAccounting(accounting),
    };
  }
}

/** Drops the internal metrics snapshot from the public `SyncResult` shape. */
function resultAccounting(accounting: {
  providerCallCount: number;
  providerRequests: SyncProviderAccounting;
}): { providerCallCount: number; providerRequests: SyncProviderAccounting } {
  return {
    providerCallCount: accounting.providerCallCount,
    providerRequests: accounting.providerRequests,
  };
}

export function emptySyncState(season: number): SyncState {
  return {
    season,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastFailedAt: null,
    lastFailureCategory: null,
    lastSuccessByJob: {},
    lastFailureByJob: {},
    lastSkippedJobs: [],
    lastPublicationVersion: null,
    lastPublicationStatus: null,
  };
}

function markJobs(
  existing: Partial<Record<SyncJobCategory, string>>,
  jobs: SyncJobCategory[],
  timestamp: string,
): Partial<Record<SyncJobCategory, string>> {
  return {
    ...existing,
    ...Object.fromEntries(jobs.map((job) => [job, timestamp])),
  };
}

function releaseVersionFor(date: Date): string {
  const safeTime = date.toISOString().replace(/[-:.TZ]/g, '');
  return `${safeTime}-${crypto.randomUUID().slice(0, 8)}`;
}
