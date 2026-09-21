import { readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
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
const edgeApiRoot = join(repoRoot, 'services', 'edge-api');

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

/**
 * The TypeScript extensions that carry executable code, as the compiler names
 * them.
 *
 * Enumerated from `ts.Extension` rather than matched as filename suffixes:
 * `.mts` and `.cts` are ordinary modules a bundler ships, but neither ends in
 * `.ts`, so a suffix test silently skips them. Declaration extensions are
 * deliberately absent - `.d.ts` has no runtime behind it - and `.d.ts` does
 * end in `.ts`, so it has to be excluded rather than merely not listed.
 */
// Typed as `string`, not `ts.Extension`: `ResolvedModuleFull.extension` is a
// plain string, and the values still come from the compiler's own enum.
const executableExtensions: readonly string[] = [
  ts.Extension.Ts,
  ts.Extension.Tsx,
  ts.Extension.Mts,
  ts.Extension.Cts,
];

const declarationSuffixes: readonly string[] = ['.d.ts', '.d.mts', '.d.cts'];

/** True for a file a bundler could execute as TypeScript source. */
function isExecutableModule(fileName: string): boolean {
  if (declarationSuffixes.some((suffix) => fileName.endsWith(suffix))) {
    return false;
  }
  return executableExtensions.some((extension) => fileName.endsWith(extension));
}

/** Every TypeScript module under a directory, as repo-relative POSIX paths. */
function sourceFiles(sourceDir: string): string[] {
  return (readdirSync(sourceDir, { recursive: true }) as string[])
    .map((entry) => entry.toString().split('\\').join('/'))
    .filter(isExecutableModule);
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
    // otherwise be pulled in without a static declaration. The `...Like` form
    // of the predicate also admits a no-substitution template literal, which
    // is an equally valid dynamic specifier: `ts.isStringLiteral` alone would
    // report no edge at all for `import(`./x`)`.
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push((node.arguments[0] as ts.StringLiteralLike).text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return specifiers;
}

/**
 * The dynamic imports whose specifier is **not** a literal, as source text.
 *
 * `importSpecifiers` can only record an edge it can read, and a computed
 * specifier - `` import(`./providers/${mode}`) `` or `import('./p/' + mode)` -
 * is not a `StringLiteralLike` at all. That is worse than a missing edge:
 * esbuild, which is what Wrangler bundles with, expands a relative template
 * pattern and ships *every* module matching it, so a computed import under
 * `src/` can bundle and select the adapter while all three boundaries stay
 * green. Verified against esbuild directly, not assumed.
 *
 * No specifier of this shape can be resolved soundly to a single module, so
 * the boundary is conservative rather than clever: production code may not
 * contain one at all. Today it contains no dynamic import of any kind, which
 * makes this a tripwire rather than a restriction.
 */
function computedDynamicImports(contents: string, fileName: string): string[] {
  const source = ts.createSourceFile(
    fileName,
    contents,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    ts.ScriptKind.TS,
  );
  const computed: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      const specifier = node.arguments[0];
      if (specifier !== undefined && !ts.isStringLiteralLike(specifier)) {
        computed.push(specifier.getText(source));
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return computed;
}

const srcRoot = join(edgeApiRoot, 'src');

/**
 * The Edge API's own compiler options, read from its `tsconfig.json` rather
 * than restated here.
 *
 * The closure below is only a dormancy proof if it resolves specifiers the
 * way the build does. Restating the options - or the resolution rules they
 * select - lets the two drift apart silently, which is precisely how a legal
 * import becomes invisible to this file.
 */
const compilerOptions: ts.CompilerOptions = (() => {
  const configPath = join(edgeApiRoot, 'tsconfig.json');
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error !== undefined) {
    throw new Error(
      `cannot read ${configPath}: ${ts.flattenDiagnosticMessageText(read.error.messageText, ' ')}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    edgeApiRoot,
    undefined,
    configPath,
  );
  if (parsed.errors.length > 0) {
    throw new Error(
      `cannot parse ${configPath}: ${parsed.errors
        .map((error) => ts.flattenDiagnosticMessageText(error.messageText, ' '))
        .join('; ')}`,
    );
  }
  return parsed.options;
})();

const moduleResolutionHost = ts.createCompilerHost(compilerOptions);

/**
 * Resolves one import specifier to a repo-relative module path under `src/`.
 *
 * Resolution is delegated to `ts.resolveModuleName` under the options above,
 * so every specifier the compiler accepts is an edge here too. A hand-written
 * candidate list cannot hold that promise: under this project's
 * `moduleResolution: "bundler"`, a relative `./x.js` resolves to `x.ts`, and a
 * resolver that only ever appended `.ts` found nothing for
 * `./providers/jolpica/index.js` and reported no edge at all - so both
 * boundaries passed while a legal production import reached the adapter.
 *
 * Returns `null` for anything that is not a TypeScript source module inside
 * `src/`: an unresolved specifier, a package resolved out of `node_modules`,
 * a declaration file with no runtime behind it, and the curated JSON content,
 * which `resolveJsonModule` does resolve but which lives outside the root.
 */
function resolveSpecifier(from: string, specifier: string): string | null {
  const { resolvedModule } = ts.resolveModuleName(
    specifier,
    join(srcRoot, from),
    compilerOptions,
    moduleResolutionHost,
  );
  if (
    resolvedModule === undefined ||
    resolvedModule.isExternalLibraryImport === true
  ) {
    return null;
  }
  if (!executableExtensions.includes(resolvedModule.extension)) return null;
  const resolved = relative(srcRoot, resolvedModule.resolvedFileName)
    .split('\\')
    .join('/');
  // Containment. `relative` yields a `..` prefix for anything above `src/`,
  // and an absolute path when there is no relative route at all.
  if (resolved.startsWith('../') || isAbsolute(resolved)) return null;
  return resolved;
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

  /**
   * Regression for the two boundaries above.
   *
   * Both are built on `importSpecifiers`, so an edge that walk cannot see is
   * an edge neither boundary can refuse. A dynamic import may name its module
   * with a no-substitution template literal, which is string-*like* but is not
   * a `ts.StringLiteral`: under that narrower predicate both assertions would
   * pass while a real runtime import of the adapter existed.
   */
  it('sees a template-literal dynamic import into the adapter directory', () => {
    // The entry point pulling in the adapter, written both ways.
    const templateForm = 'void import(`./providers/jolpica`);';
    const stringForm = "void import('./providers/jolpica');";

    expect(importSpecifiers(templateForm, 'index.ts')).toEqual([
      './providers/jolpica',
    ]);
    // The ordinary string-literal form stays covered.
    expect(importSpecifiers(stringForm, 'index.ts')).toEqual([
      './providers/jolpica',
    ]);

    // Boundary 1: the entry-point closure walk would admit it into the set the
    // bundler ships, which is what `bundled` is asserted to be empty of.
    const reached = importSpecifiers(templateForm, 'index.ts')
      .map((specifier) => resolveSpecifier('index.ts', specifier))
      .filter((resolved) => resolved?.startsWith('providers/jolpica/'));
    expect(reached).toEqual(['providers/jolpica/index.ts']);

    // Boundary 2: the importer scan flags the module as an importer, which is
    // what `importers` is asserted to be empty of. The factory is the module
    // that would plausibly reach for it.
    const factory = 'providers/factory.ts';
    expect(
      importSpecifiers('void import(`./jolpica`);', factory).some((specifier) =>
        resolveSpecifier(factory, specifier)?.startsWith('providers/jolpica/'),
      ),
    ).toBe(true);
  });

  /**
   * Regression for the same two boundaries, through the resolver rather than
   * the specifier walk.
   *
   * `tsconfig.json` enables `allowImportingTsExtensions`, so
   * `./providers/jolpica/index.ts` is a legal production import here. A
   * resolver that appends an extension unconditionally turns it into
   * `index.ts.ts`, resolves nothing and reports no edge - so both assertions
   * would pass while the Worker bundled the adapter.
   */
  it('resolves an explicit .ts import into the adapter directory', () => {
    // Boundary 1: the entry point reaching the adapter, statically and
    // dynamically, with the extension written out.
    const entryForms = [
      ['import "./providers/jolpica/index.ts";', 'providers/jolpica/index.ts'],
      [
        'void import("./providers/jolpica/calendar-port.ts");',
        'providers/jolpica/calendar-port.ts',
      ],
    ] as const;

    for (const [contents, expected] of entryForms) {
      const reached = importSpecifiers(contents, 'index.ts')
        .map((specifier) => resolveSpecifier('index.ts', specifier))
        .filter((resolved) => resolved?.startsWith('providers/jolpica/'));
      expect(reached).toEqual([expected]);
    }

    // Boundary 2: the importer scan flags the factory in either form.
    const factory = 'providers/factory.ts';
    for (const contents of [
      'import "./jolpica/index.ts";',
      'void import("./jolpica/calendar-port.ts");',
    ]) {
      expect(
        importSpecifiers(contents, factory).some((specifier) =>
          resolveSpecifier(factory, specifier)?.startsWith(
            'providers/jolpica/',
          ),
        ),
      ).toBe(true);
    }

    // The extensionless forms keep resolving exactly as before.
    expect(resolveSpecifier('index.ts', './providers/jolpica')).toBe(
      'providers/jolpica/index.ts',
    );
    expect(
      resolveSpecifier('providers/factory.ts', './jolpica/calendar-port'),
    ).toBe('providers/jolpica/calendar-port.ts');

    // Containment is unchanged: every candidate is still checked for
    // existence under `src/`, so the curated JSON content - which lives
    // outside it - is still no module edge.
    expect(
      resolveSpecifier(
        'providers/jolpica/curated-events.ts',
        '../../../../../content/registries/events.development.json',
      ),
    ).toBeNull();
  });

  /**
   * Regression for the same two boundaries, through a legal `.js` specifier.
   *
   * `./x.js` is the extension-bearing form the ecosystem writes by habit, and
   * under `moduleResolution: "bundler"` the compiler substitutes it onto
   * `x.ts`. A resolver that appended `.ts` to the literal specifier looked for
   * `index.js.ts`, found nothing and reported no edge - so the adapter could
   * be imported by the entry point, in a form that typechecks and bundles,
   * while both assertions above stayed green.
   */
  it('resolves a .js specifier onto its TypeScript source', () => {
    // Boundary 1: the entry point reaching the adapter, statically and
    // dynamically, through the extension the bundler rewrites.
    const entryForms = [
      ['import "./providers/jolpica/index.js";', 'providers/jolpica/index.ts'],
      [
        'void import(`./providers/jolpica/calendar-port.js`);',
        'providers/jolpica/calendar-port.ts',
      ],
    ] as const;

    for (const [contents, expected] of entryForms) {
      const reached = importSpecifiers(contents, 'index.ts')
        .map((specifier) => resolveSpecifier('index.ts', specifier))
        .filter((resolved) => resolved?.startsWith('providers/jolpica/'));
      expect(reached).toEqual([expected]);
    }

    // Boundary 2: the importer scan flags the factory in either form.
    const factory = 'providers/factory.ts';
    for (const contents of [
      'import "./jolpica/index.js";',
      'void import("./jolpica/calendar-port.js");',
    ]) {
      expect(
        importSpecifiers(contents, factory).some((specifier) =>
          resolveSpecifier(factory, specifier)?.startsWith(
            'providers/jolpica/',
          ),
        ),
      ).toBe(true);
    }
  });

  /**
   * The other half of delegating to the compiler: what it declines to resolve,
   * and what resolves outside `src/`, must not become an edge either - or the
   * closure grows false members and the boundaries above stop meaning
   * anything.
   *
   * The `.mjs` and `.cjs` rows record **observed** behaviour, not assumed
   * symmetry with `.js`. The compiler substitutes each JavaScript form onto
   * its own TypeScript counterpart - `./x.js` onto `x.ts`, `./x.mjs` onto
   * `x.mts`, `./x.cjs` onto `x.cts` - so those two are unresolved here only
   * because the adapter directory holds no `.mts` or `.cts` module. They are
   * not inherently unresolvable, which is why `resolveSpecifier` accepts
   * every executable extension rather than trusting this pair to stay empty.
   */
  it('makes no edge from unresolved, external or escaping specifiers', () => {
    const from = 'index.ts';

    // Nothing behind the path at all.
    expect(resolveSpecifier(from, './providers/jolpica/nope')).toBeNull();
    expect(resolveSpecifier(from, './providers/jolpica/nope.js')).toBeNull();

    // No `.mjs`/`.cjs` substitution onto a `.ts` source here. Were that to
    // change, these fail and the closure gains the edge deliberately rather
    // than through a rule this file invented.
    expect(resolveSpecifier(from, './providers/jolpica/index.mjs')).toBeNull();
    expect(resolveSpecifier(from, './providers/jolpica/index.cjs')).toBeNull();

    // Packages and Node builtins are not `src/` modules.
    expect(resolveSpecifier(from, 'typescript')).toBeNull();
    expect(resolveSpecifier(from, 'node:fs')).toBeNull();

    // A real TypeScript module that resolves *outside* the source root is
    // rejected by containment, not by failing to resolve: the harness below
    // genuinely exists and the compiler finds it, extensionless or not.
    expect(resolveSpecifier(from, '../test/support/edge-harness')).toBeNull();
    expect(
      resolveSpecifier(from, '../test/support/edge-harness.js'),
    ).toBeNull();
  });

  /**
   * Every extension a bundler executes is an edge, not just `.ts`.
   *
   * `.mts` and `.cts` are ordinary modules - an entry point can re-export the
   * dormant port from `providers/jolpica/entry.mts` - yet neither ends in
   * `.ts`. A resolver keyed on `ts.Extension.Ts`/`Tsx` alone drops them, and
   * a `sourceFiles` filter testing `endsWith('.ts')` never even reads them, so
   * both A9 boundaries and the origin-confinement scan would pass over a live
   * adapter. The extension set is enumerated from the compiler's own enum for
   * exactly this reason.
   */
  it('counts every executable TypeScript extension as a module', () => {
    for (const fileName of [
      'providers/jolpica/entry.ts',
      'providers/jolpica/entry.tsx',
      'providers/jolpica/entry.mts',
      'providers/jolpica/entry.cts',
    ]) {
      expect(isExecutableModule(fileName)).toBe(true);
    }

    // Declaration files carry no runtime, and `.d.ts` ends in `.ts`, so it has
    // to be excluded rather than simply left off the list.
    for (const fileName of [
      'providers/jolpica/entry.d.ts',
      'providers/jolpica/entry.d.mts',
      'providers/jolpica/entry.d.cts',
      'providers/jolpica/entry.js',
      'content/registries/events.development.json',
    ]) {
      expect(isExecutableModule(fileName)).toBe(false);
    }

    // The set the resolver accepts is the same one, taken from the compiler's
    // enum rather than restated as filename suffixes.
    expect([...executableExtensions].sort()).toEqual(
      [
        ts.Extension.Cts,
        ts.Extension.Mts,
        ts.Extension.Ts,
        ts.Extension.Tsx,
      ].sort(),
    );

    // The real enumeration reaches every module actually on disk.
    const files = sourceFiles(join(repoRoot, 'services', 'edge-api', 'src'));
    expect(files).toContain('providers/jolpica/calendar-port.ts');
    expect(files).toContain('index.ts');
  });

  /**
   * The third boundary the specifier walk needs, because it is the one edge
   * that cannot be read rather than merely one that was read wrongly.
   *
   * A computed dynamic import defeats the closure by construction, and esbuild
   * expands a relative template pattern into every matching module - so
   * `` import(`./providers/${mode}`) `` in the entry point would bundle the
   * adapter and let a variable select it, with all three boundaries green.
   * Rejecting the shape outright is the only sound answer; there is no
   * defensible single target to resolve it to.
   */
  it('contains no computed dynamic import anywhere under src/', () => {
    const sourceDir = join(repoRoot, 'services', 'edge-api', 'src');

    const offenders = sourceFiles(sourceDir).flatMap((file) =>
      computedDynamicImports(
        readFileSync(join(sourceDir, file), 'utf8'),
        file,
      ).map((specifier) => `${file}: import(${specifier})`),
    );

    expect(offenders).toEqual([]);
  });

  it('refuses every dynamic specifier it cannot resolve', () => {
    // Literal forms remain resolvable, so they are not refused here - they are
    // the ones `importSpecifiers` turns into real edges.
    for (const contents of [
      "void import('./providers/jolpica');",
      'void import(`./providers/jolpica`);',
    ]) {
      expect(computedDynamicImports(contents, 'index.ts')).toEqual([]);
    }

    // Everything else is refused by shape: a substitution-bearing template,
    // a concatenation, and a bare identifier all name an unknowable module.
    expect(
      computedDynamicImports('void import(`./providers/${mode}`);', 'index.ts'),
    ).toEqual(['`./providers/${mode}`']);
    expect(
      computedDynamicImports("void import('./providers/' + mode);", 'index.ts'),
    ).toEqual(["'./providers/' + mode"]);
    expect(computedDynamicImports('void import(chosen);', 'index.ts')).toEqual([
      'chosen',
    ]);
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
    const boundary = 'providers/http/provider-http-client.ts';
    // Same module enumeration as the dormancy boundaries: a `.mts` or `.cts`
    // module hard-coding its own origin is exactly what this test is for, and
    // neither ends in `.ts`.
    const files = sourceFiles(sourceDir);

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
