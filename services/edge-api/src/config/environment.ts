const validEnvironments = ['development', 'staging', 'production'] as const;

export type EnvironmentName = (typeof validEnvironments)[number];

/** Bindings and variables available to the Worker. */
export interface Env {
  ENVIRONMENT: string;
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
