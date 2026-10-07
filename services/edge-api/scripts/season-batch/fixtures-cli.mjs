// GridView frozen-fixture converter: offline, test-only.
//
//   npm run season-batch:fixtures -- --batch <dir> --out <dir> \
//     --manifest-sha256 <hex> --origin <provider-capture|synthetic>
//
// Reads one season batch directory (exactly `artifact.json` and
// `manifest.json`, as the season-batch generator wrote them), verifies it
// against the manifest SHA-256 the operator reviewed, and writes the fixture
// envelopes `FixtureGridViewApi` loads, plus `frozen-dataset.json`, to a new
// output directory. Every envelope is validated against the OpenAPI contract
// before anything is written.
//
// It sends no request, reads no credential and no environment variable, and
// refuses a batch or output directory inside this repository. All files are
// written, or none: they are written to a private sibling directory that is
// renamed into place only once complete.
//
// Exit codes: 0 converted, 1 refused, 2 usage error.

import {
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

import {
  buildOpenApiAjv,
  compileArraySchema,
  compileSchema,
  loadOpenApi,
} from '../lib/openapi-ajv.mjs';
import { readBounded } from './bounded-read.mjs';
import { physicalPath } from './cli-guards.mjs';
import {
  contractRefusal,
  convertUsage,
  directoriesRefusal,
  parseConvertArguments,
} from './fixtures-guards.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '..', '..', '..', '..');
const batchFiles = ['artifact.json', 'manifest.json'];

function report(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function refuse(failure, detail = null) {
  report({ ok: false, failure, detail });
  process.exit(1);
}

/** Bundles the TypeScript converter into a private temporary module. */
async function loadConverter() {
  const directory = await mkdtemp(join(tmpdir(), 'gridview-frozen-fixtures-'));
  try {
    const bundle = await build({
      entryPoints: [join(here, 'fixtures-entry.ts')],
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      target: 'es2022',
      write: false,
      logLevel: 'silent',
    });
    const file = join(directory, 'converter.mjs');
    await writeFile(file, bundle.outputFiles[0].text);
    return await import(pathToFileURL(file).href);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function readBatchFile(path, limit) {
  let read;
  try {
    read = await readBounded(path, limit);
  } catch {
    refuse('batch-file-missing');
  }
  if (!read.ok) {
    refuse(
      read.reason === 'oversized'
        ? 'batch-file-oversized'
        : 'batch-file-missing',
    );
  }
  return read.bytes;
}

async function readBatch(directory, converter, manifestSha256) {
  let present;
  try {
    present = await readdir(directory);
  } catch {
    refuse('batch-unreadable');
  }
  // Exactly the generator's two files: anything else means the directory was
  // not left as the generator wrote it.
  for (const entry of present) {
    if (!batchFiles.includes(entry)) refuse('batch-file-unexpected');
  }
  for (const file of batchFiles) {
    if (!present.includes(file)) refuse('batch-file-missing');
  }
  const manifestBytes = await readBatchFile(
    join(directory, 'manifest.json'),
    converter.maximumManifestBytes,
  );
  const decoded = await converter.decodeReviewedManifest(
    manifestBytes,
    manifestSha256,
  );
  if (!decoded.ok) refuse(decoded.failure);
  // Read within the size the reviewed manifest declares: a longer artifact is
  // refused unread past the bound, a shorter one fails its digest check.
  const artifactBytes = await readBatchFile(
    join(directory, 'artifact.json'),
    decoded.manifest.artifactByteLength,
  );
  return { manifestBytes, artifactBytes };
}

async function outputRefusal(out) {
  try {
    await readdir(out);
    return 'output-exists';
  } catch (error) {
    return error?.code === 'ENOENT' ? null : 'output-unreadable';
  }
}

/** Writes every file into a private sibling, then renames it into place. */
async function writeAll(out, files) {
  await mkdir(dirname(out), { recursive: true });
  const staging = await mkdtemp(
    join(dirname(out), `.${basename(out)}.partial-`),
  );
  try {
    for (const file of files) {
      await writeFile(join(staging, file.name), file.text, { flag: 'wx' });
    }
    await rename(staging, out);
  } catch {
    await rm(staging, { recursive: true, force: true });
    refuse('output-write-failed');
  }
}

async function main() {
  const parsed = parseConvertArguments(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${convertUsage}\n`);
    report({ ok: false, failure: 'usage', detail: parsed.reason });
    process.exit(2);
  }
  let batch;
  let out;
  let root;
  try {
    // Physical paths: a link or junction into the repository is refused too.
    batch = await physicalPath(parsed.batch);
    out = await physicalPath(parsed.out);
    root = await physicalPath(repositoryRoot);
  } catch {
    refuse('path-unresolvable');
  }
  const refusal = directoriesRefusal({ batch, output: out }, root);
  if (refusal !== null) refuse(refusal);
  const existing = await outputRefusal(out);
  if (existing !== null) refuse(existing);

  // Nothing the converter loads may reach a network.
  globalThis.fetch = () =>
    Promise.reject(new Error('The fixture converter never sends a request.'));

  const converter = await loadConverter();
  const input = await readBatch(batch, converter, parsed.manifestSha256);
  const result = await converter.convertSeasonBatch({
    ...input,
    expectedManifestSha256: parsed.manifestSha256,
    origin: parsed.origin,
  });
  if (!result.ok) refuse(result.failure);

  const { ajv, ref } = buildOpenApiAjv(loadOpenApi());
  const invalid = contractRefusal(result.files, {
    ajv,
    ref,
    compileSchema,
    compileArraySchema,
  });
  if (invalid !== null) refuse('fixture-contract-invalid');

  await writeAll(out, result.files);
  const descriptor = result.files.find(
    (file) => file.name === converter.descriptorFile,
  );
  report({
    ok: true,
    summary: result.summary,
    descriptor: { file: descriptor.name, sha256: descriptor.sha256 },
  });
}

await main();
