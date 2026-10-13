// GridView season-batch submission builder: offline.
//
//   npm run season-batch:submission -- --batch <dir> --manifest-sha256 <hex> \
//     --expected-active-version <version> --out <file>
//
// Reads one reviewed season batch directory (exactly `artifact.json` and
// `manifest.json`, as the season-batch generator wrote them), runs the
// Worker's own batch verification on it, and writes the exact request body
// `POST /internal/admin/season/ingest` accepts to a new file. A batch the
// Worker would refuse is refused here with the same closed reason, and no
// file is written.
//
// It sends no request, reads no credential and no environment variable, and
// refuses a batch or output inside this repository. Sending the body is a
// separate, separately authorized step (staging runbook, section 6).
//
// Exit codes: 0 written, 1 refused, 2 usage error.

import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

import { readBounded } from './bounded-read.mjs';
import { physicalPath } from './cli-guards.mjs';
import {
  parseSubmissionArguments,
  submissionPathRefusal,
  submissionUsage,
} from './submission-guards.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '..', '..', '..', '..');
const batchFiles = ['artifact.json', 'manifest.json'];

function report(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function refuse(failure) {
  report({ ok: false, failure });
  process.exit(1);
}

/** Bundles the TypeScript builder into a private temporary module. */
async function loadBuilder() {
  const directory = await mkdtemp(join(tmpdir(), 'gridview-submission-'));
  try {
    const bundle = await build({
      entryPoints: [join(here, 'submission-entry.ts')],
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      target: 'es2022',
      write: false,
      logLevel: 'silent',
    });
    const file = join(directory, 'builder.mjs');
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

async function readBatch(directory, builder) {
  let present;
  try {
    present = await readdir(directory);
  } catch {
    refuse('batch-unreadable');
  }
  for (const entry of present) {
    if (!batchFiles.includes(entry)) refuse('batch-file-unexpected');
  }
  for (const file of batchFiles) {
    if (!present.includes(file)) refuse('batch-file-missing');
  }
  return {
    manifestBytes: await readBatchFile(
      join(directory, 'manifest.json'),
      builder.maximumManifestBytes,
    ),
    // Nothing larger than the Worker reads is worth reading here.
    artifactBytes: await readBatchFile(
      join(directory, 'artifact.json'),
      builder.maximumSubmissionBytes,
    ),
  };
}

async function main() {
  const parsed = parseSubmissionArguments(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${submissionUsage}\n`);
    report({ ok: false, failure: 'usage', detail: parsed.reason });
    process.exit(2);
  }
  let batch;
  let out;
  let root;
  try {
    batch = await physicalPath(parsed.batch);
    out = await physicalPath(parsed.out);
    root = await physicalPath(repositoryRoot);
  } catch {
    refuse('path-unresolvable');
  }
  const refusal = submissionPathRefusal({ batch, out }, root);
  if (refusal !== null) refuse(refusal);

  // Nothing the builder loads may reach a network.
  globalThis.fetch = () =>
    Promise.reject(new Error('The submission builder never sends a request.'));

  const builder = await loadBuilder();
  const input = await readBatch(batch, builder);
  const result = await builder.buildSubmission({
    ...input,
    reviewedManifestSha256: parsed.manifestSha256,
    expectedActiveVersion: parsed.expectedActiveVersion,
    now: new Date(),
  });
  if (!result.ok) refuse(result.failure);

  try {
    // `wx`: an existing file is never overwritten.
    await writeFile(out, result.text, { flag: 'wx' });
  } catch (error) {
    refuse(error?.code === 'EEXIST' ? 'output-exists' : 'output-write-failed');
  }
  report({ ok: true, summary: result.summary });
}

await main();
