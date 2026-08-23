import {
  hasManualRecoveryCapacity,
  retryAfterActive,
} from '../providers/quota-model';
import type { Clock } from '../runtime/clock';
import type { QuotaState, SyncJobCategory, SyncState } from '../storage/types';

export interface DueJobPlan {
  dueJobs: SyncJobCategory[];
  skippedJobs: SyncJobCategory[];
  reason: string | null;
}

export interface DueJobOptions {
  forceJobs?: SyncJobCategory[];
  /**
   * `true` only for a protected, explicitly triggered operator recovery.
   *
   * Passed as a typed input rather than inferred from a non-empty `forceJobs`
   * array, because forcing jobs and recovering from a critical quota are
   * different intents that happen to coincide today. A public request can
   * never set it: there is no public synchronization route, and every manual
   * trigger comes from the admin-authenticated router.
   */
  manualRecovery?: boolean;
}

const intervalsSeconds: Record<SyncJobCategory, number> = {
  'season-calendar': 6 * 60 * 60,
  'event-schedule': 60 * 60,
  profiles: 24 * 60 * 60,
  standings: 15 * 60,
  results: 15 * 60,
  'home-rebuild': 5 * 60,
};

const allJobs = Object.keys(intervalsSeconds) as SyncJobCategory[];
const lowPriorityJobs: SyncJobCategory[] = ['profiles', 'home-rebuild'];

/**
 * `quota` must already have been refreshed for `clock.now()` (see
 * `refreshQuotaState`). These gates read time-dependent state, so planning
 * against a stale snapshot is what previously froze a source permanently.
 */
export function calculateDueJobs(
  clock: Clock,
  state: SyncState | null,
  quota: QuotaState | null,
  options: DueJobOptions = {},
): DueJobPlan {
  const { forceJobs, manualRecovery = false } = options;

  // An active Retry-After is a direct provider instruction and blocks
  // scheduled and manual work alike.
  if (retryAfterActive(quota?.retryAfter ?? null, clock.now())) {
    return { dueJobs: [], skippedJobs: allJobs, reason: 'retry-after-active' };
  }

  const requested = forceJobs ?? allJobs;
  const dueJobs = forceJobs
    ? [...requested]
    : requested.filter((job) =>
        isDue(clock, state?.lastSuccessByJob[job], job),
      );
  const skippedJobs: SyncJobCategory[] = [];

  if (quota?.warningLevel === 'critical') {
    // §16.1 reserves part of the longest sustained window for manual
    // recovery. Capacity no operation can reach is not reserved capacity, so a
    // protected operator recovery may spend it - but only while it exists.
    if (!manualRecovery) {
      return {
        dueJobs: [],
        skippedJobs: dueJobs,
        reason: 'quota-critical-reserved-for-manual-recovery',
      };
    }
    if (!hasManualRecoveryCapacity(quota)) {
      return {
        dueJobs: [],
        skippedJobs: dueJobs,
        reason: 'quota-critical-recovery-reserve-exhausted',
      };
    }
  }

  if (quota?.warningLevel === 'high') {
    for (const low of lowPriorityJobs) {
      const index = dueJobs.indexOf(low);
      if (index >= 0) {
        dueJobs.splice(index, 1);
        skippedJobs.push(low);
      }
    }
  }

  return {
    dueJobs,
    skippedJobs,
    reason: dueJobs.length === 0 ? 'no-job-due' : null,
  };
}

function isDue(
  clock: Clock,
  lastSuccessAt: string | undefined,
  job: SyncJobCategory,
): boolean {
  if (!lastSuccessAt) return true;
  const last = Date.parse(lastSuccessAt);
  if (Number.isNaN(last)) return true;
  return clock.now().getTime() - last >= intervalsSeconds[job] * 1000;
}
