/**
 * The curated 2026 Jolpica circuit mappings.
 *
 * Pins the six season-2026 circuit associations a curator has approved:
 * `albert_park` from Provider Evaluation §8.4, and the five approved on
 * 2026-09-19 from the §8.8 calendar response, recorded in §8.8.1. `APPROVED`
 * and `ALREADY_MAPPED` below are that curator decision row for row, so
 * changing any association means changing it here in the same reviewed commit.
 *
 * These five were mapping decisions only: each one targets a canonical
 * GridView circuit that already existed, so the curated circuit registry is
 * unchanged. The registry pin below fails if an identity is added, removed or
 * renamed.
 *
 * Runs from a clean checkout. The raw Jolpica capture is held outside the
 * repository and is never read here: §8.8 and §8.8.1 are the repository-owned
 * record of it, and this test reconstructs that record from committed content.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { canonical, key, realRegistry, registryOf, SEASON } from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(repoRoot, ...segments), 'utf8');
}

/** The exact response hash §8.8 records for the 2026-09-19 observation. */
const RESPONSE_HASH =
  '87dd8cad5d33eb67f97aa46de7d024715135b9429707de99f8966c498c8e0bed';

/** The instant §8.8 records for that one response. */
const OBSERVED_AT = '2026-09-19T19:38:15Z';

interface CuratedCircuit {
  readonly round: number;
  readonly circuitId: string;
  readonly circuitName: string;
  readonly locality: string;
  readonly country: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly gridviewId: string;
}

/** The curator decision of 2026-09-19, exactly as §8.8.1 tabulates it. */
const APPROVED: readonly CuratedCircuit[] = (
  [
    [
      3,
      'suzuka',
      'Suzuka Circuit',
      'Suzuka',
      'Japan',
      '34.8431',
      '136.541',
      'suzuka',
    ],
    [
      6,
      'monaco',
      'Circuit de Monaco',
      'Monte Carlo',
      'Monaco',
      '43.7347',
      '7.42056',
      'monaco',
    ],
    [
      9,
      'silverstone',
      'Silverstone Circuit',
      'Silverstone',
      'UK',
      '52.0786',
      '-1.01694',
      'silverstone',
    ],
    [
      10,
      'spa',
      'Circuit de Spa-Francorchamps',
      'Spa',
      'Belgium',
      '50.4372',
      '5.97139',
      'spa-francorchamps',
    ],
    [
      13,
      'monza',
      'Autodromo Nazionale di Monza',
      'Monza',
      'Italy',
      '45.6156',
      '9.28111',
      'monza',
    ],
  ] as const
).map(
  ([
    round,
    circuitId,
    circuitName,
    locality,
    country,
    latitude,
    longitude,
    gridviewId,
  ]) => ({
    round,
    circuitId,
    circuitName,
    locality,
    country,
    latitude,
    longitude,
    gridviewId,
  }),
);

/** The one circuit mapping that already existed, unchanged by this dataset. */
const ALREADY_MAPPED = {
  providerValue: 'albert_park',
  gridviewId: 'albert-park',
  evidence:
    'GridView_Provider_Evaluation.md 8.4 - Jolpica circuitId slug example.',
} as const;

/** Every season-2026 circuit association, mapped provider value to target. */
const ALL_ASSOCIATIONS: readonly (readonly [string, string])[] = [
  [ALREADY_MAPPED.providerValue, ALREADY_MAPPED.gridviewId],
  ...APPROVED.map(
    (row) => [row.circuitId, row.gridviewId] as readonly [string, string],
  ),
];

/** The observed circuitId that is acknowledged, not mapped. */
const ACKNOWLEDGED = {
  providerValue: 'hungaroring',
  reason: 'no-canonical-gridview-identity',
} as const;

/**
 * The other 16 observed 2026 `circuitId`s. Each needs a *new* canonical
 * GridView circuit identity, which is a curated-identity decision this dataset
 * does not take, so none of them may carry a mapping.
 */
