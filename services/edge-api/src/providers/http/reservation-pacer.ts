/**
 * The per-run reservation pacer (runtime activation decision O-11).
 *
 * A coordinated run issues its requests one after another, and the global
 * limiter never waits (ADR 0021 D1.10). This decorator spaces its own
 * reservations by `spacingMillis` **before** asking the limiter, and stops the
 * run's requests once the provider has said `429`:
 *
 * - **Spacing.** The default is `defaultReservationSpacingMillis`, one request
 *   per second. Jolpica publishes four per second, but on 2026-11-03 it
 *   answered `429` to staging at that pace (AU-4 step 2), so one per second is
 *   a conservative starting point, not a verified safe rate. Anything at or
 *   above `minimumReservationSpacingMillis` is accepted.
 * - **Upstream hold.** `recordRateLimited` (called by the HTTP boundary on a
 *   `429`) holds this pacer until `upstreamHoldUntil(now, retryAfter)` and
 *   forwards the report to the limiter, whose own hold then covers every other
 *   run. While the pacer is held it answers `deferred` (`cause:
 *   'provider-hold'`) **without asking the limiter**, so a lost report cannot
 *   let the rest of the run reach the provider.
 * - The global limiter stays the authority for everything else: every
 *   reservation outside a hold asks it exactly once, and its answer is final.
 *   The pacer never re-asks, waits for `retryAt` or retries, so a deferred
 *   reservation stays a not-attempted request.
 * - A limiter that throws or answers `unavailable` fails closed exactly as it
 *   would without the pacer. The hardened HTTP client handles both.
 *
 * One pacer is built per run and shared by every port in it. Reservations are
 * serialized, so two concurrent callers cannot both skip the spacing.
 */

import {
  upstreamHoldUntil,
  type ProviderRateLimiterClient,
  type ReservationOutcome,
} from './provider-rate-limiter';
import type { RealProviderSourceId } from './reservation-engine';

/** The smallest spacing the pacer accepts: just above 1000 ms / 4 requests. */
export const minimumReservationSpacingMillis = 260;

/** The spacing a run uses unless told otherwise: one request per second. */
export const defaultReservationSpacingMillis = 1000;

export type PacerSleep = (millis: number) => Promise<void>;

export interface PacedReservationClientOptions {
  /** The limiter client every reservation outside a hold is decided by. */
  readonly limiter: ProviderRateLimiterClient;
  /** The run's clock. */
  readonly now: () => Date;
  /** Waits out the remaining spacing. Defaults to a timer. */
  readonly sleep?: PacerSleep;
  /** At least `minimumReservationSpacingMillis`. */
  readonly spacingMillis?: number;
}

const timerSleep: PacerSleep = (millis) =>
  new Promise((resolve) => setTimeout(resolve, millis));

export class PacedReservationClient implements ProviderRateLimiterClient {
  private readonly limiter: ProviderRateLimiterClient;
  private readonly now: () => Date;
  private readonly sleep: PacerSleep;
  private readonly spacingMillis: number;
  private lastReservationAt: number | null = null;
  private readonly heldUntil = new Map<RealProviderSourceId, number>();
  private turn: Promise<unknown> = Promise.resolve();

  constructor(options: PacedReservationClientOptions) {
    const spacing = options.spacingMillis ?? defaultReservationSpacingMillis;
    if (
      !Number.isSafeInteger(spacing) ||
      spacing < minimumReservationSpacingMillis
    ) {
      throw new RangeError(
        `Reservation spacing must be an integer of at least ${minimumReservationSpacingMillis} ms.`,
      );
    }
    this.limiter = options.limiter;
    this.now = options.now;
    this.sleep = options.sleep ?? timerSleep;
    this.spacingMillis = spacing;
  }

  reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    const reservation = this.turn.then(() => this.reserveInTurn(sourceId));
    // The next caller waits for this one however it ends.
    this.turn = reservation.catch(() => undefined);
    return reservation;
  }

  async recordRateLimited(
    sourceId: RealProviderSourceId,
    retryAfter: string | null,
  ): Promise<void> {
    const until = upstreamHoldUntil(this.now(), retryAfter);
    this.heldUntil.set(
      sourceId,
      Math.max(this.heldUntil.get(sourceId) ?? 0, until),
    );
    try {
      await this.limiter.recordRateLimited?.(sourceId, retryAfter);
    } catch {
      // The local hold already stops this run; see the class comment.
    }
  }

  private async reserveInTurn(
    sourceId: RealProviderSourceId,
  ): Promise<ReservationOutcome> {
    const held = this.held(sourceId);
    if (held !== null) return held;
    if (this.lastReservationAt !== null) {
      const remaining =
        this.lastReservationAt + this.spacingMillis - this.now().getTime();
      if (remaining > 0) await this.sleep(remaining);
    }
    this.lastReservationAt = this.now().getTime();
    // Exactly one question per reservation, and its answer is final.
    return this.limiter.reserve(sourceId);
  }

  /** The local deferral while this run is held, or `null`. */
  private held(sourceId: RealProviderSourceId): ReservationOutcome | null {
    const until = this.heldUntil.get(sourceId);
    if (until === undefined || until <= this.now().getTime()) return null;
    return {
      outcome: 'deferred',
      sourceId,
      retryAt: new Date(until).toISOString(),
      limitingWindows: [],
      headroom: [],
      cause: 'provider-hold',
    };
  }
}
