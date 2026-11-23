import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { prepareSeed } from '../../../src/identity/catalog/seed';
import { loadCorpus } from '../../../scripts/identity/corpus.mjs';
import type { SeedArtifact } from '../../../src/identity/catalog/model';
import { IdentityCatalog } from '../../../src/identity/durable-object';
import type { ReconciliationLedgerPort } from '../../../src/sync/coordinated/ledger-port';
import type { IdentityRunContext } from '../../../src/identity/catalog/run-context';
import { composeCoordinatedRuntime } from '../../../src/sync/coordinated/composition';
import { sqliteHost } from '../../identity/catalog/sqlite-support';
import {
  setup,
  installation,
  validateAndActivate,
} from '../../identity/catalog/u4-support';
import { profileProposal } from '../../identity/catalog/u6-support';
import {
  EntryPointHarness,
  type LedgerBinding,
  ADMIN_TOKEN,
  PUBLIC_BASE_URL,
} from './entry-points/support';
import { paths, tickAfter, PRE_SEASON } from './observation/support';
import { observeCoordinatedSeason } from '../../../src/sync/coordinated/observation';
import { LEASE_TTL_MS } from '../../../src/sync/coordinated/ledger';
import { forbidNetwork } from '../../identity/discovery/support';
import worker from '../../../src/index';
import {
  createHarness,
  seedPublishedSnapshot,
  adminRequest,
  request as publicRequest,
  providerCalls,
} from '../../support/edge-harness';
const injected = vi.hoisted(() => ({ ledger: null as LedgerBinding }));
vi.mock('../../../src/sync/coordinated/ledger-port', async (original) => ({
  ...(await original<
    typeof import('../../../src/sync/coordinated/ledger-port')
  >()),
  resolveReconciliationLedger: (): ReconciliationLedgerPort | null =>
    injected.ledger?.() ?? null,
}));
vi.mock('../../../src/sync/coordinated/composition', async (original) => {
  const actual =
    await original<
      typeof import('../../../src/sync/coordinated/composition')
    >();
  return {
    ...actual,
    composeCoordinatedRuntime: vi.fn(actual.composeCoordinatedRuntime),
  };
});
let seed: SeedArtifact;
const hosts: ReturnType<typeof sqliteHost>[] = [];
beforeAll(async () => {
  seed = await prepareSeed(loadCorpus('p0'));
});
beforeEach(() => {
  forbidNetwork();
  vi.mocked(composeCoordinatedRuntime).mockClear();
});
afterEach(() => {
  for (const h of hosts.splice(0)) h.db.close();
  vi.unstubAllGlobals();
  injected.ledger = null;
});
async function catalog() {
  const host = sqliteHost();
  hosts.push(host);
  const f = await setup(host.storage, seed);
  let object = new IdentityCatalog(
    { storage: host.storage },
    { IDENTITY_INSTALLATION_ID: installation },
    true,
  );
  const calls: string[] = [];
  let available = true;
  const namespace = {
    idFromName: (s: string) => s,
    get: () => ({
      fetch: (url: string, init: RequestInit) => {
        if (!available) throw Error('catalog outage');
        calls.push(url);
        return object.fetch(new Request(url, init));
      },
    }),
  };
  return {
    host,
    f,
    namespace,
    calls,
    outage: () => {
      available = false;
    },
    restart: () => {
      available = true;
      object = new IdentityCatalog(
        { storage: host.storage },
        { IDENTITY_INSTALLATION_ID: installation },
        true,
      );
    },
  };
}
const context = () =>
  vi
    .mocked(composeCoordinatedRuntime)
    .mock.calls.at(-1)?.[1] as IdentityRunContext;
