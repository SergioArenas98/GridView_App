import type {
  QuotaState,
  QuotaWarningLevel,
  QuotaWindowState,
  SyncJobCategory,
} from '../storage/types';
import type { ProviderAttemptOutcome } from './provider-metrics';
import {
  quotaPolicyFor,
  type ProviderQuotaPolicy,
  type ProviderSourceId,
  type QuotaWindowPolicy,
} from './provider-source';

/**
 * Locally modelled per-source quota state (gap G10 / G-k).
 *
 * Neither adopted source publishes rate-limit headers
 * (GridView_Provider_Evaluation.md §8.6), so nothing here is read from a
 * response. Every count is a GridView-local counter derived from the limits
 * each project publishes, held in that source's own windows.
 *
 * All functions are pure: they take the current state and return a new one.
 */

/**
 * Remaining-capacity thresholds for **sustained** windows
 * (GridView_Backend_Scheme.md §16.1). Percentages are meaningful at 30/minute
 * and 500/hour; they collapse on a 3-or-4-per-second burst window, which is
 * why burst windows never use them.
 */
export const sustainedWarningThresholds = {
  warning: 0.3,
  high: 0.15,
  critical: 0.05,
} as const;

/**
 * A burst window reaching zero once is normal and expected when a scheduled
 * batch runs, so a single saturation never raises an alert. Two or more
 * saturations without an intervening clean window is *repeated* saturation and
 * stays observable.
 */
export const repeatedBurstSaturationThreshold = 2;

/** Keeps the persisted streak bounded however long saturation lasts. */
export const burstSaturationStreakCap = 10;

const warningSeverity: Record<QuotaWarningLevel, number> = {
  unknown: 0,
  normal: 1,
  warning: 2,
  high: 3,
  critical: 4,
};

function freshWindow(
  policy: QuotaWindowPolicy,
  at: Date,
  saturationStreak = 0,
): QuotaWindowState {
  return {
    window: policy.window,
    windowClass: policy.windowClass,
    limit: policy.limit,
    durationSeconds: policy.durationSeconds,
    used: 0,
    remaining: policy.limit,
    windowStartedAt: at.toISOString(),
    resetsAt: new Date(
      at.getTime() + policy.durationSeconds * 1000,
    ).toISOString(),
    saturationStreak,
  };
}

/** A never-yet-observed source: windows at full capacity, warning `unknown`. */
export function emptyQuotaState(
  sourceId: ProviderSourceId,
  at: Date,
): QuotaState {
  const policy = quotaPolicyFor(sourceId);
  return {
    sourceId,
    testOnly: policy.testOnly,
    windows: policy.windows.map((window) => freshWindow(window, at)),
    lastProviderSuccessAt: null,
    lastProviderFailureAt: null,
    retryAfter: null,
    usageByJobCategory: {},
    warningLevel: 'unknown',
  };
}

/**
 * Reconciles stored windows against the current policy for the source: a
 * window the policy no longer declares is dropped, a newly declared one starts
 * fresh, and a changed published limit is adopted rather than a stale figure
 * carried forward.
 */
function alignWindows(
  stored: readonly QuotaWindowState[],
  policy: ProviderQuotaPolicy,
  at: Date,
): QuotaWindowState[] {
  return policy.windows.map((windowPolicy) => {
    const existing = stored.find(
      (candidate) => candidate.window === windowPolicy.window,
    );
    if (!existing) return freshWindow(windowPolicy, at);
    const used = Math.min(existing.used, windowPolicy.limit);
    return {
      ...existing,
      windowClass: windowPolicy.windowClass,
      limit: windowPolicy.limit,
      durationSeconds: windowPolicy.durationSeconds,
      used,
      remaining: Math.max(0, windowPolicy.limit - used),
    };
  });
}

function rollOver(window: QuotaWindowState, at: Date): QuotaWindowState {
  const resetsAt = Date.parse(window.resetsAt);
  if (!Number.isNaN(resetsAt) && at.getTime() < resetsAt) return window;
  // A window that expires without ever having saturated breaks the streak; one
  // that did saturate already contributed at the moment it saturated.
  const saturationStreak = window.remaining === 0 ? window.saturationStreak : 0;
  return freshWindow(
    {
      window: window.window,
      windowClass: window.windowClass,
      limit: window.limit,
      durationSeconds: window.durationSeconds,
    },
    at,
    saturationStreak,
  );
}

