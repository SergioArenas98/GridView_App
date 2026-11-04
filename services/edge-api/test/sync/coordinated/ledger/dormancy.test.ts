/**
 * The ledger storage foundation is dormant outside the environments allowed
 * the automatic path: the class is exported, and the resolver reads an
 * optional `RECONCILIATION_LEDGER` binding, but no committed configuration
 * declares, registers or binds it outside the isolated demonstration Worker
 * (`[env.e2e]`, gate AU-3) and staging (gate AU-4), so the resolver answers
 * `null` in development and production.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as entryPoint from '../../../../src/index';
import { ReconciliationLedger } from '../../../../src/sync/coordinated/ledger';
import { resolveReconciliationLedger } from '../../../../src/sync/coordinated/ledger-port';
import {
  STAGING_CRONS_LINE,
  demonstrationSection,
  environmentSection,
  withoutAutomatic,
  withoutStaging,
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

describe('the reconciliation ledger is exported, resolvable and bound only by the demonstration Worker and staging', () => {
  it('is a named export of the Worker entry point', () => {
    expect(entryPoint.ReconciliationLedger).toBe(ReconciliationLedger);
    expect(source('src/index.ts')).toContain(
      "export { ReconciliationLedger } from './sync/coordinated/ledger/durable-object';",
    );
  });

  it('is declared by no exports entry, migration or binding outside the demonstration Worker and staging', () => {
    const declared = declarations();
    const elsewhere = withoutAutomatic(declared);
    expect(elsewhere).not.toMatch(/ReconciliationLedger/);
    expect(elsewhere).not.toMatch(/RECONCILIATION/i);
    expect(declared).not.toMatch(/\[\[migrations\]\]/);
    // The two existing top-level registrations are the only ones there.
    expect(declared.match(/^\[exports\.[A-Za-z]+\]$/gm)).toEqual([
      '[exports.ProviderRateLimiter]',
      '[exports.SeasonPublicationSequencer]',
    ]);
    // The demonstration Worker and staging each register the class and bind
    // it once.
    for (const name of ['e2e', 'staging']) {
      const section = environmentSection(declared, name);
      expect(section.match(/ReconciliationLedger/g), name).toHaveLength(2);
      expect(section, name).toContain(
        `[env.${name}.exports.ReconciliationLedger]`,
      );
      expect(section, name).toContain(
        'name = "RECONCILIATION_LEDGER"\nclass_name = "ReconciliationLedger"',
      );
    }
  });

  it('keeps every committed provider mode but the demonstration Worker and staging off the coordinated path, and schedules staging alone', () => {
    const declared = declarations();
    // Staging: `mock`, then `none` from the season-batch ingest
    // configuration, then `coordinated` at gate AU-4. Production stays off.
    expect(declared).toMatch(
      /\[env\.staging\.vars\]\nENVIRONMENT = "staging"\nPROVIDER_MODE = "coordinated"\n/,
    );
    expect(declared).toMatch(
      /\[env\.production\.vars\][\s\S]*PROVIDER_MODE = "none"/,
    );
    expect(withoutAutomatic(declared)).not.toMatch(
      /PROVIDER_MODE = "coordinated"/,
    );
    expect(demonstrationSection(declared)).toContain(
      'PROVIDER_MODE = "coordinated"',
    );
    // Only staging schedules a run, hourly (AU-4 step 3). Production and the
    // demonstration Worker (since AU-3 passed) keep an explicit empty list.
    expect(environmentSection(declared, 'staging')).toContain(
      STAGING_CRONS_LINE,
    );
    expect(withoutStaging(declared)).not.toMatch(/crons = \[\s*"/);
    expect(environmentSection(declared, 'production')).toContain('crons = []');
    expect(demonstrationSection(declared)).toContain('crons = []');
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
    // No committed environment but the demonstration Worker and staging
    // declares the binding (asserted above), so a Worker built from any other
    // has no `RECONCILIATION_LEDGER` field.
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
