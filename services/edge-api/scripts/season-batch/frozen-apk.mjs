// GridView frozen-data test APK build: local, test-only.
//
//   npm run season-batch:frozen-apk -- --batch <dir> \
//     --manifest-sha256 <hex> --origin <provider-capture|synthetic> \
//     --fixtures <dir> --work <dir> --out <dir> [--commit <rev>] [--prepare-only]
//
// 1. Verifies the converted fixture directory against its own descriptor
//    (`frozen-dataset.json`), then reconverts the reviewed batch with the
//    converter CLI into a private temporary directory and requires the
//    fixture directory to be exactly that conversion, byte for byte. An
//    edited fixture, a relabelled origin or a swapped set is refused even if
//    its descriptor was edited to match.
// 2. Exports the committed tree of `--commit` (default `HEAD`) with
//    `git archive` into `--work`, a new directory outside this repository.
//    The repository's working tree, index and refs are never touched.
// 3. Replaces the export's `assets/dev_fixtures/` with the verified fixtures.
// 4. Unless `--prepare-only`: in the export, runs `flutter pub get`, the
//    bundled-fixture load test against the injected fixtures, and
//    `flutter build apk --debug --flavor staging` with `APP_ENV=staging` and
//    `DATA_SOURCE=fixture`, then copies the APK and a build record to `--out`.
//
// The production flavor, release signing and the normal build are never
// used. Nothing is written inside this repository, and nothing is sent: the
// tool makes no request of its own (Flutter and Gradle may fetch their own
// dependencies during the build, as any build does).
//
// Exit codes: 0 built (or prepared), 1 refused or failed, 2 usage error.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readBounded } from './bounded-read.mjs';
import { physicalPath } from './cli-guards.mjs';
import {
  buildUsage,
  descriptorFile,
  directoriesRefusal,
  exportLauncherRefusal,
  frozenApkName,
  frozenBuildApk,
  frozenBuildSteps,
  parseBuildArguments,
  sameFixtureSet,
  verifyFixtureSet,
  workPathRefusal,
} from './fixtures-guards.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '..', '..', '..', '..');
const maximumFixtureBytes = 32 * 1024 * 1024;
const maximumExportBytes = 512 * 1024 * 1024;

function report(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function refuse(failure, detail = null) {
  report({ ok: false, failure, detail });
  process.exit(1);
}

async function absent(path) {
  try {
    await readdir(path);
    return false;
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    throw error;
  }
}

/** Every file in `directory`, by name, or `null` if any cannot be read. */
async function readDirectoryFiles(directory) {
  try {
    const files = new Map();
    for (const entry of await readdir(directory)) {
      const read = await readBounded(
        join(directory, entry),
        maximumFixtureBytes,
      );
      if (!read.ok) return null;
      files.set(entry, read.bytes);
    }
    return files;
  } catch {
    return null;
  }
}

/**
 * Reconverts the batch with the converter CLI, which applies every converter
 * and contract check, and requires `fixtures` to equal its output exactly.
 */
async function requireReconversion(parsed, batch, fixtures) {
  // `refuse` exits the process, which skips `finally`: the private copy is
  // removed first, and only then is the outcome acted on.
  const scratch = await mkdtemp(join(tmpdir(), 'gridview-frozen-reconvert-'));
  let outcome;
  try {
    outcome = await reconversionOutcome(parsed, batch, fixtures, scratch);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  if (!outcome.ok) refuse(outcome.failure, outcome.detail);
}

async function reconversionOutcome(parsed, batch, fixtures, scratch) {
  const out = join(scratch, 'fixtures');
  const converted = spawnSync(
    process.execPath,
    [
      join(here, 'fixtures-cli.mjs'),
      '--batch',
      batch,
      '--out',
      out,
      '--manifest-sha256',
      parsed.manifestSha256,
      '--origin',
      parsed.origin,
    ],
    { encoding: 'utf8' },
  );
  if (converted.status !== 0) {
    const line = converted.stdout.trim().split('\n').at(-1) ?? '';
    let detail = null;
    try {
      detail = JSON.parse(line).failure ?? null;
    } catch {
      // No report: the conversion itself failed.
    }
    return { ok: false, failure: 'batch-not-convertible', detail };
  }
  const expected = await readDirectoryFiles(out);
  const actual = await readDirectoryFiles(fixtures);
  if (expected === null || actual === null) {
    return { ok: false, failure: 'fixtures-unreadable', detail: null };
  }
  return sameFixtureSet(expected, actual)
    ? { ok: true }
    : { ok: false, failure: 'fixtures-not-reproduced', detail: null };
}

async function readFixtures(directory) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch {
    refuse('fixtures-unreadable');
  }
  if (!entries.includes(descriptorFile)) refuse('descriptor-missing');
  const files = new Map();
  let descriptorBytes = null;
  for (const entry of entries) {
    let read;
    try {
      read = await readBounded(join(directory, entry), maximumFixtureBytes);
    } catch {
      refuse('fixtures-unreadable');
    }
    if (!read.ok) refuse('fixture-unexpected');
    if (entry === descriptorFile) descriptorBytes = read.bytes;
    else files.set(entry, read.bytes);
  }
  const verified = verifyFixtureSet(descriptorBytes, files);
  if (!verified.ok) refuse(verified.reason);
  return { descriptor: verified.descriptor, descriptorBytes, files };
}

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    maxBuffer: maximumExportBytes,
    ...options,
  });
  if (result.status !== 0) return null;
  return result.stdout;
}

