/**
 * U10: whole-run inventory policy selection, durable pin provenance and
 * batch-v2 reference discrimination (design §6.3, §9.2, §11.1; ADR 0030 D4,
 * ADR 0031 D2/D4).
 *
 * Pure and in-memory. The namespace doubles record what would be sent and
 * never reach a network; the global `fetch` throws.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { unstable_readConfig } from 'wrangler';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConfigurationError,
  resolveOperationalInventoryMode,
} from '../../../src/config/environment';
import {
  decodePinRequest,
  pinInventoryPolicyVersion,
  samePinExecution,
} from '../../../src/identity/catalog/pin-contract';
import {
  CatalogAdmissionError,
  admitIdentityContext,
  bundledRunContext,
  identityConfiguration,
  pinRequestFor,
} from '../../../src/identity/catalog/run-context';
import {
  batchInventoryPolicyFor,
  inventoryPolicyForContext,
  inventoryPolicyVersionFor,
} from '../../../src/identity/inventory/model';
import { CapturingLogger } from '../../../src/logging/logger';

const INSTALLATION = '44444444-4444-4444-8444-444444444444';
const RUN = '55555555-5555-4555-8555-555555555555';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('U10 network forbidden');
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function recordingNamespace(status = 503) {
  const bodies: unknown[] = [];
  return {
    bodies,
    namespace: {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (_url: string, init?: RequestInit) => {
          bodies.push(JSON.parse(String(init?.body)));
          return new Response('{}', { status });
        },
      }),
    },
  };
}

describe('U10 operational inventory selection (§11.1)', () => {
  it('accepts optional-drivers only with runtime authority, a UUID installation and a catalog binding', () => {
    const { namespace } = recordingNamespace();
    expect(
      identityConfiguration({
        IDENTITY_CATALOG_MODE: 'runtime',
        IDENTITY_INSTALLATION_ID: INSTALLATION,
        IDENTITY_CATALOG: namespace as never,
        IDENTITY_INVENTORY_MODE: 'optional-drivers',
      }).inventoryMode,
    ).toBe('optional-drivers');
    const refused = [
      { IDENTITY_CATALOG_MODE: 'bundled' },
      { IDENTITY_CATALOG_MODE: 'compare' },
      { IDENTITY_CATALOG_MODE: 'runtime' },
      {
        IDENTITY_CATALOG_MODE: 'runtime',
        IDENTITY_INSTALLATION_ID: INSTALLATION,
      },
      {
        IDENTITY_CATALOG_MODE: 'runtime',
        IDENTITY_INSTALLATION_ID: 'not-a-uuid',
        IDENTITY_CATALOG: namespace,
      },
      { IDENTITY_CATALOG_MODE: 'runtime', IDENTITY_CATALOG: namespace },
    ];
    for (const env of refused)
      expect(() =>
        identityConfiguration({
          ...env,
          IDENTITY_INVENTORY_MODE: 'optional-drivers',
        } as never),
      ).toThrow(ConfigurationError);
  });

  it('keeps strict the default and refuses unknown values without falling back', () => {
    expect(resolveOperationalInventoryMode(undefined, 'runtime')).toBe(
      'strict',
    );
    expect(resolveOperationalInventoryMode('strict', 'compare')).toBe('strict');
    for (const bad of ['Optional-drivers', 'optional', 'off', ''])
      expect(() => resolveOperationalInventoryMode(bad, 'runtime')).toThrow(
        ConfigurationError,
      );
  });

  it('admits an optional runtime run only through a schema-2 durable pin request', async () => {
    const recorder = recordingNamespace(503);
    await expect(
      admitIdentityContext(
        {
          mode: 'runtime',
          installationId: INSTALLATION,
          namespace: recorder.namespace,
          inventoryMode: 'optional-drivers',
        },
        {
          runId: RUN,
          season: 2026,
          purpose: 'manual',
          leaseFence: 3,
        },
        new CapturingLogger(),
      ),
    ).rejects.toThrow(CatalogAdmissionError);
    // Both bounded attempts carried the identical optional request.
    expect(recorder.bodies).toHaveLength(2);
    expect(recorder.bodies[0]).toEqual({
      schemaVersion: 2,
      runId: RUN,
      installationId: INSTALLATION,
      season: 2026,
      purpose: 'manual',
      leaseFence: 3,
      inventoryPolicy: 'optional-driver-inventory-v1',
    });
    expect(recorder.bodies[1]).toEqual(recorder.bodies[0]);
  });

  it('sends the exact pre-U10 schema-1 request for strict runtime runs', async () => {
    const recorder = recordingNamespace(503);
    await expect(
      admitIdentityContext(
        {
          mode: 'runtime',
          installationId: INSTALLATION,
          namespace: recorder.namespace,
        },
        { runId: RUN, season: 2026, purpose: 'scheduled', leaseFence: null },
        new CapturingLogger(),
      ),
    ).rejects.toThrow(CatalogAdmissionError);
    expect(Object.keys(recorder.bodies[0] as object).sort()).toEqual(
      [
        'installationId',
        'leaseFence',
        'purpose',
        'runId',
        'schemaVersion',
        'season',
      ].sort(),
    );
    expect(
      (recorder.bodies[0] as { schemaVersion: number }).schemaVersion,
    ).toBe(1);
  });

  it('refuses bundled, compare and unknown inventory modes at admission before any catalog call', async () => {
    const recorder = recordingNamespace(200);
    for (const config of [
      { mode: 'bundled' as const, inventoryMode: 'optional-drivers' as const },
      { mode: 'compare' as const, inventoryMode: 'optional-drivers' as const },
      { mode: 'runtime' as const, inventoryMode: 'permissive' as never },
    ]) {
      await expect(
        admitIdentityContext(
          {
            ...config,
            installationId: INSTALLATION,
            namespace: recorder.namespace,
          },
          { runId: RUN, season: 2026, purpose: 'manual', leaseFence: 1 },
          new CapturingLogger(),
        ),
      ).rejects.toMatchObject({ failure: 'catalog-invalid' });
    }
    expect(recorder.bodies).toEqual([]);
  });
});

describe('U10 durable pin request schemas', () => {
  const base = {
    runId: RUN,
    installationId: INSTALLATION,
    season: 2026,
    purpose: 'manual' as const,
    leaseFence: 1,
  };

  it('decodes closed schema-1 and schema-2 requests and nothing in between', () => {
    expect(decodePinRequest({ schemaVersion: 1, ...base })).toEqual({
      schemaVersion: 1,
      ...base,
    });
    const optional = {
      schemaVersion: 2,
      ...base,
      inventoryPolicy: 'optional-driver-inventory-v1',
    };
    expect(decodePinRequest(optional)).toEqual(optional);
    for (const bad of [
      { schemaVersion: 2, ...base },
      { schemaVersion: 2, ...base, inventoryPolicy: 'strict-v1' },
      {
        schemaVersion: 1,
        ...base,
        inventoryPolicy: 'optional-driver-inventory-v1',
      },
      {
        schemaVersion: 3,
        ...base,
        inventoryPolicy: 'optional-driver-inventory-v1',
      },
    ])
      expect(() => decodePinRequest(bad)).toThrow();
  });

  it('treats the same run ID under another policy as a different execution', () => {
    const strict = pinRequestFor(base, 'strict/1');
    const optional = pinRequestFor(base, 'optional-drivers/1');
    expect(strict).toEqual({ schemaVersion: 1, ...base });
    expect(samePinExecution(strict, optional)).toBe(false);
    expect(samePinExecution(optional, { ...optional, leaseFence: 9 })).toBe(
      true,
    );
    expect(pinInventoryPolicyVersion(strict)).toBe('strict/1');
    expect(pinInventoryPolicyVersion(optional)).toBe('optional-drivers/1');
  });
});

describe('U10 policy vocabulary', () => {
  it('maps run-context and batch vocabularies exactly and closed', () => {
    expect(batchInventoryPolicyFor('strict/1')).toBe('strict-v1');
    expect(batchInventoryPolicyFor('optional-drivers/1')).toBe(
      'optional-driver-inventory-v1',
    );
    expect(inventoryPolicyVersionFor('optional-driver-inventory-v1')).toBe(
      'optional-drivers/1',
    );
    for (const bad of ['toString', '__proto__', 'strict', null, 1])
      expect(batchInventoryPolicyFor(bad)).toBeNull();
    expect(inventoryPolicyVersionFor('strict')).toBeNull();
  });

  it('never derives the optional policy from a bundled context, even if relabeled', async () => {
    const bundled = await bundledRunContext({ runId: RUN, season: 2026 });
    expect(bundled.inventoryPolicyVersion).toBe('strict/1');
    expect(() =>
      inventoryPolicyForContext({
        ...bundled,
        inventoryPolicyVersion: 'optional-drivers/1',
      }),
    ).toThrow();
  });
});

describe('committed environments select the optional policy only in staging (acceptance 37, U11 P3)', () => {
  const root = join(__dirname, '..', '..', '..');
  const assignment = /^\s*IDENTITY_INVENTORY_MODE\s*=/m;
  it('no other wrangler configuration or committed env file sets IDENTITY_INVENTORY_MODE', () => {
    const configs = readdirSync(root).filter(
      (name) =>
        (/^wrangler.*\.toml$/.test(name) || /^\.dev\.vars/.test(name)) &&
        name !== 'wrangler.toml',
    );
    expect(configs.length).toBeGreaterThan(0);
    for (const name of configs) {
      const text = readFileSync(join(root, name), 'utf8');
      expect(text, name).not.toMatch(assignment);
      expect(text, name).not.toContain('optional-drivers');
    }
  });
  it('wrangler.toml assigns it exactly once, inside [env.staging.vars] only', () => {
    const text = readFileSync(join(root, 'wrangler.toml'), 'utf8');
    expect(text.match(/^\s*IDENTITY_INVENTORY_MODE\s*=/gm)).toHaveLength(1);
    const read = (env?: string) =>
      (
        unstable_readConfig(
          { config: join(root, 'wrangler.toml'), env },
          { hideWarnings: true },
        ).vars as Record<string, unknown>
      ).IDENTITY_INVENTORY_MODE;
    expect(read('staging')).toBe('optional-drivers');
    for (const env of [undefined, 'production', 'e2e'])
      expect(read(env), env ?? 'development').toBeUndefined();
  });
});
