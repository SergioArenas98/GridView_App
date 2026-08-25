/**
 * Acknowledgements are governance records, never coverage.
 *
 * An acknowledgement may document "observed, but no canonical GridView target
 * exists". It must never come to mean "coverage accepted, so synchronization
 * may continue". These tests pin that distinction from the runtime side; the
 * validator side is pinned in `test/scripts/provider-mapping-rules.test.mjs`.
 *
 * The closed-reason assertions fail on commit 0eca498, where `reason` was
 * free-form bounded text and any sentence satisfied the coverage rule.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { key, realRegistry, SEASON } from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');
const registry = realRegistry();

interface Acknowledgement {
  source: string;
  entity: string;
  providerField: string;
  providerValue: string | number;
  reason: string;
  detail?: string;
}

const corpus = JSON.parse(
  readFileSync(
    join(
      repoRoot,
      'content',
      'seasons',
      '2026',
      'provider-evidence.development.json',
    ),
    'utf8',
  ),
) as { acknowledgedUnmapped: Acknowledgement[] };

const schema = JSON.parse(
  readFileSync(
    join(repoRoot, 'content', 'schemas', 'provider-evidence.schema.json'),
    'utf8',
  ),
) as {
  $defs: { acknowledgement: { properties: { reason: { enum?: string[] } } } };
};

describe('an acknowledgement reason is a closed set', () => {
  it('is an enum in the schema, not free text', () => {
    const reason = schema.$defs.acknowledgement.properties.reason;
    expect(Array.isArray(reason.enum)).toBe(true);
    expect(reason.enum?.length).toBeGreaterThan(0);
    // Free-form prose is not a reason.
    expect(reason).not.toHaveProperty('$ref');
  });

  it('uses only declared reasons in the curated corpus', () => {
    const allowed = new Set(
      schema.$defs.acknowledgement.properties.reason.enum,
    );
    expect(corpus.acknowledgedUnmapped.length).toBeGreaterThan(0);
    for (const record of corpus.acknowledgedUnmapped) {
      expect(allowed.has(record.reason), record.reason).toBe(true);
    }
  });

  /**
   * Fails on 8f419e0, where the enum also offered
   * `provider-value-not-yet-evidenced` - a *field-level* reason meaning "no
   * approved exact value exists to map". Every acknowledgement here describes
   * one exact observed identity and must correspond to an entry in
   * `identities`, so that reason could only ever be attached to a record that
   * contradicts it, and validation accepted the contradiction. Field-level
   * gaps such as the uncurated OpenF1 `circuit_key` are tracked as G-l.
   */
  it('offers only reasons its shape can truthfully express', () => {
    const reasons = schema.$defs.acknowledgement.properties.reason.enum ?? [];
    expect(reasons).toEqual([
      'no-canonical-gridview-identity',
      'identity-pending-curation-review',
    ]);
    expect(reasons).not.toContain('provider-value-not-yet-evidenced');
  });

  it('keeps the human explanation in a separate detail field', () => {
    for (const record of corpus.acknowledgedUnmapped) {
      expect(record.detail, JSON.stringify(record)).toBeTruthy();
      expect(String(record.detail).length).toBeGreaterThan(40);
    }
  });
});

describe('an acknowledged identity still fails closed at runtime', () => {
  it('resolves as unmapped, never as resolved', () => {
    // Every acknowledged identity in the curated corpus.
    const checks: readonly [
      'driver' | 'constructor' | 'circuit',
      Record<string, unknown>,
    ][] = corpus.acknowledgedUnmapped.map((record) => [
      record.entity as 'driver' | 'constructor' | 'circuit',
      {
        season: SEASON,
        source: record.source,
        entity: record.entity,
        providerField: record.providerField,
        providerValue: record.providerValue,
      },
    ]);

    expect(checks.length).toBe(5);
    for (const [, lookup] of checks) {
      const result = registry.resolveUnknown(lookup);
      expect(result.outcome, JSON.stringify(lookup)).toBe('unresolved');
      if (result.outcome !== 'unresolved') throw new Error('unreachable');
      // An acknowledgement is not a mapping: the reason is a plain curation
      // gap, and nothing in the runtime knows the acknowledgement exists.
      expect(result.failure.reason).toBe('unmapped');
    }
  });

  it('does not expose acknowledgements to the runtime at all', () => {
    // The registry is built from provider-mappings only. Nothing in the
    // resolver's public surface can report "acknowledged", so a future adapter
    // cannot mistake it for a resolved identity.
    const result = registry.resolve(
      key<'constructor'>({
        season: SEASON,
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: 'Cadillac',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('acknowledg');
    expect(JSON.stringify(result)).not.toContain('no-canonical');
  });
});
