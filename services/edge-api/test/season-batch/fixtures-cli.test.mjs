import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  decodeDescriptor,
  directoriesRefusal,
  exportLauncherRefusal,
  frozenApkName,
  frozenBuildSteps,
  parseBuildArguments,
  parseConvertArguments,
  sameFixtureSet,
  verifyFixtureSet,
  workPathRefusal,
} from '../../scripts/season-batch/fixtures-guards.mjs';
import { isInside } from '../../scripts/season-batch/cli-guards.mjs';
import { generateSeasonBatch } from '../../scripts/season-batch/generate.ts';
import { inputFor } from './support.ts';

const here = dirname(fileURLToPath(import.meta.url));
const edgeApi = resolve(here, '..', '..');
const repositoryRoot = resolve(edgeApi, '..', '..');
const converter = join(edgeApi, 'scripts', 'season-batch', 'fixtures-cli.mjs');
const builder = join(edgeApi, 'scripts', 'season-batch', 'frozen-apk.mjs');

const temporary = [];
let batch;

beforeAll(async () => {
  // Generated in process with fixed, clean provenance, so the result does not
  // depend on this checkout's working-tree state.
  const result = await generateSeasonBatch(inputFor());
  if (!result.ok) throw new Error(`fixture batch refused: ${result.failure}`);
  batch = { artifact: result.artifact.text, manifest: result.manifest.text };
});

afterEach(() => {
  for (const directory of temporary.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function scratch() {
  const directory = mkdtempSync(join(tmpdir(), 'gridview-frozen-test-'));
  temporary.push(directory);
  return directory;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function writeBatch(directory, files = batch) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'artifact.json'), files.artifact);
  writeFileSync(join(directory, 'manifest.json'), files.manifest);
  return directory;
}

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: edgeApi,
    encoding: 'utf8',
    timeout: 120_000,
  });
  const line = result.stdout.trim().split('\n').at(-1) ?? '';
  return { status: result.status, report: line ? JSON.parse(line) : null };
}

function convert(batchDirectory, out, overrides = {}) {
  return run(converter, [
    '--batch',
    batchDirectory,
    '--out',
    out,
    '--manifest-sha256',
    overrides.sha ?? sha256(batch.manifest),
    '--origin',
    overrides.origin ?? 'provider-capture',
  ]);
}

function readDirectory(directory) {
  return new Map(
    readdirSync(directory).map((name) => [
      name,
      new Uint8Array(readFileSync(join(directory, name))),
    ]),
  );
}

function splitDescriptor(files) {
  const rest = new Map(files);
  const descriptor = rest.get('frozen-dataset.json');
  rest.delete('frozen-dataset.json');
  return { descriptor, rest };
}

