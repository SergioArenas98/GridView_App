import { describe, expect, it } from 'vitest';

import config from '../../wrangler.toml?raw';
import { resolveRuntimeConfig } from '../../src/config/environment';

describe('wrangler staging configuration', () => {
  it('keeps the existing TOML configuration format authoritative', () => {
    const jsoncConfig = import.meta.glob('../../wrangler.jsonc', {
      eager: true,
    });
    expect(config).toContain('compatibility_date = "2026-07-01"');
    expect(Object.keys(jsoncConfig)).toHaveLength(0);
  });

  it('declares the staging Worker, workers.dev endpoint, KV binding and cron explicitly', () => {
    expect(config).toMatch(
      /\[env\.staging\][\s\S]*name = "gridview-api-staging"/,
    );
    expect(config).toMatch(/\[env\.staging\][\s\S]*workers_dev = true/);
    expect(config).toMatch(
      /\[env\.staging\.vars\][\s\S]*ENVIRONMENT = "staging"[\s\S]*PROVIDER_MODE = "mock"[\s\S]*PUBLIC_BASE_URL = "https:\/\/gridview-api-staging\.sejuma18\.workers\.dev"/,
    );
    expect(config).toMatch(
      /\[\[env\.staging\.kv_namespaces\]\][\s\S]*binding = "GRIDVIEW_DATA"[\s\S]*id = "1d0fb55486a745a1ad12e03d9f04942b"/,
    );
    expect(config).toMatch(
      /\[env\.staging\.triggers\][\s\S]*crons = \["17 3 \* \* \*"\]/,
    );
  });

  it('declares ADMIN_TOKEN as a required staging secret without committing its value', () => {
    expect(config).toMatch(
      /\[env\.staging\.secrets\][\s\S]*required = \["ADMIN_TOKEN"\]/,
    );
    expect(config).not.toContain('Bearer ');
    expect(config).not.toContain('replace-with-disposable-local-token');
  });

  it('does not add account IDs or production storage bindings', () => {
    expect(config).not.toMatch(/^account_id\s*=/m);
    expect(config).not.toContain('[[env.production.kv_namespaces]]');
    expect(config).toMatch(
      /\[env\.production\.vars\][\s\S]*ENVIRONMENT = "production"[\s\S]*PROVIDER_MODE = "none"/,
    );
  });
});

