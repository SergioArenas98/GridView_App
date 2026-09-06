/**
 * Proof that this slice added a mechanism and **nothing else**.
 *
 * ADR 0025 D12 gates provisioning, activation and every caller behind separate
 * authorizations. These assertions are what make "no binding, no caller, no
 * deployment" a checked property rather than a claim in a pull request body:
 * they fail the moment someone binds the class, registers it in the Worker
 * entry point, or wires a production caller to the port.
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

describe('no Durable Object binding or migration was added', () => {
  it('declares no SeasonPublicationSequencer binding in any environment', () => {
    expect(wranglerConfig).not.toContain('SeasonPublicationSequencer');
    expect(wranglerConfig).not.toContain('SEASON_PUBLICATION_SEQUENCER');
  });

  it('adds no [[migrations]] block', () => {
    // ADR 0025's staging step would use the `exports` mechanism
    // `ProviderRateLimiter` already uses, not the legacy migrations block -
    // and neither is added here.
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

describe('no runtime registration or production caller exists', () => {
  const entryPoint = source('src/index.ts');

  it('does not export the class from the Worker entry point', () => {
    // Wrangler resolves a Durable Object class through a named export of the
    // Worker's main module. Without one, the class cannot be instantiated by
    // the runtime, whatever a binding might say.
    expect(entryPoint).toContain(
      "export { ProviderRateLimiter } from './providers/http/provider-rate-limiter';",
    );
    expect(entryPoint).not.toContain('SeasonPublicationSequencer');
    expect(entryPoint).not.toContain('sequencer');
  });

  it('is reachable from no production module', () => {
    // Every importer of the mechanism is a test. The publisher, the routers,
    // the sync service and the admin surface are untouched.
    for (const module of [
      'src/index.ts',
      'src/publication/publisher.ts',
      'src/public/router.ts',
      'src/admin/router.ts',
      'src/sync/sync-service.ts',
      'src/storage/factory.ts',
      'src/config/environment.ts',
      'src/cache/purge.ts',
    ]) {
      expect(source(module)).not.toContain('sequencer/');
      expect(source(module)).not.toContain('SeasonPublicationSequencer');
    }
  });

  it('leaves snapshotRevision without a production caller', () => {
    // The mechanism accepts revisions as an input; it does not compute them,
    // and nothing in the production path computes them either.
    for (const module of ['src/index.ts', 'src/publication/publisher.ts']) {
      expect(source(module)).not.toContain('snapshot-revision');
    }
  });

  it('adds no publisher or rollback caller for the sidecar', () => {
    const publisher = source('src/publication/publisher.ts');
    expect(publisher).not.toContain('publication-metadata');
    expect(publisher).not.toContain('PublicationMetadata');
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

  it('leaves public routing and cache behaviour untouched', () => {
    expect(source('src/public/router.ts')).not.toContain(
      'publication_metadata',
    );
    expect(source('src/cache/purge.ts')).not.toContain('publication_metadata');
  });
});
