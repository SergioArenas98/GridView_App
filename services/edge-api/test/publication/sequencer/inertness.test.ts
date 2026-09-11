/**
 * Proof that the staging cutover preparation slice **declared** the sequencer's
 * deployment surface and **nothing more**.
 *
 * Each earlier slice narrowed what this file can still assert, and each
 * narrowing was deliberate. The Mechanism slice asserted the sequencer had no
 * production caller; Integration added those callers behind a disabled gate;
 * this slice adds the named Worker export and an `env.staging` binding so a
 * future, separately authorized deployment can create the namespace.
 *
 * The distinction this file now enforces is **declared in the repository**
 * versus **actually provisioned or deployed**:
 *
 * - the class *is* a named Worker export and *is* declared as an
 *   `[exports.SeasonPublicationSequencer]` SQLite Durable Object bound to
 *   `SEASON_PUBLICATION_SEQUENCER` in `env.staging` - and nowhere else;
 * - **production declares no season-publication binding at all**;
 * - no committed environment sets `SEASON_PUBLICATION_AUTHORITY`, so the
 *   composition still builds the exact legacy `SnapshotPublisher` and the
 *   router still performs no Durable Object lookup (see `default-off.test.ts`
 *   for the behavioural proof);
 * - no committed environment sets `SEASON_PUBLICATION_CUTOVER_CONTROL`, so no
 *   season is paused and no cutover operation is permitted;
 * - the legacy `[[migrations]]` form is still absent, and `PROVIDER_MODE`, the
 *   public API and the closed document-name union are untouched.
 *
 * Nothing here provisions a namespace, deploys a Worker, seeds a season or
 * activates one. These assertions fail the moment someone commits an authority
 * mode, a cutover control, or a production binding.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import wranglerConfig from '../../../wrangler.toml?raw';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');
const edgeApiRoot = join(repoRoot, 'services', 'edge-api');

function source(relative: string): string {
  return readFileSync(join(edgeApiRoot, ...relative.split('/')), 'utf8');
}

/**
 * The TOML with every comment line removed.
 *
 * These assertions are about what the file **configures**, not about what its
 * prose mentions. This slice's comments deliberately name
 * `SEASON_PUBLICATION_AUTHORITY`, `SEASON_PUBLICATION_CUTOVER_CONTROL` and
 * `[[migrations]]` in order to record that none of them is set or used, and a
 * raw substring search cannot tell that apart from actually setting one.
 */
const declaredConfig = wranglerConfig
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

/**
 * The `[env.<name>]` slice of the declared TOML, so a binding can never be
 * attributed to the wrong environment by a whole-file substring match.
 *
 * The slice ends at the next **top-level** `[env.<name>]` header; a nested
 * `[env.<name>.vars]` or `[[env.<name>.durable_objects.bindings]]` table
 * belongs to the environment being read.
 */
