import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  isInside,
  parseArguments,
  pathRefusal,
  physicalPath,
  treeState,
} from '../../scripts/season-batch/cli-guards.mjs';
import { captureFiles, fixtureCapture } from './support.ts';

const here = dirname(fileURLToPath(import.meta.url));
const edgeApi = resolve(here, '..', '..');
const repositoryRoot = resolve(edgeApi, '..', '..');
const cli = join(edgeApi, 'scripts', 'season-batch', 'cli.mjs');

const temporary = [];
const links = [];

/**
 * A link to `target` at `path`, removed on its own - never recursively - before
 * its scratch directory, so cleanup can never reach the repository.
 */
function linkTo(target, path) {
  symlinkSync(target, path, 'junction');
  links.push(path);
  return path;
}

function scratch() {
  const directory = mkdtempSync(join(tmpdir(), 'gridview-season-batch-test-'));
  temporary.push(directory);
  return directory;
}

function writeCapture(directory, capture = fixtureCapture()) {
  const { manifest, bodies } = captureFiles(capture);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'capture.json'), JSON.stringify(manifest));
  for (const [file, body] of bodies) writeFileSync(join(directory, file), body);
}

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: edgeApi,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const line = result.stdout.trim().split('\n').at(-1) ?? '';
  return { status: result.status, report: line ? JSON.parse(line) : null };
}

