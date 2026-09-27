/**
 * The per-run reservation pacer (runtime activation decision O-11).
 *
 * The Jolpica limiter admits four requests per second and never waits
 * (ADR 0021 D1.10). A coordinated run issues its requests one after another,
 * so without local pacing a burst of fast answers would defer itself on the
 * second window, and one deferred resource withholds the whole season.
 *
 * This decorator spaces its own reservations by at least
 * `minimumReservationSpacingMillis` **before** asking the limiter. It changes
 * nothing else:
 *
 * - The global limiter stays the only authority. Every reservation still asks
 *   it exactly once, so a deferral caused by another isolate, the cron or a
 *   manual run is still honoured.
 * - **A deferral is final for that attempt.** The answer is returned as is.
 *   The pacer never re-asks the limiter, waits for `retryAt` or retries, so a
 *   deferred reservation stays a not-attempted request.
 * - A limiter that throws or answers `unavailable` fails closed exactly as it
 *   would without the pacer. The hardened HTTP client handles both.
 *
 * One pacer is built per run and shared by every port in it. Reservations are
 * serialized, so two concurrent callers cannot both skip the spacing.
 */

import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from './provider-rate-limiter';
import type { RealProviderSourceId } from './reservation-engine';

/** The smallest spacing the pacer accepts: just above 1000 ms / 4 requests. */
export const minimumReservationSpacingMillis = 260;

export type PacerSleep = (millis: number) => Promise<void>;

export interface PacedReservationClientOptions {
  /** The limiter client every reservation is still decided by. */
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
  private turn: Promise<unknown> = Promise.resolve();

  constructor(options: PacedReservationClientOptions) {
    const spacing = options.spacingMillis ?? minimumReservationSpacingMillis;
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

  private async reserveInTurn(
    sourceId: RealProviderSourceId,
  ): Promise<ReservationOutcome> {
    if (this.lastReservationAt !== null) {
      const remaining =
        this.lastReservationAt + this.spacingMillis - this.now().getTime();
      if (remaining > 0) await this.sleep(remaining);
    }
    this.lastReservationAt = this.now().getTime();
    // Exactly one question per reservation, and its answer is final.
    return this.limiter.reserve(sourceId);
  }
}