function environmentSection(name: string): string {
  const start = declaredConfig.indexOf(`[env.${name}]`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = declaredConfig.slice(start + 1);
  const next = rest.search(/^\[env\.[a-z]+\]\s*$/m);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('the sequencer deployment surface is declared, not provisioned', () => {
  it('declares the SQLite export in the supported exports form', () => {
    expect(declaredConfig).toContain('[exports.ProviderRateLimiter]');
    expect(declaredConfig).toMatch(
      /\[exports\.SeasonPublicationSequencer\]\r?\ntype = "durable-object"\r?\nstorage = "sqlite"/,
    );
  });

  it('still adds no legacy [[migrations]] block', () => {
    // `[[migrations]]` conflicts with the `exports` form `ProviderRateLimiter`
    // already uses, and ADR 0025 D12 names `exports` as the supported route.
    expect(declaredConfig).not.toContain('[[migrations]]');
  });

  it('binds the sequencer in staging only, and leaves ProviderRateLimiter alone', () => {
    const staging = environmentSection('staging');
    const production = environmentSection('production');

    expect(staging).toContain('name = "SEASON_PUBLICATION_SEQUENCER"');
    expect(staging).toContain('class_name = "SeasonPublicationSequencer"');
    expect(staging).toContain('name = "PROVIDER_RATE_LIMITER"');

    // Production declares no season-publication binding at all, so a production
    // deployment cannot reach the class even by accident.
    expect(production).not.toContain('SEASON_PUBLICATION_SEQUENCER');
    expect(production).not.toContain('SeasonPublicationSequencer');
    expect(production).toContain('class_name = "ProviderRateLimiter"');
  });

  it('sets neither the authority mode nor the cutover control anywhere', () => {
    // Declaring a binding enables nothing: no path looks the namespace up while
    // the authority mode is unset, and no season is paused and no cutover
    // operation is permitted while the cutover control is unset.
    expect(declaredConfig).not.toContain('SEASON_PUBLICATION_AUTHORITY');
    expect(declaredConfig).not.toContain('SEASON_PUBLICATION_CUTOVER_CONTROL');
  });

  it('changes no provider mode or deployment setting', () => {
    expect(declaredConfig).toMatch(
      /\[env\.production\.vars\][\s\S]*PROVIDER_MODE = "none"/,
    );
    expect(declaredConfig).toMatch(
      /\[env\.staging\.vars\][\s\S]*PROVIDER_MODE = "mock"/,
    );
  });
});

describe('the class is exported so a future deployment can resolve it', () => {
  it('exports both Durable Object classes from the Worker entry point', () => {
    // Wrangler resolves a Durable Object class through a named export of the
    // Worker's main module, so the export is what makes the staging binding
    // deployable at all. It provisions nothing by itself.
    const entryPoint = source('src/index.ts');
    expect(entryPoint).toContain(
      "export { ProviderRateLimiter } from './providers/http/provider-rate-limiter';",
    );
    expect(entryPoint).toContain(
      "export { SeasonPublicationSequencer } from './publication/sequencer/durable-object';",
    );
  });
});

describe('the authority mode is disabled by default', () => {
  it('resolves to legacy for an absent or unrecognised value', async () => {
    const { resolvePublicationAuthorityMode } =
      await import('../../../src/config/environment');
    expect(resolvePublicationAuthorityMode(undefined)).toBe('legacy');
    expect(resolvePublicationAuthorityMode('')).toBe('legacy');
    expect(resolvePublicationAuthorityMode('SEQUENCER')).toBe('legacy');
    expect(resolvePublicationAuthorityMode('sequencer ')).toBe('legacy');
    expect(resolvePublicationAuthorityMode('sequencer')).toBe('sequencer');
  });

  it('fails closed rather than falling back when the mode is set with no port', async () => {
    const { resolvePublicationAuthority } =
      await import('../../../src/publication/authority');
    const authority = resolvePublicationAuthority(
      { SEASON_PUBLICATION_AUTHORITY: 'sequencer' },
      {
        environment: 'development',
        providerMode: 'mock',
        publicationAuthorityMode: 'sequencer',
        publicationCutoverControl: { kind: 'disabled' as const },
        publicBaseUrl: null,
      },
    );
    // Still inert - nothing publishes and nothing is served - but the operator's
    // explicit selection is preserved instead of silently becoming legacy.
    expect(authority.mode).toBe('sequencer-unavailable');
  });
});

describe('nothing here can provision or contact Cloudflare', () => {
  it('defines no deploy or provisioning script', () => {
    const packageJson = JSON.parse(source('package.json')) as {
      scripts: Record<string, string>;
    };
    for (const [name, script] of Object.entries(packageJson.scripts)) {
      expect(`${name}: ${script}`).not.toContain('wrangler deploy');
      expect(`${name}: ${script}`).not.toContain('wrangler kv');
      expect(`${name}: ${script}`).not.toContain('wrangler secret');
      expect(`${name}: ${script}`).not.toContain('wrangler publish');
    }
    // `validate:worker-config` only generates local types; it uploads nothing.
    expect(packageJson.scripts['validate:worker-config']).toContain(
      'wrangler types',
    );
  });

  it('never reaches a Cloudflare API or a deployed endpoint from cutover code', () => {
    for (const relative of [
      'src/publication/cutover/control.ts',
      'src/publication/cutover/admission.ts',
      'src/publication/cutover/checkpoint.ts',
      'src/publication/cutover/migration.ts',
      'src/publication/cutover/service.ts',
      'src/admin/cutover-routes.ts',
    ]) {
      const code = source(relative);
      expect(code).not.toContain('api.cloudflare.com');
      expect(code).not.toContain('workers.dev');
      // The only network primitive any of these could reach for is `fetch`,
      // and none of them calls one: every read goes through `SnapshotStorage`
      // and every sequencer call through the injected port.
      expect(code).not.toMatch(/(^|[^.\w])fetch\s*\(/m);
    }
  });
});

describe('no public surface changed', () => {
  it('leaves the closed public document-name union untouched', () => {
    const types = source('src/storage/types.ts');
    const union = types.slice(
      types.indexOf('export type SnapshotDocumentName'),
      types.indexOf("| 'content:manifest';") + "| 'content:manifest';".length,
    );
    expect(union).not.toContain('__publication_metadata');
    expect(union).not.toContain('__inventory');
  });

  it('adds no field to the public API or OpenAPI contract', () => {
    const openapi = readFileSync(
      join(repoRoot, 'docs', 'api', 'gridview-api-v1.yaml'),
      'utf8',
    );
    for (const internal of [
      '__publication_metadata',
      'sourceOrderingInput',
      'operationEpoch',
      'candidateVersion',
      'snapshotObservedAt',
      'cutoverState',
      'cutoverFingerprint',
    ]) {
      expect(openapi).not.toContain(internal);
    }
  });

  it('never routes or purges an internal sidecar key', () => {
    expect(source('src/public/router.ts')).not.toContain(
      'publication_metadata',
    );
    expect(source('src/cache/purge.ts')).not.toContain('publication_metadata');
  });
});
