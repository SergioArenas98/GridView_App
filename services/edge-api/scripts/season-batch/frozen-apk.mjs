// GridView frozen-data test APK build: local, test-only.
//
//   npm run season-batch:frozen-apk -- --fixtures <dir> --work <dir> \
//     --out <dir> [--commit <rev>] [--prepare-only]
//
// 1. Verifies the converted fixture directory against its own descriptor
//    (`frozen-dataset.json`): exactly the listed files, each with its size and
//    SHA-256.
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
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readBounded } from './bounded-read.mjs';
import { physicalPath } from './cli-guards.mjs';
import {
  buildUsage,
  descriptorFile,
  directoriesRefusal,
  frozenApkName,
  frozenBuildApk,
  frozenBuildSteps,
  parseBuildArguments,
  verifyFixtureSet,
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
  let fixtures;
  let work;
  let out;
  let root;
  try {
    // Physical paths: a link or junction into the repository is refused too.
    fixtures = await physicalPath(parsed.fixtures);
    work = await physicalPath(parsed.work);
    out = await physicalPath(parsed.out);
    root = await physicalPath(repositoryRoot);
  } catch {
    refuse('path-unresolvable');
  }
  const refusal = directoriesRefusal({ fixtures, work, output: out }, root);
  if (refusal !== null) refuse(refusal);
  if (!(await absent(work))) refuse('work-exists');
  if (!(await absent(out))) refuse('output-exists');

  const { descriptor, descriptorBytes, files } = await readFixtures(fixtures);
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
