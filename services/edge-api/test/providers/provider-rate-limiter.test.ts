import { describe, expect, it } from 'vitest';

import {
  decodeReservationOutcome,
  DurableObjectRateLimiterClient,
  ProviderRateLimiter,
  rateLimitReportUrl,
  ReservationCoordinator,
  reservationRequestUrl,
  type ReservationHost,
} from '../../src/providers/http/provider-rate-limiter';
import { resolveProviderRateLimiter } from '../../src/providers/http/factory';

const base = Date.parse('2026-07-20T12:00:00.000Z');

/**
 * In-memory stand-in for `DurableObjectState`. `blockConcurrencyWhile`
 * serializes callbacks exactly as the runtime does, so the concurrency
 * expectations below exercise the real coordination path.
 */
class FakeHost implements ReservationHost {
  readonly values = new Map<string, unknown>();
  private queue: Promise<unknown> = Promise.resolve();
  putCount = 0;
  failStorage = false;

  storage = {
    get: async <T>(key: string): Promise<T | undefined> => {
      if (this.failStorage) throw new Error('injected storage failure');
      return this.values.get(key) as T | undefined;
    },
    put: async <T>(key: string, value: T): Promise<void> => {
      if (this.failStorage) throw new Error('injected storage failure');
      this.putCount += 1;
      this.values.set(key, structuredClone(value));
    },
  };

  /**
   * Serializes callbacks exactly as the runtime's input gate does, and
   * additionally reports a rejecting callback. In production an exception
   * escaping here terminates and resets the Durable Object, so a test fake that
   * quietly swallowed it would hide the very failure that matters.
   */
  onCallbackRejection: ((error: unknown) => void) | null = null;

  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    const next = this.queue.then(callback);
    this.queue = next.then(
      () => undefined,
      (error) => {
        this.onCallbackRejection?.(error);
      },
    );
    return next;
  }
}

function coordinatorAt(host: FakeHost, offsetMillis: () => number) {
  return new ReservationCoordinator(
    host,
    () => new Date(base + offsetMillis()),
  );
}

describe('ReservationCoordinator', () => {
  it('enforces the OpenF1 burst window across calls', async () => {
    const host = new FakeHost();
    const coordinator = coordinatorAt(host, () => 0);

    const outcomes = [];
    for (let index = 0; index < 4; index += 1) {
      outcomes.push(await coordinator.reserve('openf1'));
    }

    expect(outcomes.map((o) => o.outcome)).toEqual([
      'allowed',
      'allowed',
      'allowed',
      'deferred',
    ]);
    const denied = outcomes[3];
    expect(denied?.outcome === 'deferred' && denied.retryAt).toBe(
      '2026-07-20T12:00:01.000Z',
    );
  });

  it('cannot oversubscribe a window under concurrent calls', async () => {
    const host = new FakeHost();
    const coordinator = coordinatorAt(host, () => 0);

    // Ten simultaneous reservations against a 3/second window.
    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () => coordinator.reserve('openf1')),
    );

    const allowed = outcomes.filter((o) => o.outcome === 'allowed');
    expect(allowed).toHaveLength(3);
    expect(outcomes.filter((o) => o.outcome === 'deferred')).toHaveLength(7);
    const stored = host.values.get('reservation-ledger') as {
      timestamps: number[];
    };
    expect(stored.timestamps).toHaveLength(3);
  });

  it('survives recreation of the object over the same storage', async () => {
    const host = new FakeHost();
    await coordinatorAt(host, () => 0).reserve('openf1');
    await coordinatorAt(host, () => 0).reserve('openf1');
    await coordinatorAt(host, () => 0).reserve('openf1');

    // A fresh coordinator instance, as after an eviction or restart.
    const revived = await coordinatorAt(host, () => 0).reserve('openf1');

    expect(revived.outcome).toBe('deferred');
  });

  it('prunes expired timestamps so storage stays bounded', async () => {
    const host = new FakeHost();
    let offset = 0;
    const coordinator = coordinatorAt(host, () => offset);

    for (let second = 0; second < 120; second += 1) {
      offset = second * 1000;
      await coordinator.reserve('openf1');
    }

    const stored = host.values.get('reservation-ledger') as {
      timestamps: number[];
    };
    expect(stored.timestamps.length).toBeLessThanOrEqual(30);
  });

  it('keeps sources isolated in separate objects', async () => {
    const jolpicaHost = new FakeHost();
    const openF1Host = new FakeHost();
    const jolpica = coordinatorAt(jolpicaHost, () => 0);
    const openF1 = coordinatorAt(openF1Host, () => 0);

    for (let index = 0; index < 4; index += 1) await jolpica.reserve('jolpica');

    expect((await jolpica.reserve('jolpica')).outcome).toBe('deferred');
    expect((await openF1.reserve('openf1')).outcome).toBe('allowed');
    expect(
      (jolpicaHost.values.get('reservation-ledger') as { sourceId: string })
        .sourceId,
    ).toBe('jolpica');
  });

  it('fails closed on a ledger stored under a different source', async () => {
    const host = new FakeHost();
    // A ledger that claims to be OpenF1 sitting in the Jolpica object.
    const foreign = {
      sourceId: 'openf1',
      timestamps: [base, base, base, base],
    };
    host.values.set('reservation-ledger', foreign);

    const outcome = await coordinatorAt(host, () => 0).reserve('jolpica');

    // Neither adopted nor discarded. Starting clean would hand back capacity
    // whose safety cannot be established; relabelling would let one source's
    // budget be spent as another's.
    expect(outcome.outcome).toBe('unavailable');
    expect(outcome.outcome === 'unavailable' && outcome.reason).toBe(
      'state-corrupt',
    );
    expect(host.values.get('reservation-ledger')).toEqual(foreign);
    expect(host.putCount).toBe(0);
  });

  it('does not consume capacity when a reservation is denied', async () => {
    const host = new FakeHost();
    const coordinator = coordinatorAt(host, () => 0);
    for (let index = 0; index < 3; index += 1)
      await coordinator.reserve('openf1');
    const putsAfterFill = host.putCount;

    await coordinator.reserve('openf1');
    await coordinator.reserve('openf1');

    // Denials in the same window neither write nor grow the ledger.
    expect(host.putCount).toBe(putsAfterFill);
    const stored = host.values.get('reservation-ledger') as {
      timestamps: number[];
    };
    expect(stored.timestamps).toHaveLength(3);
  });
});

