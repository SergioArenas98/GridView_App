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

export interface SyncResult {
  status: 'completed' | 'skipped' | 'failed';
  season: number;
  dueJobs: SyncJobCategory[];
  skippedJobs: SyncJobCategory[];
  publicationStatus: string | null;
  releaseVersion: string | null;
  failureCategory: string | null;
  providerCallCount: number;
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
    const existing =
      (await this.storage.getSyncState(request.season)) ??
      emptySyncState(request.season);
    await this.storage.setSyncState(request.season, {
      ...existing,
      lastStartedAt: startedAt,
    });

    const storedQuota = await this.storage.getQuotaState();
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
      return {
        status: 'skipped',
        season: request.season,
        dueJobs: [],
        skippedJobs: plan.skippedJobs,
        publicationStatus: 'skipped',
        releaseVersion: null,
        failureCategory: plan.reason,
        providerCallCount: providerCallCount(this.provider),
      };
    }

    if (!this.provider) {
      return this.fail(
        request.season,
        existing,
        startedAt,
        'provider-unavailable',
        plan,
      );
    }

    this.logger.info({
      operation: 'sync.started',
      season: request.season,
      providerCallCount: providerCallCount(this.provider),
    });

    try {
      const source = await this.provider.fetchSeasonSource(
        request.season,
        plan.dueJobs,
      );
      await this.storage.setQuotaState({
        ...source.quota,
        retryAfter: source.quota.retryAfter,
        lastProviderSuccessAt: this.clock.now().toISOString(),
      });
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
      this.logger.info({
        operation: 'sync.completed',
        season: request.season,
        releaseVersion: publication.version,
        providerCallCount: providerCallCount(this.provider),
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
        providerCallCount: providerCallCount(this.provider),
      };
    } catch (error) {
      const category =
        error instanceof ProviderRateLimitedError
          ? 'provider-rate-limited'
          : error instanceof ProviderError
            ? error.category
            : 'sync-failure';
      const quota = await quotaAfterFailure(
        storedQuota,
        this.clock.now().toISOString(),
        error,
      );
      await this.storage.setQuotaState(quota);
      return this.fail(request.season, existing, startedAt, category, plan);
    }
  }

  private async fail(
    season: number,
    existing: SyncState,
    startedAt: string,
    category: string,
    plan: { dueJobs: SyncJobCategory[]; skippedJobs: SyncJobCategory[] },
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
    this.logger.warn({
      operation: 'sync.failed',
      season,
      failureCategory: category,
      providerCallCount: providerCallCount(this.provider),
    });
    return {
      status: 'failed',
      season,
      dueJobs: plan.dueJobs,
      skippedJobs: plan.skippedJobs,
      publicationStatus: 'failed',
      releaseVersion: null,
      failureCategory: category,
      providerCallCount: providerCallCount(this.provider),
    };
  }
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

function providerCallCount(provider: FormulaOneProvider | null): number {
  const candidate = provider as unknown as { callCount?: unknown } | null;
  return typeof candidate?.callCount === 'number' ? candidate.callCount : 0;
}

async function quotaAfterFailure(
  quota: QuotaState | null,
  failedAt: string,
  error: unknown,
): Promise<QuotaState> {
  return {
    dailyLimit: quota?.dailyLimit ?? null,
    dailyRemaining: quota?.dailyRemaining ?? null,
    perMinuteLimit: quota?.perMinuteLimit ?? null,
    perMinuteRemaining: quota?.perMinuteRemaining ?? null,
    lastProviderSuccessAt: quota?.lastProviderSuccessAt ?? null,
    lastProviderFailureAt: failedAt,
    retryAfter:
      error instanceof ProviderRateLimitedError
        ? error.retryAfter
        : (quota?.retryAfter ?? null),
    usageByJobCategory: quota?.usageByJobCategory ?? {},
    warningLevel:
      error instanceof ProviderRateLimitedError
        ? 'critical'
        : (quota?.warningLevel ?? 'unknown'),
  };
}
