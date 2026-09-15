import { describe, expect, it } from 'vitest';

import config from '../../wrangler.toml?raw';
import worker, { type Env } from '../../src/index';
import { resolveRuntimeConfig } from '../../src/config/environment';
import { CutoverPreparationService } from '../../src/publication/cutover/service';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';
import { adminRequest, createHarness } from '../support/edge-harness';
import {
  SEASON,
  checkpointFor,
  cutoverContext,
  immediateRetry,
  inProcessPort,
  type CutoverContext,
} from '../publication/cutover/support';

describe('wrangler staging configuration', () => {
  it('keeps the existing TOML configuration format authoritative', () => {
    const jsoncConfig = import.meta.glob('../../wrangler.jsonc', {
      eager: true,
    });
    expect(config).toContain('compatibility_date = "2026-07-01"');
    expect(Object.keys(jsoncConfig)).toHaveLength(0);
  });

  it('declares the staging Worker, workers.dev endpoint, KV binding and cron explicitly', () => {
    expect(config).toMatch(
      /\[env\.staging\][\s\S]*name = "gridview-api-staging"/,
    );
    expect(config).toMatch(/\[env\.staging\][\s\S]*workers_dev = true/);
    expect(config).toMatch(
      /\[env\.staging\.vars\][\s\S]*ENVIRONMENT = "staging"[\s\S]*PROVIDER_MODE = "mock"[\s\S]*PUBLIC_BASE_URL = "https:\/\/gridview-api-staging\.sejuma18\.workers\.dev"/,
    );
    expect(config).toMatch(
      /\[\[env\.staging\.kv_namespaces\]\][\s\S]*binding = "GRIDVIEW_DATA"[\s\S]*id = "1d0fb55486a745a1ad12e03d9f04942b"/,
    );
    expect(config).toMatch(
      /\[env\.staging\.triggers\][\s\S]*crons = \["17 3 \* \* \*"\]/,
    );
  });

  it('declares ADMIN_TOKEN as a required staging secret without committing its value', () => {
    expect(config).toMatch(
      /\[env\.staging\.secrets\][\s\S]*required = \["ADMIN_TOKEN"\]/,
    );
    expect(config).not.toContain('Bearer ');
    expect(config).not.toContain('replace-with-disposable-local-token');
  });

  it('does not add account IDs or production storage bindings', () => {
    expect(config).not.toMatch(/^account_id\s*=/m);
    expect(config).not.toContain('[[env.production.kv_namespaces]]');
    expect(config).toMatch(
      /\[env\.production\.vars\][\s\S]*ENVIRONMENT = "production"[\s\S]*PROVIDER_MODE = "none"/,
    );
  });
});

