import {
  quotaPolicyFor,
  type ProviderQuotaPolicy,
  type QuotaWindowKind,
} from '../provider-source';

/**
 * Pure exact sliding-window reservation engine (gap G7).
 *
 * This is the **pacing authority**: it decides whether one more outbound
 * request may leave GridView right now. It is deliberately separate from the
 * Phase 9B-1 quota model, which remains the *reporting and scheduling* model.
 * A reservation is not a provider attempt, and a provider attempt is not a
 * reservation; neither may be relabelled as the other.
 *
 * ## Representation
 *
 * One ascending list of reservation timestamps (epoch milliseconds) per
 * source. A single list is sufficient and is what makes the design correct
 * under a policy change: every window is recomputed from the *current* typed
 * policy on every call, so no per-window counter can go stale, and no
 * historical attempt is ever fabricated.
 *
 * ## Expiration boundary
 *
 * At time `t`, a timestamp `ts` is **active** iff `ts > t - duration`.
 * Equivalently, `ts <= t - duration` has expired. Capacity therefore returns
 * exactly at `ts + duration`, not a millisecond later.
 *
 * ## Boundedness
 *
 * History is pruned to the longest window the policy declares. Within that
 * span the engine never admits more than that window's limit, so the stored
 * list is bounded by it: 500 for Jolpica (hour), 30 for OpenF1 (minute).
 * Neither source publishes a daily window, so no daily bucket exists.
 */

/** Only real sources are paced. The mock is deterministic and network-free. */
export const realProviderSourceIds = ['jolpica', 'openf1'] as const;

export type RealProviderSourceId = (typeof realProviderSourceIds)[number];

export function isRealProviderSourceId(
  value: unknown,
): value is RealProviderSourceId {
  return (
    typeof value === 'string' &&
    (realProviderSourceIds as readonly string[]).includes(value)
  );
}

export interface ReservationLedger {
  readonly sourceId: RealProviderSourceId;
  /** Ascending epoch milliseconds. Bounded by the longest window's limit. */
  readonly timestamps: readonly number[];
}

export interface LimitingWindow {
  readonly window: QuotaWindowKind;
  readonly limit: number;
  /** Earliest instant at which this window alone could admit the request. */
  readonly retryAt: string;
}

export interface WindowHeadroom {
  readonly window: QuotaWindowKind;
  readonly limit: number;
  readonly remaining: number;
}

export type ReservationDecision =
  | {
      readonly outcome: 'allowed';
      readonly sourceId: RealProviderSourceId;
      readonly ledger: ReservationLedger;
      readonly headroom: readonly WindowHeadroom[];
    }
  | {
      readonly outcome: 'deferred';
      readonly sourceId: RealProviderSourceId;
      /** Unchanged: a denied reservation mutates no window. */
      readonly ledger: ReservationLedger;
      readonly retryAt: string;
      readonly limitingWindows: readonly LimitingWindow[];
      readonly headroom: readonly WindowHeadroom[];
    };

export class ReservationSourceMismatchError extends Error {
  constructor(
    readonly expected: RealProviderSourceId,
    readonly received: unknown,
  ) {
    super(
      `Reservation for "${String(received)}" cannot use "${expected}" state.`,
    );
    this.name = 'ReservationSourceMismatchError';
  }
}

export function emptyLedger(sourceId: RealProviderSourceId): ReservationLedger {
  return { sourceId, timestamps: [] };
}

function longestWindowMillis(policy: ProviderQuotaPolicy): number {
  return policy.windows.reduce(
    (longest, window) => Math.max(longest, window.durationSeconds * 1000),
    0,
  );
}

/**
 * Drops timestamps that have expired against the longest window and discards
 * anything not a finite number. Never adds a timestamp: a reconciliation can
 * only forget real observations, never invent them.
 */
function prune(
  timestamps: readonly number[],
  policy: ProviderQuotaPolicy,
  atMillis: number,
): number[] {
  const horizon = atMillis - longestWindowMillis(policy);
  return timestamps
    .filter(
      (value) =>
        typeof value === 'number' && Number.isFinite(value) && value > horizon,
    )
    .sort((left, right) => left - right);
}

/**
 * Reconciles a stored ledger against the current typed policy.
 *
 * Because state is a list of observations rather than per-window counters,
 * reconciliation is only a re-prune: a shortened window forgets history it may
 * no longer count, and a lengthened one simply has less history than it could.
 * No fictitious reservation is ever created.
 */
export function reconcileLedger(
  ledger: ReservationLedger,
  sourceId: RealProviderSourceId,
  at: Date,
): ReservationLedger {
  if (ledger.sourceId !== sourceId) {
    throw new ReservationSourceMismatchError(sourceId, ledger.sourceId);
  }
  return {
    sourceId,
    timestamps: prune(
      ledger.timestamps,
      quotaPolicyFor(sourceId),
      at.getTime(),
    ),
  };
}

/**
 * Attempts one reservation.
 *
 * Admission is all-or-nothing: the timestamp counts simultaneously against
 * every window the source declares, and if any window is exhausted no window
 * is mutated.
 *
 * `policy` is injected so the engine stays pure and a policy change is
 * directly testable. The production path always passes `quotaPolicyFor(...)`.
 */
export function reserve(
  ledger: ReservationLedger,
  policy: ProviderQuotaPolicy,
  at: Date,
): ReservationDecision {
  if (ledger.sourceId !== policy.sourceId) {
    throw new ReservationSourceMismatchError(ledger.sourceId, policy.sourceId);
  }
  if (!isRealProviderSourceId(policy.sourceId)) {
    throw new ReservationSourceMismatchError(ledger.sourceId, policy.sourceId);
  }
  const sourceId = policy.sourceId;
  const atMillis = at.getTime();
  const active = prune(ledger.timestamps, policy, atMillis);
  const prunedLedger: ReservationLedger = { sourceId, timestamps: active };

  const headroom: WindowHeadroom[] = [];
  const limitingWindows: LimitingWindow[] = [];

  for (const window of policy.windows) {
    const durationMillis = window.durationSeconds * 1000;
    const windowStart = atMillis - durationMillis;
    // `active` is ascending, so the in-window slice is its tail.
    const inWindow = active.filter((value) => value > windowStart);
    const remaining = Math.max(0, window.limit - inWindow.length);
    headroom.push({
      window: window.window,
      limit: window.limit,
      remaining,
    });
    if (inWindow.length < window.limit) continue;

    // Capacity returns once enough of the oldest in-window reservations have
    // expired. The (count - limit + 1)-th oldest is the one that must go.
    const index = inWindow.length - window.limit;
    const blocking = inWindow[index];
    if (blocking === undefined) continue;
    limitingWindows.push({
      window: window.window,
      limit: window.limit,
      retryAt: new Date(blocking + durationMillis).toISOString(),
    });
  }

  if (limitingWindows.length > 0) {
    // Every window's capacity is non-decreasing while no new reservation is
    // added, so the latest limiting window's boundary is the first instant at
    // which *all* windows can admit the request.
    const retryAt = limitingWindows.reduce(
      (latest, window) =>
        Date.parse(window.retryAt) > Date.parse(latest)
          ? window.retryAt
          : latest,
      limitingWindows[0]!.retryAt,
    );
    return {
      outcome: 'deferred',
      sourceId,
      ledger: prunedLedger,
      retryAt,
      limitingWindows,
      headroom,
    };
  }

  return {
    outcome: 'allowed',
    sourceId,
    ledger: { sourceId, timestamps: [...active, atMillis] },
    headroom: headroom.map((window) => ({
      ...window,
      remaining: Math.max(0, window.remaining - 1),
    })),
  };
}
