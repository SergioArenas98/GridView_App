/**
 * The curated 2026 Jolpica constructor dataset.
 *
 * Pins the curator decision of 2026-09-23 that Provider Evaluation §8.9
 * records: every one of the 11 `constructorId`s observed in the season-2026
 * Jolpica constructor list maps to a curated GridView constructor, and the
 * curated constructor registry holds exactly those 11 identities.
 *
 * - `mclaren` and `mercedes` were already mapped (§8.4) and are untouched.
 * - `alpine`, `ferrari` and `red_bull` map onto identities that already existed.
 * - `audi` continues the existing `sauber` identity. By a curator-approved
 *   identity decision (Domain Model §6.3 naming layers) the stable ID stays
 *   `sauber` while its current canonical `name` and `shortName` become `Audi`.
 *   No `audi` identity exists, and season entrant names stay season-scoped.
 * - `rb` maps to the curator-authored `racing-bulls`. `rb` is never an ID.
 * - `aston-martin`, `cadillac`, `haas`, `racing-bulls` and `williams` are new,
 *   identity-only rows: `id` and `name`, nothing else.
 *
 * `ACCEPTED` below is that curator decision row for row, so changing any
 * association or any canonical name means changing it here in the same
 * reviewed commit. Drivers are not part of this dataset and stay incomplete.
 *
 * A complete constructor dataset is not a port. When it merged nothing
 * consumed it and no drivers, constructors or participants port existed; the
 * dormant, fixture-tested participants port added later (Implementation Plan
 * §14.0.21) now resolves these mappings, and is registered nowhere.
 *
 * Runs from a clean checkout. The raw Jolpica capture is held outside the
 * repository and is never read here: §8.9 is the repository-owned record of
 * it, and this test reconstructs that record from committed content.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { validateConstructor } from '../../../src/contract/normalized';
import { MockFormulaOneProvider } from '../../../src/providers/mock/mock-provider';
import { FixedClock } from '../../../src/runtime/clock';

import { canonical, key, realRegistry, registryOf, SEASON } from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(repoRoot, ...segments), 'utf8');
}

/** The exact response hash §8.9 records for the 2026-09-23 observation. */
const RESPONSE_HASH =
  'bbf4c76a4d5ad9e519e26e73af9641fcee7cd97942185866d5c30f82ab2c988e';

/** The response `Date` §8.9 records for that one response. */
const OBSERVED_AT = '2026-09-23T18:33:16Z';

const ENDPOINT = 'https://api.jolpi.ca/ergast/f1/2026/constructors/?limit=100';

interface AcceptedRow {
  readonly constructorId: string;
  readonly gridviewId: string;
  readonly name: string;
}

/** The accepted table: exact Jolpica `constructorId` -> canonical ID, name. */
const ACCEPTED: readonly AcceptedRow[] = (
  [
    ['alpine', 'alpine', 'Alpine'],
    ['aston_martin', 'aston-martin', 'Aston Martin'],
    ['audi', 'sauber', 'Audi'],
    ['cadillac', 'cadillac', 'Cadillac'],
    ['ferrari', 'ferrari', 'Ferrari'],
    ['haas', 'haas', 'Haas'],
    ['mclaren', 'mclaren', 'McLaren'],
    ['mercedes', 'mercedes', 'Mercedes'],
    ['rb', 'racing-bulls', 'Racing Bulls'],
    ['red_bull', 'red-bull', 'Red Bull'],
    ['williams', 'williams', 'Williams'],
  ] as const
).map(([constructorId, gridviewId, name]) => ({
  constructorId,
  gridviewId,
  name,
}));

/** The five identities this dataset created. */
const NEW_IDS = [
  'aston-martin',
  'cadillac',
  'haas',
  'racing-bulls',
  'williams',
] as const;

