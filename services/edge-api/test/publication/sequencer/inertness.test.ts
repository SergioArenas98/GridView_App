/**
 * Proof that the Integration slice wired the sequencer into the publisher,
 * rollback and public-read paths **behind a disabled gate and nothing more**.
 *
 * The Mechanism slice's version of this file asserted the sequencer had *no*
 * production caller. Phase 9B-6b Integration deliberately adds those callers -
 * `SequencedPublicationService`, the composition root and the public router -
 * so those assertions are replaced here by the boundary that still holds:
 *
 * - `SEASON_PUBLICATION_AUTHORITY` is absent from every environment, so the
 *   composition builds the exact legacy `SnapshotPublisher` and the router
 *   never performs a Durable Object lookup (see `default-off.test.ts` for the
 *   behavioural proof);
 * - no `wrangler.toml` binding, `[exports]` entry, `[[migrations]]` block or
 *   Durable Object namespace declares the class, so the runtime still cannot
 *   instantiate it;
 * - `PROVIDER_MODE`, the public API and the closed document-name union are
 *   untouched.
 *
 * These fail the moment someone provisions, activates or configures the mode in
 * a deployed environment.
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

describe('no Durable Object binding, export or migration was added', () => {
  it('declares no SeasonPublicationSequencer binding in any environment', () => {
    expect(wranglerConfig).not.toContain('SeasonPublicationSequencer');
    expect(wranglerConfig).not.toContain('SEASON_PUBLICATION_SEQUENCER');
    expect(wranglerConfig).not.toContain('SEASON_PUBLICATION_AUTHORITY');
  });

  it('adds no [[migrations]] block', () => {
    expect(wranglerConfig).not.toContain('[[migrations]]');
  });

  it('leaves the only declared Durable Object exactly as it was', () => {
    const bindings = wranglerConfig.match(/class_name = "(\w+)"/g) ?? [];
    expect(new Set(bindings)).toEqual(
      new Set(['class_name = "ProviderRateLimiter"']),
    );
    expect(wranglerConfig).toContain('[exports.ProviderRateLimiter]');
    expect(wranglerConfig).not.toContain(
      '[exports.SeasonPublicationSequencer]',
    );
  });

  it('changes no provider mode or deployment setting', () => {
    expect(wranglerConfig).toMatch(
      /\[env\.production\.vars\][\s\S]*PROVIDER_MODE = "none"/,
    );
    expect(wranglerConfig).toMatch(
      /\[env\.staging\.vars\][\s\S]*PROVIDER_MODE = "mock"/,
    );
  });
});

describe('the runtime still cannot instantiate the class', () => {
  it('does not export the Durable Object class from the Worker entry point', () => {
    // Wrangler resolves a Durable Object class through a named export of the
    // Worker's main module. The Integration path reaches the sequencer through
    // the in-process port or a future namespace, never by exporting the class.
    const entryPoint = source('src/index.ts');
    expect(entryPoint).toContain(
      "export { ProviderRateLimiter } from './providers/http/provider-rate-limiter';",
    );
    expect(entryPoint).not.toContain('export { SeasonPublicationSequencer');
    expect(entryPoint).not.toContain('DurableObjectSeasonPublicationSequencer');
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

  it('falls back to the legacy authority when the mode is set with no port', async () => {
    const { resolvePublicationAuthority } =
      await import('../../../src/publication/authority');
    const authority = resolvePublicationAuthority(
      { SEASON_PUBLICATION_AUTHORITY: 'sequencer' },
      {
        environment: 'development',
        providerMode: 'mock',
        publicationAuthorityMode: 'sequencer',
        publicBaseUrl: null,
      },
    );
    expect(authority.mode).toBe('legacy');
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
