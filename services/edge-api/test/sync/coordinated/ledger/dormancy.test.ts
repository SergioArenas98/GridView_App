/**
 * The ledger storage foundation is dormant: the class is exported, and the
 * resolver reads an optional `RECONCILIATION_LEDGER` binding. Only the
 * committed staging configuration registers the class and declares the
 * binding, and that configuration has never been deployed. Development and
 * production declare neither, so there the resolver answers `null`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as entryPoint from '../../../../src/index';
import { ReconciliationLedger } from '../../../../src/sync/coordinated/ledger';
import { resolveReconciliationLedger } from '../../../../src/sync/coordinated/ledger-port';

const edgeApiRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
);
const sourceDir = join(edgeApiRoot, 'src');

function source(path: string): string {
  return readFileSync(join(edgeApiRoot, path), 'utf8');
}

function sourceFiles(): string[] {
  return (readdirSync(sourceDir, { recursive: true }) as string[])
    .map((entry) => entry.toString().split('\\').join('/'))
    .filter((file) => file.endsWith('.ts'));
}

/** Non-comment `wrangler.toml` lines: declarations, not prose. */
function declarations(): string {
  return source('wrangler.toml')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

describe('the reconciliation ledger is exported, resolvable and declared for staging only', () => {
  it('is a named export of the Worker entry point', () => {
    expect(entryPoint.ReconciliationLedger).toBe(ReconciliationLedger);
    expect(source('src/index.ts')).toContain(
      "export { ReconciliationLedger } from './sync/coordinated/ledger/durable-object';",
    );
  });

  it('is registered and bound in staging only, with no migration', () => {
    const declared = declarations();
    // The top-level registrations, which development and production inherit,
    // do not name it.
    expect(declared.match(/^\[exports\.[A-Za-z]+\]$/gm)).toEqual([
      '[exports.ProviderRateLimiter]',
      '[exports.SeasonPublicationSequencer]',
    ]);
    // Staging's own table restates both and adds the ledger.
    expect(declared.match(/^\[env\.[a-z]+\.exports\.[A-Za-z]+\]$/gm)).toEqual([
      '[env.staging.exports.ProviderRateLimiter]',
      '[env.staging.exports.SeasonPublicationSequencer]',
      '[env.staging.exports.ReconciliationLedger]',
    ]);
    expect(declared).toContain(
      '[[env.staging.durable_objects.bindings]]\nname = "RECONCILIATION_LEDGER"\nclass_name = "ReconciliationLedger"',
    );
    // Those two declarations are its only mentions.
    expect(declared.match(/ReconciliationLedger/g)).toHaveLength(2);
    expect(declared.match(/RECONCILIATION_LEDGER/g)).toHaveLength(1);
    expect(declared).not.toMatch(/migrations/);
  });

  it('keeps every committed provider mode and the daily cron unchanged', () => {
    const declared = declarations();
    expect(declared).toMatch(
      /\[env\.staging\.vars\][\s\S]*PROVIDER_MODE = "mock"/,
    );
    expect(declared).toMatch(
      /\[env\.production\.vars\][\s\S]*PROVIDER_MODE = "none"/,
    );
    expect(declared).not.toMatch(/PROVIDER_MODE = "coordinated"/);
    expect(declared).toContain('crons = ["17 3 * * *"]');
  });

  it('reads one optional Durable Object binding and no test hook', () => {
    const environment = source('src/config/environment.ts');
    expect(environment.match(/RECONCILIATION_LEDGER\??:.*$/gm)).toEqual([
      'RECONCILIATION_LEDGER?: DurableObjectNamespace;',
    ]);
    expect(environment).not.toMatch(/__RECONCILIATION/);
    // The Worker never reads the binding itself: it reaches the ledger only
    // through the resolver, with its env.
    expect(source('src/index.ts')).not.toMatch(
      /__RECONCILIATION|\.RECONCILIATION_LEDGER|\['RECONCILIATION_LEDGER'\]/,
    );
    expect(
      source('src/index.ts').match(/resolveReconciliationLedger\([^)]*\)/g),
    ).toEqual([
      'resolveReconciliationLedger(env)',
      'resolveReconciliationLedger(env)',
    ]);
  });

  it('answers null in development and production, neither of which binds it', () => {
    // Neither declares the binding (asserted above), so a Worker built from
    // either has no `RECONCILIATION_LEDGER` field.
    expect(resolveReconciliationLedger({})).toBeNull();
    expect(
      resolveReconciliationLedger({ RECONCILIATION_LEDGER: undefined }),
    ).toBeNull();
  });

  it('is constructed only inside its own package', () => {
    const constructions = [
      'new ReconciliationLedger(',
      'new DurableObjectReconciliationLedger(',
      'new LocalReconciliationLedger(',
      'new ReconciliationLedgerStore(',
    ];
    const sites = sourceFiles()
      .filter((file) => !file.startsWith('sync/coordinated/ledger/'))
      .flatMap((file) => {
        const contents = readFileSync(join(sourceDir, file), 'utf8');
        return constructions
          .filter((construction) => contents.includes(construction))
          .map((construction) => `${file}: ${construction}`);
      });
    expect(sites).toEqual([]);
  });

  it('imports neither provider package, so it reaches no provider', () => {
    for (const file of sourceFiles().filter((name) =>
      name.startsWith('sync/coordinated/ledger/'),
    )) {
      const contents = readFileSync(join(sourceDir, file), 'utf8');
      expect(contents, file).not.toMatch(/providers\//);
      // Its only outbound call is the namespace stub's `fetch`.
      expect(contents, file).not.toMatch(
        /globalThis\.fetch|await fetch\(|=> fetch\(/,
      );
    }
  });
});
