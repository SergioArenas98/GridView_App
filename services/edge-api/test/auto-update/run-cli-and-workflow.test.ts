/**
 * The job's CLI (offline paths only: every case below ends before any
 * network request) and its workflow's shape.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';

import { parseArguments } from '../../scripts/auto-update/run.mjs';
import { emptyState, stopFor } from '../../scripts/auto-update/reconcile';

const here = dirname(fileURLToPath(import.meta.url));
const edgeApi = resolve(here, '..', '..');
const cli = join(edgeApi, 'scripts', 'auto-update', 'run.mjs');
const workflowFile = resolve(
  edgeApi,
  '..',
  '..',
  '.github',
  'workflows',
  'season-auto-update-staging.yml',
);
const scratch: string[] = [];

interface Step {
  readonly uses?: string;
  readonly run?: string;
  readonly with?: Record<string, unknown>;
}

interface Workflow {
  readonly on: Record<string, { inputs: Record<string, unknown> }>;
  readonly permissions: unknown;
  readonly concurrency: unknown;
  readonly jobs: {
    readonly run: {
      readonly if: string;
      readonly environment: string;
      readonly 'timeout-minutes': number;
      readonly steps: readonly Step[];
    };
  };
}

function directory() {
  const path = mkdtempSync(join(tmpdir(), 'gridview-auto-update-cli-'));
  scratch.push(path);
  return path;
}

function run(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '',
      SystemRoot: process.env.SystemRoot ?? '',
      ...env,
    },
  });
  const lines = result.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { code: result.status, lines };
}

afterEach(() => {
  for (const path of scratch.splice(0))
    rmSync(path, { recursive: true, force: true });
});

describe('run.mjs', () => {
  it('accepts only a state outside the repository, a mode and --submit', () => {
    const outside = join(directory(), 'state.json');
    expect(parseArguments(['--state', outside])).toMatchObject({
      mode: 'scheduled',
      submit: false,
    });
    expect(
      parseArguments(['--state', outside, '--mode', 'bootstrap', '--submit']),
    ).toMatchObject({ mode: 'bootstrap', submit: true });
    expect(parseArguments(['--state', join(edgeApi, 'state.json')])).toBeNull();
    expect(parseArguments(['--state', outside, '--mode', 'live'])).toBeNull();
    expect(parseArguments(['--state', outside, '--retry'])).toBeNull();
    expect(parseArguments([])).toBeNull();
    expect(run([]).code).toBe(4);
  });

  it('stops on a state it cannot decode, and leaves it as it was', () => {
    const state = join(directory(), 'state.json');
    writeFileSync(state, '{"schemaVersion":9}');
    const result = run(['--state', state]);
    expect(result.code).toBe(3);
    expect(result.lines.at(-1)).toMatchObject({
      ok: false,
      step: 'state',
      failure: 'state-version',
    });
    expect(readFileSync(state, 'utf8')).toBe('{"schemaVersion":9}');
  }, 60_000);

  it('a stopped state sends nothing and exits 3 for a human', () => {
    const state = join(directory(), 'state.json');
    const stopped = stopFor(
      emptyState(2026, 'x'),
      'staged-correction',
      [1],
      new Date('2026-11-05T00:00:00.000Z'),
    );
    writeFileSync(state, JSON.stringify(stopped));
    // No network is reachable from here: a request would fail the run.
    const result = run(['--state', state, '--submit'], {
      GRIDVIEW_INGEST_TOKEN: 't'.repeat(40),
    });
    expect(result.code).toBe(3);
    expect(result.lines.map((l) => l.step)).toEqual(['plan', 'result']);
    expect(result.lines[1]).toMatchObject({
      outcome: 'stopped:staged-correction',
    });
    expect(JSON.stringify(result.lines)).not.toContain('t'.repeat(40));
  }, 60_000);
});

describe('the staging workflow', () => {
  const text = readFileSync(workflowFile, 'utf8');
  const doc = yaml.load(text) as Workflow;
  const job = doc.jobs.run;

  it('is manual only: no schedule, push or pull request trigger', () => {
    expect(Object.keys(doc.on)).toEqual(['workflow_dispatch']);
    expect(text).not.toMatch(/^\s*schedule:/m);
    expect(job.if).toBe(
      "github.ref == 'refs/heads/master' && inputs.confirm == 'run-once'",
    );
    expect(doc.on.workflow_dispatch!.inputs.submit).toMatchObject({
      type: 'boolean',
      default: false,
    });
  });

  it('runs one job at a time and never cancels one mid-submission', () => {
    expect(doc.concurrency).toEqual({
      group: 'season-auto-update-staging',
      'cancel-in-progress': false,
    });
    expect(job['timeout-minutes']).toBeLessThanOrEqual(20);
  });

  it('holds only the scoped secret, read-only repository access, and uploads nothing', () => {
    expect(doc.permissions).toEqual({ contents: 'read' });
    expect(job.environment).toBe('staging-auto-update');
    expect(text.match(/secrets\.[A-Z_]+/g)).toEqual([
      'secrets.STAGING_SEASON_INGEST_TOKEN',
    ]);
    const code = text
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    expect(code).not.toMatch(/ADMIN_TOKEN|upload-artifact|GITHUB_TOKEN/);
    expect(job.steps[0]!.with!['persist-credentials']).toBe(false);
  });

  it('pins every action to a full commit SHA', () => {
    const uses = job.steps.filter((s) => s.uses).map((s) => s.uses as string);
    expect(uses.length).toBe(4);
    for (const use of uses)
      expect(use).toMatch(/^actions\/[a-z-]+(\/[a-z]+)?@[0-9a-f]{40}$/);
  });

  it('keeps the state outside the checkout', () => {
    expect(text).toContain(
      '--state "$RUNNER_TEMP/auto-update-state/state.json"',
    );
  });
});
