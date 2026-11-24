import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../../../src/index';
import type { ReconciliationLedgerPort } from '../../../src/sync/coordinated/ledger-port';
import { IdentityCatalog } from '../../../src/identity/durable-object';
import { IdentityClient } from '../../../src/identity/client';
import { sqliteHost } from '../catalog/sqlite-support';
import {
  EntryPointHarness,
  type LedgerBinding,
} from '../../sync/coordinated/entry-points/support';
import { paths, tickAfter } from '../../sync/coordinated/observation/support';
import {
  driversEnvelope,
  fullSeasonDriverRows,
} from '../../providers/jolpica/participants-support';
import { forbidNetwork } from './support';
const injected = vi.hoisted(() => ({ ledger: null as LedgerBinding }));
vi.mock('../../../src/sync/coordinated/ledger-port', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../src/sync/coordinated/ledger-port')
    >();
  return {
    ...actual,
    resolveReconciliationLedger: (): ReconciliationLedgerPort | null =>
      injected.ledger?.() ?? null,
  };
});
const installation = '33333333-3333-4333-8333-333333333333';
const fetchOriginal = worker.fetch,
  scheduledOriginal = worker.scheduled;
const bind = (binding: LedgerBinding) => {
  injected.ledger = binding;
};
beforeEach(forbidNetwork);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  injected.ledger = null;
});
describe('complete Worker synchronization shadow parity', () => {
  it.each(['manual', 'scheduled'] as const)(
    '%s preserves publication, reconciliation and provider sequencing with discovery success/failure',
    async (trigger) => {
      const outcomes = [];
      for (const mode of ['off', 'shadow', 'throw', 'missing'] as const) {
        const h = await EntryPointHarness.create('local', bind);
        await h.published();
        h.server.results.set(1, 'A');
        const host = sqliteHost(),
          object = new IdentityCatalog(
            { storage: host.storage },
            { IDENTITY_INSTALLATION_ID: installation },
          );
        const writes = vi.fn((url: string, init: RequestInit) => {
          if (mode === 'throw') throw Error('storage');
          return object.fetch(new Request(url, init));
        });
        const namespace = {
          idFromName: (s: string) => s,
          get: () => ({ fetch: writes }),
        };
        h.env.IDENTITY_DISCOVERY_MODE = mode === 'off' ? 'off' : 'shadow';
        h.env.IDENTITY_INSTALLATION_ID = installation;
        if (mode !== 'missing') h.env.IDENTITY_CATALOG = namespace;
        const tasks: Promise<unknown>[] = [];
        const ctx = {
          waitUntil: (p: Promise<unknown>) => tasks.push(p),
        } as unknown as ExecutionContext;
        vi.spyOn(worker, 'fetch').mockImplementation((request, env) =>
          fetchOriginal(request, env, ctx),
        );
        vi.spyOn(worker, 'scheduled').mockImplementation(
          async (controller, env) => {
            await scheduledOriginal(controller, env, ctx);
            for (let i = 0; i < tasks.length; i++) await tasks[i];
          },
        );
        const result = await h[trigger](tickAfter(1, 6));
        await Promise.all(tasks);
        outcomes.push({
          requests: result.requests,
          reservations: result.reservations,
          prepares: result.prepares,
          finalizes: result.finalizes,
          storageWrites: result.storageWrites,
          ledgerCalls: result.ledgerCalls,
          snapshot: await h.snapshot(),
          season: await h.season(),
        });
        // AU-D5: the first scheduled sighting stays pending; a manual first write
        // is publishable. Shadow mode must preserve both existing decisions.
        expect(result.finalizes).toBe(trigger === 'manual' ? 1 : 0);
        if (trigger === 'scheduled')
          expect(await h.round(1)).toMatchObject({
            contentRevision: null,
            candidateRevision: expect.stringMatching(/^sha256:/),
          });
        expect(writes).not.toHaveBeenCalled(); // all identities known
        vi.restoreAllMocks();
        host.db.close();
      }
      for (const outcome of outcomes.slice(1))
        expect(outcome).toEqual(outcomes[0]);
    },
  );
  it.each(['manual', 'scheduled'] as const)(
    '%s persists unresolved identities without allowing constructor requests or publication',
    async (trigger) => {
      const results = [];
      for (const mode of ['off', 'shadow', 'throw'] as const) {
        const h = await EntryPointHarness.create('local', bind);
        await h.published();
        h.server.results.set(1, 'A');
        h.server.answers.set(paths.drivers, () => ({
          kind: 'json',
          body: driversEnvelope([
            ...fullSeasonDriverRows(),
            {
              driverId: 'synthetic_shadow_gap',
              givenName: 'Private Synthetic',
            },
          ]),
        }));
        const host = sqliteHost(),
          object = new IdentityCatalog(
            { storage: host.storage },
            { IDENTITY_INSTALLATION_ID: installation },
          );
        const writes = vi.fn((url: string, init: RequestInit) => {
          if (mode === 'throw') throw Error('private persistence error');
          return object.fetch(new Request(url, init));
        });
        const namespace = {
          idFromName: (s: string) => s,
          get: () => ({ fetch: writes }),
        };
        h.env.IDENTITY_DISCOVERY_MODE = mode === 'off' ? 'off' : 'shadow';
        h.env.IDENTITY_INSTALLATION_ID = installation;
        h.env.IDENTITY_CATALOG = namespace;
        const tasks: Promise<unknown>[] = [];
        const ctx = {
          waitUntil: (p: Promise<unknown>) => tasks.push(p),
        } as unknown as ExecutionContext;
        vi.spyOn(worker, 'fetch').mockImplementation((request, env) =>
          fetchOriginal(request, env, ctx),
        );
        vi.spyOn(worker, 'scheduled').mockImplementation(
          async (controller, env) => {
            await scheduledOriginal(controller, env, ctx);
            for (let i = 0; i < tasks.length; i++) await tasks[i];
          },
        );
        const previous = h.activeVersion();
        const result = await h[trigger](tickAfter(1, 6));
        await Promise.all(tasks);
        expect(h.activeVersion()).toBe(previous);
        expect(result.prepares).toBe(0);
        expect(result.finalizes).toBe(0);
        expect(result.requests).not.toContain(paths.constructors);
        results.push({
          requests: result.requests,
          ledgerCalls: result.ledgerCalls,
          snapshot: await h.snapshot(),
          storageWrites: result.storageWrites,
        });
        if (mode === 'shadow') {
          const health = await new IdentityClient(
            namespace,
            installation,
          ).health();
          expect(health.candidates).toBe(1);
        } else expect(writes).toHaveBeenCalledTimes(mode === 'off' ? 0 : 2);
        expect(
          JSON.stringify(
            h.harness.logger.events.filter((e) =>
              e.operation.startsWith('identity.'),
            ),
          ),
        ).not.toContain('Private Synthetic');
        vi.restoreAllMocks();
        host.db.close();
      }
      expect(results[1]).toEqual(results[0]);
      expect(results[2]).toEqual(results[0]);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
