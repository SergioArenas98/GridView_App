/**
 * The coordinated sync entry point skeleton: the manual/scheduled run kinds
 * (O-8), and the fact that no run sends anything in this change, however many
 * dependencies are bound.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import type { ProviderRateLimiterClient } from '../../../src/providers/http/provider-rate-limiter';
import { FixedClock } from '../../../src/runtime/clock';
import type { CoordinatedRuntimeDependencies } from '../../../src/sync/coordinated/composition';
import { resolveReconciliationLedger } from '../../../src/sync/coordinated/ledger-port';
import {
  coordinatedRunKind,
  runCoordinatedSync,
} from '../../../src/sync/coordinated/run';

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function dependencies(
  overrides: Partial<CoordinatedRuntimeDependencies>,
): CoordinatedRuntimeDependencies & {
  reservations: () => number;
  requests: () => number;
} {
  let reservations = 0;
  let requests = 0;
  const limiter: ProviderRateLimiterClient = {
    reserve: async (sourceId) => {
      reservations += 1;
      return { outcome: 'allowed', sourceId, headroom: [] };
    },
  };
  return {
    limiter,
    authorityMode: 'sequencer',
    guarded: {
      publishGuarded: async () => {
        throw new Error('not reached');
      },
    },
    purgeOrigin: 'https://api.gridview.test',
    ledger: resolveReconciliationLedger(),
    transport: async () => {
      requests += 1;
      return new Response('{}', { status: 503 });
    },
    logger: new CapturingLogger(),
    clock: new FixedClock(new Date('2026-09-27T12:00:00.000Z')),
    ...overrides,
    reservations: () => reservations,
    requests: () => requests,
  };
}

describe('coordinated run kinds (O-8)', () => {
  it('makes a manual run a forced publication run that never advances the schedule', () => {
    expect(coordinatedRunKind('manual')).toEqual({
      trigger: 'manual',
      forcedPublication: true,
      advancesSchedule: false,
    });
    expect(coordinatedRunKind('scheduled')).toEqual({
      trigger: 'scheduled',
      forcedPublication: false,
      advancesSchedule: true,
    });
    expect(Object.isFrozen(coordinatedRunKind('manual'))).toBe(true);
  });
});

describe('runCoordinatedSync', () => {
  it('has no ledger to bind, so both triggers stop at ledger-unbound', async () => {
    expect(resolveReconciliationLedger()).toBeNull();
    for (const trigger of ['scheduled', 'manual'] as const) {
      const input = dependencies({});
      const outcome = await runCoordinatedSync(
        { season: 2026, trigger },
        input,
      );
      expect(outcome).toEqual({
        status: 'coordinated-runtime-unavailable',
        season: 2026,
        run: coordinatedRunKind(trigger),
        reasons: ['ledger-unbound'],
        providerRequests: 0,
      });
      expect(input.reservations()).toBe(0);
      expect(input.requests()).toBe(0);
    }
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('sends nothing even when composed over a synthetic ledger: there is no planner', async () => {
    const input = dependencies({ ledger: { ledger: 'reconciliation' } });
    const outcome = await runCoordinatedSync(
      { season: 2026, trigger: 'manual' },
      input,
    );

    expect(outcome).toEqual({
      status: 'not-planned',
      season: 2026,
      run: coordinatedRunKind('manual'),
      providerRequests: 0,
    });
    expect(input.reservations()).toBe(0);
    expect(input.requests()).toBe(0);
    expect(globalFetch).not.toHaveBeenCalled();
  });
});