const UNRESOLVED: readonly string[] = [
  'shanghai',
  'miami',
  'villeneuve',
  'catalunya',
  'red_bull_ring',
  'zandvoort',
  'madring',
  'baku',
  'sepang',
  'marina_bay',
  'americas',
  'rodriguez',
  'interlagos',
  'vegas',
  'losail',
  'yas_marina',
];

/** The curated circuit registry, pinned so no identity can drift silently. */
const REGISTRY: readonly (readonly [string, string])[] = [
  ['spa-francorchamps', 'Circuit de Spa-Francorchamps'],
  ['monza', 'Autodromo Nazionale Monza'],
  ['monaco', 'Circuit de Monaco'],
  ['silverstone', 'Silverstone Circuit'],
  ['albert-park', 'Albert Park Circuit'],
  ['suzuka', 'Suzuka International Racing Course'],
];

/**
 * The non-circuit mappings, pinned so this change cannot disturb them. The
 * 23 event locators are pinned row for row in `event-dataset-2026.test.ts`;
 * here only their count and their untouched evidence are asserted.
 */
const OTHER_MAPPINGS: readonly (readonly [string, string, string, string])[] = [
  ['jolpica', 'driver', 'norris', 'lando-norris'],
  ['jolpica', 'constructor', 'mclaren', 'mclaren'],
  ['jolpica', 'constructor', 'mercedes', 'mercedes'],
  ['openf1', 'driver', '1', 'lando-norris'],
  ['openf1', 'constructor', 'Mercedes', 'mercedes'],
  ['openf1', 'constructor', 'Alpine', 'alpine'],
  ['openf1', 'constructor', 'Red Bull Racing', 'red-bull'],
];

interface CuratedRecord {
  readonly source: string;
  readonly entity: string;
  readonly providerField: string;
  readonly providerValue: unknown;
  readonly gridviewId?: string;
  readonly evidence?: string;
  readonly reason?: string;
}

const circuitRegistry = (
  JSON.parse(readRepoFile('content', 'registries', 'circuits.mock.json')) as {
    circuits: { id: string; name: string }[];
  }
).circuits;

const mappingDocument = JSON.parse(
  readRepoFile(
    'content',
    'seasons',
    '2026',
    'provider-mappings.development.json',
  ),
) as { season: number; mappings: CuratedRecord[] };

const evidenceCorpus = JSON.parse(
  readRepoFile(
    'content',
    'seasons',
    '2026',
    'provider-evidence.development.json',
  ),
) as {
  season: number;
  identities: CuratedRecord[];
  acknowledgedUnmapped: CuratedRecord[];
};

const isCircuit = (record: CuratedRecord): boolean =>
  record.entity === 'circuit';
const isEvent = (record: CuratedRecord): boolean => record.entity === 'event';

const real = realRegistry();
const circuitMappings = mappingDocument.mappings.filter(isCircuit);
const circuitIdentities = evidenceCorpus.identities.filter(isCircuit);

function circuitKey(providerValue: string, season: number = SEASON) {
  return key<'circuit'>({
    season,
    source: 'jolpica',
    entity: 'circuit',
    providerField: 'circuitId',
    providerValue,
  });
}

function resolvedCircuit(providerValue: string): string | null {
  const result = real.resolve(circuitKey(providerValue));
  return result.outcome === 'resolved' ? result.gridviewId : null;
}

function evidenceFor(providerValue: string): string {
  const record = circuitIdentities.find(
    (entry) => entry.providerValue === providerValue,
  );
  return String(record?.evidence ?? '');
}

// ---------------------------------------------------------------------------

