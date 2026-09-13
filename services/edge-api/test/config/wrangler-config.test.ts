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

describe('season 2026 reclosure configuration (ADR 0025 D12 recovery)', () => {
  // Live staging (version `00012c06-…`) carries `seed:2026`. The temporary
  // reopening configuration (PR #23) omitted it so that one separately
  // authorized deployment could reopen season 2026's admission for a single
  // inventory-bearing publication; this file restores exactly that value as
  // the reclosure deployed straight after that publication. Any other staging
  // control must change these assertions deliberately.

  it('restores exactly seed:2026 after the three base staging variables', () => {
    expect(assignments(stagingVarsBlock(config))).toEqual([
      'ENVIRONMENT = "staging"',
      'PROVIDER_MODE = "mock"',
      'PUBLIC_BASE_URL = "https://gridview-api-staging.sejuma18.workers.dev"',
      'SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"',
    ]);
    // Assigned exactly once anywhere in the file - so neither the top-level
    // development table nor production sets it; the name still appears in
    // the comments that explain the value.
    expect(
      config.match(/^\s*"?SEASON_PUBLICATION_CUTOVER_CONTROL"?\s*=/gm),
    ).toHaveLength(1);
  });

  it('leaves the production variables exactly as they were', () => {
    expect(assignments(productionVarsBlock(config))).toEqual([
      'ENVIRONMENT = "production"',
      'PROVIDER_MODE = "none"',
    ]);
  });

  it('declares SEASON_PUBLICATION_AUTHORITY nowhere', () => {
    expect(config).not.toMatch(/^\s*"?SEASON_PUBLICATION_AUTHORITY"?\s*=/m);
  });

  it('resolves the staging variables to the season 2026 seed phase under the legacy authority', () => {
    const vars = variables(stagingVarsBlock(config));
    const resolved = resolveRuntimeConfig({
      ENVIRONMENT: vars.get('ENVIRONMENT'),
      PROVIDER_MODE: vars.get('PROVIDER_MODE'),
      PUBLIC_BASE_URL: vars.get('PUBLIC_BASE_URL'),
      SEASON_PUBLICATION_AUTHORITY: vars.get('SEASON_PUBLICATION_AUTHORITY'),
      SEASON_PUBLICATION_CUTOVER_CONTROL: vars.get(
        'SEASON_PUBLICATION_CUTOVER_CONTROL',
      ),
    });
    expect(resolved.environment).toBe('staging');
    expect(resolved.providerMode).toBe('mock');
    expect(resolved.publicationAuthorityMode).toBe('legacy');
    expect(resolved.publicationCutoverControl).toEqual({
      kind: 'seed',
      season: 2026,
    });
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
