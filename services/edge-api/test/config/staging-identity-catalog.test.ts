/**
 * Identity U11: the staging identity catalog is staging-only and, as
 * committed for G5, selects runtime authority with read-only administration
 * (ADR 0031 D5; design §11.1-11.2).
 *
 * The committed staging declaration is a proposal awaiting the owner's
 * deployment approval. These assertions pin what that proposal may contain:
 * one fresh installation UUID, runtime/off/read-only modes, the
 * optional-driver inventory policy (U11 P3, staging only), the reviewer
 * credentials secret required by
 * name but never committed, one named SQLite
 * export and Worker-local binding, and nothing at all in production, the
 * demonstration Worker or development.
 */
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { unstable_readConfig } from 'wrangler';
import {
  resolveIdentityCatalogMode,
  resolveOperationalInventoryMode,
} from '../../src/config/environment';
import { identityConfiguration } from '../../src/identity/catalog/run-context';

const configPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'wrangler.toml',
);
const rawConfig = readFileSync(configPath, 'utf8').replace(/\r\n/g, '\n');
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function resolved(environment: '' | 'staging' | 'production' | 'e2e') {
  return unstable_readConfig(
    { config: configPath, env: environment === '' ? undefined : environment },
    { hideWarnings: true },
  );
}

function identityVars(vars: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(vars).filter(([name]) => name.startsWith('IDENTITY_')),
  );
}

describe('the proposed staging identity catalog (identity U11)', () => {
  it('declares exactly one fresh UUID v4 installation and inert modes', () => {
    const vars = identityVars(resolved('staging').vars);
    expect(vars).toEqual({
      IDENTITY_INSTALLATION_ID: 'c45d60b8-a723-4b6e-8530-750592af2b94',
      IDENTITY_CATALOG_MODE: 'runtime',
      IDENTITY_DISCOVERY_MODE: 'off',
      IDENTITY_ADMIN_MODE: 'read-only',
      IDENTITY_INVENTORY_MODE: 'optional-drivers',
    });
    expect(vars.IDENTITY_INSTALLATION_ID).toMatch(uuidV4);
  });

  it('resolves to runtime authority and the optional-driver inventory at runtime', () => {
    const vars = resolved('staging').vars as Record<string, string | undefined>;
    const catalogMode = resolveIdentityCatalogMode(vars.IDENTITY_CATALOG_MODE);
    expect(catalogMode).toBe('runtime');
    expect(
      resolveOperationalInventoryMode(
        vars.IDENTITY_INVENTORY_MODE,
        catalogMode,
      ),
    ).toBe('optional-drivers');
  });

  it('admits the optional inventory only with the deployed catalog binding; without one it is a configuration error', () => {
    const vars = resolved('staging').vars as Record<string, string>;
    const namespace = { idFromName: () => ({}), get: () => ({}) };
    expect(
      identityConfiguration({ ...vars, IDENTITY_CATALOG: namespace } as never)
        .inventoryMode,
    ).toBe('optional-drivers');
    // Consequence for recovery builds (R-3/R-4) and any fallback that unbinds
    // the catalog or leaves runtime: they must drop the variable too.
    expect(() => identityConfiguration(vars as never)).toThrow(
      /requires a catalog binding/,
    );
    expect(() =>
      identityConfiguration({
        ...vars,
        IDENTITY_CATALOG_MODE: 'bundled',
        IDENTITY_CATALOG: namespace,
      } as never),
    ).toThrow(/requires IDENTITY_CATALOG_MODE=runtime/);
  });

  it('requires the reviewer credentials secret by name, commits no value and no legacy-v1 compatibility gate', () => {
    expect(resolved('staging').secrets).toEqual({
      required: [
        'ADMIN_TOKEN',
        'JOLPICA_PROXY_TOKEN',
        'IDENTITY_REVIEWER_CREDENTIALS',
      ],
    });
    expect(rawConfig).not.toMatch(/tokenSha256/);
    expect(rawConfig).not.toMatch(/^\s*IDENTITY_REVIEWER_CREDENTIALS\s*=/m);
    expect(rawConfig).not.toMatch(
      /^\s*IDENTITY_BATCH_V1_COMPATIBILITY_INSTALLATION_ID\s*=/m,
    );
  });

  it('adds one named SQLite export and Worker-local binding, with no migration or cross-Worker binding', () => {
    const staging = resolved('staging');
    expect(staging.exports?.IdentityCatalog).toEqual({
      type: 'durable-object',
      storage: 'sqlite',
    });
    expect(
      staging.durable_objects.bindings.filter(
        (binding: { readonly class_name: string }) =>
          binding.class_name === 'IdentityCatalog',
      ),
    ).toEqual([{ name: 'IDENTITY_CATALOG', class_name: 'IdentityCatalog' }]);
    expect(staging.migrations).toEqual([]);
    expect(rawConfig).not.toMatch(/script_name/);
    expect(rawConfig).not.toMatch(/^\[\[(?:env\.\w+\.)?migrations\]\]/m);
  });

  it('gives production its own, distinct installation (U11 P4) and leaves the demonstration Worker and development without any identity declaration', () => {
    const production = identityVars(resolved('production').vars);
    expect(production.IDENTITY_INSTALLATION_ID).toMatch(uuidV4);
    expect(production.IDENTITY_INSTALLATION_ID).not.toBe(
      identityVars(resolved('staging').vars).IDENTITY_INSTALLATION_ID,
    );
    for (const environment of ['', 'e2e'] as const) {
      const config = resolved(environment);
      expect(identityVars(config.vars), environment).toEqual({});
      expect(Object.keys(config.exports ?? {}), environment).not.toContain(
        'IdentityCatalog',
      );
      expect(
        config.durable_objects.bindings.map(
          (binding: { readonly name: string }) => binding.name,
        ),
        environment,
      ).not.toContain('IDENTITY_CATALOG');
    }
    // Staging and production, one each.
    expect(rawConfig.match(/^\s*IDENTITY_INSTALLATION_ID\s*=/gm)).toHaveLength(
      2,
    );
  });
});
