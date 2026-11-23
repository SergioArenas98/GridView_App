import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../../../../src/config/environment';
import {
  ReservationCoordinator,
  type ReservationHost,
} from '../../../../src/providers/http/provider-rate-limiter';
import type { ProviderTransport } from '../../../../src/providers/http/provider-http-client';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { MemoryKv } from '../../../e2e/automatic-updates/controlled-season';
import {
  driversEnvelope,
  fullSeasonDriverRows,
} from '../../../providers/jolpica/participants-support';
import {
  baseRows,
  resultsEnvelope,
} from '../../../providers/jolpica/results-support';
import {
  baseDriverRows,
  driverStandingsEnvelope,
} from '../../../providers/jolpica/standings-support';
import {
  paths,
  PRE_SEASON,
  seasonPaths,
  tickAfter,
} from '../observation/support';
import {
  EntryPointHarness,
  HOUR,
  MINUTE,
  later,
  type LedgerBinding,
} from './support';

const injected = vi.hoisted(() => ({ ledger: null as LedgerBinding }));
vi.mock(
  '../../../../src/sync/coordinated/ledger-port',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/sync/coordinated/ledger-port')
      >();
    return {
      ...actual,
      resolveReconciliationLedger: (): ReconciliationLedgerPort | null =>
        injected.ledger?.() ?? null,
    };
  },
);

const token = 'disposable-proxy-test-token';
const origin = 'https://egress.example.test';
const proxy: Partial<Env> = {
  JOLPICA_TRANSPORT: 'proxy',
  JOLPICA_PROXY_ORIGIN: origin,
  JOLPICA_PROXY_TOKEN: token,
};
const network = vi.fn<ProviderTransport>();
const forwardedRequests: { request: Request; expectedOrigin: string }[] = [];
const bind = (binding: LedgerBinding) => {
  injected.ledger = binding;
};

beforeEach(() => {
  injected.ledger = null;
  forwardedRequests.length = 0;
  network.mockReset().mockImplementation(async () => {
    throw new Error('Unscripted network request');
  });
  // Every runtime fetch is intercepted. No test can contact Jolpica or a VPS.
  vi.stubGlobal('fetch', network);
});
afterEach(() => {
  vi.unstubAllGlobals();
  // Assert outside the transport: the hardened client deliberately catches
  // transport exceptions, including any failed assertions made inside a mock.
  for (const { request, expectedOrigin } of forwardedRequests) {
    expect(new URL(request.url).origin).toBe(expectedOrigin);
    expect(request.redirect).toBe('manual');
    expect(request.headers.get('Authorization')).toBe(
      expectedOrigin === origin ? `Bearer ${token}` : null,
    );
  }
});

function serve(harness: EntryPointHarness, expectedOrigin: string) {
  network.mockImplementation(async (forwarded) => {
    const url = new URL(forwarded.url);
    forwardedRequests.push({ request: forwarded, expectedOrigin });
    // In-process stand-in for the eventual proxy; only the fixture server is
    // called. It receives no proxy credential, just a canonical provider URL.
    return harness.server.transport(
      new Request(`https://api.jolpi.ca${url.pathname}${url.search}`, {
        headers: {
          Accept: forwarded.headers.get('Accept')!,
          'User-Agent': forwarded.headers.get('User-Agent')!,
        },
        signal: forwarded.signal,
        redirect: 'manual',
      }),
    );
  });
}

/** Real reservation/hold logic, with private in-memory storage and no binding. */
function installLimiter(harness: EntryPointHarness) {
  const values = new Map<string, unknown>();
  const host: ReservationHost = {
    storage: {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async <T>(key: string, value: T) => {
        values.set(key, structuredClone(value));
      },
    },
    blockConcurrencyWhile: (callback) => callback(),
  };
  const limiter = new ReservationCoordinator(host, () => harness.clock.now());
  harness.env.__PROVIDER_RATE_LIMITER = {
    reserve: (sourceId) => limiter.reserve(sourceId),
    recordRateLimited: async (sourceId, retryAfter) => {
      await limiter.recordRateLimit(sourceId, retryAfter);
    },
  };
}

