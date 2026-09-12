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
 * bound in the running environment, every reservation resolves to
 * `unavailable`, and the HTTP boundary then issues no provider request.
 * Binding availability is environment-specific (see
 * `docs/technical/GridView_Environments.md`), and a bound namespace is not
 * what gates provider traffic: `PROVIDER_MODE` and whether a live adapter
 * exists are.
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
