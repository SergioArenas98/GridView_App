import {
  isProviderSourceId,
  type ProviderSourceId,
} from '../providers/provider-source';
import type { QuotaState, SyncJobCategory } from './types';

/**
 * Accepts a stored quota record only if it genuinely belongs to the requested
 * source.
 *
 * This is the read-side half of source isolation: `setQuotaState` stamps the
 * requested `sourceId` onto every write, and this rejects anything under a
 * source key that disagrees — a hand-edited record, a bad migration or a
 * key collision. A mismatch is discarded rather than returned, because
 * returning one source's modelled capacity as another source's is exactly the
 * failure per-source quota exists to prevent.
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
  warningLevel?: unknown;
}

const warningLevels = new Set([
  'normal',
  'warning',
  'high',
  'critical',
  'unknown',
]);

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
 * and treating them as Jolpica or OpenF1 policy would fabricate a published
 * limit. Only the source-independent operational fields survive — the last
 * provider success and failure, an outstanding `Retry-After`, usage by job
 * category and the warning level — which is what preserves existing
 * staging/mock scheduler behaviour across the change.
 *
 * `windows` is deliberately empty: no modelled window is transferable from the
 * legacy shape. The next recorded attempt initialises the windows from the
 * current policy for the source.
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
  const warningLevel =
    typeof legacy.warningLevel === 'string' &&
    warningLevels.has(legacy.warningLevel)
      ? (legacy.warningLevel as QuotaState['warningLevel'])
      : 'unknown';

  return {
    sourceId: 'mock',
    testOnly: true,
    windows: [],
    lastProviderSuccessAt: isoStringOrNull(legacy.lastProviderSuccessAt),
    lastProviderFailureAt: isoStringOrNull(legacy.lastProviderFailureAt),
    retryAfter: isoStringOrNull(legacy.retryAfter),
    usageByJobCategory: usageOrEmpty(legacy.usageByJobCategory),
    warningLevel,
  };
}
