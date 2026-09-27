/**
 * The policy and planner are implemented but not connected: no Worker module
 * imports them, and they reach no network, Cloudflare, publication or
 * wall-clock global. The coordinated runtime still stops at `ledger-unbound`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveReconciliationLedger } from '../../../../src/sync/coordinated/ledger-port';

const sourceDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'src',
);
const policyDir = 'sync/coordinated/policy/';

function sourceFiles(): string[] {
  return (readdirSync(sourceDir, { recursive: true }) as string[])
    .map((entry) => entry.toString().split('\\').join('/'))
    .filter((file) => file.endsWith('.ts'));
}

const read = (file: string) => readFileSync(join(sourceDir, file), 'utf8');
const policyFiles = () =>
  sourceFiles().filter((file) => file.startsWith(policyDir));

describe('the reconciliation policy is not connected', () => {
  it('is imported by no Worker module', () => {
    const importers = sourceFiles()
      .filter((file) => !file.startsWith(policyDir))
      .filter((file) =>
        /from '[^']*coordinated\/policy|from '\.\/policy/.test(read(file)),
      );
    expect(importers).toEqual([]);
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
