/**
 * The coordinated orchestration is wired, and unbound.
 *
 * Only the coordinated entry point (`run.ts`) imports it, and only the Worker
 * entry point imports that. The resolver still answers `null`, so the entry
 * point's gate refuses every run as `ledger-unbound` before the orchestration
 * is reached. It reaches the provider only through the composed runtime, and
 * publication only through the outcome half (`../outcome/`, whose own
 * dormancy test pins how). Bundle reachability is proven by the bundler in
 * `test/providers/provider-neutrality.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import { resolveReconciliationLedger } from '../../../../src/sync/coordinated/ledger-port';
import {
  importersOf,
  importsOf,
  readSource,
  sourceFiles,
} from '../source-graph';

const observationDir = 'sync/coordinated/observation/';
const observationFiles = () =>
  sourceFiles().filter((file) => file.startsWith(observationDir));

describe('the observation orchestration is wired through one entry, unbound', () => {
  it('is imported only by the coordinated entry point', () => {
    expect(observationFiles()).toEqual([
      'sync/coordinated/observation/index.ts',
      'sync/coordinated/observation/observe.ts',
      'sync/coordinated/observation/outcomes.ts',
      'sync/coordinated/observation/published.ts',
      'sync/coordinated/observation/revisions.ts',
    ]);
    expect(importersOf(observationDir)).toEqual(['sync/coordinated/run.ts']);
    expect(resolveReconciliationLedger({})).toBeNull();
    expect(importsOf('sync/coordinated/run.ts')).toEqual([
      'logging/logger.ts',
      'publication/sequencer/port.ts',
      'storage/types.ts',
      'sync/coordinated/composition.ts',
      'sync/coordinated/observation/index.ts',
      'sync/coordinated/operator/attention.ts',
      'sync/coordinated/run-budget.ts',
    ]);
    // The router imports only the outcome type it answers with.
    expect(importersOf('sync/coordinated/run.ts')).toEqual([
      'admin/router.ts',
      'index.ts',
    ]);
  });

  it('depends on exactly these modules', () => {
    const outside = new Set<string>();
    for (const file of observationFiles()) {
      for (const imported of importsOf(file)) {
        if (!imported.startsWith(observationDir)) outside.add(imported);
      }
    }
    expect([...outside].sort()).toEqual([
      'logging/logger.ts',
      'providers/coordination/index.ts',
      'publication/canonical/ordering.ts',
      'publication/guard/participation-guard.ts',
      'publication/guard/predecessor.ts',
      'publication/sequencer/port.ts',
      'storage/types.ts',
      'sync/coordinated/classification-revision.ts',
      'sync/coordinated/composition.ts',
      'sync/coordinated/ledger/model.ts',
      'sync/coordinated/operator/attention.ts',
      'sync/coordinated/outcome/index.ts',
      'sync/coordinated/policy/index.ts',
      'sync/coordinated/run-budget.ts',
    ]);
  });

  it('builds no client, port, limiter or coordinator, and reads no global', () => {
    for (const file of observationFiles()) {
      const code = readSource(file);
      expect(code, file).not.toMatch(
        /new\s+(ProviderHttpClient|PacedReservationClient|MultiSourceCoordinator|Jolpica\w+Port)\b/,
      );
      expect(code, file).not.toMatch(
        /\bfetch\(|globalThis|process\.env|cloudflare:|Date\.now\(|new Date\(\)/,
      );
    }
  });

  it('reaches publication only through the outcome half', () => {
    for (const file of observationFiles()) {
      const code = readSource(file);
      expect(code, file).not.toMatch(
        /publishGuarded|CoordinatedSeasonPublication|runtime\.publication|prepareCandidate|publishCandidate|\.(prepare|finalize|cancel|seedCutover|activateCutover)\(|writeVersionedDocument/,
      );
    }
    const observe = readSource('sync/coordinated/observation/observe.ts');
    expect(observe.match(/publishUnderLease\(/g)).toHaveLength(1);
  });
});
