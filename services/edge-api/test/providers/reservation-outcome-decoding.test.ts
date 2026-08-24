import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../src/logging/logger';
import {
  ProviderHttpClient,
  type ProviderTransport,
} from '../../src/providers/http/provider-http-client';
import {
  decodeReservationOutcome,
  DurableObjectRateLimiterClient,
} from '../../src/providers/http/provider-rate-limiter';
import type { RealProviderSourceId } from '../../src/providers/http/reservation-engine';

const now = new Date('2026-07-20T12:00:00.000Z');
const retryAt = '2026-07-20T12:00:01.000Z';

/** OpenF1 publishes second/3 and minute/30; Jolpica second/4 and hour/500. */
const openF1Headroom = [
  { window: 'second', limit: 3, remaining: 2 },
  { window: 'minute', limit: 30, remaining: 29 },
];

const validAllowed = {
  outcome: 'allowed',
  sourceId: 'openf1',
  headroom: openF1Headroom,
};

const validDeferred = {
  outcome: 'deferred',
  sourceId: 'openf1',
  retryAt,
  limitingWindows: [{ window: 'second', limit: 3, retryAt }],
  headroom: [
    { window: 'second', limit: 3, remaining: 0 },
    { window: 'minute', limit: 30, remaining: 29 },
  ],
};

