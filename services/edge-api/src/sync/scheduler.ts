import type { Clock } from '../runtime/clock';
import type { QuotaState, SyncJobCategory, SyncState } from '../storage/types';

export interface DueJobPlan {
  dueJobs: SyncJobCategory[];
  skippedJobs: SyncJobCategory[];
  reason: string | null;
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

export function calculateDueJobs(
  clock: Clock,
  state: SyncState | null,
  quota: QuotaState | null,
  forceJobs?: SyncJobCategory[],
): DueJobPlan {
  if (
    quota?.retryAfter &&
    Date.parse(quota.retryAfter) > clock.now().getTime()
  ) {
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
    return {
      dueJobs: [],
      skippedJobs: dueJobs,
      reason: 'quota-critical-reserved-for-manual-recovery',
    };
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
