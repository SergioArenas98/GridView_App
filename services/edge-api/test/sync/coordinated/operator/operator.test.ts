/**
 * The operator package is connected exactly where PR-E2 connects it: the
 * admin reconciliation routes (transitions and the hold-gated rollback) and
 * the observation orchestration (the attention line, `attention.ts` alone).
 * It reaches no provider, Cloudflare or environment global. Its only writes
 * are the ledger's own `operate` and `dispose`, and its only way to publish
 * is the rollback command a caller hands it. The OD-8 levels are pure.
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
  it('is imported by the reconciliation routes and the orchestration alone, and the ledger is still unbound', () => {
    expect(operatorFiles()).toEqual([
      'sync/coordinated/operator/actions.ts',
      'sync/coordinated/operator/attention.ts',
      'sync/coordinated/operator/index.ts',
      'sync/coordinated/operator/lease.ts',
      'sync/coordinated/operator/rollback.ts',
    ]);
    expect(importersOf(operatorDir)).toEqual([
      'admin/reconciliation-requests.ts',
      'admin/reconciliation-routes.ts',
      'admin/reconciliation-view.ts',
      'sync/coordinated/observation/observe.ts',
    ]);
    expect(importsOf('sync/coordinated/observation/observe.ts')).toContain(
      'sync/coordinated/operator/attention.ts',
    );
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
      'logging/logger.ts',
      'publication/publisher.ts',
      'runtime/clock.ts',
      'sync/coordinated/ledger-port.ts',
      'sync/coordinated/ledger/model.ts',
    ]);
  });

  it('writes only through operate and dispose, publishes only through the rollback it is handed, and reads no global', () => {
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
      /\.(operate|dispose)\(/.test(readSource(file)),
    );
    expect(writers).toEqual(['sync/coordinated/operator/actions.ts']);
    const actions = readSource('sync/coordinated/operator/actions.ts');
    expect(actions.match(/ledger\.operate\(/g)).toHaveLength(1);
    expect(actions.match(/ledger\.dispose\(/g)).toHaveLength(1);
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
