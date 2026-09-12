import { describe, expect, it } from 'vitest';

import config from '../../wrangler.toml?raw';
import { parseCutoverControl } from '../../src/publication/cutover/control';

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

describe('season 2026 admission-closure preparation (ADR 0025 D12 step 1)', () => {
  it('declares the cutover control only under [env.staging.vars]', () => {
    expect(stagingVarsBlock(config)).toContain(
      'SEASON_PUBLICATION_CUTOVER_CONTROL = "seed:2026"',
    );
    // Assigned exactly once anywhere in the file; the name may still appear
    // in surrounding prose comments explaining the value.
    expect(
      config.match(/^SEASON_PUBLICATION_CUTOVER_CONTROL = /gm),
    ).toHaveLength(1);
  });

  it('does not declare the cutover control for production', () => {
    expect(productionVarsBlock(config)).not.toMatch(
      /^SEASON_PUBLICATION_CUTOVER_CONTROL = /m,
    );
  });

  it('declares SEASON_PUBLICATION_AUTHORITY nowhere', () => {
    expect(config).not.toMatch(/^SEASON_PUBLICATION_AUTHORITY = /m);
  });

  it('parses the declared staging value as the seed phase for season 2026', () => {
    const match = /SEASON_PUBLICATION_CUTOVER_CONTROL = "([^"]+)"/.exec(config);
    if (match?.[1] === undefined) throw new Error('control value not found');
    expect(parseCutoverControl(match[1])).toEqual({
      kind: 'seed',
      season: 2026,
    });
  });

  it('leaves every other staging variable and binding untouched', () => {
    const staging = stagingVarsBlock(config);
    expect(staging).toContain('ENVIRONMENT = "staging"');
    expect(staging).toContain('PROVIDER_MODE = "mock"');
    expect(staging).toContain(
      'PUBLIC_BASE_URL = "https://gridview-api-staging.sejuma18.workers.dev"',
    );
    expect(config).toMatch(
      /\[\[env\.staging\.kv_namespaces\]\][\s\S]*binding = "GRIDVIEW_DATA"/,
    );
    expect(config).toMatch(
      /\[\[env\.staging\.durable_objects\.bindings\]\][\s\S]*name = "SEASON_PUBLICATION_SEQUENCER"/,
    );
    expect(config).toMatch(/\[env\.staging\.triggers\][\s\S]*crons = /);
    expect(config).toMatch(/\[env\.staging\.observability\]/);
  });
});