describe('the curated circuit registry is untouched by this dataset', () => {
  it('holds exactly the six pre-existing identities, each once', () => {
    const ids = circuitRegistry.map((entry) => entry.id);

    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect([...ids].sort()).toEqual(REGISTRY.map(([id]) => id).sort());
  });

  it('keeps every id paired with its existing display name', () => {
    // A renamed identity is as much a curated-identity change as a new one,
    // and this dataset authorised neither.
    expect(
      circuitRegistry.map((entry) => [entry.id, entry.name]).sort(),
    ).toEqual([...REGISTRY].map(([id, name]) => [id, name]).sort());
  });

  it('gains no identity for any still-unresolved provider value', () => {
    const ids = new Set(circuitRegistry.map((entry) => entry.id));
    for (const providerValue of [ACKNOWLEDGED.providerValue, ...UNRESOLVED]) {
      expect(ids.has(providerValue), providerValue).toBe(false);
    }
  });
});

describe('the 2026 Jolpica circuit mappings', () => {
  it('are exactly six Jolpica circuitId records in a 2026 file', () => {
    expect(mappingDocument.season).toBe(2026);
    expect(circuitMappings).toHaveLength(6);
    for (const record of circuitMappings) {
      expect(record.source).toBe('jolpica');
      expect(record.providerField).toBe('circuitId');
    }
  });

  it('are exactly the six approved associations', () => {
    expect(
      circuitMappings
        .map((record) => [String(record.providerValue), record.gridviewId])
        .sort(),
    ).toEqual([...ALL_ASSOCIATIONS].map(([from, to]) => [from, to]).sort());
  });

  it('leaves the pre-existing albert_park mapping exactly as it was', () => {
    const record = circuitMappings.find(
      (entry) => entry.providerValue === ALREADY_MAPPED.providerValue,
    );

    expect(record?.gridviewId).toBe(ALREADY_MAPPED.gridviewId);
    expect(record?.evidence).toBe(ALREADY_MAPPED.evidence);
  });

  it('targets only circuits that already exist in the curated registry', () => {
    for (const record of circuitMappings) {
      expect(
        canonical.circuit.has(String(record.gridviewId)),
        String(record.gridviewId),
      ).toBe(true);
    }
  });

  it('resolves each approved provider value to its approved target', () => {
    expect(real.isValid).toBe(true);
    for (const [providerValue, gridviewId] of ALL_ASSOCIATIONS) {
      expect(resolvedCircuit(providerValue), providerValue).toBe(gridviewId);
    }
  });

  it('matches no approved provider value in another season', () => {
    for (const [providerValue] of ALL_ASSOCIATIONS) {
      expect(
        real.resolve(circuitKey(providerValue, 2027)).outcome,
        providerValue,
      ).toBe('unresolved');
    }
  });

  it('never maps the acknowledged or the 16 unresolved provider values', () => {
    for (const providerValue of [ACKNOWLEDGED.providerValue, ...UNRESOLVED]) {
      expect(
        circuitMappings.some(
          (record) => record.providerValue === providerValue,
        ),
        providerValue,
      ).toBe(false);
      expect(resolvedCircuit(providerValue), providerValue).toBeNull();
    }
  });

  it('is not selected by a case-folded, slugged or trimmed near miss', () => {
    for (const [providerValue] of ALL_ASSOCIATIONS) {
      for (const near of [
        providerValue.toUpperCase(),
        providerValue.replaceAll('_', '-'),
        providerValue.replaceAll('-', '_'),
        ` ${providerValue}`,
        `${providerValue} `,
      ]) {
        if (near === providerValue) continue;
        expect(
          real.resolveUnknown({
            season: SEASON,
            source: 'jolpica',
            entity: 'circuit',
            providerField: 'circuitId',
            providerValue: near,
          }).outcome,
          near,
        ).toBe('unresolved');
      }
    }
  });
});

