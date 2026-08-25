/**
 * The semantic content-validation rules for the provider mapping registry.
 *
 * These are the build-time half of the fail-closed design: JSON Schema settles
 * one record's shape, and these rules settle composite-key uniqueness, target
 * existence and coverage of the approved evidence corpus. They run inside
 * `npm run validate:content`.
 *
 * Required case 51 lives here, next to the rule it exercises. Cases 48-50 are
 * asserted against the runtime resolver in
 * test/providers/mappings/mapping-coverage.test.ts.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  canonicalKey,
  isValidKeyShape,
  validateEvidenceCoverage,
  validateMappingDocument,
} from '../../scripts/lib/provider-mapping-rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');

const read = (...segments) =>
  JSON.parse(readFileSync(join(repoRoot, ...segments), 'utf8'));

const corpus = read(
  'content',
  'seasons',
  '2026',
  'provider-evidence.development.json',
);
const document = read(
  'content',
  'seasons',
  '2026',
  'provider-mappings.development.json',
);

const canonicalIds = {
  driver: new Set(
    read('content', 'registries', 'drivers.mock.json').drivers.map((d) => d.id),
  ),
  constructor: new Set(
    read('content', 'registries', 'constructors.mock.json').constructors.map(
      (c) => c.id,
    ),
  ),
  circuit: new Set(
    read('content', 'registries', 'circuits.mock.json').circuits.map(
      (c) => c.id,
    ),
  ),
};

const base = {
  source: 'jolpica',
  entity: 'driver',
  providerField: 'driverId',
  providerValue: 'norris',
  gridviewId: 'lando-norris',
  evidence: 'fixture',
};

const doc = (mappings, season = 2026) => ({ season, mappings });

describe('the checked-in content satisfies every semantic rule', () => {
  it('validates the curated mapping document', () => {
    expect(validateMappingDocument(document, canonicalIds)).toEqual([]);
  });

  it('validates evidence coverage', () => {
    expect(validateEvidenceCoverage(corpus, document)).toEqual([]);
  });
});

describe('canonical keys keep distinct identities distinct', () => {
  const key = (overrides) =>
    canonicalKey({
      season: 2026,
      source: 'openf1',
      entity: 'driver',
      providerField: 'driver_number',
      providerValue: 1,
      ...overrides,
    });

  it('separates integer 1 from string "1"', () => {
    expect(key({})).not.toBe(
      key({
        source: 'jolpica',
        providerField: 'driverId',
        providerValue: '1',
      }),
    );
    // Same combination, only the value type differs.
    expect(
      canonicalKey({
        season: 2026,
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: '1',
      }),
    ).not.toBe(key({ entity: 'constructor', providerField: 'team_name' }));
  });

  it('separates seasons, sources, entities, fields and exact values', () => {
    const distinct = new Set([
      key({}),
      key({ season: 2027 }),
      key({ entity: 'circuit', providerField: 'circuit_key' }),
      key({ providerValue: 2 }),
      canonicalKey({
        season: 2026,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'Norris',
      }),
      canonicalKey({
        season: 2026,
        source: 'jolpica',
        entity: 'driver',
        providerField: 'driverId',
        providerValue: 'norris',
      }),
    ]);
    expect(distinct.size).toBe(6);
  });

  it('refuses to key a value that is neither a string nor a safe integer', () => {
    expect(() =>
      canonicalKey({ ...base, season: 2026, providerValue: 1.5 }),
    ).toThrow(TypeError);
  });
});

describe('key shapes are a closed set', () => {
  it('accepts only the six declared combinations', () => {
    expect(isValidKeyShape(base)).toBe(true);
    expect(
      isValidKeyShape({
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: 1,
      }),
    ).toBe(true);

    for (const invalid of [
      { ...base, source: 'mock' },
      { ...base, source: 'apiSports' },
      { ...base, providerField: 'team_name' },
      { ...base, entity: 'constructor' },
      { ...base, entity: 'meeting', providerField: 'meeting_key' },
      { ...base, providerValue: 1 },
      {
        source: 'openf1',
        entity: 'driver',
        providerField: 'driver_number',
        providerValue: '1',
      },
      { ...base, providerValue: null },
    ]) {
      expect(isValidKeyShape(invalid), JSON.stringify(invalid)).toBe(false);
    }
  });
});

describe('mapping documents fail closed', () => {
  it('rejects a duplicated complete key', () => {
    const problems = validateMappingDocument(
      doc([base, { ...base }]),
      canonicalIds,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/duplicate key/);
  });

  it('rejects the same key pointing at different targets', () => {
    const problems = validateMappingDocument(
      doc([base, { ...base, gridviewId: 'max-verstappen' }]),
      canonicalIds,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/ambiguous key/);
  });

  it('allows several explicitly different keys to share one target', () => {
    expect(
      validateMappingDocument(
        doc([
          base,
          {
            source: 'openf1',
            entity: 'driver',
            providerField: 'driver_number',
            providerValue: 1,
            gridviewId: 'lando-norris',
            evidence: 'fixture',
          },
        ]),
        canonicalIds,
      ),
    ).toEqual([]);
  });

  it('rejects a dangling target and a target of the wrong kind', () => {
    expect(
      validateMappingDocument(
        doc([{ ...base, gridviewId: 'nobody' }]),
        canonicalIds,
      )[0],
    ).toMatch(/does not exist in registries\/drivers/);

    expect(
      validateMappingDocument(
        doc([{ ...base, gridviewId: 'mclaren' }]),
        canonicalIds,
      )[0],
    ).toMatch(/does not exist in registries\/drivers/);
  });

  it('rejects an invalid combination', () => {
    expect(
      validateMappingDocument(
        doc([{ ...base, source: 'mock' }]),
        canonicalIds,
      )[0],
    ).toMatch(/invalid source\/entity\/providerField\/value-type/);
  });

  it('produces the same verdict regardless of record order', () => {
    const records = [
      base,
      {
        source: 'jolpica',
        entity: 'constructor',
        providerField: 'constructorId',
        providerValue: 'mclaren',
        gridviewId: 'mclaren',
        evidence: 'fixture',
      },
      {
        source: 'openf1',
        entity: 'constructor',
        providerField: 'team_name',
        providerValue: 'Alpine',
        gridviewId: 'alpine',
        evidence: 'fixture',
      },
    ];
    expect(validateMappingDocument(doc(records), canonicalIds)).toEqual([]);
    expect(
      validateMappingDocument(doc([...records].reverse()), canonicalIds),
    ).toEqual([]);

    // And a duplicate is rejected from either direction, never overwritten.
    const withDuplicate = [
      ...records,
      { ...base, gridviewId: 'george-russell' },
    ];
    expect(
      validateMappingDocument(doc(withDuplicate), canonicalIds),
    ).toHaveLength(1);
    expect(
      validateMappingDocument(doc([...withDuplicate].reverse()), canonicalIds),
    ).toHaveLength(1);
  });
});

describe('required case 51 - approved identities cannot be silently omitted', () => {
  const newIdentity = {
    source: 'openf1',
    entity: 'circuit',
    providerField: 'circuit_key',
    providerValue: 63,
    evidence: 'hypothetical newly approved identity',
  };

  it('fails validation until an explicit decision is recorded', () => {
    const extended = {
      ...corpus,
      identities: [...corpus.identities, newIdentity],
    };

    const problems = validateEvidenceCoverage(extended, document);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/neither mapped nor acknowledged/);
  });

  it('passes once an explicit mapping is added', () => {
    const extended = {
      ...corpus,
      identities: [...corpus.identities, newIdentity],
    };
    const mapped = {
      ...document,
      mappings: [
        ...document.mappings,
        { ...newIdentity, gridviewId: 'silverstone' },
      ],
    };
    expect(validateEvidenceCoverage(extended, mapped)).toEqual([]);
  });

  it('passes once the gap is explicitly acknowledged instead', () => {
    const extended = {
      ...corpus,
      identities: [...corpus.identities, newIdentity],
      acknowledgedUnmapped: [
        ...corpus.acknowledgedUnmapped,
        { ...newIdentity, evidence: undefined, reason: 'hypothetical gap' },
      ],
    };
    delete extended.acknowledgedUnmapped.at(-1).evidence;
    expect(validateEvidenceCoverage(extended, document)).toEqual([]);
  });

  it('rejects a mapping for an identity the corpus never recorded', () => {
    const invented = {
      ...document,
      mappings: [
        ...document.mappings,
        {
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue: 'invented',
          gridviewId: 'george-russell',
          evidence: 'not in the corpus',
        },
      ],
    };
    const problems = validateEvidenceCoverage(corpus, invented);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/absent from the approved evidence corpus/);
  });

  it('rejects acknowledging an identity that is in fact mapped', () => {
    const contradictory = {
      ...corpus,
      acknowledgedUnmapped: [
        ...corpus.acknowledgedUnmapped,
        {
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue: 'norris',
          reason: 'contradicts the mapping that exists',
        },
      ],
    };
    const problems = validateEvidenceCoverage(contradictory, document);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/a mapping exists for it/);
  });

  it('rejects an acknowledgement with no corresponding recorded identity', () => {
    const orphan = {
      ...corpus,
      acknowledgedUnmapped: [
        ...corpus.acknowledgedUnmapped,
        {
          source: 'jolpica',
          entity: 'driver',
          providerField: 'driverId',
          providerValue: 'ghost',
          reason: 'never recorded as evidence',
        },
      ],
    };
    const problems = validateEvidenceCoverage(orphan, document);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/does not correspond to any recorded identity/);
  });
});
