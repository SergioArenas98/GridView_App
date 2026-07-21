import { describe, expect, it } from 'vitest';

import {
  resolveEnvironment,
  resolveProviderMode,
  resolveRuntimeConfig,
} from '../src/config/environment';
import { resolveStorage } from '../src/storage/factory';

describe('resolveEnvironment', () => {
  it('accepts the three known environments', () => {
    expect(resolveEnvironment('development')).toBe('development');
    expect(resolveEnvironment('staging')).toBe('staging');
    expect(resolveEnvironment('production')).toBe('production');
  });

  it('falls back to development for unknown or missing values', () => {
    expect(resolveEnvironment(undefined)).toBe('development');
    expect(resolveEnvironment('')).toBe('development');
    expect(resolveEnvironment('prod')).toBe('development');
    expect(resolveEnvironment('PRODUCTION')).toBe('development');
  });
});

describe('runtime configuration', () => {
  it('requires staging to select the provider mode explicitly', () => {
    expect(() => resolveRuntimeConfig({ ENVIRONMENT: 'staging' })).toThrow(
      'PROVIDER_MODE',
    );
    expect(
      resolveRuntimeConfig({
        ENVIRONMENT: 'staging',
        PROVIDER_MODE: 'mock',
      }).providerMode,
    ).toBe('mock');
  });

  it('does not make mock mode a production default', () => {
    expect(() => resolveProviderMode('mock', 'production')).toThrow(
      'mock provider',
    );
    expect(resolveProviderMode(undefined, 'production')).toBe('none');
  });

  it('normalizes an HTTPS public base URL when configured', () => {
    expect(
      resolveRuntimeConfig({
        ENVIRONMENT: 'staging',
        PROVIDER_MODE: 'mock',
        PUBLIC_BASE_URL: 'https://gridview-api-staging.example.workers.dev/v1',
      }).publicBaseUrl,
    ).toBe('https://gridview-api-staging.example.workers.dev');
    expect(() =>
      resolveRuntimeConfig({
        ENVIRONMENT: 'staging',
        PROVIDER_MODE: 'mock',
        PUBLIC_BASE_URL: 'http://gridview-api-staging.example.workers.dev',
      }),
    ).toThrow('https');
  });
});

describe('storage resolution', () => {
  it('fails safely in staging when the KV binding is absent', () => {
    expect(() =>
      resolveStorage({ ENVIRONMENT: 'staging', PROVIDER_MODE: 'mock' }),
    ).toThrow('GRIDVIEW_DATA');
  });
});
