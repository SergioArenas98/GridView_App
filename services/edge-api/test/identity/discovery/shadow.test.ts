import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createShadowDiscovery,
  type DiscoverySink,
} from '../../../src/identity/discovery/persist';
import { shadowDiscoveryFor } from '../../../src/identity/factory';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  providerMappingRegistry,
  buildProviderMappingRegistry,
} from '../../../src/providers/mappings';
import {
  JolpicaCalendarPort,
  JolpicaCircuitsPort,
  JolpicaParticipantsPort,
  JolpicaResultsPort,
  JolpicaStandingsPort,
} from '../../../src/providers/jolpica';
import type { ProviderHttpClient } from '../../../src/providers/http/provider-http-client';
import type { IdentityPort } from '../../../src/identity/port';
import type { ProviderResourceRequest } from '../../../src/providers/coordination';
import {
  context,
  driverInput,
  driversEnvelope,
  fixtures,
  forbidNetwork,
} from './support';
const logger = new CapturingLogger();
function client(
  observe = vi.fn(async () => ({
    persisted: 1,
    replayed: 0,
    created: 1,
    dropped: 0,
  })),
) {
  return { observe } as unknown as IdentityPort;
}
function session(
  port: IdentityPort,
  background?: { waitUntil(p: Promise<unknown>): void },
) {
  return createShadowDiscovery({
    client: port,
    context,
    clock: () => Date.parse(context.observedAt),
    logger,
    background,
  });
}
beforeEach(forbidNetwork);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('bounded shadow background delivery', () => {
  it('does not touch a binding or create work when disabled', async () => {
    const get = vi.fn(() => {
      throw Error('binding accessed');
    });
    const env = Object.defineProperty({}, 'IDENTITY_CATALOG', { get });
    expect(await shadowDiscoveryFor(env, logger, Date.now)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
  it('contains missing bindings and missing execution contexts', async () => {
    expect(
      await shadowDiscoveryFor(
        { IDENTITY_DISCOVERY_MODE: 'shadow' },
        logger,
        Date.now,
        { waitUntil: vi.fn() },
      ),
    ).toBeNull();
    expect(
      await shadowDiscoveryFor(
        { IDENTITY_DISCOVERY_MODE: 'shadow' },
        logger,
        Date.now,
      ),
    ).toBeNull();
  });
  it('captures before normalizing but writes only in the caught final background task', async () => {
    const store = client(),
      tasks: Promise<unknown>[] = [];
    const s = session(store, { waitUntil: (p) => tasks.push(p) });
    const body = driversEnvelope([
      { driverId: 'synthetic_unknown', givenName: 'Do not log this' },
    ]);
    s.capture(driverInput(body), body, providerMappingRegistry());
    expect(store.observe).not.toHaveBeenCalled();
    s.finish();
    s.finish();
    expect(tasks).toHaveLength(1);
    await Promise.all(tasks);
    expect(store.observe).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.events)).not.toContain('Do not log this');
  });
  it('retries a settled storage failure once with exactly the same observations', async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(Error('private body'))
      .mockResolvedValue({ persisted: 1, replayed: 0, created: 1, dropped: 0 });
    const s = session(client(write));
    const body = driversEnvelope([{ driverId: 'synthetic_unknown' }]);
    s.capture(driverInput(body), body, providerMappingRegistry());
    await s.drain();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0]).toEqual(write.mock.calls[1]);
    expect(JSON.stringify(logger.events)).not.toContain('private body');
  });
  it('does not retry an in-flight timed-out write or extend its two-second budget', async () => {
    const write = vi.fn(() => new Promise<never>(() => {}));
    const s = session(client(write));
    const body = driversEnvelope([{ driverId: 'synthetic_unknown' }]);
    s.capture(driverInput(body), body, providerMappingRegistry());
    await s.drain();
    expect(write).toHaveBeenCalledTimes(1);
  }, 4000);
  it('allows loss before final handoff, and contains a rejected background sink', async () => {
    const write = vi.fn(async () => ({
        persisted: 1,
        replayed: 0,
        created: 1,
        dropped: 0,
      })),
      body = driversEnvelope([{ driverId: 'synthetic_unknown' }]);
    const terminated = session(client(write));
    terminated.capture(driverInput(body), body, providerMappingRegistry());
    await new Promise((r) => setTimeout(r, 10));
    expect(write).not.toHaveBeenCalled();
    const broken = session(client(write), {
      waitUntil: () => {
        throw Error('sink');
      },
    });
    broken.capture(driverInput(body), body, providerMappingRegistry());
    expect(() => broken.finish()).not.toThrow();
    await broken.drain();
  });
  it('ignores malformed resources and known identities', async () => {
    const write = vi.fn();
    const s = session(client(write));
    for (const body of [
      driversEnvelope([{ driverId: 'norris' }]),
      driversEnvelope([{ driverId: 'synthetic_unknown' }], { total: '2' }),
    ])
      s.capture(driverInput(body), body, providerMappingRegistry());
    await s.drain();
    expect(write).not.toHaveBeenCalled();
  });
  it('bounds pending extraction and preserves admitted evidence on overflow', async () => {
    const logStart = logger.events.length;
    const write = vi.fn(async () => ({
        persisted: 1,
        replayed: 0,
        created: 1,
        dropped: 0,
      })),
      s = session(client(write));
    const body = driversEnvelope(
      Array.from({ length: 100 }, (_, i) => ({ driverId: 'synthetic_' + i })),
    );
    for (let i = 0; i < 100; i++)
      s.capture(driverInput(body), body, providerMappingRegistry());
    await s.drain();
    const events = logger.events.slice(logStart);
    expect(
      events.filter((e) => e.identityDiscoveryReason === 'extraction-busy'),
    ).toHaveLength(1);
    expect(
      events.filter((e) => e.operation === 'identity.discovery.observed'),
    ).toMatchObject([{ identitySkippedCaptures: 92 }]);
    expect(write.mock.calls.length).toBeGreaterThan(0);
    expect(write.mock.calls.length).toBeLessThanOrEqual(20);
    for (const [payload] of write.mock.calls as unknown as [
      { observations: unknown[] },
    ][])
      expect(payload.observations.length).toBeLessThanOrEqual(100);
  });
});
const empty = buildProviderMappingRegistry([], {
  driver: new Set(),
  constructor: new Set(),
  circuit: new Set(),
  event: new Set(),
});
describe('all resource ports preserve normalization and request order', () => {
  it.each(fixtures().map((f) => [f.input.endpointKind, f] as const))(
    '%s shadow success and failure have off-mode parity',
    async (kind, f) => {
      const registry =
        kind === 'season-drivers' || kind === 'season-constructors'
          ? providerMappingRegistry()
          : empty;
      const make = async (discovery?: DiscoverySink) => {
        const bodies =
          kind === 'season-constructors'
            ? [driversEnvelope([{ driverId: 'norris' }]), f.body]
            : [f.body];
        const calls: string[] = [];
        const http = {
          getJson: vi.fn(async (r: { path: string }) => {
            calls.push(r.path);
            return { ok: true, data: bodies.shift() };
          }),
        } as unknown as ProviderHttpClient;
        const options = {
          client: http,
          logger,
          registry,
          discovery,
          reference: () => 'same-attempt',
        };
        const port =
          kind === 'season-calendar'
            ? new JolpicaCalendarPort(options)
            : kind === 'season-circuits'
              ? new JolpicaCircuitsPort(options)
              : kind === 'race-results'
                ? new JolpicaResultsPort(options)
                : kind.endsWith('standings')
                  ? new JolpicaStandingsPort(options)
                  : new JolpicaParticipantsPort(options);
        const resource =
          kind === 'race-results'
            ? {
                kind: 'session-classification',
                season: 2026,
                round: 1,
                sessionType: 'race',
              }
            : {
                kind:
                  kind === 'season-drivers' || kind === 'season-constructors'
                    ? 'season-participants'
                    : kind,
                season: 2026,
              };
        const outcome = await port.fetchResource({
          source: 'jolpica',
          resource,
        } as ProviderResourceRequest);
        return { outcome, calls };
      };
      const off = await make();
      for (const failing of [false, true]) {
        const write = vi.fn(async () => {
          if (failing) throw Error('storage unavailable');
          return { persisted: 1, replayed: 0, created: 1, dropped: 0 };
        });
        const s = session(client(write));
        expect(await make(s)).toEqual(off);
        await s.drain();
        expect(write).toHaveBeenCalled();
      }
      expect(
        await make({
          capture: () => {
            throw Error('collector');
          },
        }),
      ).toEqual(off);
      expect(fetch).not.toHaveBeenCalled();
      if (kind === 'season-drivers') expect(off.calls).toHaveLength(1);
      if (kind === 'season-constructors') expect(off.calls).toHaveLength(2);
    },
  );
});
