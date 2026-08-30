import type { Logger } from '../logging/logger';
import type { Clock } from '../runtime/clock';
import { generateSnapshotSet } from '../snapshots/generator';
import type {
  PublicationReason,
  SnapshotPublisher,
} from '../publication/publisher';
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
import {
  quotaStateChanged,
  recordProviderAttempt,
  refreshQuotaState,
} from '../providers/quota-model';
import {
  ProviderError,
  ProviderRateLimitedError,
  ProviderRequestNotAttemptedError,
  type FormulaOneProvider,
  type ProviderSeasonSource,
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

/**
 * What a **rejected** publication means for the synchronization run.
 *
 * A rejection is the publisher declining a candidate it examined, which is a
 * different fact from an operational failure. Only one rejection is benign.
 */
export type RejectedPublicationConsequence = 'completed-no-op' | 'failed';

/**
 * The product decision for every declared publication reason.
 *
 * A candidate older than what is already serving is the pacing system working:
 * nothing needed publishing and the run legitimately completed. **Every other
 * rejection is an integrity refusal.** Recording one as a completed run
 * advances `lastCompletedAt` and marks every due job successful, so the next
 * cadence sees nothing due and a season that cannot be published looks healthy
 * until an operator reads the publication status by hand.
 *
 * The switch is exhaustive over `PublicationReason` with **no default**, so a
 * new reason is a compile error here rather than silently taking whichever
 * branch a default happened to be. An absent reason fails closed.
 */
export function consequenceForRejectedPublication(
  reason: PublicationReason | null,
): RejectedPublicationConsequence {
  if (reason === null) return 'failed';
  switch (reason) {
    case 'older-source-updated-at':
      return 'completed-no-op';
    case 'idempotent':
    case 'active-version-incomplete':
    case 'contract-validation':
    case 'storage-read':
    case 'storage-write':
    case 'incomplete-version':
    case 'cache-purge-failed':
    case 'previous-pointer-maintenance-failed':
    case 'missing-previous-version':
    case 'rollback-target-missing':
    case 'rollback-target-incomplete':
    case 'missing-version-inventory':
    case 'no-active-version':
      return 'failed';
  }
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

    // Quota carries time-dependent state, so it is brought up to the current
    // clock BEFORE any gate reads it. Planning against a stale snapshot is
    // what previously let an expired `critical` freeze a source permanently:
    // the level blocked the request, and only a request could clear the level.
    const storedQuota = this.provider
      ? await this.storage.getQuotaState(this.provider.sourceId)
      : null;
    const quota =
      this.provider && storedQuota
        ? refreshQuotaState(
            storedQuota,
            this.provider.sourceId,
            this.clock.now(),
          )
        : storedQuota;
    if (
      this.provider &&
      quota &&
      storedQuota &&
      quotaStateChanged(storedQuota, quota)
    ) {
      // Persist the refresh even when nothing else happens this run, so the
      // admin quota surface cannot keep reporting an expired critical state.
      // Compared by value: the refresh always returns a new object, so a
      // reference check would write on every invocation.
      await this.storage.setQuotaState(this.provider.sourceId, quota);
    }
    const plan = calculateDueJobs(this.clock, existing, quota, {
      forceJobs: request.forceJobs,
      // Only a protected, explicitly triggered operator run may spend the
      // manual-recovery reserve. `scheduled` never can, and no public route
      // reaches this method.
      manualRecovery: request.trigger !== 'scheduled',
    });
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

    // The provider boundary is its own try. Only a fetch error may be recorded
    // as a provider attempt outcome; anything thrown after this block is a
    // GridView-side failure and must not rewrite provider quota.
    let source: ProviderSeasonSource;
    try {
      source = await this.provider.fetchSeasonSource(
        request.season,
        plan.dueJobs,
      );
    } catch (error) {
      if (error instanceof ProviderRequestNotAttemptedError) {
        // GridView declined to send, so no request left the Worker. Recording
        // an attempt here would inflate quota usage and provider failure
        // timestamps for something the provider never saw. Checked before
        // `ProviderError` on purpose, and this type deliberately does not
        // extend it.
        return this.fail(
          request.season,
          existing,
          startedAt,
          error.category,
          plan,
          metricsBefore,
        );
      }
      const rateLimited = error instanceof ProviderRateLimitedError;
      const category = rateLimited
        ? 'provider-rate-limited'
        : error instanceof ProviderError
          ? error.category
          : 'provider-fetch-failure';
      await this.recordQuotaAttempt(
        this.provider.sourceId,
        quota,
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

    // Exactly one successful attempt, recorded once, before any post-fetch
    // work can throw.
    await this.recordQuotaAttempt(
      this.provider.sourceId,
      quota,
      'successful',
      plan.dueJobs,
      null,
    );

    try {
      const releaseVersion =
        request.forceVersion ?? releaseVersionFor(this.clock.now());
      const set = generateSnapshotSet(
        source,
        this.clock.now().toISOString(),
        releaseVersion,
      );
      const publication = await this.publisher.publish(set);
      if (publication.status === 'failed') {
        // The publisher contained an operational failure and reported it
        // rather than throwing. It is still a failed run, so it takes the
        // failure path in full - one `sync.failed` line, failed sync state -
        // instead of being logged as completed while the response says
        // otherwise. The publisher's own bounded reason is carried through,
        // because it is more precise than the generic post-fetch category.
        return this.fail(
          request.season,
          existing,
          startedAt,
          publication.reason ?? 'snapshot-publication-failure',
          plan,
          metricsBefore,
        );
      }
      if (
        publication.status === 'rejected' &&
        consequenceForRejectedPublication(publication.reason) === 'failed'
      ) {
        // An integrity refusal. The candidate was examined and declined, so
        // nothing published and last-known-good stands - but the season is not
        // in the state the run was asked to produce, and recording a completed
        // run would hide that until the next cadence found nothing due.
        //
        // The publisher's precise bounded reason **and** its own status are
        // both preserved: the run failed, and the publication was rejected.
        // Reporting the publication as `failed` would erase the difference
        // between a declined candidate and a broken dependency.
        return this.fail(
          request.season,
          existing,
          startedAt,
          publication.reason ?? 'snapshot-publication-failure',
          plan,
          metricsBefore,
          publication.status,
        );
      }
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
        // Bounded, and reported for an applied publication only: a committed
        // release whose post-commit `previous` maintenance failed **is**
        // serving, so the run completed - but its rollback target is stale and
        // an operator has to see that without reading storage.
        ...(publication.status === 'applied'
          ? { pointerMaintenance: publication.pointerMaintenance }
          : {}),
      });
      // A failed publication and an integrity rejection both returned above, so
      // everything reaching here either committed (`applied`) or is a benign
      // no-op (`skipped`, or a `rejected` older-source candidate) that leaves
      // the prior release serving without failing the run.
      return {
        status: 'completed',
        season: request.season,
        dueJobs: plan.dueJobs,
        skippedJobs: plan.skippedJobs,
        publicationStatus: publication.status,
        releaseVersion: publication.version,
        failureCategory: null,
        ...resultAccounting(accounting),
      };
    } catch {
      // Generation, validation, storage or publication threw AFTER a
      // successful fetch. The synchronization failed, but the provider did
      // not: no second attempt is recorded, provider quota is not rewritten
      // as a failure, and `lastProviderSuccessAt` stands. The exception body
      // is deliberately not read into the category or the logs.
      return this.fail(
        request.season,
        existing,
        startedAt,
        'snapshot-publication-failure',
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

  /**
   * Records a failed run.
   *
   * `publicationStatus` defaults to `failed` because most failures never reach
   * the publisher at all. A caller passes the publisher's own status when the
   * publisher did answer - an integrity rejection is a failed run whose
   * publication was `rejected`, and collapsing the two would lose the
   * difference between a declined candidate and a broken dependency.
   */
  private async fail(
    season: number,
    existing: SyncState,
    startedAt: string,
    category: string,
    plan: { dueJobs: SyncJobCategory[]; skippedJobs: SyncJobCategory[] },
    metricsBefore: ProviderRequestMetrics,
    publicationStatus = 'failed',
  ): Promise<SyncResult> {
    const failedAt = this.clock.now().toISOString();
    await this.storage.setSyncState(season, {
      ...existing,
      lastStartedAt: startedAt,
      lastFailedAt: failedAt,
      lastFailureCategory: category,
      lastSkippedJobs: plan.skippedJobs,
      lastPublicationStatus: publicationStatus,
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
      publicationStatus,
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