describe('frozen fixtures CLI: arguments', () => {
  const sha = 'a'.repeat(64);

  it('accepts the documented arguments', () => {
    expect(
      parseConvertArguments([
        '--batch',
        'b',
        '--out',
        'o',
        '--manifest-sha256',
        sha,
        '--origin',
        'synthetic',
      ]),
    ).toEqual({
      ok: true,
      batch: 'b',
      out: 'o',
      manifestSha256: sha,
      origin: 'synthetic',
    });
  });

  it.each([
    [
      ['--batch', 'b', '--out', 'o', '--origin', 'synthetic'],
      'missing-argument',
    ],
    [
      [
        '--batch',
        'b',
        '--out',
        'o',
        '--manifest-sha256',
        'ABC',
        '--origin',
        'synthetic',
      ],
      'manifest-sha256-invalid',
    ],
    [
      [
        '--batch',
        'b',
        '--out',
        'o',
        '--manifest-sha256',
        sha,
        '--origin',
        'real',
      ],
      'origin-invalid',
    ],
    [
      [
        '--batch',
        'b',
        '--batch',
        'c',
        '--out',
        'o',
        '--manifest-sha256',
        sha,
        '--origin',
        'synthetic',
      ],
      'repeated-argument',
    ],
    [['--publish'], 'unknown-argument'],
  ])('refuses %j', (argv, reason) => {
    expect(parseConvertArguments(argv)).toEqual({ ok: false, reason });
  });

  const buildBase = [
    '--batch',
    'b',
    '--manifest-sha256',
    sha,
    '--origin',
    'synthetic',
    '--fixtures',
    'f',
    '--work',
    'w',
    '--out',
    'o',
  ];

  it('accepts the build arguments, defaulting to HEAD', () => {
    expect(parseBuildArguments(buildBase)).toEqual({
      ok: true,
      batch: 'b',
      manifestSha256: sha,
      origin: 'synthetic',
      fixtures: 'f',
      work: 'w',
      out: 'o',
      commit: 'HEAD',
      prepareOnly: false,
    });
    expect(
      parseBuildArguments([
        '--prepare-only',
        ...buildBase,
        '--commit',
        'master',
      ]),
    ).toMatchObject({ ok: true, commit: 'master', prepareOnly: true });
  });

  it.each([
    [['--fixtures', 'f', '--work', 'w', '--out', 'o'], 'missing-argument'],
    [[...buildBase, '--commit', '--out'], 'missing-value'],
    [[...buildBase, '--commit', '-c'], 'commit-invalid'],
    [[...buildBase, '--commit', 'a b'], 'commit-invalid'],
    [[...buildBase, '--flavor', 'production'], 'unknown-argument'],
    [
      buildBase.map((value) => (value === sha ? 'ABC' : value)),
      'manifest-sha256-invalid',
    ],
    [
      buildBase.map((value) => (value === 'synthetic' ? 'real' : value)),
      'origin-invalid',
    ],
  ])('refuses build arguments %j', (argv, reason) => {
    expect(parseBuildArguments(argv)).toEqual({ ok: false, reason });
  });
});

describe('frozen fixtures: directories', () => {
  const outside = resolve(repositoryRoot, '..', 'elsewhere');

  it('refuses any directory inside the repository, or overlapping', () => {
    expect(
      directoriesRefusal(
        { batch: outside, output: join(repositoryRoot, 'assets') },
        repositoryRoot,
      ),
    ).toBe('output-inside-repository');
    expect(
      directoriesRefusal(
        { fixtures: join(outside, 'f'), work: join(outside, 'f', 'w') },
        repositoryRoot,
      ),
    ).toBe('fixtures-and-work-overlap');
    expect(
      directoriesRefusal(
        { fixtures: join(outside, 'f'), work: join(outside, 'w') },
        repositoryRoot,
      ),
    ).toBeNull();
  });
});

describe('frozen build: separation from the normal build', () => {
  it('builds only a staging debug APK in fixture mode', () => {
    const build = frozenBuildSteps.find((step) => step[0] === 'build');
    expect(build).toEqual([
      'build',
      'apk',
      '--debug',
      '--flavor',
      'staging',
      '--dart-define=APP_ENV=staging',
      '--dart-define=DATA_SOURCE=fixture',
    ]);
    const all = frozenBuildSteps.flat().join(' ');
    expect(all).not.toMatch(/production|--release|appbundle|API_BASE_URL/);
  });

  it('refuses an export root too deep for the Windows path limit', () => {
    const deep = `C:\\${'a'.repeat(90)}`;
    expect(workPathRefusal(deep, 'win32')).toBe('work-path-too-long');
    expect(workPathRefusal(deep, 'linux')).toBeNull();
    expect(
      workPathRefusal('C:\\Users\\me\\.gridview\\frozen\\work', 'win32'),
    ).toBeNull();
  });

  it('names the APK by origin, capture date and reviewed manifest', () => {
    const batchInfo = { manifestSha256: 'ab'.repeat(32) };
    expect(
      frozenApkName({
        origin: 'provider-capture',
        capturedAt: '2026-10-08T12:00:00.000Z',
        batch: batchInfo,
      }),
    ).toBe('gridview-staging-frozen-2026-10-08-abababababab.apk');
    expect(
      frozenApkName({
        origin: 'synthetic',
        capturedAt: '2026-03-16T12:00:00.000Z',
        batch: batchInfo,
      }),
    ).toBe('gridview-staging-synthetic-2026-03-16-abababababab.apk');
  });
});