describe('optional egress through Worker entry points', () => {
  it('withholds three resources on the November driver gaps despite 25 HTTP 200 responses, preserving published facts', async () => {
    // Synthetic model of the reported counts, NOT a November capture/replay.
    // Only these exact diagnostic keys come from the operator's report;
    // `rafael_camara` resolves since P0 (reviewed in staging catalog R1).
    const unmapped = ['gabriele_mini', 'freddie_slater', 'nikola_tsolov'];
    const harness = await EntryPointHarness.create('local', bind, {
      env: { ...proxy, __PROVIDER_TRANSPORT: undefined },
    });
    serve(harness, origin);
    await harness.published();
    harness.server.results.set(1, 'A');
    const published = await harness.manual(tickAfter(1, 6));
    expect(published.body.data).toMatchObject({
      publication: { outcome: 'published', publishCalls: 1 },
    });
    const version = harness.activeVersion()!;
    const storage = harness.harness.storage;
    const inventory = (await storage.readVersionInventory(2026, version))!;
    expect(inventory).toContain('grand-prix:1:results');
    expect(inventory).toContain('drivers');
    const readDocuments = () =>
      Promise.all(
        inventory.map((name) =>
          storage.readVersionedDocument(2026, version, name),
        ),
      );
    const documents = structuredClone(await readDocuments());
    const accepted = (await harness.round(1))!.contentRevision;
    expect(accepted).not.toBeNull();

    for (let round = 2; round <= 20; round++) {
      harness.server.results.set(round, 'A');
    }
    harness.server.answers.set(paths.drivers, () => ({
      kind: 'json',
      body: driversEnvelope([
        ...fullSeasonDriverRows(),
        ...unmapped.map((driverId) => ({ driverId })),
      ]),
    }));
    const replaceDrivers = (rows: Record<string, unknown>[]) =>
      rows.map((row, index) =>
        index < unmapped.length
          ? { ...row, Driver: { driverId: unmapped[index] } }
          : row,
      );
    harness.server.answers.set(paths.driverStandings, () => ({
      kind: 'json',
      body: driverStandingsEnvelope(replaceDrivers(baseDriverRows()), {
        round: '20',
        listRound: '20',
      }),
    }));
    harness.server.answers.set(paths.results(1), () => ({
      kind: 'json',
      body: resultsEnvelope(replaceDrivers(baseRows())),
    }));

    network.mockClear();
    const failed = await harness.manual(tickAfter(20, 6));
    expect(network).toHaveBeenCalledTimes(25);
    for (const result of network.mock.results) {
      expect(((await result.value) as Response).status).toBe(200);
    }
    expect(failed.requests).not.toContain(paths.constructors);
    expect(failed.body.data).toMatchObject({
      status: 'observed',
      coordination: 'completed',
      providerRequests: 25,
      committed: true,
      publication: {
        outcome: 'withheld',
        cause: 'classification-unavailable',
        publishCalls: 0,
      },
      leaseRelease: 'released',
    });
    expect(failed.logs).toContainEqual(
      expect.objectContaining({
        operation: 'provider.coordination.completed',
        coordinationSelected: 22,
        coordinationUnavailable: 3,
      }),
    );
    const mappingFailures = failed.logs.filter(
      (event) => event.operation === 'provider.mapping.resolve',
    );
    // Each unmapped key fails once per affected resource: 3 keys x 3.
    expect(mappingFailures).toHaveLength(9);
    expect(
      failed.logs
        .filter(
          (event) =>
            event.operation === 'provider.coordination.selection' &&
            event.coordinationOutcome === 'unavailable',
        )
        .map((event) => event.coordinationResource)
        .sort(),
    ).toEqual([
      'driver-standings',
      'season-participants',
      'session-classification',
    ]);
    for (const providerMappingValue of unmapped) {
      expect(mappingFailures).toContainEqual(
        expect.objectContaining({
          providerMappingValue,
          providerMappingFailure: 'unmapped',
          providerMappingEntity: 'driver',
          providerMappingField: 'driverId',
          providerSourceId: 'jolpica',
          season: 2026,
        }),
      );
    }
    expect([failed.prepares, failed.finalizes, failed.storageWrites]).toEqual([
      0, 0, 0,
    ]);
    expect(harness.activeVersion()).toBe(version);
    expect(await readDocuments()).toEqual(documents);
    expect((await harness.round(1))!.contentRevision).toBe(accepted);
    expect(failed.ledgerCalls).toContain('commit');
    expect(failed.ledgerCalls).toContain('releaseLease');
  });

  it.each(['manual', 'scheduled'] as const)(
    'selects proxy and restores direct transport with all proxy settings removed (%s)',
    async (trigger) => {
      const harness = await EntryPointHarness.create('local', bind, {
        env: { ...proxy, __PROVIDER_TRANSPORT: undefined },
      });
      serve(harness, origin);
      await harness[trigger](PRE_SEASON);
      expect(network).toHaveBeenCalled();
      const proxyPaths = network.mock.calls.map(
        ([request]) => new URL(request.url).pathname,
      );
      expect(proxyPaths).toEqual(['/ergast/f1/2026/races/']);

      delete harness.env.JOLPICA_TRANSPORT;
      delete harness.env.JOLPICA_PROXY_ORIGIN;
      delete harness.env.JOLPICA_PROXY_TOKEN;
      network.mockClear();
      serve(harness, 'https://api.jolpi.ca');
      await harness[trigger](later(PRE_SEASON, 24 * HOUR));
      expect(network).toHaveBeenCalled();
      expect(
        network.mock.calls.map(([request]) => new URL(request.url).pathname),
      ).toEqual(seasonPaths.map((path) => `/ergast/f1/2026${path}`));
    },
  );

  it('keeps the test hook first, even with incomplete proxy settings', async () => {
    const harness = await EntryPointHarness.create('local', bind, {
      env: { JOLPICA_TRANSPORT: 'proxy' },
    });
    const result = await harness.manual(PRE_SEASON);
    expect(result.requests.length).toBeGreaterThan(0);
    expect(network).not.toHaveBeenCalled();
  });

  it.each([
    { ...proxy, JOLPICA_PROXY_TOKEN: undefined },
    { ...proxy, JOLPICA_PROXY_ORIGIN: 'https://api.jolpi.ca' },
    { ...proxy, JOLPICA_TRANSPORT: 'proxi' },
    { ...proxy, CONTROLLED_PROVIDER_SOURCE: 'kv' },
  ])(
    'fails configuration closed before reservation, traffic or publication (%#)',
    async (env) => {
      const harness = await EntryPointHarness.create('local', bind, {
        env: { ...env, __PROVIDER_TRANSPORT: undefined },
      });
      const previous = harness.activeVersion();
      const result = await harness.manual(PRE_SEASON);
      expect(result.status).toBe(500);
      expect([
        result.reservations,
        result.prepares,
        result.storageWrites,
      ]).toEqual([0, 0, 0]);
      expect(network).not.toHaveBeenCalled();
      expect(harness.activeVersion()).toBe(previous);
      expect(JSON.stringify(result)).not.toContain(token);
      const scheduled = await harness.scheduled(PRE_SEASON);
      expect([
        scheduled.reservations,
        scheduled.prepares,
        scheduled.storageWrites,
      ]).toEqual([0, 0, 0]);
      expect(network).not.toHaveBeenCalled();
    },
  );

  it('keeps the controlled KV path offline with direct mode and leftover proxy settings', async () => {
    const kv = new MemoryKv();
    const read = vi.spyOn(kv, 'get');
    const harness = await EntryPointHarness.create('local', bind, {
      env: {
        ...proxy,
        JOLPICA_TRANSPORT: 'direct',
        CONTROLLED_PROVIDER_SOURCE: 'kv',
        GRIDVIEW_DATA: kv as unknown as KVNamespace,
        __PROVIDER_TRANSPORT: undefined,
      },
    });
    await harness.manual(PRE_SEASON);
    expect(read).toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });

  it('retains the durable 429 hold, last release and pacing across proxy disable/removal', async () => {
    const harness = await EntryPointHarness.create('local', bind, {
      env: { ...proxy, __PROVIDER_TRANSPORT: undefined },
    });
    installLimiter(harness);
    serve(harness, origin);
    const release = await harness.published();
    harness.server.results.set(1, 'A');
    harness.server.answers.set(paths.drivers, () => ({
      kind: 'status',
      status: 429,
      headers: {
        'Retry-After': '7200',
        server: 'cloudflare',
        'cf-ray': 'abcdef0123456789-DUB',
      },
    }));
    const refused = await harness.manual(tickAfter(1, 6));
    expect(refused.requests).toEqual(seasonPaths.slice(0, 3));
    expect(refused.body.data).toMatchObject({
      providerRequests: 3,
      publication: { outcome: 'withheld', publishCalls: 0 },
    });
    expect(harness.activeVersion()).toBe(release);
    expect(JSON.stringify(refused.logs)).not.toContain(token);
    const hold = (await harness.round(1))!.limiterDeferralUntil!;

    delete harness.env.JOLPICA_TRANSPORT;
    delete harness.env.JOLPICA_PROXY_ORIGIN;
    delete harness.env.JOLPICA_PROXY_TOKEN;
    network.mockClear();
    serve(harness, 'https://api.jolpi.ca');
    const deferred = await harness.manual(later(hold, -MINUTE));
    expect(deferred.requests).toEqual([]);
    expect(network).not.toHaveBeenCalled();
    expect(harness.activeVersion()).toBe(release);

    harness.server.answers.delete(paths.drivers);
    const times: number[] = [];
    harness.server.onRequest = () => {
      times.push(harness.clock.now().getTime());
    };
    const recovered = await harness.manual(later(hold, MINUTE));
    expect(recovered.requests).toEqual([...seasonPaths, paths.results(1)]);
    expect(recovered.body.data).toMatchObject({
      publication: { outcome: 'published' },
    });
    for (let i = 1; i < times.length; i++)
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(3500);
    expect(harness.activeVersion()).not.toBe(release);
  });

  it('withholds publication on proxy outage without falling back', async () => {
    const harness = await EntryPointHarness.create('local', bind, {
      env: { ...proxy, __PROVIDER_TRANSPORT: undefined },
    });
    serve(harness, origin);
    const release = await harness.published();
    network.mockClear().mockImplementation(async (forwarded) => {
      forwardedRequests.push({ request: forwarded, expectedOrigin: origin });
      throw new Error(token);
    });
    const failed = await harness.manual(tickAfter(1, 6));
    expect(network).toHaveBeenCalled();
    expect(failed.body.data).toMatchObject({
      publication: { outcome: 'withheld', publishCalls: 0 },
    });
    expect(failed.storageWrites).toBe(0);
    expect(harness.activeVersion()).toBe(release);
    expect(JSON.stringify(failed)).not.toContain(token);
  });
});