describe('the 2026 circuit evidence corpus', () => {
  it('records the mapped six and the one acknowledgement, and nothing else', () => {
    expect(evidenceCorpus.season).toBe(2026);
    expect(circuitIdentities).toHaveLength(7);
    expect(
      circuitIdentities.map((record) => record.providerValue).sort(),
    ).toEqual(
      [
        ...ALL_ASSOCIATIONS.map(([from]) => from),
        ACKNOWLEDGED.providerValue,
      ].sort(),
    );
  });

  it('keeps hungaroring acknowledged with its existing closed reason', () => {
    const acknowledged = evidenceCorpus.acknowledgedUnmapped.filter(isCircuit);

    expect(acknowledged).toHaveLength(1);
    expect(acknowledged[0]?.providerValue).toBe(ACKNOWLEDGED.providerValue);
    expect(acknowledged[0]?.reason).toBe(ACKNOWLEDGED.reason);
    // An acknowledgement is never coverage: nothing may be both.
    expect(
      circuitMappings.some(
        (record) => record.providerValue === ACKNOWLEDGED.providerValue,
      ),
    ).toBe(false);
  });

  it('acknowledges none of the 16 that need a new canonical identity', () => {
    const acknowledged = new Set(
      evidenceCorpus.acknowledgedUnmapped.map((record) => record.providerValue),
    );
    for (const providerValue of UNRESOLVED) {
      expect(acknowledged.has(providerValue), providerValue).toBe(false);
    }
  });

  it('gives each of the five a repository-owned, licensed evidence record', () => {
    for (const row of APPROVED) {
      const evidence = evidenceFor(row.circuitId);

      // Where it is recorded inside this repository, and which value it is.
      expect(evidence, row.circuitId).toContain(
        `GridView_Provider_Evaluation.md 8.8 circuit ${row.circuitId} -`,
      );
      // The exact response, its access instant and its attribution.
      expect(evidence, row.circuitId).toContain(RESPONSE_HASH);
      expect(evidence, row.circuitId).toContain(OBSERVED_AT);
      expect(evidence, row.circuitId).toContain('Jolpica F1');
      expect(evidence, row.circuitId).toContain('CC BY-NC-SA 4.0');
      // No private path or machine-local capture is ever cited.
      expect(evidence, row.circuitId).not.toContain('.gridview');
    }
  });

  it('cites the same evidence from the mapping and from the corpus', () => {
    for (const row of APPROVED) {
      const mapping = circuitMappings.find(
        (record) => record.providerValue === row.circuitId,
      );
      expect(mapping?.evidence, row.circuitId).toBe(evidenceFor(row.circuitId));
    }
  });

  it('leaves the albert_park and hungaroring evidence records unchanged', () => {
    expect(evidenceFor(ALREADY_MAPPED.providerValue)).toBe(
      ALREADY_MAPPED.evidence,
    );
    expect(evidenceFor(ACKNOWLEDGED.providerValue)).toBe(
      'GridView_Provider_Evaluation.md 8.4 - Jolpica circuitId slug example.',
    );
  });
});

describe('nothing outside the circuit dataset moved', () => {
  it('keeps the 23 event mappings, identities and acknowledgements', () => {
    // Row-for-row pinning lives in event-dataset-2026.test.ts; this guards the
    // set against a circuit change that adds, drops or reclassifies an event.
    expect(mappingDocument.mappings.filter(isEvent)).toHaveLength(23);
    expect(evidenceCorpus.identities.filter(isEvent)).toHaveLength(23);
    expect(evidenceCorpus.acknowledgedUnmapped.filter(isEvent)).toEqual([]);
  });

  it('keeps every driver and constructor mapping exactly as it was', () => {
    const others = mappingDocument.mappings
      .filter((record) => !isCircuit(record) && !isEvent(record))
      .map((record) => [
        record.source,
        record.entity,
        String(record.providerValue),
        String(record.gridviewId),
      ]);

    expect(others.sort()).toEqual(
      [...OTHER_MAPPINGS].map((row) => [...row]).sort(),
    );
  });

  it('keeps the whole document and corpus at their expected sizes', () => {
    expect(mappingDocument.mappings).toHaveLength(
      OTHER_MAPPINGS.length + ALL_ASSOCIATIONS.length + 23,
    );
    expect(evidenceCorpus.identities).toHaveLength(41);
    expect(evidenceCorpus.acknowledgedUnmapped).toHaveLength(5);
  });
});

