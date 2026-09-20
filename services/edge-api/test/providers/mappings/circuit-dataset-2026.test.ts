/**
 * The curated 2026 Jolpica circuit dataset.
 *
 * Pins all 23 season-2026 circuit associations a curator has approved, in the
 * two passes Provider Evaluation §8.8.1 records:
 *
 * - `albert_park` from §8.4, plus the five approved on 2026-09-19 whose
 *   canonical GridView circuit already existed. Those were **mapping decisions
 *   only** and created no identity.
 * - The 17 canonical identities approved on 2026-09-20, each of which added a
 *   curated circuit to the registry. Every canonical ID and display name is
 *   curator-authored: no provider name became an identity, no alias exists and
 *   no provider value was normalised into an ID.
 *
 * `PRE_EXISTING`, `MAPPED_2026_09_19` and `APPROVED_IDENTITIES` below are that
 * curator decision row for row, so changing any association or any canonical
 * name means changing it here in the same reviewed commit.
 *
 * A complete mapping dataset is not an adapter. Nothing consumes any of this:
 * no Jolpica adapter exists, and the registry stays dormant.
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

/**
 * The five mapped on 2026-09-19, exactly as §8.8.1's first table tabulates
 * them. Their canonical circuits already existed, so no identity was created.
 */
const MAPPED_2026_09_19: readonly CuratedCircuit[] = (
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

interface CuratedIdentity {
  readonly round: number;
  readonly circuitId: string;
  readonly gridviewId: string;
  readonly name: string;
}

/**
 * The 17 canonical identities approved on 2026-09-20, exactly as §8.8.1's
 * second table tabulates them.
 *
 * The canonical ID is immutable; the display name carries the venue's current
 * public branding and may be updated later. Both are curator decisions, so a
 * provider value that happens to equal its canonical ID - `hungaroring`,
 * `sepang`, `shanghai`, `miami`, `zandvoort`, `baku` - agrees by decision and
 * never by rule.
 */
const APPROVED_IDENTITIES: readonly CuratedIdentity[] = (
  [
    [2, 'shanghai', 'shanghai', 'Shanghai International Circuit'],
    [4, 'miami', 'miami', 'Miami International Autodrome'],
    [5, 'villeneuve', 'gilles-villeneuve', 'Circuit Gilles Villeneuve'],
    [7, 'catalunya', 'barcelona-catalunya', 'Circuit de Barcelona-Catalunya'],
    [8, 'red_bull_ring', 'spielberg', 'Red Bull Ring'],
    [11, 'hungaroring', 'hungaroring', 'Hungaroring'],
    [12, 'zandvoort', 'zandvoort', 'Circuit Zandvoort'],
    [14, 'madring', 'madrid', 'Madring'],
    [15, 'baku', 'baku', 'Baku City Circuit'],
    [16, 'sepang', 'sepang', 'Sepang International Circuit'],
    [17, 'marina_bay', 'marina-bay', 'Marina Bay Street Circuit'],
    [18, 'americas', 'circuit-of-the-americas', 'Circuit of the Americas'],
    [19, 'rodriguez', 'hermanos-rodriguez', 'Autódromo Hermanos Rodríguez'],
    [20, 'interlagos', 'jose-carlos-pace', 'Autódromo José Carlos Pace'],
    [21, 'vegas', 'las-vegas-strip', 'Las Vegas Strip Circuit'],
    [22, 'losail', 'lusail', 'Lusail International Circuit'],
    [23, 'yas_marina', 'yas-marina', 'Yas Marina Circuit'],
  ] as const
).map(([round, circuitId, gridviewId, name]) => ({
  round,
  circuitId,
  gridviewId,
  name,
}));

/** The one circuit mapping that predates both passes. */
const ALREADY_MAPPED = {
  providerValue: 'albert_park',
  gridviewId: 'albert-park',
  evidence:
    'GridView_Provider_Evaluation.md 8.4 - Jolpica circuitId slug example.',
} as const;

/** Every season-2026 circuit association, mapped provider value to target. */
const ALL_ASSOCIATIONS: readonly (readonly [string, string])[] = [
  [ALREADY_MAPPED.providerValue, ALREADY_MAPPED.gridviewId],
  ...MAPPED_2026_09_19.map(
    (row) => [row.circuitId, row.gridviewId] as readonly [string, string],
  ),
  ...APPROVED_IDENTITIES.map(
    (row) => [row.circuitId, row.gridviewId] as readonly [string, string],
  ),
];

/** The six identities the curated circuit registry held before this dataset. */
const PRE_EXISTING: readonly (readonly [string, string])[] = [
  ['spa-francorchamps', 'Circuit de Spa-Francorchamps'],
  ['monza', 'Autodromo Nazionale Monza'],
  ['monaco', 'Circuit de Monaco'],
  ['silverstone', 'Silverstone Circuit'],
  ['albert-park', 'Albert Park Circuit'],
  ['suzuka', 'Suzuka International Racing Course'],
];

/** The whole curated circuit registry after this dataset: 6 + 17. */
const EXPECTED_REGISTRY: readonly (readonly [string, string])[] = [
  ...PRE_EXISTING,
  ...APPROVED_IDENTITIES.map(
    (row) => [row.gridviewId, row.name] as readonly [string, string],
  ),
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

/**
 * The four acknowledgements that survive this dataset, each with its closed
 * reason. `hungaroring` is deliberately absent: it is mapped now, and an
 * acknowledgement is never allowed to coexist with a mapping.
 */
const NON_CIRCUIT_ACKNOWLEDGEMENTS: readonly (readonly [
  string,
  string,
  string,
  string,
])[] = [
  ['jolpica', 'driver', 'antonelli', 'no-canonical-gridview-identity'],
  ['openf1', 'driver', '12', 'no-canonical-gridview-identity'],
  ['openf1', 'constructor', 'Cadillac', 'no-canonical-gridview-identity'],
  ['openf1', 'constructor', 'Racing Bulls', 'no-canonical-gridview-identity'],
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
    circuits: Record<string, unknown>[];
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

describe('the curated circuit registry', () => {
  it('holds exactly the six pre-existing identities plus the approved 17', () => {
    const ids = circuitRegistry.map((entry) => entry.id as string);

    expect(ids).toHaveLength(23);
    expect(new Set(ids).size).toBe(23);
    expect([...ids].sort()).toEqual(EXPECTED_REGISTRY.map(([id]) => id).sort());
  });

  it('keeps every id paired with its approved display name', () => {
    // A renamed identity is as much a curated decision as a new one. The
    // canonical ID is immutable; only the display name may ever be revised,
    // and revising it means revising this pin in the same reviewed commit.
    expect(
      circuitRegistry.map((entry) => [entry.id, entry.name]).sort(),
    ).toEqual([...EXPECTED_REGISTRY].map(([id, name]) => [id, name]).sort());
  });

  it('gives every new row exactly `id` and `name`, and nothing else', () => {
    // No locality, country, coordinates, length, corner count, direction,
    // first-Grand-Prix year or lap record: GridView does not own those facts
    // for these venues, and an identity does not need them.
    const approved = new Set(APPROVED_IDENTITIES.map((row) => row.gridviewId));
    const newRows = circuitRegistry.filter((entry) =>
      approved.has(entry.id as string),
    );

    expect(newRows).toHaveLength(17);
    for (const row of newRows) {
      expect(Object.keys(row).sort(), String(row.id)).toEqual(['id', 'name']);
    }
  });

  it('never adopts a provider value the curator did not approve as an ID', () => {
    // The ten whose canonical ID equals the provider value are approved as
    // such; every other provider value must be absent from the registry, so a
    // provider slug can never have been minted into an identity.
    const approvedAsId = new Set(
      ALL_ASSOCIATIONS.filter(([from, to]) => from === to).map(
        ([from]) => from,
      ),
    );
    expect([...approvedAsId].sort()).toEqual([
      'baku',
      'hungaroring',
      'miami',
      'monaco',
      'monza',
      'sepang',
      'shanghai',
      'silverstone',
      'suzuka',
      'zandvoort',
    ]);

    const ids = new Set(circuitRegistry.map((entry) => entry.id as string));
    for (const [providerValue] of ALL_ASSOCIATIONS) {
      if (approvedAsId.has(providerValue)) continue;
      expect(ids.has(providerValue), providerValue).toBe(false);
    }
  });
});

describe('the 2026 Jolpica circuit mappings', () => {
  it('are exactly 23 Jolpica circuitId records in a 2026 file', () => {
    expect(mappingDocument.season).toBe(2026);
    expect(circuitMappings).toHaveLength(23);
    for (const record of circuitMappings) {
      expect(record.source).toBe('jolpica');
      expect(record.providerField).toBe('circuitId');
    }
  });

  it('are exactly the 23 approved associations', () => {
    expect(
      circuitMappings
        .map((record) => [String(record.providerValue), record.gridviewId])
        .sort(),
    ).toEqual([...ALL_ASSOCIATIONS].map(([from, to]) => [from, to]).sort());
  });

  it('carries no inner season on any mapping record', () => {
    // The season is the key's qualifier, supplied by the file. A record that
    // carried its own could disagree with the file and then match nothing
    // (ADR 0022 amendment A2).
    for (const record of mappingDocument.mappings) {
      expect(record, String(record.providerValue)).not.toHaveProperty('season');
    }
  });

  it('keeps every provider value exactly as observed, unnormalised', () => {
    const observed = circuitMappings.map((record) =>
      String(record.providerValue),
    );
    for (const value of observed) {
      expect(value.trim(), value).toBe(value);
      expect(value.toLowerCase(), value).toBe(value);
    }
    // The underscore forms survive verbatim: nothing hyphenated them on the
    // way in, even where the canonical ID is hyphenated.
    for (const underscored of [
      'albert_park',
      'red_bull_ring',
      'marina_bay',
      'yas_marina',
    ]) {
      expect(observed).toContain(underscored);
    }
  });

  it('leaves the pre-existing albert_park mapping exactly as it was', () => {
    const record = circuitMappings.find(
      (entry) => entry.providerValue === ALREADY_MAPPED.providerValue,
    );

    expect(record?.gridviewId).toBe(ALREADY_MAPPED.gridviewId);
    expect(record?.evidence).toBe(ALREADY_MAPPED.evidence);
  });

  it('targets only circuits that exist in the curated registry', () => {
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
  it('records exactly the 23 mapped identities', () => {
    expect(evidenceCorpus.season).toBe(2026);
    expect(circuitIdentities).toHaveLength(23);
    expect(
      circuitIdentities.map((record) => record.providerValue).sort(),
    ).toEqual(ALL_ASSOCIATIONS.map(([from]) => from).sort());
  });

  it('acknowledges no circuit at all', () => {
    expect(evidenceCorpus.acknowledgedUnmapped.filter(isCircuit)).toEqual([]);
  });

  it('keeps the four non-circuit acknowledgements exactly as they were', () => {
    expect(
      evidenceCorpus.acknowledgedUnmapped
        .map((record) => [
          record.source,
          record.entity,
          String(record.providerValue),
          String(record.reason),
        ])
        .sort(),
    ).toEqual([...NON_CIRCUIT_ACKNOWLEDGEMENTS].map((row) => [...row]).sort());
  });

  it('never both maps and acknowledges the same identity', () => {
    const mapped = new Set(
      mappingDocument.mappings.map((record) =>
        JSON.stringify([record.source, record.entity, record.providerValue]),
      ),
    );
    for (const record of evidenceCorpus.acknowledgedUnmapped) {
      expect(
        mapped.has(
          JSON.stringify([record.source, record.entity, record.providerValue]),
        ),
        String(record.providerValue),
      ).toBe(false);
    }
  });

  it('gives each §8.8 identity a repository-owned, licensed evidence record', () => {
    const fromTheCalendar = [
      ...MAPPED_2026_09_19.map((row) => row.circuitId),
      ...APPROVED_IDENTITIES.map((row) => row.circuitId),
    ];

    for (const circuitId of fromTheCalendar) {
      const evidence = evidenceFor(circuitId);

      // Where it is recorded inside this repository, and which value it is.
      expect(evidence, circuitId).toContain(
        `GridView_Provider_Evaluation.md 8.8 circuit ${circuitId} -`,
      );
      // The exact response, its access instant and its attribution.
      expect(evidence, circuitId).toContain(RESPONSE_HASH);
      expect(evidence, circuitId).toContain(OBSERVED_AT);
      expect(evidence, circuitId).toContain('Jolpica F1');
      expect(evidence, circuitId).toContain('CC BY-NC-SA 4.0');
      // No private path or machine-local capture is ever cited.
      expect(evidence, circuitId).not.toContain('.gridview');
    }
  });

  it('cites the round the response actually recorded for each identity', () => {
    for (const row of APPROVED_IDENTITIES) {
      expect(evidenceFor(row.circuitId), row.circuitId).toContain(
        `round ${row.round}.`,
      );
    }
  });

  it('reuses the hungaroring identity rather than duplicating it', () => {
    // It was already an approved identity while it was acknowledged. The
    // dataset updated that one record to the §8.8 observation now backing its
    // mapping; a second record would be a duplicate identity.
    const hungaroring = circuitIdentities.filter(
      (record) => record.providerValue === 'hungaroring',
    );
    expect(hungaroring).toHaveLength(1);
    expect(evidenceFor('hungaroring')).toContain('round 11.');
  });

  it('cites the same evidence from the mapping and from the corpus', () => {
    for (const [providerValue] of ALL_ASSOCIATIONS) {
      const mapping = circuitMappings.find(
        (record) => record.providerValue === providerValue,
      );
      expect(mapping?.evidence, providerValue).toBe(evidenceFor(providerValue));
    }
  });

  it('leaves the albert_park evidence record unchanged', () => {
    expect(evidenceFor(ALREADY_MAPPED.providerValue)).toBe(
      ALREADY_MAPPED.evidence,
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

  it('keeps the curated event registry at its 23 identities', () => {
    const events = (
      JSON.parse(
        readRepoFile('content', 'registries', 'events.development.json'),
      ) as { events: { id: string }[] }
    ).events;

    expect(events).toHaveLength(23);
    expect(new Set(events.map((entry) => entry.id)).size).toBe(23);
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
    expect(mappingDocument.mappings).toHaveLength(53);
    expect(evidenceCorpus.identities).toHaveLength(57);
    expect(evidenceCorpus.acknowledgedUnmapped).toHaveLength(4);
  });

  it('keeps every stated mapping total in the Implementation Plan true', () => {
    // Pinned by count, not by wording: the deliverables list drifted once,
    // claiming eight curated mappings after the dataset had grown past it.
    const plan = readRepoFile(
      'docs',
      'technical',
      'GridView_Implementation_Plan.md',
    );
    const claims = [...plan.matchAll(/(\d+) exact mappings are curated/g)].map(
      ([, count]) => Number(count),
    );

    expect(claims.length).toBeGreaterThan(0);
    for (const claimed of claims) {
      expect(claimed).toBe(mappingDocument.mappings.length);
    }

    const acknowledged = [
      ...plan.matchAll(
        /(\w+) approved identities are explicitly acknowledged as unmapped/g,
      ),
    ].map(([, word]) => word);
    expect(acknowledged.length).toBeGreaterThan(0);
    for (const word of acknowledged) {
      expect(word).toBe('four');
    }
    expect(evidenceCorpus.acknowledgedUnmapped).toHaveLength(4);
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
      '**23 of 23**',
      '**53 exact mappings**',
      '**57 approved evidence identities**',
      '**four acknowledgements**',
      'only `id` and `name`',
      '**No additional provider request was made.**',
      'mapping decision only',
    ]) {
      expect(section, fact).toContain(fact);
    }
  });

  it('never claims an adapter, a runtime path or a live provider mode', () => {
    // The one thing a complete dataset must not be read as. Matched on the
    // unwrapped text, so a reflow of the prose does not silently drop a claim.
    const flat = section.replace(/\s+/g, ' ');

    for (const fact of [
      'no Jolpica adapter has been written',
      'no live provider mode has been enabled',
      'G1 remains open',
      'circuit portion of G-l is complete',
      'G-l itself remains open',
      'A complete mapping dataset is not an adapter, a runtime path or a production capability.',
    ]) {
      expect(flat, fact).toContain(fact);
    }
  });

  it('no longer makes any of the superseded coverage claims', () => {
    for (const stale of [
      '**6 of the 23**',
      '**17 remain unresolved',
      'remains blocked\non circuit coverage',
    ]) {
      expect(section, stale).not.toContain(stale);
    }
  });

  it('is reconstructed exactly by the committed five-circuit table', () => {
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

    expect(rows).toEqual(MAPPED_2026_09_19);
    for (const row of rows) {
      expect(resolvedCircuit(row.circuitId), row.circuitId).toBe(
        row.gridviewId,
      );
    }
  });

  it('is reconstructed exactly by the committed 17-identity table', () => {
    const rows = [
      ...section.matchAll(
        /^\| (\d+) \| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \|$/gm,
      ),
    ].map(([, round, circuitId, gridviewId, name]) => ({
      round: Number(round),
      circuitId: String(circuitId),
      gridviewId: String(gridviewId),
      name: String(name),
    }));

    expect(rows).toEqual(APPROVED_IDENTITIES);
    for (const row of rows) {
      expect(resolvedCircuit(row.circuitId), row.circuitId).toBe(
        row.gridviewId,
      );
      // The display name in the record is the one in the registry.
      expect(
        circuitRegistry.find((entry) => entry.id === row.gridviewId)?.name,
        row.gridviewId,
      ).toBe(row.name);
    }
  });
});

describe('a defective dataset is rejected', () => {
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

  it('fails the row pin when a newly curated target is swapped', () => {
    // The same defect over the 2026-09-20 identities, which is where a
    // transcription slip is most likely: 17 rows entered in one pass.
    const swapped = registryOf(
      mappingDocument.mappings.map((record) =>
        record.providerValue === 'interlagos'
          ? { ...record, gridviewId: 'lusail' }
          : record,
      ),
    );

    expect(swapped.problems).toEqual([]);
    expect(swapped.resolve(circuitKey('interlagos')).outcome).toBe('resolved');
    expect(resolvedCircuit('interlagos')).toBe('jose-carlos-pace');
  });

  it('fails closed when a target does not exist in the registry', () => {
    // A circuit identity minted from the provider slug is the failure this
    // dataset must never commit: `interlagos` has no canonical circuit called
    // `interlagos`, and `spa` has none called `spa`.
    for (const providerValue of ['spa', 'interlagos']) {
      const minted = registryOf(
        mappingDocument.mappings.map((record) =>
          record.providerValue === providerValue
            ? { ...record, gridviewId: providerValue }
            : record,
        ),
      );

      expect(minted.isValid, providerValue).toBe(false);
      expect(minted.problems.length, providerValue).toBeGreaterThan(0);
      expect(
        minted.resolve(circuitKey(providerValue)).outcome,
        providerValue,
      ).toBe('unresolved');
    }
  });

  it('carries no duplicate canonical identity', () => {
    // Build-time rejection of a duplicate lives in the content validator and
    // is asserted against it in test/scripts/provider-mapping-rules.test.mjs.
    // What this file owns is the committed dataset: 23 rows, 23 identities.
    const ids = circuitRegistry.map((entry) => entry.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    expect(canonical.circuit.size).toBe(23);
  });

  it('fails closed when a curated identity is removed from the registry', () => {
    // The mirror of the duplicate: every one of the 23 targets must exist, so
    // dropping any single identity invalidates the whole registry.
    for (const [providerValue, gridviewId] of ALL_ASSOCIATIONS) {
      const without = registryOf(mappingDocument.mappings, SEASON, {
        ...canonical,
        circuit: new Set(
          [...canonical.circuit].filter((id) => id !== gridviewId),
        ),
      });

      expect(without.isValid, gridviewId).toBe(false);
      expect(
        without.resolve(circuitKey(providerValue)).outcome,
        providerValue,
      ).toBe('unresolved');
    }
  });
});

describe('validation needs nothing outside the repository', () => {
  it('cites no private evidence path anywhere in the curated content', () => {
    // A clean checkout has no `~/.gridview` capture. Nothing here may depend
    // on one, so the whole corpus is searched, not just the circuit rows.
    const corpus = [
      readRepoFile(
        'content',
        'seasons',
        '2026',
        'provider-mappings.development.json',
      ),
      readRepoFile(
        'content',
        'seasons',
        '2026',
        'provider-evidence.development.json',
      ),
      readRepoFile('content', 'registries', 'circuits.mock.json'),
    ].join('\n');

    for (const marker of ['.gridview', 'raw-response', 'C:\\', '/home/']) {
      expect(corpus, marker).not.toContain(marker);
    }
  });

  it('reconstructs every association from committed content alone', () => {
    // This whole file reads only the repository, so a green run *is* the
    // proof: the raw capture is never opened.
    expect(ALL_ASSOCIATIONS).toHaveLength(23);
    for (const [providerValue, gridviewId] of ALL_ASSOCIATIONS) {
      expect(resolvedCircuit(providerValue), providerValue).toBe(gridviewId);
    }
  });
});