/** The two mappings that predate the dataset (§8.4), byte for byte. */
const PRE_EXISTING_MAPPINGS = [
  {
    source: 'jolpica',
    entity: 'constructor',
    providerField: 'constructorId',
    providerValue: 'mclaren',
    gridviewId: 'mclaren',
    evidence:
      'GridView_Provider_Evaluation.md 8.4 - Jolpica constructorId slug example.',
  },
  {
    source: 'jolpica',
    entity: 'constructor',
    providerField: 'constructorId',
    providerValue: 'mercedes',
    gridviewId: 'mercedes',
    evidence:
      'GridView_Provider_Evaluation.md 8.4 - Jolpica constructorId slug example; 8.5 constructor championship leader.',
  },
] as const;

/**
 * The six registry rows that predate the dataset, exactly as they must now
 * read. Only `sauber`'s `name` and `shortName` changed (`Sauber` -> `Audi`);
 * every other property of every row, and its key order, is unchanged.
 */
const PRE_EXISTING_ROWS = [
  {
    id: 'red-bull',
    name: 'Red Bull',
    shortName: 'Red Bull',
    nationality: 'Austrian',
    countryCode: 'AT',
    colorPrimary: '#1e41ff',
    biography: null,
  },
  {
    id: 'ferrari',
    name: 'Ferrari',
    shortName: 'Ferrari',
    nationality: 'Italian',
    countryCode: 'IT',
    colorPrimary: '#e8002d',
    biography: null,
  },
  {
    id: 'mercedes',
    name: 'Mercedes',
    shortName: 'Mercedes',
    nationality: 'German',
    countryCode: 'DE',
    colorPrimary: '#00a19c',
    biography: null,
  },
  {
    id: 'mclaren',
    name: 'McLaren',
    shortName: 'McLaren',
    nationality: 'British',
    countryCode: 'GB',
    colorPrimary: '#ff8000',
    biography: null,
  },
  {
    id: 'alpine',
    name: 'Alpine',
    shortName: 'Alpine',
    nationality: 'French',
    countryCode: 'FR',
    colorPrimary: '#0093cc',
    biography: null,
  },
  {
    id: 'sauber',
    name: 'Audi',
    shortName: 'Audi',
    nationality: 'Swiss',
    countryCode: 'CH',
    colorPrimary: '#52e252',
    biography:
      'Stable constructor identity used to demonstrate cross-season rebranding in fixtures.',
  },
] as const;

/**
 * The `sauber` row exactly as it read before this dataset (`master` at
 * `9fa4606`). The curator decision may change only its `name` and
 * `shortName`; the biography is still true and stays byte-identical.
 */
const SAUBER_BASELINE = {
  id: 'sauber',
  name: 'Sauber',
  shortName: 'Sauber',
  nationality: 'Swiss',
  countryCode: 'CH',
  colorPrimary: '#52e252',
  biography:
    'Stable constructor identity used to demonstrate cross-season rebranding in fixtures.',
} as const;

/**
 * The three acknowledgements left once the 2026-09-23 driver dataset mapped
 * Jolpica `antonelli` and corrected the OpenF1 `12` reason, each with its
 * closed reason.
 */
const ACKNOWLEDGEMENTS: readonly (readonly [string, string, string, string])[] =
  [
    ['openf1', 'driver', '12', 'no-approved-provider-mapping'],
    ['openf1', 'constructor', 'Cadillac', 'no-approved-provider-mapping'],
    ['openf1', 'constructor', 'Racing Bulls', 'no-approved-provider-mapping'],
  ];

/** The keys a mapping record may carry. Anything else is an alias or worse. */
const MAPPING_KEYS = new Set([
  'source',
  'entity',
  'providerField',
  'providerValue',
  'gridviewId',
  'evidence',
  'note',
]);

interface CuratedRecord {
  readonly source: string;
  readonly entity: string;
  readonly providerField: string;
  readonly providerValue: unknown;
  readonly gridviewId?: string;
  readonly evidence?: string;
  readonly reason?: string;
  readonly detail?: string;
}

