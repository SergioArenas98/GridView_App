import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
// Declared directly as a devDependency and pinned to the exact
// version Wrangler itself pins, so the dormancy proof runs the
// bundler the deployed Worker is actually built by and cannot
// drift away from it.
import { build, type BuildOptions, type Metafile } from 'esbuild';
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
 * Parses one module for the walks below.
 *
 * The script kind is inferred from the file name rather than pinned to `TS`,
 * because those walks read every executable module under `src/`, JavaScript
 * included: `.jsx` content parsed as TypeScript mis-reads `<div>` as a type
 * assertion, which silently loses the rest of the file and, with it, any
 * origin literal or computed import declared after that point.
 */
function parseModule(contents: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    contents,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
  );
}

/**
 * True when the module declares a string-like literal whose value *is* one of
 * the pinned origins. Parses with the TypeScript compiler API and walks the
 * AST, so only genuine literals count - not prose, identifiers or a host that
 * merely appears somewhere inside a longer string.
 */
function declaresPinnedOrigin(contents: string, fileName: string): boolean {
  const source = parseModule(contents, fileName);

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
 * Every extension that carries executable code, as the compiler names them.
 *
 * The question this set answers is "would the bundler ship this file", not
 * "is this TypeScript". Both halves matter:
 *
 * - `.mts` and `.cts` are ordinary modules, but neither ends in `.ts`, so a
 *   suffix test silently skips them.
 * - JavaScript is equally executable. A `.ts` module may import a `.js`,
 *   `.jsx`, `.mjs` or `.cjs` file living under `src/`, and esbuild bundles
 *   it - the `.cjs` case through a static `require`, which is not an ESM
 *   edge at all.
 *
 * It decides which modules become **entry points** of the second dormancy
 * graph below. A module left out of the set is never made an entry point, so
 * an adapter it reaches is never seen: the set has to be the bundler's notion
 * of executable, not TypeScript's.
 *
 * Declaration extensions are excluded because they carry no runtime, and
 * `.d.ts` ends in `.ts`, so it must be excluded rather than merely not
 * listed. JSON is excluded because it cannot declare an import and so can
 * never extend a closure.
 */
// Typed as `string`, not `ts.Extension`: these are compared as filename
// suffixes, and the values still come from the compiler's own enum.
const executableExtensions: readonly string[] = [
  ts.Extension.Ts,
  ts.Extension.Tsx,
  ts.Extension.Mts,
  ts.Extension.Cts,
  ts.Extension.Js,
  ts.Extension.Jsx,
  ts.Extension.Mjs,
  ts.Extension.Cjs,
];

const declarationSuffixes: readonly string[] = ['.d.ts', '.d.mts', '.d.cts'];

/** True for a file a bundler could execute. */
function isExecutableModule(fileName: string): boolean {
  if (declarationSuffixes.some((suffix) => fileName.endsWith(suffix))) {
    return false;
  }
  return executableExtensions.some((extension) => fileName.endsWith(extension));
}

/** Every executable module under a directory, as repo-relative POSIX paths. */
function sourceFiles(sourceDir: string): string[] {
  return (readdirSync(sourceDir, { recursive: true }) as string[])
    .map((entry) => entry.toString().split('\\').join('/'))
    .filter(isExecutableModule);
}

/**
 * The dynamic imports whose specifier is **not** a literal, as source text.
 *
 * The dormancy graphs below are built by esbuild itself, so they see every
 * edge esbuild can resolve - including the relative template pattern
 * `` import(`./providers/${mode}`) ``, which esbuild expands into *every*
 * matching module. What no bundler can resolve is a specifier assembled at
 * runtime, `import('./p/' + mode)` or `import(chosen)`: esbuild records no
 * edge and bundles nothing for it.
 *
 * That leaves no reachable adapter - an unbundled specifier resolves to
 * nothing in the Workers runtime either - but it does leave a shape whose
 * meaning cannot be read off the bundle. The boundary is therefore
 * conservative rather than clever: production code may not contain one at
 * all. Today it contains no dynamic import of any kind, which makes this a
 * tripwire rather than a restriction.
 */
function computedDynamicImports(contents: string, fileName: string): string[] {
  const source = parseModule(contents, fileName);
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

/** The dormant adapter directory, as esbuild names it in a metafile. */
const dormantDir = 'src/providers/jolpica/';

/** The Worker entry point, relative to the Edge API project root. */
const workerEntryPoint = 'src/index.ts';

/**
 * The Worker build, as the deployed bundle is actually produced.
 *
 * These are Wrangler's own esbuild options for a modules Worker, minus the
 * ones that only shape the emitted text (`minify`, `sourcemap`, `keepNames`,
 * `define`, `inject` and its plugins). Everything that decides *which files
 * end up in the bundle* is kept verbatim, because that is the only thing
 * these boundaries read:
 *
 * - `conditions` and the absent `platform` pick the same package-export and
 *   `main`-field branches Wrangler resolves through.
 * - `loader` maps `.js`, `.mjs` and `.cjs` onto the JSX loader exactly as
 *   Wrangler does, so a JavaScript or CommonJS intermediary under `src/` is
 *   parsed and followed rather than treated as an opaque file.
 * - `bundle` is what makes esbuild walk edges at all - including a static
 *   `require('./providers/jolpica')`, which is not an ESM import and which a
 *   hand-written specifier walk over the TypeScript AST did not see.
 *
 * Nothing is written: `write: false` keeps the proof in memory, so no
 * generated bundle can land in the repository.
 */
const workerBuildOptions: BuildOptions = {
  bundle: true,
  write: false,
  metafile: true,
  format: 'esm',
  target: 'es2024',
  supported: { 'import-source': true },
  loader: { '.js': 'jsx', '.mjs': 'jsx', '.cjs': 'jsx' },
  conditions: ['workerd', 'worker', 'browser'],
  external: ['__STATIC_CONTENT_MANIFEST'],
  // Required by esbuild whenever there is more than one entry point. Nothing
  // is emitted to it, and it is resolved against `absWorkingDir`, never the
  // repository.
  outdir: 'dormancy-graph',
  // Wrangler's own value. A build error still rejects; only esbuild's own
  // logging is suppressed.
  logLevel: 'silent',
};

/**
 * The module graph esbuild builds for a set of entry points.
 *
 * This is the dormancy proof itself: not a re-implementation of module
 * resolution, but the resolver the deployed bundle is produced by. Every edge
 * shape the bundler follows - a static import, a re-export, a dynamic
 * `import()` with a literal or template specifier, a relative template
 * pattern it expands, and a static `require` inside a CommonJS module - is an
 * edge here by construction rather than by a rule this file remembered to
 * write down.
 *
 * `absWorkingDir` is what metafile keys are relative to, so a fixture rooted
 * at a temporary directory yields the same `src/...` keys as the real tree
 * and can be checked by the same helpers below.
 */
async function moduleGraph(
  absWorkingDir: string,
  entryPoints: readonly string[],
): Promise<Metafile> {
  const result = await build({
    ...workerBuildOptions,
    absWorkingDir,
    entryPoints: [...entryPoints],
  });
  if (result.metafile === undefined) {
    throw new Error('esbuild produced no metafile');
  }
  return result.metafile;
}

/** Every module of the dormant directory the graph contains. */
function dormantModules(metafile: Metafile): string[] {
  return Object.keys(metafile.inputs)
    .filter((input) => input.startsWith(dormantDir))
    .sort();
}

/**
 * Every edge that crosses *into* the dormant directory, with its importer and
 * the kind esbuild recorded.
 *
 * `dormantModules` is the complete statement - a module the bundler never
 * reads cannot run - and this is what makes a failure legible: it names the
 * module that reached in and whether it did so by `import-statement`,
 * `dynamic-import` or `require-call`.
 */
function edgesIntoDormantDir(metafile: Metafile): string[] {
  const edges: string[] = [];
  for (const [input, detail] of Object.entries(metafile.inputs)) {
    if (input.startsWith(dormantDir)) continue;
    for (const imported of detail.imports) {
      if (imported.path.startsWith(dormantDir)) {
        edges.push(`${input} -> ${imported.path} (${imported.kind})`);
      }
    }
  }
  return edges.sort();
}

/**
 * Every runtime module under `src/` that is not part of the dormant adapter,
 * as an esbuild entry point.
 *
 * The entry-point graph answers "is the adapter in the deployed bundle". This
 * set answers the separate question A9 also asks: does *anything* under
 * `src/` reach the adapter, including a module the entry point does not
 * reach today. Making every such module an entry point means the union of
 * their graphs contains a dormant module only if one of them imported it.
 */
function runtimeEntryPointsOutsideDormantDir(): string[] {
  return sourceFiles(srcRoot)
    .map((file) => `src/${file}`)
    .filter((entry) => !entry.startsWith(dormantDir));
}

/**
 * Runs `assert` against a throwaway source tree written outside the
 * repository, and removes it afterwards however the assertion ends.
 *
 * The negative controls need a tree in which the adapter *is* reachable. They
 * build it with `moduleGraph` and the options above - the same helper and the
 * same build configuration the real assertions use - so what they demonstrate
 * is that this proof fails when it should, not that some parallel check does.
 */
async function withSourceTree(
  files: Readonly<Record<string, string>>,
  assert: (root: string) => Promise<void>,
): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'gridview-dormancy-'));
  try {
    for (const [file, contents] of Object.entries(files)) {
      const target = join(root, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents, 'utf8');
    }
    await assert(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
   *
   * The first two are answered by **the bundler itself**, not by a private
   * model of it. An earlier revision walked the TypeScript AST and resolved
   * specifiers with `ts.resolveModuleName`; every defect found in it was the
   * same defect - an edge the real build follows and the model did not, most
   * recently a static `require` in a CommonJS intermediary, which is not an
   * ESM import at all. Asking esbuild under Wrangler's own options removes
   * the class rather than another instance of it.
   */
  it('keeps the Jolpica adapter unreachable from the Worker entry point', async () => {
    const graph = await moduleGraph(edgeApiRoot, [workerEntryPoint]);

    // The entry point's graph is the set of files the deployed bundle is
    // built from. Nothing under the adapter directory may appear in it.
    expect(edgesIntoDormantDir(graph)).toEqual([]);
    expect(dormantModules(graph)).toEqual([]);

    // The graph is real, not an empty one from a build that resolved nothing:
    // the entry point genuinely reaches its own modules.
    const inputs = Object.keys(graph.inputs);
    expect(inputs).toContain(workerEntryPoint);
    expect(inputs).toContain('src/providers/factory.ts');
    expect(inputs).toContain('src/sync/sync-service.ts');
  });

  it('is imported by no runtime module outside its own directory', async () => {
    const entryPoints = runtimeEntryPointsOutsideDormantDir();
    const graph = await moduleGraph(edgeApiRoot, entryPoints);

    // Every module outside the adapter directory is its own entry point, so
    // an adapter module in this graph was reached from one of them - whether
    // or not the Worker entry point reaches that importer.
    expect(edgesIntoDormantDir(graph)).toEqual([]);
    expect(dormantModules(graph)).toEqual([]);

    // The enumeration is real, and it excludes exactly the adapter.
    expect(entryPoints).toContain(workerEntryPoint);
    expect(entryPoints).toContain('src/providers/coordination/coordinator.ts');
    expect(entryPoints.some((entry) => entry.startsWith(dormantDir))).toBe(
      false,
    );
    // The graph covers more than the deployed bundle: the coordination seam
    // is dormant too, and is in this graph only because it is an entry point
    // of its own.
    expect(Object.keys(graph.inputs)).toContain(
      'src/providers/coordination/coordinator.ts',
    );
  });

  /**
   * The season-circuits port, named module by module.
   *
   * The directory-wide assertions above already cover it. This pins the claim
   * specifically and non-vacuously: rooted at the port itself, the same
   * bundler under the same options reaches every circuits module, so their
   * absence from the Worker entry point's graph is a statement about
   * reachability rather than about a misspelt path.
   */
  it('keeps the season-circuits port out of the Worker graph', async () => {
    const circuitsModules = [
      `${dormantDir}circuits-port.ts`,
      `${dormantDir}circuits-payload.ts`,
      `${dormantDir}circuits-normalizer.ts`,
      `${dormantDir}curated-circuits.ts`,
    ];

    const own = await moduleGraph(edgeApiRoot, [circuitsModules[0] as string]);
    for (const module of circuitsModules) {
      expect(Object.keys(own.inputs)).toContain(module);
    }

    const worker = await moduleGraph(edgeApiRoot, [workerEntryPoint]);
    for (const module of circuitsModules) {
      expect(Object.keys(worker.inputs)).not.toContain(module);
    }
  });

  /**
   * The season-participants port, named module by module, on exactly the
   * circuits port's terms: rooted at the port, the bundler reaches every
   * participants module, and none of them is in the Worker entry point's graph.
   */
  it('keeps the season-participants port out of the Worker graph', async () => {
    const participantsModules = [
      `${dormantDir}participants-port.ts`,
      `${dormantDir}participants-payload.ts`,
      `${dormantDir}participants-normalizer.ts`,
      `${dormantDir}curated-participants.ts`,
    ];

    const own = await moduleGraph(edgeApiRoot, [
      participantsModules[0] as string,
    ]);
    for (const module of participantsModules) {
      expect(Object.keys(own.inputs)).toContain(module);
    }

    const worker = await moduleGraph(edgeApiRoot, [workerEntryPoint]);
    for (const module of participantsModules) {
      expect(Object.keys(worker.inputs)).not.toContain(module);
    }
  });

  /**
   * The coordination seam the ports answer to is dormant too, and the
   * multi-request amendment (ADR 0023 A1) changed only modules inside it. So
   * no coordination module may be in the Worker entry point's graph either:
   * that is what lets the amendment leave the deployed bundle unchanged.
   */
  it('keeps the coordination seam out of the Worker graph', async () => {
    const coordinationModules = [
      'src/providers/coordination/port.ts',
      'src/providers/coordination/coordinator.ts',
      'src/providers/coordination/outcome.ts',
    ];

    const own = await moduleGraph(edgeApiRoot, [
      'src/providers/coordination/index.ts',
    ]);
    for (const module of coordinationModules) {
      expect(Object.keys(own.inputs)).toContain(module);
    }

    const worker = await moduleGraph(edgeApiRoot, [workerEntryPoint]);
    for (const module of coordinationModules) {
      expect(Object.keys(worker.inputs)).not.toContain(module);
    }
  });

  /**
   * Non-vacuity for both boundaries above, in the four shapes a reachable
   * adapter could take.
   *
   * Each control builds a throwaway tree with `moduleGraph` under
   * `workerBuildOptions` - the same helper and the same build configuration
   * the two assertions use - and requires the boundary to report the edge.
   * The `require-call` row is the one a specifier walk over the TypeScript
   * AST missed entirely: `require` is not an ESM import, and Wrangler's
   * bundler follows it.
   */
  it('reports a reachable adapter through every edge shape a bundle follows', async () => {
    const dormantModule = `${dormantDir}index.ts`;
    const adapter = { [dormantModule]: 'export const port = 1;\n' };

    const reachable: readonly [string, string, Record<string, string>][] = [
      [
        'import-statement',
        'src/index.ts',
        {
          'src/index.ts': "import './providers/jolpica';\nexport default {};\n",
          ...adapter,
        },
      ],
      [
        'dynamic-import',
        'src/index.ts',
        {
          'src/index.ts':
            'void import(`./providers/jolpica`);\nexport default {};\n',
          ...adapter,
        },
      ],
      [
        // A JavaScript intermediary, imported with the `.js` specifier the
        // ecosystem writes by habit and re-exporting the adapter the same way.
        'import-statement',
        'src/bridge.js',
        {
          'src/index.ts': "import './bridge.js';\nexport default {};\n",
          'src/bridge.js': "export * from './providers/jolpica/index.js';\n",
          ...adapter,
        },
      ],
      [
        // A CommonJS intermediary reaching the adapter by static `require`.
        'require-call',
        'src/bridge.cjs',
        {
          'src/index.ts': "import './bridge.cjs';\nexport default {};\n",
          'src/bridge.cjs':
            "module.exports = require('./providers/jolpica');\n",
          ...adapter,
        },
      ],
    ];

    for (const [kind, importer, files] of reachable) {
      await withSourceTree(files, async (root) => {
        const graph = await moduleGraph(root, ['src/index.ts']);
        expect(edgesIntoDormantDir(graph)).toEqual([
          `${importer} -> ${dormantModule} (${kind})`,
        ]);
        expect(dormantModules(graph)).toEqual([dormantModule]);
      });
    }
  });

  /**
   * Non-vacuity for the *second* boundary specifically, which the controls
   * above cannot supply: each of them is reachable from the entry point, so
   * the entry-point graph alone would have caught it.
   *
   * Here the importer is an orphan - no edge reaches it from `src/index.ts` -
   * so the entry-point graph is legitimately clean while a runtime module
   * under `src/` does import the adapter. Only the all-modules graph sees it,
   * which is why that assertion is not folded into the first.
   */
  it('reports an adapter reached only from outside the entry-point graph', async () => {
    const dormantModule = `${dormantDir}index.ts`;

    await withSourceTree(
      {
        'src/index.ts': 'export default {};\n',
        'src/orphan.ts': "export * from './providers/jolpica';\n",
        [dormantModule]: 'export const port = 1;\n',
      },
      async (root) => {
        const entryGraph = await moduleGraph(root, ['src/index.ts']);
        expect(dormantModules(entryGraph)).toEqual([]);

        const allModules = await moduleGraph(root, [
          'src/index.ts',
          'src/orphan.ts',
        ]);
        expect(edgesIntoDormantDir(allModules)).toEqual([
          `src/orphan.ts -> ${dormantModule} (import-statement)`,
        ]);
        expect(dormantModules(allModules)).toEqual([dormantModule]);
      },
    );
  });

  /**
   * Every extension a bundler executes has to be an entry point, not just
   * `.ts`.
   *
   * `.mts` and `.cts` are ordinary modules - one can re-export the dormant
   * port from `providers/jolpica/entry.mts` - yet neither ends in `.ts`.
   * JavaScript is executable on the same terms: a `.js`, `.jsx`, `.mjs` or
   * `.cjs` file under `src/` is bundled by esbuild like any other module, and
   * a `.cjs` one can reach the adapter by `require` alone. Any extension left
   * out of the set is never read by `sourceFiles`, so it never becomes an
   * entry point of the all-modules graph and an adapter it imports is never
   * seen there.
   */
  it('counts every executable extension as a module', () => {
    for (const fileName of [
      'providers/jolpica/entry.ts',
      'providers/jolpica/entry.tsx',
      'providers/jolpica/entry.mts',
      'providers/jolpica/entry.cts',
      // JavaScript is executable too. A `.ts` module may import a JS file
      // under `src/`, and esbuild bundles it, so a JS or CommonJS
      // intermediary left out of this set never becomes an entry point.
      'providers/jolpica/entry.js',
      'providers/jolpica/entry.jsx',
      'providers/jolpica/entry.mjs',
      'providers/jolpica/entry.cjs',
    ]) {
      expect(isExecutableModule(fileName)).toBe(true);
    }

    // Declaration files carry no runtime, and each of them ends in an
    // extension that is otherwise accepted, so they have to be excluded
    // rather than simply left off the list. JSON cannot declare an import and
    // so can never extend a graph.
    for (const fileName of [
      'providers/jolpica/entry.d.ts',
      'providers/jolpica/entry.d.mts',
      'providers/jolpica/entry.d.cts',
      'content/registries/events.development.json',
      'providers/jolpica/notes.md',
    ]) {
      expect(isExecutableModule(fileName)).toBe(false);
    }

    // The set is taken from the compiler's own enum rather than restated here
    // as filename suffixes.
    expect([...executableExtensions].sort()).toEqual(
      [
        ts.Extension.Cjs,
        ts.Extension.Cts,
        ts.Extension.Js,
        ts.Extension.Jsx,
        ts.Extension.Mjs,
        ts.Extension.Mts,
        ts.Extension.Ts,
        ts.Extension.Tsx,
      ].sort(),
    );

    // The real enumeration reaches every module actually on disk.
    const files = sourceFiles(join(repoRoot, 'services', 'edge-api', 'src'));
    expect(files).toContain('providers/jolpica/calendar-port.ts');
    expect(files).toContain('providers/jolpica/circuits-port.ts');
    expect(files).toContain('providers/jolpica/participants-port.ts');
    expect(files).toContain('index.ts');
  });

  /**
   * The one shape the two graphs above cannot describe, rather than one they
   * might describe wrongly.
   *
   * esbuild expands a relative template pattern into every matching module,
   * so `` import(`./providers/${mode}`) `` does appear in both graphs and is
   * caught there. A specifier assembled at runtime - `import('./p/' + mode)`
   * or `import(chosen)` - resolves to nothing at build time, so it neither
   * bundles the adapter nor says anything about it.
   *
   * Rejecting the shape outright is the only sound answer; there is no
   * defensible single target to resolve it to, and a bundle proof cannot
   * speak about a module the bundler never saw.
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
    // Literal forms remain resolvable, so they are not refused here - the
    // bundle graphs above record them as `dynamic-import` edges.
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
      expect(contents).not.toContain('JolpicaCircuitsPort');
      expect(contents).not.toContain('JolpicaParticipantsPort');
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