/** The top-level (development) `[vars]` table's own body, up to the next `[` header. */
function developmentVarsBlock(toml: string): string {
  const match = /^\[vars\]\n([\s\S]*?)\n\[/m.exec(toml);
  if (match?.[1] === undefined) throw new Error('[vars] not found');
  return match[1];
}

/** The `[env.staging.vars]` table's own body, up to the next `[` header. */
function stagingVarsBlock(toml: string): string {
  const match = /\[env\.staging\.vars\]\n([\s\S]*?)\n\[/.exec(toml);
  if (match?.[1] === undefined) throw new Error('[env.staging.vars] not found');
  return match[1];
}

/** The `[env.production.vars]` table's own body, up to the next `[` header. */
function productionVarsBlock(toml: string): string {
  const match = /\[env\.production\.vars\]\n([\s\S]*?)\n\[/.exec(toml);
  if (match?.[1] === undefined) {
    throw new Error('[env.production.vars] not found');
  }
  return match[1];
}

/** A table body's configured lines, with comments and blank lines dropped. */
function assignments(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

/** The string variables a vars table body assigns, by name. */
function variables(block: string): Map<string, string> {
  return new Map(
    assignments(block).map((line): [string, string] => {
      const match = /^([A-Z_]+) = "([^"]*)"$/.exec(line);
      if (match?.[1] === undefined || match[2] === undefined) {
        throw new Error(`unexpected vars line: ${line}`);
      }
      return [match[1], match[2]];
    }),
  );
}

/** The runtime configuration a vars table body resolves to. */
function resolvedVars(block: string): ReturnType<typeof resolveRuntimeConfig> {
  const vars = variables(block);
  return resolveRuntimeConfig({
    ENVIRONMENT: vars.get('ENVIRONMENT'),
    PROVIDER_MODE: vars.get('PROVIDER_MODE'),
    PUBLIC_BASE_URL: vars.get('PUBLIC_BASE_URL'),
    SEASON_PUBLICATION_AUTHORITY: vars.get('SEASON_PUBLICATION_AUTHORITY'),
    SEASON_PUBLICATION_CUTOVER_CONTROL: vars.get(
      'SEASON_PUBLICATION_CUTOVER_CONTROL',
    ),
  });
}

describe('season 2026 seed configuration (ADR 0025 D12)', () => {
  // Live staging (version `c35f99c0-…`) carries `seed:2026` and no authority
  // mode. The operator approved the season-2026 checkpoint on 2026-09-15, and
  // the seed refuses unless the authority mode is exactly `sequencer`, so this
  // file selects it in staging alone and keeps `seed:2026` as the phase gate.
  // Any other staging control or authority must change these assertions
  // deliberately.

  it('keeps exactly seed:2026 and selects sequencer after the three base staging variables', () => {
    expect(assignments(stagingVarsBlock(config))).toEqual([
      'ENVIRONMENT = "staging"',
      'PROVIDER_MODE = "mock"',
      'PUBLIC_BASE_URL = "https://gridview-api-staging.sejuma18.workers.dev"',
      'SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"',
      'SEASON_PUBLICATION_AUTHORITY = "sequencer"',
    ]);
    // Each is assigned exactly once anywhere in the file - so neither the
    // top-level development table nor production sets it; the names still
    // appear in the comments that explain the values.
    expect(
      config.match(/^\s*"?SEASON_PUBLICATION_CUTOVER_CONTROL"?\s*=/gm),
    ).toHaveLength(1);
    expect(
      config.match(/^\s*"?SEASON_PUBLICATION_AUTHORITY"?\s*=/gm),
    ).toHaveLength(1);
  });

  it('leaves the production variables exactly as they were', () => {
    expect(assignments(productionVarsBlock(config))).toEqual([
      'ENVIRONMENT = "production"',
      'PROVIDER_MODE = "none"',
    ]);
  });

  it('leaves the development variables exactly as they were', () => {
    expect(assignments(developmentVarsBlock(config))).toEqual([
      'ENVIRONMENT = "development"',
    ]);
  });

  it('resolves the staging variables to the season 2026 seed phase under the sequencer authority', () => {
    const resolved = resolvedVars(stagingVarsBlock(config));
    expect(resolved.environment).toBe('staging');
    expect(resolved.providerMode).toBe('mock');
    expect(resolved.publicationAuthorityMode).toBe('sequencer');
    expect(resolved.publicationCutoverControl).toEqual({
      kind: 'seed',
      season: 2026,
    });
  });

  it('resolves development and production to the legacy authority with no cutover control', () => {
    const development = resolvedVars(developmentVarsBlock(config));
    const production = resolvedVars(productionVarsBlock(config));
    expect(development.environment).toBe('development');
    expect(production.environment).toBe('production');
    for (const resolved of [development, production]) {
      expect(resolved.publicationAuthorityMode).toBe('legacy');
      expect(resolved.publicationCutoverControl).toEqual({ kind: 'disabled' });
    }
  });

  it('leaves every staging binding, the secret, cron and observability untouched', () => {
    expect(config).toMatch(
      /\[\[env\.staging\.durable_objects\.bindings\]\]\nname = "PROVIDER_RATE_LIMITER"\nclass_name = "ProviderRateLimiter"/,
    );
    expect(config).toMatch(
      /\[\[env\.staging\.durable_objects\.bindings\]\]\nname = "SEASON_PUBLICATION_SEQUENCER"\nclass_name = "SeasonPublicationSequencer"/,
    );
    expect(config).toMatch(
      /\[\[env\.staging\.kv_namespaces\]\]\nbinding = "GRIDVIEW_DATA"\nid = "1d0fb55486a745a1ad12e03d9f04942b"/,
    );
    expect(config).toMatch(
      /\[env\.staging\.secrets\]\nrequired = \["ADMIN_TOKEN"\]/,
    );
    expect(config).toMatch(
      /\[env\.staging\.triggers\]\ncrons = \["17 3 \* \* \*"\]/,
    );
    expect(config).toMatch(
      /\[env\.staging\.observability\]\nenabled = true\nhead_sampling_rate = 1\n\n\[env\.staging\.observability\.logs\]\nenabled = true\npersist = true\ninvocation_logs = false/,
    );
  });
});
