/**
 * The operator package is dormant (PR-E1): nothing imports it, it reaches no
 * provider, Cloudflare or environment global, and its only way to publish is
 * the rollback command a caller hands it. The OD-8 backlog levels are pure.
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

describe('the operator package is not connected', () => {
  it('is imported by nothing, and the ledger is still unbound', () => {
    expect(operatorFiles()).toEqual([
      'sync/coordinated/operator/attention.ts',
      'sync/coordinated/operator/index.ts',
      'sync/coordinated/operator/rollback.ts',
    ]);
    expect(importersOf(operatorDir)).toEqual([]);
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
      'publication/publisher.ts',
      'runtime/clock.ts',
      'sync/coordinated/ledger-port.ts',
      'sync/coordinated/ledger/model.ts',
    ]);
  });

  it('publishes only through the rollback it is handed, and reads no global', () => {
    for (const file of operatorFiles()) {
      const code = readSource(file);
      expect(code, file).not.toMatch(
        /publishGuarded|\.publish\(|\.(prepare|finalize|cancel|seedCutover|activateCutover)\(|\.commit\(|\.dispose\(|\.operate\(/,
      );
      expect(code, file).not.toMatch(
        /\bfetch\(|globalThis|process\.env|cloudflare:|Date\.now\(|new Date\(\)/,
      );
    }
    const rollback = readSource('sync/coordinated/operator/rollback.ts');
    expect(rollback.match(/dependencies\.rollback\(/g)).toHaveLength(2);
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
