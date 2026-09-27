import type { Env, RuntimeConfig } from '../config/environment';
import type { Clock } from '../runtime/clock';
import type { FormulaOneProvider } from './formula-one-provider';
import { MockFormulaOneProvider } from './mock/mock-provider';

export function resolveProvider(
  env: Env,
  config: RuntimeConfig,
  clock: Clock,
): FormulaOneProvider | null {
  if (env.__PROVIDER) return env.__PROVIDER;
  // Only `mock` builds a provider. Every other mode gets none: this seam is
  // the whole-season provider path, and no other mode may run through it.
  if (config.providerMode !== 'mock') return null;
  return new MockFormulaOneProvider({
    clock,
    failureMode:
      env.MOCK_PROVIDER_FAILURE === 'rate_limited'
        ? 'rate_limited'
        : env.MOCK_PROVIDER_FAILURE === 'failure'
          ? 'failure'
          : 'none',
    invalidData: env.MOCK_PROVIDER_INVALID_DATA === 'true',
    sourceUpdatedAt: env.MOCK_PROVIDER_SOURCE_UPDATED_AT,
    contentVersion: env.MOCK_PROVIDER_CONTENT_VERSION,
  });
}
