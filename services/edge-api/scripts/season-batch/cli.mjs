// GridView season-batch generator: offline, dormant.
//
//   npm run season-batch:generate -- --capture <dir> --out <dir>
//
// Reads one recorded capture directory (`capture.json` plus the body files it
// names), replays it through the Worker's own Jolpica ports, coordinator,
// assembly and snapshot generation, and writes `artifact.json` and
// `manifest.json` to a new output directory.
//
// It sends no request: the generator's only transport replays the capture,
// and `fetch` is disabled before the generator is loaded. It reads no
// credential and no environment variable, publishes nothing, and refuses a
// capture or output directory inside this repository. Producing a capture
// from the real provider is a separate, separately authorized step.
//
// Exit codes: 0 generated, 1 refused, 2 usage error.

import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

import { readBounded } from './bounded-read.mjs';
import {
  parseArguments,
  pathRefusal,
  physicalPath,
  treeState,
  usage,
} from './cli-guards.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '..', '..', '..', '..');
const captureManifestFile = 'capture.json';
const maximumManifestBytes = 1024 * 1024;

function report(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function refuse(failure, detail = null) {
  report({ ok: false, failure, detail });
  process.exit(1);
}

function provenance(allowDirtyTree) {
  let gitCommit;
  let status;
  try {
    const git = (...args) =>
      execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
    gitCommit = git('rev-parse', 'HEAD').trim();
    status = git('status', '--porcelain');
  } catch {
    refuse('git-unavailable');
  }
  const { treeClean, refusal } = treeState(status, allowDirtyTree);
  if (refusal !== null) refuse(refusal);
  return { gitCommit, treeClean };
}

async function outputDirectoryRefusal(out) {
  try {
    const entries = await readdir(out);
    return entries.length === 0 ? null : 'output-not-empty';
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    return 'output-unreadable';
  }
}

/** Bundles the TypeScript generator into a private temporary module. */
async function loadGenerator() {
  const directory = await mkdtemp(join(tmpdir(), 'gridview-season-batch-'));
  try {
    const bundle = await build({
      entryPoints: [join(here, 'entry.ts')],
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      target: 'es2022',
      write: false,
      logLevel: 'silent',
    });
    const file = join(directory, 'generator.mjs');
    await writeFile(file, bundle.outputFiles[0].text);
    return await import(pathToFileURL(file).href);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * Reads one capture file within `limit` bytes, or refuses: `oversized` and
 * `not-a-file` map to their own closed reasons, anything unopenable to
 * `unreadable`. Nothing is written before every file has been read.
 */
async function readCaptureFile(path, limit, reasons) {
  let read;
  try {
    read = await readBounded(path, limit);
  } catch {
    refuse(reasons.unreadable);
  }
  if (!read.ok) {
    refuse(read.reason === 'oversized' ? reasons.oversized : reasons.notAFile);
  }
  return read.bytes;
}

async function readCapture(captureDirectory, decodeCaptureManifest) {
  const manifestBytes = await readCaptureFile(
    join(captureDirectory, captureManifestFile),
    maximumManifestBytes,
    {
      oversized: 'capture-manifest-oversized',
      notAFile: 'capture-unreadable',
      unreadable: 'capture-unreadable',
    },
  );
  let capture;
  try {
    capture = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes),
    );
  } catch {
    refuse('capture-malformed', 'not-json');
  }
  const decoded = decodeCaptureManifest(capture);
  if (!decoded.ok) refuse('capture-malformed', decoded.reason);

  // The directory holds the manifest and exactly the files it names: an
  // extra file means the capture was not assembled as recorded.
  const entries = decoded.manifest.responses;
  const named = new Set(entries.map((entry) => entry.file));
  const present = await readdir(captureDirectory);
  for (const entry of present) {
    if (entry !== captureManifestFile && !named.has(entry)) {
      refuse('capture-body-unexpected');
    }
  }
  // Each body is read within its declared size, which the decoder already
  // capped at the HTTP client's response limit. A longer file is refused
  // here, unread past the bound; a shorter one fails its digest check.
  const bodies = new Map();
  for (const entry of entries) {
    bodies.set(
      entry.file,
      await readCaptureFile(
        join(captureDirectory, entry.file),
        entry.byteLength,
        {
          oversized: 'capture-body-oversized',
          notAFile: 'capture-body-missing',
          unreadable: 'capture-body-missing',
        },
      ),
    );
  }
  return { capture, bodies };
}

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${usage}\n`);
    report({ ok: false, failure: 'usage', detail: parsed.reason });
    process.exit(2);
  }
  let capture;
  let out;
  let root;
  try {
    // Physical paths: a link or junction into the repository is refused too.
    capture = await physicalPath(parsed.capture);
    out = await physicalPath(parsed.out);
    root = await physicalPath(repositoryRoot);
  } catch {
    refuse('path-unresolvable');
  }
  const refusal = pathRefusal({ capture, out, repositoryRoot: root });
  if (refusal !== null) refuse(refusal);
  const outputRefusal = await outputDirectoryRefusal(out);
  if (outputRefusal !== null) refuse(outputRefusal);

  const source = provenance(parsed.allowDirtyTree);

  // Nothing the generator loads may reach a network. Its replay transport
  // never calls `fetch`; this makes any regression fail instead of send.
  globalThis.fetch = () =>
    Promise.reject(
      new Error('The season-batch generator never sends a request.'),
    );

  const generator = await loadGenerator();
  const input = await readCapture(capture, generator.decodeCaptureManifest);
  const result = await generator.generateSeasonBatch({
    ...input,
    provenance: source,
  });
  if (!result.ok) refuse(result.failure, result.detail);

  // Both files or neither: a lone artifact without its manifest is removed.
  const written = [];
  try {
    await mkdir(out, { recursive: true });
    for (const file of [result.artifact, result.manifest]) {
      const path = join(out, file.name);
      await writeFile(path, file.text, { flag: 'wx' });
      written.push(path);
    }
  } catch {
    for (const path of written) await rm(path, { force: true });
    refuse('output-write-failed');
  }
  report({
    ok: true,
    summary: result.summary,
    capture: { sha256: result.summary.captureDigest },
    artifact: { file: result.artifact.name, sha256: result.artifact.sha256 },
    manifest: { file: result.manifest.name, sha256: result.manifest.sha256 },
  });
}

await main();
