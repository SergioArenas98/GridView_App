/**
 * The coordinated orchestration is implemented, injected and not connected.
 *
 * No Worker module imports it, the coordinated entry point still refuses every
 * run as `ledger-unbound`, it reaches the provider only through the composed
 * runtime, and it reaches publication only through the outcome half
 * (`../outcome/`, whose own dormancy test pins how). Bundle reachability is
 * proven by the bundler in `test/providers/provider-neutrality.test.ts`.
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

describe('the observation orchestration is not connected', () => {
  it('is imported by no module outside itself', () => {
    expect(observationFiles()).toEqual([
      'sync/coordinated/observation/index.ts',
      'sync/coordinated/observation/observe.ts',
      'sync/coordinated/observation/outcomes.ts',
      'sync/coordinated/observation/published.ts',
      'sync/coordinated/observation/revisions.ts',
    ]);
    expect(importersOf(observationDir)).toEqual([]);
    expect(resolveReconciliationLedger()).toBeNull();
    // The coordinated entry point is unchanged: it composes, and stops.
    expect(importsOf('sync/coordinated/run.ts')).toEqual([
      'logging/logger.ts',
      'sync/coordinated/composition.ts',
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
      'contract/types.ts',
      'logging/logger.ts',
      'providers/coordination/index.ts',
      'publication/canonical/ordering.ts',
      'publication/guard/participation-guard.ts',
      'publication/guard/predecessor.ts',
      'publication/sequencer/port.ts',
      'publication/snapshot-revision.ts',
      'storage/types.ts',
      'sync/coordinated/composition.ts',
      'sync/coordinated/ledger/model.ts',
      'sync/coordinated/operator/attention.ts',
      'sync/coordinated/outcome/index.ts',
      'sync/coordinated/policy/index.ts',
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