/** The top-level (development) `[vars]` table's own body, up to the next `[` header. */
function developmentVarsBlock(toml: string): string {
  const match = /^\[vars\]\n([\s\S]*?)\n\[/m.exec(toml);
  if (match?.[1] === undefined) throw new Error('[vars] not found');
  return match[1];
}

/** The `[env.staging.vars]` table's own body, up to the next `[` header. */
function stagingVarsBlock(toml: string): string {
  const match = /\[env\.staging\.vars\]\n([\s\S]*?)\n\[/.exec(toml);
  if (match?.[1] === undefined) throw new Error('[env.staging.vars] not found');
  return match[1];
}

/** The `[env.production.vars]` table's own body, up to the next `[` header. */
function productionVarsBlock(toml: string): string {
  const match = /\[env\.production\.vars\]\n([\s\S]*?)\n\[/.exec(toml);
  if (match?.[1] === undefined) {
    throw new Error('[env.production.vars] not found');
  }
  return match[1];
}

/** A table body's configured lines, with comments and blank lines dropped. */
function assignments(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

/** The string variables a vars table body assigns, by name. */
function variables(block: string): Map<string, string> {
  return new Map(
    assignments(block).map((line): [string, string] => {
      const match = /^([A-Z_]+) = "([^"]*)"$/.exec(line);
      if (match?.[1] === undefined || match[2] === undefined) {
        throw new Error(`unexpected vars line: ${line}`);
      }
      return [match[1], match[2]];
    }),
  );
}

/** The runtime configuration a vars table body resolves to. */
function resolvedVars(block: string): ReturnType<typeof resolveRuntimeConfig> {
  const vars = variables(block);
  return resolveRuntimeConfig({
    ENVIRONMENT: vars.get('ENVIRONMENT'),
    PROVIDER_MODE: vars.get('PROVIDER_MODE'),
    PUBLIC_BASE_URL: vars.get('PUBLIC_BASE_URL'),
    SEASON_PUBLICATION_AUTHORITY: vars.get('SEASON_PUBLICATION_AUTHORITY'),
    SEASON_PUBLICATION_CUTOVER_CONTROL: vars.get(
      'SEASON_PUBLICATION_CUTOVER_CONTROL',
    ),
  });
}

describe('season 2026 activation-phase configuration (ADR 0025 D12)', () => {
  // The season-2026 seed was committed on 2026-09-15 under `seed:2026` and the
  // `sequencer` authority. This file moves staging to the activation phase and
  // keeps the authority. The phase change alone activates nothing (below). Any
  // other staging control or authority must change these assertions
  // deliberately.

  it('selects exactly activate:2026 and sequencer after the three base staging variables', () => {
    expect(assignments(stagingVarsBlock(config))).toEqual([
      'ENVIRONMENT = "staging"',
      'PROVIDER_MODE = "mock"',
      'PUBLIC_BASE_URL = "https://gridview-api-staging.sejuma18.workers.dev"',
      'SEASON_PUBLICATION_CUTOVER_CONTROL = "activate:2026"',
      'SEASON_PUBLICATION_AUTHORITY = "sequencer"',
    ]);
    // The seed phase is no longer configured anywhere.
    expect(config).not.toMatch(/^[^#\n]*"seed:/m);
    // Each is assigned exactly once anywhere in the file - so neither the
    // top-level development table nor production sets it; the names still
    // appear in the comments that explain the values.
    expect(
      config.match(/^\s*"?SEASON_PUBLICATION_CUTOVER_CONTROL"?\s*=/gm),
    ).toHaveLength(1);
    expect(
      config.match(/^\s*"?SEASON_PUBLICATION_AUTHORITY"?\s*=/gm),
    ).toHaveLength(1);
  });

  it('leaves the production variables exactly as they were', () => {
    expect(assignments(productionVarsBlock(config))).toEqual([
      'ENVIRONMENT = "production"',
      'PROVIDER_MODE = "none"',
    ]);
  });

  it('leaves the development variables exactly as they were', () => {
    expect(assignments(developmentVarsBlock(config))).toEqual([
      'ENVIRONMENT = "development"',
    ]);
  });

  it('resolves the staging variables to the season 2026 activation phase under the sequencer authority', () => {
    const resolved = resolvedVars(stagingVarsBlock(config));
    expect(resolved.environment).toBe('staging');
    expect(resolved.providerMode).toBe('mock');
    expect(resolved.publicationAuthorityMode).toBe('sequencer');
    expect(resolved.publicationCutoverControl).toEqual({
      kind: 'activate',
      season: 2026,
    });
  });

  it('resolves development and production to the legacy authority with no cutover control', () => {
    const development = resolvedVars(developmentVarsBlock(config));
    const production = resolvedVars(productionVarsBlock(config));
    expect(development.environment).toBe('development');
    expect(production.environment).toBe('production');
    for (const resolved of [development, production]) {
      expect(resolved.publicationAuthorityMode).toBe('legacy');
      expect(resolved.publicationCutoverControl).toEqual({ kind: 'disabled' });
    }
  });

  it('leaves every staging binding, the secret, cron and observability untouched', () => {
    expect(config).toMatch(
      /\[\[env\.staging\.durable_objects\.bindings\]\]\nname = "PROVIDER_RATE_LIMITER"\nclass_name = "ProviderRateLimiter"/,
    );
    expect(config).toMatch(
      /\[\[env\.staging\.durable_objects\.bindings\]\]\nname = "SEASON_PUBLICATION_SEQUENCER"\nclass_name = "SeasonPublicationSequencer"/,
    );
    expect(config).toMatch(
      /\[\[env\.staging\.kv_namespaces\]\]\nbinding = "GRIDVIEW_DATA"\nid = "1d0fb55486a745a1ad12e03d9f04942b"/,
    );
    expect(config).toMatch(
      /\[env\.staging\.secrets\]\nrequired = \["ADMIN_TOKEN"\]/,
    );
    expect(config).toMatch(
      /\[env\.staging\.triggers\]\ncrons = \["17 3 \* \* \*"\]/,
    );
    expect(config).toMatch(
      /\[env\.staging\.observability\]\nenabled = true\nhead_sampling_rate = 1\n\n\[env\.staging\.observability\.logs\]\nenabled = true\npersist = true\ninvocation_logs = false/,
    );
  });
});

/** A preparation service composed from one committed vars table. */
function committedService(
  block: string,
  context: CutoverContext,
): CutoverPreparationService {
  return new CutoverPreparationService({
    config: resolvedVars(block),
    authority: { mode: 'sequencer', port: context.port },
    storage: context.storage,
    validator: runtimeSnapshotValidator,
    logger: context.logger,
    clock: context.clock,
    retry: immediateRetry,
  });
}

describe('the committed activation phase activates nothing by itself (ADR 0025 D12)', () => {
  // `cutoverContext()` also composes a seed-phase service over the same
  // in-process sequencer. It stands in for the season-2026 seed that is
  // already committed. Every other service here is composed from a committed
  // vars table.

  it('neither seeds nor activates a season that holds no seed', async () => {
    const context = await cutoverContext();
    const staging = committedService(stagingVarsBlock(config), context);

    expect(await staging.status(SEASON)).toEqual({
      state: 'uninitialized',
      season: SEASON,
      phase: 'activate',
      admissionClosed: true,
    });
    expect(await staging.seed(checkpointFor())).toEqual({
      kind: 'refused',
      refusal: 'phase-not-permitted',
    });
    expect(await staging.activate(checkpointFor(), true)).toEqual({
      kind: 'failed',
      failure: 'cutover-not-seeded',
    });
    expect(await context.port.readAuthority(SEASON)).toEqual({
      cutoverState: 'uninitialized',
      authoritative: false,
    });
  });

  it('keeps a seeded season non-authoritative until the confirmed, fingerprint-bound activation', async () => {
    const context = await cutoverContext();
    expect((await context.service.seed(checkpointFor())).kind).toBe('seeded');
    const staging = committedService(stagingVarsBlock(config), context);

    expect(await staging.status(SEASON)).toMatchObject({
      state: 'seeded',
      phase: 'activate',
      admissionClosed: true,
      authoritative: false,
    });
    expect(await staging.seed(checkpointFor())).toEqual({
      kind: 'refused',
      refusal: 'phase-not-permitted',
    });
    expect(await staging.activate(checkpointFor(), false)).toEqual({
      kind: 'failed',
      failure: 'activation-not-confirmed',
    });
    expect(
      await staging.activate(
        checkpointFor({ migrationIdentity: 'a-different-attempt' }),
        true,
      ),
    ).toEqual({ kind: 'failed', failure: 'cutover-fingerprint-mismatch' });
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
      authoritative: false,
    });

    expect((await staging.activate(checkpointFor(), true)).kind).toBe(
      'activated',
    );
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'active',
      authoritative: true,
    });
  });

  it('refuses both operations under the committed development and production variables', async () => {
    const context = await cutoverContext();
    await context.service.seed(checkpointFor());
    for (const block of [
      developmentVarsBlock(config),
      productionVarsBlock(config),
    ]) {
      const service = committedService(block, context);
      expect(await service.seed(checkpointFor())).toEqual({
        kind: 'refused',
        refusal: 'disabled',
      });
      expect(await service.activate(checkpointFor(), true)).toEqual({
        kind: 'refused',
        refusal: 'disabled',
      });
    }
    expect(await context.port.readAuthority(SEASON)).toMatchObject({
      cutoverState: 'seeded',
      authoritative: false,
    });
  });
});

