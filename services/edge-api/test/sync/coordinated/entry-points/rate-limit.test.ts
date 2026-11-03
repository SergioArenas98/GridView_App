/**
 * A provider `429` during a coordinated publication run, through the real
 * Worker entry points (AU-4 step 2, 2026-11-03).
 *
 * On staging, Jolpica answered `429` to 20 of 23 requests: the run kept
 * asking, one request every ~260 ms, because nothing told the pacer or the
 * limiter that the provider had refused. These tests pin the fix end to end:
 *
 * - the run sends nothing after the first `429`, and publishes nothing;
 * - the hold reaches every later run through the limiter object - a
 *   scheduled tick plans nothing, a manual run asks the limiter and sends
 *   nothing;
 * - once the hold ends, a run observes everything again and publishes a
 *   complete release.
 *
 * The limiter is the real `ReservationCoordinator` over an in-memory host,
 * not a scripted double, so the hold is the object's own.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ReservationCoordinator,
  type ProviderRateLimiterClient,
  type ReservationHost,
} from '../../../../src/providers/http/provider-rate-limiter';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { sequencerTransports } from '../../../publication/sequenced/support';
import { paced, paths, seasonPaths, tickAfter } from '../observation/support';
import {
  EntryPointHarness,
  HOUR,
  MINUTE,
  later,
  linesOf,
  type LedgerBinding,
} from './support';

const injected = vi.hoisted(() => ({
  ledger: null as null | (() => unknown),
}));

vi.mock(
  '../../../../src/sync/coordinated/ledger-port',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/sync/coordinated/ledger-port')
      >();
    return {
      ...actual,
      resolveReconciliationLedger: () =>
        (injected.ledger?.() ?? null) as ReconciliationLedgerPort | null,
    };
  },
);

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  injected.ledger = null;
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  expect(globalFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

const bind = (binding: LedgerBinding) => {
  injected.ledger = binding;
};

/** In-memory `DurableObjectState`, serializing like the runtime gate. */
class MemoryHost implements ReservationHost {
  private readonly values = new Map<string, unknown>();
  private queue: Promise<unknown> = Promise.resolve();
  storage = {
    get: async <T>(key: string): Promise<T | undefined> =>
      this.values.get(key) as T | undefined,
    put: async <T>(key: string, value: T): Promise<void> => {
      this.values.set(key, structuredClone(value));
    },
  };
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    const next = this.queue.then(callback);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

/** The Worker's limiter: the real object logic on the harness clock. */
function realLimiter(harness: EntryPointHarness): {
  readonly client: ProviderRateLimiterClient;
  readonly asked: string[];
} {
  const coordinator = new ReservationCoordinator(new MemoryHost(), () =>
    harness.clock.now(),
  );
  const asked: string[] = [];
  return {
    asked,
    client: {
      reserve: async (sourceId) => {
        asked.push(harness.clock.now().toISOString());
        return coordinator.reserve(sourceId);
      },
      recordRateLimited: async (sourceId, retryAfter) => {
        await coordinator.recordRateLimit(sourceId, retryAfter);
      },
    },
  };
}

describe.each(sequencerTransports)(
  'a provider 429 during a publication run, over the %s transport',
  (transport) => {
    it('stops the run at the first 429, holds every later run until Retry-After, then publishes a complete release', async () => {
      const harness = await EntryPointHarness.create(transport, bind);
      const limiter = realLimiter(harness);
      (
        harness.env as { __PROVIDER_RATE_LIMITER?: unknown }
      ).__PROVIDER_RATE_LIMITER = limiter.client;
      const release = await harness.published();
      harness.server.results.set(1, 'A');

      // The third request of the run - the drivers - is refused for two hours.
      harness.server.answers.set(paths.drivers, () => ({
        kind: 'status',
        status: 429,
        headers: { 'Retry-After': String(2 * 60 * 60) },
      }));
      const at = tickAfter(1, 6);
      const refusedAt = paced(at, 3);
      const holdUntil = later(refusedAt, 2 * HOUR);

      // 1. The run: three requests, then nothing.
      const refused = await harness.manual(at);

      expect(refused.status).toBe(200);
      expect(refused.requests).toEqual(seasonPaths.slice(0, 3));
      expect(linesOf(refused, 'provider.request.rate_limited')).toHaveLength(1);
      expect(refused.body.data).toMatchObject({
        status: 'observed',
        plan: 'publication',
        providerRequests: 3,
        events: { 'classification.check-deferred': 1 },
        publication: { outcome: 'withheld', publishCalls: 0 },
      });
      // The participants resource ends at its failed first request (drivers,
      // so constructors is never asked for); the three resources after it -
      // both standings tables and round 1 - are deferred by the hold, not sent.
      const deferred = linesOf(refused, 'provider.reservation.deferred');
      expect(deferred).toHaveLength(3);
      for (const line of deferred) {
        expect(line).toMatchObject({
          providerDeferralCause: 'provider-hold',
          providerRetryAt: holdUntil,
          providerRequestAttempted: false,
        });
      }
      // Nothing incomplete was published.
      expect([refused.prepares, refused.storageWrites]).toEqual([0, 0]);
      expect(harness.activeVersion()).toBe(release);
      expect((await harness.round(1))?.limiterDeferralUntil).toBe(holdUntil);

      harness.server.answers.delete(paths.drivers);

      // 2. A scheduled tick inside the hold plans nothing and asks nothing.
      const askedBefore = limiter.asked.length;
      const tick = await harness.scheduled(later(at, HOUR));
      expect(tick.requests).toEqual([]);
      expect(limiter.asked).toHaveLength(askedBefore);
      expect(
        linesOf(tick, 'sync.coordinated.observation').at(-1),
      ).toMatchObject({
        coordinationStatus: 'nothing-due',
      });

      // 3. A manual run inside the hold - a fresh pacer, as a new run builds -
      //    asks the limiter object, which defers it: nothing is sent.
      const manual = await harness.manual(later(at, HOUR + MINUTE));
      expect(manual.requests).toEqual([]);
      expect(manual.body.data).toMatchObject({
        providerRequests: 0,
        publication: { outcome: 'withheld', publishCalls: 0 },
      });
      expect([manual.prepares, manual.storageWrites]).toEqual([0, 0]);
      expect(harness.activeVersion()).toBe(release);

      // 4. After the hold, a run observes everything and publishes it.
      const recovered = await harness.manual(later(holdUntil, MINUTE));
      expect(recovered.requests).toEqual([...seasonPaths, paths.results(1)]);
      expect(recovered.body.data).toMatchObject({
        providerRequests: 7,
        publication: { outcome: 'published' },
      });
      expect(harness.activeVersion()).not.toBe(release);
      expect((await harness.round(1))?.limiterDeferralUntil).toBeNull();
    });

    it('stops a run whose 429 carries no Retry-After for the minimum hold', async () => {
      const harness = await EntryPointHarness.create(transport, bind);
      const limiter = realLimiter(harness);
      (
        harness.env as { __PROVIDER_RATE_LIMITER?: unknown }
      ).__PROVIDER_RATE_LIMITER = limiter.client;
      const release = await harness.published();
      harness.server.results.set(1, 'A');
      // As on staging: the very first request after the calendar is refused.
      harness.server.answers.set(paths.circuits, () => ({
        kind: 'status',
        status: 429,
      }));
      const at = tickAfter(1, 6);

      const refused = await harness.manual(at);

      expect(refused.requests).toEqual([paths.calendar, paths.circuits]);
      expect(refused.body.data).toMatchObject({
        providerRequests: 2,
        publication: { outcome: 'withheld', publishCalls: 0 },
      });
      expect((await harness.round(1))?.limiterDeferralUntil).toBe(
        later(paced(at, 2), MINUTE),
      );
      expect(harness.activeVersion()).toBe(release);
    });
  },
);
