/**
 * The publication half is implemented, injected and not connected.
 *
 * Only the injected orchestration imports it, no Worker module reaches
 * either, the coordinated entry point still refuses every run as
 * `ledger-unbound`, and it reaches publication only through the bridge the
 * composition built: one prepared candidate, one guarded publication. Bundle
 * reachability is proven by the bundler in
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

const outcomeDir = 'sync/coordinated/outcome/';
const outcomeFiles = () =>
  sourceFiles().filter((file) => file.startsWith(outcomeDir));

describe('the publication half is not connected', () => {
  it('is imported only by the injected orchestration', () => {
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
    expect(importersOf('sync/coordinated/observation/')).toEqual([]);
    expect(resolveReconciliationLedger()).toBeNull();
    // The coordinated entry point is unchanged: it composes, and stops.
    expect(importsOf('sync/coordinated/run.ts')).toEqual([
      'logging/logger.ts',
      'sync/coordinated/composition.ts',
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
