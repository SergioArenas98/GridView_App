import { describe, expect, it } from 'vitest';

import { resolveEnvironment } from '../src/config/environment';

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
