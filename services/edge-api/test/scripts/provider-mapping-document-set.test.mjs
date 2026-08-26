/**
 * One canonical seasonal document of each kind, paired one-to-one.
 *
 * Every test here fails on commit 4fa738d, where `validate-content.mjs` paired
 * evidence to mappings with `.find()`. Two structurally valid
 * `provider-mappings` files declaring the same season meant only the first was
 * coverage-checked: the second was target-validated in isolation, its mappings
 * were never checked against the evidence corpus, and the reverse check passed
 * merely because *some* evidence document had that season. `validate:content`
 * could therefore accept mappings absent from approved evidence, while the
 * runtime imports only the canonical file — the exact divergence the registry
 * exists to prevent.
 *
 * These call the production rule directly, so no temporary content tree is
 * created and the algorithm is not reproduced in a test helper.
 */

import { describe, expect, it } from 'vitest';

import { validateSeasonalDocumentSet } from '../../scripts/lib/provider-mapping-rules.mjs';

const mappingRecord = {
  source: 'jolpica',
  entity: 'driver',
  providerField: 'driverId',
  providerValue: 'norris',
  gridviewId: 'lando-norris',
  evidence: 'fixture',
};

const otherRecord = {
  source: 'jolpica',
  entity: 'constructor',
  providerField: 'constructorId',
  providerValue: 'mclaren',
  gridviewId: 'mclaren',
  evidence: 'fixture',
};

const mappingDoc = (label, season, mappings) => ({
  label,
  data: { kind: 'provider-mappings', schemaVersion: 2, season, mappings },
});

const evidenceDoc = (label, season) => ({
  label,
  data: {
    kind: 'provider-evidence',
    schemaVersion: 1,
    season,
    identities: [],
    acknowledgedUnmapped: [],
  },
});

const messages = (result) => result.problems.map((problem) => problem.message);

describe('duplicate seasonal mapping documents are rejected', () => {
  // Case 1
  it('rejects two valid 2026 mapping documents with disjoint entries', () => {
    const result = validateSeasonalDocumentSet(
      [
        mappingDoc('a.json', 2026, [mappingRecord]),
        mappingDoc('b.json', 2026, [otherRecord]),
      ],
      [evidenceDoc('e.json', 2026)],
    );

    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].message).toMatch(
      /season 2026 has 2 provider-mappings documents/,
    );
    // Both offending paths are named, so the error is actionable.
    expect(result.problems[0].message).toContain('a.json');
    expect(result.problems[0].message).toContain('b.json');
  });

  // Case 2
  it('fails identically with the inputs in reverse order', () => {
    const forward = validateSeasonalDocumentSet(
      [
        mappingDoc('a.json', 2026, [mappingRecord]),
        mappingDoc('b.json', 2026, [otherRecord]),
      ],
      [evidenceDoc('e.json', 2026)],
    );
    const reversed = validateSeasonalDocumentSet(
      [
        mappingDoc('b.json', 2026, [otherRecord]),
        mappingDoc('a.json', 2026, [mappingRecord]),
      ],
      [evidenceDoc('e.json', 2026)],
    );

    // Deterministic regardless of file-discovery order.
    expect(messages(reversed)).toEqual(messages(forward));
  });

  // Case 3
  it('fails before coverage can be bypassed by a second document', () => {
    // `b.json` carries a mapping absent from the evidence corpus. On 4fa738d
    // it was never coverage-checked at all.
    const result = validateSeasonalDocumentSet(
      [
        mappingDoc('a.json', 2026, [mappingRecord]),
        mappingDoc('b.json', 2026, [otherRecord]),
      ],
      [evidenceDoc('e.json', 2026)],
    );
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.problems[0].message).toMatch(/exactly one is allowed/);
  });

  // Case 4
  it('rejects one empty and one populated 2026 document', () => {
    const result = validateSeasonalDocumentSet(
      [
        mappingDoc('empty.json', 2026, []),
        mappingDoc('full.json', 2026, [mappingRecord]),
      ],
      [evidenceDoc('e.json', 2026)],
    );
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].message).toMatch(/2 provider-mappings documents/);
  });

  // Case 5
  it('rejects two identical 2026 documents', () => {
    const result = validateSeasonalDocumentSet(
      [
        mappingDoc('one.json', 2026, [mappingRecord]),
        mappingDoc('two.json', 2026, [mappingRecord]),
      ],
      [evidenceDoc('e.json', 2026)],
    );
    expect(result.problems).toHaveLength(1);
  });

  // Case 6
  it('rejects two evidence documents for 2026', () => {
    const result = validateSeasonalDocumentSet(
      [mappingDoc('m.json', 2026, [mappingRecord])],
      [evidenceDoc('e1.json', 2026), evidenceDoc('e2.json', 2026)],
    );
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].message).toMatch(
      /season 2026 has 2 provider-evidence documents/,
    );
  });

  it('reports every duplicate season when several exist', () => {
    const result = validateSeasonalDocumentSet(
      [
        mappingDoc('a26.json', 2026, []),
        mappingDoc('b26.json', 2026, []),
        mappingDoc('a27.json', 2027, []),
        mappingDoc('b27.json', 2027, []),
      ],
      [evidenceDoc('e26.json', 2026), evidenceDoc('e27.json', 2027)],
    );
    expect(result.problems).toHaveLength(2);
    // Deterministic season order.
    expect(result.problems[0].message).toMatch(/season 2026/);
    expect(result.problems[1].message).toMatch(/season 2027/);
  });
});

describe('mapping and evidence documents pair one-to-one', () => {
  // Case 7
  it('rejects a mapping document with no evidence document', () => {
    const result = validateSeasonalDocumentSet(
      [mappingDoc('m.json', 2026, [mappingRecord])],
      [],
    );
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].message).toMatch(
      /no provider-evidence corpus exists for season 2026/,
    );
  });

  // Case 8
  it('rejects an evidence document with no mapping document', () => {
    const result = validateSeasonalDocumentSet(
      [],
      [evidenceDoc('e.json', 2026)],
    );
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].message).toMatch(
      /no provider-mappings document exists for season 2026/,
    );
  });

  // Case 9
  it('accepts one mapping and one evidence document for 2026', () => {
    const result = validateSeasonalDocumentSet(
      [mappingDoc('m.json', 2026, [mappingRecord])],
      [evidenceDoc('e.json', 2026)],
    );
    expect(result.problems).toEqual([]);
    expect(result.mappingsBySeason.get(2026)).toHaveLength(1);
  });

  // Case 10
  it('accepts paired sets for two different seasons', () => {
    const result = validateSeasonalDocumentSet(
      [
        mappingDoc('m26.json', 2026, [mappingRecord]),
        mappingDoc('m27.json', 2027, [otherRecord]),
      ],
      [evidenceDoc('e26.json', 2026), evidenceDoc('e27.json', 2027)],
    );
    expect(result.problems).toEqual([]);
    expect(result.mappingsBySeason.get(2026)).toHaveLength(1);
    expect(result.mappingsBySeason.get(2027)).toHaveLength(1);
  });

  it('names only seasons and file paths, never document contents', () => {
    const result = validateSeasonalDocumentSet(
      [
        mappingDoc('a.json', 2026, [mappingRecord]),
        mappingDoc('b.json', 2026, [otherRecord]),
      ],
      [evidenceDoc('e.json', 2026)],
    );
    for (const problem of result.problems) {
      expect(problem.message).not.toContain('norris');
      expect(problem.message).not.toContain('lando-norris');
      expect(problem.message).not.toContain('gridviewId');
      expect(problem.message.length).toBeLessThan(300);
    }
  });
});