async function documents(h: EntryPointHarness) {
  const version = h.activeVersion()!;
  const inventory = (await h.harness.storage.readVersionInventory(
    2026,
    version,
  ))!;
  return Promise.all(
    inventory.map((name) =>
      h.harness.storage.readVersionedDocument(2026, version, name),
    ),
  );
}
describe('U6 operational admission and whole-season parity', () => {
  it('refuses runtime use of the legacy mock provider while keeping existing public snapshots readable', async () => {
    const h = createHarness();
    await seedPublishedSnapshot(h);
    const active = await h.storage.getActiveVersion(2026),
      calls = providerCalls(h.provider);
    h.env.IDENTITY_CATALOG_MODE = 'runtime';
    const result = await worker.fetch(
      adminRequest('/internal/admin/sync/full?season=2026'),
      h.env,
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      data: { status: 'failed', failureCategory: 'provider-unavailable' },
    });
    expect(providerCalls(h.provider)).toBe(calls);
    expect(await h.storage.getActiveVersion(2026)).toBe(active);
    expect(
      (await worker.fetch(publicRequest('/v1/bootstrap'), h.env)).status,
    ).toBe(200);
  });
  it.each(['manual', 'scheduled'] as const)(
    '%s R0 bundled/compare/runtime preserve all normalized outputs, documents, hashes, guards and provider counts',
    async (trigger) => {
      const c = await catalog(),
        outcomes = [];
      for (const mode of ['bundled', 'compare', 'runtime'] as const) {
        const h = await EntryPointHarness.create('local', (binding) => {
          injected.ledger = binding;
        });
        await h.published();
        h.server.results.set(1, 'A');
        h.env.IDENTITY_CATALOG_MODE = mode;
        h.env.IDENTITY_INSTALLATION_ID = installation;
        h.env.IDENTITY_CATALOG = c.namespace;
        const result = await h[trigger](tickAfter(1, 6));
        expect(result.requests).toContain(paths.calendar);
        expect(result.requests).toContain(paths.circuits);
        expect(result.requests).toContain(paths.drivers);
        expect(result.requests).toContain(paths.constructors);
        expect(result.requests).toContain(paths.driverStandings);
        expect(result.requests).toContain(paths.constructorStandings);
        expect(result.requests).toContain('/1/results/');
        const ctx = context();
        expect(ctx.authority).toBe(mode === 'runtime' ? 'runtime' : 'bundled');
        const composed = vi
          .mocked(composeCoordinatedRuntime)
          .mock.results.at(-1)!.value;
        if (composed.kind !== 'composed') throw Error('not composed');
        for (const port of Object.values(composed.runtime.ports))
          expect((port as unknown as { registry: unknown }).registry).toBe(
            ctx.registry,
          );
        outcomes.push({
          requests: result.requests,
          reservations: result.reservations,
          prepares: result.prepares,
          finalizes: result.finalizes,
          snapshot: await h.snapshot(),
          documents: await documents(h),
        });
      }
      expect(outcomes[1]).toEqual(outcomes[0]);
      expect(outcomes[2]).toEqual(outcomes[0]);
      expect(c.calls).toHaveLength(2);
    },
  );
  it.each([
    'missing-binding',
    'missing-installation',
    'wrong-installation',
    'paused',
    'no-head',
    'invalid-schema',
    'invalid-profile',
  ] as const)(
    'fails closed before any provider/publication request and releases the lease: %s',
    async (fault) => {
      const c = await catalog(),
        h = await EntryPointHarness.create('local', (binding) => {
          injected.ledger = binding;
        });
      await h.published();
      const active = h.activeVersion();
      h.env.IDENTITY_CATALOG_MODE = 'runtime';
      h.env.IDENTITY_INSTALLATION_ID = installation;
      h.env.IDENTITY_CATALOG = c.namespace;
      if (fault === 'missing-binding') delete h.env.IDENTITY_CATALOG;
      if (fault === 'missing-installation')
        delete h.env.IDENTITY_INSTALLATION_ID;
      if (fault === 'wrong-installation')
        h.env.IDENTITY_INSTALLATION_ID = crypto.randomUUID();
      if (['paused', 'no-head', 'invalid-schema'].includes(fault)) {
        const head = c.f.workflow.head();
        c.host.db.prepare('UPDATE identity_catalog_head SET body=?').run(
          JSON.stringify({
            ...head,
            ...(fault === 'paused'
              ? { admissionState: 'paused' }
              : fault === 'no-head'
                ? { activeRevisionId: null }
                : { schemaVersion: 99 }),
          }),
        );
      }
      if (fault === 'invalid-profile')
        c.host.db.exec('DELETE FROM identity_catalog_drivers');
      const result = await h.manual(tickAfter(1, 6));
      expect(result.requests).toEqual([]);
      expect(result.prepares).toBe(0);
      expect(result.finalizes).toBe(0);
      expect(result.storageWrites).toBe(0);
      expect(h.activeVersion()).toBe(active);
      expect(result.ledgerCalls.at(-1)).toBe('releaseLease');
      expect(result.body).toMatchObject({
        data: {
          status: 'failed',
          stage: 'identity',
          failure: expect.stringMatching(/^catalog-(invalid|unavailable)$/),
          providerRequests: 0,
          leaseRelease: 'released',
        },
      });
    },
  );
  it('pins R10 before the first request, survives R11 activation and catalog outage, and adopts R11 only on the next run', async () => {
    const c = await catalog(),
      next = await profileProposal(c.f),
      h = await EntryPointHarness.create('local', (binding) => {
        injected.ledger = binding;
      });
    await h.published();
    h.server.results.set(1, 'A');
    h.env.IDENTITY_CATALOG_MODE = 'runtime';
    h.env.IDENTITY_INSTALLATION_ID = installation;
    h.env.IDENTITY_CATALOG = c.namespace;
    const transport = h.server.transport;
    let activated = false;
    h.env.__PROVIDER_TRANSPORT = async (req) => {
      expect(
        c.host.db.prepare('SELECT COUNT(*) n FROM identity_run_pins').get(),
      ).toEqual({ n: 1 });
      if (!activated) {
        activated = true;
        await validateAndActivate(c.f, next.revisionId);
        c.outage();
      }
      return transport(req);
    };
    const runA = await h.manual(tickAfter(1, 6)),
      a = context();
    expect(runA.finalizes).toBe(1);
    expect(c.calls).toHaveLength(1);
    expect(a.revisionId).toBe(c.f.root.revisionId);
    expect(
      a.participants.driverById(seed.snapshot.drivers[0]!.profile.id)?.fullName,
    ).toBe(seed.snapshot.drivers[0]!.profile.fullName);
    const aDocuments = await documents(h);
    expect(JSON.stringify(aDocuments)).not.toContain(
      'Synthetic U6 Reviewed Profile',
    );
    h.env.IDENTITY_CATALOG = c.namespace;
    h.env.__PROVIDER_TRANSPORT = transport;
    c.restart();
    const runB = await h.manual(tickAfter(1, 7)),
      b = context();
    expect(b.revisionId).toBe(next.revisionId);
    expect(
      b.participants.driverById(seed.snapshot.drivers[0]!.profile.id)?.fullName,
    ).toBe('Synthetic U6 Reviewed Profile');
    expect(b.datasetVersion).not.toBe(a.datasetVersion);
    expect(runB.finalizes).toBe(1);
    expect(c.calls).toHaveLength(2);
    const aRound = aDocuments.find(
      (d) => d?.documentName === 'grand-prix:1:results',
    )!;
    const bRound = (await documents(h)).find(
      (d) => d?.documentName === 'grand-prix:1:results',
    )!;
    expect(aRound.data).toEqual(bRound.data);
    expect((await h.round(1))?.stagedCorrection).toBeNull();
  });
  it('skips catalog admission when scheduled planning finds nothing due', async () => {
    const h = await EntryPointHarness.create('local', (binding) => {
      injected.ledger = binding;
    });
    await h.published();
    h.env.IDENTITY_CATALOG_MODE = 'runtime';
    h.env.IDENTITY_INSTALLATION_ID = installation;
    const result = await h.scheduled(
      new Date(Date.parse(PRE_SEASON) + 60 * 60 * 1000 + 1).toISOString(),
    );
    expect(result.requests).toEqual([]);
    expect(
      vi.mocked(composeCoordinatedRuntime).mock.calls.at(-1)?.[0].identity
        ?.mode,
    ).not.toBe('runtime');
  });
  it('raw calendar and egress diagnostics consume no identity mappings and acquire no pin', async () => {
    const h = await EntryPointHarness.create('local', (binding) => {
      injected.ledger = binding;
    });
    await h.published();
    h.env.IDENTITY_CATALOG_MODE = 'runtime';
    h.env.IDENTITY_CATALOG = {
      idFromName: () => {
        throw Error('diagnostic must not pin');
      },
      get: () => {
        throw Error('diagnostic must not pin');
      },
    };
    const request = new Request(
      PUBLIC_BASE_URL +
        '/internal/admin/provider/jolpica/calendar-once?season=2026',
      { method: 'POST', headers: { Authorization: 'Bearer ' + ADMIN_TOKEN } },
    );
    const result = await h.admin(tickAfter(1, 6), request);
    expect(result.status).toBe(200);
    expect(result.requests).toEqual([paths.calendar]);
    expect(result.finalizes).toBe(0);
    expect(result.ledgerCalls).toEqual([]);
    const sent: string[] = [];
    h.env.__PROVIDER_TRANSPORT = async (req) => {
      sent.push(new URL(req.url).pathname);
      return new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const probe = await h.admin(
      tickAfter(1, 7),
      new Request(
        PUBLIC_BASE_URL + '/internal/admin/provider/jolpica/egress-identity',
        { method: 'POST', headers: { Authorization: 'Bearer ' + ADMIN_TOKEN } },
      ),
    );
    expect(probe.status).toBe(200);
    expect(sent).toEqual(['/test/']);
    expect(probe.finalizes).toBe(0);
    expect(probe.storageWrites).toBe(0);
    expect(probe.ledgerCalls).toEqual([]);
  });
  it.each(['cancelled', 'coordination-budget', 'lease-expired'] as const)(
    'makes no request when %s occurs during catalog loading',
    async (fault) => {
      const c = await catalog(),
        h = await EntryPointHarness.create('local', (binding) => {
          injected.ledger = binding;
        });
      await h.published();
      h.clock.set(tickAfter(1, 6));
      const original = c.namespace.get,
        controller = new AbortController();
      const namespace = {
        ...c.namespace,
        get: () => ({
          fetch: async (url: string, init: RequestInit) => {
            const response = await original().fetch(url, init);
            if (fault === 'cancelled') controller.abort();
            else
              h.clock.advance(
                fault === 'lease-expired' ? LEASE_TTL_MS : 240001,
              );
            return response;
          },
        }),
      };
      const deps = h.harness.dependencies(),
        requests = h.server.requests.length,
        publications = h.harness.publishGuarded.mock.calls.length;
      const result = await observeCoordinatedSeason(
        { season: 2026, trigger: 'manual', signal: controller.signal },
        {
          ...deps,
          identity: {
            mode: 'runtime',
            installationId: installation,
            namespace,
          },
        },
      );
      expect(result).toMatchObject({ status: 'failed', providerRequests: 0 });
      expect(h.server.requests).toHaveLength(requests);
      expect(h.harness.publishGuarded).toHaveBeenCalledTimes(publications);
      if (result.status === 'failed')
        expect(['released', 'refused']).toContain(result.leaseRelease);
    },
  );
});
