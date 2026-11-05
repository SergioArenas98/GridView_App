/**
 * The per-run reservation pacer (runtime activation decision O-11): one second
 * between its own reservations by default (never less than 260 ms), one
 * limiter question per reservation, a deferral that is final for its attempt,
 * and an upstream hold after a provider `429` (AU-4 step 2, 2026-11-03).
 */

import { describe, expect, it } from 'vitest';

import {
  maximumUpstreamHoldMillis,
  minimumUpstreamHoldMillis,
  ReservationCoordinator,
  upstreamHoldUntil,
  type ProviderRateLimiterClient,
  type ReservationHost,
  type ReservationOutcome,
} from '../../src/providers/http/provider-rate-limiter';
import {
  defaultReservationSpacingMillis,
  minimumReservationSpacingMillis,
  PacedReservationClient,
  statedJolpicaRequestsPerMinute,
} from '../../src/providers/http/reservation-pacer';
import { providerRequestTimeoutMillis } from '../../src/providers/http/provider-http-client';
import { COORDINATION_DEADLINE_MS } from '../../src/sync/coordinated/run-budget';
import type { RealProviderSourceId } from '../../src/providers/http/reservation-engine';
import { MutableClock } from '../publication/sequencer/support';

const START = '2026-09-27T12:00:00.000Z';

/** A limiter that records when it was asked and answers from a script. */
class ScriptedLimiter implements ProviderRateLimiterClient {
  readonly askedAt: number[] = [];

  constructor(
    private readonly clock: MutableClock,
    private readonly answer: (
      call: number,
      sourceId: RealProviderSourceId,
    ) => ReservationOutcome = (_call, sourceId) => ({
      outcome: 'allowed',
      sourceId,
      headroom: [],
    }),
  ) {}

  async reserve(sourceId: RealProviderSourceId): Promise<ReservationOutcome> {
    this.askedAt.push(this.clock.now().getTime());
    return this.answer(this.askedAt.length, sourceId);
  }
}

/** A sleep that advances the run's clock instead of waiting. */
function clockSleep(clock: MutableClock, slept: number[]) {
  return async (millis: number) => {
    slept.push(millis);
    clock.advance(millis);
  };
}

function gaps(times: readonly number[]): number[] {
  return times.slice(1).map((time, index) => time - (times[index] as number));
}

/** In-memory `DurableObjectState` for the real reservation coordinator. */
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

