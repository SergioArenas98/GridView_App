/**
 * Curated coverage of the approved evidence corpus.
 *
 * Required cases 48-50; case 51 lives in
 * test/scripts/provider-mapping-rules.test.mjs, next to the validator rules it
 * exercises. These read the checked-in content only; no test here
 * contacts a provider or depends on the current Formula 1 season.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  canonicalKey,
  decodeProviderMappingKey,
  type ProviderMappingKey,
} from '../../../src/providers/mappings';

import { canonical, realRegistry, key, SEASON } from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');

function readContent<T>(...segments: string[]): T {
  return JSON.parse(readFileSync(join(repoRoot, ...segments), 'utf8')) as T;
}

interface EvidenceRecord {
  source: string;
  entity: string;
  providerField: string;
  providerValue: string | number;
  evidence?: string;
  reason?: string;
  detail?: string;
}

interface Corpus {
  season: number;
  identities: EvidenceRecord[];
  acknowledgedUnmapped: EvidenceRecord[];
}

interface MappingDocument {
  season: number;
  mappings: (EvidenceRecord & { gridviewId: string })[];
}

const corpus = readContent<Corpus>(
  'content',
  'seasons',
  '2026',
  'provider-evidence.development.json',
);
const document = readContent<MappingDocument>(
  'content',
  'seasons',
  '2026',
  'provider-mappings.development.json',
);
const registry = realRegistry();

function toKey(record: EvidenceRecord, season: number): ProviderMappingKey {
  const decoded = decodeProviderMappingKey({ ...record, season });
  if (!decoded.ok) {
    throw new Error(
      `corpus record is not a valid provider key (${decoded.problem}): ` +
        JSON.stringify(record),
    );
  }
  return decoded.key;
}

describe('every approved provider identity is accounted for', () => {
  it('the corpus and the registry describe the same season', () => {
    expect(corpus.season).toBe(SEASON);
    expect(document.season).toBe(SEASON);
  });

  // Case 48
  it('has exactly one applicable decision for every approved identity', () => {
    const mapped = new Set(
      document.mappings.map((record) => canonicalKey(toKey(record, SEASON))),
    );
    const acknowledged = new Set(
      corpus.acknowledgedUnmapped.map((record) =>
        canonicalKey(toKey(record, SEASON)),
      ),
    );

    expect(corpus.identities.length).toBeGreaterThan(0);

    for (const identity of corpus.identities) {
      const encoded = canonicalKey(toKey(identity, SEASON));
      const decisions =
        (mapped.has(encoded) ? 1 : 0) + (acknowledged.has(encoded) ? 1 : 0);
      expect(
        decisions,
        `${identity.source}.${identity.providerField} = ${JSON.stringify(
          identity.providerValue,
        )} must be either mapped or acknowledged, never both and never neither`,
      ).toBe(1);
    }

    // Nothing is mapped that the corpus never recorded: every curated value
    // traces back to evidence already in the repository.
    const known = new Set(
      corpus.identities.map((record) => canonicalKey(toKey(record, SEASON))),
    );
    for (const encoded of mapped) expect(known.has(encoded)).toBe(true);
    for (const encoded of acknowledged) expect(known.has(encoded)).toBe(true);
  });

  it('records a closed reason and written detail for every coverage gap', () => {
    expect(corpus.acknowledgedUnmapped.length).toBeGreaterThan(0);
    for (const record of corpus.acknowledgedUnmapped) {
      // The reason is a closed enum member, so an acknowledgement cannot be
      // turned into an arbitrary coverage excuse; the prose lives in detail.
      expect(record.reason, JSON.stringify(record)).toBeTruthy();
      expect(String(record.detail).length).toBeGreaterThan(40);
    }
  });

  it('records provenance for every curated mapping', () => {
    for (const record of document.mappings) {
      expect(record.evidence, JSON.stringify(record)).toBeTruthy();
      // Provenance points inside the repository, never at a contract,
      // credential or confidential document.
      expect(String(record.evidence)).toMatch(/GridView_Provider_Evaluation/);
    }
  });

  // Case 49
  it('points every mapped target at an existing canonical identity', () => {
    for (const record of document.mappings) {
      const entity = record.entity as 'driver' | 'constructor' | 'circuit';
      expect(
        canonical[entity].has(record.gridviewId),
        `${record.gridviewId} must exist in the curated ${entity} registry`,
      ).toBe(true);
    }
  });

  // Case 50
  it('regression-pins the four recorded constructor-name disagreements', () => {
    const pairs: readonly {
      openF1: string;
      jolpicaName: string;
      target: string | null;
    }[] = [
      { openF1: 'Alpine', jolpicaName: 'Alpine F1 Team', target: 'alpine' },
      { openF1: 'Cadillac', jolpicaName: 'Cadillac F1 Team', target: null },
      { openF1: 'Racing Bulls', jolpicaName: 'RB F1 Team', target: null },
      {
        openF1: 'Red Bull Racing',
        jolpicaName: 'Red Bull',
        target: 'red-bull',
      },
    ];

    for (const pair of pairs) {
      // Every pair is recorded in the corpus, so none can be dropped silently.
      expect(
        corpus.identities.some(
          (identity) =>
            identity.source === 'openf1' &&
            identity.providerField === 'team_name' &&
            identity.providerValue === pair.openF1,
        ),
        `${pair.openF1} must stay in the approved evidence corpus`,
      ).toBe(true);

      const result = registry.resolve(
        key<'constructor'>({
          season: SEASON,
          source: 'openf1',
          entity: 'constructor',
          providerField: 'team_name',
          providerValue: pair.openF1,
        }),
      );

      if (pair.target === null) {
        // No canonical GridView constructor exists; it must fail closed and
        // the gap must be acknowledged in writing.
        expect(result.outcome).toBe('unresolved');
        expect(
          corpus.acknowledgedUnmapped.some(
            (record) => record.providerValue === pair.openF1,
          ),
          `${pair.openF1} must carry a written coverage-gap reason`,
        ).toBe(true);
      } else {
        expect(result).toEqual({
          outcome: 'resolved',
          gridviewId: pair.target,
        });
      }

      // The Jolpica display name is never an identifier, in either direction.
      expect(
        registry.resolve(
          key<'constructor'>({
            season: SEASON,
            source: 'openf1',
            entity: 'constructor',
            providerField: 'team_name',
            providerValue: pair.jolpicaName,
          }),
        ).outcome,
      ).toBe('unresolved');
      expect(
        registry.resolve(
          key<'constructor'>({
            season: SEASON,
            source: 'jolpica',
            entity: 'constructor',
            providerField: 'constructorId',
            providerValue: pair.jolpicaName,
          }),
        ).outcome,
      ).toBe('unresolved');
    }
  });
});
