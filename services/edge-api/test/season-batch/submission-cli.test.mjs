import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  parseSubmissionArguments,
  submissionPathRefusal,
} from '../../scripts/season-batch/submission-guards.mjs';
import { generateSeasonBatch } from '../../scripts/season-batch/generate.ts';
import { inputFor } from './support.ts';

const here = dirname(fileURLToPath(import.meta.url));
const edgeApi = resolve(here, '..', '..');
const repositoryRoot = resolve(edgeApi, '..', '..');
const cli = join(edgeApi, 'scripts', 'season-batch', 'submission-cli.mjs');
const SHA = 'b'.repeat(64);

const temporary = [];

function scratch() {
  const directory = mkdtempSync(join(tmpdir(), 'gridview-submission-test-'));
  temporary.push(directory);
  return directory;
}

afterEach(() => {
  while (temporary.length > 0) {
    rmSync(temporary.pop(), { recursive: true, force: true });
  }
});

let batch;

beforeAll(async () => {
  const result = await generateSeasonBatch(inputFor());
  if (!result.ok) throw new Error(`fixture batch refused: ${result.failure}`);
  batch = {
    artifact: result.artifact.text,
    manifest: result.manifest.text,
    manifestSha256: createHash('sha256')
      .update(result.manifest.text)
      .digest('hex'),
  };
});

function writeBatch() {
  const directory = join(scratch(), 'batch');
  mkdirSync(directory);
  writeFileSync(join(directory, 'artifact.json'), batch.artifact);
  writeFileSync(join(directory, 'manifest.json'), batch.manifest);
  return directory;
}

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: edgeApi,
    encoding: 'utf8',
    timeout: 120_000,
  });
  const line = result.stdout.trim().split('\n').pop() ?? '';
  return { status: result.status, report: line ? JSON.parse(line) : null };
}

describe('submission builder CLI: arguments', () => {
  const valid = [
    '--batch',
    'b',
    '--manifest-sha256',
    SHA,
    '--expected-active-version',
    'v1',
    '--out',
    'o.json',
  ];

  it('accepts exactly the documented arguments', () => {
    expect(parseSubmissionArguments(valid)).toEqual({
      ok: true,
      batch: 'b',
      manifestSha256: SHA,
      expectedActiveVersion: 'v1',
      out: 'o.json',
    });
  });

  it('refuses missing, repeated, unknown or invalid arguments', () => {
    expect(parseSubmissionArguments(valid.slice(0, 6)).reason).toBe(
      'missing-argument',
    );
    expect(parseSubmissionArguments([...valid, '--out', 'x']).reason).toBe(
      'repeated-argument',
    );
    expect(parseSubmissionArguments([...valid, '--token', 'x']).reason).toBe(
      'unknown-argument',
    );
    expect(parseSubmissionArguments(['--batch']).reason).toBe('missing-value');
    const badSha = [...valid];
    badSha[3] = 'ABC';
    expect(parseSubmissionArguments(badSha).reason).toBe(
      'manifest-sha256-invalid',
    );
  });

  it('refuses a batch or output inside the repository, or in the batch', () => {
    const outside = resolve(repositoryRoot, '..', 'outside');
    expect(
      submissionPathRefusal(
        { batch: join(repositoryRoot, 'b'), out: join(outside, 'o.json') },
        repositoryRoot,
      ),
    ).toBe('batch-inside-repository');
    expect(
      submissionPathRefusal(
        { batch: outside, out: join(repositoryRoot, 'o.json') },
        repositoryRoot,
      ),
    ).toBe('output-inside-repository');
    expect(
      submissionPathRefusal(
        { batch: outside, out: join(outside, 'o.json') },
        repositoryRoot,
      ),
    ).toBe('output-inside-batch');
  });
});

describe('submission builder CLI: end to end, offline', () => {
  it('writes the body for a reviewed batch and reports its digest', () => {
    const directory = writeBatch();
    const out = join(scratch(), 'submission.json');
    const { status, report } = run([
      '--batch',
      directory,
      '--manifest-sha256',
      batch.manifestSha256,
      '--expected-active-version',
      'v-seed-legacy',
      '--out',
      out,
    ]);
    expect(status).toBe(0);
    expect(report.ok).toBe(true);
    const text = readFileSync(out, 'utf8');
    expect(report.summary.submissionSha256).toBe(
      createHash('sha256').update(text).digest('hex'),
    );
    expect(report.summary.attributionStatus).toBe('not-active');
    const body = JSON.parse(text);
    expect(body.reviewedManifestSha256).toBe(batch.manifestSha256);
    expect(body.manifest).toEqual(JSON.parse(batch.manifest));
  });

  it('refuses a manifest other than the reviewed one and writes nothing', () => {
    const directory = writeBatch();
    const out = join(scratch(), 'submission.json');
    const { status, report } = run([
      '--batch',
      directory,
      '--manifest-sha256',
      SHA,
      '--expected-active-version',
      'v-seed-legacy',
      '--out',
      out,
    ]);
    expect(status).toBe(1);
    expect(report.failure).toBe('manifest-digest-mismatch');
    expect(existsSync(out)).toBe(false);
  });

  it('never overwrites an existing file', () => {
    const directory = writeBatch();
    const out = join(scratch(), 'submission.json');
    writeFileSync(out, 'kept');
    const { status, report } = run([
      '--batch',
      directory,
      '--manifest-sha256',
      batch.manifestSha256,
      '--expected-active-version',
      'v-seed-legacy',
      '--out',
      out,
    ]);
    expect(status).toBe(1);
    expect(report.failure).toBe('output-exists');
    expect(readFileSync(out, 'utf8')).toBe('kept');
  });

  it('refuses an output inside the repository', () => {
    const directory = writeBatch();
    const { status, report } = run([
      '--batch',
      directory,
      '--manifest-sha256',
      batch.manifestSha256,
      '--expected-active-version',
      'v-seed-legacy',
      '--out',
      join(edgeApi, '.submission-never-written.json'),
    ]);
    expect(status).toBe(1);
    expect(report.failure).toBe('output-inside-repository');
    expect(existsSync(join(edgeApi, '.submission-never-written.json'))).toBe(
      false,
    );
  });
});