const registryText = readRepoFile(
  'content',
  'registries',
  'constructors.mock.json',
);
const constructorRegistry = (
  JSON.parse(registryText) as { constructors: Record<string, unknown>[] }
).constructors;

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

const isJolpicaConstructor = (record: CuratedRecord): boolean =>
  record.source === 'jolpica' && record.entity === 'constructor';

const real = realRegistry();
const constructorMappings =
  mappingDocument.mappings.filter(isJolpicaConstructor);
const constructorIdentities =
  evidenceCorpus.identities.filter(isJolpicaConstructor);

function constructorKey(providerValue: string, season: number = SEASON) {
  return key<'constructor'>({
    season,
    source: 'jolpica',
    entity: 'constructor',
    providerField: 'constructorId',
    providerValue,
  });
}

function resolvedConstructor(providerValue: string): string | null {
  const result = real.resolve(constructorKey(providerValue));
  return result.outcome === 'resolved' ? result.gridviewId : null;
}

function evidenceFor(providerValue: string): string {
  const record = constructorIdentities.find(
    (entry) => entry.providerValue === providerValue,
  );
  return String(record?.evidence ?? '');
}

/**
 * The dataset's central predicate: the season-2026 Jolpica constructor
 * mappings are exactly the accepted table - every row present, no row extra,
 * every provider value a string compared with strict equality and every
 * target the accepted one. The negative controls below feed it defective
 * copies of the committed mappings to show it rejects them.
 */
function isExactlyTheAcceptedTable(
  mappings: readonly CuratedRecord[],
): boolean {
  const rows = mappings.filter(isJolpicaConstructor);
  if (rows.length !== ACCEPTED.length) return false;
  return ACCEPTED.every(
    (accepted) =>
      rows.filter(
        (row) =>
          typeof row.providerValue === 'string' &&
          row.providerValue === accepted.constructorId &&
          row.providerField === 'constructorId' &&
          row.gridviewId === accepted.gridviewId,
      ).length === 1,
  );
}

// ---------------------------------------------------------------------------

describe('the curated constructor registry', () => {
  it('holds exactly the 11 accepted identities', () => {
    const ids = constructorRegistry.map((entry) => entry.id as string);

    expect(ids).toHaveLength(11);
    expect(new Set(ids).size).toBe(11);
    expect(canonical.constructor.size).toBe(11);
    expect([...ids].sort()).toEqual(
      ACCEPTED.map((row) => row.gridviewId).sort(),
    );
  });

  it('pairs every id with its accepted display name', () => {
    expect(
      constructorRegistry.map((entry) => [entry.id, entry.name]).sort(),
    ).toEqual(ACCEPTED.map((row) => [row.gridviewId, row.name]).sort());
  });

  it('created exactly five identities, each carrying only `id` and `name`', () => {
    const preExisting = new Set<string>(PRE_EXISTING_ROWS.map((row) => row.id));
    const created = constructorRegistry.filter(
      (entry) => !preExisting.has(entry.id as string),
    );

    expect(created.map((entry) => entry.id).sort()).toEqual([...NEW_IDS]);
    for (const row of created) {
      // No short name, nationality, country, colour, biography or media: no
      // provider descriptive fact was imported, and an identity needs none.
      expect(Object.keys(row), String(row.id)).toEqual(['id', 'name']);
    }
  });

  it('keeps every pre-existing row byte-identical apart from the sauber names', () => {
    for (const expected of PRE_EXISTING_ROWS) {
      const row = constructorRegistry.find((entry) => entry.id === expected.id);
      // Serialized, so key order counts as much as every value.
      expect(JSON.stringify(row), expected.id).toBe(JSON.stringify(expected));
    }
  });

  it('changes only the name and short name of the sauber row', () => {
    const row = constructorRegistry.find((entry) => entry.id === 'sauber');
    const baseline: Record<string, unknown> = SAUBER_BASELINE;
    const changed = Object.keys(baseline).filter(
      (field) =>
        JSON.stringify(row?.[field]) !== JSON.stringify(baseline[field]),
    );

    expect(changed).toEqual(['name', 'shortName']);
    expect(Object.keys(row ?? {})).toEqual(Object.keys(baseline));
    // The lineage biography is still true, so it is byte-identical.
    expect(row?.biography).toBe(SAUBER_BASELINE.biography);
  });

  it('keeps season naming out of the stable identity row', () => {
    const row = constructorRegistry.find((entry) => entry.id === 'sauber');
    for (const seasonField of [
      'fullName',
      'season',
      'powerUnit',
      'driverLineup',
    ]) {
      expect(row, seasonField).not.toHaveProperty(seasonField);
    }
  });

  it('continues the sauber identity as Audi and creates no audi or rb identity', () => {
    const ids = new Set(constructorRegistry.map((entry) => entry.id as string));
    const sauber = constructorRegistry.find((entry) => entry.id === 'sauber');

    expect(sauber?.id).toBe('sauber');
    expect(sauber?.name).toBe('Audi');
    expect(sauber?.shortName).toBe('Audi');
    expect(ids.has('audi')).toBe(false);
    expect(ids.has('rb')).toBe(false);
    // Neither provider ID is adopted anywhere in the registry as an ID token.
    expect(registryText).not.toMatch(/"id":\s*"(audi|rb)"/);
  });

  it('never adopts an unapproved provider value as an ID', () => {
    const ids = new Set(constructorRegistry.map((entry) => entry.id as string));
    for (const row of ACCEPTED) {
      if (row.constructorId === row.gridviewId) continue;
      expect(ids.has(row.constructorId), row.constructorId).toBe(false);
    }
  });
});

