import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
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

/**
 * The two origins the outbound boundary is allowed to pin.
 *
 * Compared by **exact equality against parsed string-literal values**, never
 * by substring search over source text. A substring check would be both weaker
 * (it matches comments, identifiers and lookalike hosts such as
 * `https://api.openf1.org.evil.example`) and indistinguishable from incomplete
 * URL sanitization to a static analyser. Real URL security lives in
 * `buildProviderUrl`, which resolves with `new URL` and compares `url.origin`
 * for exact equality.
 */
const pinnedOrigins: readonly string[] = [
  'https://api.jolpi.ca',
  'https://api.openf1.org',
];

/**
 * True when the module declares a string-like literal whose value *is* one of
 * the pinned origins. Parses with the TypeScript compiler API and walks the
 * AST, so only genuine literals count - not prose, identifiers or a host that
 * merely appears somewhere inside a longer string.
 */
function declaresPinnedOrigin(contents: string, fileName: string): boolean {
  const source = ts.createSourceFile(
    fileName,
    contents,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    ts.ScriptKind.TS,
  );

  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (pinnedOrigins.some((origin) => node.text === origin)) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
}

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
  });

  /**
   * Phase 9B-1 asserted that no provider hostname appeared anywhere under
   * `src/`, which was a sound proxy for "no adapter exists" while nothing
   * could reach the network at all.
   *
   * Phase 9B-2 makes that exact form obsolete rather than merely inconvenient:
   * the hardened boundary must pin both origins, because pinning them is the
   * control that stops a future adapter choosing its own. The invariant below
   * is strictly stronger - the hostnames are confined to the one endpoint
   * table, and no module anywhere may call global `fetch` on a literal URL.
   */
  it('confines provider origins to the hardened boundary and forbids direct fetch', () => {
    const sourceDir = join(repoRoot, 'services', 'edge-api', 'src');
    const boundary = join('providers', 'http', 'provider-http-client.ts');
    const files = (readdirSync(sourceDir, { recursive: true }) as string[])
      .map((entry) => entry.toString())
      .filter((entry) => entry.endsWith('.ts'));

    const filesNamingAnOrigin: string[] = [];
    for (const file of files) {
      const contents = readFileSync(join(sourceDir, file), 'utf8');
      // No module may issue an outbound request to a literal URL...
      expect(contents).not.toMatch(/\bfetch\s*\(\s*['"`]https?:/);
      // ...nor reach the global entry point that would bypass the injected
      // transport. The transport is a required constructor argument, so there
      // is no production wiring to global fetch; this pins that there is no
      // textual one either.
      expect(contents).not.toContain('globalThis.fetch');
      expect(contents).not.toMatch(/\bwindow\.fetch\b/);
      if (declaresPinnedOrigin(contents, file)) {
        filesNamingAnOrigin.push(file);
      }
    }

    // Exactly one module knows the origins, and it is the hardened boundary.
    expect(filesNamingAnOrigin).toEqual([boundary]);
  });

  it('detects an exact origin literal in an unauthorized module', () => {
    // A newly added adapter that hard-codes its own origin is caught.
    expect(
      declaresPinnedOrigin(
        "const base = 'https://api.openf1.org';",
        'providers/openf1/adapter.ts',
      ),
    ).toBe(true);
    expect(
      declaresPinnedOrigin(
        'const base = `https://api.jolpi.ca`;',
        'providers/jolpica/adapter.ts',
      ),
    ).toBe(true);
  });

  it('inspects literal values, not prose or identifiers', () => {
    // Only an actual string-like literal equal to a pinned origin counts.
    // Comments, documentation and identifiers that merely mention a host do
    // not, which is what makes the assertion about code rather than text.
    const notLiterals = [
      '// see https://api.openf1.org for the published limits',
      '/** Jolpica lives at https://api.jolpi.ca and needs a User-Agent. */',
      "const apiJolpiCa = 'placeholder';",
      "const host = 'api.openf1.org';",
      "const prefixed = 'https://api.openf1.org.evil.example';",
      "const suffixed = 'https://evil.example/https://api.jolpi.ca';",
    ];

    for (const snippet of notLiterals) {
      expect(declaresPinnedOrigin(snippet, 'providers/other.ts')).toBe(false);
    }
  });

  it('still accepts the legitimate boundary module', () => {
    const boundary = readFileSync(
      join(
        repoRoot,
        'services',
        'edge-api',
        'src',
        'providers',
        'http',
        'provider-http-client.ts',
      ),
      'utf8',
    );

    expect(declaresPinnedOrigin(boundary, 'provider-http-client.ts')).toBe(
      true,
    );
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