describe('PacedReservationClient', () => {
  it('asks immediately the first time and spaces every later reservation by one second by default', async () => {
    const clock = new MutableClock(new Date(START));
    const limiter = new ScriptedLimiter(clock);
    const slept: number[] = [];
    const pacer = new PacedReservationClient({
      limiter,
      now: () => clock.now(),
      sleep: clockSleep(clock, slept),
    });

    for (let index = 0; index < 5; index += 1) {
      await pacer.reserve('jolpica');
    }

    expect(minimumReservationSpacingMillis).toBe(260);
    expect(defaultReservationSpacingMillis).toBe(3500);
    expect(limiter.askedAt).toHaveLength(5);
    expect(limiter.askedAt[0]).toBe(Date.parse(START));
    for (const gap of gaps(limiter.askedAt)) {
      expect(gap).toBeGreaterThanOrEqual(3500);
    }
    expect(slept).toEqual([3500, 3500, 3500, 3500]);
  });

  it('waits only for what remains of the spacing', async () => {
    const clock = new MutableClock(new Date(START));
    const limiter = new ScriptedLimiter(clock);
    const slept: number[] = [];
    const pacer = new PacedReservationClient({
      limiter,
      now: () => clock.now(),
      sleep: clockSleep(clock, slept),
    });

    await pacer.reserve('jolpica');
    clock.advance(200); // e.g. the request itself took 200 ms
    await pacer.reserve('jolpica');
    clock.advance(400); // still inside the spacing
    await pacer.reserve('jolpica');

    clock.advance(3700); // already past the spacing
    await pacer.reserve('jolpica');

    expect(slept).toEqual([3300, 3100]);
    expect(gaps(limiter.askedAt)).toEqual([3500, 3500, 3700]);
  });

  it('serializes concurrent callers so neither skips the spacing', async () => {
    const clock = new MutableClock(new Date(START));
    const limiter = new ScriptedLimiter(clock);
    const pacer = new PacedReservationClient({
      limiter,
      now: () => clock.now(),
      sleep: clockSleep(clock, []),
    });

    await Promise.all([
      pacer.reserve('jolpica'),
      pacer.reserve('jolpica'),
      pacer.reserve('jolpica'),
    ]);

    expect(gaps(limiter.askedAt)).toEqual([3500, 3500]);
  });

  it('returns a deferral as final, asking the limiter exactly once for it', async () => {
    const clock = new MutableClock(new Date(START));
    const deferred: ReservationOutcome = {
      outcome: 'deferred',
      sourceId: 'jolpica',
      retryAt: '2026-09-27T12:00:01.000Z',
      limitingWindows: [],
      headroom: [],
    };
    const limiter = new ScriptedLimiter(clock, () => deferred);
    const slept: number[] = [];
    const pacer = new PacedReservationClient({
      limiter,
      now: () => clock.now(),
      sleep: clockSleep(clock, slept),
    });

    const outcome = await pacer.reserve('jolpica');

    expect(outcome).toBe(deferred);
    // No re-ask, no wait for `retryAt`, no retry.
    expect(limiter.askedAt).toHaveLength(1);
    expect(slept).toEqual([]);
  });

  it('passes an unavailable limiter and a throwing limiter through unchanged', async () => {
    const clock = new MutableClock(new Date(START));
    const unavailable: ReservationOutcome = {
      outcome: 'unavailable',
      sourceId: 'jolpica',
      reason: 'limiter-unreachable',
    };
    let calls = 0;
    const limiter: ProviderRateLimiterClient = {
      reserve: async () => {
        calls += 1;
        if (calls === 1) throw new Error('limiter down');
        return unavailable;
      },
    };
    const pacer = new PacedReservationClient({
      limiter,
      now: () => clock.now(),
      sleep: clockSleep(clock, []),
    });

    await expect(pacer.reserve('jolpica')).rejects.toThrow('limiter down');
    // A rejected turn does not wedge the next caller.
    await expect(pacer.reserve('jolpica')).resolves.toBe(unavailable);
    expect(calls).toBe(2);
  });

  it('refuses a spacing below 260 ms or a non-integer spacing', () => {
    const limiter: ProviderRateLimiterClient = {
      reserve: async (sourceId) => ({
        outcome: 'allowed',
        sourceId,
        headroom: [],
      }),
    };
    const now = () => new Date(START);
    for (const spacingMillis of [0, 250, 259, 260.5, Number.NaN]) {
      expect(
        () => new PacedReservationClient({ limiter, now, spacingMillis }),
      ).toThrow(RangeError);
    }
    expect(
      () => new PacedReservationClient({ limiter, now, spacingMillis: 300 }),
    ).not.toThrow();
  });

  it('never defers a 29-request plan against a fresh Jolpica limiter, which an unpaced burst does', async () => {
    const paced = async (spacing: boolean) => {
      const clock = new MutableClock(new Date(START));
      const coordinator = new ReservationCoordinator(new MemoryHost(), () =>
        clock.now(),
      );
      const limiter: ProviderRateLimiterClient = {
        reserve: (sourceId) => coordinator.reserve(sourceId),
      };
      const client: ProviderRateLimiterClient = spacing
        ? new PacedReservationClient({
            limiter,
            now: () => clock.now(),
            sleep: clockSleep(clock, []),
          })
        : limiter;
      const outcomes: string[] = [];
      for (let index = 0; index < 29; index += 1) {
        outcomes.push((await client.reserve('jolpica')).outcome);
        clock.advance(5); // a fast answer
      }
      return outcomes;
    };

    expect(new Set(await paced(true))).toEqual(new Set(['allowed']));
    // Non-vacuous: the same plan without the pacer defers on the burst window.
    expect(await paced(false)).toContain('deferred');
  });
});

