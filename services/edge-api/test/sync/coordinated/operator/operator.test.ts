/**
 * The operator package is connected exactly where PR-E2 and PR-E3 connect
 * it: the admin reconciliation routes (transitions, the hold-gated rollback
 * and the verification) and the observation orchestration (the attention
 * line, `attention.ts` alone). It reaches no Cloudflare or environment
 * global, and a provider only through the composed runtime's one
 * classification request. Its only writes are the ledger's own `operate`,
 * `dispose` and `verify`, and its only way to publish is the rollback
 * command a caller hands it. The OD-8 levels are pure.
 */

import { describe, expect, it } from 'vitest';

import {
  BACKLOG_CAPACITY,
  BACKLOG_WARNING_THRESHOLD,
} from '../../../../src/sync/coordinated/ledger';
import { resolveReconciliationLedger } from '../../../../src/sync/coordinated/ledger-port';
import { backlogAttention } from '../../../../src/sync/coordinated/operator';
import {
  importersOf,
  importsOf,
  readSource,
  sourceFiles,
} from '../source-graph';

const operatorDir = 'sync/coordinated/operator/';
const operatorFiles = () =>
  sourceFiles().filter((file) => file.startsWith(operatorDir));

describe('the operator package is connected only where PR-E2 connects it', () => {
  it('is imported by the reconciliation routes, the orchestration and the entry gate alone, and the ledger is still unbound', () => {
    expect(operatorFiles()).toEqual([
      'sync/coordinated/operator/actions.ts',
      'sync/coordinated/operator/attention.ts',
      'sync/coordinated/operator/comparison.ts',
      'sync/coordinated/operator/index.ts',
      'sync/coordinated/operator/lease.ts',
      'sync/coordinated/operator/rollback.ts',
      'sync/coordinated/operator/verification.ts',
    ]);
    expect(importersOf(operatorDir)).toEqual([
      'admin/reconciliation-requests.ts',
      'admin/reconciliation-routes.ts',
      'admin/reconciliation-view.ts',
      'sync/coordinated/observation/observe.ts',
      'sync/coordinated/run.ts',
    ]);
    // Both read only the attention line: the orchestration after a run, the
    // entry gate after a refused scheduled run with a ledger bound.
    for (const reader of [
      'sync/coordinated/observation/observe.ts',
      'sync/coordinated/run.ts',
    ]) {
      expect(
        importsOf(reader).filter((file) => file.startsWith(operatorDir)),
        reader,
      ).toEqual(['sync/coordinated/operator/attention.ts']);
    }
    expect(resolveReconciliationLedger()).toBeNull();
  });

  it('depends on exactly these modules', () => {
    const outside = new Set<string>();
    for (const file of operatorFiles()) {
      for (const imported of importsOf(file)) {
        if (!imported.startsWith(operatorDir)) outside.add(imported);
      }
    }
    expect([...outside].sort()).toEqual([
      'contract/types.ts',
      'contract/validation.ts',
      'logging/logger.ts',
      'publication/guard/predecessor.ts',
      'publication/publisher.ts',
      'publication/sequencer/port.ts',
      'publication/snapshot-revision.ts',
      'runtime/clock.ts',
      'storage/types.ts',
      'sync/coordinated/classification-revision.ts',
      'sync/coordinated/composition.ts',
      'sync/coordinated/ledger-port.ts',
      'sync/coordinated/ledger/model.ts',
      'sync/coordinated/ledger/verification.ts',
      'sync/coordinated/policy/cadence.ts',
    ]);
    // The verification reads the planner's eligibility rule and nothing else
    // of the policy, and reaches a provider only through the composition.
    expect(
      importsOf('sync/coordinated/operator/verification.ts').filter(
        (file) =>
          file.startsWith('sync/coordinated/policy/') ||
          file.startsWith('providers/') ||
          file.startsWith('sync/coordinated/observation/') ||
          file.startsWith('sync/coordinated/outcome/'),
      ),
    ).toEqual(['sync/coordinated/policy/cadence.ts']);
  });

  it('writes only through operate, dispose, verify and rotateVerifications, publishes only through the rollback it is handed, and reads no global', () => {
    for (const file of operatorFiles()) {
      const code = readSource(file);
      expect(code, file).not.toMatch(
        /publishGuarded|\.publish\(|\.(prepare|finalize|cancel|seedCutover|activateCutover)\(|\.commit\(|\.reconcilePublishedRevisions\(/,
      );
      expect(code, file).not.toMatch(
        /\bfetch\(|globalThis|process\.env|cloudflare:|Date\.now\(|new Date\(\)/,
      );
    }
    const writers = operatorFiles().filter((file) =>
      /\.(operate|dispose|verify|rotateVerifications)\(/.test(readSource(file)),
    );
    expect(writers).toEqual([
      'sync/coordinated/operator/actions.ts',
      'sync/coordinated/operator/verification.ts',
    ]);
    // One verification: one classification request, one ledger write.
    const verification = readSource(
      'sync/coordinated/operator/verification.ts',
    );
    expect(verification.match(/ledger\.verify\(/g)).toHaveLength(1);
    expect(verification.match(/requestClassification\(/g)).toHaveLength(1);
    expect(verification).not.toMatch(/\.(operate|dispose)\(/);
    // The comparison only reads.
    const comparison = readSource('sync/coordinated/operator/comparison.ts');
    expect(comparison).not.toMatch(
      /\.(put|write\w*|delete|commit|verify|operate|dispose)\(/,
    );
    const actions = readSource('sync/coordinated/operator/actions.ts');
    expect(actions.match(/ledger\.operate\(/g)).toHaveLength(1);
    expect(actions.match(/ledger\.dispose\(/g)).toHaveLength(1);
    // PR-E4: one rotation, one ledger write, and no provider request.
    expect(actions.match(/ledger\.rotateVerifications\(/g)).toHaveLength(1);
    expect(actions).not.toMatch(
      /requestClassification|composeCoordinatedRuntime/,
    );
    expect(verification).not.toMatch(/rotateVerifications\(/);
    const rollback = readSource('sync/coordinated/operator/rollback.ts');
    expect(rollback.match(/dependencies\.rollback\(/g)).toHaveLength(2);
    // The attention signal reads once and writes nothing.
    const attention = readSource('sync/coordinated/operator/attention.ts');
    expect(attention.match(/ledger\.\w+\(/g)).toEqual(['ledger.readSeason(']);
  });
});

describe('the backlog levels (OD-8)', () => {
  it('warn at 48 of the 60 slots, and again at capacity', () => {
    expect(BACKLOG_WARNING_THRESHOLD).toBe(48);
    expect(BACKLOG_CAPACITY).toBe(60);
    expect(
      [0, 47, 48, 59, 60].map((count) => [count, backlogAttention(count)]),
    ).toEqual([
      [0, 'normal'],
      [47, 'normal'],
      [48, 'warning'],
      [59, 'warning'],
      [60, 'full'],
    ]);
  });
});
