/**
 * The policy and planner are implemented but not connected: only the dormant
 * observation orchestration imports them, no Worker module imports that, and
 * they reach no network, Cloudflare, publication or wall-clock global. The
 * coordinated runtime still stops at `ledger-unbound`.
 */

import { describe, expect, it } from 'vitest';

import { resolveReconciliationLedger } from '../../../../src/sync/coordinated/ledger-port';
import {
  importersOf,
  importsOf,
  readSource,
  sourceFiles,
} from '../source-graph';

const policyDir = 'sync/coordinated/policy/';
const read = readSource;
const policyFiles = () =>
  sourceFiles().filter((file) => file.startsWith(policyDir));

describe('the reconciliation policy is not connected', () => {
  it('is imported only by the dormant orchestration', () => {
    // Every relative import is resolved, so an import spelled from a sibling
    // directory (`../policy`) is found too. The observation orchestration is
    // itself imported by no Worker module (its own dormancy test), and the
    // outcome half only by it.
    // The one exception is the operator verification (PR-E3), which reads
    // the planner's eligibility rule (`cadence.ts`) and nothing else.
    expect(importersOf(policyDir)).toEqual([
      'sync/coordinated/observation/observe.ts',
      'sync/coordinated/observation/outcomes.ts',
      'sync/coordinated/observation/revisions.ts',
      'sync/coordinated/operator/verification.ts',
      'sync/coordinated/outcome/decisions.ts',
      'sync/coordinated/outcome/publish.ts',
    ]);
    expect(
      importsOf('sync/coordinated/operator/verification.ts').filter((file) =>
        file.startsWith(policyDir),
      ),
    ).toEqual(['sync/coordinated/policy/cadence.ts']);
    expect(importersOf('sync/coordinated/observation/')).toEqual([]);
    expect(importersOf('sync/coordinated/outcome/')).toEqual([
      'sync/coordinated/observation/observe.ts',
    ]);
    expect(resolveReconciliationLedger()).toBeNull();
  });

  it('depends on the ledger model and nothing else', () => {
    expect(policyFiles().length).toBeGreaterThan(0);
    for (const file of policyFiles()) {
      const specifiers = [...read(file).matchAll(/from '([^']+)'/g)].map(
        (match) => match[1]!,
      );
      for (const specifier of specifiers) {
        expect(
          specifier === '../ledger/model' || specifier.startsWith('./'),
          `${file}: ${specifier}`,
        ).toBe(true);
      }
    }
  });

  it('reads no clock, network, Cloudflare or environment global', () => {
    for (const file of policyFiles()) {
      const code = read(file);
      expect(code, file).not.toMatch(
        /Date\.now\(|new Date\(\)|performance\.now/,
      );
      expect(code, file).not.toMatch(
        /\bfetch\(|cloudflare:|globalThis|process\.env/,
      );
      expect(code, file).not.toMatch(/Math\.random|crypto\./);
    }
  });
});
