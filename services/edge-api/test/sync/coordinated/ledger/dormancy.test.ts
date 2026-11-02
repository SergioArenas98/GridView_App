/**
 * The ledger storage foundation is dormant: the class is exported, and the
 * resolver reads an optional `RECONCILIATION_LEDGER` binding, but no committed
 * configuration declares, registers or binds it outside the isolated
 * demonstration Worker (`[env.e2e]`, gate AU-3), so the resolver answers
 * `null` in development, staging and production.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as entryPoint from '../../../../src/index';
import { ReconciliationLedger } from '../../../../src/sync/coordinated/ledger';
import { resolveReconciliationLedger } from '../../../../src/sync/coordinated/ledger-port';
import {
  demonstrationSection,
  withoutDemonstration,
} from '../../../config/demonstration-environment';

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

describe('the reconciliation ledger is exported, resolvable and bound only by the demonstration Worker', () => {
  it('is a named export of the Worker entry point', () => {
    expect(entryPoint.ReconciliationLedger).toBe(ReconciliationLedger);
    expect(source('src/index.ts')).toContain(
      "export { ReconciliationLedger } from './sync/coordinated/ledger/durable-object';",
    );
  });

  it('is declared by no exports entry, migration or binding outside the demonstration Worker', () => {
    const declared = declarations();
    const elsewhere = withoutDemonstration(declared);
    expect(elsewhere).not.toMatch(/ReconciliationLedger/);
    expect(elsewhere).not.toMatch(/RECONCILIATION/i);
    expect(declared).not.toMatch(/\[\[migrations\]\]/);
    // The two existing top-level registrations are the only ones there.
    expect(declared.match(/^\[exports\.[A-Za-z]+\]$/gm)).toEqual([
      '[exports.ProviderRateLimiter]',
      '[exports.SeasonPublicationSequencer]',
    ]);
    // The demonstration Worker registers the class and binds it once.
    const demonstration = demonstrationSection(declared);
    expect(demonstration.match(/ReconciliationLedger/g)).toHaveLength(2);
    expect(demonstration).toContain('[env.e2e.exports.ReconciliationLedger]');
    expect(demonstration).toContain(
      'name = "RECONCILIATION_LEDGER"\nclass_name = "ReconciliationLedger"',
    );
  });

  it('keeps every committed provider mode but the demonstration Worker off the coordinated path, and schedules nothing', () => {
    const declared = declarations();
    // `none` since the staging season-batch ingest configuration (`mock`
    // before); both stay off the coordinated path.
    expect(declared).toMatch(
      /\[env\.staging\.vars\]\nENVIRONMENT = "staging"\nPROVIDER_MODE = "none"\n/,
    );
    expect(declared).toMatch(
      /\[env\.production\.vars\][\s\S]*PROVIDER_MODE = "none"/,
    );
    expect(withoutDemonstration(declared)).not.toMatch(
      /PROVIDER_MODE = "coordinated"/,
    );
    expect(demonstrationSection(declared)).toContain(
      'PROVIDER_MODE = "coordinated"',
    );
    // The staging cron was removed (an explicit empty list) by the same
    // configuration; no environment schedules a run except the demonstration
    // Worker, hourly for gate AU-3.
    expect(declared).toContain('crons = []');
    expect(withoutDemonstration(declared)).not.toMatch(/crons = \[\s*"/);
    expect(demonstrationSection(declared)).toContain('crons = ["17 * * * *"]');
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

  it('answers null in development, staging and production, none of which binds it', () => {
    // No committed environment but the demonstration Worker declares the
    // binding (asserted above), so a Worker built from any other has no
    // `RECONCILIATION_LEDGER` field.
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