describe('the 2026 Jolpica constructor mappings', () => {
  it('are exactly the 11 accepted associations', () => {
    expect(mappingDocument.season).toBe(2026);
    expect(constructorMappings).toHaveLength(11);
    expect(isExactlyTheAcceptedTable(mappingDocument.mappings)).toBe(true);
    expect(
      constructorMappings
        .map((record) => [record.providerValue, record.gridviewId])
        .sort(),
    ).toEqual(
      ACCEPTED.map((row) => [row.constructorId, row.gridviewId]).sort(),
    );
  });

  it('maps the exact string `rb` to `racing-bulls` and nothing else', () => {
    // Token-exact, never substring: `rb` is two characters long and occurs
    // inside countless public strings, so containment can never protect it.
    const rb = constructorMappings.filter(
      (record) => record.providerValue === 'rb',
    );
    expect(rb).toHaveLength(1);
    expect(typeof rb[0]?.providerValue).toBe('string');
    expect(rb[0]?.gridviewId).toBe('racing-bulls');
    expect(resolvedConstructor('rb')).toBe('racing-bulls');

    // No other provider value reaches racing-bulls, so `rb` cannot have been
    // replaced by a normalized or aliased spelling.
    expect(
      constructorMappings
        .filter((record) => record.gridviewId === 'racing-bulls')
        .map((record) => record.providerValue),
    ).toEqual(['rb']);
    for (const near of ['RB', 'Rb', ' rb', 'rb ', 'r_b', 'racing_bulls']) {
      expect(resolvedConstructor(near), near).toBeNull();
    }
  });

  it('maps `audi` onto the continued `sauber` identity', () => {
    expect(resolvedConstructor('audi')).toBe('sauber');
    expect(resolvedConstructor('sauber')).toBeNull();
    // Never `audi -> audi`: the provider ID is not adopted as a target.
    expect(
      mappingDocument.mappings.filter((record) => record.gridviewId === 'audi'),
    ).toEqual([]);
    expect(
      constructorMappings.filter((record) => record.providerValue === 'audi'),
    ).toHaveLength(1);
  });

  it('gives every canonical constructor exactly one Jolpica provider value', () => {
    const targets = constructorMappings.map((record) => record.gridviewId);
    expect(new Set(targets).size).toBe(11);
  });

  it('leaves the pre-existing mclaren and mercedes mappings byte-identical', () => {
    for (const expected of PRE_EXISTING_MAPPINGS) {
      const record = constructorMappings.find(
        (entry) => entry.providerValue === expected.providerValue,
      );
      expect(JSON.stringify(record), expected.providerValue).toBe(
        JSON.stringify(expected),
      );
    }
  });

  it('carries no alias, normalized value or inner season', () => {
    for (const record of constructorMappings) {
      const label = String(record.providerValue);
      for (const field of Object.keys(record)) {
        expect(MAPPING_KEYS.has(field), `${label}.${field}`).toBe(true);
      }
      expect(record, label).not.toHaveProperty('season');
      expect(record.providerField, label).toBe('constructorId');
      expect(typeof record.providerValue, label).toBe('string');
      // Exactly as observed: lower-case, untrimmed nothing, underscores kept.
      expect(label.trim(), label).toBe(label);
      expect(label.toLowerCase(), label).toBe(label);
    }
    expect(constructorMappings.map((record) => record.providerValue)).toEqual(
      expect.arrayContaining(['aston_martin', 'red_bull']),
    );
  });

  it('matches nothing in another season or through a near miss', () => {
    for (const row of ACCEPTED) {
      expect(
        real.resolve(constructorKey(row.constructorId, 2027)).outcome,
        row.constructorId,
      ).toBe('unresolved');
      for (const near of [
        row.constructorId.toUpperCase(),
        row.constructorId.replaceAll('_', '-'),
        ` ${row.constructorId}`,
        `${row.constructorId} `,
      ]) {
        if (near === row.constructorId) continue;
        expect(
          real.resolveUnknown({
            season: SEASON,
            source: 'jolpica',
            entity: 'constructor',
            providerField: 'constructorId',
            providerValue: near,
          }).outcome,
          near,
        ).toBe('unresolved');
      }
    }
  });
});

