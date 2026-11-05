/**
 * The staging-only, one-request Jolpica egress identity probe
 * (`POST /internal/admin/provider/jolpica/egress-identity`, 2026-11-05),
 * through the real Worker entry point of a coordinated staging Worker.
 *
 * The probe composes through the coordinated runtime's own gate, as an
 * operator verification does (ADR 0022 A9): the hardened client, the per-run
 * pacer and the limiter are the run's own. It sends at most one request, to
 * exactly `https://api.jolpi.ca/test/`, writes no ledger or release, and never
 * echoes an address that is not Cloudflare's.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleEgressIdentityRequest } from '../../../../src/admin/egress-identity-route';
import { buildProviderUrl } from '../../../../src/providers/http/provider-http-client';
import type {
  ProviderRateLimiterClient,
  ReservationOutcome,
} from '../../../../src/providers/http/provider-rate-limiter';
import type { RealProviderSourceId } from '../../../../src/providers/http/reservation-engine';
import type { CoordinatedRuntimeDependencies } from '../../../../src/sync/coordinated/composition';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import {
  classifyAddress,
  documentedWorkerAddress,
  ipv6Groups,
  readEgressIdentity,
} from '../../../../src/sync/coordinated/egress-identity';
import { sequencerTransports } from '../../../publication/sequenced/support';
import {
  ADMIN_TOKEN,
  EntryPointHarness,
  PUBLIC_BASE_URL,
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

const probePath = '/internal/admin/provider/jolpica/egress-identity';
const at = '2026-11-05T09:00:00.000Z';
const djangoAt = '2026-11-05T09:00:01.234';

/** The `/test/` body Jolpica's `views.test` builds. */
function testBody(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: djangoAt,
    REMOTE_ADDR: documentedWorkerAddress,
    HTTP_X_FORWARDED_FOR: documentedWorkerAddress,
    ratelimited: false,
    user: 'AnonymousUser',
    v: '2026.10.26',
    ...overrides,
  };
}

