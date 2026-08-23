/**
 * Canonical internal provider source identity and the locally modelled quota
 * policy for each source.
 *
 * These identifiers are **internal**. They never appear in a public v1 DTO, in
 * the OpenAPI schema or in any generated fixture
 * (GridView_Provider_Evaluation.md §10.8, ADR 0020 implementation obligation 7).
 *
 * They are also independent of `PROVIDER_MODE`, which still admits exactly
 * `mock | none`. Naming a source here does not make it runnable: only the mock
 * provider is implemented, and no adapter for `jolpica` or `openf1` exists.
 */
export const providerSourceIds = ['mock', 'jolpica', 'openf1'] as const;

export type ProviderSourceId = (typeof providerSourceIds)[number];

export function isProviderSourceId(value: unknown): value is ProviderSourceId {
  return (
    typeof value === 'string' &&
    (providerSourceIds as readonly string[]).includes(value)
  );
}

/**
 * The window kinds the adopted sources actually publish.
 *
 * There is deliberately **no** `day` member: neither OpenF1 nor Jolpica
 * publishes a daily limit (GridView_Provider_Evaluation.md §9.1, §9.2), so a
 * daily bucket cannot be modelled from a published figure
 * (GridView_Backend_Scheme.md §16, gap G-k).
 */
export type QuotaWindowKind = 'second' | 'minute' | 'hour';

/**
 * `burst` windows are primarily a pacing input for the (not yet implemented)
 * per-provider rate limiter; reaching zero in one of them is normal when a
 * scheduled batch runs. `sustained` windows are the alerting surface and use
 * remaining-capacity percentages (GridView_Backend_Scheme.md §16.1).
 */
export type QuotaWindowClass = 'burst' | 'sustained';

export interface QuotaWindowPolicy {
  readonly window: QuotaWindowKind;
  readonly windowClass: QuotaWindowClass;
  /** Requests the source publishes as permitted inside one window. */
  readonly limit: number;
  readonly durationSeconds: number;
}

export interface ProviderQuotaPolicy {
  readonly sourceId: ProviderSourceId;
  /**
   * `true` when the limits are GridView's own test fixtures rather than a
   * figure a real source publishes. A test-only policy must never be presented
   * or reported as Jolpica or OpenF1 policy.
   */
  readonly testOnly: boolean;
  readonly windows: readonly QuotaWindowPolicy[];
}

const windowDurationSeconds: Record<QuotaWindowKind, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
};

function window(
  kind: QuotaWindowKind,
  windowClass: QuotaWindowClass,
  limit: number,
): QuotaWindowPolicy {
  return {
    window: kind,
    windowClass,
    limit,
    durationSeconds: windowDurationSeconds[kind],
  };
}

/**
 * OpenF1 Community tier, as published on access date 2026-08-19
 * (GridView_Provider_Evaluation.md §9.1): 3 requests/second and
 * 30 requests/minute. No daily or monthly cap is published.
 *
 * Recording the policy does **not** unlock the source. ADR 0020 §5 keeps every
 * real OpenF1 request skipped until a justified session-end bound is recorded,
 * and no OpenF1 adapter exists.
 */
const openF1QuotaPolicy: ProviderQuotaPolicy = {
  sourceId: 'openf1',
  testOnly: false,
  windows: [window('second', 'burst', 3), window('minute', 'sustained', 30)],
};

/**
 * Jolpica unauthenticated public access, as published on access date
 * 2026-08-19 (GridView_Provider_Evaluation.md §9.2): burst 4 requests/second,
 * sustained 500 requests/hour. No daily cap is published, and the published
 * limits are stated to be subject to reduction.
 *
 * No Jolpica adapter exists.
 */
const jolpicaQuotaPolicy: ProviderQuotaPolicy = {
  sourceId: 'jolpica',
  testOnly: false,
  windows: [window('second', 'burst', 4), window('hour', 'sustained', 500)],
};

/**
 * Test-only limits for the deterministic mock provider. These are GridView
 * fixtures chosen to make window and warning behaviour exercisable; they are
 * not a published figure and must never be read as Jolpica or OpenF1 policy.
 */
const mockQuotaPolicy: ProviderQuotaPolicy = {
  sourceId: 'mock',
  testOnly: true,
  // Deliberately far above any realistic test volume, so ordinary test traffic
  // never silently trips the scheduler's high-quota job skipping. Warning-level
  // behaviour is exercised against the real published policies instead.
  windows: [window('second', 'burst', 15), window('minute', 'sustained', 200)],
};

const quotaPolicies: Record<ProviderSourceId, ProviderQuotaPolicy> = {
  mock: mockQuotaPolicy,
  jolpica: jolpicaQuotaPolicy,
  openf1: openF1QuotaPolicy,
};

export function quotaPolicyFor(
  sourceId: ProviderSourceId,
): ProviderQuotaPolicy {
  return quotaPolicies[sourceId];
}
