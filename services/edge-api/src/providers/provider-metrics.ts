import type { SyncJobCategory } from '../storage/types';
import { providerSourceIds, type ProviderSourceId } from './provider-source';

/**
 * Typed provider request accounting (gap G6).
 *
 * Every provider implementation must expose these counts through the
 * `FormulaOneProvider` contract, so a missing implementation is a compile
 * error rather than a silent zero. Nothing here probes an object structurally.
 *
 * An **attempt** is one outbound provider request that GridView issued. A
 * failure and a rate-limited rejection are both attempts and are both counted:
 * the request left GridView and consumed the modelled window capacity whatever
 * the response was.
 */
export type ProviderAttemptOutcome = 'successful' | 'failed' | 'rate-limited';

export interface ProviderAttemptCounts {
  /** `successful + failed + rateLimited`. */
  readonly total: number;
  readonly successful: number;
  readonly failed: number;
  readonly rateLimited: number;
}

export interface ProviderRequestMetrics {
  /**
   * Attempts across the **observable lifetime of this provider instance** —
   * every attempt it has made since it was constructed. This is the semantics
   * the pre-existing `SyncResult.providerCallCount` total carried, and it is
   * preserved unchanged.
   */
  readonly lifetime: ProviderAttemptCounts;
  /**
   * Lifetime attempts attributed to each canonical provider source. A
   * single-source provider reports one entry; a future coordinator over two
   * adapters reports one entry per adapter it drove.
   */
  readonly bySource: Readonly<
    Partial<Record<ProviderSourceId, ProviderAttemptCounts>>
  >;
  /**
   * Lifetime attempts attributed to each synchronization job category. One
   * attempt that serves several categories is counted once against each of
   * them, so these do not sum to `lifetime.total`.
   */
  readonly byJobCategory: Readonly<
    Partial<Record<SyncJobCategory, ProviderAttemptCounts>>
  >;
}

export interface ProviderAttempt {
  readonly sourceId: ProviderSourceId;
  readonly outcome: ProviderAttemptOutcome;
  readonly jobCategories: readonly SyncJobCategory[];
}

const zeroCounts: ProviderAttemptCounts = {
  total: 0,
  successful: 0,
  failed: 0,
  rateLimited: 0,
};

function addAttempt(
  counts: ProviderAttemptCounts | undefined,
  outcome: ProviderAttemptOutcome,
): ProviderAttemptCounts {
  const base = counts ?? zeroCounts;
  return {
    total: base.total + 1,
    successful: base.successful + (outcome === 'successful' ? 1 : 0),
    failed: base.failed + (outcome === 'failed' ? 1 : 0),
    rateLimited: base.rateLimited + (outcome === 'rate-limited' ? 1 : 0),
  };
}

function subtractCounts(
  after: ProviderAttemptCounts | undefined,
  before: ProviderAttemptCounts | undefined,
): ProviderAttemptCounts {
  const later = after ?? zeroCounts;
  const earlier = before ?? zeroCounts;
  return {
    total: later.total - earlier.total,
    successful: later.successful - earlier.successful,
    failed: later.failed - earlier.failed,
    rateLimited: later.rateLimited - earlier.rateLimited,
  };
}

function isEmpty(counts: ProviderAttemptCounts): boolean {
  return counts.total === 0;
}

/**
 * Accumulates provider attempts. Immutable snapshots are handed out, so a
 * caller can subtract two of them to obtain operation-scoped counts.
 */
export class ProviderRequestLedger {
  private lifetime: ProviderAttemptCounts = zeroCounts;
  private readonly bySource = new Map<
    ProviderSourceId,
    ProviderAttemptCounts
  >();
  private readonly byJobCategory = new Map<
    SyncJobCategory,
    ProviderAttemptCounts
  >();

  record(attempt: ProviderAttempt): void {
    this.lifetime = addAttempt(this.lifetime, attempt.outcome);
    this.bySource.set(
      attempt.sourceId,
      addAttempt(this.bySource.get(attempt.sourceId), attempt.outcome),
    );
    for (const job of new Set(attempt.jobCategories)) {
      this.byJobCategory.set(
        job,
        addAttempt(this.byJobCategory.get(job), attempt.outcome),
      );
    }
  }

  snapshot(): ProviderRequestMetrics {
    return {
      lifetime: this.lifetime,
      bySource: Object.fromEntries(this.bySource) as Partial<
        Record<ProviderSourceId, ProviderAttemptCounts>
      >,
      byJobCategory: Object.fromEntries(this.byJobCategory) as Partial<
        Record<SyncJobCategory, ProviderAttemptCounts>
      >,
    };
  }
}

export function emptyRequestMetrics(): ProviderRequestMetrics {
  return { lifetime: zeroCounts, bySource: {}, byJobCategory: {} };
}

/**
 * `after - before`, giving the attempts made between two snapshots — the
 * accounting for one synchronization operation. Entries that did not move are
 * omitted, so the result stays bounded by what the operation actually touched.
 */
export function metricsDifference(
  before: ProviderRequestMetrics,
  after: ProviderRequestMetrics,
): ProviderRequestMetrics {
  const bySource: Partial<Record<ProviderSourceId, ProviderAttemptCounts>> = {};
  for (const sourceId of providerSourceIds) {
    const delta = subtractCounts(
      after.bySource[sourceId],
      before.bySource[sourceId],
    );
    if (!isEmpty(delta)) bySource[sourceId] = delta;
  }

  const byJobCategory: Partial<Record<SyncJobCategory, ProviderAttemptCounts>> =
    {};
  const jobs = new Set<SyncJobCategory>([
    ...(Object.keys(before.byJobCategory) as SyncJobCategory[]),
    ...(Object.keys(after.byJobCategory) as SyncJobCategory[]),
  ]);
  for (const job of jobs) {
    const delta = subtractCounts(
      after.byJobCategory[job],
      before.byJobCategory[job],
    );
    if (!isEmpty(delta)) byJobCategory[job] = delta;
  }

  return {
    lifetime: subtractCounts(after.lifetime, before.lifetime),
    bySource,
    byJobCategory,
  };
}

/**
 * A flat, bounded map of `sourceId -> total attempts` for structured logs.
 * Only integer counts are emitted — never a provider response, a provider
 * message or any provider-controlled string.
 */
export function totalsBySource(
  metrics: ProviderRequestMetrics,
): Partial<Record<ProviderSourceId, number>> {
  const totals: Partial<Record<ProviderSourceId, number>> = {};
  for (const sourceId of providerSourceIds) {
    const counts = metrics.bySource[sourceId];
    if (counts) totals[sourceId] = counts.total;
  }
  return totals;
}
