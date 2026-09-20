import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

/** Every TypeScript module under a directory, as repo-relative POSIX paths. */
function sourceFiles(sourceDir: string): string[] {
  return (readdirSync(sourceDir, { recursive: true }) as string[])
    .map((entry) => entry.toString().split('\\').join('/'))
    .filter((entry) => entry.endsWith('.ts'));
}

/**
 * The relative import and re-export specifiers one module declares.
 *
 * Parsed from the AST rather than matched textually, so a specifier inside a
 * comment or a string cannot forge an edge and a multi-line import cannot hide
 * one. Bare specifiers are package imports and cannot reach `src/`.
 */
function importSpecifiers(contents: string, fileName: string): string[] {
  const source = ts.createSourceFile(
    fileName,
    contents,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    // A dynamic `import('...')` is an edge too, and is how a module could
    // otherwise be pulled in without a static declaration.
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return specifiers;
}

const srcRoot = join(repoRoot, 'services', 'edge-api', 'src');

/**
 * Resolves one relative specifier to a repo-relative module path under `src/`.
 *
 * Returns `null` for a bare package specifier, for anything resolving outside
 * `src/` (the curated JSON content, for instance) and for a path with no
 * TypeScript module behind it.
 */
function resolveSpecifier(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const segments = from.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') segments.pop();
    else segments.push(part);
  }
  const base = segments.join('/');
  for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
    if (existsSync(join(srcRoot, candidate))) return candidate;
  }
  return null;
}

/**
 * The transitive import closure of the Worker entry point.
 *
 * This is the set a bundler would ship. A module absent from it cannot be
 * reached at runtime however it is named, which is the dormancy proof A9 asks
 * for in place of a file-name assertion.
 */
function reachableFromEntryPoint(): ReadonlySet<string> {
  const seen = new Set<string>();
  const pending = ['index.ts'];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    const contents = readFileSync(join(srcRoot, current), 'utf8');
    for (const specifier of importSpecifiers(contents, current)) {
      const resolved = resolveSpecifier(current, specifier);
      if (resolved !== null && !seen.has(resolved)) pending.push(resolved);
    }
  }
  return seen;
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
  });

  /**
   * The Jolpica file-name assertion that stood here is **replaced**, in the
   * same change that adds the adapter, exactly as ADR 0022 amendment A9
   * requires.
   *
   * A name-based proxy was sound only while no adapter could exist. It lets a
   * real adapter pass by choosing a neutral name and fails an honest one that
   * is fully dormant, so it is not a sustainable architectural test. The
   * assertions below are the boundaries A9 names instead: the adapter is
   * unreachable from the Worker entry point, nothing outside its own directory
   * imports it, and no configuration enables it.
   */
  it('keeps the Jolpica adapter unreachable from the Worker entry point', () => {
    const reachable = reachableFromEntryPoint();

    // The entry point's transitive import closure is what the bundler ships.
    // Nothing under the adapter directory may appear in it.
    const bundled = [...reachable].filter((file) =>
      file.startsWith('providers/jolpica/'),
    );
    expect(bundled).toEqual([]);

    // The closure is real, not an empty set from a resolver that found
    // nothing: the entry point genuinely reaches its own modules.
    expect(reachable.has('index.ts')).toBe(true);
    expect(reachable.has('providers/factory.ts')).toBe(true);
    expect(reachable.has('sync/sync-service.ts')).toBe(true);
  });

  it('is imported by no runtime module outside its own directory', () => {
    const sourceDir = join(repoRoot, 'services', 'edge-api', 'src');
    const files = sourceFiles(sourceDir);

    const importers = files.filter((file) => {
      if (file.startsWith('providers/jolpica/')) return false;
      const contents = readFileSync(join(sourceDir, file), 'utf8');
      return importSpecifiers(contents, file).some((specifier) =>
        resolveSpecifier(file, specifier)?.startsWith('providers/jolpica/'),
      );
    });

    expect(importers).toEqual([]);
  });

  it('is constructed by no production composition', () => {
    const sourceDir = join(repoRoot, 'services', 'edge-api', 'src');
    for (const file of sourceFiles(sourceDir)) {
      if (file.startsWith('providers/jolpica/')) continue;
      const contents = readFileSync(join(sourceDir, file), 'utf8');
      expect(contents).not.toContain('JolpicaCalendarPort');
      // The coordinator that would drive a port is itself still unconstructed
      // outside its own dormant scope.
      expect(contents).not.toContain('new MultiSourceCoordinator');
    }
  });

  it('is enabled by no binding, variable, route or cron', () => {
    const path = join(repoRoot, 'services', 'edge-api', 'wrangler.toml');
    // Comments are excluded deliberately. Prose naming the source is exactly
    // the weak, name-based signal A9 replaced; what must hold is that no
    // *declaration* enables an adapter.
    const declarations = readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');

    expect(declarations).not.toMatch(/\bjolpica\b/i);
    expect(declarations).not.toMatch(/\bopenf1\b/i);
    // No cron would drive a coordinated run for this season either.
    expect(declarations).not.toContain('[triggers]');
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
