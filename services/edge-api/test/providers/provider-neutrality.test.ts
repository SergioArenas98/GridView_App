import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import {
  ConfigurationError,
  resolveProviderMode,
} from '../../src/config/environment';
import { providerSourceIds } from '../../src/providers/provider-source';
import {
  request,
  createHarness,
  seedPublishedSnapshot,
} from '../support/edge-harness';

const repoRoot = join(__dirname, '..', '..', '..', '..');

describe('runtime provider modes are unchanged by Phase 9B-1', () => {
  it('admits exactly mock and none', () => {
    expect(resolveProviderMode('mock', 'development')).toBe('mock');
    expect(resolveProviderMode('none', 'staging')).toBe('none');

    // Naming a source internally never widens the runtime mode union.
    for (const candidate of ['jolpica', 'openf1', 'live', 'dual']) {
      expect(() => resolveProviderMode(candidate, 'staging')).toThrow(
        ConfigurationError,
      );
    }
  });

  it('keeps production on none and refuses mock there', () => {
    expect(resolveProviderMode(undefined, 'production')).toBe('none');
    expect(resolveProviderMode('none', 'production')).toBe('none');
    expect(() => resolveProviderMode('mock', 'production')).toThrow(
      ConfigurationError,
    );
  });

  it('pins production to none in the deployed wrangler configuration', () => {
    const wrangler = readFileSync(
      join(repoRoot, 'services', 'edge-api', 'wrangler.toml'),
      'utf8',
    );

    expect(wrangler).toMatch(
      /\[env\.production\.vars\][\s\S]*PROVIDER_MODE = "none"/,
    );
    expect(wrangler).not.toMatch(
      /PROVIDER_MODE = "(jolpica|openf1|live|dual)"/,
    );
  });

  it('leaves OpenF1 incapable of making a request: no adapter exists', () => {
    const providerDir = join(
      repoRoot,
      'services',
      'edge-api',
      'src',
      'providers',
    );
    const entries = readdirSync(providerDir, { recursive: true }) as string[];
    const names = entries.map((entry) => entry.toString().toLowerCase());

    expect(names.some((name) => name.includes('openf1'))).toBe(false);
    expect(names.some((name) => name.includes('jolpica'))).toBe(false);

    // Nothing under src/ issues an outbound provider request.
    const sourceDir = join(repoRoot, 'services', 'edge-api', 'src');
    const files = (readdirSync(sourceDir, { recursive: true }) as string[])
      .map((entry) => entry.toString())
      .filter((entry) => entry.endsWith('.ts'));
    for (const file of files) {
      const contents = readFileSync(join(sourceDir, file), 'utf8');
      expect(contents).not.toMatch(/\bfetch\s*\(\s*['"`]https?:/);
      expect(contents).not.toContain('api.openf1.org');
      expect(contents).not.toContain('api.jolpi.ca');
    }
  });
});

describe('provider identity stays out of the public contract', () => {
  it('never leaks a source id into a public v1 response', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);

    const paths = [
      '/v1/status',
      '/v1/bootstrap?season=2026',
      '/v1/home?season=2026',
      '/v1/seasons/2026',
      '/v1/seasons/2026/calendar',
      '/v1/seasons/2026/standings/drivers',
      '/v1/seasons/2026/drivers',
      '/v1/content/manifest',
    ];

    for (const path of paths) {
      const response = await worker.fetch(request(path), harness.env);
      const body = await response.text();

      expect(response.status).toBe(200);
      for (const sourceId of providerSourceIds) {
        expect(body).not.toContain(`"sourceId":"${sourceId}"`);
      }
      expect(body).not.toContain('sourceId');
      expect(body).not.toContain('quotaPolicy');
      expect(body).not.toContain('providerCallCount');
      expect(body).not.toContain('saturationStreak');
    }
  });

  it('keeps the OpenAPI schema and generated fixtures provider-neutral', () => {
    const openapi = readFileSync(
      join(repoRoot, 'docs', 'api', 'gridview-api-v1.yaml'),
      'utf8',
    );

    expect(openapi).not.toContain('sourceId');
    expect(openapi).not.toContain('providerSource');
    expect(openapi).not.toMatch(/\bjolpica\b/i);
    expect(openapi).not.toMatch(/\bopenf1\b/i);

    const fixtureDir = join(
      repoRoot,
      'services',
      'edge-api',
      'test',
      'fixtures',
    );
    const fixtures = (readdirSync(fixtureDir, { recursive: true }) as string[])
      .map((entry) => entry.toString())
      .filter((entry) => entry.endsWith('.json'));
    expect(fixtures.length).toBeGreaterThan(0);
    for (const fixture of fixtures) {
      const contents = readFileSync(join(fixtureDir, fixture), 'utf8');
      expect(contents).not.toContain('sourceId');
      expect(contents).not.toMatch(/\bjolpica\b/i);
      expect(contents).not.toMatch(/\bopenf1\b/i);
    }
  });
});