describe('ProviderRateLimiter Durable Object', () => {
  function post(body: unknown): Request {
    return new Request(reservationRequestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('reserves through the object and returns a typed outcome', async () => {
    const object = new ProviderRateLimiter(new FakeHost());

    const response = await object.fetch(post({ sourceId: 'jolpica' }));
    const outcome = (await response.json()) as { outcome: string };

    expect(response.status).toBe(200);
    expect(outcome.outcome).toBe('allowed');
  });

  it('rejects a non-canonical or mock source before touching state', async () => {
    const host = new FakeHost();
    const object = new ProviderRateLimiter(host);

    for (const sourceId of ['mock', 'jolpica-evil', '', null, 42]) {
      const response = await object.fetch(post({ sourceId }));
      expect(response.status).toBe(400);
    }
    expect(host.values.size).toBe(0);
    expect(host.putCount).toBe(0);
  });

  it('rejects non-POST and malformed bodies', async () => {
    const object = new ProviderRateLimiter(new FakeHost());

    const wrongMethod = await object.fetch(
      new Request(reservationRequestUrl, { method: 'GET' }),
    );
    const malformed = await object.fetch(
      new Request(reservationRequestUrl, { method: 'POST', body: 'not-json' }),
    );

    expect(wrongMethod.status).toBe(405);
    expect(malformed.status).toBe(400);
  });

  it('fails closed on storage failure without terminating the object', async () => {
    const host = new FakeHost();
    host.failStorage = true;
    const object = new ProviderRateLimiter(host);

    const response = await object.fetch(post({ sourceId: 'jolpica' }));
    const body = (await response.json()) as { outcome?: string };

    // Cloudflare terminates and resets a Durable Object when an exception
    // escapes `blockConcurrencyWhile`, which would tear down the shared
    // limiter for every caller. The callback therefore absorbs the failure and
    // answers `unavailable` - fail-closed, but the object survives.
    expect(body.outcome).toBe('unavailable');
    expect(body.outcome).not.toBe('allowed');
    expect(JSON.stringify(body)).not.toContain('injected storage failure');

    // Proof the object was not reset: it serves normally once storage recovers.
    host.failStorage = false;
    const recovered = await object.fetch(post({ sourceId: 'jolpica' }));
    expect(((await recovered.json()) as { outcome: string }).outcome).toBe(
      'allowed',
    );
  });

  it('never lets an exception escape blockConcurrencyWhile', async () => {
    const host = new FakeHost();
    host.failStorage = true;
    let escaped: unknown = null;
    host.onCallbackRejection = (error) => {
      escaped = error;
    };

    const outcome = await new ReservationCoordinator(
      host,
      () => new Date(base),
    ).reserve('openf1');

    expect(outcome.outcome).toBe('unavailable');
    // Nothing rejected, so the runtime would never reset the object.
    expect(escaped).toBeNull();
  });

  it('does not accept a caller-supplied reservation time', async () => {
    const host = new FakeHost();
    const object = new ProviderRateLimiter(host);

    // A caller trying to backdate the reservation so the window looks empty.
    await object.fetch(
      post({ sourceId: 'openf1', at: '1999-01-01T00:00:00.000Z', now: 0 }),
    );

    const stored = host.values.get('reservation-ledger') as {
      timestamps: number[];
    };
    // The stored timestamp is the object's own clock, not the caller's value.
    expect(stored.timestamps).toHaveLength(1);
    expect(stored.timestamps[0]).toBeGreaterThan(
      Date.parse('2020-01-01T00:00:00.000Z'),
    );
  });
});

describe('fail-closed limiter clients', () => {
  it('resolves to unavailable when no namespace is bound', async () => {
    const client = resolveProviderRateLimiter({});

    expect(await client.reserve('jolpica')).toEqual({
      outcome: 'unavailable',
      sourceId: 'jolpica',
      reason: 'limiter-unreachable',
    });
  });

  it('prefers an injected test client over the binding', async () => {
    const injected = {
      reserve: async () =>
        ({
          outcome: 'unavailable',
          sourceId: 'openf1',
          reason: 'limiter-unreachable',
        }) as const,
    };

    const client = resolveProviderRateLimiter({
      __PROVIDER_RATE_LIMITER: injected,
    });

    expect(client).toBe(injected);
  });

  it('reports unavailable when the object throws or answers badly', async () => {
    const throwing = new DurableObjectRateLimiterClient({
      idFromName: () => ({}) as DurableObjectId,
      get: () => {
        throw new Error('injected binding failure');
      },
    } as unknown as DurableObjectNamespace);

    const errored = new DurableObjectRateLimiterClient({
      idFromName: () => ({}) as DurableObjectId,
      get: () => ({
        fetch: async () => new Response('nope', { status: 500 }),
      }),
    } as unknown as DurableObjectNamespace);

    expect((await throwing.reserve('jolpica')).outcome).toBe('unavailable');
    expect((await errored.reserve('jolpica')).outcome).toBe('unavailable');
  });

  it('rejects an outcome that names a different source', async () => {
    const crossed = new DurableObjectRateLimiterClient({
      idFromName: () => ({}) as DurableObjectId,
      get: () => ({
        fetch: async () =>
          new Response(
            JSON.stringify({
              outcome: 'allowed',
              sourceId: 'openf1',
              headroom: [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      }),
    } as unknown as DurableObjectNamespace);

    expect((await crossed.reserve('jolpica')).outcome).toBe('unavailable');
  });

  it('addresses one deterministic object identity per source', async () => {
    const names: string[] = [];
    const client = new DurableObjectRateLimiterClient({
      idFromName: (name: string) => {
        names.push(name);
        return {} as DurableObjectId;
      },
      get: () => ({
        fetch: async () =>
          new Response(
            JSON.stringify({
              outcome: 'allowed',
              sourceId: 'jolpica',
              headroom: [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      }),
    } as unknown as DurableObjectNamespace);

    await client.reserve('jolpica');
    await client.reserve('jolpica');

    // The same global name every time: one budget, not one per isolate.
    expect(names).toEqual(['jolpica', 'jolpica']);
  });
});

describe('the upstream hold in the limiter object (AU-4 step 2)', () => {
  const iso = (offsetMillis: number) =>
    new Date(base + offsetMillis).toISOString();
  const jolpicaHeadroom = [
    { window: 'second', limit: 4, remaining: 4 },
    { window: 'hour', limit: 500, remaining: 500 },
  ];

  function report(body: unknown): Request {
    return new Request(rateLimitReportUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('records a 429 through the object and defers every reservation until the hold ends', async () => {
    let offset = 0;
    const host = new FakeHost();
    const object = new ProviderRateLimiter(host);
    // The object's own clock: replace its coordinator's with the test's.
    (object as unknown as { coordinator: ReservationCoordinator }).coordinator =
      coordinatorAt(host, () => offset);

    const held = await object.fetch(
      report({ sourceId: 'jolpica', retryAfter: null }),
    );
    expect(held.status).toBe(200);
    expect(await held.json()).toEqual({
      outcome: 'held',
      sourceId: 'jolpica',
      until: iso(60_000),
    });

    offset = 59_999;
    const coordinator = coordinatorAt(host, () => offset);
    expect(await coordinator.reserve('jolpica')).toEqual({
      outcome: 'deferred',
      sourceId: 'jolpica',
      retryAt: iso(60_000),
      limitingWindows: [],
      headroom: jolpicaHeadroom,
      cause: 'provider-hold',
    });
    offset = 60_000;
    expect((await coordinator.reserve('jolpica')).outcome).toBe('allowed');
  });

  it('only ever extends a hold', async () => {
    let offset = 0;
    const host = new FakeHost();
    const coordinator = coordinatorAt(host, () => offset);

    await coordinator.recordRateLimit('jolpica', iso(10 * 60_000));
    const puts = host.putCount;
    // A shorter report later on changes nothing and writes nothing.
    offset = 1_000;
    expect(await coordinator.recordRateLimit('jolpica', null)).toEqual({
      outcome: 'held',
      sourceId: 'jolpica',
      until: iso(10 * 60_000),
    });
    expect(host.putCount).toBe(puts);

    offset = 5 * 60_000;
    expect(await coordinator.reserve('jolpica')).toMatchObject({
      outcome: 'deferred',
      cause: 'provider-hold',
      retryAt: iso(10 * 60_000),
    });
  });

  it('fails closed on a corrupt or foreign hold record, and leaves it as found', async () => {
    for (const stored of [
      null,
      'soon',
      { sourceId: 'openf1', until: base + 60_000 },
      { sourceId: 'jolpica', until: -1 },
      { sourceId: 'jolpica', until: 1.5 },
    ]) {
      const host = new FakeHost();
      host.values.set('upstream-hold', stored);
      const coordinator = coordinatorAt(host, () => 0);
      expect(await coordinator.reserve('jolpica')).toEqual({
        outcome: 'unavailable',
        sourceId: 'jolpica',
        reason: 'state-corrupt',
      });
      expect((await coordinator.recordRateLimit('jolpica', null)).outcome).toBe(
        'unavailable',
      );
      expect(host.values.get('upstream-hold')).toEqual(stored);
    }
  });

  it('refuses a report whose retryAfter is not null or a canonical instant', async () => {
    const host = new FakeHost();
    const object = new ProviderRateLimiter(host);
    for (const retryAfter of ['tomorrow', 10, iso(0).replace('Z', '+00:00')]) {
      const response = await object.fetch(
        report({ sourceId: 'jolpica', retryAfter }),
      );
      expect(response.status).toBe(400);
    }
    expect(host.values.has('upstream-hold')).toBe(false);
  });

  it('decodes a hold deferral only with no limiting window, and rejects an unknown cause', () => {
    const hold = {
      outcome: 'deferred',
      sourceId: 'jolpica',
      retryAt: iso(60_000),
      limitingWindows: [],
      headroom: jolpicaHeadroom,
      cause: 'provider-hold',
    };
    expect(decodeReservationOutcome(hold, 'jolpica')).toEqual(hold);
    expect(
      decodeReservationOutcome(
        {
          ...hold,
          limitingWindows: [{ window: 'second', limit: 4, retryAt: iso(1) }],
        },
        'jolpica',
      ),
    ).toBeNull();
    expect(
      decodeReservationOutcome({ ...hold, cause: 'unknown' }, 'jolpica'),
    ).toBeNull();
    // A window deferral still needs its limiting windows.
    const windowDeferral: Record<string, unknown> = { ...hold };
    delete windowDeferral.cause;
    expect(decodeReservationOutcome(windowDeferral, 'jolpica')).toBeNull();
  });

  it('sends the report to the source object and swallows every failure', async () => {
    const sent: { url: string; body: unknown }[] = [];
    const client = new DurableObjectRateLimiterClient({
      idFromName: () => ({}) as DurableObjectId,
      get: () => ({
        fetch: async (url: string, init: RequestInit) => {
          sent.push({ url, body: JSON.parse(String(init.body)) });
          return new Response('{}', { status: 200 });
        },
      }),
    } as unknown as DurableObjectNamespace);
    await client.recordRateLimited('jolpica', iso(30_000));
    expect(sent).toEqual([
      {
        url: rateLimitReportUrl,
        body: { sourceId: 'jolpica', retryAfter: iso(30_000) },
      },
    ]);

    const broken = new DurableObjectRateLimiterClient({
      idFromName: () => {
        throw new Error('unbound');
      },
      get: () => ({}),
    } as unknown as DurableObjectNamespace);
    await expect(
      broken.recordRateLimited('jolpica', null),
    ).resolves.toBeUndefined();
  });
});