/** The Worker env the committed staging vars produce, over an in-process port. */
function committedStagingEnv(): Env {
  const vars = variables(stagingVarsBlock(config));
  const value = (name: string): string => {
    const found = vars.get(name);
    if (found === undefined) throw new Error(`${name} is not committed`);
    return found;
  };
  return {
    ...createHarness().env,
    ENVIRONMENT: value('ENVIRONMENT'),
    PROVIDER_MODE: value('PROVIDER_MODE'),
    PUBLIC_BASE_URL: value('PUBLIC_BASE_URL'),
    SEASON_PUBLICATION_AUTHORITY: value('SEASON_PUBLICATION_AUTHORITY'),
    SEASON_PUBLICATION_CUTOVER_CONTROL: value(
      'SEASON_PUBLICATION_CUTOVER_CONTROL',
    ),
    __SEASON_PUBLICATION_SEQUENCER: inProcessPort(),
    __CUTOVER_RETRY: immediateRetry,
  };
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('the committed staging variables at the Worker boundary', () => {
  const SEED = '/internal/admin/publication/cutover/seed';
  const ACTIVATE = '/internal/admin/publication/cutover/activate';

  it('refuses the seed route in the activation phase', async () => {
    const response = await worker.fetch(
      adminRequest(SEED, 'local-test-token', { checkpoint: checkpointFor() }),
      committedStagingEnv(),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await body(response)).toMatchObject({
      data: { kind: 'refused', refusal: 'phase-not-permitted' },
    });
  });

  it('admits the activation route only with the literal confirmActivation true', async () => {
    const env = committedStagingEnv();
    for (const confirmActivation of [undefined, false, 'true', 1, {}]) {
      const response = await worker.fetch(
        adminRequest(ACTIVATE, 'local-test-token', {
          checkpoint: checkpointFor(),
          confirmActivation,
        }),
        env,
      );
      expect(response.status).toBe(409);
      expect(await body(response)).toMatchObject({
        data: { kind: 'failed', failure: 'activation-not-confirmed' },
      });
    }
    // The literal `true` passes the phase gate and the confirmation, and then
    // reaches the sequencer, which holds no seed in this in-process port.
    const confirmed = await worker.fetch(
      adminRequest(ACTIVATE, 'local-test-token', {
        checkpoint: checkpointFor(),
        confirmActivation: true,
      }),
      env,
    );
    expect(confirmed.headers.get('Cache-Control')).toBe('no-store');
    expect(await body(confirmed)).toMatchObject({
      data: { kind: 'failed', failure: 'cutover-not-seeded' },
    });
  });
});
