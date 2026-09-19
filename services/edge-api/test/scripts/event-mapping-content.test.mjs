/**
 * Content validation for the curated event registry and event mappings.
 *
 * The two layers are exercised **separately**, because the repository keeps
 * them separate: JSON Schema 2020-12 owns one record's shape, and
 * `scripts/lib/provider-mapping-rules.mjs` owns the statements a schema cannot
 * make - composite-key uniqueness, target existence in another file and
 * evidence coverage. A rule proven only by the schema, or only by the semantic
 * pass, is asserted where it actually lives.
 *
 * Every provider value here is a **synthetic fixture**. No live Jolpica payload
 * is copied and nothing here is an approved mapping.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import {
  canonicalKey,
  isProviderEventLocator,
  isValidKeyShape,
  validateEvidenceCoverage,
  validateMappingDocument,
  validateRegistryDocumentSet,
  validateSeasonalDocumentSet,
} from '../../scripts/lib/provider-mapping-rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');
const schemasDir = join(repoRoot, 'content', 'schemas');

const read = (...segments) =>
  JSON.parse(readFileSync(join(repoRoot, ...segments), 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
for (const file of readdirSync(schemasDir)) {
  if (!file.endsWith('.schema.json')) continue;
  ajv.addSchema(JSON.parse(readFileSync(join(schemasDir, file), 'utf8')));
}

const validateRegistry = ajv.getSchema(
  'https://gridview.local/schemas/event-registry.schema.json',
);
const validateMappings = ajv.getSchema(
  'https://gridview.local/schemas/provider-mappings.schema.json',
);
const validateEvidence = ajv.getSchema(
  'https://gridview.local/schemas/provider-evidence.schema.json',
);

const locator = (overrides = {}) => ({
  round: 11,
  raceName: 'Hungarian Grand Prix',
  circuitId: 'hungaroring',
  ...overrides,
});

const eventRecord = (overrides = {}) => ({
  source: 'jolpica',
  entity: 'event',
  providerField: 'eventLocator',
  providerValue: locator(),
  gridviewId: 'hungarian-grand-prix',
  evidence: 'synthetic test fixture',
  ...overrides,
});

const mappingDoc = (mappings, season = 2026) => ({
  kind: 'provider-mappings',
  schemaVersion: 2,
  status: 'development',
  note: 'synthetic fixture',
  season,
  mappings,
});

/** Synthetic canonical identities. Never curated content. */
const canonicalIds = {
  driver: new Set(['lando-norris']),
  constructor: new Set(['mclaren']),
  circuit: new Set(['hungaroring']),
  event: new Set(['hungarian-grand-prix', 'european-grand-prix']),
};

// ---------------------------------------------------------------------------
// The committed content.
// ---------------------------------------------------------------------------

