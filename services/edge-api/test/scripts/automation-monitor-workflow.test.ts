/**
 * The monitor's workflow (`.github/workflows/automation-monitor.yml`) after
 * release gate AU-5: one hourly schedule that checks staging with the
 * heartbeat on, beside the manual checks it already had.
 *
 * A scheduled run carries no `inputs`, so each value the job reads must fall
 * back to the scheduled meaning: staging, heartbeat checked, no simulated
 * failure. Reading the file only; nothing here runs the workflow.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
);

interface Workflow {
  readonly on: {
    readonly schedule?: readonly { readonly cron: string }[];
    readonly workflow_dispatch: {
      readonly inputs: Record<string, { readonly default: unknown }>;
    };
  };
  readonly concurrency: { readonly group: string };
  readonly jobs: {
    readonly check: {
      readonly steps: readonly {
        readonly name?: string;
        readonly env?: Record<string, string>;
      }[];
    };
  };
}

const workflow = yaml.load(
  readFileSync(
    join(repoRoot, '.github', 'workflows', 'automation-monitor.yml'),
    'utf8',
  ),
) as Workflow;

const env =
  workflow.jobs.check.steps.find(
    (step) => step.name === 'Check the automatic path',
  )?.env ?? {};

describe('the automation monitor workflow (gate AU-5)', () => {
  it('runs once an hour, thirty minutes after the Worker tick', () => {
    expect(workflow.on.schedule).toEqual([{ cron: '47 * * * *' }]);
  });

  it('keeps the manual checks and their defaults', () => {
    expect(workflow.on.workflow_dispatch.inputs).toMatchObject({
      environment: { default: 'staging' },
      skip_heartbeat: { default: false },
      simulate_failure: { default: false },
    });
  });

  it('gives a scheduled run staging, the heartbeat check and no simulated failure', () => {
    expect(env).toEqual({
      TARGET: "${{ inputs.environment || 'staging' }}",
      SKIP_HEARTBEAT: '${{ inputs.skip_heartbeat || false }}',
      SIMULATE_FAILURE: '${{ inputs.simulate_failure || false }}',
    });
    expect(workflow.concurrency.group).toBe(
      "automation-monitor-${{ inputs.environment || 'staging' }}",
    );
  });
});