function consumeOne(window: QuotaWindowState): QuotaWindowState {
  const used = window.used + 1;
  const remaining = Math.max(0, window.limit - used);
  const saturated = remaining === 0 && window.remaining > 0;
  return {
    ...window,
    used,
    remaining,
    saturationStreak: saturated
      ? Math.min(window.saturationStreak + 1, burstSaturationStreakCap)
      : window.saturationStreak,
  };
}

export interface QuotaAttempt {
  readonly at: Date;
  readonly outcome: ProviderAttemptOutcome;
  readonly jobCategories: readonly SyncJobCategory[];
  /** Supplied only when the provider returned one on a rate-limit rejection. */
  readonly retryAfter?: string | null;
}

/**
 * Records exactly one attempted provider request against the modelled windows
 * for the source.
 *
 * The attempt is counted whatever the outcome: a failure and an HTTP 429
 * equivalent both left GridView and both consumed capacity.
 */
export function recordProviderAttempt(
  state: QuotaState | null,
  sourceId: ProviderSourceId,
  attempt: QuotaAttempt,
): QuotaState {
  const policy = quotaPolicyFor(sourceId);
  const base =
    state?.sourceId === sourceId
      ? state
      : emptyQuotaState(sourceId, attempt.at);
  const windows = alignWindows(base.windows, policy, attempt.at)
    .map((window) => rollOver(window, attempt.at))
    .map(consumeOne);

  const usageByJobCategory = { ...base.usageByJobCategory };
  for (const job of new Set(attempt.jobCategories)) {
    usageByJobCategory[job] = (usageByJobCategory[job] ?? 0) + 1;
  }

  const timestamp = attempt.at.toISOString();
  const next: QuotaState = {
    sourceId,
    testOnly: policy.testOnly,
    windows,
    lastProviderSuccessAt:
      attempt.outcome === 'successful' ? timestamp : base.lastProviderSuccessAt,
    lastProviderFailureAt:
      attempt.outcome === 'successful' ? base.lastProviderFailureAt : timestamp,
    // A successful attempt clears a spent retry-after; a rate-limited one
    // adopts the supplied value and otherwise keeps what was already known.
    retryAfter:
      attempt.outcome === 'successful'
        ? null
        : attempt.outcome === 'rate-limited'
          ? (attempt.retryAfter ?? base.retryAfter)
          : base.retryAfter,
    usageByJobCategory,
    warningLevel: 'unknown',
  };

  return {
    ...next,
    warningLevel: evaluateWarningLevel(next, {
      rateLimited: attempt.outcome === 'rate-limited',
    }),
  };
}

export interface WarningEvaluationInput {
  /** The provider rejected the attempt for rate limiting (HTTP 429 or equivalent). */
  readonly rateLimited?: boolean;
}

/** True once a burst window has saturated repeatedly without a clean window. */
export function hasRepeatedBurstSaturation(state: QuotaState): boolean {
  return state.windows.some(
    (window) =>
      window.windowClass === 'burst' &&
      window.saturationStreak >= repeatedBurstSaturationThreshold,
  );
}

/**
 * Derives the stored warning level. The most severe relevant condition wins.
 *
 * - Sustained windows use the remaining-capacity percentages above.
 * - Burst windows contribute **only** through repeated saturation. A single
 *   saturated burst window is normal pacing pressure and never escalates
 *   through the sustained progression.
 * - A provider rate-limit rejection is critical, and is the only unambiguous
 *   burst failure.
 *
 * This is quota modelling and alert-state calculation. It does not pace or
 * block outbound requests: the per-provider rate limiter is gap G7 and is not
 * implemented.
 */
export function evaluateWarningLevel(
  state: QuotaState,
  input: WarningEvaluationInput = {},
): QuotaWarningLevel {
  const levels: QuotaWarningLevel[] = [];

  for (const window of state.windows) {
    if (window.windowClass !== 'sustained') continue;
    if (window.limit <= 0) continue;
    const ratio = window.remaining / window.limit;
    if (ratio <= sustainedWarningThresholds.critical) levels.push('critical');
    else if (ratio <= sustainedWarningThresholds.high) levels.push('high');
    else if (ratio <= sustainedWarningThresholds.warning)
      levels.push('warning');
    else levels.push('normal');
  }

  if (hasRepeatedBurstSaturation(state)) levels.push('warning');
  if (input.rateLimited) levels.push('critical');

  if (levels.length === 0) return 'unknown';
  return levels.reduce((worst, level) =>
    warningSeverity[level] > warningSeverity[worst] ? level : worst,
  );
}