describe('the 2026 constructor evidence corpus', () => {
  it('records all 11 observed Jolpica constructor identities', () => {
    expect(evidenceCorpus.season).toBe(2026);
    expect(constructorIdentities).toHaveLength(11);
    expect(
      constructorIdentities.map((record) => record.providerValue).sort(),
    ).toEqual(ACCEPTED.map((row) => row.constructorId).sort());
  });

  it('gives each new mapping a repository-owned, licensed evidence record', () => {
    const preExisting = new Set<string>(
      PRE_EXISTING_MAPPINGS.map((row) => row.providerValue),
    );
    for (const row of ACCEPTED) {
      if (preExisting.has(row.constructorId)) continue;
      const evidence = evidenceFor(row.constructorId);

      expect(evidence, row.constructorId).toContain(
        `GridView_Provider_Evaluation.md 8.9 constructor ${row.constructorId} -`,
      );
      expect(evidence, row.constructorId).toContain(RESPONSE_HASH);
      expect(evidence, row.constructorId).toContain(OBSERVED_AT);
      expect(evidence, row.constructorId).toContain(ENDPOINT);
      expect(evidence, row.constructorId).toContain('Jolpica F1');
      expect(evidence, row.constructorId).toContain('CC BY-NC-SA 4.0');
      expect(evidence, row.constructorId).not.toContain('.gridview');

      // The mapping cites the very same record.
      const mapping = constructorMappings.find(
        (record) => record.providerValue === row.constructorId,
      );
      expect(mapping?.evidence, row.constructorId).toBe(evidence);
    }
  });

  it('acknowledges no Jolpica constructor identity', () => {
    expect(
      evidenceCorpus.acknowledgedUnmapped.filter(isJolpicaConstructor),
    ).toEqual([]);
  });

  it('keeps the three acknowledgements, with accurate OpenF1 reasons', () => {
    expect(evidenceCorpus.acknowledgedUnmapped).toHaveLength(3);
    expect(
      evidenceCorpus.acknowledgedUnmapped
        .map((record) => [
          record.source,
          record.entity,
          String(record.providerValue),
          String(record.reason),
        ])
        .sort(),
    ).toEqual([...ACKNOWLEDGEMENTS].map((row) => [...row]).sort());
  });

  it('keeps Cadillac and Racing Bulls unmapped for OpenF1 now that their identities exist', () => {
    for (const [teamName, canonicalId] of [
      ['Cadillac', 'cadillac'],
      ['Racing Bulls', 'racing-bulls'],
    ] as const) {
      const record = evidenceCorpus.acknowledgedUnmapped.find(
        (entry) => entry.providerValue === teamName,
      );
      expect(record?.providerField, teamName).toBe('team_name');
      expect(record?.detail, teamName).toContain(canonicalId);
      expect(record?.detail, teamName).not.toContain('No canonical');
      expect(canonical.constructor.has(canonicalId), teamName).toBe(true);
      expect(
        mappingDocument.mappings.some(
          (entry) =>
            entry.source === 'openf1' && entry.providerValue === teamName,
        ),
        teamName,
      ).toBe(false);
      expect(
        real.resolve(
          key<'constructor'>({
            season: SEASON,
            source: 'openf1',
            entity: 'constructor',
            providerField: 'team_name',
            providerValue: teamName,
          }),
        ).outcome,
        teamName,
      ).toBe('unresolved');
    }
  });
});

