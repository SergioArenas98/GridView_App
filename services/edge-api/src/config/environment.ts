const validEnvironments = ['development', 'staging', 'production'] as const;
const validProviderModes = ['mock', 'none'] as const;

export type EnvironmentName = (typeof validEnvironments)[number];
export type ProviderMode = (typeof validProviderModes)[number];

interface TestOnlyBindings {
  __LOCAL_STORAGE?: import('../storage/types').SnapshotStorage;
  __CLOCK?: import('../runtime/clock').Clock;
  __LOGGER?: import('../logging/logger').Logger;
  __PROVIDER?: import('../providers/formula-one-provider').FormulaOneProvider;
  __CACHE_PURGER?: import('../cache/purge').CachePurgeAdapter;
  __SNAPSHOT_VALIDATOR?: import('../validation/snapshot-validator').SnapshotValidator;
}

/** Bindings and variables available to the Worker. */
export interface Env extends TestOnlyBindings {
  ENVIRONMENT?: string;
  PROVIDER_MODE?: string;
  PUBLIC_BASE_URL?: string;
  ADMIN_TOKEN?: string;
  MOCK_PROVIDER_FAILURE?: string;
  MOCK_PROVIDER_INVALID_DATA?: string;
  MOCK_PROVIDER_SOURCE_UPDATED_AT?: string;
  MOCK_PROVIDER_CONTENT_VERSION?: string;
  GRIDVIEW_DATA?: KVNamespace;
}

/**
 * Resolves the configured environment name.
 *
 * Unknown or missing values fall back to `development` so a misconfigured
 * deployment can never report itself as production.
 */
export function resolveEnvironment(value: string | undefined): EnvironmentName {
  if ((validEnvironments as readonly string[]).includes(value ?? '')) {
    return value as EnvironmentName;
  }
  console.warn(
    `Unknown ENVIRONMENT value "${value ?? ''}"; falling back to "development"`,
  );
  return 'development';
}

export interface RuntimeConfig {
  environment: EnvironmentName;
  providerMode: ProviderMode;
  publicBaseUrl: string | null;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function resolveProviderMode(
  value: string | undefined,
  environment: EnvironmentName,
): ProviderMode {
  if (value === undefined) {
    if (environment === 'production') return 'none';
    if (environment === 'development') return 'mock';
    throw new ConfigurationError(
      'PROVIDER_MODE must be set explicitly for staging.',
    );
  }
  const mode = value;
  if (!(validProviderModes as readonly string[]).includes(mode)) {
    throw new ConfigurationError(`Unknown PROVIDER_MODE "${mode}".`);
  }
  if (environment === 'production' && mode === 'mock') {
    throw new ConfigurationError(
      'The mock provider cannot be selected in production.',
    );
  }
  return mode as ProviderMode;
}

export function resolveRuntimeConfig(env: Env): RuntimeConfig {
  const environment = resolveEnvironment(env.ENVIRONMENT);
  return {
    environment,
    providerMode: resolveProviderMode(env.PROVIDER_MODE, environment),
    publicBaseUrl: resolvePublicBaseUrl(env.PUBLIC_BASE_URL, environment),
  };
}

function resolvePublicBaseUrl(
  value: string | undefined,
  environment: EnvironmentName,
): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      throw new ConfigurationError('PUBLIC_BASE_URL must use https.');
    }
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new ConfigurationError(`Invalid PUBLIC_BASE_URL for ${environment}.`);
  }
}