afterEach(() => {
  for (const link of links.splice(0)) {
    try {
      unlinkSync(link);
    } catch {
      rmdirSync(link);
    }
  }
  expect(readFileSync(join(edgeApi, 'package.json'), 'utf8')).toContain(
    'gridview-edge-api',
  );
  for (const directory of temporary.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('season-batch CLI: arguments', () => {
  it('accepts the documented arguments', () => {
    expect(parseArguments(['--capture', 'a', '--out', 'b'])).toEqual({
      ok: true,
      capture: 'a',
      out: 'b',
      allowDirtyTree: false,
    });
    expect(
      parseArguments(['--out', 'b', '--allow-dirty-tree', '--capture', 'a']),
    ).toMatchObject({ ok: true, allowDirtyTree: true });
  });

  it.each([
    [[], 'missing-argument'],
    [['--capture', 'a'], 'missing-argument'],
    [['--capture', '--out', 'b'], 'missing-value'],
    [['--capture', 'a', '--capture', 'c', '--out', 'b'], 'repeated-argument'],
    [['--capture', 'a', '--out', 'b', '--publish'], 'unknown-argument'],
  ])('refuses %j', (argv, reason) => {
    expect(parseArguments(argv)).toEqual({ ok: false, reason });
  });
});

describe('season-batch CLI: paths', () => {
  const outside = resolve(repositoryRoot, '..', 'elsewhere');

  it('refuses a capture or an output inside the repository', () => {
    expect(
      pathRefusal({
        capture: join(repositoryRoot, 'content'),
        out: outside,
        repositoryRoot,
      }),
    ).toBe('capture-inside-repository');
    expect(
      pathRefusal({
        capture: outside,
        out: join(repositoryRoot, 'build', 'batch'),
        repositoryRoot,
      }),
    ).toBe('output-inside-repository');
  });

  it('refuses overlapping capture and output directories', () => {
    expect(
      pathRefusal({
        capture: outside,
        out: join(outside, 'out'),
        repositoryRoot,
      }),
    ).toBe('capture-and-output-overlap');
  });

  it('accepts separate directories outside the repository', () => {
    expect(
      pathRefusal({
        capture: join(outside, 'capture'),
        out: join(outside, 'out'),
        repositoryRoot,
      }),
    ).toBeNull();
    expect(isInside(repositoryRoot, repositoryRoot)).toBe(true);
    expect(isInside(`${repositoryRoot}-sibling`, repositoryRoot)).toBe(false);
  });
});

describe('season-batch CLI: working tree', () => {
  it('refuses a dirty tree unless explicitly allowed, and records it', () => {
    expect(treeState('', false)).toEqual({ treeClean: true, refusal: null });
    const dirty = ' M package.json\n';
    expect(treeState(dirty, false)).toEqual({
      treeClean: false,
      refusal: 'working-tree-dirty',
    });
    expect(treeState(dirty, true)).toEqual({
      treeClean: false,
      refusal: null,
    });
  });
});

describe('season-batch CLI: physical paths', () => {
  it('resolves a link into the repository, so the guard refuses it', async () => {
    const root = scratch();
    const link = join(root, 'link');
    // A junction on Windows, a directory symlink elsewhere.
    linkTo(edgeApi, link);
    const out = await physicalPath(join(link, 'not-yet', 'out'));
    const realRoot = await physicalPath(repositoryRoot);
    expect(isInside(out, realRoot)).toBe(true);
    expect(
      pathRefusal({
        capture: await physicalPath(join(root, 'capture')),
        out,
        repositoryRoot: realRoot,
      }),
    ).toBe('output-inside-repository');
  });

  it('keeps a path with no link unchanged below its existing ancestor', async () => {
    const root = scratch();
    const real = await physicalPath(root);
    expect(await physicalPath(join(root, 'a', 'b'))).toBe(join(real, 'a', 'b'));
  });
});

describe('season-batch CLI: end to end, offline', () => {
  it('writes an artifact and a manifest whose digests agree', () => {
    const root = scratch();
    const capture = join(root, 'capture');
    const out = join(root, 'out');
    writeCapture(capture);

    const { status, report } = run([
      '--capture',
      capture,
      '--out',
      out,
      '--allow-dirty-tree',
    ]);
    expect(status, JSON.stringify(report)).toBe(0);
    expect(report.summary).toMatchObject({
      season: 2026,
      documentCount: 102,
      classifiedRounds: [1, 2, 3],
    });

    const artifact = readFileSync(join(out, 'artifact.json'));
    const manifest = JSON.parse(
      readFileSync(join(out, 'manifest.json'), 'utf8'),
    );
    const digest = createHash('sha256').update(artifact).digest('hex');
    expect(digest).toBe(report.artifact.sha256);
    expect(manifest.artifact.sha256).toBe(digest);
    expect(manifest.generator.gitCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(manifest.use).toBe('review-only');
    expect(report.capture.sha256).toBe(manifest.capture.digest);
  }, 60_000);

  it('refuses an output inside the repository before loading anything', () => {
    const root = scratch();
    writeCapture(join(root, 'capture'));
    const { status, report } = run([
      '--capture',
      join(root, 'capture'),
      '--out',
      join(edgeApi, '.season-batch-out'),
      '--allow-dirty-tree',
    ]);
    expect(status).toBe(1);
    expect(report).toEqual({
      ok: false,
      failure: 'output-inside-repository',
      detail: null,
    });
  });

  it('refuses an output reached through a link into the repository', () => {
    const root = scratch();
    writeCapture(join(root, 'capture'));
    linkTo(edgeApi, join(root, 'link'));
    const { status, report } = run([
      '--capture',
      join(root, 'capture'),
      '--out',
      join(root, 'link', '.season-batch-out'),
      '--allow-dirty-tree',
    ]);
    expect(status).toBe(1);
    expect(report.failure).toBe('output-inside-repository');
  });

  it('refuses a capture inside the repository', () => {
    const root = scratch();
    const { status, report } = run([
      '--capture',
      join(edgeApi, 'test', 'fixtures'),
      '--out',
      join(root, 'out'),
      '--allow-dirty-tree',
    ]);
    expect(status).toBe(1);
    expect(report.failure).toBe('capture-inside-repository');
  });

  it('refuses a non-empty output directory', () => {
    const root = scratch();
    writeCapture(join(root, 'capture'));
    mkdirSync(join(root, 'out'));
    writeFileSync(join(root, 'out', 'artifact.json'), '{}');
    const { status, report } = run([
      '--capture',
      join(root, 'capture'),
      '--out',
      join(root, 'out'),
      '--allow-dirty-tree',
    ]);
    expect(status).toBe(1);
    expect(report.failure).toBe('output-not-empty');
  });

  it('refuses a capture directory holding a file the manifest does not name', () => {
    const root = scratch();
    writeCapture(join(root, 'capture'));
    writeFileSync(join(root, 'capture', 'stray.json'), '{}');
    const { status, report } = run([
      '--capture',
      join(root, 'capture'),
      '--out',
      join(root, 'out'),
      '--allow-dirty-tree',
    ]);
    expect(status).toBe(1);
    expect(report.failure).toBe('capture-body-unexpected');
  }, 60_000);

  it('refuses an inconsistent capture and writes nothing', () => {
    const root = scratch();
    writeCapture(join(root, 'capture'), fixtureCapture([1, 2]));
    const { status, report } = run([
      '--capture',
      join(root, 'capture'),
      '--out',
      join(root, 'out'),
      '--allow-dirty-tree',
    ]);
    expect(status).toBe(1);
    expect(report.failure).toBe('classification-rounds-mismatch');
    expect(() => readFileSync(join(root, 'out', 'artifact.json'))).toThrow();
  }, 60_000);
});

describe('season-batch CLI: bounded reads', () => {
  function refused(root) {
    return run([
      '--capture',
      join(root, 'capture'),
      '--out',
      join(root, 'out'),
      '--allow-dirty-tree',
    ]);
  }

  it.each([
    ['one byte', 1],
    ['3 MiB, beyond the client response limit', 3 * 1024 * 1024],
  ])(
    'refuses a body file longer than its declared size by %s, writing nothing',
    (_label, extra) => {
      const root = scratch();
      const capture = join(root, 'capture');
      writeCapture(capture);
      // The manifest still declares the recorded size; the file is replaced.
      appendFileSync(join(capture, 'drivers.json'), Buffer.alloc(extra, 0x20));
      const { status, report } = refused(root);
      expect(status).toBe(1);
      expect(report).toEqual({
        ok: false,
        failure: 'capture-body-oversized',
        detail: null,
      });
      expect(existsSync(join(root, 'out'))).toBe(false);
    },
    60_000,
  );

  it('refuses a capture.json over 1 MiB before parsing it, writing nothing', () => {
    const root = scratch();
    const capture = join(root, 'capture');
    writeCapture(capture);
    // Still valid JSON: only the bound can refuse it.
    appendFileSync(
      join(capture, 'capture.json'),
      Buffer.alloc(1024 * 1024, 0x20),
    );
    const { status, report } = refused(root);
    expect(status).toBe(1);
    expect(report).toEqual({
      ok: false,
      failure: 'capture-manifest-oversized',
      detail: null,
    });
    expect(existsSync(join(root, 'out'))).toBe(false);
  }, 60_000);

  it('refuses a body path that is not a regular file', () => {
    const root = scratch();
    const capture = join(root, 'capture');
    writeCapture(capture);
    rmSync(join(capture, 'drivers.json'));
    mkdirSync(join(capture, 'drivers.json'));
    const { status, report } = refused(root);
    expect(status).toBe(1);
    expect(report.failure).toBe('capture-body-missing');
    expect(existsSync(join(root, 'out'))).toBe(false);
  }, 60_000);
});