describe('the repository-owned evidence record (Provider Evaluation §8.8.1)', () => {
  const evaluation = readRepoFile(
    'docs',
    'technical',
    'GridView_Provider_Evaluation.md',
  );
  const start = evaluation.indexOf('#### 8.8.1 ');
  const section = evaluation.slice(
    start,
    evaluation.indexOf('**Limits of this evidence:**', start),
  );

  it('records the observation, its licence and its coverage honestly', () => {
    expect(start).toBeGreaterThan(0);
    for (const fact of [
      RESPONSE_HASH,
      '**6 of the 23**',
      '**17 remain unresolved',
      '**16**',
      '`no-canonical-gridview-identity`',
      'require a new canonical\nGridView circuit identity',
      'remains blocked\non circuit coverage',
      '**No additional provider request was made.**',
      'mapping decision only',
    ]) {
      expect(section, fact).toContain(fact);
    }
    // It must never claim the calendar is covered.
    expect(section).not.toContain('all 23 circuits');
  });

  it('names the 16 that still need a canonical identity', () => {
    for (const providerValue of UNRESOLVED) {
      expect(section, providerValue).toContain(`\`${providerValue}\``);
    }
  });

  it('is reconstructed exactly by the committed mappings', () => {
    const rows = [
      ...section.matchAll(
        /^\| (\d+) \| `([^`]+)` \| `([^`]+)` \| `([^`]+)`, `([^`]+)` \| `([^`]+)`, `([^`]+)` \| `([^`]+)` \|$/gm,
      ),
    ].map(
      ([
        ,
        round,
        circuitId,
        circuitName,
        locality,
        country,
        latitude,
        longitude,
        gridviewId,
      ]) => ({
        round: Number(round),
        circuitId: String(circuitId),
        circuitName: String(circuitName),
        locality: String(locality),
        country: String(country),
        latitude: String(latitude),
        longitude: String(longitude),
        gridviewId: String(gridviewId),
      }),
    );

    expect(rows).toEqual(APPROVED);
    expect(rows.map((row) => [row.circuitId, row.gridviewId]).sort()).toEqual(
      APPROVED.map((row) => [row.circuitId, row.gridviewId]).sort(),
    );
    for (const row of rows) {
      expect(resolvedCircuit(row.circuitId), row.circuitId).toBe(
        row.gridviewId,
      );
    }
  });
});

describe('a mapping that disagrees with its approved evidence is caught', () => {
  it('fails the row pin when a target is swapped between two circuits', () => {
    // The deliberate mismatch: `spa` pointed at Monza's identity. It is still
    // a structurally valid record against an existing canonical circuit, so
    // only the curator pin can reject it - which is why the pin exists.
    const swapped = registryOf(
      mappingDocument.mappings.map((record) =>
        record.providerValue === 'spa'
          ? { ...record, gridviewId: 'monza' }
          : record,
      ),
    );

    expect(swapped.problems).toEqual([]);
    const result = swapped.resolve(circuitKey('spa'));
    expect(result.outcome).toBe('resolved');
    if (result.outcome !== 'resolved') throw new Error('unreachable');
    expect(result.gridviewId).toBe('monza');
    expect(result.gridviewId).not.toBe('spa-francorchamps');
    // The committed content does not have this defect.
    expect(resolvedCircuit('spa')).toBe('spa-francorchamps');
  });

  it('fails closed when a target does not exist in the registry', () => {
    // A circuit identity minted from the provider slug is the failure this
    // dataset must never commit: `spa` has no canonical circuit called `spa`.
    const minted = registryOf(
      mappingDocument.mappings.map((record) =>
        record.providerValue === 'spa'
          ? { ...record, gridviewId: 'spa' }
          : record,
      ),
    );

    expect(minted.isValid).toBe(false);
    expect(minted.problems.length).toBeGreaterThan(0);
    expect(minted.resolve(circuitKey('spa')).outcome).toBe('unresolved');
  });
});
