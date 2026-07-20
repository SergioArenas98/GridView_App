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
import type { QuotaState, SyncJobCategory } from '../storage/types';

export interface ProviderStatus {
  status: 'ok' | 'degraded' | 'rate_limited' | 'unavailable';
  quota: QuotaState;
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
  quota: QuotaState;
}

export interface FormulaOneProvider {
  readonly name: string;
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
