import { describe, expect, it } from 'vitest';

import config from '../../wrangler.toml?raw';

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
