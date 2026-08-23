import type { Env } from '../../config/environment';
import {
  DurableObjectRateLimiterClient,
  type ProviderRateLimiterClient,
  type ReservationOutcome,
} from './provider-rate-limiter';
import type { RealProviderSourceId } from './reservation-engine';

/**
 * Resolves the reservation client for the running environment.
 *
 * Fails closed by construction: when the Durable Object namespace is not
 * bound — which is the case in every environment today, because nothing has
 * been provisioned or deployed — every reservation resolves to `unavailable`,
 * and the HTTP boundary then issues no provider request.
 */
export function resolveProviderRateLimiter(
  env: Env,
): ProviderRateLimiterClient {
  if (env.__PROVIDER_RATE_LIMITER) return env.__PROVIDER_RATE_LIMITER;
  if (env.PROVIDER_RATE_LIMITER) {
    return new DurableObjectRateLimiterClient(env.PROVIDER_RATE_LIMITER);
  }
  return unboundRateLimiter;
}

/**
 * The fail-closed client used when no namespace is bound. It never permits a
 * request; it does not silently allow one.
 */
export const unboundRateLimiter: ProviderRateLimiterClient = {
  async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    return { outcome: 'unavailable', sourceId, reason: 'limiter-unreachable' };
  },
};
