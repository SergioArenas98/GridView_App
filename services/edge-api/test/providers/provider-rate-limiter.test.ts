import { describe, expect, it } from 'vitest';

import {
  DurableObjectRateLimiterClient,
  ProviderRateLimiter,
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

  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    const next = this.queue.then(callback);
    // Keep the chain alive even when a callback rejects.
    this.queue = next.then(
      () => undefined,
      () => undefined,
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

  it('never adopts a ledger stored under a different source', async () => {
    const host = new FakeHost();
    // A ledger that claims to be OpenF1 sitting in the Jolpica object.
    host.values.set('reservation-ledger', {
      sourceId: 'openf1',
      timestamps: [base, base, base, base],
    });

    const outcome = await coordinatorAt(host, () => 0).reserve('jolpica');

    // It starts clean rather than inheriting four foreign reservations.
    expect(outcome.outcome).toBe('allowed');
    expect(
      (host.values.get('reservation-ledger') as { sourceId: string }).sourceId,
    ).toBe('jolpica');
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

  it('fails closed when storage fails, never reporting allowed', async () => {
    const host = new FakeHost();
    host.failStorage = true;
    const object = new ProviderRateLimiter(host);

    const response = await object.fetch(post({ sourceId: 'jolpica' }));
    const body = (await response.json()) as {
      error?: string;
      outcome?: string;
    };

    expect(response.status).toBe(500);
    expect(body.outcome).toBeUndefined();
    // The injected message never reaches the response.
    expect(JSON.stringify(body)).not.toContain('injected storage failure');
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
    });
  });

  it('prefers an injected test client over the binding', async () => {
    const injected = {
      reserve: async () =>
        ({ outcome: 'unavailable', sourceId: 'openf1' }) as const,
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
