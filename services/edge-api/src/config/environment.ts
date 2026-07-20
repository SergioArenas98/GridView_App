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
  ADMIN_TOKEN?: string;
  MOCK_PROVIDER_FAILURE?: string;
  MOCK_PROVIDER_INVALID_DATA?: string;
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
  const mode = value ?? (environment === 'production' ? 'none' : 'mock');
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
  };
}