describe('the constructors reach the normalized contract', () => {
  async function loadConstructors() {
    const provider = new MockFormulaOneProvider({
      clock: new FixedClock(new Date('2026-07-20T12:00:00.000Z')),
    });
    return (await provider.fetchSeasonSource(2026, ['season-calendar']))
      .constructors;
  }

  it('emits all 11 as valid normalized constructors', async () => {
    const constructors = await loadConstructors();

    expect(constructors).toHaveLength(11);
    for (const constructor of constructors) {
      expect(
        validateConstructor(constructor, 'constructor'),
        constructor.id,
      ).toEqual([]);
    }
  });

  it('preserves the normalized output of every pre-existing row', async () => {
    const constructors = await loadConstructors();

    for (const expected of PRE_EXISTING_ROWS) {
      const emitted = constructors.find((entry) => entry.id === expected.id);
      // The registry row followed by `media`, in that order: the defaults
      // neither add a value nor move a key ahead of `id` and `name`.
      expect(JSON.stringify(emitted), expected.id).toBe(
        JSON.stringify({ ...expected, media: emitted?.media ?? null }),
      );
    }
  });
});

describe('nothing outside the constructor dataset moved', () => {
  it('pins the dataset totals, including the later driver dataset', () => {
    // 62 / 66 / 4 when this dataset merged; the 2026-09-23 driver dataset
    // added 31 driver mappings and 30 driver evidence identities and removed
    // the Jolpica `antonelli` acknowledgement.
    expect(mappingDocument.mappings).toHaveLength(93);
    expect(evidenceCorpus.identities).toHaveLength(96);
    expect(evidenceCorpus.acknowledgedUnmapped).toHaveLength(3);
  });

  it('leaves drivers to the driver dataset: 33 identities, 32 Jolpica mappings', () => {
    const drivers = (
      JSON.parse(
        readRepoFile('content', 'registries', 'drivers.mock.json'),
      ) as {
        drivers: { id: string }[];
      }
    ).drivers;
    const jolpicaDrivers = mappingDocument.mappings.filter(
      (record) => record.source === 'jolpica' && record.entity === 'driver',
    );

    // Row-for-row pinning lives in driver-dataset-2026.test.ts.
    expect(drivers).toHaveLength(33);
    expect(canonical.driver.size).toBe(33);
    expect(jolpicaDrivers).toHaveLength(32);
    expect(jolpicaDrivers[0]).toMatchObject({
      providerValue: 'norris',
      gridviewId: 'lando-norris',
    });
  });

  it('leaves events and circuits fully mapped at 23 / 23', () => {
    const count = (entity: string) =>
      mappingDocument.mappings.filter((record) => record.entity === entity)
        .length;

    expect(canonical.event.size).toBe(23);
    expect(count('event')).toBe(23);
    expect(canonical.circuit.size).toBe(23);
    expect(count('circuit')).toBe(23);
  });
});