/** Exports the committed tree into `work` with `git archive`. */
async function exportTree(commit, work) {
  const resolved = git(
    ['rev-parse', '--verify', '--end-of-options', `${commit}^{commit}`],
    { encoding: 'utf8' },
  );
  if (resolved === null) refuse('commit-unresolvable');
  const sha = resolved.trim();
  const archive = git(['archive', '--format=tar', sha]);
  if (archive === null) refuse('export-failed');
  await mkdir(work, { recursive: true });
  // The archive is extracted from standard input, relative to `work`, so no
  // drive-letter path reaches tar.
  const extracted = spawnSync('tar', ['-xf', '-'], {
    cwd: work,
    input: archive,
    maxBuffer: maximumExportBytes,
  });
  if (extracted.status !== 0) refuse('export-failed');
  return sha;
}

/** Replaces the export's fixture assets with the verified fixtures. */
async function inject(work, descriptorBytes, files) {
  const launcher = exportLauncherRefusal(await readdir(work));
  if (launcher !== null) refuse(launcher);
  const pubspec = await readFile(join(work, 'pubspec.yaml'), 'utf8');
  if (!/^ {4}- assets\/dev_fixtures\/$/m.test(pubspec)) {
    refuse('export-unexpected');
  }
  const assets = join(work, 'assets', 'dev_fixtures');
  await rm(assets, { recursive: true, force: true });
  await mkdir(assets, { recursive: true });
  for (const [name, bytes] of files) {
    await writeFile(join(assets, name), bytes, { flag: 'wx' });
  }
  await writeFile(join(assets, descriptorFile), descriptorBytes, {
    flag: 'wx',
  });
}

function flutter(args, work) {
  // `flutter` is a batch file on Windows, which only a shell can start. Every
  // argument is a fixed literal without spaces or shell metacharacters.
  const result = spawnSync('flutter', args, {
    cwd: work,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function main() {
  const parsed = parseBuildArguments(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${buildUsage}\n`);
    report({ ok: false, failure: 'usage', detail: parsed.reason });
    process.exit(2);
  }
  let batch;
  let fixtures;
  let work;
  let out;
  let root;
  try {
    // Physical paths: a link or junction into the repository is refused too.
    batch = await physicalPath(parsed.batch);
    fixtures = await physicalPath(parsed.fixtures);
    work = await physicalPath(parsed.work);
    out = await physicalPath(parsed.out);
    root = await physicalPath(repositoryRoot);
  } catch {
    refuse('path-unresolvable');
  }
  const refusal = directoriesRefusal(
    { batch, fixtures, work, output: out },
    root,
  );
  if (refusal !== null) refuse(refusal);
  const tooLong = workPathRefusal(work, process.platform);
  if (tooLong !== null) refuse(tooLong);
  if (!(await absent(work))) refuse('work-exists');
  if (!(await absent(out))) refuse('output-exists');

  const { descriptor, descriptorBytes, files } = await readFixtures(fixtures);
  await requireReconversion(parsed, batch, fixtures);
  const commit = await exportTree(parsed.commit, work);
  await inject(work, descriptorBytes, files);

  const prepared = {
    commit,
    work,
    origin: descriptor.origin,
    capturedAt: descriptor.capturedAt,
    manifestSha256: descriptor.batch.manifestSha256,
    descriptorSha256: sha256(descriptorBytes),
    fixtures: files.size,
  };
  if (parsed.prepareOnly) {
    report({ ok: true, prepared, steps: frozenBuildSteps });
    return;
  }

  for (const step of frozenBuildSteps) {
    if (!flutter(step, work)) refuse('flutter-step-failed', step[0]);
  }
  const apk = await readFile(join(work, ...frozenBuildApk));
  const name = frozenApkName(descriptor);
  await mkdir(out, { recursive: true });
  await copyFile(join(work, ...frozenBuildApk), join(out, name));
  const record = {
    kind: 'gridview-frozen-apk-build',
    ...prepared,
    apk: { file: name, byteLength: apk.byteLength, sha256: sha256(apk) },
    flutter: frozenBuildSteps.map((step) => step.join(' ')),
  };
  await writeFile(
    join(out, 'build-record.json'),
    `${JSON.stringify(record, null, 2)}\n`,
    { flag: 'wx' },
  );
  report({ ok: true, ...record });
}

await main();
