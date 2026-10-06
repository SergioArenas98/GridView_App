/**
 * The publication half is wired, and unbound.
 *
 * Only the orchestration imports it, and only the coordinated entry point
 * imports that. The resolver still answers `null`, so the entry point's gate
 * refuses every run as `ledger-unbound` before either is reached. It reaches
 * publication only through the bridge the composition built: one prepared
 * candidate, one guarded publication. Bundle reachability is proven by the
 * bundler in `test/providers/provider-neutrality.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import { resolveReconciliationLedger } from '../../../../src/sync/coordinated/ledger-port';
import {
  importersOf,
  importsOf,
  readSource,
  sourceFiles,
} from '../source-graph';

const outcomeDir = 'sync/coordinated/outcome/';
const outcomeFiles = () =>
  sourceFiles().filter((file) => file.startsWith(outcomeDir));

describe('the publication half is wired through one entry, unbound', () => {
  it('is imported only by the orchestration', () => {
    expect(outcomeFiles()).toEqual([
      'sync/coordinated/outcome/decisions.ts',
      'sync/coordinated/outcome/digest.ts',
      'sync/coordinated/outcome/index.ts',
      'sync/coordinated/outcome/metadata.ts',
      'sync/coordinated/outcome/ordering.ts',
      'sync/coordinated/outcome/publish.ts',
      'sync/coordinated/outcome/recovery.ts',
    ]);
    expect(importersOf(outcomeDir)).toEqual([
      'sync/coordinated/observation/observe.ts',
    ]);
    expect(importersOf('sync/coordinated/observation/')).toEqual([
      'sync/coordinated/run.ts',
    ]);
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
    expect(importsOf('index.ts')).not.toContain(
      'sync/coordinated/observation/index.ts',
    );
  });

  it('depends on exactly these modules', () => {
    const outside = new Set<string>();
    for (const file of outcomeFiles()) {
      for (const imported of importsOf(file)) {
        if (!imported.startsWith(outcomeDir)) outside.add(imported);
      }
    }
    // No provider module: the bridge is reached through the composed runtime.
    // The only content read is the two curated records O-14 names.
    expect([...outside].sort()).toEqual([
      '../../../content/attribution/data-sources.json',
      '../../../content/seasons/2026/season-metadata.development.json',
      'publication/canonical/ordering.ts',
      'publication/publication-metadata.ts',
      'publication/publisher.ts',
      'publication/sequenced/manifest-plan.ts',
      'publication/sequencer/port.ts',
      'storage/types.ts',
      'sync/coordinated/composition.ts',
      'sync/coordinated/ledger/model.ts',
      'sync/coordinated/policy/index.ts',
      'sync/coordinated/run-budget.ts',
    ]);
  });

  it('prepares one candidate and publishes it once, through the composed bridge only', () => {
    const publish = readSource('sync/coordinated/outcome/publish.ts');
    expect(
      publish.match(/runtime\.publication\.prepareCandidate\(/g),
    ).toHaveLength(1);
    expect(
      publish.match(/runtime\.publication\.publishCandidate\(/g),
    ).toHaveLength(1);
    for (const file of outcomeFiles()) {
      const code = readSource(file);
      expect(code, file).not.toMatch(
        /publishGuarded|new\s+CoordinatedSeasonPublication|\.publish\(|\.(prepare|finalize|cancel|seedCutover|activateCutover|rollback)\(|writeVersionedDocument|reconcilePublishedRevisions|publishedRevision:/,
      );
      expect(code, file).not.toMatch(
        /\bfetch\(|globalThis|process\.env|cloudflare:|Date\.now\(|new Date\(\)/,
      );
    }
  });
});
