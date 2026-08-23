import type {
  Circuit,
  Constructor,
  ConstructorSeasonEntry,
  ConstructorStanding,
  Driver,
  DriverSeasonEntry,
  DriverStanding,
  GrandPrix,
  RaceResult,
} from '../contract/types';
import type { SyncJobCategory } from '../storage/types';
import type { ProviderRequestMetrics } from './provider-metrics';
import type { ProviderQuotaPolicy, ProviderSourceId } from './provider-source';

export interface ProviderStatus {
  /** Canonical internal source this status describes. Never published. */
  sourceId: ProviderSourceId;
  status: 'ok' | 'degraded' | 'rate_limited' | 'unavailable';
}

export interface ProviderSeasonSource {
  season: number;
  contentVersion: string;
  mediaVersion: string | null;
  attributionVersion: string | null;
  sourceUpdatedAt: string;
  seasonLabel: string | null;
  calendar: GrandPrix[];
  results: RaceResult[];
  drivers: Driver[];
  constructors: Constructor[];
  circuits: Circuit[];
  driverEntries: DriverSeasonEntry[];
  constructorEntries: ConstructorSeasonEntry[];
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
}

export interface FormulaOneProvider {
  /** Human-readable implementation name. Never an identity input. */
  readonly name: string;
  /**
   * Canonical internal source identity (gap G6). Identity comes from this
   * typed value, never from `name` or any other free-form string, and never
   * reaches a public v1 DTO.
   */
  readonly sourceId: ProviderSourceId;
  /**
   * The published rate-limit windows GridView models locally for this source.
   * Nothing is read from a provider response: neither adopted source returns
   * quota headers (GridView_Provider_Evaluation.md §8.6).
   */
  readonly quotaPolicy: ProviderQuotaPolicy;
  /**
   * Typed request accounting. Required, so an implementation that forgets
   * telemetry fails to compile instead of silently reporting zero.
   */
  requestMetrics(): ProviderRequestMetrics;
  fetchSeasonSource(
    season: number,
    jobs: SyncJobCategory[],
  ): Promise<ProviderSeasonSource>;
  getProviderStatus(): Promise<ProviderStatus>;
}

export class ProviderError extends Error {
  constructor(
    readonly category: string,
    message = 'Provider operation failed.',
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ProviderRateLimitedError extends ProviderError {
  constructor(readonly retryAfter: string) {
    super('provider-rate-limited', 'Provider rate limit reached.');
    this.name = 'ProviderRateLimitedError';
  }
}
