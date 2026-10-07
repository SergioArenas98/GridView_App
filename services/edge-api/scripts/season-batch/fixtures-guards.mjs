// Pure argument, path and contract rules for the frozen-fixture converter and
// the frozen-APK build procedure. Kept apart from the CLIs so they are tested
// without spawning a process.

import { createHash } from 'node:crypto';

import { isInside } from './cli-guards.mjs';

export const descriptorFile = 'frozen-dataset.json';

const fixtureNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const convertUsage =
  'Usage: npm run season-batch:fixtures -- --batch <dir> --out <dir> --manifest-sha256 <hex> --origin <provider-capture|synthetic>';

export const buildUsage =
  'Usage: npm run season-batch:frozen-apk -- --fixtures <dir> --work <dir> --out <dir> [--commit <rev>] [--prepare-only]';

/**
 * Parses `--name value` pairs and bare flags. Every option is single-use;
 * anything unknown is refused.
 *
 * @param {readonly string[]} argv
 * @param {readonly string[]} valued
 * @param {readonly string[]} flags
 * @returns {{ ok: true, values: Record<string, string>, flags: Record<string, boolean> } | { ok: false, reason: string }}
 */
function parse(argv, valued, flags) {
  const values = {};
  const set = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (flags.includes(argument)) {
      if (set[argument]) return { ok: false, reason: 'repeated-argument' };
      set[argument] = true;
      continue;
    }
    if (!valued.includes(argument)) {
      return { ok: false, reason: 'unknown-argument' };
    }
    const value = argv[index + 1];
    if (value === undefined || value.length === 0 || value.startsWith('--')) {
      return { ok: false, reason: 'missing-value' };
    }
    if (argument in values) return { ok: false, reason: 'repeated-argument' };
    values[argument] = value;
    index += 1;
  }
  return { ok: true, values, flags: set };
}

/**
 * @param {readonly string[]} argv
 * @returns {{ ok: true, batch: string, out: string, manifestSha256: string, origin: string } | { ok: false, reason: string }}
 */
export function parseConvertArguments(argv) {
  const parsed = parse(
    argv,
    ['--batch', '--out', '--manifest-sha256', '--origin'],
    [],
  );
  if (!parsed.ok) return parsed;
  const { values } = parsed;
  for (const name of ['--batch', '--out', '--manifest-sha256', '--origin']) {
    if (!(name in values)) return { ok: false, reason: 'missing-argument' };
  }
  if (!/^[0-9a-f]{64}$/.test(values['--manifest-sha256'])) {
    return { ok: false, reason: 'manifest-sha256-invalid' };
  }
  if (!['provider-capture', 'synthetic'].includes(values['--origin'])) {
    return { ok: false, reason: 'origin-invalid' };
  }
  return {
    ok: true,
    batch: values['--batch'],
    out: values['--out'],
    manifestSha256: values['--manifest-sha256'],
    origin: values['--origin'],
  };
}

/**
 * @param {readonly string[]} argv
 * @returns {{ ok: true, fixtures: string, work: string, out: string, commit: string, prepareOnly: boolean } | { ok: false, reason: string }}
 */
export function parseBuildArguments(argv) {
  const parsed = parse(
    argv,
    ['--fixtures', '--work', '--out', '--commit'],
    ['--prepare-only'],
  );
  if (!parsed.ok) return parsed;
  const { values, flags } = parsed;
  for (const name of ['--fixtures', '--work', '--out']) {
    if (!(name in values)) return { ok: false, reason: 'missing-argument' };
  }
  const commit = values['--commit'] ?? 'HEAD';
  // A revision name only: never an option or a path git could reinterpret.
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(commit)) {
    return { ok: false, reason: 'commit-invalid' };
  }
  return {
    ok: true,
    fixtures: values['--fixtures'],
    work: values['--work'],
    out: values['--out'],
    commit,
    prepareOnly: flags['--prepare-only'] === true,
  };
}

/**
 * Every directory must be outside the repository, so neither a private batch,
 * converted fixtures, an export nor an APK can be staged by accident, and no
 * two may overlap.
 *
 * @param {Record<string, string>} directories by role, physical paths
 * @param {string} repositoryRoot physical path
 * @returns {string | null} a closed refusal reason, or `null`
 */
export function directoriesRefusal(directories, repositoryRoot) {
  const entries = Object.entries(directories);
  for (const [role, path] of entries) {
    if (isInside(path, repositoryRoot)) return `${role}-inside-repository`;
  }
  for (const [index, [role, path]] of entries.entries()) {
    for (const [other, otherPath] of entries.slice(index + 1)) {
      if (isInside(path, otherPath) || isInside(otherPath, path)) {
        return `${role}-and-${other}-overlap`;
      }
    }
  }
  return null;
}

/**
 * Validates converted envelopes against the OpenAPI contract with the same
 * Ajv rules as `validate:fixtures`.
 *
 * @param {readonly { name: string, text: string, contract: { data: string, dataKind: string, meta: string } | null }[]} files
 * @param {{ ajv: unknown, ref: (name: string) => string, compileSchema: Function, compileArraySchema: Function }} openapi
 * @returns {string | null} the first non-conforming file name, or `null`
 */
