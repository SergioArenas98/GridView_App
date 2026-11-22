/**
 * Identity U11: the staging identity catalog is staging-only and, as
 * committed for G2b, keeps bundled authority with review administration
 * (ADR 0031 D5; design §11.1-11.2).
 *
 * The committed staging declaration is a proposal awaiting the owner's
 * deployment approval. These assertions pin what that proposal may contain:
 * one fresh installation UUID, bundled/off/review modes, no inventory-mode
 * variable (absent = strict), the reviewer credentials secret required by
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
      IDENTITY_CATALOG_MODE: 'bundled',
      IDENTITY_DISCOVERY_MODE: 'off',
      IDENTITY_ADMIN_MODE: 'review',
    });
    expect(vars.IDENTITY_INSTALLATION_ID).toMatch(uuidV4);
  });

  it('resolves to bundled authority and strict inventory at runtime', () => {
    const vars = resolved('staging').vars as Record<string, string | undefined>;
    const catalogMode = resolveIdentityCatalogMode(vars.IDENTITY_CATALOG_MODE);
    expect(catalogMode).toBe('bundled');
    expect(
      resolveOperationalInventoryMode(
        vars.IDENTITY_INVENTORY_MODE,
        catalogMode,
      ),
    ).toBe('strict');
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

  it('leaves production, the demonstration Worker and development without any identity declaration', () => {
    for (const environment of ['', 'production', 'e2e'] as const) {
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
    expect(rawConfig.match(/^\s*IDENTITY_INSTALLATION_ID\s*=/gm)).toHaveLength(
      1,
    );
  });
});