function json(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

interface Recording {
  readonly sent: Request[];
  readonly reserved: string[];
  readonly reports: [RealProviderSourceId, string | null][];
}

async function staging(
  transport: (typeof sequencerTransports)[number],
  answer: () => Response,
  reserve?: (sourceId: RealProviderSourceId) => ReservationOutcome,
) {
  const recording: Recording = { sent: [], reserved: [], reports: [] };
  const limiter: ProviderRateLimiterClient = {
    async reserve(sourceId) {
      recording.reserved.push(sourceId);
      return (
        reserve?.(sourceId) ?? { outcome: 'allowed', sourceId, headroom: [] }
      );
    },
    async recordRateLimited(sourceId, retryAfter) {
      recording.reports.push([sourceId, retryAfter]);
    },
  };
  const harness = await EntryPointHarness.create(transport, bind, {
    env: {
      __PROVIDER_RATE_LIMITER: limiter,
      __PROVIDER_TRANSPORT: async (outbound: Request) => {
        recording.sent.push(outbound);
        return answer();
      },
    },
  });
  const call = async (method = 'POST', token: string | null = ADMIN_TOKEN) => {
    const answer = await harness.admin(
      at,
      new Request(`${PUBLIC_BASE_URL}${probePath}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    );
    return {
      ...answer,
      body: answer.body as { data?: Record<string, unknown> },
    };
  };
  return { harness, recording, call };
}

describe.each(sequencerTransports)(
  'the egress identity probe on a coordinated staging Worker, over the %s transport',
  (transport) => {
    it('sends exactly one GET to https://api.jolpi.ca/test/, writes nothing, and reports the address Jolpica saw', async () => {
      const run = await staging(transport, () =>
        json(testBody(), { 'cf-cache-status': 'DYNAMIC' }),
      );
      const before = await run.harness.snapshot();

      const answer = await run.call();
      const { status, body } = answer;

      expect(status).toBe(200);
      expect(run.recording.sent).toHaveLength(1);
      const [outbound] = run.recording.sent;
      expect(outbound!.url).toBe('https://api.jolpi.ca/test/');
      expect(outbound!.method).toBe('GET');
      expect([...outbound!.headers.keys()].sort()).toEqual([
        'accept',
        'user-agent',
      ]);
      expect(run.recording.reserved).toEqual(['jolpica']);
      expect(body.data).toEqual({
        outcome: 'observed',
        remoteAddress: {
          class: 'documented-worker-address',
          value: documentedWorkerAddress,
        },
        forwardedFor: { hops: 1, classes: ['documented-worker-address'] },
        remoteIsLastForwarded: true,
        testCounterOver: false,
        anonymous: true,
        version: '2026.10.26',
        timestampSkewSeconds: 1,
        fresh: true,
        cacheStatus: 'DYNAMIC',
      });
      // No ledger call at all, no publication, no storage write.
      expect(await run.harness.snapshot()).toEqual(before);
      expect(answer.ledgerCalls).toEqual([]);
      expect([answer.prepares, answer.storageWrites]).toEqual([0, 0]);
      expect(
        run.harness.harness.logger.events.find(
          (event) => event.operation === 'provider.egress_identity',
        ),
      ).toMatchObject({
        coordinationOutcome: 'observed',
        providerEgressAddressClass: 'documented-worker-address',
        providerEgressForwardedHops: 1,
        providerEgressFresh: true,
      });
    });

    it('sends nothing while the limiter holds Jolpica, and says until when', async () => {
      const run = await staging(
        transport,
        () => json(testBody()),
        (sourceId) => ({
          outcome: 'deferred',
          sourceId,
          retryAt: '2026-11-05T09:01:00.000Z',
          limitingWindows: [],
          headroom: [],
          cause: 'provider-hold',
        }),
      );

      const { body } = await run.call();

      expect(run.recording.sent).toHaveLength(0);
      expect(body.data).toEqual({
        outcome: 'not-sent',
        reason: 'rate-limit-deferred',
        retryAt: '2026-11-05T09:01:00.000Z',
      });
    });

    it('reports and holds a 429 like any other refusal, and sends nothing more', async () => {
      const run = await staging(
        transport,
        () =>
          new Response('{"detail":"Request was throttled."}', {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }),
      );

      const { body } = await run.call();

      expect(run.recording.sent).toHaveLength(1);
      expect(run.recording.reports).toEqual([['jolpica', null]]);
      expect(body.data).toEqual({
        outcome: 'failed',
        reason: 'provider-rate-limited',
        status: 429,
      });
      expect(
        run.harness.harness.logger.events.find(
          (event) => event.operation === 'provider.request.rate_limited',
        ),
      ).toMatchObject({
        providerRefusalLayer: 'application',
        providerRefusalBody: 'jolpica-throttled',
      });
    });

    it("never echoes an address that is not Cloudflare's, e.g. a cached answer to someone else", async () => {
      const stranger = '203.0.113.77';
      const run = await staging(transport, () =>
        json(
          testBody({
            timestamp: '2026-11-05T06:00:00.000',
            REMOTE_ADDR: stranger,
            HTTP_X_FORWARDED_FOR: `198.51.100.9, ${stranger}`,
          }),
          { 'cf-cache-status': 'HIT' },
        ),
      );

      const { body } = await run.call();

      expect(body.data).toMatchObject({
        outcome: 'observed',
        remoteAddress: { class: 'other-ipv4' },
        forwardedFor: { hops: 2, classes: ['other-ipv4', 'other-ipv4'] },
        remoteIsLastForwarded: true,
        fresh: false,
        cacheStatus: 'HIT',
      });
      expect(body.data).not.toHaveProperty('remoteAddress.value');
      const everything =
        JSON.stringify(body) +
        JSON.stringify(run.harness.harness.logger.events);
      expect(everything).not.toContain(stranger);
      expect(everything).not.toContain('198.51.100.9');
    });

    it('answers unrecognised for a 200 that is not the /test/ shape', async () => {
      const run = await staging(transport, () => json({ status: 'OK' }));

      const { body } = await run.call();

      expect(body.data).toEqual({
        outcome: 'unrecognised',
        cacheStatus: 'absent',
      });
    });

    it('sends nothing when the coordinated runtime cannot compose', async () => {
      const run = await staging(transport, () => json(testBody()));
      run.harness.unbindLedger();

      const { status, body } = await run.call();

      expect(status).toBe(503);
      expect(body.data).toMatchObject({
        outcome: 'coordinated-runtime-unavailable',
      });
      expect([
        run.recording.sent.length,
        run.recording.reserved.length,
      ]).toEqual([0, 0]);
    });

    it('requires the admin token and POST', async () => {
      const run = await staging(transport, () => json(testBody()));

      expect((await run.call('POST', null)).status).toBe(401);
      expect((await run.call('POST', 'wrong-token')).status).toBe(401);
      expect((await run.call('GET')).status).toBe(405);
      expect(run.recording.sent).toHaveLength(0);
    });
  },
);

describe('the probe route outside coordinated staging', () => {
  it('is refused before anything is composed', async () => {
    const untouchable = new Proxy(
      {},
      {
        get() {
          throw new Error('nothing may be composed');
        },
      },
    ) as CoordinatedRuntimeDependencies;
    for (const [environment, coordinated] of [
      ['production', true],
      ['e2e', true],
      ['development', true],
      ['staging', false],
      [undefined, true],
    ] as const) {
      const response = await handleEgressIdentityRequest(
        new Request(`${PUBLIC_BASE_URL}${probePath}`, { method: 'POST' }),
        {
          environment,
          coordinated,
          dependencies: untouchable,
          logger: { info() {}, warn() {}, error() {} },
          requestId: 'r-1',
        },
      );
      expect(response.status, `${environment}/${coordinated}`).toBe(404);
    }
  });
});

describe('the exact diagnostic path in the hardened URL builder', () => {
  it('admits /test/ for Jolpica only, exactly, and never with a query', () => {
    expect(buildProviderUrl('jolpica', '/test/')?.toString()).toBe(
      'https://api.jolpi.ca/test/',
    );
    for (const rejected of ['/test', '/test/x', '/test//', '/tes/', '/TEST/']) {
      expect(buildProviderUrl('jolpica', rejected)).toBeNull();
    }
    expect(buildProviderUrl('jolpica', '/test/', { a: 1 })).toBeNull();
    expect(buildProviderUrl('openf1', '/test/')).toBeNull();
    // The documented prefix still works as before.
    expect(
      buildProviderUrl('jolpica', '/ergast/f1/2026/races/', {
        limit: 100,
      })?.toString(),
    ).toBe('https://api.jolpi.ca/ergast/f1/2026/races/?limit=100');
  });
});

describe('address classes and freshness', () => {
  it('parses IPv6 literals and classifies them against Cloudflare documentation', () => {
    expect(ipv6Groups('2a06:98c0:3600::103')).toEqual([
      0x2a06, 0x98c0, 0x3600, 0, 0, 0, 0, 0x103,
    ]);
    expect(ipv6Groups('1::2::3')).toBeNull();
    expect(ipv6Groups('::ffff:1.2.3.4')).toBeNull();

    expect(classifyAddress('2A06:98C0:3600:0:0:0:0:103')).toEqual({
      class: 'documented-worker-address',
      value: documentedWorkerAddress,
    });
    expect(classifyAddress('2a06:98c0:3600::9')).toEqual({
      class: 'worker-prefix',
      value: '2a06:98c0:3600:0:0:0:0:9',
    });
    expect(classifyAddress('2a06:98c7:1::1')).toMatchObject({
      class: 'cloudflare-range',
    });
    expect(classifyAddress('2001:db8::1')).toEqual({ class: 'other-ipv6' });
    expect(classifyAddress('192.0.2.1')).toEqual({ class: 'other-ipv4' });
    expect(classifyAddress('not an address')).toEqual({ class: 'invalid' });
    expect(classifyAddress('')).toEqual({ class: 'absent' });
    expect(classifyAddress(42)).toEqual({ class: 'invalid' });
  });

  it('marks a stale or unparseable timestamp as not fresh, and keeps a bad version out', () => {
    const now = new Date(at);
    expect(
      readEgressIdentity(testBody({ timestamp: 'later' }), now, 'DYNAMIC'),
    ).toMatchObject({ timestampSkewSeconds: null, fresh: false });
    expect(
      readEgressIdentity(
        testBody({ timestamp: '2026-11-05T09:10:00' }),
        now,
        'DYNAMIC',
      ),
    ).toMatchObject({ timestampSkewSeconds: 600, fresh: false });
    expect(
      readEgressIdentity(testBody({ v: '<script>' }), now, 'MISS'),
    ).toMatchObject({ version: null, fresh: true });
    expect(readEgressIdentity([1], now, 'MISS')).toBeNull();
  });
});