describe('frozen fixtures CLI: end to end, offline', () => {
  it('converts a batch into contract-valid fixtures and a matching descriptor', () => {
    const root = scratch();
    const out = join(root, 'fixtures');
    const result = convert(writeBatch(join(root, 'batch')), out);
    expect(result.status).toBe(0);
    expect(result.report).toMatchObject({
      ok: true,
      summary: { origin: 'provider-capture', sources: ['jolpica'] },
    });
    const { descriptor, rest } = splitDescriptor(readDirectory(out));
    const verified = verifyFixtureSet(descriptor, rest);
    expect(verified.ok).toBe(true);
    expect(verified.descriptor.batch.manifestSha256).toBe(
      sha256(batch.manifest),
    );
    expect(result.report.descriptor.sha256).toBe(sha256(descriptor));
    // No partial directory is left beside the output.
    expect(readdirSync(root).sort()).toEqual(['batch', 'fixtures']);
  });

  it('refuses a manifest other than the reviewed one and writes nothing', () => {
    const root = scratch();
    const out = join(root, 'fixtures');
    const result = convert(writeBatch(join(root, 'batch')), out, {
      sha: '0'.repeat(64),
    });
    expect(result).toEqual({
      status: 1,
      report: { ok: false, failure: 'manifest-digest-mismatch', detail: null },
    });
    expect(existsSync(out)).toBe(false);
    expect(readdirSync(root)).toEqual(['batch']);
  });

  it('refuses a tampered artifact and writes nothing', () => {
    const root = scratch();
    const out = join(root, 'fixtures');
    const tampered = {
      ...batch,
      artifact: batch.artifact.replace('"season": 2026', '"season": 2027'),
    };
    const result = convert(writeBatch(join(root, 'batch'), tampered), out);
    expect(result.report).toMatchObject({
      ok: false,
      failure: 'artifact-digest-mismatch',
    });
    expect(existsSync(out)).toBe(false);
  });

  it('refuses an artifact longer than the manifest declares, unread', () => {
    const root = scratch();
    const result = convert(
      writeBatch(join(root, 'batch'), {
        ...batch,
        artifact: `${batch.artifact}${' '.repeat(4096)}`,
      }),
      join(root, 'fixtures'),
    );
    expect(result.report).toMatchObject({
      ok: false,
      failure: 'batch-file-oversized',
    });
  });

  it('refuses an extra or a missing batch file', () => {
    const root = scratch();
    const extra = writeBatch(join(root, 'extra'));
    writeFileSync(join(extra, 'capture.json'), '{}');
    expect(convert(extra, join(root, 'out-1')).report).toMatchObject({
      failure: 'batch-file-unexpected',
    });
    const missing = writeBatch(join(root, 'missing'));
    rmSync(join(missing, 'artifact.json'));
    expect(convert(missing, join(root, 'out-2')).report).toMatchObject({
      failure: 'batch-file-missing',
    });
  });

  it('refuses an output inside the repository or one that exists', () => {
    const root = scratch();
    const source = writeBatch(join(root, 'batch'));
    expect(
      convert(source, join(repositoryRoot, 'assets', 'dev_fixtures')).report,
    ).toMatchObject({ failure: 'output-inside-repository' });
    const existing = join(root, 'existing');
    mkdirSync(existing);
    expect(convert(source, existing).report).toMatchObject({
      failure: 'output-exists',
    });
  });

  it('refuses a batch inside the repository', () => {
    const root = scratch();
    expect(
      convert(join(edgeApi, 'test'), join(root, 'out')).report,
    ).toMatchObject({ failure: 'batch-inside-repository' });
  });
});

