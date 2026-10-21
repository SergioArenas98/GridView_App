/**
 * The isolated demonstration Worker's committed configuration (`[env.e2e]`,
 * release gate AU-2 step 2; `docs/release/automatic-updates.md` §8.1), as
 * Wrangler itself resolves `wrangler.toml`.
 *
 * It must be exactly what the gate's stage runs as the demonstration
 * (`DEMONSTRATION_DELTA` on committed staging, plus the activation delta), and
 * exactly the block the runbook prints, so that what AU-3 demonstrates is what
 * is deployed. It must share no resource with staging.
 *
 * `unstable_readConfig` only reads the file: nothing here deploys, provisions
 * or contacts Cloudflare.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { unstable_readConfig } from 'wrangler';

import rawConfig from '../../wrangler.toml?raw';
import { resolveRuntimeConfig } from '../../src/config/environment';
import { resolveControlledProviderSource } from '../../src/providers/controlled/source';
import {
  AUTOMATIC_ACTIVATION_DELTA,
  DEMONSTRATION_DELTA,
  committedVars,
} from '../e2e/automatic-updates/stage';
import { demonstrationSection } from './demonstration-environment';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, '..', '..', 'wrangler.toml');
const runbookPath = join(
  here,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'release',
  'automatic-updates.md',
);

/** The KV namespace `gridview-snapshots-e2e`, created 2026-10-21 (AU-2 step 1). */
const DEMONSTRATION_KV_ID = 'f8970084eef14b6a8e24db521d015df3';
const STAGING_KV_ID = '1d0fb55486a745a1ad12e03d9f04942b';

function resolved(environment: 'staging' | 'e2e') {
  return unstable_readConfig(
    { config: configPath, env: environment },
    { hideWarnings: true },
  );
}

/** Variables as the Worker receives them, an empty value being unset. */
function present(vars: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars)
      .map(([name, value]): [string, string] => [name, String(value)])
      .filter(([, value]) => value !== ''),
  );
}

/** A TOML text's configured lines: no comments, blank lines or indentation. */
function declarations(toml: string): string[] {
  return toml
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

/** The `[env.e2e]` block the runbook prints in §8.1 step 2. */
function runbookBlock(): string {
  const runbook = readFileSync(runbookPath, 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...runbook.matchAll(/```toml\n([\s\S]*?)```/g)]
    .map((match) => match[1] ?? '')
    .filter((block) => block.includes('[env.e2e]'));
  expect(blocks).toHaveLength(1);
  return blocks[0] ?? '';
}

describe('the demonstration Worker configuration (AU-2)', () => {
  it('is its own Worker on workers.dev, with no preview URLs', () => {
    const demonstration = resolved('e2e');
    expect(demonstration.name).toBe('gridview-api-e2e');
    expect(demonstration.workers_dev).toBe(true);
    expect(demonstration.preview_urls).toBe(false);
  });

  it('carries exactly the variables the gate runs as the demonstration', () => {
    // The stage runs committed staging, the demonstration delta and the
    // activation delta's provider mode. The delta's empty
    // `SEASON_BATCH_INGEST` and an absent one both refuse every ingest as
    // `ingest-disabled`, so the block leaves it out.
    expect(present(resolved('e2e').vars)).toEqual(
      present({
        ...committedVars('staging'),
        ...DEMONSTRATION_DELTA,
        PROVIDER_MODE: AUTOMATIC_ACTIVATION_DELTA.PROVIDER_MODE,
      }),
    );
    expect(resolved('e2e').vars).not.toHaveProperty('SEASON_BATCH_INGEST');
  });

  it('is admitted at runtime, with its own controlled source', () => {
    const vars = present(resolved('e2e').vars);
    const config = resolveRuntimeConfig(vars);
    expect(config).toMatchObject({
      environment: 'staging',
      providerMode: 'coordinated',
      publicationAuthorityMode: 'sequencer',
      publicBaseUrl: 'https://gridview-api-e2e.sejuma18.workers.dev',
    });
    expect(
      resolveControlledProviderSource(
        vars.CONTROLLED_PROVIDER_SOURCE,
        config.environment,
        config.providerMode,
      ),
    ).toBe('kv');
  });

  it('binds its own KV namespace and none of staging', () => {
    expect(resolved('e2e').kv_namespaces).toEqual([
      { binding: 'GRIDVIEW_DATA', id: DEMONSTRATION_KV_ID },
    ]);
    expect(resolved('staging').kv_namespaces).toEqual([
      { binding: 'GRIDVIEW_DATA', id: STAGING_KV_ID },
    ]);
    expect(rawConfig.match(new RegExp(DEMONSTRATION_KV_ID, 'g'))).toHaveLength(
      1,
    );
    expect(demonstrationSection(rawConfig)).not.toContain(STAGING_KV_ID);
  });

  it('requires ADMIN_TOKEN without committing it, schedules nothing and persists its logs', () => {
    const demonstration = resolved('e2e');
    expect(demonstration.secrets).toEqual({ required: ['ADMIN_TOKEN'] });
    expect(demonstration.triggers).toEqual({ crons: [] });
    expect(demonstration.observability).toEqual({
      enabled: true,
      head_sampling_rate: 1,
      logs: { enabled: true, persist: true, invocation_logs: false },
    });
  });

  it('is the block the runbook prints, line for line', () => {
    expect(declarations(demonstrationSection(rawConfig))).toEqual(
      declarations(runbookBlock()),
    );
  });
});