/** Serves one fixed body as the Durable Object's response. */
function namespaceReturning(body: unknown, status = 200) {
  return {
    idFromName: () => ({}) as DurableObjectId,
    get: () => ({
      fetch: async () =>
        new Response(typeof body === 'string' ? body : JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    }),
  } as unknown as DurableObjectNamespace;
}

describe('decodeReservationOutcome accepts only complete, in-policy results', () => {
  it('accepts a fully valid allowed outcome', () => {
    const decoded = decodeReservationOutcome(validAllowed, 'openf1');

    expect(decoded?.outcome).toBe('allowed');
    expect(
      decoded?.outcome === 'allowed' && decoded.headroom.map((w) => w.window),
    ).toEqual(['second', 'minute']);
  });

  it('accepts a fully valid deferred outcome', () => {
    const decoded = decodeReservationOutcome(validDeferred, 'openf1');

    expect(decoded?.outcome).toBe('deferred');
    expect(decoded?.outcome === 'deferred' && decoded.retryAt).toBe(retryAt);
  });

  it('accepts each known unavailable reason', () => {
    for (const reason of [
      'limiter-unreachable',
      'storage-failure',
      'state-corrupt',
    ]) {
      const decoded = decodeReservationOutcome(
        { outcome: 'unavailable', sourceId: 'jolpica', reason },
        'jolpica',
      );
      expect(decoded?.outcome).toBe('unavailable');
      expect(decoded?.outcome === 'unavailable' && decoded.reason).toBe(reason);
    }
  });

  const malformed: [string, unknown, RealProviderSourceId][] = [
    ['a non-object body', 'not-an-object', 'openf1'],
    ['a null body', null, 'openf1'],
    ['an array body', [validAllowed], 'openf1'],
    ['an unknown outcome', { outcome: 'maybe', sourceId: 'openf1' }, 'openf1'],
    ['a missing outcome', { sourceId: 'openf1' }, 'openf1'],
    [
      'a missing source id',
      { outcome: 'allowed', headroom: openF1Headroom },
      'openf1',
    ],
    [
      'a cross-source answer',
      { ...validAllowed, sourceId: 'jolpica' },
      'openf1',
    ],
    // The exact partial body the review flagged: previously accepted, and it
    // would then have thrown inside headroomCounts.
    [
      'a version-skewed allowed body',
      { outcome: 'allowed', sourceId: 'openf1' },
      'openf1',
    ],
    [
      'allowed with missing headroom',
      { outcome: 'allowed', sourceId: 'openf1', headroom: null },
      'openf1',
    ],
    [
      'allowed with non-array headroom',
      { ...validAllowed, headroom: {} },
      'openf1',
    ],
    [
      'allowed missing a policy window',
      { ...validAllowed, headroom: [openF1Headroom[0]] },
      'openf1',
    ],
    [
      'allowed with a duplicate window',
      { ...validAllowed, headroom: [openF1Headroom[0], openF1Headroom[0]] },
      'openf1',
    ],
    [
      'allowed with an unexpected window',
      {
        ...validAllowed,
        headroom: [
          openF1Headroom[0],
          { window: 'hour', limit: 500, remaining: 1 },
        ],
      },
      'openf1',
    ],
    [
      'allowed with a mismatched policy limit',
      {
        ...validAllowed,
        headroom: [
          { window: 'second', limit: 4, remaining: 1 },
          openF1Headroom[1],
        ],
      },
      'openf1',
    ],
    [
      'allowed with a negative remaining count',
      {
        ...validAllowed,
        headroom: [
          { window: 'second', limit: 3, remaining: -1 },
          openF1Headroom[1],
        ],
      },
      'openf1',
    ],
    [
      'allowed with a fractional remaining count',
      {
        ...validAllowed,
        headroom: [
          { window: 'second', limit: 3, remaining: 1.5 },
          openF1Headroom[1],
        ],
      },
      'openf1',
    ],
    [
      'allowed with a non-finite remaining count',
      {
        ...validAllowed,
        headroom: [
          { window: 'second', limit: 3, remaining: Number.POSITIVE_INFINITY },
          openF1Headroom[1],
        ],
      },
      'openf1',
    ],
    [
      'allowed with a remaining count over the policy limit',
      {
        ...validAllowed,
        headroom: [
          { window: 'second', limit: 3, remaining: 4 },
          openF1Headroom[1],
        ],
      },
      'openf1',
    ],
    [
      'a version-skewed deferred body',
      { outcome: 'deferred', sourceId: 'openf1' },
      'openf1',
    ],
    [
      'deferred with no limiting windows',
      { ...validDeferred, limitingWindows: [] },
      'openf1',
    ],
    [
      'deferred with a non-array limitingWindows',
      { ...validDeferred, limitingWindows: 'second' },
      'openf1',
    ],
    [
      'deferred with a duplicate limiting window',
      {
        ...validDeferred,
        limitingWindows: [
          { window: 'second', limit: 3, retryAt },
          { window: 'second', limit: 3, retryAt },
        ],
      },
      'openf1',
    ],
    [
      'deferred with an out-of-policy limiting window',
      {
        ...validDeferred,
        limitingWindows: [{ window: 'hour', limit: 500, retryAt }],
      },
      'openf1',
    ],
    [
      'deferred with a missing retryAt',
      { ...validDeferred, retryAt: undefined },
      'openf1',
    ],
    [
      'deferred with a malformed retryAt',
      { ...validDeferred, retryAt: 'soon' },
      'openf1',
    ],
    [
      'deferred with a numeric retryAt',
      { ...validDeferred, retryAt: 1 },
      'openf1',
    ],
    [
      'deferred with a non-ISO retryAt',
      { ...validDeferred, retryAt: 'Mon, 20 Jul 2026 12:00:01 GMT' },
      'openf1',
    ],
    [
      'deferred with a malformed nested retryAt',
      {
        ...validDeferred,
        limitingWindows: [{ window: 'second', limit: 3, retryAt: 'nope' }],
      },
      'openf1',
    ],
    [
      'an unknown unavailable reason',
      { outcome: 'unavailable', sourceId: 'openf1', reason: 'because' },
      'openf1',
    ],
    [
      'unavailable with a missing reason',
      { outcome: 'unavailable', sourceId: 'openf1' },
      'openf1',
    ],
  ];

  it.each(malformed)('rejects %s', (_label, body, sourceId) => {
    expect(decodeReservationOutcome(body, sourceId)).toBeNull();
  });
});

describe('the client fails closed on every invalid object response', () => {
  it.each([
    ['malformed JSON', '{"outcome":"allowed",'],
    [
      'a version-skewed allowed body',
      { outcome: 'allowed', sourceId: 'openf1' },
    ],
    [
      'a version-skewed deferred body',
      { outcome: 'deferred', sourceId: 'openf1' },
    ],
    ['a cross-source body', { ...validAllowed, sourceId: 'jolpica' }],
    ['an unknown outcome', { outcome: 'queued', sourceId: 'openf1' }],
    [
      'an unknown unavailable reason',
      { outcome: 'unavailable', sourceId: 'openf1', reason: 'x' },
    ],
  ])('reports limiter-unreachable for %s', async (_label, body) => {
    const client = new DurableObjectRateLimiterClient(namespaceReturning(body));

    const outcome = await client.reserve('openf1');

    expect(outcome.outcome).toBe('unavailable');
    expect(outcome.outcome === 'unavailable' && outcome.reason).toBe(
      'limiter-unreachable',
    );
  });

  it('passes a fully valid allowed outcome through unchanged', async () => {
    const client = new DurableObjectRateLimiterClient(
      namespaceReturning(validAllowed),
    );

    const outcome = await client.reserve('openf1');

    expect(outcome.outcome).toBe('allowed');
  });
});

describe('a partial outcome cannot reach the request path', () => {
  it('issues no request and records no attempt for the flagged partial body', async () => {
    let transportCalls = 0;
    const transport: ProviderTransport = async () => {
      transportCalls += 1;
      return new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const logger = new CapturingLogger();
    const client = new ProviderHttpClient({
      transport,
      // The exact shape the review flagged. Before the fix this decoded as
      // `allowed`, and `headroomCounts` then threw on the missing field.
      limiter: new DurableObjectRateLimiterClient(
        namespaceReturning({ outcome: 'allowed', sourceId: 'openf1' }),
      ),
      logger,
      now: () => now,
    });

    // Must resolve, not reject.
    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.kind).toBe('limiter-unavailable');
    expect(!result.ok && result.requestAttempted).toBe(false);
    expect(transportCalls).toBe(0);

    // Bounded log category only; no raw body or unknown value.
    const serialized = logger.serialized();
    expect(serialized).toContain('limiter-unreachable');
    expect(serialized).not.toContain('headroom');
    expect(serialized).not.toContain('reservation-ledger');
  });

  it('issues no request for a partial deferred body', async () => {
    let transportCalls = 0;
    const transport: ProviderTransport = async () => {
      transportCalls += 1;
      return new Response('{}', { status: 200 });
    };
    const client = new ProviderHttpClient({
      transport,
      limiter: new DurableObjectRateLimiterClient(
        namespaceReturning({ outcome: 'deferred', sourceId: 'openf1' }),
      ),
      logger: new CapturingLogger(),
      now: () => now,
    });

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(!result.ok && result.kind).toBe('limiter-unavailable');
    expect(transportCalls).toBe(0);
  });

  it('issues no request when the object answers for the other provider', async () => {
    let transportCalls = 0;
    const transport: ProviderTransport = async () => {
      transportCalls += 1;
      return new Response('{}', { status: 200 });
    };
    const client = new ProviderHttpClient({
      transport,
      limiter: new DurableObjectRateLimiterClient(
        namespaceReturning({
          outcome: 'allowed',
          sourceId: 'jolpica',
          headroom: [
            { window: 'second', limit: 4, remaining: 3 },
            { window: 'hour', limit: 500, remaining: 499 },
          ],
        }),
      ),
      logger: new CapturingLogger(),
      now: () => now,
    });

    const result = await client.getJson({
      sourceId: 'openf1',
      path: '/v1/sessions',
    });

    expect(!result.ok && result.kind).toBe('limiter-unavailable');
    expect(transportCalls).toBe(0);
  });
});
