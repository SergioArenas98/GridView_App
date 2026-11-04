// One run of the automatic season-batch job (staging).
//
//   node scripts/auto-update/run.mjs --state <file outside the repository>
//        [--mode scheduled|bootstrap] [--submit]
//
// Reads Jolpica F1 (the only provider request path: `capture.mjs`, paced,
// first non-200 ends the run, never retried), generates the season batch in
// process with the repository's own generator, applies the coordinated
// runtime's state machine (`reconcile.ts`) and, only with `--submit` and only
// when the gate admits the batch, submits it once to the staging ingest with
// the scoped token in GRIDVIEW_INGEST_TOKEN. Without `--submit` nothing
// credentialed is sent. Generated data is never written to disk.
//
// Output: one JSON line per step, closed fields only, never a provider body
// or the token. Exit codes: 0 done (idle, held, withheld, unchanged,
// published), 1 internal error (the state is left as it was), 2 attention
// (continues next run), 3 stopped for a human, 4 usage.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

import { realSleep } from './capture.mjs';
import { allowedOrigins } from './submit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '..', '..', '..', '..');
const SEASON = 2026;
const SPACING_MS = 2000;

const say = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

export function parseArguments(argv) {
  const options = { mode: 'scheduled', submit: false, state: null };
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i];
    if (name === '--submit') {
      options.submit = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) return null;
    i += 1;
    if (name === '--state') options.state = resolve(value);
    else if (
      name === '--mode' &&
      (value === 'scheduled' || value === 'bootstrap')
    )
      options.mode = value;
    else return null;
  }
  if (options.state === null) return null;
  // State never lives in the repository: an untracked file would make the
  // generator's tree dirty, and the ingest refuses a dirty-tree batch.
  const inside = relative(repositoryRoot, options.state);
  return !inside.startsWith('..') && !isAbsolute(inside) ? null : options;
}

function git(...args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
}

async function loadBundle() {
  const directory = await mkdtemp(join(tmpdir(), 'gridview-auto-update-'));
  try {
    const bundle = await build({
      entryPoints: [join(here, 'entry.ts')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node22',
      write: false,
      logLevel: 'silent',
    });
    const file = join(directory, 'auto-update.mjs');
    await writeFile(file, bundle.outputFiles[0].text);
    return await import(pathToFileURL(file).href);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function writeState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temporary, path);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options === null) {
    say({ ok: false, failure: 'usage' });
    process.exit(4);
  }
  const gitCommit = git('rev-parse', 'HEAD').trim();
  // The generator CLI's rule: any porcelain line makes the tree dirty.
  const treeClean = git('status', '--porcelain') === '';
  const module = await loadBundle();

  let state = null;
  if (existsSync(options.state)) {
    const decoded = module.decodeState(
      JSON.parse(readFileSync(options.state, 'utf8')),
      gitCommit,
    );
    if (!decoded.ok) {
      say({ ok: false, step: 'state', failure: decoded.reason });
      process.exit(3);
    }
    state = decoded.state;
  }

  const token = process.env.GRIDVIEW_INGEST_TOKEN;
  const result = await module.runOnce(state, options.mode, {
    season: SEASON,
    codeVersion: gitCommit,
    now: () => new Date(),
    sleep: realSleep,
    spacingMs: SPACING_MS,
    jolpica: (url, init) => fetch(url, init),
    generate: async (manifest, bodies) => {
      const generated = await module.generateSeasonBatch({
        capture: manifest,
        bodies,
        provenance: { gitCommit, treeClean },
      });
      if (!generated.ok) return { ok: false, failure: generated.failure };
      return {
        ok: true,
        documents: JSON.parse(generated.artifact.text).documents,
        manifestText: generated.manifest.text,
        manifestSha256: generated.manifest.sha256,
        artifactText: generated.artifact.text,
      };
    },
    buildSubmission: async (generated, expectedActiveVersion) => {
      const built = await module.buildSubmission({
        manifestBytes: new TextEncoder().encode(generated.manifestText),
        artifactBytes: new TextEncoder().encode(generated.artifactText),
        reviewedManifestSha256: generated.manifestSha256,
        expectedActiveVersion,
        now: new Date(),
      });
      return built.ok
        ? { ok: true, text: built.text }
        : { ok: false, failure: built.failure };
    },
    worker: (url, init) => fetch(url, init),
    origin: allowedOrigins[0],
    token,
    submit: options.submit,
    log: (line) => say({ ok: true, ...line }),
  });
  if (result.state !== null) writeState(options.state, result.state);
  say({
    ok: result.exitCode === 0,
    step: 'result',
    outcome: result.outcome,
    exitCode: result.exitCode,
  });
  process.exit(result.exitCode);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    await main();
  } catch (error) {
    // Never the message: it can quote provider bytes or a URL.
    say({ ok: false, step: 'internal', failure: error?.name ?? 'Error' });
    process.exit(1);
  }
}
