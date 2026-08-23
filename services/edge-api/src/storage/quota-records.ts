import {
  isProviderSourceId,
  type ProviderSourceId,
} from '../providers/provider-source';
import type { QuotaState, SyncJobCategory } from './types';

/**
 * Raised when a quota write names one source in the key and a different one in
 * the record. Storage is left untouched.
 */
export class QuotaSourceMismatchError extends Error {
  constructor(
    readonly expected: ProviderSourceId,
    readonly received: unknown,
  ) {
    super(
      `Quota state for "${String(received)}" cannot be written under source "${expected}".`,
    );
    this.name = 'QuotaSourceMismatchError';
  }
}

/**
 * Write-side half of source isolation: fail closed rather than relabel.
 *
 * Restamping the key's source onto a mismatched record would silently publish
 * one source's modelled capacity as another's — for example storing OpenF1's
 * 3/second and 30/minute windows as Jolpica state, which a later rate limiter
 * would then pace Jolpica against. That is exactly the failure per-source
 * quota exists to prevent, so it throws before storage is modified.
 */
export function assertQuotaSource(
  sourceId: ProviderSourceId,
  state: QuotaState,
): void {
  if (state.sourceId !== sourceId) {
    throw new QuotaSourceMismatchError(sourceId, state.sourceId);
  }
}

/**
 * Accepts a stored quota record only if it genuinely belongs to the requested
 * source.
 *
 * The read-side half: rejects anything under a source key that disagrees — a
 * hand-edited record, a bad migration or a key collision.
 */
export function quotaRecordForSource(
  sourceId: ProviderSourceId,
  raw: unknown,
): QuotaState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const stored = (raw as { sourceId?: unknown }).sourceId;
  if (!isProviderSourceId(stored) || stored !== sourceId) return null;
  return raw as QuotaState;
}

/**
 * The pre-Phase-9B-1 global quota record, as it was written when the mock
 * provider was the only provider and quota had no source dimension.
 *
 * Its `dailyLimit` / `dailyRemaining` / `perMinuteLimit` / `perMinuteRemaining`
 * fields came from a metered-provider shape that neither OpenF1 nor Jolpica
 * matches (GridView_Provider_Evaluation.md §8.6, §9.1, §9.2).
 */
interface LegacyGlobalQuotaRecord {
  dailyLimit?: unknown;
  dailyRemaining?: unknown;
  perMinuteLimit?: unknown;
  perMinuteRemaining?: unknown;
  lastProviderSuccessAt?: unknown;
  lastProviderFailureAt?: unknown;
  retryAfter?: unknown;
  usageByJobCategory?: unknown;
  /**
   * Read but deliberately **not** carried forward. See
   * `adaptLegacyMockQuotaState`.
   */
  warningLevel?: unknown;
}

function isoStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function usageOrEmpty(
  value: unknown,
): Partial<Record<SyncJobCategory, number>> {
  if (typeof value !== 'object' || value === null) return {};
  const usage: Partial<Record<SyncJobCategory, number>> = {};
  for (const [job, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
      usage[job as SyncJobCategory] = Math.trunc(count);
    }
  }
  return usage;
}

/**
 * Adapts a legacy global quota record for the **`mock`** source only.
 *
 * The legacy daily and per-minute figures are **discarded**, never
 * reinterpreted: they described a metered provider that GridView does not use,
 * and treating them as current mock, Jolpica or OpenF1 policy would fabricate
 * a published limit.
 *
 * **The legacy `warningLevel` is discarded with them.** It was *derived* from
 * those limits and remaining counts, so it is not source-independent state and
 * cannot outlive its inputs. Carrying a legacy `critical` forward deadlocked
 * the mock provider permanently: the scheduler skips every job at `critical`,
 * skipping means no provider attempt, no attempt means no policy-backed
 * windows are ever initialised and no source-specific record ever replaces the
 * fallback, so every later invocation repeated the same skip. The migrated
 * level is therefore `unknown` — a documented non-blocking value — until the
 * first attempt evaluates a level from real policy-backed windows.
 *
 * What genuinely is source-independent survives: last provider success and
 * failure, usage by job category, and `Retry-After`. `Retry-After` is a
 * provider instruction rather than a derived level, so it is preserved as-is:
 * an active one still blocks the next request through the scheduler, and an
 * expired one blocks nothing.
 *
 * `windows` is deliberately empty: no modelled window is transferable from the
 * legacy shape. The next recorded attempt initialises them from current policy.
 *
 * Returns `null` for anything that is not a usable legacy object, and is only
 * ever reachable for `sourceId === 'mock'`.
 */
export function adaptLegacyMockQuotaState(
  sourceId: ProviderSourceId,
  raw: unknown,
): QuotaState | null {
  if (sourceId !== 'mock') return null;
  if (typeof raw !== 'object' || raw === null) return null;
  const legacy = raw as LegacyGlobalQuotaRecord;

  return {
    sourceId: 'mock',
    testOnly: true,
    windows: [],
    lastProviderSuccessAt: isoStringOrNull(legacy.lastProviderSuccessAt),
    lastProviderFailureAt: isoStringOrNull(legacy.lastProviderFailureAt),
    retryAfter: isoStringOrNull(legacy.retryAfter),
    usageByJobCategory: usageOrEmpty(legacy.usageByJobCategory),
    // Never `high` or `critical`: the inputs that produced them are gone.
    warningLevel: 'unknown',
  };
}