describe('frozen fixtures: descriptor verification', () => {
  function converted() {
    const root = scratch();
    const out = join(root, 'fixtures');
    expect(convert(writeBatch(join(root, 'batch')), out).status).toBe(0);
    return splitDescriptor(readDirectory(out));
  }

  it('refuses an edited, missing or extra fixture', () => {
    const { descriptor, rest } = converted();
    const edited = new Map(rest);
    edited.set('home.json', new TextEncoder().encode('{"data":{},"meta":{}}'));
    expect(verifyFixtureSet(descriptor, edited)).toEqual({
      ok: false,
      reason: 'fixture-digest-mismatch',
    });
    const missing = new Map(rest);
    missing.delete('home.json');
    expect(verifyFixtureSet(descriptor, missing)).toEqual({
      ok: false,
      reason: 'fixture-missing',
    });
    const extra = new Map(rest);
    extra.set('status.json', new Uint8Array());
    expect(verifyFixtureSet(descriptor, extra)).toEqual({
      ok: false,
      reason: 'fixture-unexpected',
    });
  });

  it('refuses a descriptor whose origin and sources disagree', () => {
    const { descriptor } = converted();
    const value = JSON.parse(new TextDecoder().decode(descriptor));
    expect(decodeDescriptor(value)).not.toBeNull();
    expect(decodeDescriptor({ ...value, origin: 'synthetic' })).toBeNull();
    expect(decodeDescriptor({ ...value, sources: [] })).toBeNull();
    expect(decodeDescriptor({ ...value, extra: true })).toBeNull();
    expect(
      decodeDescriptor({
        ...value,
        files: [
          ...value.files,
          { name: '../x.json', byteLength: 0, sha256: '0'.repeat(64) },
        ],
      }),
    ).toBeNull();
  });
});