export function contractRefusal(files, openapi) {
  const { ajv, ref, compileSchema, compileArraySchema } = openapi;
  const cache = new Map();
  const validator = (key, build) => {
    if (!cache.has(key)) cache.set(key, build());
    return cache.get(key);
  };
  for (const file of files) {
    if (file.contract === null) continue;
    const { data, dataKind, meta } = file.contract;
    const body = JSON.parse(file.text);
    const validData = validator(`${dataKind}:${data}`, () =>
      dataKind === 'array'
        ? compileArraySchema(ajv, ref, data)
        : compileSchema(ajv, ref, data),
    );
    const validMeta = validator(`meta:${meta}`, () =>
      compileSchema(ajv, ref, meta),
    );
    if (!validData(body.data) || !validMeta(body.meta)) return file.name;
  }
  return null;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const present = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    present.length === expected.length &&
    present.every((key, index) => key === expected[index])
  );
}

/**
 * Decodes a converter descriptor exactly, or returns `null`. The origin and
 * the credited sources must agree: a provider capture credits Jolpica, a
 * synthetic batch credits nothing.
 *
 * @param {unknown} value
 */
export function decodeDescriptor(value) {
  if (
    !hasExactKeys(value, [
      'kind',
      'schemaVersion',
      'origin',
      'season',
      'capturedAt',
      'sources',
      'batch',
      'files',
    ]) ||
    value.kind !== 'gridview-frozen-dataset' ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.season) ||
    typeof value.capturedAt !== 'string' ||
    !instantPattern.test(value.capturedAt) ||
    !Array.isArray(value.sources) ||
    !hasExactKeys(value.batch, [
      'manifestSha256',
      'artifactSha256',
      'captureDigest',
      'generatorCommit',
      'version',
      'documentCount',
    ]) ||
    !sha256Pattern.test(String(value.batch.manifestSha256)) ||
    !Array.isArray(value.files) ||
    value.files.length === 0
  ) {
    return null;
  }
  const sources = JSON.stringify(value.sources);
  if (!(
    (value.origin === 'provider-capture' && sources === '["jolpica"]') ||
    (value.origin === 'synthetic' && sources === '[]')
  )) {
    return null;
  }
  let previous = '';
  for (const file of value.files) {
    if (
      !hasExactKeys(file, ['name', 'byteLength', 'sha256']) ||
      typeof file.name !== 'string' ||
      !fixtureNamePattern.test(file.name) ||
      file.name === descriptorFile ||
      file.name <= previous ||
      !Number.isSafeInteger(file.byteLength) ||
      file.byteLength < 0 ||
      typeof file.sha256 !== 'string' ||
      !sha256Pattern.test(file.sha256)
    ) {
      return null;
    }
    previous = file.name;
  }
  return value;
}

/**
 * Whether a converted fixture directory is exactly what its descriptor
 * lists: the descriptor plus every named file, each with its recorded size
 * and SHA-256, and nothing else.
 *
 * @param {Uint8Array} descriptorBytes
 * @param {ReadonlyMap<string, Uint8Array>} files every other file, by name
 * @returns {{ ok: true, descriptor: Record<string, any> } | { ok: false, reason: string }}
 */
export function verifyFixtureSet(descriptorBytes, files) {
  let value;
  try {
    value = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(descriptorBytes),
    );
  } catch {
    return { ok: false, reason: 'descriptor-malformed' };
  }
  const descriptor = decodeDescriptor(value);
  if (descriptor === null) return { ok: false, reason: 'descriptor-malformed' };
  const listed = new Set(descriptor.files.map((file) => file.name));
  for (const name of files.keys()) {
    if (!listed.has(name)) return { ok: false, reason: 'fixture-unexpected' };
  }
  for (const file of descriptor.files) {
    const bytes = files.get(file.name);
    if (bytes === undefined) return { ok: false, reason: 'fixture-missing' };
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (bytes.byteLength !== file.byteLength || digest !== file.sha256) {
      return { ok: false, reason: 'fixture-digest-mismatch' };
    }
  }
  return { ok: true, descriptor };
}

/**
 * The flutter invocations of the frozen build, in order. Staging flavor and a
 * debug build only: the production flavor and the normal build are never
 * touched, and a debug build needs no release signing material.
 */
export const frozenBuildSteps = [
  ['pub', 'get'],
  ['test', 'test/frozen_data/bundled_fixtures_test.dart'],
  [
    'build',
    'apk',
    '--debug',
    '--flavor',
    'staging',
    '--dart-define=APP_ENV=staging',
    '--dart-define=DATA_SOURCE=fixture',
  ],
];

/** Where `flutter build apk --debug --flavor staging` writes its APK. */
export const frozenBuildApk = [
  'build',
  'app',
  'outputs',
  'flutter-apk',
  'app-staging-debug.apk',
];

/**
 * The file name the APK is copied to: its origin, capture date and the first
 * twelve hex digits of the reviewed manifest.
 *
 * @param {{ origin: string, capturedAt: string, batch: { manifestSha256: string } }} descriptor
 */
export function frozenApkName(descriptor) {
  const kind = descriptor.origin === 'synthetic' ? 'synthetic' : 'frozen';
  const date = descriptor.capturedAt.slice(0, 10);
  const manifest = descriptor.batch.manifestSha256.slice(0, 12);
  return `gridview-staging-${kind}-${date}-${manifest}.apk`;
}

/**
 * The longest export path the Windows build accepts. Flutter writes shader
 * and asset intermediates about 120 characters below the export root, so a
 * deeper root breaks the 260-character Windows path limit part-way through
 * Gradle. The repository's own checkout path is shorter than this.
 */
export const maximumWindowsWorkPath = 80;

/**
 * @param {string} work physical path
 * @param {string} platform `process.platform`
 * @returns {string | null}
 */
export function workPathRefusal(work, platform) {
  return platform === 'win32' && work.length > maximumWindowsWorkPath
    ? 'work-path-too-long'
    : null;
}