describe('the upstream hold after a provider 429', () => {
  const at = (offsetMillis: number) =>
    new Date(Date.parse(START) + offsetMillis).toISOString();

  it('lasts at least a minute, honours a longer Retry-After and is capped', () => {
    const now = new Date(START);
    expect(minimumUpstreamHoldMillis).toBe(60_000);
    expect(maximumUpstreamHoldMillis).toBe(6 * 60 * 60 * 1000);
    // No header, a malformed one, or a shorter one (Jolpica sent ~10 s).
    for (const retryAfter of [null, 'not-a-date', at(10_000)]) {
      expect(upstreamHoldUntil(now, retryAfter)).toBe(Date.parse(at(60_000)));
    }
    expect(upstreamHoldUntil(now, at(5 * 60_000))).toBe(
      Date.parse(at(5 * 60_000)),
    );
    expect(upstreamHoldUntil(now, at(48 * 60 * 60_000))).toBe(
      Date.parse(at(maximumUpstreamHoldMillis)),
    );
  });

  it('answers every later reservation of the run locally, without asking the limiter, until it ends', async () => {
    const clock = new MutableClock(new Date(START));
    const limiter = new ScriptedLimiter(clock);
    const reported: (string | null)[] = [];
    (limiter as ProviderRateLimiterClient).recordRateLimited = async (
      _sourceId,
      retryAfter,
    ) => {
      reported.push(retryAfter);
    };
    const slept: number[] = [];
    const pacer = new PacedReservationClient({
      limiter,
      now: () => clock.now(),
      sleep: clockSleep(clock, slept),
    });

    await pacer.reserve('jolpica');
    await pacer.recordRateLimited('jolpica', null);
    const held = [];
    for (let index = 0; index < 20; index += 1) {
      held.push(await pacer.reserve('jolpica'));
    }

    expect(reported).toEqual([null]);
    // One question before the 429, none after it, and no spacing slept.
    expect(limiter.askedAt).toHaveLength(1);
    expect(slept).toEqual([]);
    for (const outcome of held) {
      expect(outcome).toEqual({
        outcome: 'deferred',
        sourceId: 'jolpica',
        retryAt: at(60_000),
        limitingWindows: [],
        headroom: [],
        cause: 'provider-hold',
      });
    }

    clock.set(at(60_000));
    expect((await pacer.reserve('jolpica')).outcome).toBe('allowed');
    expect(limiter.askedAt).toHaveLength(2);
  });

  it('still holds the run when the report to the limiter throws, and only extends', async () => {
    const clock = new MutableClock(new Date(START));
    const limiter = new ScriptedLimiter(clock);
    (limiter as ProviderRateLimiterClient).recordRateLimited = async () => {
      throw new Error('limiter down');
    };
    const pacer = new PacedReservationClient({
      limiter,
      now: () => clock.now(),
      sleep: clockSleep(clock, []),
    });

    await pacer.recordRateLimited('jolpica', at(5 * 60_000));
    await pacer.recordRateLimited('jolpica', null); // shorter: no effect

    const outcome = await pacer.reserve('jolpica');
    expect(outcome).toMatchObject({
      outcome: 'deferred',
      cause: 'provider-hold',
      retryAt: at(5 * 60_000),
    });
    expect(limiter.askedAt).toHaveLength(0);
  });

  it('holds every other run through the limiter object, consuming no window, then admits again', async () => {
    const clock = new MutableClock(new Date(START));
    const coordinator = new ReservationCoordinator(new MemoryHost(), () =>
      clock.now(),
    );
    const limiter: ProviderRateLimiterClient = {
      reserve: (sourceId) => coordinator.reserve(sourceId),
      recordRateLimited: async (sourceId, retryAfter) => {
        await coordinator.recordRateLimit(sourceId, retryAfter);
      },
    };
    const run = () =>
      new PacedReservationClient({
        limiter,
        now: () => clock.now(),
        sleep: clockSleep(clock, []),
      });

    const first = run();
    expect((await first.reserve('jolpica')).outcome).toBe('allowed');
    await first.recordRateLimited('jolpica', at(90_000));

    // A later run - the cron, or a manual run - starts with a fresh pacer.
    clock.set(at(30_000));
    const second = await run().reserve('jolpica');
    expect(second).toMatchObject({
      outcome: 'deferred',
      cause: 'provider-hold',
      retryAt: at(90_000),
      limitingWindows: [],
    });
    // Headroom is reported, and the held reservation consumed none of it.
    expect(second.outcome === 'deferred' && second.headroom).toEqual([
      { window: 'second', limit: 4, remaining: 4 },
      { window: 'hour', limit: 500, remaining: 499 },
    ]);

    clock.set(at(90_000));
    expect((await run().reserve('jolpica')).outcome).toBe('allowed');
  });
});

describe('the default spacing against the stated per-minute limit and the run budget', () => {
  // 6 season resources plus one classification per round; 24 rounds is more
  // than any calendar GridView has recorded, so this is an upper bound.
  const largestRunRequests = 6 + 24;

  it('never puts more than the stated per-minute limit inside any minute', () => {
    // Starts at least `spacing` apart: a half-open minute holds
    // ceil(60 000 / spacing) of them at most.
    const perMinute = Math.ceil(60_000 / defaultReservationSpacingMillis);
    expect(perMinute).toBeLessThan(statedJolpicaRequestsPerMinute);
  });

  it('lets the largest run finish its spacing well inside the coordination deadline', () => {
    const spacingOnly =
      (largestRunRequests - 1) * defaultReservationSpacingMillis;
    // Leaves room for ordinary answer times (observed 7-711 ms each).
    expect(spacingOnly).toBeLessThan(COORDINATION_DEADLINE_MS / 2);
    // The deadline, not the spacing, is what bounds a run of slow answers:
    // a run aborts there whatever the provider does.
    expect(providerRequestTimeoutMillis).toBeLessThan(COORDINATION_DEADLINE_MS);
  });

  it('spaces a 25-request run by the default in fake time', async () => {
    const clock = new MutableClock(new Date(START));
    const limiter = new ScriptedLimiter(clock);
    const pacer = new PacedReservationClient({
      limiter,
      now: () => clock.now(),
      sleep: clockSleep(clock, []),
    });

    for (let index = 0; index < 25; index += 1) {
      await pacer.reserve('jolpica');
    }

    const asked = limiter.askedAt;
    expect(asked).toHaveLength(25);
    for (let first = 0; first < asked.length; first += 1) {
      const inMinute = asked.filter(
        (at) => at >= asked[first]! && at < asked[first]! + 60_000,
      ).length;
      expect(inMinute).toBeLessThan(statedJolpicaRequestsPerMinute);
    }
    expect(asked[24]! - asked[0]!).toBe(24 * defaultReservationSpacingMillis);
  });
});
