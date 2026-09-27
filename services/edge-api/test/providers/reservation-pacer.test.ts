/**
 * The per-run reservation pacer (runtime activation decision O-11): at least
 * 260 ms between its own reservations, one limiter question per reservation,
 * and a deferral that is final for its attempt.
 */

import { describe, expect, it } from 'vitest';

import {
  ReservationCoordinator,
  type ProviderRateLimiterClient,
  type ReservationHost,
  type ReservationOutcome,
} from '../../src/providers/http/provider-rate-limiter';
import {
  minimumReservationSpacingMillis,
  PacedReservationClient,
} from '../../src/providers/http/reservation-pacer';
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
  it('asks immediately the first time and spaces every later reservation by at least 260 ms', async () => {
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
    expect(limiter.askedAt).toHaveLength(5);
    expect(limiter.askedAt[0]).toBe(Date.parse(START));
    for (const gap of gaps(limiter.askedAt)) {
      expect(gap).toBeGreaterThanOrEqual(260);
    }
    expect(slept).toEqual([260, 260, 260, 260]);
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
    clock.advance(400); // already past the spacing
    await pacer.reserve('jolpica');

    expect(slept).toEqual([60]);
    expect(gaps(limiter.askedAt)).toEqual([260, 400]);
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

    expect(gaps(limiter.askedAt)).toEqual([260, 260]);
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
