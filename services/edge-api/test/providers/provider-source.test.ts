import { describe, expect, it } from 'vitest';

import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import {
  isProviderSourceId,
  providerSourceIds,
  quotaPolicyFor,
  type ProviderSourceId,
} from '../../src/providers/provider-source';
import { FixedClock } from '../../src/runtime/clock';

describe('canonical provider source identity', () => {
  it('covers exactly mock, jolpica and openf1', () => {
    expect([...providerSourceIds]).toEqual(['mock', 'jolpica', 'openf1']);
    expect(isProviderSourceId('jolpica')).toBe(true);
    expect(isProviderSourceId('mock-development-provider')).toBe(false);
    expect(isProviderSourceId('')).toBe(false);
    expect(isProviderSourceId(undefined)).toBe(false);
  });

  it('gives the mock provider a typed source id independent of its display name', () => {
    const provider = new MockFormulaOneProvider({
      clock: new FixedClock(new Date('2026-07-20T12:00:00.000Z')),
    });

    // Identity is the typed value, never the free-form name.
    const sourceId: ProviderSourceId = provider.sourceId;
    expect(sourceId).toBe('mock');
    expect(provider.name).toBe('mock-development-provider');
    expect(provider.quotaPolicy.sourceId).toBe('mock');
  });
});

describe('published quota window policies', () => {
  it('models OpenF1 as per-second burst and per-minute sustained', () => {
    const policy = quotaPolicyFor('openf1');

    expect(policy.testOnly).toBe(false);
    expect(
      policy.windows.map((window) => [
        window.window,
        window.windowClass,
        window.limit,
      ]),
    ).toEqual([
      ['second', 'burst', 3],
      ['minute', 'sustained', 30],
    ]);
  });

  it('models Jolpica as per-second burst and per-hour sustained', () => {
    const policy = quotaPolicyFor('jolpica');

    expect(policy.testOnly).toBe(false);
    expect(
      policy.windows.map((window) => [
        window.window,
        window.windowClass,
        window.limit,
      ]),
    ).toEqual([
      ['second', 'burst', 4],
      ['hour', 'sustained', 500],
    ]);
  });

  it('assumes no daily limit for any adopted source', () => {
    for (const sourceId of providerSourceIds) {
      const policy = quotaPolicyFor(sourceId);
      expect(policy.windows.length).toBeGreaterThan(0);
      for (const window of policy.windows) {
        // Neither adopted source publishes a daily figure, so no modelled
        // window may span a day or longer.
        expect(window.durationSeconds).toBeLessThan(86_400);
        expect(['second', 'minute', 'hour']).toContain(window.window);
      }
    }
  });

  it('marks only the mock limits as test-only', () => {
    expect(quotaPolicyFor('mock').testOnly).toBe(true);
    expect(quotaPolicyFor('jolpica').testOnly).toBe(false);
    expect(quotaPolicyFor('openf1').testOnly).toBe(false);

    // The mock fixture must not restate a published figure from either source.
    const mockLimits = quotaPolicyFor('mock')
      .windows.map((window) => window.limit)
      .join(',');
    expect(mockLimits).not.toBe('3,30');
    expect(mockLimits).not.toBe('4,500');
  });
});