describe('frozen build: prepare-only export', () => {
  /** A reviewed batch and its conversion, under `root`. */
  function converted(root, origin = 'synthetic') {
    const batchDirectory = writeBatch(join(root, 'batch'));
    const fixtures = join(root, 'fixtures');
    expect(convert(batchDirectory, fixtures, { origin }).status).toBe(0);
    return { batchDirectory, fixtures };
  }

  function build(root, paths, overrides = {}) {
    return run(builder, [
      '--batch',
      paths.batchDirectory,
      '--manifest-sha256',
      overrides.sha ?? sha256(batch.manifest),
      '--origin',
      overrides.origin ?? 'synthetic',
      '--fixtures',
      paths.fixtures,
      '--work',
      overrides.work ?? join(root, 'work'),
      '--out',
      join(root, 'apk'),
      '--prepare-only',
    ]);
  }

  it('exports the committed tree and injects exactly the fixtures', () => {
    const root = scratch();
    const paths = converted(root);
    const work = join(root, 'work');
    const before = readDirectory(
      join(repositoryRoot, 'assets', 'dev_fixtures'),
    );
    const result = build(root, paths);
    expect(result.status).toBe(0);
    expect(result.report).toMatchObject({
      ok: true,
      prepared: { origin: 'synthetic' },
    });
    expect(result.report.prepared.commit).toMatch(/^[0-9a-f]{40}$/);
    const injected = readDirectory(join(work, 'assets', 'dev_fixtures'));
    expect(injected).toEqual(readDirectory(paths.fixtures));
    expect(existsSync(join(work, 'pubspec.yaml'))).toBe(true);
    expect(existsSync(join(root, 'apk'))).toBe(false);
    // The repository's own sample fixtures are untouched.
    expect(
      readDirectory(join(repositoryRoot, 'assets', 'dev_fixtures')),
    ).toEqual(before);
  });

  it('refuses a fixture directory that its descriptor does not describe', () => {
    const root = scratch();
    const paths = converted(root);
    writeFileSync(join(paths.fixtures, 'home.json'), '{}');
    expect(build(root, paths).report).toMatchObject({
      ok: false,
      failure: 'fixture-digest-mismatch',
    });
    expect(existsSync(join(root, 'work'))).toBe(false);
  });

  it('refuses an edited fixture even when its descriptor was edited to match', () => {
    const root = scratch();
    const paths = converted(root);
    const edited = new TextEncoder().encode('{"data":{},"meta":{}}\n');
    writeFileSync(join(paths.fixtures, 'home.json'), edited);
    const path = join(paths.fixtures, 'frozen-dataset.json');
    const descriptor = JSON.parse(readFileSync(path, 'utf8'));
    const entry = descriptor.files.find((file) => file.name === 'home.json');
    entry.byteLength = edited.byteLength;
    entry.sha256 = sha256(edited);
    writeFileSync(path, JSON.stringify(descriptor));
    expect(build(root, paths).report).toMatchObject({
      ok: false,
      failure: 'fixtures-not-reproduced',
    });
    expect(existsSync(join(root, 'work'))).toBe(false);
  });

  it('refuses a synthetic conversion relabelled as a provider capture', () => {
    const root = scratch();
    const paths = converted(root, 'synthetic');
    const path = join(paths.fixtures, 'frozen-dataset.json');
    const descriptor = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(
      path,
      JSON.stringify({
        ...descriptor,
        origin: 'provider-capture',
        sources: ['jolpica'],
      }),
    );
    expect(
      build(root, paths, { origin: 'provider-capture' }).report,
    ).toMatchObject({ ok: false, failure: 'fixtures-not-reproduced' });
  });

  it('refuses a build declaring another origin than the conversion', () => {
    const root = scratch();
    const paths = converted(root, 'provider-capture');
    expect(build(root, paths, { origin: 'synthetic' }).report).toMatchObject({
      ok: false,
      failure: 'fixtures-not-reproduced',
    });
  });

  it('refuses a batch other than the reviewed one', () => {
    const root = scratch();
    const paths = converted(root);
    expect(build(root, paths, { sha: '0'.repeat(64) }).report).toEqual({
      ok: false,
      failure: 'batch-not-convertible',
      detail: 'manifest-digest-mismatch',
    });
    expect(existsSync(join(root, 'work'))).toBe(false);
  });

  it('refuses a work directory inside the repository', () => {
    const root = scratch();
    const paths = converted(root);
    expect(
      build(root, paths, { work: join(repositoryRoot, 'build', 'frozen-work') })
        .report,
    ).toMatchObject({ failure: 'work-inside-repository' });
  });
});

describe('frozen build: guards', () => {
  it('treats a child named like a parent reference as inside the repository', () => {
    expect(isInside(join(repositoryRoot, '..x'), repositoryRoot)).toBe(true);
    expect(isInside(join(repositoryRoot, '..', 'x'), repositoryRoot)).toBe(
      false,
    );
    expect(
      directoriesRefusal(
        { output: join(repositoryRoot, '..fixtures') },
        repositoryRoot,
      ),
    ).toBe('output-inside-repository');
  });

  it('refuses an export that carries its own flutter launcher', () => {
    for (const name of [
      'flutter',
      'flutter.bat',
      'FLUTTER.CMD',
      'flutter.exe',
    ]) {
      expect(exportLauncherRefusal(['pubspec.yaml', name])).toBe(
        'export-launcher-present',
      );
    }
    expect(exportLauncherRefusal(['pubspec.yaml', 'flutter_test'])).toBeNull();
  });

  it('compares fixture sets byte for byte', () => {
    const a = new Map([['x.json', new Uint8Array([1, 2])]]);
    expect(
      sameFixtureSet(a, new Map([['x.json', new Uint8Array([1, 2])]])),
    ).toBe(true);
    expect(
      sameFixtureSet(a, new Map([['x.json', new Uint8Array([1, 3])]])),
    ).toBe(false);
    expect(
      sameFixtureSet(a, new Map([['y.json', new Uint8Array([1, 2])]])),
    ).toBe(false);
    expect(sameFixtureSet(a, new Map())).toBe(false);
  });
});