describe('the committed event registry', () => {
  const registry = read('content', 'registries', 'events.development.json');

  it('validates against its schema', () => {
    const data = { ...registry };
    delete data.$schema;
    expect(
      validateRegistry(data),
      JSON.stringify(validateRegistry.errors),
    ).toBe(true);
  });

  it('passes the registry document-set rule with one id per curated event', () => {
    // The exact curated dataset is pinned in
    // test/providers/mappings/event-dataset-2026.test.ts; this asserts only
    // that the build-time rule accepts the committed document as it ships.
    const { problems, ids } = validateRegistryDocumentSet(
      'event-registry',
      'events',
      [{ label: 'events.development.json', data: registry }],
    );

    expect(problems).toEqual([]);
    expect(ids.size).toBe(registry.events.length);
  });

  it('records every curated event locator as both mapped and evidenced', () => {
    // A4: every locator joins the season's evidence corpus. The build-time
    // coverage rule proves the two sets agree; this pins that no event
    // locator is merely acknowledged, because an acknowledgement is a
    // blocker, never a mapping.
    const mappings = read(
      'content',
      'seasons',
      '2026',
      'provider-mappings.development.json',
    );
    const evidence = read(
      'content',
      'seasons',
      '2026',
      'provider-evidence.development.json',
    );
    const events = (entries) =>
      entries.filter((entry) => entry.entity === 'event');

    expect(events(mappings.mappings)).toHaveLength(registry.events.length);
    expect(events(evidence.identities)).toHaveLength(registry.events.length);
    expect(events(evidence.acknowledgedUnmapped)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Schema layer: one record's shape.
// ---------------------------------------------------------------------------

describe('the schema accepts a well-formed event mapping', () => {
  it('accepts the complete locator record', () => {
    const doc = mappingDoc([eventRecord()]);
    expect(validateMappings(doc), JSON.stringify(validateMappings.errors)).toBe(
      true,
    );
  });

  it('accepts a locator at both round bounds', () => {
    for (const round of [1, 40]) {
      const doc = mappingDoc([
        eventRecord({ providerValue: locator({ round }) }),
      ]);
      expect(validateMappings(doc), `round ${round}`).toBe(true);
    }
  });
});

describe('the schema rejects a malformed event mapping', () => {
  const rejected = {
    'invalid eventSlug (uppercase)': eventRecord({
      gridviewId: 'Hungarian-Grand-Prix',
    }),
    'invalid eventSlug (trailing hyphen)': eventRecord({
      gridviewId: 'hungarian-grand-prix-',
    }),
    'invalid eventSlug (empty)': eventRecord({ gridviewId: '' }),
    'missing evidence': (() => {
      const record = eventRecord();
      delete record.evidence;
      return record;
    })(),
    'unexpected property': eventRecord({ smuggled: 'ignored' }),
    'locator redundantly carrying season': eventRecord({
      providerValue: locator({ season: 2026 }),
    }),
    'zero round': eventRecord({ providerValue: locator({ round: 0 }) }),
    'negative round': eventRecord({ providerValue: locator({ round: -1 }) }),
    'round above the bound': eventRecord({
      providerValue: locator({ round: 41 }),
    }),
    'non-integer round': eventRecord({
      providerValue: locator({ round: 1.5 }),
    }),
    'string round': eventRecord({ providerValue: locator({ round: '11' }) }),
    'empty raceName': eventRecord({ providerValue: locator({ raceName: '' }) }),
    'empty circuitId': eventRecord({
      providerValue: locator({ circuitId: '' }),
    }),
    'padded raceName': eventRecord({
      providerValue: locator({ raceName: ' Hungarian Grand Prix' }),
    }),
    'locator missing circuitId': eventRecord({
      providerValue: { round: 11, raceName: 'Hungarian Grand Prix' },
    }),
    'scalar value instead of a locator': eventRecord({
      providerValue: 'hungaroring',
    }),
    'malformed source identifier': eventRecord({ source: 'jolpica-mirror' }),
    'mock source': eventRecord({ source: 'mock' }),
    'openf1 event combination': eventRecord({ source: 'openf1' }),
    'event keyed on a real Jolpica field': eventRecord({
      providerField: 'circuitId',
      providerValue: 'hungaroring',
    }),
  };

  for (const [label, record] of Object.entries(rejected)) {
    it(`rejects ${label}`, () => {
      expect(validateMappings(mappingDoc([record]))).toBe(false);
    });
  }
});

describe('the event registry schema is closed', () => {
  const invalid = {
    'invalid eventSlug': { id: 'Hungarian GP', name: 'Hungarian Grand Prix' },
    'missing name': { id: 'hungarian-grand-prix' },
    'empty name': { id: 'hungarian-grand-prix', name: '' },
    'unexpected property': {
      id: 'hungarian-grand-prix',
      name: 'Hungarian Grand Prix',
      round: 11,
    },
    'a provider response object': {
      id: 'hungarian-grand-prix',
      name: 'Hungarian Grand Prix',
      Circuit: { circuitId: 'hungaroring' },
    },
  };

  it('accepts a well-formed synthetic entry', () => {
    expect(
      validateRegistry({
        kind: 'event-registry',
        status: 'development',
        events: [{ id: 'hungarian-grand-prix', name: 'Hungarian Grand Prix' }],
      }),
    ).toBe(true);
  });

  for (const [label, event] of Object.entries(invalid)) {
    it(`rejects ${label}`, () => {
      expect(
        validateRegistry({
          kind: 'event-registry',
          status: 'development',
          events: [event],
        }),
      ).toBe(false);
    });
  }
});

describe('the evidence corpus admits an event locator', () => {
  const evidenceDoc = (identities, acknowledgedUnmapped = []) => ({
    kind: 'provider-evidence',
    schemaVersion: 1,
    status: 'development',
    season: 2026,
    note: 'synthetic fixture',
    identities,
    acknowledgedUnmapped,
  });

  it('accepts a recorded locator identity', () => {
    expect(
      validateEvidence(
        evidenceDoc([
          {
            source: 'jolpica',
            entity: 'event',
            providerField: 'eventLocator',
            providerValue: locator(),
            evidence: 'synthetic test fixture',
          },
        ]),
      ),
      JSON.stringify(validateEvidence.errors),
    ).toBe(true);
  });

  it('rejects a locator identity that carries a season', () => {
    expect(
      validateEvidence(
        evidenceDoc([
          {
            source: 'jolpica',
            entity: 'event',
            providerField: 'eventLocator',
            providerValue: locator({ season: 2026 }),
            evidence: 'synthetic test fixture',
          },
        ]),
      ),
    ).toBe(false);
  });

  it('accepts an acknowledgement for an unmapped locator', () => {
    expect(
      validateEvidence(
        evidenceDoc(
          [
            {
              source: 'jolpica',
              entity: 'event',
              providerField: 'eventLocator',
              providerValue: locator(),
              evidence: 'synthetic test fixture',
            },
          ],
          [
            {
              source: 'jolpica',
              entity: 'event',
              providerField: 'eventLocator',
              providerValue: locator(),
              reason: 'no-canonical-gridview-identity',
              detail: 'no curated event identity exists yet',
            },
          ],
        ),
      ),
      JSON.stringify(validateEvidence.errors),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Semantic layer: statements about a whole file, or about another file.
// ---------------------------------------------------------------------------

describe('the semantic pass covers event mappings', () => {
  it('accepts a well-formed event mapping document', () => {
    expect(
      validateMappingDocument(mappingDoc([eventRecord()]), canonicalIds),
    ).toEqual([]);
  });

  it('reports an unknown canonical event reference', () => {
    const problems = validateMappingDocument(
      mappingDoc([eventRecord({ gridviewId: 'never-curated-grand-prix' })]),
      canonicalIds,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('registries/events.development.json');
  });

  it('reports a duplicated locator', () => {
    const problems = validateMappingDocument(
      mappingDoc([eventRecord(), eventRecord()]),
      canonicalIds,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('duplicate key');
  });

  it('reports conflicting locator ownership as ambiguous', () => {
    const problems = validateMappingDocument(
      mappingDoc([
        eventRecord(),
        eventRecord({ gridviewId: 'european-grand-prix' }),
      ]),
      canonicalIds,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('ambiguous key');
  });

  it('reports an unexpected property on a curated record', () => {
    const problems = validateMappingDocument(
      mappingDoc([eventRecord({ smuggled: 'ignored' })]),
      canonicalIds,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('unexpected property');
  });

  it('reports a malformed locator as an invalid combination', () => {
    for (const providerValue of [
      locator({ round: 0 }),
      locator({ raceName: '' }),
      locator({ circuitId: '' }),
      locator({ season: 2026 }),
      'hungaroring',
    ]) {
      const problems = validateMappingDocument(
        mappingDoc([eventRecord({ providerValue })]),
        canonicalIds,
      );

      expect(problems, JSON.stringify(providerValue)).toHaveLength(1);
      expect(problems[0]).toContain('invalid source/entity/providerField');
    }
  });

  it('keeps two aliases of one event valid', () => {
    expect(
      validateMappingDocument(
        mappingDoc([
          eventRecord(),
          eventRecord({
            providerValue: locator({
              round: 12,
              raceName: 'Grand Prix of Hungary',
            }),
          }),
        ]),
        canonicalIds,
      ),
    ).toEqual([]);
  });

  it('keeps the same locator in two seasons independent', () => {
    for (const season of [2026, 2027]) {
      expect(
        validateMappingDocument(
          mappingDoc([eventRecord()], season),
          canonicalIds,
        ),
      ).toEqual([]);
    }
    expect(canonicalKey({ season: 2026, ...eventRecord() })).not.toBe(
      canonicalKey({ season: 2027, ...eventRecord() }),
    );
  });

  it('gives the same problems whatever order the records are in', () => {
    const good = eventRecord();
    const dangling = eventRecord({
      providerValue: locator({ round: 12 }),
      gridviewId: 'never-curated-grand-prix',
    });

    const forwards = validateMappingDocument(
      mappingDoc([good, dangling]),
      canonicalIds,
    );
    const backwards = validateMappingDocument(
      mappingDoc([dangling, good]),
      canonicalIds,
    );

    expect(forwards).toHaveLength(1);
    expect(backwards).toHaveLength(1);
    // Only the record index differs; the finding is the same one.
    expect(forwards[0].replace(/mappings\[\d+]/g, 'mappings[i]')).toBe(
      backwards[0].replace(/mappings\[\d+]/g, 'mappings[i]'),
    );
  });

  it('does not mutate the document it validates', () => {
    const doc = mappingDoc([eventRecord()]);
    const snapshot = JSON.parse(JSON.stringify(doc));

    validateMappingDocument(doc, canonicalIds);

    expect(doc).toEqual(snapshot);
  });

  it('emits no machine path and no whole-document dump', () => {
    const problems = validateMappingDocument(
      mappingDoc([eventRecord({ gridviewId: 'never-curated-grand-prix' })]),
      canonicalIds,
    );

    for (const problem of problems) {
      expect(problem).not.toMatch(/[A-Za-z]:\\/);
      expect(problem).not.toContain(repoRoot);
      expect(problem).not.toContain('"mappings"');
      expect(problem.length).toBeLessThan(400);
    }
  });
});

describe('evidence coverage covers event locators', () => {
  const identity = {
    source: 'jolpica',
    entity: 'event',
    providerField: 'eventLocator',
    providerValue: locator(),
    evidence: 'synthetic test fixture',
  };

  const evidence = (identities, acknowledgedUnmapped = []) => ({
    season: 2026,
    identities,
    acknowledgedUnmapped,
  });

  it('accepts a recorded locator that is mapped', () => {
    expect(
      validateEvidenceCoverage(
        evidence([identity]),
        mappingDoc([eventRecord()]),
      ),
    ).toEqual([]);
  });

  it('reports a recorded locator that is neither mapped nor acknowledged', () => {
    const problems = validateEvidenceCoverage(
      evidence([identity]),
      mappingDoc([]),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('neither mapped nor acknowledged');
  });

  it('reports a mapped locator absent from the evidence corpus', () => {
    const problems = validateEvidenceCoverage(
      evidence([]),
      mappingDoc([eventRecord()]),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('absent from the approved evidence corpus');
  });

  it('refuses an acknowledgement that is also mapped', () => {
    const problems = validateEvidenceCoverage(
      evidence(
        [identity],
        [
          {
            source: 'jolpica',
            entity: 'event',
            providerField: 'eventLocator',
            providerValue: locator(),
            reason: 'no-canonical-gridview-identity',
          },
        ],
      ),
      mappingDoc([eventRecord()]),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('a mapping exists for it');
  });
});

describe('season context is required and checked', () => {
  it('rejects a record whose season context is malformed', () => {
    for (const season of [1949, 2101, '2026', 2026.5, null]) {
      expect(isValidKeyShape({ ...eventRecord(), season })).toBe(false);
    }
  });

  it('still accepts a record that carries no season of its own', () => {
    // A curated record never repeats its file's season (amendment A2), so an
    // absent season is the normal case, not a malformed one. The season is
    // supplied by the document when the key is encoded.
    expect(isValidKeyShape(eventRecord())).toBe(true);
    expect('season' in eventRecord()).toBe(false);
  });

  it('refuses to encode a key without a valid season', () => {
    expect(() => canonicalKey({ season: '2026', ...eventRecord() })).toThrow(
      TypeError,
    );
  });

  it('requires an evidence corpus beside any mapping document', () => {
    const { problems } = validateSeasonalDocumentSet(
      [{ label: 'mappings', data: mappingDoc([eventRecord()]) }],
      [],
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('no provider-evidence corpus');
  });

  it('rejects two mapping documents for one season', () => {
    const { problems } = validateSeasonalDocumentSet(
      [
        { label: 'a', data: mappingDoc([eventRecord()]) },
        { label: 'b', data: mappingDoc([]) },
      ],
      [{ label: 'e', data: { season: 2026 } }],
    );

    expect(
      problems.some((problem) => problem.message.includes('exactly one')),
    ).toBe(true);
  });
});

describe('exactly one curated registry document per entity kind', () => {
  const doc = (label, events) => ({
    label,
    data: { kind: 'event-registry', status: 'development', events },
  });

  it('accepts a single document and returns its ids', () => {
    const { problems, ids } = validateRegistryDocumentSet(
      'event-registry',
      'events',
      [
        doc('events.development.json', [
          { id: 'hungarian-grand-prix', name: 'Hungarian Grand Prix' },
          { id: 'european-grand-prix', name: 'European Grand Prix' },
        ]),
      ],
    );

    expect(problems).toEqual([]);
    expect([...ids].sort()).toEqual([
      'european-grand-prix',
      'hungarian-grand-prix',
    ]);
  });

  it('accepts an empty registry', () => {
    const { problems, ids } = validateRegistryDocumentSet(
      'event-registry',
      'events',
      [doc('events.development.json', [])],
    );

    expect(problems).toEqual([]);
    expect(ids.size).toBe(0);
  });

  it('accepts no document at all', () => {
    const { problems, ids } = validateRegistryDocumentSet(
      'event-registry',
      'events',
      [],
    );

    expect(problems).toEqual([]);
    expect(ids.size).toBe(0);
  });

  it('rejects a second registry document for the same kind', () => {
    // The runtime imports one file per kind. A target that lived only in the
    // second file would pass validation and then be rejected as
    // `target-missing` by the deployed registry.
    const { problems } = validateRegistryDocumentSet(
      'event-registry',
      'events',
      [
        doc('events.development.json', [{ id: 'a-grand-prix', name: 'A' }]),
        doc('events-extra.json', [{ id: 'b-grand-prix', name: 'B' }]),
      ],
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('exactly one is allowed');
    expect(problems[0].message).toContain('the runtime imports one');
  });

  it('withholds every id when a second document exists', () => {
    // Otherwise the extra file's ids would authorize mapping targets the
    // deployed registry cannot resolve - the exact divergence this rejects.
    const { ids } = validateRegistryDocumentSet('event-registry', 'events', [
      doc('events.development.json', [{ id: 'a-grand-prix', name: 'A' }]),
      doc('events-extra.json', [{ id: 'b-grand-prix', name: 'B' }]),
    ]);

    expect(ids.size).toBe(0);
  });

  it('reports a duplicate canonical id rather than collapsing it', () => {
    const { problems, ids } = validateRegistryDocumentSet(
      'event-registry',
      'events',
      [
        doc('events.development.json', [
          { id: 'hungarian-grand-prix', name: 'A' },
          { id: 'hungarian-grand-prix', name: 'B' },
        ]),
      ],
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('duplicate canonical id');
    expect(problems[0].message).toContain('events[1]');
    // An undecided canonical set must not be used for target checks.
    expect(ids.size).toBe(0);
  });

  it('applies the same rule to the other registry kinds', () => {
    const { problems } = validateRegistryDocumentSet(
      'driver-registry',
      'drivers',
      [
        { label: 'drivers.mock.json', data: { drivers: [{ id: 'a-driver' }] } },
        {
          label: 'drivers-extra.json',
          data: { drivers: [{ id: 'b-driver' }] },
        },
      ],
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('driver-registry');
  });

  it('names documents in a stable order, whatever order they arrive in', () => {
    const a = doc('events.development.json', [
      { id: 'a-grand-prix', name: 'A' },
    ]);
    const b = doc('events-extra.json', [{ id: 'b-grand-prix', name: 'B' }]);

    const forwards = validateRegistryDocumentSet('event-registry', 'events', [
      a,
      b,
    ]);
    const backwards = validateRegistryDocumentSet('event-registry', 'events', [
      b,
      a,
    ]);

    expect(forwards.problems).toEqual(backwards.problems);
  });

  it('does not mutate the documents it reads', () => {
    const documents = [
      doc('events.development.json', [{ id: 'a-grand-prix', name: 'A' }]),
    ];
    const snapshot = JSON.parse(JSON.stringify(documents));

    validateRegistryDocumentSet('event-registry', 'events', documents);

    expect(documents).toEqual(snapshot);
  });
});

describe('the locator predicate agrees with the schema', () => {
  it('accepts exactly what the schema accepts', () => {
    const candidates = [
      locator(),
      locator({ round: 1 }),
      locator({ round: 40 }),
      locator({ round: 0 }),
      locator({ round: 41 }),
      locator({ raceName: '' }),
      locator({ circuitId: '' }),
      locator({ season: 2026 }),
      { round: 11, raceName: 'Hungarian Grand Prix' },
      'hungaroring',
      null,
    ];

    for (const candidate of candidates) {
      const bySchema = validateMappings(
        mappingDoc([eventRecord({ providerValue: candidate })]),
      );
      expect(isProviderEventLocator(candidate), JSON.stringify(candidate)).toBe(
        bySchema,
      );
    }
  });
});