describe('the repository-owned evidence record (Provider Evaluation §8.9)', () => {
  const evaluation = readRepoFile(
    'docs',
    'technical',
    'GridView_Provider_Evaluation.md',
  );
  const start = evaluation.indexOf('### 8.9 ');
  // §8.10 (drivers) follows §8.9 directly, so the section ends at its heading.
  const section = evaluation.slice(
    start,
    evaluation.indexOf('\n### 8.10 ', start),
  );
  const flat = section.replace(/\s+/g, ' ');

  it('records the observation, its licence and its coverage', () => {
    expect(start).toBeGreaterThan(0);
    for (const fact of [
      RESPONSE_HASH,
      ENDPOINT,
      OBSERVED_AT,
      'HTTP 200',
      'Jolpica F1',
      'CC BY-NC-SA 4.0',
      '**11 of 11**',
      '**62 exact mappings**',
      '**66 approved evidence identities**',
      '**four acknowledgements**',
      'curator-authored',
      'not committed',
    ]) {
      expect(flat, fact).toContain(fact);
    }
  });

  it('never claims a port, a participants resource or a live provider mode', () => {
    for (const fact of [
      'Driver identity coverage remains incomplete',
      'no drivers, constructors or participants port exists',
      'no live provider mode has been enabled',
      'Nothing was deployed',
    ]) {
      expect(flat, fact).toContain(fact);
    }
  });

  it('is reconstructed exactly by the committed constructor table', () => {
    const rows = [
      ...section.matchAll(
        /^\| `([a-z_]+)` \| `([a-z-]+)` \| `([^`]+)` \| [^|]+ \|$/gm,
      ),
    ].map(([, constructorId, gridviewId, name]) => ({
      constructorId: String(constructorId),
      gridviewId: String(gridviewId),
      name: String(name),
    }));

    expect(rows).toEqual(ACCEPTED);
    for (const row of rows) {
      expect(resolvedConstructor(row.constructorId), row.constructorId).toBe(
        row.gridviewId,
      );
      expect(
        constructorRegistry.find((entry) => entry.id === row.gridviewId)?.name,
        row.gridviewId,
      ).toBe(row.name);
    }
  });
});

describe('the Sauber/Audi naming decision is documented as curator-approved', () => {
  // Blockquote markers are dropped so a dated note reads as prose.
  const flatten = (text: string): string =>
    text.replace(/^>[ ]?/gm, '').replace(/\s+/g, ' ');
  const domainModel = flatten(
    readRepoFile('docs', 'technical', 'GridView_Domain_Model.md'),
  );
  const adr0022 = flatten(
    readRepoFile('docs', 'adr', '0022-curated-provider-identifier-mappings.md'),
  );
  const evaluation = readRepoFile(
    'docs',
    'technical',
    'GridView_Provider_Evaluation.md',
  );
  const start = evaluation.indexOf('### 8.9 ');
  const section89 = flatten(
    evaluation.slice(start, evaluation.indexOf('\n### 8.10 ', start)),
  );

  it('states the three naming layers in the Domain Model', () => {
    for (const rule of [
      '`Constructor.id` is **immutable**',
      '**current canonical public name** of that stable lineage',
      '**current short public label**',
      '**only through an explicit curator-reviewed decision**',
      'A provider value never renames an identity automatically',
      'remains the **exact entrant name for a particular season**',
      'Season livery, sponsor name, power unit and line-up stay outside `Constructor`',
      'never infer it from the current canonical name',
      'affects only `ConstructorSeasonEntry`',
      'not an ordinary provider alias and not an unreviewed sponsor rename',
    ]) {
      expect(domainModel, rule).toContain(rule);
    }
  });

  it('never again says that only season entries may change a name', () => {
    // The pre-2026-09-23 wording forbade any change to `Constructor.name`. It
    // survives only inside the dated amendment that quotes it.
    expect(domainModel).not.toContain('Canonical base name');
    expect(domainModel).not.toContain(
      'constructor slug; only its season entries change',
    );
    expect(domainModel).toContain(
      'The original text ended "only its season entries change"',
    );
  });

  it('records the decision in ADR 0022 and Provider Evaluation §8.9', () => {
    expect(adr0022).toContain(
      'Note 2026-09-23 - current name versus stable ID',
    );
    expect(adr0022).toContain('curator-authored lineage decision');
    expect(adr0022).toContain(
      'Jolpica supplied neither the `sauber` ID nor the lineage ruling',
    );
    expect(section89).toContain('**curator-authored lineage decision**');
    expect(section89).toContain(
      "**substantive transformation of the constructor's public identity**",
    );
    expect(section89).toContain('`ConstructorSeasonEntry.fullName`');
    expect(section89).not.toContain('display name becomes **`Audi`**');
  });
});

describe('a defective dataset is rejected', () => {
  it('rejects `rb` pointed at another constructor', () => {
    // Structurally valid - `red-bull` exists - so only the pin can reject it.
    const swapped = mappingDocument.mappings.map((record) =>
      record.providerValue === 'rb'
        ? { ...record, gridviewId: 'red-bull' }
        : record,
    );

    expect(registryOf(swapped).problems).toEqual([]);
    expect(isExactlyTheAcceptedTable(swapped)).toBe(false);
  });

  it('rejects `rb` omitted, normalized or aliased', () => {
    const variants: readonly (readonly CuratedRecord[])[] = [
      mappingDocument.mappings.filter(
        (record) => record.providerValue !== 'rb',
      ),
      mappingDocument.mappings.map((record) =>
        record.providerValue === 'rb'
          ? { ...record, providerValue: 'RB' }
          : record,
      ),
      mappingDocument.mappings.map((record) =>
        record.providerValue === 'rb'
          ? { ...record, providerValue: 'racing_bulls' }
          : record,
      ),
      [
        ...mappingDocument.mappings,
        {
          source: 'jolpica',
          entity: 'constructor',
          providerField: 'constructorId',
          providerValue: 'racing_bulls',
          gridviewId: 'racing-bulls',
          evidence: 'alias',
        },
      ],
    ];

    for (const variant of variants) {
      expect(isExactlyTheAcceptedTable(variant)).toBe(false);
    }
  });

  it('rejects a partial 10-of-11 dataset', () => {
    for (const row of ACCEPTED) {
      const partial = mappingDocument.mappings.filter(
        (record) =>
          !(
            isJolpicaConstructor(record) &&
            record.providerValue === row.constructorId
          ),
      );

      expect(
        partial.filter(isJolpicaConstructor),
        row.constructorId,
      ).toHaveLength(10);
      expect(isExactlyTheAcceptedTable(partial), row.constructorId).toBe(false);
    }
  });

  it('fails closed when a target identity is removed from the registry', () => {
    for (const row of ACCEPTED) {
      const without = registryOf(mappingDocument.mappings, SEASON, {
        ...canonical,
        constructor: new Set(
          [...canonical.constructor].filter((id) => id !== row.gridviewId),
        ),
      });

      expect(without.isValid, row.gridviewId).toBe(false);
      expect(
        without.resolve(constructorKey(row.constructorId)).outcome,
        row.constructorId,
      ).toBe('unresolved');
    }
  });
});

describe('validation needs nothing outside the repository', () => {
  it('cites no private evidence path anywhere in the curated content', () => {
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
      registryText,
    ].join('\n');

    for (const marker of ['.gridview', 'raw-response', 'C:\\', '/home/']) {
      expect(corpus, marker).not.toContain(marker);
    }
  });
});
